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
  type RunMode,
} from './activity';
import {
  distanceBetween,
  judgePoint,
  type FilterOptions,
  type GeoPoint,
  DEFAULT_FILTER,
} from './geo';
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

  private readonly strideM: number;
  private readonly filter: FilterOptions;

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
  private manualDistance = false;

  /** Metres accumulated from accepted fixes (outdoor) or steps (treadmill). */
  distanceM = 0;

  /** Fixes rejected by the filter, per reason — surfaced as a signal indicator. */
  rejected = { accuracy: 0, jitter: 0, teleport: 0, stale: 0 };

  private accumulatedMs = 0;
  private resumedAt = 0;
  private lastAccepted: GeoPoint | null = null;

  constructor(options: Partial<SessionOptions> & { mode: RunMode }, startedAt = Date.now()) {
    this.mode = options.mode;
    this.strideM = options.strideM ?? 0.75;
    this.footpod.calibration = options.footpodCalibration ?? 1;
    this.filter = options.filter ?? DEFAULT_FILTER;
    this.startedAt = startedAt;
  }

  start(t = Date.now()): void {
    if (this.state !== 'idle') return;
    this.state = 'running';
    this.resumedAt = t;
    if (this.mode === 'outdoor') this.segments.push([]);
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
    if (!this.usingFootpod && !this.manualDistance) {
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
    if (!this.manualDistance) this.distanceM = this.footpod.distanceM;
  }

  /** Steps per minute, from the pod if there is one. */
  cadence(): number | null {
    if (this.footpod.cadenceSpm > 0) return this.footpod.cadenceSpm;
    return null;
  }

  /**
   * Override the distance directly — the treadmill console is the authority
   * when the athlete is willing to read it off.
   */
  setDistance(metres: number): void {
    if (this.mode !== 'treadmill') return;
    this.manualDistance = true;
    this.distanceM = Math.max(0, metres);
  }

  setIncline(percent: number | null): void {
    this.inclinePercent = percent;
  }

  /** Current speed in metres per second, or null when unknown. */
  recentSpeed(windowMs = 30_000, now = Date.now()): number | null {
    // Indoors the pod reports speed directly, which is both more responsive and
    // more honest than anything derived from a distance it also supplied.
    if (this.mode === 'treadmill') {
      return this.usingFootpod && this.footpod.speedMps > 0 ? this.footpod.speedMps : null;
    }
    const segment = this.segments[this.segments.length - 1];
    if (!segment || segment.length < 2) return null;

    const cutoff = now - windowMs;
    let distance = 0;
    let earliest = segment[segment.length - 1].t;

    for (let i = segment.length - 1; i > 0; i--) {
      if (segment[i - 1].t < cutoff) break;
      distance += distanceBetween(segment[i - 1], segment[i]);
      earliest = segment[i - 1].t;
    }

    const seconds = (segment[segment.length - 1].t - earliest) / 1000;
    if (seconds <= 0 || distance <= 0) return null;
    return distance / seconds;
  }

  private distanceSource(): DistanceSource {
    if (this.mode === 'outdoor') return 'gps';
    // Ordered by what actually produced the number that will be saved.
    if (this.manualDistance) return 'manual';
    if (this.usingFootpod) return 'sensor';
    return this.steps > 0 ? 'steps' : 'manual';
  }

  /** Freeze the session into the record that gets saved. */
  toActivity(note = ''): Activity {
    return {
      id: newId(),
      mode: this.mode,
      startedAt: this.startedAt,
      durationMs: this.elapsedMs(),
      distanceM: this.distanceM,
      distanceSource: this.distanceSource(),
      segments: this.segments.filter((s) => s.length > 1),
      heart: this.heart,
      steps: this.mode === 'treadmill' ? this.steps : null,
      inclinePercent: this.inclinePercent,
      note,
    };
  }
}
