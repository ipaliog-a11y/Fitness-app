/**
 * Optional target for a single run: distance, moving time, or estimated kcal.
 *
 * Pure helpers so progress can be unit-tested without a DOM, and so the live
 * screen and the finished detail view agree on "did they hit it".
 */

import type { MessageKey } from '../i18n';
import { formatCalories } from './calories';
import {
  distanceLabel,
  formatDistance,
  formatDuration,
  fromDisplayDistance,
  type UnitSystem,
} from './units';

export type GoalKind = 'distance' | 'time' | 'calories';

export interface RunGoal {
  kind: GoalKind;
  /**
   * Absolute target in storage units:
   * - distance → metres
   * - time → milliseconds of moving time
   * - calories → kilocalories
   */
  target: number;
}

export interface GoalSnapshot {
  distanceM: number;
  durationMs: number;
  caloriesKcal: number;
}

export function goalCurrent(goal: RunGoal, snap: GoalSnapshot): number {
  switch (goal.kind) {
    case 'distance':
      return snap.distanceM;
    case 'time':
      return snap.durationMs;
    case 'calories':
      return snap.caloriesKcal;
  }
}

/** 0…1+ share of the target completed. */
export function goalProgress(goal: RunGoal, snap: GoalSnapshot): number {
  if (!(goal.target > 0)) return 0;
  return goalCurrent(goal, snap) / goal.target;
}

export function goalMet(goal: RunGoal, snap: GoalSnapshot): boolean {
  return goalProgress(goal, snap) >= 1;
}

export function goalKindLabel(kind: GoalKind): MessageKey {
  switch (kind) {
    case 'distance':
      return 'goalKind.distance';
    case 'time':
      return 'goalKind.time';
    case 'calories':
      return 'goalKind.calories';
  }
}

/** Human target, e.g. `5.00 km`, `30:00`, `300 kcal`. */
export function formatGoalTarget(goal: RunGoal, units: UnitSystem): string {
  switch (goal.kind) {
    case 'distance':
      return `${formatDistance(goal.target, units)} ${distanceLabel(units)}`;
    case 'time':
      return formatDuration(goal.target);
    case 'calories':
      return `${formatCalories(goal.target)} kcal`;
  }
}

/** Live progress line, e.g. `2.14 / 5.00 km`. */
export function formatGoalProgress(goal: RunGoal, snap: GoalSnapshot, units: UnitSystem): string {
  switch (goal.kind) {
    case 'distance':
      return `${formatDistance(snap.distanceM, units)} / ${formatDistance(goal.target, units)} ${distanceLabel(units)}`;
    case 'time':
      return `${formatDuration(snap.durationMs)} / ${formatDuration(goal.target)}`;
    case 'calories':
      return `${formatCalories(snap.caloriesKcal)} / ${formatCalories(goal.target)} kcal`;
  }
}

/** Build a goal from a display-unit distance (km or mi). */
export function distanceGoal(displayDistance: number, units: UnitSystem): RunGoal | null {
  if (!(displayDistance > 0)) return null;
  return { kind: 'distance', target: fromDisplayDistance(displayDistance, units) };
}

/** Build a goal from whole minutes of moving time. */
export function timeGoalMinutes(minutes: number): RunGoal | null {
  if (!(minutes > 0)) return null;
  return { kind: 'time', target: minutes * 60_000 };
}

/** Build a goal from kilocalories. */
export function caloriesGoal(kcal: number): RunGoal | null {
  if (!(kcal > 0)) return null;
  return { kind: 'calories', target: kcal };
}

/** Coerce unknown JSON (import / old records) into a goal or null. */
export function sanitiseGoal(raw: unknown): RunGoal | null {
  if (!raw || typeof raw !== 'object') return null;
  const g = raw as Partial<RunGoal>;
  if (g.kind !== 'distance' && g.kind !== 'time' && g.kind !== 'calories') return null;
  if (typeof g.target !== 'number' || !Number.isFinite(g.target) || g.target <= 0) return null;
  return { kind: g.kind, target: g.target };
}
