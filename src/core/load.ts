/**
 * Simple training load and recovery signals.
 *
 * Not a lab TRIMP model — a transparent score from duration and (when present)
 * heart-rate intensity so the coach can say “ease up” without claiming medical
 * precision. Pure functions for unit tests.
 */

import type { Activity } from './activity';
import { averagePace } from './activity';
import { addWeeks, startOfWeek } from './stats';

/** Arbitrary “load points” for one activity. */
export function activityLoad(activity: Activity, maxHeartRate = 185): number {
  const minutes = activity.durationMs / 60_000;
  if (minutes <= 0) return 0;

  let intensity = 1;
  const report = activity.heartReport;
  if (report && report.averageBpm > 0 && maxHeartRate > 0) {
    // Fraction of max HR, clamped so easy jogs still count a little.
    intensity = Math.min(1.4, Math.max(0.5, report.averageBpm / maxHeartRate));
  } else if (activity.heart.length > 0 && maxHeartRate > 0) {
    const avg =
      activity.heart.reduce((s, h) => s + h.bpm, 0) / activity.heart.length;
    intensity = Math.min(1.4, Math.max(0.5, avg / maxHeartRate));
  } else if (activity.distanceM > 0) {
    // Pace vs a casual ~6:00/km (360 s/km): faster ⇒ higher load.
    const pace = averagePace(activity, 'metric');
    if (pace && pace > 0) {
      intensity = Math.min(1.4, Math.max(0.55, 360 / pace));
    }
  }

  return minutes * intensity;
}

export function loadBetween(
  activities: Activity[],
  from: number,
  to: number,
  maxHeartRate = 185,
): number {
  let sum = 0;
  for (const a of activities) {
    if (a.startedAt >= from && a.startedAt < to) {
      sum += activityLoad(a, maxHeartRate);
    }
  }
  return sum;
}

export type RecoveryStatus = 'fresh' | 'balanced' | 'loaded' | 'high' | 'unknown';

export interface LoadSnapshot {
  /** Load in the last 7 days. */
  acute: number;
  /** Average weekly load over the last 4 weeks (chronic). */
  chronic: number;
  /** Acute / chronic; null when chronic is too small to judge. */
  ratio: number | null;
  status: RecoveryStatus;
  /** Load this calendar training week (Mon–Sun). */
  thisWeek: number;
  /** Load last full training week. */
  lastWeek: number;
}

/**
 * Acute:chronic style snapshot.
 *
 * Chronic is mean of the last four complete-ish weeks of load (including the
 * current partial week as one of four rolling windows of 7 days).
 */
export function loadSnapshot(
  activities: Activity[],
  now = Date.now(),
  maxHeartRate = 185,
): LoadSnapshot {
  const day = 86_400_000;
  const acute = loadBetween(activities, now - 7 * day, now, maxHeartRate);

  // Four consecutive 7-day windows ending now.
  let chronicSum = 0;
  for (let i = 0; i < 4; i++) {
    const end = now - i * 7 * day;
    const start = end - 7 * day;
    chronicSum += loadBetween(activities, start, end, maxHeartRate);
  }
  const chronic = chronicSum / 4;

  const weekStart = startOfWeek(now);
  const thisWeek = loadBetween(activities, weekStart, addWeeks(weekStart, 1), maxHeartRate);
  const lastWeek = loadBetween(
    activities,
    addWeeks(weekStart, -1),
    weekStart,
    maxHeartRate,
  );

  let ratio: number | null = null;
  let status: RecoveryStatus = 'unknown';

  if (chronic < 15 && acute < 15) {
    status = activities.length === 0 ? 'unknown' : 'fresh';
  } else if (chronic >= 10) {
    ratio = acute / chronic;
    if (ratio < 0.8) status = 'fresh';
    else if (ratio <= 1.3) status = 'balanced';
    else if (ratio <= 1.5) status = 'loaded';
    else status = 'high';
  } else if (acute > 40) {
    status = 'loaded';
    ratio = null;
  } else {
    status = 'balanced';
  }

  return { acute, chronic, ratio, status, thisWeek, lastWeek };
}

export function recoveryLabel(status: RecoveryStatus): string {
  switch (status) {
    case 'fresh':
      return 'Fresh';
    case 'balanced':
      return 'Balanced';
    case 'loaded':
      return 'Loaded';
    case 'high':
      return 'High load';
    default:
      return 'Not enough data';
  }
}

export function recoveryBlurb(snap: LoadSnapshot): string {
  switch (snap.status) {
    case 'fresh':
      return 'Recent training is light relative to your base. A quality session is fine if you feel good.';
    case 'balanced':
      return 'Load looks steady. Keep most running easy and save hard efforts for planned days.';
    case 'loaded':
      return 'The last week is heavier than your recent average. Favour easy pace and sleep.';
    case 'high':
      return 'Acute load is well above your recent base — a classic injury risk window. Ease volume and intensity.';
    default:
      return 'Log a few more runs and the coach can estimate recovery from your load pattern.';
  }
}
