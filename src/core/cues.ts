/**
 * Pure “what should we announce?” logic for in-run audio and alerts.
 *
 * The platform layer turns these events into speech / vibration; this module
 * only compares snapshots so it can be unit-tested without a browser.
 */

import type { UnitSystem } from './units';
import { paceUnitMetres } from './units';
import type { RunGoal } from './goal';
import { goalMet, goalProgress } from './goal';

export interface CueSnapshot {
  distanceM: number;
  durationMs: number;
  caloriesKcal: number;
  state: 'running' | 'paused' | 'idle' | 'finished';
  /** Completed whole distance units (km or mi), floor. */
  distanceUnits: number;
  goal: RunGoal | null;
  goalProgress: number;
  goalMet: boolean;
  /** Manual lap count (after each lap press). */
  lapCount: number;
  /** True when the latest pause was triggered by auto-pause. */
  autoPaused: boolean;
}

export type CueEvent =
  | { type: 'started' }
  | { type: 'distance_unit'; unit: number }
  | { type: 'goal_half' }
  | { type: 'goal_met' }
  | { type: 'paused' }
  | { type: 'resumed' }
  | { type: 'auto_paused' }
  | { type: 'auto_resumed' }
  | { type: 'lap'; index: number };

export interface CueOptions {
  units: UnitSystem;
  /** Announce every whole km or mile. */
  distanceCues: boolean;
  /** Announce goal half and goal met. */
  goalCues: boolean;
}

export function makeSnapshot(input: {
  distanceM: number;
  durationMs: number;
  caloriesKcal: number;
  state: CueSnapshot['state'];
  goal: RunGoal | null;
  lapCount: number;
  autoPaused: boolean;
  units: UnitSystem;
}): CueSnapshot {
  const unitM = paceUnitMetres(input.units);
  const snap = {
    distanceM: input.distanceM,
    durationMs: input.durationMs,
    caloriesKcal: input.caloriesKcal,
  };
  const progress = input.goal ? goalProgress(input.goal, snap) : 0;
  return {
    distanceM: input.distanceM,
    durationMs: input.durationMs,
    caloriesKcal: input.caloriesKcal,
    state: input.state,
    distanceUnits: Math.floor(input.distanceM / unitM),
    goal: input.goal,
    goalProgress: progress,
    goalMet: input.goal ? goalMet(input.goal, snap) : false,
    lapCount: input.lapCount,
    autoPaused: input.autoPaused,
  };
}

/**
 * Diff previous → current and emit cue events in a stable order.
 *
 * Pass `prev = null` on the first tick after the clock starts to get `started`.
 */
export function pendingCues(
  prev: CueSnapshot | null,
  current: CueSnapshot,
  options: CueOptions,
): CueEvent[] {
  const out: CueEvent[] = [];

  if (!prev) {
    if (current.state === 'running') out.push({ type: 'started' });
    return out;
  }

  // State transitions
  if (prev.state === 'running' && current.state === 'paused') {
    out.push(current.autoPaused ? { type: 'auto_paused' } : { type: 'paused' });
  }
  if (prev.state === 'paused' && current.state === 'running') {
    out.push(prev.autoPaused || current.autoPaused ? { type: 'auto_resumed' } : { type: 'resumed' });
  }

  // Distance units (1 km / 1 mi crossings)
  if (options.distanceCues && current.state !== 'idle') {
    for (let u = prev.distanceUnits + 1; u <= current.distanceUnits; u++) {
      if (u > 0) out.push({ type: 'distance_unit', unit: u });
    }
  }

  // Goal progress
  if (options.goalCues && current.goal) {
    if (prev.goalProgress < 0.5 && current.goalProgress >= 0.5 && !current.goalMet) {
      out.push({ type: 'goal_half' });
    }
    if (!prev.goalMet && current.goalMet) {
      out.push({ type: 'goal_met' });
    }
  }

  // Manual laps
  if (current.lapCount > prev.lapCount) {
    for (let i = prev.lapCount + 1; i <= current.lapCount; i++) {
      out.push({ type: 'lap', index: i });
    }
  }

  return out;
}

/** Spoken line for a cue (English, short enough for outdoors). */
export function cueSpeech(
  event: CueEvent,
  ctx: {
    units: UnitSystem;
    distanceM: number;
    durationMs: number;
    formatDistance: (m: number) => string;
    formatDuration: (ms: number) => string;
  },
): string {
  const unitWord = ctx.units === 'metric' ? 'kilometer' : 'mile';
  switch (event.type) {
    case 'started':
      return 'Run started.';
    case 'distance_unit':
      return event.unit === 1
        ? `One ${unitWord}. ${ctx.formatDuration(ctx.durationMs)}.`
        : `${event.unit} ${unitWord}s. ${ctx.formatDuration(ctx.durationMs)}.`;
    case 'goal_half':
      return 'Halfway to your goal.';
    case 'goal_met':
      return 'Goal reached.';
    case 'paused':
      return 'Paused.';
    case 'resumed':
      return 'Resumed.';
    case 'auto_paused':
      return 'Auto paused.';
    case 'auto_resumed':
      return 'Resuming.';
    case 'lap':
      return `Lap ${event.index}.`;
  }
}
