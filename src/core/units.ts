/**
 * Units and the strings the UI shows.
 *
 * Everything is stored in metres and milliseconds; conversion happens only at
 * the moment of display. Switching between kilometres and miles must never
 * rewrite saved data, or the first person to toggle it loses their history.
 */

export type UnitSystem = 'metric' | 'imperial';

export const METRES_PER_KM = 1000;
export const METRES_PER_MILE = 1609.344;

/** Length of the unit a pace is quoted in: "per km" or "per mile". */
export function paceUnitMetres(units: UnitSystem): number {
  return units === 'metric' ? METRES_PER_KM : METRES_PER_MILE;
}

export function distanceLabel(units: UnitSystem): string {
  return units === 'metric' ? 'km' : 'mi';
}

export function paceLabel(units: UnitSystem): string {
  return units === 'metric' ? '/km' : '/mi';
}

/** Metres in the display unit, unrounded. */
export function toDisplayDistance(metres: number, units: UnitSystem): number {
  return metres / paceUnitMetres(units);
}

export function fromDisplayDistance(value: number, units: UnitSystem): number {
  return value * paceUnitMetres(units);
}

export function formatDistance(metres: number, units: UnitSystem, decimals = 2): string {
  return toDisplayDistance(metres, units).toFixed(decimals);
}

const pad = (n: number): string => String(n).padStart(2, '0');

/**
 * `12:05` under an hour, `1:04:22` over it.
 *
 * The leading unit is never zero-padded: a stopwatch that reads `01:04:22` looks
 * like a timestamp, and this is a duration.
 *
 * Pass `tenths: true` for the live run clock (`12:05.3`). History and stats
 * keep whole seconds so finished activities do not jitter.
 *
 * Pass `forceHours: true` for the live hero so long runs always show H:MM:SS
 * (including `0:45:12` under an hour) — easier to read mid-run than switching
 * layout when the first hour rolls over.
 */
export function formatDuration(
  ms: number,
  options?: { tenths?: boolean; forceHours?: boolean },
): string {
  const clamped = Math.max(0, ms);
  const total = Math.floor(clamped / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const showHours = hours > 0 || Boolean(options?.forceHours);
  const base = showHours
    ? `${hours}:${pad(minutes)}:${pad(seconds)}`
    : `${minutes}:${pad(seconds)}`;
  if (!options?.tenths) return base;
  const tenths = Math.floor((clamped % 1000) / 100);
  return `${base}.${tenths}`;
}

/** Seconds per display unit, or null when nothing has been covered yet. */
export function paceSecondsPerUnit(
  metres: number,
  ms: number,
  units: UnitSystem,
): number | null {
  if (metres <= 0 || ms <= 0) return null;
  return ms / 1000 / (metres / paceUnitMetres(units));
}

/**
 * Pace as `m:ss`, or `--:--` when there is nothing to divide.
 *
 * Absurd paces are clamped rather than shown: the first second of a run yields
 * a pace of several hours per kilometre, and a display that briefly reads
 * `197:43` reads as a bug.
 */
export function formatPace(secondsPerUnit: number | null): string {
  if (secondsPerUnit === null || !Number.isFinite(secondsPerUnit)) return '--:--';
  if (secondsPerUnit > 99 * 60) return '--:--';
  const minutes = Math.floor(secondsPerUnit / 60);
  const seconds = Math.round(secondsPerUnit % 60);
  // 5:60 is 6:00. Rounding seconds can produce it, so carry the minute.
  if (seconds === 60) return `${minutes + 1}:00`;
  return `${minutes}:${pad(seconds)}`;
}

export function formatSpeed(metres: number, ms: number, units: UnitSystem): string {
  if (ms <= 0) return '0.0';
  const hours = ms / 3_600_000;
  return (toDisplayDistance(metres, units) / hours).toFixed(1);
}

/** "Today", "Yesterday", then a plain date once it stops being either. */
export function formatDay(timestamp: number, now = Date.now()): string {
  const startOfDay = (ms: number): number => {
    const d = new Date(ms);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  };
  const days = Math.round((startOfDay(now) - startOfDay(timestamp)) / 86_400_000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return new Date(timestamp).toLocaleDateString(undefined, { weekday: 'long' });
  return new Date(timestamp).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: days > 300 ? 'numeric' : undefined,
  });
}

export function formatClock(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}
