/**
 * Target pace band for live feedback.
 *
 * Pace is seconds per display unit (km or mile). Lower is faster. A ±band
 * fraction around the target is "on pace"; outside it is slow or fast.
 */

import { formatPace, paceLabel, type UnitSystem } from './units';

export type PaceBandStatus = 'none' | 'unknown' | 'slow' | 'ok' | 'fast';

/** Default half-width of the band as a fraction of target pace (5%). */
export const DEFAULT_PACE_BAND = 0.05;

/**
 * Parse user input into seconds per unit.
 *
 * Accepts `m:ss` (preferred), or a plain number as minutes (5.5 → 5:30).
 */
export function parsePaceInput(text: string): number | null {
  const t = text.trim();
  if (!t) return null;

  const colon = t.match(/^(\d{1,2}):(\d{1,2})$/);
  if (colon) {
    const minutes = Number(colon[1]);
    const seconds = Number(colon[2]);
    if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) return null;
    if (seconds >= 60 || minutes > 99) return null;
    const total = minutes * 60 + seconds;
    return total > 0 && total < 99 * 60 ? total : null;
  }

  const n = Number(t.replace(',', '.'));
  if (!Number.isFinite(n) || n <= 0 || n >= 99) return null;
  // Plain number: minutes (5 → 5:00, 5.5 → 5:30).
  const total = Math.round(n * 60);
  return total > 0 && total < 99 * 60 ? total : null;
}

export function paceBandStatus(
  currentSecondsPerUnit: number | null,
  targetSecondsPerUnit: number | null,
  bandFraction = DEFAULT_PACE_BAND,
): PaceBandStatus {
  if (targetSecondsPerUnit === null || !(targetSecondsPerUnit > 0)) return 'none';
  if (currentSecondsPerUnit === null || !Number.isFinite(currentSecondsPerUnit)) {
    return 'unknown';
  }
  if (currentSecondsPerUnit <= 0 || currentSecondsPerUnit > 99 * 60) return 'unknown';

  const band = Math.max(0.01, Math.min(0.25, bandFraction));
  const low = targetSecondsPerUnit * (1 - band); // faster edge
  const high = targetSecondsPerUnit * (1 + band); // slower edge

  if (currentSecondsPerUnit < low) return 'fast';
  if (currentSecondsPerUnit > high) return 'slow';
  return 'ok';
}

export function paceBandLabel(status: PaceBandStatus): string {
  switch (status) {
    case 'fast':
      return 'Slow down';
    case 'slow':
      return 'Pick up';
    case 'ok':
      return 'On pace';
    case 'unknown':
      return 'Pace…';
    case 'none':
    default:
      return '';
  }
}

export function formatTargetPace(targetSecondsPerUnit: number, units: UnitSystem): string {
  return `${formatPace(targetSecondsPerUnit)} ${paceLabel(units)}`;
}

/**
 * Soft cue text when a whole distance unit lands off-band (optional speech).
 * Returns null when on-band or no target.
 */
export function paceBandCueSpeech(
  status: PaceBandStatus,
  targetSecondsPerUnit: number,
  units: UnitSystem,
): string | null {
  if (status === 'none' || status === 'unknown' || status === 'ok') return null;
  const target = formatPace(targetSecondsPerUnit);
  const unit = units === 'metric' ? 'per kilometre' : 'per mile';
  if (status === 'fast') return `Slow down. Target ${target} ${unit}.`;
  return `Pick up the pace. Target ${target} ${unit}.`;
}
