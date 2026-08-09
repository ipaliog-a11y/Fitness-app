/**
 * When to close a lap without anyone pressing anything.
 *
 * The manual lap button asks the athlete to find a phone, look at it and hit a
 * target while running, and it records the moment their thumb landed rather
 * than the moment they passed the mark. A second of fumbling is fifteen metres
 * at a decent pace, so the button is least accurate exactly where laps matter
 * most — on a track, where the distance is fixed and the whole point is
 * comparing one lap against the next.
 *
 * Pure, so the rule can be tested without a run.
 */

import type { MessageKey } from '../i18n';
import { paceUnitMetres, type UnitSystem } from './units';

/**
 * What closes a lap.
 *
 * `unit` follows the athlete's units — a kilometre or a mile — because that is
 * the boundary they already think in and the one the app already announces.
 */
export type AutoLapId = 'off' | 'm400' | 'unit' | 'phase';

export const AUTO_LAP_IDS: readonly AutoLapId[] = ['off', 'm400', 'unit', 'phase'];

export function isAutoLapId(value: unknown): value is AutoLapId {
  return typeof value === 'string' && (AUTO_LAP_IDS as readonly string[]).includes(value);
}

/**
 * The option's name, as a key.
 *
 * A Record rather than a switch, so adding an option without naming it in
 * every locale fails to compile instead of printing the id.
 */
const LABELS: Record<AutoLapId, MessageKey> = {
  off: 'settings.autoLap.off',
  m400: 'settings.autoLap.m400',
  unit: 'settings.autoLap.unit',
  phase: 'settings.autoLap.phase',
};

export function autoLapLabel(id: AutoLapId): MessageKey {
  return LABELS[id];
}

/**
 * The lap length in metres, or null when no distance closes the lap.
 *
 * `phase` and `off` both return null: neither is a distance. A workout phase
 * boundary arrives from the workout runner, not from the odometer.
 */
export function autoLapMetres(id: AutoLapId, units: UnitSystem): number | null {
  if (id === 'm400') return 400;
  if (id === 'unit') return paceUnitMetres(units);
  return null;
}

/**
 * Has the athlete run far enough since the last lap to owe another?
 *
 * Answers a count rather than a boolean so a caller that misses a tick still
 * closes the right number of laps. In practice it is 0 or 1 — the fix filter
 * rejects anything above 12 m/s, so no single tick can cover 400 m — but a
 * count costs nothing and does not quietly swallow a lap if that ever changes.
 */
export function autoLapsDue(
  lastLapAtM: number,
  distanceM: number,
  everyM: number | null,
): number {
  if (everyM === null || !(everyM > 0)) return 0;
  if (!Number.isFinite(lastLapAtM) || !Number.isFinite(distanceM)) return 0;
  const since = distanceM - lastLapAtM;
  if (!(since >= everyM)) return 0;
  return Math.floor(since / everyM);
}

/**
 * Does this option replace the app's own distance announcement?
 *
 * It has to, or a kilometre auto-lap says the distance twice: once as "one
 * kilometre" and again as the lap summary that follows it. Whichever boundary
 * the athlete chose is the one they hear about.
 */
export function silencesDistanceCue(id: AutoLapId): boolean {
  return id !== 'off';
}
