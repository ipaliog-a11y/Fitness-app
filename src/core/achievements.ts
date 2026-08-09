/**
 * Achievements: definitions, unlock state, and evaluation from app data.
 *
 * Pure checks over a context snapshot — no DOM. Icons are named keys rendered
 * in the UI as small SVGs.
 */

import type { MessageKey } from '../i18n';
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
  /**
   * Message keys, not text. The names are jokes ("Belt beast", "Century
   * club") and jokes do not survive literal translation, so each locale gets
   * to re-invent them rather than mirror the English word order.
   */
  title: MessageKey;
  description: MessageKey;
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
    title: 'achievement.first-finish.title',
    description: 'achievement.first-finish.desc',
    category: 'distance',
    icon: 'flag',
    test: (c) => c.lifetime.runs >= 1,
  },
  {
    id: 'k5',
    title: 'achievement.k5.title',
    description: 'achievement.k5.desc',
    category: 'distance',
    icon: 'medal',
    test: (c) => c.activities.some((a) => a.distanceM >= 5000),
  },
  {
    id: 'k10',
    title: 'achievement.k10.title',
    description: 'achievement.k10.desc',
    category: 'distance',
    icon: 'ribbon',
    test: (c) => c.activities.some((a) => a.distanceM >= 10_000),
  },
  {
    id: 'half-marathon',
    title: 'achievement.half-marathon.title',
    description: 'achievement.half-marathon.desc',
    category: 'distance',
    icon: 'trophy',
    test: (c) => c.activities.some((a) => a.distanceM >= 21_097.5),
  },
  {
    id: 'k30',
    title: 'achievement.k30.title',
    description: 'achievement.k30.desc',
    category: 'distance',
    icon: 'mountain',
    test: (c) => c.activities.some((a) => a.distanceM >= 30_000),
  },
  {
    id: 'marathon',
    title: 'achievement.marathon.title',
    description: 'achievement.marathon.desc',
    category: 'distance',
    icon: 'crown',
    test: (c) => c.activities.some((a) => a.distanceM >= 42_195),
  },

  // —— Lifetime mileage ————————————————————————————————
  {
    id: 'lifetime-25',
    title: 'achievement.lifetime-25.title',
    description: 'achievement.lifetime-25.desc',
    category: 'lifetime',
    icon: 'path',
    test: (c) => c.lifetime.distanceM >= 25_000,
  },
  {
    id: 'lifetime-50',
    title: 'achievement.lifetime-50.title',
    description: 'achievement.lifetime-50.desc',
    category: 'lifetime',
    icon: 'compass',
    test: (c) => c.lifetime.distanceM >= 50_000,
  },
  {
    id: 'lifetime-100',
    title: 'achievement.lifetime-100.title',
    description: 'achievement.lifetime-100.desc',
    category: 'lifetime',
    icon: 'star',
    test: (c) => c.lifetime.distanceM >= 100_000,
  },
  {
    id: 'lifetime-250',
    title: 'achievement.lifetime-250.title',
    description: 'achievement.lifetime-250.desc',
    category: 'lifetime',
    icon: 'layers',
    test: (c) => c.lifetime.distanceM >= 250_000,
  },
  {
    id: 'lifetime-500',
    title: 'achievement.lifetime-500.title',
    description: 'achievement.lifetime-500.desc',
    category: 'lifetime',
    icon: 'trophy',
    test: (c) => c.lifetime.distanceM >= 500_000,
  },
  {
    id: 'lifetime-1000',
    title: 'achievement.lifetime-1000.title',
    description: 'achievement.lifetime-1000.desc',
    category: 'lifetime',
    icon: 'crown',
    test: (c) => c.lifetime.distanceM >= 1_000_000,
  },
  {
    id: 'ten-runs',
    title: 'achievement.ten-runs.title',
    description: 'achievement.ten-runs.desc',
    category: 'lifetime',
    icon: 'calendar',
    test: (c) => c.lifetime.runs >= 10,
  },
  {
    id: 'fifty-runs',
    title: 'achievement.fifty-runs.title',
    description: 'achievement.fifty-runs.desc',
    category: 'lifetime',
    icon: 'flame',
    test: (c) => c.lifetime.runs >= 50,
  },

  // —— Recovery ————————————————————————————————————————
  {
    id: 'easy-day',
    title: 'achievement.easy-day.title',
    description: 'achievement.easy-day.desc',
    category: 'recovery',
    icon: 'leaf',
    test: (c) => c.activities.some((a) => isEasyWorkout(a)),
  },
  {
    id: 'fresh-legs',
    title: 'achievement.fresh-legs.title',
    description: 'achievement.fresh-legs.desc',
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
    title: 'achievement.balanced-load.title',
    description: 'achievement.balanced-load.desc',
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
    title: 'achievement.recovery-strides.title',
    description: 'achievement.recovery-strides.desc',
    category: 'recovery',
    icon: 'spark',
    test: (c) => c.activities.some((a) => a.workoutId === 'recovery-strides'),
  },

  // —— Performance —————————————————————————————————————
  {
    id: 'tempo-tester',
    title: 'achievement.tempo-tester.title',
    description: 'achievement.tempo-tester.desc',
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
    title: 'achievement.interval-hero.title',
    description: 'achievement.interval-hero.desc',
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
    title: 'achievement.structured-run.title',
    description: 'achievement.structured-run.desc',
    category: 'performance',
    icon: 'target',
    test: (c) => c.activities.some((a) => usedWorkout(a)),
  },
  {
    id: 'goal-crusher',
    title: 'achievement.goal-crusher.title',
    description: 'achievement.goal-crusher.desc',
    category: 'performance',
    icon: 'target',
    test: (c) => c.activities.some((a) => hasGoalMet(a)),
  },
  {
    id: 'streak-3',
    title: 'achievement.streak-3.title',
    description: 'achievement.streak-3.desc',
    category: 'performance',
    icon: 'flame',
    test: (c) => currentStreak(c.activities, c.now) >= 3,
  },
  {
    id: 'streak-7',
    title: 'achievement.streak-7.title',
    description: 'achievement.streak-7.desc',
    category: 'performance',
    icon: 'flame',
    test: (c) => currentStreak(c.activities, c.now) >= 7,
  },
  {
    id: 'early-bird',
    title: 'achievement.early-bird.title',
    description: 'achievement.early-bird.desc',
    category: 'performance',
    icon: 'sun',
    test: (c) => c.activities.some((a) => dayHour(a.startedAt) < 7),
  },
  {
    id: 'night-owl',
    title: 'achievement.night-owl.title',
    description: 'achievement.night-owl.desc',
    category: 'performance',
    icon: 'moon',
    test: (c) => c.activities.some((a) => dayHour(a.startedAt) >= 20),
  },

  // —— App usage ———————————————————————————————————————
  {
    id: 'named-runner',
    title: 'achievement.named-runner.title',
    description: 'achievement.named-runner.desc',
    category: 'app',
    icon: 'user',
    test: (c) => (c.profile.displayName ?? '').trim().length > 0,
  },
  {
    id: 'full-identity',
    title: 'achievement.full-identity.title',
    description: 'achievement.full-identity.desc',
    category: 'app',
    icon: 'user',
    test: (c) =>
      (c.profile.displayName ?? '').trim().length > 0 &&
      Boolean(c.profile.birthDate) &&
      c.profile.heightCm >= 80,
  },
  {
    id: 'coach-enrolled',
    title: 'achievement.coach-enrolled.title',
    description: 'achievement.coach-enrolled.desc',
    category: 'app',
    icon: 'coach',
    test: () => loadActivePlan() !== null,
  },
  {
    id: 'workout-factory',
    title: 'achievement.workout-factory.title',
    description: 'achievement.workout-factory.desc',
    category: 'app',
    icon: 'layers',
    test: () => loadSavedWorkouts().length >= 5,
  },
  {
    id: 'first-custom',
    title: 'achievement.first-custom.title',
    description: 'achievement.first-custom.desc',
    category: 'app',
    icon: 'note',
    test: () => loadSavedWorkouts().length >= 1,
  },
  {
    id: 'note-taker',
    title: 'achievement.note-taker.title',
    description: 'achievement.note-taker.desc',
    category: 'app',
    icon: 'note',
    test: (c) => c.activities.some((a) => hasNote(a)),
  },
  {
    id: 'route-saver',
    title: 'achievement.route-saver.title',
    description: 'achievement.route-saver.desc',
    category: 'app',
    icon: 'route',
    test: () => loadRoutes().length >= 1,
  },

  // —— Fun / gear ——————————————————————————————————————
  {
    id: 'first-shoes',
    title: 'achievement.first-shoes.title',
    description: 'achievement.first-shoes.desc',
    category: 'fun',
    icon: 'shoe',
    test: () => loadShoes().length >= 1,
  },
  {
    id: 'second-pair',
    title: 'achievement.second-pair.title',
    description: 'achievement.second-pair.desc',
    category: 'fun',
    icon: 'shoes',
    test: () => loadShoes().length >= 2,
  },
  {
    id: 'shoe-fleet',
    title: 'achievement.shoe-fleet.title',
    description: 'achievement.shoe-fleet.desc',
    category: 'fun',
    icon: 'shoes',
    test: () => loadShoes().length >= 3,
  },
  {
    id: 'outdoor-soul',
    title: 'achievement.outdoor-soul.title',
    description: 'achievement.outdoor-soul.desc',
    category: 'fun',
    icon: 'map',
    test: (c) => c.lifetime.outdoorRuns >= 1,
  },
  {
    id: 'belt-beast',
    title: 'achievement.belt-beast.title',
    description: 'achievement.belt-beast.desc',
    category: 'fun',
    icon: 'gym',
    test: (c) => c.lifetime.treadmillRuns >= 1,
  },
  {
    id: 'both-worlds',
    title: 'achievement.both-worlds.title',
    description: 'achievement.both-worlds.desc',
    category: 'fun',
    icon: 'compass',
    test: (c) => c.lifetime.outdoorRuns >= 1 && c.lifetime.treadmillRuns >= 1,
  },
  {
    id: 'hill-lover',
    title: 'achievement.hill-lover.title',
    description: 'achievement.hill-lover.desc',
    category: 'fun',
    icon: 'mountain',
    test: (c) => c.activities.some((a) => a.workoutId === 'hill-8x45'),
  },
  {
    id: 'hard-session',
    title: 'achievement.hard-session.title',
    description: 'achievement.hard-session.desc',
    category: 'performance',
    icon: 'bolt',
    test: (c) => c.activities.some((a) => isHardWorkout(a)),
  },
];

export const ACHIEVEMENT_CATEGORY_LABEL: Record<AchievementCategory, MessageKey> = {
  distance: 'achievement.category.distance',
  lifetime: 'achievement.category.lifetime',
  recovery: 'achievement.category.recovery',
  performance: 'achievement.category.performance',
  app: 'achievement.category.app',
  fun: 'achievement.category.fun',
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
