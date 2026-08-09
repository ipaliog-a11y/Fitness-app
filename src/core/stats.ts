/**
 * The dashboard's arithmetic: totals, weeks, and records.
 */

import type { MessageKey } from '../i18n';

import { bestEffort, type Activity } from './activity';
import { paceSecondsPerUnit, type UnitSystem } from './units';

/** Monday, because a training week is Monday to Sunday everywhere but the US. */
export function startOfWeek(timestamp: number): number {
  const d = new Date(timestamp);
  d.setHours(0, 0, 0, 0);
  // getDay() is 0 for Sunday; shift so Monday is 0 and Sunday is 6.
  const offset = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - offset);
  return d.getTime();
}

export function addWeeks(timestamp: number, weeks: number): number {
  const d = new Date(timestamp);
  d.setDate(d.getDate() + weeks * 7);
  return d.getTime();
}

export interface Totals {
  runs: number;
  distanceM: number;
  durationMs: number;
  /** Average pace across the whole period, seconds per display unit. */
  paceSecondsPerUnit: number | null;
}

export function totals(activities: Activity[], units: UnitSystem): Totals {
  let distanceM = 0;
  let durationMs = 0;
  for (const a of activities) {
    distanceM += a.distanceM;
    durationMs += a.durationMs;
  }
  return {
    runs: activities.length,
    distanceM,
    durationMs,
    // Distance-weighted by construction: dividing the summed time by the summed
    // distance, not averaging each run's pace, which would let a 400 m jog count
    // as much as a marathon.
    paceSecondsPerUnit: paceSecondsPerUnit(distanceM, durationMs, units),
  };
}

export interface WeekBucket {
  /** Epoch ms of the Monday. */
  start: number;
  distanceM: number;
  durationMs: number;
  runs: number;
}

/**
 * The last `count` weeks, oldest first, including weeks with no runs.
 *
 * Empty weeks are kept deliberately: a bar chart that silently omits them
 * compresses a lay-off into nothing and makes a broken streak look like
 * consistency.
 */
export function weeklyBuckets(
  activities: Activity[],
  count = 12,
  now = Date.now(),
): WeekBucket[] {
  const thisWeek = startOfWeek(now);
  const buckets: WeekBucket[] = [];
  const index = new Map<number, WeekBucket>();

  for (let i = count - 1; i >= 0; i--) {
    const start = addWeeks(thisWeek, -i);
    const bucket: WeekBucket = { start, distanceM: 0, durationMs: 0, runs: 0 };
    buckets.push(bucket);
    index.set(start, bucket);
  }

  for (const a of activities) {
    const bucket = index.get(startOfWeek(a.startedAt));
    if (!bucket) continue;
    bucket.distanceM += a.distanceM;
    bucket.durationMs += a.durationMs;
    bucket.runs++;
  }

  return buckets;
}

export interface Record {
  label: MessageKey;
  distanceM: number;
  /** Best time in ms, or null when no run has covered the distance. */
  durationMs: number | null;
  activityId: string | null;
}

/** The distances worth having a record for. */
export const RECORD_DISTANCES: Array<{ label: MessageKey; metres: number }> = [
  { label: 'record.1km', metres: 1000 },
  { label: 'record.1mile', metres: 1609.344 },
  { label: 'record.5km', metres: 5000 },
  { label: 'record.10km', metres: 10000 },
  { label: 'record.half', metres: 21097.5 },
  { label: 'record.marathon', metres: 42195 },
];

/**
 * Personal bests, computed as best *efforts inside* runs rather than best whole
 * runs — the fastest 5k of the year is usually buried in the middle of a 10k.
 *
 * Treadmill runs are skipped: without a track there is nothing to sweep a window
 * over, and crediting them with an average-pace equivalent would let a steady
 * machine set a record no outdoor run could beat.
 */
export function personalRecords(activities: Activity[]): Record[] {
  const gps = activities.filter((a) => a.segments.length > 0);

  return RECORD_DISTANCES.map(({ label, metres }) => {
    let bestMs: number | null = null;
    let bestId: string | null = null;

    for (const activity of gps) {
      const effort = bestEffort(activity, metres);
      if (effort !== null && (bestMs === null || effort < bestMs)) {
        bestMs = effort;
        bestId = activity.id;
      }
    }

    return { label, distanceM: metres, durationMs: bestMs, activityId: bestId };
  });
}

/**
 * Consecutive days ending today (or yesterday) on which something was run.
 *
 * Yesterday counts as still alive so the streak does not appear to break every
 * morning before that day's run.
 */
export function currentStreak(activities: Activity[], now = Date.now()): number {
  if (activities.length === 0) return 0;

  const dayOf = (ms: number): number => {
    const d = new Date(ms);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  };

  const days = new Set(activities.map((a) => dayOf(a.startedAt)));
  const today = dayOf(now);

  let cursor = days.has(today) ? today : today - 86_400_000;
  if (!days.has(cursor)) return 0;

  let streak = 0;
  while (days.has(cursor)) {
    streak++;
    // Rebuilt through Date rather than by subtracting 24 h, so the streak
    // survives the two days a year that are not 24 hours long.
    const d = new Date(cursor);
    d.setDate(d.getDate() - 1);
    cursor = d.getTime();
  }
  return streak;
}

export function activitiesBetween(
  activities: Activity[],
  from: number,
  to: number,
): Activity[] {
  return activities.filter((a) => a.startedAt >= from && a.startedAt < to);
}
