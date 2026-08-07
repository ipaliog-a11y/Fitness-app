/**
 * The athlete's profile and preferences, persisted.
 *
 * Small enough for localStorage, and wanted synchronously at first paint — the
 * runs themselves live in IndexedDB, but the unit system has to be known before
 * a single number can be drawn.
 */

import type { BiologicalSex } from './calories';
import { estimateMaxHeartRate } from './heart';
import { estimateStride } from './steps';
import type { UnitSystem } from './units';

const KEY = 'runlog:settings:v1';

export type { BiologicalSex };

/**
 * Visual shell. Tokens + a few layout variants live in styles.css under
 * `[data-theme="…"]`. Soft Emerald is the default (closest to the original app).
 */
export type ThemeId = 'soft' | 'hud' | 'day';

export const THEME_OPTIONS: Array<{
  id: ThemeId;
  label: string;
  blurb: string;
}> = [
  {
    id: 'soft',
    label: 'Soft Emerald',
    blurb: 'Calm slate cards, green accent, frosted tab bar.',
  },
  {
    id: 'hud',
    label: 'Athletic HUD',
    blurb: 'Pure black, volt lime, mono numbers, solid dock.',
  },
  {
    id: 'day',
    label: 'Daylight',
    blurb: 'Paper white, deep green, solid chrome — built for direct sun.',
  },
];

export interface Profile {
  /**
   * Preferred name for greetings and coach copy. Empty until set.
   * Not a login identity — stays on device only.
   */
  displayName: string;
  /** UI look: Soft Emerald or Athletic HUD. */
  theme: ThemeId;
  units: UnitSystem;
  /**
   * ISO date `YYYY-MM-DD` when known. Empty string until set.
   * Age is derived from this when present.
   */
  birthDate: string;
  /** Years. Used for max HR seed and Keytel calorie estimate. */
  age: number;
  heightCm: number;
  /**
   * Body mass in kilograms. Used for estimated calories on each run.
   * Stored in kg regardless of the unit system; the settings screen converts.
   * Prefer updating via the weight log so history stays consistent.
   */
  weightKg: number;
  /**
   * Improves HR-based calorie accuracy (Keytel). Unspecified averages the
   * male and female equations.
   */
  sex: BiologicalSex;
  /** Beats per minute. Seeded from age, overwritable with a tested figure. */
  maxHeartRate: number;
  /** Metres per step on the treadmill, used when there is no foot pod. */
  strideM: number;
  /**
   * Correction factor for a foot pod's readings. 1 means "believe the pod".
   * Set by finishing a treadmill run with the console's distance typed in.
   */
  footpodCalibration: number;
  /** Weekly distance target in metres; 0 turns the goal off. */
  weeklyGoalM: number;
  /** Keep the screen awake while a run is in progress. */
  keepAwake: boolean;
  /** Speak distance / goal / lap cues during a run. */
  audioCues: boolean;
  /**
   * Auto-pause when stopped (outdoor GPS or treadmill with foot-pod speed).
   * Auto-resumes when movement returns.
   */
  autoPause: boolean;
}

export const DEFAULTS: Profile = {
  displayName: '',
  theme: 'soft',
  units: 'metric',
  birthDate: '',
  age: 35,
  heightCm: 175,
  weightKg: 70,
  sex: 'male',
  maxHeartRate: estimateMaxHeartRate(35),
  strideM: estimateStride(175),
  footpodCalibration: 1,
  weeklyGoalM: 20000,
  keepAwake: true,
  audioCues: true,
  autoPause: true,
};

/**
 * Whole years from an ISO birth date, or null when the string is unusable.
 */
export function ageFromBirthDate(iso: string, now = Date.now()): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const birth = new Date(y, mo - 1, d);
  if (birth.getFullYear() !== y || birth.getMonth() !== mo - 1 || birth.getDate() !== d) {
    return null;
  }
  const today = new Date(now);
  if (birth.getTime() > today.getTime()) return null;
  let age = today.getFullYear() - y;
  if (
    today.getMonth() < birth.getMonth() ||
    (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())
  ) {
    age -= 1;
  }
  if (age < 0 || age > 120) return null;
  return age;
}

/** Accept only a real calendar date as YYYY-MM-DD. */
export function sanitiseBirthDate(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  const t = raw.trim();
  return ageFromBirthDate(t) !== null ? t : '';
}

/** Push the active theme onto <html> so CSS tokens apply before paint. */
export function applyTheme(theme: ThemeId): void {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = theme;
  // Status bar / PWA chrome roughly matches the page background.
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    const bg = theme === 'hud' ? '#050505' : theme === 'day' ? '#ffffff' : '#0a0d12';
    meta.setAttribute('content', bg);
  }
}

export function parseTheme(value: unknown): ThemeId {
  if (value === 'hud' || value === 'athletic' || value === 'athletic-hud') return 'hud';
  if (value === 'day' || value === 'light' || value === 'daylight') return 'day';
  if (value === 'soft' || value === 'emerald' || value === 'soft-emerald') return 'soft';
  return DEFAULTS.theme;
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

/**
 * Coerce anything into a usable profile.
 *
 * Pure and exported so it can be tested directly: this is the function standing
 * between a hand-edited or version-skewed localStorage entry and a screen full
 * of `NaN`.
 */
export function sanitise(raw: unknown): Profile {
  const input = (typeof raw === 'object' && raw !== null ? raw : {}) as Partial<Profile>;
  const num = (value: unknown, fallback: number): number =>
    typeof value === 'number' && Number.isFinite(value) ? value : fallback;

  const birthDate = sanitiseBirthDate(input.birthDate);
  const derivedAge = birthDate ? ageFromBirthDate(birthDate) : null;
  const age = clamp(
    derivedAge ?? num(input.age, DEFAULTS.age),
    5,
    120,
  );
  const heightCm = clamp(num(input.heightCm, DEFAULTS.heightCm), 80, 250);

  // Profile only stores male/female; legacy "unspecified" maps to default.
  const sex: BiologicalSex =
    input.sex === 'male' || input.sex === 'female' ? input.sex : DEFAULTS.sex;

  const displayName =
    typeof input.displayName === 'string' ? input.displayName.trim().slice(0, 40) : DEFAULTS.displayName;

  return {
    displayName,
    theme: parseTheme(input.theme),
    units: input.units === 'imperial' ? 'imperial' : 'metric',
    birthDate,
    age,
    heightCm,
    weightKg: clamp(num(input.weightKg, DEFAULTS.weightKg), 25, 250),
    sex,
    // Falls back to the age estimate rather than the constant default, so a
    // profile with an age but no tested max still gets a sensible number.
    maxHeartRate: clamp(num(input.maxHeartRate, estimateMaxHeartRate(age)), 100, 230),
    strideM: clamp(num(input.strideM, estimateStride(heightCm)), 0.3, 2.5),
    // Clamped hard: a pod is never wrong by more than a factor of two, so a
    // value outside this came from a mistyped calibration and would silently
    // corrupt every treadmill run that followed.
    footpodCalibration: clamp(num(input.footpodCalibration, 1), 0.5, 2),
    weeklyGoalM: clamp(num(input.weeklyGoalM, DEFAULTS.weeklyGoalM), 0, 500_000),
    keepAwake: typeof input.keepAwake === 'boolean' ? input.keepAwake : DEFAULTS.keepAwake,
    audioCues: typeof input.audioCues === 'boolean' ? input.audioCues : DEFAULTS.audioCues,
    autoPause: typeof input.autoPause === 'boolean' ? input.autoPause : DEFAULTS.autoPause,
  };
}

export function loadProfile(): Profile {
  try {
    const raw = localStorage.getItem(KEY);
    return sanitise(raw ? JSON.parse(raw) : {});
  } catch {
    // Corrupt entry or a browser refusing storage: the defaults still run.
    return { ...DEFAULTS };
  }
}

export function saveProfile(profile: Profile): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(sanitise(profile)));
  } catch {
    // Private mode refuses writes; the in-memory profile still works for now.
  }
}
