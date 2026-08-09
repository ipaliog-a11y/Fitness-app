/**
 * A coach made of rules, not of models.
 *
 * Deliberately conservative. Every tip here either restates something the data
 * plainly says, or repeats advice that is standard and safe for a recreational
 * runner. It never prescribes intervals, never sets a target pace, and never
 * tells anyone to run through pain, because a rule engine with no idea how you
 * feel has no business doing any of those things.
 */

import type { MessageKey, Vars } from '../i18n';
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
import { loadSnapshot, recoveryBlurb, recoveryLabel, type RecoveryStatus } from './load';
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
  /**
   * Message keys plus their substitutions, not finished sentences.
   *
   * Coach tips are the one place where core genuinely has to *compose* text —
   * distances, paces and counts only exist at runtime. Handing the UI a key
   * and a bag of already-formatted values keeps the locale out of here while
   * still letting the translation decide word order, which matters: Greek does
   * not put the number where English does in every one of these.
   */
  title: MessageKey;
  titleVars?: Vars;
  body: MessageKey;
  bodyVars?: Vars;
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
      title: 'coach.tip.run.title',
      body: 'coach.tip.run.body',
      bodyVars: {
        distance: formatDistance(activity.distanceM, ctx.units),
        unit,
        duration: formatDuration(activity.durationMs),
        pace: formatPace(pace),
        paceUnit: paceLabel(ctx.units),
      },
    });
  }

  // Longest run so far is worth saying out loud; it is the number people
  // actually remember.
  const longest = history.reduce((max, a) => Math.max(max, a.distanceM), 0);
  if (activity.distanceM > longest && history.length >= 3) {
    tips.push({
      tone: 'praise',
      title: 'coach.tip.longest.title',
      body: 'coach.tip.longest.body',
      bodyVars: { distance: formatDistance(longest, ctx.units), unit },
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
        title: 'coach.tip.hard.title',
        body: 'coach.tip.hard.body',
        bodyVars: { bpm: heart.averageBpm },
      });
    } else if (easy > 0.8) {
      tips.push({
        tone: 'praise',
        title: 'coach.tip.easy.title',
        body: 'coach.tip.easy.body',
        bodyVars: { percent: Math.round(easy * 100) },
      });
    }
  } else if (activity.mode === 'outdoor') {
    tips.push({
      tone: 'note',
      title: 'coach.tip.noHr.title',
      body: 'coach.tip.noHr.body',
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
      title: 'coach.tip.jump.title',
      body: 'coach.tip.jump.body',
      bodyVars: {
        thisWeek: formatDistance(thisWeek.distanceM, ctx.units),
        lastWeek: formatDistance(lastWeek.distanceM, ctx.units),
        unit,
      },
    });
  }

  if (ctx.weeklyGoalM > 0) {
    const remaining = ctx.weeklyGoalM - thisWeek.distanceM;
    tips.push(
      remaining <= 0
        ? {
            tone: 'praise',
            title: 'coach.tip.goalMet.title',
            body: 'coach.tip.goalMet.body',
            bodyVars: {
              distance: formatDistance(thisWeek.distanceM, ctx.units),
              goal: formatDistance(ctx.weeklyGoalM, ctx.units),
              unit,
            },
          }
        : {
            tone: 'note',
            title: 'coach.tip.goal.title',
            body: 'coach.tip.goal.body',
            bodyVars: {
              remaining: formatDistance(remaining, ctx.units),
              goal: formatDistance(ctx.weeklyGoalM, ctx.units),
              unit,
            },
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
        title: 'coach.tip.empty.title',
        body: 'coach.tip.empty.body',
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
      title: share >= 1 ? 'coach.tip.weekGoalMet.title' : 'coach.tip.weekSoFar.title',
      body: 'coach.tip.weekProgress.body',
      bodyVars: {
        distance: formatDistance(thisWeek.distanceM, ctx.units),
        goal: formatDistance(ctx.weeklyGoalM, ctx.units),
        unit,
        percent: Math.round(share * 100),
      },
    });
  }

  const streak = currentStreak(activities, ctx.now);
  if (streak >= 3) {
    tips.push({
      tone: 'praise',
      title: 'coach.tip.streak.title',
      titleVars: { count: streak },
      body: 'coach.tip.streak.body',
    });
  }

  // A fortnight of silence is worth a gentle nudge, phrased so it is not a
  // scolding — people stop running for reasons an app cannot see.
  const lastRun = Math.max(...activities.map((a) => a.startedAt));
  const daysSince = Math.floor((ctx.now - lastRun) / 86_400_000);
  if (daysSince >= 14) {
    tips.push({
      tone: 'note',
      title: 'coach.tip.away.title',
      body: 'coach.tip.away.body',
      bodyVars: { days: daysSince },
    });
  }

  if (previous.length >= 2) {
    const average =
      previous.reduce((sum, w) => sum + w.distanceM, 0) / previous.length;
    if (average > 0) {
      tips.push({
        tone: 'note',
        title: 'coach.tip.average.title',
        body: 'coach.tip.average.body',
        bodyVars: {
          distance: formatDistance(average, ctx.units),
          unit,
          weeks: previous.length,
        },
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
      title: 'coach.tip.loadJump.title',
      body: 'coach.tip.loadJump.body',
    });
  }

  return tips;
}

function recoveryTitle(status: RecoveryStatus): MessageKey {
  switch (status) {
    case 'fresh':
      return 'coach.tip.recovery.fresh';
    case 'balanced':
      return 'coach.tip.recovery.balanced';
    case 'loaded':
      return 'coach.tip.recovery.loaded';
    case 'high':
      return 'coach.tip.recovery.high';
    default:
      return 'coach.tip.recovery.unknown';
  }
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
      // One key per status rather than "Recovery: {status}" with the status
      // itself as a nested key. Nesting would need the renderer to know that
      // one particular var holds a key and not a value, and Greek would be
      // stuck with English word order either way.
      title: recoveryTitle(load.status),
      body: recoveryBlurb(load),
    },
  ];
}
