/**
 * Estimated energy cost of a run.
 *
 * Prefer heart rate when a strap produced enough samples (Keytel et al. 2005):
 * that tracks effort, hills, wind and fitness better than speed alone. Without
 * HR, fall back to ACSM walking/running equations from distance, time, mass
 * and incline.
 *
 * Both paths return gross kilocalories (includes resting metabolism during the
 * bout), matching what most consumer trackers show.
 */

import type { MessageKey } from '../i18n';
import type { HeartSample } from './activity';

/** Resting VO2 in mL/kg/min (1 MET). */
const RESTING_VO2 = 3.5;

/** Rough threshold where ACSM switches walking → running (~5 mph). */
const RUN_SPEED_M_PER_MIN = 134;

/** Gaps longer than this are treated as pauses and not billed as exercise. */
const HEART_PAUSE_GAP_MS = 30_000;

/** kJ → kcal. */
const KJ_PER_KCAL = 4.184;

/**
 * Biological sex for the Keytel regression.
 *
 * `unspecified` averages the male and female equations so the estimate is still
 * usable without forcing a choice.
 */
export type BiologicalSex = 'male' | 'female' | 'unspecified';

export type CalorieSource = 'heart' | 'pace';

export interface CalorieInput {
  distanceM: number;
  durationMs: number;
  weightKg: number;
  /** Years — required for Keytel; ignored by ACSM. */
  age?: number;
  sex?: BiologicalSex;
  inclinePercent?: number | null;
  heart?: HeartSample[];
}

export interface CalorieEstimate {
  kcal: number;
  source: CalorieSource;
}

/**
 * ACSM speed-based estimate (no HR).
 *
 * Average speed is taken from the whole bout. With no distance yet only resting
 * cost accrues so the number does not invent work that has not happened.
 */
export function estimateCaloriesFromPace(
  distanceM: number,
  durationMs: number,
  weightKg: number,
  inclinePercent: number | null = null,
): number {
  if (!(weightKg > 0) || !(durationMs > 0)) return 0;

  const minutes = durationMs / 60_000;
  const durationS = durationMs / 1000;
  const speedMperMin = distanceM > 0 && durationS > 0 ? (distanceM / durationS) * 60 : 0;
  const grade = Math.max(0, (inclinePercent ?? 0) / 100);

  let vo2: number;
  if (speedMperMin >= RUN_SPEED_M_PER_MIN) {
    // ACSM running: VO2 = 0.2·v + 0.9·v·G + 3.5
    vo2 = 0.2 * speedMperMin + 0.9 * speedMperMin * grade + RESTING_VO2;
  } else if (speedMperMin > 0) {
    // ACSM walking: VO2 = 0.1·v + 1.8·v·G + 3.5
    vo2 = 0.1 * speedMperMin + 1.8 * speedMperMin * grade + RESTING_VO2;
  } else {
    vo2 = RESTING_VO2;
  }

  // 5 kcal per litre of O2 is the usual conversion.
  return Math.max(0, ((vo2 * weightKg) / 1000) * 5 * minutes);
}

/**
 * Keytel et al. (2005): energy expenditure in kJ/min from HR, mass and age.
 *
 * Validated for moderate-to-vigorous exercise; clamped HR keeps the regression
 * out of nonsense territory if a strap glitches.
 */
export function keytelKjPerMin(
  bpm: number,
  weightKg: number,
  age: number,
  sex: BiologicalSex = 'unspecified',
): number {
  const hr = Math.min(220, Math.max(40, bpm));
  const male = -55.0969 + 0.6309 * hr + 0.1988 * weightKg + 0.2017 * age;
  const female = -20.4022 + 0.4472 * hr - 0.1263 * weightKg + 0.074 * age;
  if (sex === 'male') return male;
  if (sex === 'female') return female;
  return (male + female) / 2;
}

function keytelKcalPerMin(
  bpm: number,
  weightKg: number,
  age: number,
  sex: BiologicalSex,
): number {
  return Math.max(0, keytelKjPerMin(bpm, weightKg, age, sex) / KJ_PER_KCAL);
}

/**
 * Integrate Keytel over the heart-rate trace for `durationMs` of moving time.
 *
 * Sample-to-sample intervals are charged at the midpoint HR. Gaps longer than
 * {@link HEART_PAUSE_GAP_MS} are skipped (pauses). Any moving time not covered
 * by samples is filled at the last known rate so a brief dropout does not zero
 * the estimate.
 *
 * Returns null when there is not enough signal to prefer HR over pace.
 */
export function estimateCaloriesFromHeart(
  heart: HeartSample[],
  durationMs: number,
  weightKg: number,
  age: number,
  sex: BiologicalSex = 'unspecified',
): { kcal: number; coveredMs: number } | null {
  if (!(weightKg > 0) || !(durationMs > 0) || !(age > 0) || heart.length === 0) {
    return null;
  }

  let kcal = 0;
  let coveredMs = 0;

  for (let i = 1; i < heart.length; i++) {
    const dt = heart[i].t - heart[i - 1].t;
    if (dt <= 0 || dt > HEART_PAUSE_GAP_MS) continue;
    const mid = (heart[i - 1].bpm + heart[i].bpm) / 2;
    kcal += keytelKcalPerMin(mid, weightKg, age, sex) * (dt / 60_000);
    coveredMs += dt;
  }

  // Single sample, or gaps only: still useful if we have a reading.
  const last = heart[heart.length - 1];
  if (coveredMs < durationMs && last.bpm > 0) {
    const fill = durationMs - coveredMs;
    kcal += keytelKcalPerMin(last.bpm, weightKg, age, sex) * (fill / 60_000);
    coveredMs = durationMs;
  }

  // Need either a multi-sample trace or enough fill that we are not guessing
  // from one glitch at the start line.
  if (heart.length < 2 && durationMs < 60_000) return null;
  if (coveredMs <= 0) return null;

  return { kcal: Math.max(0, kcal), coveredMs };
}

/**
 * Best available estimate: HR when the strap covered the run, otherwise pace.
 */
export function estimateCalories(input: CalorieInput): CalorieEstimate {
  const {
    distanceM,
    durationMs,
    weightKg,
    age = 35,
    sex = 'unspecified',
    inclinePercent = null,
    heart = [],
  } = input;

  const pace = estimateCaloriesFromPace(distanceM, durationMs, weightKg, inclinePercent);

  const fromHeart = estimateCaloriesFromHeart(heart, durationMs, weightKg, age, sex);
  // Prefer HR when samples span a meaningful share of moving time (or the whole
  // fill path ran). A strap that only chirped once mid-run should not override
  // a solid ACSM number.
  if (fromHeart && fromHeart.coveredMs >= Math.min(durationMs, 60_000) * 0.25) {
    return { kcal: fromHeart.kcal, source: 'heart' };
  }

  return { kcal: pace, source: 'pace' };
}

/** Convenience: just the kilocalorie number. */
export function estimateCaloriesKcal(input: CalorieInput): number {
  return estimateCalories(input).kcal;
}

/** Whole kilocalories for display and goal comparison. */
export function formatCalories(kcal: number): string {
  if (!Number.isFinite(kcal) || kcal <= 0) return '0';
  return String(Math.round(kcal));
}

/** Short label for where the number came from. */
export function calorieSourceLabel(source: CalorieSource): MessageKey {
  return source === 'heart' ? 'calorieSource.heart' : 'calorieSource.pace';
}
