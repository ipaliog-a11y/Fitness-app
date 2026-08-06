/**
 * The athlete's profile and preferences, persisted.
 *
 * Small enough for localStorage, and wanted synchronously at first paint — the
 * runs themselves live in IndexedDB, but the unit system has to be known before
 * a single number can be drawn.
 */

import { estimateMaxHeartRate } from './heart';
import { estimateStride } from './steps';
import type { UnitSystem } from './units';

const KEY = 'runlog:settings:v1';

export interface Profile {
  units: UnitSystem;
  /** Years. Used only to seed a max heart rate. */
  age: number;
  heightCm: number;
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
}

export const DEFAULTS: Profile = {
  units: 'metric',
  age: 35,
  heightCm: 175,
  maxHeartRate: estimateMaxHeartRate(35),
  strideM: estimateStride(175),
  footpodCalibration: 1,
  weeklyGoalM: 20000,
  keepAwake: true,
};

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

  const age = clamp(num(input.age, DEFAULTS.age), 5, 120);
  const heightCm = clamp(num(input.heightCm, DEFAULTS.heightCm), 80, 250);

  return {
    units: input.units === 'imperial' ? 'imperial' : 'metric',
    age,
    heightCm,
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
    localStorage.setItem(KEY, JSON.stringify(profile));
  } catch {
    // Private mode refuses writes; the in-memory profile still works for now.
  }
}
