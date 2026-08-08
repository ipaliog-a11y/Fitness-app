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
    intensity = Math.min(1.35, Math.max(0.45, report.averageBpm / maxHeartRate));
  } else if (activity.heart.length > 0 && maxHeartRate > 0) {
    const avg =
      activity.heart.reduce((s, h) => s + h.bpm, 0) / activity.heart.length;
    intensity = Math.min(1.35, Math.max(0.45, avg / maxHeartRate));
  } else if (activity.distanceM > 0) {
    // Pace vs a casual ~6:00/km (360 s/km): faster ⇒ higher load.
    // Cap without HR is lower so easy jogs (~5:00–11:00/km) stay mild.
    const pace = averagePace(activity, 'metric');
    if (pace && pace > 0) {
      intensity = Math.min(1.15, Math.max(0.45, 360 / pace));
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
 * Chronic is mean of the last four 7-day windows ending now.
 *
 * Important: a thin history (most load in the last week, empty weeks before)
 * makes acute/chronic ≈ 4 by construction. We only use ratio-based “high load”
 * when there is a real multi-week base and meaningful absolute load — otherwise
 * beginners with 1–2 easy runs get false “High load” alarms.
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
  let weeksWithLoad = 0;
  for (let i = 0; i < 4; i++) {
    const end = now - i * 7 * day;
    const start = end - 7 * day;
    const weekLoad = loadBetween(activities, start, end, maxHeartRate);
    chronicSum += weekLoad;
    // Count weeks that actually had training (not empty zeros that deflate chronic).
    if (weekLoad >= 8) weeksWithLoad += 1;
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

  const thinHistory = weeksWithLoad < 2 || chronic < 25;
  // Always compute ratio for display when chronic is non-trivial, but don't
  // trust it for status when the base is thin.
  if (chronic >= 5) {
    ratio = acute / chronic;
  }

  if (activities.length === 0) {
    status = 'unknown';
  } else if (thinHistory) {
    // Absolute acute only — small easy weeks stay fresh/balanced.
    if (acute < 45) status = 'fresh';
    else if (acute < 90) status = 'balanced';
    else if (acute < 140) status = 'loaded';
    else status = 'high';
  } else {
    // Established base: classic ACWR bands, but "high" also needs real volume.
    const r = ratio ?? 1;
    if (r < 0.8) status = 'fresh';
    else if (r <= 1.3) status = 'balanced';
    else if (r <= 1.5 || acute < 50) status = 'loaded';
    else status = 'high';
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
      return 'Recent training is light. Build gradually — a quality session is fine if you feel good.';
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
