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

/**
 * What a lap press recorded. Structurally a ManualLap, restated here so this
 * module keeps depending on nothing.
 */
export interface CueLap {
  index: number;
  splitDistanceM: number;
  splitDurationMs: number;
}

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
  /** Manual laps pressed so far, in order. */
  laps: readonly CueLap[];
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
  | { type: 'lap'; index: number; splitDistanceM: number; splitDurationMs: number };

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
  laps: readonly CueLap[];
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
    /*
     * Copied, not referenced.
     *
     * The caller hands over the session's own lap array, which the session
     * goes on mutating. Holding the reference means the previous snapshot and
     * the current one are the same array — so a new lap is already present in
     * "before" by the time it is compared against "after", the diff sees no
     * change, and no lap is ever announced. Every other field here is a number
     * and copies itself; this one has to be told.
     */
    laps: [...input.laps],
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
  for (let i = prev.laps.length; i < current.laps.length; i++) {
    const lap = current.laps[i];
    out.push({
      type: 'lap',
      index: lap.index,
      splitDistanceM: lap.splitDistanceM,
      splitDurationMs: lap.splitDurationMs,
    });
  }

  return out;
}

function unitWord(units: UnitSystem, plural: boolean): string {
  const word = units === 'metric' ? 'kilometer' : 'mile';
  return plural ? `${word}s` : word;
}

/**
 * A duration for the ear rather than the eye.
 *
 * "5:12" is right on a screen and a gamble through a speech engine — read as
 * "five twelve", "five colon twelve" or a time of day depending on the voice.
 * Spelling out the units costs a syllable and removes the guess.
 */
export function spokenDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours} hour${hours === 1 ? '' : 's'}`);
  if (minutes > 0) parts.push(`${minutes} minute${minutes === 1 ? '' : 's'}`);
  // A run of exactly two minutes should not be silent about its seconds only
  // to leave the sentence hanging on "two minutes" with no anchor.
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds} second${seconds === 1 ? '' : 's'}`);
  return parts.join(' ');
}

/** "1.02 kilometers", spoken. */
export function spokenDistance(metres: number, units: UnitSystem): string {
  const value = metres / paceUnitMetres(units);
  const text = value.toFixed(2);
  return `${text} ${unitWord(units, text !== '1.00')}`;
}

/** "5 minutes 6 seconds per kilometer", or null when there is nothing to divide. */
export function spokenPace(metres: number, ms: number, units: UnitSystem): string | null {
  if (metres <= 0 || ms <= 0) return null;
  const secondsPerUnit = ms / 1000 / (metres / paceUnitMetres(units));
  // Past about an hour and a half per unit it is a walk to the car, not a pace.
  if (!Number.isFinite(secondsPerUnit) || secondsPerUnit > 99 * 60) return null;
  return `${spokenDuration(secondsPerUnit * 1000)} per ${unitWord(units, false)}`;
}

/** "1.02 kilometers in 5 minutes 12 seconds, 5 minutes 6 seconds per kilometer." */
export function spokenSummary(metres: number, ms: number, units: UnitSystem): string {
  const head = `${spokenDistance(metres, units)} in ${spokenDuration(ms)}`;
  const pace = spokenPace(metres, ms, units);
  return pace ? `${head}, ${pace}.` : `${head}.`;
}

/** Spoken line for a cue (English, short enough for outdoors). */
export function cueSpeech(
  event: CueEvent,
  ctx: {
    units: UnitSystem;
    distanceM: number;
    durationMs: number;
  },
): string {
  switch (event.type) {
    case 'started':
      return 'Run started.';
    case 'distance_unit':
      return event.unit === 1
        ? `One ${unitWord(ctx.units, false)}. ${spokenDuration(ctx.durationMs)}.`
        : `${event.unit} ${unitWord(ctx.units, true)}. ${spokenDuration(ctx.durationMs)}.`;
    case 'goal_half':
      return 'Halfway to your goal.';
    case 'goal_met':
      // The milestone is the moment to hear where the run stands, not just
      // that a threshold went by.
      return `Goal reached. ${spokenSummary(ctx.distanceM, ctx.durationMs, ctx.units)}`;
    case 'paused':
      return 'Paused.';
    case 'resumed':
      return 'Resumed.';
    case 'auto_paused':
      return 'Auto paused.';
    case 'auto_resumed':
      return 'Resuming.';
    case 'lap':
      // The split, not the running total — a lap you cannot compare against
      // the last one is a beep with a number on it.
      return `Lap ${event.index}. ${spokenSummary(event.splitDistanceM, event.splitDurationMs, ctx.units)}`;
  }
}
