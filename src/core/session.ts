/**
 * The run in progress.
 *
 * Pure state: it is fed fixes, heart readings and steps from outside, and knows
 * nothing about the Geolocation or Bluetooth APIs. That separation is what lets
 * a whole run be replayed through it in a test in a millisecond, which matters
 * because the alternative way to check a distance calculation is to go running.
 */

import {
  newId,
  type Activity,
  type DistanceSource,
  type HeartSample,
  type ManualLap,
  type RunMode,
} from './activity';
import {
  estimateCalories,
  type BiologicalSex,
  type CalorieSource,
} from './calories';
import { buildHeartReport } from './heart';
import {
  distanceBetween,
  judgePoint,
  type FilterOptions,
  type GeoPoint,
  DEFAULT_FILTER,
} from './geo';
import type { RunGoal } from './goal';
import { FootpodTracker, type RscMeasurement } from './footpod';
import { distanceFromSteps } from './steps';

export type SessionState = 'idle' | 'running' | 'paused' | 'finished';

export interface SessionOptions {
  mode: RunMode;
  /** Metres per step, for treadmill runs without a pod. */
  strideM: number;
  /** Correction factor applied to a foot pod's readings. */
  footpodCalibration: number;
  filter: FilterOptions;
  /** Body mass for calorie estimate; defaults to a mid-range adult. */
  weightKg: number;
  /** Years — Keytel HR calorie model. */
  age: number;
  /** Sex — Keytel HR calorie model. */
  sex: BiologicalSex;
  /** Used to freeze zone times on the finished activity. */
  maxHeartRate: number;
  /** Optional target for this bout. */
  goal: RunGoal | null;
  /** Shoe assigned to this bout. */
  shoeId: string | null;
  /** Structured workout id / name when running a template. */
  workoutId: string | null;
  workoutName: string | null;
}

/**
 * A running clock that survives pauses.
 *
 * Elapsed time is accumulated in closed chunks rather than derived from
 * `now - startedAt`, because the latter keeps counting through a pause and there
 * is no honest way to subtract it afterwards.
 */
export class RunSession {
  readonly mode: RunMode;
  readonly startedAt: number;
  readonly goal: RunGoal | null;
  /** Mutable: chosen on the get-ready screen after the session is created. */
  shoeId: string | null;
  readonly workoutId: string | null;
  readonly workoutName: string | null;

  private readonly strideM: number;
  private readonly filter: FilterOptions;
  private readonly weightKg: number;
  private readonly age: number;
  private readonly sex: BiologicalSex;
  private readonly maxHeartRate: number;

  state: SessionState = 'idle';

  /** Accepted fixes, split at pauses. */
  segments: GeoPoint[][] = [];
  heart: HeartSample[] = [];
  steps = 0;
  inclinePercent: number | null = null;

  /**
   * The foot pod, when one is connected.
   *
   * A pod measures the foot; the pedometer infers from a bouncing phone. When
   * both are present the pod wins, and the step count carries on purely as a
   * cadence readout.
   */
  readonly footpod = new FootpodTracker();
  private usingFootpod = false;

  /** Metres accumulated from accepted fixes (outdoor) or steps (treadmill). */
  distanceM = 0;

  /** Manual laps pressed during the bout. */
  manualLaps: ManualLap[] = [];

  /** Fixes rejected by the filter, per reason — surfaced as a signal indicator. */
  rejected = { accuracy: 0, jitter: 0, teleport: 0, stale: 0 };

  private accumulatedMs = 0;
  private resumedAt = 0;
  private lastAccepted: GeoPoint | null = null;
  private lastLapDistanceM = 0;
  private lastLapElapsedMs = 0;

  constructor(options: Partial<SessionOptions> & { mode: RunMode }, startedAt = Date.now()) {
    this.mode = options.mode;
    this.strideM = options.strideM ?? 0.75;
    this.footpod.calibration = options.footpodCalibration ?? 1;
    this.filter = options.filter ?? DEFAULT_FILTER;
    this.weightKg = options.weightKg ?? 70;
    this.age = options.age ?? 35;
    this.sex = options.sex ?? 'unspecified';
    this.maxHeartRate = options.maxHeartRate ?? 185;
    this.goal = options.goal ?? null;
    this.shoeId = options.shoeId ?? null;
    this.workoutId = options.workoutId ?? null;
    this.workoutName = options.workoutName ?? null;
    this.startedAt = startedAt;
  }

  /**
   * Live calorie estimate: HR (Keytel) when the strap has samples, otherwise
   * ACSM from pace.
   */
  caloriesEstimate(now = Date.now()): { kcal: number; source: CalorieSource } {
    return estimateCalories({
      distanceM: this.distanceM,
      durationMs: this.elapsedMs(now),
      weightKg: this.weightKg,
      age: this.age,
      sex: this.sex,
      inclinePercent: this.inclinePercent,
      heart: this.heart,
    });
  }

  caloriesKcal(now = Date.now()): number {
    return this.caloriesEstimate(now).kcal;
  }

  start(t = Date.now()): void {
    if (this.state !== 'idle') return;
    this.state = 'running';
    this.resumedAt = t;
    this.lastLapDistanceM = 0;
    this.lastLapElapsedMs = 0;
    if (this.mode === 'outdoor') this.segments.push([]);
  }

  /**
   * Mark a manual lap at the current distance and moving time.
   * Returns the lap, or null if the session is not active.
   */
  lap(t = Date.now()): ManualLap | null {
    if (this.state !== 'running' && this.state !== 'paused') return null;
    const atDistanceM = this.distanceM;
    const atDurationMs = this.elapsedMs(t);
    const splitDistanceM = Math.max(0, atDistanceM - this.lastLapDistanceM);
    const splitDurationMs = Math.max(0, atDurationMs - this.lastLapElapsedMs);
    // Ignore accidental double-taps with no progress.
    if (splitDistanceM < 1 && splitDurationMs < 1000 && this.manualLaps.length > 0) {
      return null;
    }
    const entry: ManualLap = {
      index: this.manualLaps.length + 1,
      atDistanceM,
      atDurationMs,
      splitDistanceM,
      splitDurationMs,
    };
    this.manualLaps.push(entry);
    this.lastLapDistanceM = atDistanceM;
    this.lastLapElapsedMs = atDurationMs;
    return entry;
  }

  pause(t = Date.now()): void {
    if (this.state !== 'running') return;
    this.state = 'paused';
    this.accumulatedMs += t - this.resumedAt;
    // The next fix after a pause must not be joined to the one before it: the
    // athlete may have walked somewhere in between, and a straight line across
    // that gap is distance nobody ran.
    this.lastAccepted = null;
    // Same reasoning for the pod: it keeps counting if the belt keeps moving.
    this.footpod.suspend();
  }

  resume(t = Date.now()): void {
    if (this.state !== 'paused') return;
    this.state = 'running';
    this.resumedAt = t;
    if (this.mode === 'outdoor') this.segments.push([]);
  }

  finish(t = Date.now()): void {
    if (this.state === 'finished') return;
    if (this.state === 'running') this.accumulatedMs += t - this.resumedAt;
    this.state = 'finished';
    // Drop segments too short to draw, so a stray fix does not leave a
    // one-point stub on the map.
    this.segments = this.segments.filter((s) => s.length > 1);
  }

  /** Moving time in milliseconds, correct while running, paused or finished. */
  elapsedMs(now = Date.now()): number {
    if (this.state === 'running') return this.accumulatedMs + (now - this.resumedAt);
    return this.accumulatedMs;
  }

  /**
   * Offer a GPS fix. Returns true when it extended the track.
   *
   * Fixes arriving while paused are dropped rather than queued: they are the
   * whole point of pausing.
   */
  addPoint(point: GeoPoint): boolean {
    if (this.state !== 'running' || this.mode !== 'outdoor') return false;

    const verdict = judgePoint(this.lastAccepted, point, this.filter);
    if (!verdict.accept) {
      this.rejected[verdict.reason]++;
      // A rejected *first* fix of a segment still seeds the comparison, so the
      // filter has something to judge the next one against. Without this a run
      // that starts with poor signal never accumulates anything.
      if (!this.lastAccepted && verdict.reason !== 'accuracy') this.lastAccepted = point;
      return false;
    }

    const segment = this.segments[this.segments.length - 1];
    if (this.lastAccepted && segment.length > 0) {
      this.distanceM += distanceBetween(this.lastAccepted, point);
    }
    segment.push(point);
    this.lastAccepted = point;
    return true;
  }

  /** Offer a heart-rate reading. Recorded while running, ignored while paused. */
  addHeart(bpm: number, t = Date.now()): void {
    if (this.state !== 'running') return;
    if (!Number.isFinite(bpm) || bpm <= 0) return;
    this.heart.push({ t, bpm });
  }

  /** Register footfalls on the treadmill, converting them to distance. */
  addSteps(count: number): void {
    if (this.state !== 'running' || this.mode !== 'treadmill') return;
    this.steps += count;
    // Steps still count for cadence, but a pod on the shoe is the better
    // instrument and keeps ownership of the distance.
    if (!this.usingFootpod) {
      this.distanceM = distanceFromSteps(this.steps, this.strideM);
    }
  }

  /**
   * A reading from the foot pod.
   *
   * Accepted in both modes: outdoors the pod is ignored for distance, since GPS
   * is better over the ground, but its cadence is still worth having.
   */
  addFootpod(measurement: RscMeasurement, t = Date.now()): void {
    if (this.state !== 'running') return;
    this.footpod.update(measurement, t);
    if (this.mode !== 'treadmill') return;
    this.usingFootpod = true;
    this.distanceM = this.footpod.distanceM;
  }

  /** Steps per minute, from the pod if there is one. */
  cadence(): number | null {
    if (this.footpod.cadenceSpm > 0) return this.footpod.cadenceSpm;
    return null;
  }

  /** Assign (or clear) the shoe used for this bout — typically on get-ready. */
  setShoeId(id: string | null): void {
    this.shoeId = id && id.trim() ? id : null;
  }

  /**
   * How long a track may go without a fix before the silence itself is read as
   * standing still rather than as a gap in the data.
   *
   * Accepted fixes are sparser than the 1 Hz the sensor delivers, because the
   * jitter filter drops anything that did not clearly move. A few seconds of
   * quiet is therefore normal at running speed; twenty seconds is not.
   */
  private static readonly STALE_FIX_MS = 5_000;

  /**
   * Current speed in metres per second. Null means *unmeasured*, not zero.
   *
   * The distinction is the whole point. Stand still and the filter rejects
   * every fix as jitter, so the track stops growing — and this used to answer
   * null, which auto-pause reads as "no GPS yet, do not touch the clock". A
   * standing athlete was indistinguishable from a cold receiver, and the clock
   * ran on for as long as they stood there. Once there is a track, no movement
   * is an answer: zero.
   */
  recentSpeed(windowMs = 30_000, now = Date.now()): number | null {
    // Indoors the pod reports speed directly, which is both more responsive and
    // more honest than anything derived from a distance it also supplied.
    if (this.mode === 'treadmill') {
      return this.usingFootpod && this.footpod.speedMps > 0 ? this.footpod.speedMps : null;
    }
    const segment = this.segments[this.segments.length - 1];
    if (!segment || segment.length < 2) return null;

    const cutoff = now - windowMs;
    const last = segment[segment.length - 1];
    let distance = 0;
    let earliest = last.t;

    for (let i = segment.length - 1; i > 0; i--) {
      if (segment[i - 1].t < cutoff) break;
      distance += distanceBetween(segment[i - 1], segment[i]);
      earliest = segment[i - 1].t;
    }

    /*
     * The window ends at the last fix while fixes are arriving, and at `now`
     * once they dry up. Measuring to `now` unconditionally would divide every
     * reading by the age of the newest fix and quietly under-report pace by a
     * few percent all run long; measuring to the last fix unconditionally is
     * what let a stale track keep claiming the speed it had before it stalled.
     */
    const end = Math.max(last.t, now - RunSession.STALE_FIX_MS);
    const seconds = (end - earliest) / 1000;
    if (seconds <= 0) return null;
    return distance / seconds;
  }

  /**
   * What produced the number being saved.
   *
   * A live session can no longer report `manual`: the console's figure is typed
   * on the results page, after this record exists, and `applyConsoleEntry`
   * stamps the provenance when it applies one. The `manual` returned for a
   * treadmill run with no steps means "no instrument measured this" — the
   * results page tells those two cases apart on the distance being zero.
   */
  private distanceSource(): DistanceSource {
    if (this.mode === 'outdoor') return 'gps';
    if (this.usingFootpod) return 'sensor';
    return this.steps > 0 ? 'steps' : 'manual';
  }

  /** Freeze the session into the record that gets saved. */
  toActivity(note = ''): Activity {
    const durationMs = this.elapsedMs();
    return {
      id: newId(),
      mode: this.mode,
      startedAt: this.startedAt,
      durationMs,
      distanceM: this.distanceM,
      distanceSource: this.distanceSource(),
      segments: this.segments.filter((s) => s.length > 1),
      heart: this.heart,
      heartReport: buildHeartReport(this.heart, this.maxHeartRate),
      steps: this.mode === 'treadmill' ? this.steps : null,
      inclinePercent: this.inclinePercent,
      caloriesKcal: Math.round(
        estimateCalories({
          distanceM: this.distanceM,
          durationMs,
          weightKg: this.weightKg,
          age: this.age,
          sex: this.sex,
          inclinePercent: this.inclinePercent,
          heart: this.heart,
        }).kcal,
      ),
      goal: this.goal,
      manualLaps: this.manualLaps.slice(),
      shoeId: this.shoeId,
      workoutId: this.workoutId,
      workoutName: this.workoutName,
      note,
    };
  }
}
