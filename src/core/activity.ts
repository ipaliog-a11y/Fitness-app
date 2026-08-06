/**
 * What a finished run is, and everything you can derive from one.
 *
 * One athlete, two ways of running: outdoors against GPS, or on a treadmill
 * where there are no satellites and distance has to come from somewhere else.
 * Both produce the same three numbers — distance, time, pace — so the rest of
 * the app never has to care which kind it is holding.
 */

import { distanceBetween, elevationGain, type GeoPoint } from './geo';
import { paceSecondsPerUnit, paceUnitMetres, type UnitSystem } from './units';

export type RunMode = 'outdoor' | 'treadmill';

/**
 * Where a treadmill run's distance came from. Kept on the record because a
 * pedometer estimate and a typed-in number deserve different trust, and a future
 * belt sensor will be a third answer rather than a rewrite.
 */
export type DistanceSource = 'gps' | 'steps' | 'manual' | 'sensor';

export interface HeartSample {
  /** Epoch ms. */
  t: number;
  /** Beats per minute, as reported by the strap. */
  bpm: number;
}

export interface Activity {
  id: string;
  mode: RunMode;
  /** Epoch ms when the run began. */
  startedAt: number;
  /**
   * Time actually spent moving, with pauses excluded. Pace is quoted against
   * this rather than wall-clock: a run does not get slower because you stopped
   * at a crossing.
   */
  durationMs: number;
  distanceM: number;
  distanceSource: DistanceSource;
  /**
   * The route, split at pauses. A separate array per segment so the map draws a
   * break instead of a straight line across the gap where tracking was off.
   * Always empty for treadmill runs.
   */
  segments: GeoPoint[][];
  /** Heart rate through the run, empty when no strap was connected. */
  heart: HeartSample[];
  /** Steps counted on the treadmill, null when nothing counted them. */
  steps: number | null;
  /** Treadmill incline in percent, null when unknown or outdoors. */
  inclinePercent: number | null;
  note: string;
}

export const SCHEMA_VERSION = 1;

export function modeName(mode: RunMode): string {
  return mode === 'outdoor' ? 'Outdoor run' : 'Treadmill run';
}

export function modeIcon(mode: RunMode): string {
  return mode === 'outdoor' ? '🏃' : '🎽';
}

/** Newest first — the order the history list wants. */
export function byNewest(a: Activity, b: Activity): number {
  return b.startedAt - a.startedAt;
}

export function pointCount(activity: Activity): number {
  return activity.segments.reduce((sum, s) => sum + s.length, 0);
}

export function hasRoute(activity: Activity): boolean {
  return activity.segments.some((s) => s.length > 1);
}

export function averagePace(activity: Activity, units: UnitSystem): number | null {
  return paceSecondsPerUnit(activity.distanceM, activity.durationMs, units);
}

export function totalAscent(activity: Activity): number {
  return elevationGain(activity.segments);
}

export interface Split {
  /** 1-based, so the first kilometre is split 1. */
  index: number;
  /** Metres in this split — a full unit except for the last, partial one. */
  distanceM: number;
  durationMs: number;
  secondsPerUnit: number;
  partial: boolean;
}

/**
 * Per-kilometre (or per-mile) splits for a GPS run.
 *
 * Walks the track accumulating distance and interpolating the moment each
 * boundary is crossed, rather than assigning whole fixes to buckets. Fixes
 * arrive every few seconds and can straddle a boundary by 20 m; bucketing them
 * whole makes alternate splits read fast and slow in a way nobody ran.
 */
export function splits(activity: Activity, units: UnitSystem): Split[] {
  const unitM = paceUnitMetres(units);
  const out: Split[] = [];

  let covered = 0;
  let splitStartTime: number | null = null;
  let splitStartDistance = 0;
  let lastTime = 0;

  for (const segment of activity.segments) {
    for (let i = 0; i < segment.length; i++) {
      const point = segment[i];
      if (splitStartTime === null) splitStartTime = point.t;

      if (i === 0) {
        // A new segment resumes where the previous left off; the pause between
        // them belongs to no split.
        lastTime = point.t;
        continue;
      }

      const previous = segment[i - 1];
      const step = distanceBetween(previous, point);
      const stepMs = point.t - previous.t;
      lastTime = point.t;
      if (step <= 0) continue;

      let stepStartDistance = covered;
      covered += step;

      // One long step can cross more than one boundary; keep closing splits
      // until it no longer does.
      while (covered - splitStartDistance >= unitM) {
        const boundary = splitStartDistance + unitM;
        const fraction = (boundary - stepStartDistance) / step;
        const boundaryTime = previous.t + stepMs * fraction;

        out.push({
          index: out.length + 1,
          distanceM: unitM,
          durationMs: boundaryTime - splitStartTime,
          secondsPerUnit: (boundaryTime - splitStartTime) / 1000,
          partial: false,
        });

        splitStartTime = boundaryTime;
        splitStartDistance = boundary;
        stepStartDistance = boundary;
      }
    }
  }

  // Whatever is left over after the last whole unit.
  const remainder = covered - splitStartDistance;
  if (remainder > 1 && splitStartTime !== null) {
    const durationMs = lastTime - splitStartTime;
    out.push({
      index: out.length + 1,
      distanceM: remainder,
      durationMs,
      secondsPerUnit: durationMs / 1000 / (remainder / unitM),
      partial: true,
    });
  }

  return out;
}

/**
 * The fastest continuous stretch of a given distance within one run — the
 * "best 5k inside a 12k" that an average pace hides.
 *
 * A two-pointer sweep over cumulative distance: the head advances, the tail
 * follows until the window is just long enough, and the time it took is a
 * candidate. Both ends interpolate, so the answer is a true 5000 m rather than
 * whichever fixes happened to land near it.
 */
export function bestEffort(activity: Activity, distanceM: number): number | null {
  if (activity.distanceM < distanceM) return null;

  // Flatten to (cumulative distance, elapsed). Pauses collapse, which is
  // correct: a best effort is over moving time, like every pace in the app.
  const marks: Array<{ d: number; t: number }> = [];
  let covered = 0;
  let clock = 0;

  for (const segment of activity.segments) {
    for (let i = 0; i < segment.length; i++) {
      if (i > 0) {
        covered += distanceBetween(segment[i - 1], segment[i]);
        clock += segment[i].t - segment[i - 1].t;
      }
      marks.push({ d: covered, t: clock });
    }
  }
  if (marks.length < 2) return null;

  const timeAt = (target: number, hint: number): number => {
    let i = hint;
    while (i < marks.length - 1 && marks[i + 1].d < target) i++;
    const a = marks[i];
    const b = marks[i + 1] ?? a;
    const span = b.d - a.d;
    if (span <= 0) return a.t;
    return a.t + ((target - a.d) / span) * (b.t - a.t);
  };

  let best: number | null = null;
  let tailHint = 0;

  for (let head = 1; head < marks.length; head++) {
    const windowStart = marks[head].d - distanceM;
    if (windowStart < 0) continue;
    while (tailHint < marks.length - 1 && marks[tailHint + 1].d <= windowStart) tailHint++;
    const elapsed = marks[head].t - timeAt(windowStart, tailHint);
    if (elapsed > 0 && (best === null || elapsed < best)) best = elapsed;
  }

  return best;
}

let counter = 0;

/** Unique enough for a single device, and sortable by creation time. */
export function newId(): string {
  counter = (counter + 1) % 1000;
  return `${Date.now().toString(36)}-${counter.toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}
