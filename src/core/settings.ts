/**
 * The athlete's profile and preferences, persisted.
 *
 * Small enough for localStorage, and wanted synchronously at first paint — the
 * runs themselves live in IndexedDB, but the unit system has to be known before
 * a single number can be drawn.
 */

import type { LocaleId, MessageKey } from '../i18n';
import { parseLocale } from '../i18n';
import type { BiologicalSex } from './calories';
import { estimateMaxHeartRate } from './heart';
import { parseMapStyle, type MapStyleId } from './mercator';
import { estimateStride } from './steps';
import type { UnitSystem } from './units';

export type { MapStyleId };

const KEY = 'runlog:settings:v1';

export type { BiologicalSex };

/**
 * Visual shell. Tokens + a few layout variants live in styles.css under
 * `[data-theme="…"]`. Soft Emerald is the default (closest to the original app).
 */
export type ThemeId = 'soft' | 'hud' | 'day' | 'crimson' | 'sky' | 'retro';

/**
 * Themes as message keys, not text.
 *
 * The label and blurb used to be English literals sitting in the pure core.
 * They are keys now, so this module holds the catalogue of *what themes exist*
 * and the i18n catalogue holds *what they are called* — and adding a theme
 * without naming it in every locale fails to compile.
 */
export const THEME_OPTIONS: Array<{
  id: ThemeId;
  label: MessageKey;
  blurb: MessageKey;
}> = [
  {
    id: 'soft',
    label: 'theme.soft.label',
    blurb: 'theme.soft.blurb',
  },
  {
    id: 'hud',
    label: 'theme.hud.label',
    blurb: 'theme.hud.blurb',
  },
  {
    id: 'day',
    label: 'theme.day.label',
    blurb: 'theme.day.blurb',
  },
  {
    id: 'crimson',
    label: 'theme.crimson.label',
    blurb: 'theme.crimson.blurb',
  },
  {
    id: 'sky',
    label: 'theme.sky.label',
    blurb: 'theme.sky.blurb',
  },
  {
    id: 'retro',
    label: 'theme.retro.label',
    blurb: 'theme.retro.blurb',
  },
];

export interface Profile {
  /**
   * Preferred name for greetings and coach copy. Empty until set.
   * Not a login identity — stays on device only.
   */
  displayName: string;
  /**
   * Interface language. Independent of `units` on purpose: a Greek reader may
   * well want kilometres, and an English one miles, and tying the two means
   * one of them cannot have what they want.
   */
  locale: LocaleId;
  /** UI look: Soft Emerald, HUD, Daylight, Crimson, Skyline, or Arcade Neon. */
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
  /** Short vibration / haptic on button presses. */
  haptics: boolean;
  /**
   * Auto-pause when stopped (outdoor GPS or treadmill with foot-pod speed).
   * Auto-resumes when movement returns.
   */
  autoPause: boolean;
  /**
   * Map basemap for history/detail (and live when liveMapTiles is on).
   * `auto` follows the app theme (day → standard, soft/hud → dark).
   */
  mapStyle: MapStyleId;
  /**
   * When true, outdoor live/arming maps fetch basemap tiles.
   * Default off to save data and keep the live HUD glanceable.
   */
  liveMapTiles: boolean;
}

export const DEFAULTS: Profile = {
  displayName: '',
  locale: 'en',
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
  haptics: true,
  autoPause: true,
  mapStyle: 'auto',
  liveMapTiles: false,
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

/**
 * Status bar / PWA chrome, roughly each theme's page background.
 *
 * A Record rather than a ternary chain: adding a theme to ThemeId without a
 * colour here is then a compile error instead of a silently wrong status bar,
 * which is how the previous five-deep ternary would have failed.
 */
const THEME_CHROME: Record<ThemeId, string> = {
  soft: '#0a0d12',
  hud: '#050505',
  day: '#ffffff',
  crimson: '#12080a',
  sky: '#070d16',
  retro: '#000000',
};

/** Push the active theme onto <html> so CSS tokens apply before paint. */
export function applyTheme(theme: ThemeId): void {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', THEME_CHROME[theme]);
}

/**
 * Push the active language onto <html lang>.
 *
 * Not cosmetic: `lang` is what a screen reader picks a voice from, what the
 * browser hyphenates by, and what `:lang()` selectors match. Leaving it at the
 * hardcoded "en" in index.html would have Greek read aloud by an English
 * synthesiser.
 */
export function applyLocale(locale: LocaleId): void {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = locale;
}

export function parseTheme(value: unknown): ThemeId {
  if (value === 'hud' || value === 'athletic' || value === 'athletic-hud') return 'hud';
  if (value === 'day' || value === 'light' || value === 'daylight') return 'day';
  if (value === 'soft' || value === 'emerald' || value === 'soft-emerald') return 'soft';
  if (value === 'crimson' || value === 'red' || value === 'ember') return 'crimson';
  if (value === 'sky' || value === 'skyline' || value === 'blue') return 'sky';
  if (value === 'retro' || value === 'arcade' || value === 'neon') return 'retro';
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
    locale: parseLocale(input.locale),
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
    haptics: typeof input.haptics === 'boolean' ? input.haptics : DEFAULTS.haptics,
    autoPause: typeof input.autoPause === 'boolean' ? input.autoPause : DEFAULTS.autoPause,
    mapStyle: parseMapStyle(input.mapStyle),
    liveMapTiles:
      typeof input.liveMapTiles === 'boolean' ? input.liveMapTiles : DEFAULTS.liveMapTiles,
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
