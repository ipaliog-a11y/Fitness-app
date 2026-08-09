/**
 * Correcting a finished treadmill run from the machine's own console.
 *
 * A treadmill measures the belt. Nothing worn on the body does — a foot pod
 * infers distance from the swing of a shoe, and a pedometer infers it from a
 * phone bouncing in a pocket. So the console's figure outranks both, and the
 * gap between them is a free calibration for whichever instrument was used.
 *
 * This runs *after* the run is saved rather than during it, which is the honest
 * place for it: you cannot read the console's total until the belt stops. That
 * timing is the whole reason this module exists as a transform over a finished
 * `Activity` instead of a setter on the live session.
 */

import type { Activity } from './activity';
import { estimateCalories } from './calories';
import type { BiologicalSex } from './calories';
import { calibrateAgainst } from './footpod';
import { calibrateStride } from './steps';

/**
 * What the athlete typed, already converted to base units.
 *
 * Both fields are independently optional, and `null` means "leave this alone"
 * for distance but "clear it" for incline — the asymmetry is deliberate. A
 * blank distance box cannot mean "the run was zero metres", because that is
 * indistinguishable from not having bothered. A blank incline box genuinely
 * does mean "flat, or I no longer wish to claim otherwise".
 */
export interface ConsoleEntry {
  /** Console distance in metres, or null to keep the recorded distance. */
  distanceM: number | null;
  /** Whole-run average grade in percent, or null to clear it. */
  inclinePercent: number | null;
}

/**
 * What the entry taught the profile, if anything.
 *
 * Returned rather than applied because this module is pure and the profile
 * lives behind a React state setter. The caller decides whether to keep it.
 */
export type ConsoleCalibration =
  | {
      kind: 'footpod';
      /** Ready to store: the old factor already multiplied in. */
      footpodCalibration: number;
    }
  | {
      kind: 'stride';
      /** Metres per step. */
      strideM: number;
    };

/** The bits of the profile this transform reads. */
export interface ConsoleContext {
  footpodCalibration: number;
  weightKg: number;
  age: number;
  sex: BiologicalSex;
}

export interface ConsoleResult {
  /** The corrected record, or the original object when nothing changed. */
  activity: Activity;
  /** A profile patch worth saving, or null. */
  calibration: ConsoleCalibration | null;
  /** True when `activity` is a new object with different numbers in it. */
  changed: boolean;
}

/**
 * True when this activity's recorded distance is still an instrument's own
 * reading, and so can be compared against the console to calibrate it.
 *
 * The check is `distanceSource`, not "have we been here before", because the
 * override replaces `distanceM` in place. Once that has happened the pod's
 * original figure is gone, and calibrating against the typed number would
 * compare it with itself — a factor of 1 on a pod that is still wrong, written
 * over the correction that was right.
 *
 * The consequence is that only the *first* console entry teaches the profile.
 * A second correction still fixes the run, it just does not re-teach; both
 * dials are editable in Settings when a mistyped entry needs undoing. Letting
 * every edit recalibrate would be safe for stride, which is derived from a step
 * count that never changes, and quietly destructive for the pod — and one rule
 * that is always true beats two that differ by instrument.
 */
function canCalibrate(activity: Activity): boolean {
  return activity.distanceSource === 'sensor' || activity.distanceSource === 'steps';
}

function calibrationFrom(
  activity: Activity,
  actualM: number,
  ctx: ConsoleContext,
): ConsoleCalibration | null {
  if (!canCalibrate(activity)) return null;

  if (activity.distanceSource === 'sensor') {
    const factor = calibrateAgainst(activity.distanceM, actualM);
    if (factor === null) return null;
    // The pod's reading already had the old factor applied to it, so the new
    // one compounds rather than replaces.
    return { kind: 'footpod', footpodCalibration: ctx.footpodCalibration * factor };
  }

  const steps = activity.steps ?? 0;
  const strideM = calibrateStride(steps, actualM);
  if (strideM === null) return null;
  return { kind: 'stride', strideM };
}

/**
 * Apply a console reading to a finished treadmill run.
 *
 * Order matters and is the point of the function: calibration is computed from
 * the activity as it stands, and only then is the distance overwritten.
 */
export function applyConsoleEntry(
  activity: Activity,
  entry: ConsoleEntry,
  ctx: ConsoleContext,
): ConsoleResult {
  const unchanged: ConsoleResult = { activity, calibration: null, changed: false };

  // Outdoors the distance came from satellites and the ground supplies its own
  // grade, so there is nothing here for a console to correct.
  if (activity.mode !== 'treadmill') return unchanged;

  const typed =
    entry.distanceM !== null && Number.isFinite(entry.distanceM) && entry.distanceM > 0
      ? entry.distanceM
      : null;
  const incline =
    entry.inclinePercent !== null && Number.isFinite(entry.inclinePercent)
      ? entry.inclinePercent
      : null;

  const distanceM = typed ?? activity.distanceM;
  const distanceChanged = typed !== null && typed !== activity.distanceM;
  const inclineChanged = incline !== activity.inclinePercent;
  if (!distanceChanged && !inclineChanged) return unchanged;

  const calibration = typed !== null ? calibrationFrom(activity, typed, ctx) : null;

  const next: Activity = {
    ...activity,
    distanceM,
    // Only the distance's provenance moves. Typing an incline says nothing
    // about where the metres came from.
    distanceSource: typed !== null ? 'manual' : activity.distanceSource,
    inclinePercent: incline,
  };

  // Calories were frozen at finish from the distance and grade known then, and
  // both may have just moved. Left alone, a run corrected from 0.4 km to 6.2 km
  // would show the distance of one run and the calories of another.
  next.caloriesKcal = Math.round(
    estimateCalories({
      distanceM: next.distanceM,
      durationMs: next.durationMs,
      weightKg: ctx.weightKg,
      age: ctx.age,
      sex: ctx.sex,
      inclinePercent: next.inclinePercent,
      heart: next.heart,
    }).kcal,
  );

  return { activity: next, calibration, changed: true };
}
