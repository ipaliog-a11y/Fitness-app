/**
 * A coach made of rules, not of models.
 *
 * Deliberately conservative. Every tip here either restates something the data
 * plainly says, or repeats advice that is standard and safe for a recreational
 * runner. It never prescribes intervals, never sets a target pace, and never
 * tells anyone to run through pain, because a rule engine with no idea how you
 * feel has no business doing any of those things.
 */

import { averagePace, type Activity } from './activity';
import { summariseHeart } from './heart';
import {
  distanceLabel,
  formatDistance,
  formatDuration,
  formatPace,
  paceLabel,
  type UnitSystem,
} from './units';
import { loadSnapshot, recoveryBlurb, recoveryLabel } from './load';
import {
  activitiesBetween,
  addWeeks,
  startOfWeek,
  totals,
  weeklyBuckets,
  currentStreak,
} from './stats';

export type TipTone = 'praise' | 'note' | 'caution';

export interface Tip {
  tone: TipTone;
  title: string;
  body: string;
}

export interface CoachContext {
  units: UnitSystem;
  maxHeartRate: number;
  /** Distance the athlete wants to cover each week, in metres. 0 disables it. */
  weeklyGoalM: number;
  now: number;
}

/**
 * Tips about the run that just finished.
 *
 * `history` should exclude the run itself; comparisons are against what came
 * before it.
 */
export function tipsForRun(activity: Activity, history: Activity[], ctx: CoachContext): Tip[] {
  const tips: Tip[] = [];
  const unit = distanceLabel(ctx.units);
  const pace = averagePace(activity, ctx.units);

  if (activity.distanceM > 0 && pace !== null) {
    tips.push({
      tone: 'note',
      title: 'The run',
      body: `${formatDistance(activity.distanceM, ctx.units)} ${unit} in ${formatDuration(
        activity.durationMs,
      )}, averaging ${formatPace(pace)} ${paceLabel(ctx.units)}.`,
    });
  }

  // Longest run so far is worth saying out loud; it is the number people
  // actually remember.
  const longest = history.reduce((max, a) => Math.max(max, a.distanceM), 0);
  if (activity.distanceM > longest && history.length >= 3) {
    tips.push({
      tone: 'praise',
      title: 'Longest run yet',
      body: `That is your longest run so far, beating ${formatDistance(
        longest,
        ctx.units,
      )} ${unit}. Give the next day or two some easy running.`,
    });
  }

  const heart = summariseHeart(activity.heart, ctx.maxHeartRate);
  if (heart) {
    const hard = heart.zones
      .filter((z) => z.zone.index >= 4)
      .reduce((sum, z) => sum + z.fraction, 0);
    const easy = heart.zones
      .filter((z) => z.zone.index <= 2)
      .reduce((sum, z) => sum + z.fraction, 0);

    if (hard > 0.5) {
      tips.push({
        tone: 'caution',
        title: 'That was a hard one',
        body: `Over half the run sat in zone 4 or 5 (average ${heart.averageBpm} bpm). Sessions like this are worth having, and worth following with an easy day.`,
      });
    } else if (easy > 0.8) {
      tips.push({
        tone: 'praise',
        title: 'Properly easy',
        body: `${Math.round(
          easy * 100,
        )}% of the run stayed in zones 1–2. Easy running is what most weekly volume should look like.`,
      });
    }
  } else if (activity.mode === 'outdoor') {
    tips.push({
      tone: 'note',
      title: 'No heart rate recorded',
      body: 'Connect a strap before the next run to get zone analysis alongside the pace.',
    });
  }

  // The 10% rule: a weekly jump much beyond that is the classic way to pick up
  // an overuse injury.
  const weekStart = startOfWeek(ctx.now);
  const thisWeek = totals(
    activitiesBetween([...history, activity], weekStart, addWeeks(weekStart, 1)),
    ctx.units,
  );
  const lastWeek = totals(
    activitiesBetween(history, addWeeks(weekStart, -1), weekStart),
    ctx.units,
  );

  if (lastWeek.distanceM > 1000 && thisWeek.distanceM > lastWeek.distanceM * 1.3) {
    tips.push({
      tone: 'caution',
      title: 'Big jump in volume',
      body: `This week is already ${formatDistance(
        thisWeek.distanceM,
        ctx.units,
      )} ${unit} against ${formatDistance(
        lastWeek.distanceM,
        ctx.units,
      )} ${unit} last week. Increases of roughly 10% a week are the usual advice for staying uninjured.`,
    });
  }

  if (ctx.weeklyGoalM > 0) {
    const remaining = ctx.weeklyGoalM - thisWeek.distanceM;
    tips.push(
      remaining <= 0
        ? {
            tone: 'praise',
            title: 'Weekly goal met',
            body: `${formatDistance(thisWeek.distanceM, ctx.units)} ${unit} this week, past your ${formatDistance(
              ctx.weeklyGoalM,
              ctx.units,
            )} ${unit} goal.`,
          }
        : {
            tone: 'note',
            title: 'Weekly goal',
            body: `${formatDistance(remaining, ctx.units)} ${unit} left to reach ${formatDistance(
              ctx.weeklyGoalM,
              ctx.units,
            )} ${unit} this week.`,
          },
    );
  }

  return tips;
}

/** Tips for the dashboard, about the shape of training rather than one run. */
export function tipsForWeek(activities: Activity[], ctx: CoachContext): Tip[] {
  const tips: Tip[] = [];
  const unit = distanceLabel(ctx.units);

  if (activities.length === 0) {
    return [
      {
        tone: 'note',
        title: 'Nothing logged yet',
        body: 'Start a run and it will show up here. Outdoors uses GPS; on a treadmill you can count steps or type the distance in.',
      },
    ];
  }

  const weeks = weeklyBuckets(activities, 4, ctx.now);
  const thisWeek = weeks[weeks.length - 1];
  const previous = weeks.slice(0, -1).filter((w) => w.runs > 0);

  if (ctx.weeklyGoalM > 0) {
    const share = thisWeek.distanceM / ctx.weeklyGoalM;
    tips.push({
      tone: share >= 1 ? 'praise' : 'note',
      title: share >= 1 ? 'Goal met' : 'This week so far',
      body: `${formatDistance(thisWeek.distanceM, ctx.units)} of ${formatDistance(
        ctx.weeklyGoalM,
        ctx.units,
      )} ${unit} — ${Math.round(share * 100)}%.`,
    });
  }

  const streak = currentStreak(activities, ctx.now);
  if (streak >= 3) {
    tips.push({
      tone: 'praise',
      title: `${streak}-day streak`,
      body: 'Consistency does more for fitness than any single session.',
    });
  }

  // A fortnight of silence is worth a gentle nudge, phrased so it is not a
  // scolding — people stop running for reasons an app cannot see.
  const lastRun = Math.max(...activities.map((a) => a.startedAt));
  const daysSince = Math.floor((ctx.now - lastRun) / 86_400_000);
  if (daysSince >= 14) {
    tips.push({
      tone: 'note',
      title: 'Been a while',
      body: `${daysSince} days since the last run. Coming back a little shorter and slower than you left off tends to stick better.`,
    });
  }

  if (previous.length >= 2) {
    const average =
      previous.reduce((sum, w) => sum + w.distanceM, 0) / previous.length;
    if (average > 0) {
      tips.push({
        tone: 'note',
        title: 'Recent average',
        body: `${formatDistance(average, ctx.units)} ${unit} a week over the last ${
          previous.length
        } weeks with running in them.`,
      });
    }
  }

  // Load / recovery (Phase D) — conservative, based on acute:chronic style score.
  const load = loadSnapshot(activities, ctx.now, ctx.maxHeartRate);
  if (load.status === 'high' || load.status === 'loaded') {
    tips.push({
      tone: 'caution',
      title: recoveryLabel(load.status),
      body: recoveryBlurb(load),
    });
  } else if (load.status === 'fresh' && load.chronic >= 15) {
    tips.push({
      tone: 'note',
      title: recoveryLabel(load.status),
      body: recoveryBlurb(load),
    });
  } else if (load.lastWeek > 0 && load.thisWeek > load.lastWeek * 1.25) {
    tips.push({
      tone: 'caution',
      title: 'Week-on-week load jump',
      body: 'This week’s training load is already well above last week. Keep remaining sessions easy unless you planned a quality day.',
    });
  }

  return tips;
}

/** Dedicated recovery note for the Coach screen. */
export function tipsForRecovery(activities: Activity[], ctx: CoachContext): Tip[] {
  const load = loadSnapshot(activities, ctx.now, ctx.maxHeartRate);
  const tone: TipTone =
    load.status === 'high' || load.status === 'loaded'
      ? 'caution'
      : load.status === 'fresh'
        ? 'praise'
        : 'note';
  return [
    {
      tone,
      title: `Recovery: ${recoveryLabel(load.status)}`,
      body: recoveryBlurb(load),
    },
  ];
}
