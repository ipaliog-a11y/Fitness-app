/**
 * Achievements: definitions, unlock state, and evaluation from app data.
 *
 * Pure checks over a context snapshot — no DOM. Icons are named keys rendered
 * in the UI as small SVGs.
 */

import type { Activity } from './activity';
import { goalMet } from './goal';
import { loadSnapshot } from './load';
import { syncLifetime, type LifetimeStats } from './lifetime';
import { loadActivePlan } from './plans';
import { loadRoutes } from './routes';
import { loadSavedWorkouts } from './savedWorkouts';
import type { Profile } from './settings';
import { loadShoes } from './shoes';
import { currentStreak } from './stats';

const UNLOCK_KEY = 'runlog:achievements:v1';

export type AchievementCategory =
  | 'distance'
  | 'lifetime'
  | 'recovery'
  | 'performance'
  | 'app'
  | 'fun';

/** Named icon keys drawn in AchievementsScreen. */
export type AchievementIconId =
  | 'flag'
  | 'shoe'
  | 'shoes'
  | 'medal'
  | 'trophy'
  | 'flame'
  | 'heart'
  | 'leaf'
  | 'mountain'
  | 'moon'
  | 'sun'
  | 'star'
  | 'map'
  | 'coach'
  | 'note'
  | 'target'
  | 'bolt'
  | 'calendar'
  | 'gym'
  | 'path'
  | 'crown'
  | 'spark'
  | 'watch'
  | 'layers'
  | 'user'
  | 'route'
  | 'timer'
  | 'ribbon'
  | 'compass'
  | 'gift';

export interface AchievementDef {
  id: string;
  title: string;
  description: string;
  category: AchievementCategory;
  icon: AchievementIconId;
  /** True when this achievement should unlock for the given snapshot. */
  test(ctx: AchievementContext): boolean;
}

export interface AchievementContext {
  activities: Activity[];
  profile: Profile;
  lifetime: LifetimeStats;
  now: number;
}

export interface AchievementUnlocks {
  /** achievementId → epoch ms unlocked */
  unlocked: Record<string, number>;
}

export function loadUnlocks(): AchievementUnlocks {
  try {
    const raw = localStorage.getItem(UNLOCK_KEY);
    if (!raw) return { unlocked: {} };
    const p = JSON.parse(raw) as { unlocked?: Record<string, number> };
    return { unlocked: p.unlocked && typeof p.unlocked === 'object' ? p.unlocked : {} };
  } catch {
    return { unlocked: {} };
  }
}

export function saveUnlocks(state: AchievementUnlocks): void {
  try {
    localStorage.setItem(UNLOCK_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

function dayHour(startedAt: number): number {
  return new Date(startedAt).getHours();
}

function hasNote(a: Activity): boolean {
  return Boolean(a.note && a.note.trim().length > 0);
}

function hasGoalMet(a: Activity): boolean {
  if (!a.goal) return false;
  return goalMet(a.goal, {
    distanceM: a.distanceM,
    durationMs: a.durationMs,
    caloriesKcal: a.caloriesKcal ?? 0,
  });
}

function usedWorkout(a: Activity): boolean {
  return Boolean(a.workoutId && a.workoutId !== 'none');
}

function isHardWorkout(a: Activity): boolean {
  const id = a.workoutId ?? '';
  return (
    id.includes('tempo') ||
    id.includes('vo2') ||
    id.includes('400') ||
    id.includes('800') ||
    id.includes('hill') ||
    id.includes('cruise') ||
    id.includes('pyramid') ||
    id.includes('ladder') ||
    id.includes('mona') ||
    id.includes('fartlek')
  );
}

function isEasyWorkout(a: Activity): boolean {
  const id = a.workoutId ?? '';
  return id.includes('easy') || id.includes('walk-run') || id.includes('recovery') || id.includes('long-easy');
}

/** ~30 built-in achievements. */
export const ACHIEVEMENTS: AchievementDef[] = [
  // —— Single-run distance ————————————————————————————————
  {
    id: 'first-finish',
    title: 'First finish',
    description: 'Save your first run. Every streak starts with one.',
    category: 'distance',
    icon: 'flag',
    test: (c) => c.lifetime.runs >= 1,
  },
  {
    id: 'k5',
    title: '5K club',
    description: 'Complete a single run of at least 5 km.',
    category: 'distance',
    icon: 'medal',
    test: (c) => c.activities.some((a) => a.distanceM >= 5000),
  },
  {
    id: 'k10',
    title: '10K club',
    description: 'Complete a single run of at least 10 km.',
    category: 'distance',
    icon: 'ribbon',
    test: (c) => c.activities.some((a) => a.distanceM >= 10_000),
  },
  {
    id: 'half-marathon',
    title: 'Half marathon',
    description: 'Run 21.1 km in one session (half marathon distance).',
    category: 'distance',
    icon: 'trophy',
    test: (c) => c.activities.some((a) => a.distanceM >= 21_097.5),
  },
  {
    id: 'k30',
    title: '30 km single',
    description: 'Cover 30 km in a single run.',
    category: 'distance',
    icon: 'mountain',
    test: (c) => c.activities.some((a) => a.distanceM >= 30_000),
  },
  {
    id: 'marathon',
    title: 'Marathoner',
    description: 'Run 42.2 km in one go. Respect.',
    category: 'distance',
    icon: 'crown',
    test: (c) => c.activities.some((a) => a.distanceM >= 42_195),
  },

  // —— Lifetime mileage ————————————————————————————————
  {
    id: 'lifetime-25',
    title: '25 km lifetime',
    description: 'Accumulate 25 km across all saved runs.',
    category: 'lifetime',
    icon: 'path',
    test: (c) => c.lifetime.distanceM >= 25_000,
  },
  {
    id: 'lifetime-50',
    title: '50 km lifetime',
    description: 'Accumulate 50 km of total running.',
    category: 'lifetime',
    icon: 'compass',
    test: (c) => c.lifetime.distanceM >= 50_000,
  },
  {
    id: 'lifetime-100',
    title: 'Century club',
    description: '100 km total distance on this device.',
    category: 'lifetime',
    icon: 'star',
    test: (c) => c.lifetime.distanceM >= 100_000,
  },
  {
    id: 'lifetime-250',
    title: '250 km lifetime',
    description: '250 km lifetime mileage.',
    category: 'lifetime',
    icon: 'layers',
    test: (c) => c.lifetime.distanceM >= 250_000,
  },
  {
    id: 'lifetime-500',
    title: '500 km lifetime',
    description: '500 km total — a serious base.',
    category: 'lifetime',
    icon: 'trophy',
    test: (c) => c.lifetime.distanceM >= 500_000,
  },
  {
    id: 'lifetime-1000',
    title: '1 000 km lifetime',
    description: '1 000 km lifetime distance logged in RunLog.',
    category: 'lifetime',
    icon: 'crown',
    test: (c) => c.lifetime.distanceM >= 1_000_000,
  },
  {
    id: 'ten-runs',
    title: '10 runs logged',
    description: 'Log 10 finished runs.',
    category: 'lifetime',
    icon: 'calendar',
    test: (c) => c.lifetime.runs >= 10,
  },
  {
    id: 'fifty-runs',
    title: 'Habit former',
    description: 'Log 50 finished runs.',
    category: 'lifetime',
    icon: 'flame',
    test: (c) => c.lifetime.runs >= 50,
  },

  // —— Recovery ————————————————————————————————————————
  {
    id: 'easy-day',
    title: 'Easy does it',
    description: 'Finish a run with an easy or walk/run structured workout.',
    category: 'recovery',
    icon: 'leaf',
    test: (c) => c.activities.some((a) => isEasyWorkout(a)),
  },
  {
    id: 'fresh-legs',
    title: 'Fresh legs',
    description: 'Open Coach while recovery status is Fresh (with some training history).',
    category: 'recovery',
    icon: 'heart',
    test: (c) => {
      if (c.activities.length < 2) return false;
      const snap = loadSnapshot(c.activities, c.now, c.profile.maxHeartRate);
      return snap.status === 'fresh';
    },
  },
  {
    id: 'balanced-load',
    title: 'In balance',
    description: 'Recovery status Balanced — steady load vs base.',
    category: 'recovery',
    icon: 'heart',
    test: (c) => {
      if (c.activities.length < 3) return false;
      const snap = loadSnapshot(c.activities, c.now, c.profile.maxHeartRate);
      return snap.status === 'balanced';
    },
  },
  {
    id: 'recovery-strides',
    title: 'Stride light',
    description: 'Complete the Recovery + strides workout.',
    category: 'recovery',
    icon: 'spark',
    test: (c) => c.activities.some((a) => a.workoutId === 'recovery-strides'),
  },

  // —— Performance —————————————————————————————————————
  {
    id: 'tempo-tester',
    title: 'Tempo tester',
    description: 'Finish a tempo or cruise threshold workout.',
    category: 'performance',
    icon: 'timer',
    test: (c) =>
      c.activities.some(
        (a) =>
          a.workoutId === 'tempo-20' ||
          a.workoutId === 'cruise-5x5' ||
          a.workoutId === 'double-tempo',
      ),
  },
  {
    id: 'interval-hero',
    title: 'Interval hero',
    description: 'Complete a VO₂ or track-style speed session (400s, 800s, 3′/4′).',
    category: 'performance',
    icon: 'bolt',
    test: (c) =>
      c.activities.some(
        (a) =>
          a.workoutId === 'vo2-3min' ||
          a.workoutId === 'vo2-4x4' ||
          a.workoutId === '400-repeats' ||
          a.workoutId === '800-repeats',
      ),
  },
  {
    id: 'structured-run',
    title: 'On the plan',
    description: 'Finish any structured workout (not free run).',
    category: 'performance',
    icon: 'target',
    test: (c) => c.activities.some((a) => usedWorkout(a)),
  },
  {
    id: 'goal-crusher',
    title: 'Goal crusher',
    description: 'Hit a distance, time, or calorie goal on a run.',
    category: 'performance',
    icon: 'target',
    test: (c) => c.activities.some((a) => hasGoalMet(a)),
  },
  {
    id: 'streak-3',
    title: 'Three in a row',
    description: 'Run on 3 consecutive days.',
    category: 'performance',
    icon: 'flame',
    test: (c) => currentStreak(c.activities, c.now) >= 3,
  },
  {
    id: 'streak-7',
    title: 'Week warrior',
    description: 'Run on 7 consecutive days.',
    category: 'performance',
    icon: 'flame',
    test: (c) => currentStreak(c.activities, c.now) >= 7,
  },
  {
    id: 'early-bird',
    title: 'Early bird',
    description: 'Start a run before 7:00 local time.',
    category: 'performance',
    icon: 'sun',
    test: (c) => c.activities.some((a) => dayHour(a.startedAt) < 7),
  },
  {
    id: 'night-owl',
    title: 'Night owl',
    description: 'Start a run at 20:00 or later.',
    category: 'performance',
    icon: 'moon',
    test: (c) => c.activities.some((a) => dayHour(a.startedAt) >= 20),
  },

  // —— App usage ———————————————————————————————————————
  {
    id: 'named-runner',
    title: 'Named runner',
    description: 'Set a display name in Profile.',
    category: 'app',
    icon: 'user',
    test: (c) => (c.profile.displayName ?? '').trim().length > 0,
  },
  {
    id: 'full-identity',
    title: 'Known quantity',
    description: 'Save name, date of birth, and height in Profile.',
    category: 'app',
    icon: 'user',
    test: (c) =>
      (c.profile.displayName ?? '').trim().length > 0 &&
      Boolean(c.profile.birthDate) &&
      c.profile.heightCm >= 80,
  },
  {
    id: 'coach-enrolled',
    title: 'Coach call',
    description: 'Start a training plan on the Coach tab.',
    category: 'app',
    icon: 'coach',
    test: () => loadActivePlan() !== null,
  },
  {
    id: 'workout-factory',
    title: 'Workout factory',
    description: 'Save 5 custom workouts under My Workouts.',
    category: 'app',
    icon: 'layers',
    test: () => loadSavedWorkouts().length >= 5,
  },
  {
    id: 'first-custom',
    title: 'Recipe writer',
    description: 'Save your first custom workout.',
    category: 'app',
    icon: 'note',
    test: () => loadSavedWorkouts().length >= 1,
  },
  {
    id: 'note-taker',
    title: 'Note taker',
    description: 'Add a personal note to a finished run.',
    category: 'app',
    icon: 'note',
    test: (c) => c.activities.some((a) => hasNote(a)),
  },
  {
    id: 'route-saver',
    title: 'Ghost cartographer',
    description: 'Save a route from a finished outdoor run.',
    category: 'app',
    icon: 'route',
    test: () => loadRoutes().length >= 1,
  },

  // —— Fun / gear ——————————————————————————————————————
  {
    id: 'first-shoes',
    title: 'Laced up',
    description: 'Add your first pair of shoes.',
    category: 'fun',
    icon: 'shoe',
    test: () => loadShoes().length >= 1,
  },
  {
    id: 'second-pair',
    title: 'Rotation begins',
    description: 'Add a second pair of shoes. Your soles will thank you.',
    category: 'fun',
    icon: 'shoes',
    test: () => loadShoes().length >= 2,
  },
  {
    id: 'shoe-fleet',
    title: 'Shoe fleet',
    description: 'Own three or more pairs in the shoe locker.',
    category: 'fun',
    icon: 'shoes',
    test: () => loadShoes().length >= 3,
  },
  {
    id: 'outdoor-soul',
    title: 'Outdoor soul',
    description: 'Finish an outdoor GPS run.',
    category: 'fun',
    icon: 'map',
    test: (c) => c.lifetime.outdoorRuns >= 1,
  },
  {
    id: 'belt-beast',
    title: 'Belt beast',
    description: 'Finish a treadmill run.',
    category: 'fun',
    icon: 'gym',
    test: (c) => c.lifetime.treadmillRuns >= 1,
  },
  {
    id: 'both-worlds',
    title: 'Both worlds',
    description: 'Log at least one outdoor and one treadmill run.',
    category: 'fun',
    icon: 'compass',
    test: (c) => c.lifetime.outdoorRuns >= 1 && c.lifetime.treadmillRuns >= 1,
  },
  {
    id: 'hill-lover',
    title: 'Hill lover',
    description: 'Complete the Hills 8 × 45 s workout.',
    category: 'fun',
    icon: 'mountain',
    test: (c) => c.activities.some((a) => a.workoutId === 'hill-8x45'),
  },
  {
    id: 'hard-session',
    title: 'Went hard',
    description: 'Finish any hard structured session (tempo, speed, hills, fartlek…).',
    category: 'performance',
    icon: 'bolt',
    test: (c) => c.activities.some((a) => isHardWorkout(a)),
  },
];

export const ACHIEVEMENT_CATEGORY_LABEL: Record<AchievementCategory, string> = {
  distance: 'Distance milestones',
  lifetime: 'Lifetime mileage',
  recovery: 'Recovery',
  performance: 'Performance',
  app: 'Using RunLog',
  fun: 'Fun & gear',
};

export function buildAchievementContext(
  activities: Activity[],
  profile: Profile,
  lifetime: LifetimeStats,
  now = Date.now(),
): AchievementContext {
  return { activities, profile, lifetime, now };
}

/**
 * Evaluate all achievements; unlock newly earned ones.
 * Returns the list of achievement ids unlocked in this pass.
 */
export function evaluateAchievements(ctx: AchievementContext): AchievementDef[] {
  const state = loadUnlocks();
  const newly: AchievementDef[] = [];
  let changed = false;

  for (const def of ACHIEVEMENTS) {
    if (state.unlocked[def.id]) continue;
    try {
      if (def.test(ctx)) {
        state.unlocked[def.id] = ctx.now;
        newly.push(def);
        changed = true;
      }
    } catch {
      /* a bad check must not block others */
    }
  }

  if (changed) saveUnlocks(state);
  return newly;
}

/** Sync lifetime from activities, then evaluate. Returns new unlocks. */
export function refreshAchievements(
  activities: Activity[],
  profile: Profile,
): { lifetime: LifetimeStats; newly: AchievementDef[] } {
  const lifetime = syncLifetime(activities);
  const newly = evaluateAchievements(
    buildAchievementContext(activities, profile, lifetime),
  );
  return { lifetime, newly };
}

export function isUnlocked(id: string, state: AchievementUnlocks = loadUnlocks()): boolean {
  return Boolean(state.unlocked[id]);
}

export function unlockedCount(state: AchievementUnlocks = loadUnlocks()): number {
  return Object.keys(state.unlocked).length;
}
