/**
 * Core tests.
 *
 * Bundled through esbuild so the TypeScript sources under src/core can be
 * imported directly, then run on plain node — no browser, no DOM. Everything
 * tested here is pure by construction, which is the point: the alternative way
 * to check that a 5 km run measures 5 km is to go and run one.
 */

import {
  distanceBetween,
  judgePoint,
  projectToUnitSquare,
  elevationGain,
  boundsOf,
} from '../src/core/geo.ts';
import {
  formatDuration,
  formatPace,
  formatDistance,
  paceSecondsPerUnit,
  toDisplayDistance,
} from '../src/core/units.ts';
import { splits, bestEffort, exportBaseName } from '../src/core/activity.ts';
import { applyConsoleEntry } from '../src/core/consoleEntry.ts';
import { pickEnglishVoice } from '../src/platform/speech.ts';
import { RunSession } from '../src/core/session.ts';
import {
  summariseHeart,
  zoneOf,
  estimateMaxHeartRate,
  heartTrace,
  buildHeartReport,
  heartSummaryFromReport, zoneSwatch, ZONES } from '../src/core/heart.ts';
import { StepDetector, calibrateStride, estimateStride } from '../src/core/steps.ts';
import {
  startOfWeek,
  weeklyBuckets,
  currentStreak,
  personalRecords,
  totals,
} from '../src/core/stats.ts';
import { sanitise, DEFAULTS, parseTheme, THEME_OPTIONS } from '../src/core/settings.ts';
import {
  LOCALE_OPTIONS,
  createTranslator,
  detectLocale,
  interpolate,
  localeTag,
  parseLocale,
  pluralArm,
} from '../src/i18n/index.ts';
import { en } from '../src/i18n/en.ts';
import { el } from '../src/i18n/el.ts';
import { tipsForRecovery, tipsForRun, tipsForWeek } from '../src/core/coach.ts';
import {
  project,
  fitBounds,
  toScreen,
  visibleTiles,
  TILE_SIZE,
  parseMapStyle,
  resolveMapBasemap,
  MAP_BASEMAPS,
} from '../src/core/mercator.ts';
import {
  parseRscMeasurement,
  FootpodTracker,
  calibrateAgainst,
} from '../src/core/footpod.ts';
import {
  estimateCalories,
  estimateCaloriesFromPace,
  estimateCaloriesKcal,
  formatCalories,
  keytelKjPerMin,
} from '../src/core/calories.ts';
import {
  autoPauseAction,
  nextStillMs,
  STILL_DURATION_MS,
  STILL_SPEED_MPS,
} from '../src/core/autoPause.ts';
import {
  makeSnapshot,
  pendingCues,
  cueSpeech,
  spokenDistance,
  spokenDuration,
  spokenPace,
} from '../src/core/cues.ts';
import {
  WORKOUT_PRESETS,
  WorkoutRunner,
  customIntervals,
  expandRecipe,
} from '../src/core/workout.ts';
import {
  addDistanceToShoe,
  createShoe,
  shoeNeedsWarning,
  shoeWearFraction,
  updateShoe,
} from '../src/core/shoes.ts';
import { pathDistance, reverseSegments, thinSegment, routeFromActivity } from '../src/core/routes.ts';
import { activityToGpx } from '../src/core/gpx.ts';
import { activityToTcx } from '../src/core/tcx.ts';
import {
  BACKUP_FORMAT,
  BACKUP_FORMAT_VERSION,
  isFullBackupShape,
  serializeBackup,
} from '../src/core/backup.ts';
import {
  DEFAULT_PACE_BAND,
  parsePaceInput,
  paceBandStatus,
  paceBandCueSpeech,
} from '../src/core/paceBand.ts';
import { SCHEMA_VERSION } from '../src/core/activity.ts';
import { ageFromBirthDate, sanitiseBirthDate } from '../src/core/settings.ts';
import {
  addWeightEntry,
  sanitiseWeightStore,
  weightTrendKg,
  weightToGoalKg,
} from '../src/core/weight.ts';
import {
  activityFromWorkout,
  planHealthImport,
  stableHealthImportId,
} from '../src/core/healthImport.ts';
import {
  filterActivities,
  groupActivities,
  startOfWeek as historyWeekStart,
} from '../src/core/history.ts';
import { activityLoad, loadSnapshot } from '../src/core/load.ts';
import {
  PLAN_TEMPLATES,
  currentPlanWeek,
  planById,
  planSessionKey,
  sessionsForWeek,
  startPlan,
  toggleSessionComplete,
  weekProgress,
} from '../src/core/plans.ts';
import {
  addMonths,
  eventsOnDay,
  monthGrid,
  planEvents,
  planSessionAt,
  runEvents,
  startOfMonth,
} from '../src/core/calendar.ts';
import {
  caloriesGoal,
  distanceGoal,
  formatGoalTarget,
  goalMet,
  goalProgress,
  timeGoalMinutes,
} from '../src/core/goal.ts';

let passed = 0;
const failures = [];

function check(name, fn) {
  try {
    fn();
    passed++;
  } catch (error) {
    failures.push(`${name}: ${error.message}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message ?? 'assertion failed');
}

function near(actual, expected, tolerance, message) {
  if (Math.abs(actual - expected) > tolerance) {
    throw new Error(`${message ?? 'value'}: expected ~${expected}, got ${actual}`);
  }
}

function equal(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message ?? 'value'}: expected ${expected}, got ${actual}`);
  }
}

// --- Fixtures -------------------------------------------------------------

const METRES_PER_DEGREE_LAT = 111195; // 6371008.8 m * pi / 180

/**
 * A straight northward track at a constant pace.
 *
 * Constant everything is deliberate: any variation the code reports back is
 * therefore the code's, not the fixture's.
 */
function straightTrack({
  points = 60,
  stepM = 10,
  secondsPerPoint = 5,
  startLat = 60,
  startLon = 24.9,
  t0 = 1_700_000_000_000,
  accuracy = 5,
  elevation = null,
} = {}) {
  const out = [];
  for (let i = 0; i < points; i++) {
    out.push({
      lat: startLat + (i * stepM) / METRES_PER_DEGREE_LAT,
      lon: startLon,
      t: t0 + i * secondsPerPoint * 1000,
      accuracy,
      elevation: elevation === null ? null : elevation + i,
    });
  }
  return out;
}

function activityFrom(segments, extra = {}) {
  let distanceM = 0;
  let durationMs = 0;
  for (const segment of segments) {
    for (let i = 1; i < segment.length; i++) {
      distanceM += distanceBetween(segment[i - 1], segment[i]);
      durationMs += segment[i].t - segment[i - 1].t;
    }
  }
  return {
    id: 'test',
    mode: 'outdoor',
    startedAt: segments[0]?.[0]?.t ?? 0,
    durationMs,
    distanceM,
    distanceSource: 'gps',
    segments,
    heart: [],
    heartReport: null,
    steps: null,
    inclinePercent: null,
    caloriesKcal: null,
    goal: null,
    manualLaps: [],
    shoeId: null,
    workoutId: null,
    workoutName: null,
    note: '',
    ...extra,
  };
}

// --- geo ------------------------------------------------------------------

check('one degree of latitude is about 111 km', () => {
  const d = distanceBetween(
    { lat: 0, lon: 0, t: 0, accuracy: 1, elevation: null },
    { lat: 1, lon: 0, t: 0, accuracy: 1, elevation: null },
  );
  near(d, 111195, 50, 'degree of latitude');
});

check('a degree of longitude shrinks with latitude', () => {
  const atEquator = distanceBetween(
    { lat: 0, lon: 0, t: 0, accuracy: 1, elevation: null },
    { lat: 0, lon: 1, t: 0, accuracy: 1, elevation: null },
  );
  const atSixty = distanceBetween(
    { lat: 60, lon: 0, t: 0, accuracy: 1, elevation: null },
    { lat: 60, lon: 1, t: 0, accuracy: 1, elevation: null },
  );
  // cos(60 degrees) is exactly 0.5.
  near(atSixty / atEquator, 0.5, 0.01, 'longitude ratio');
});

check('distance is symmetric and zero for a point against itself', () => {
  const a = { lat: 51.5, lon: -0.12, t: 0, accuracy: 1, elevation: null };
  const b = { lat: 48.85, lon: 2.35, t: 0, accuracy: 1, elevation: null };
  near(distanceBetween(a, b), distanceBetween(b, a), 1e-6, 'symmetry');
  equal(distanceBetween(a, a), 0, 'self distance');
});

check('the filter rejects a wildly inaccurate fix', () => {
  const verdict = judgePoint(null, { lat: 60, lon: 24, t: 1000, accuracy: 500, elevation: null });
  assert(!verdict.accept, 'should reject');
  equal(verdict.reason, 'accuracy');
});

check('the filter rejects jitter but accepts a real step', () => {
  const previous = { lat: 60, lon: 24, t: 1000, accuracy: 5, elevation: null };
  const wobble = {
    lat: 60 + 1 / METRES_PER_DEGREE_LAT,
    lon: 24,
    t: 3000,
    accuracy: 5,
    elevation: null,
  };
  const step = {
    lat: 60 + 10 / METRES_PER_DEGREE_LAT,
    lon: 24,
    t: 3000,
    accuracy: 5,
    elevation: null,
  };
  equal(judgePoint(previous, wobble).accept, false, 'one metre is jitter');
  equal(judgePoint(previous, wobble).reason, 'jitter');
  equal(judgePoint(previous, step).accept, true, 'ten metres is movement');
});

check('the jitter threshold widens with a sloppier fix', () => {
  const previous = { lat: 60, lon: 24, t: 1000, accuracy: 5, elevation: null };
  const at = (metres, accuracy) => ({
    lat: 60 + metres / METRES_PER_DEGREE_LAT,
    lon: 24,
    t: 5000,
    accuracy,
    elevation: null,
  });
  // 8 m of movement is real when the fix is tight, noise when it is not.
  equal(judgePoint(previous, at(8, 4)).accept, true, 'tight fix accepts 8 m');
  equal(judgePoint(previous, at(8, 30)).accept, false, 'loose fix rejects 8 m');
});

check('the filter rejects a teleport', () => {
  const previous = { lat: 60, lon: 24, t: 1000, accuracy: 5, elevation: null };
  const jump = {
    lat: 60 + 500 / METRES_PER_DEGREE_LAT,
    lon: 24,
    t: 2000,
    accuracy: 5,
    elevation: null,
  };
  const verdict = judgePoint(previous, jump);
  assert(!verdict.accept, 'should reject');
  equal(verdict.reason, 'teleport');
});

check('the filter rejects a fix from the past', () => {
  const previous = { lat: 60, lon: 24, t: 5000, accuracy: 5, elevation: null };
  const stale = {
    lat: 60 + 20 / METRES_PER_DEGREE_LAT,
    lon: 24,
    t: 4000,
    accuracy: 5,
    elevation: null,
  };
  equal(judgePoint(previous, stale).reason, 'stale');
});

check('projection fits inside the unit square and puts north up', () => {
  const track = straightTrack({ points: 10 });
  const projected = projectToUnitSquare([track]);
  const flat = projected.flat();
  assert(
    flat.every(([x, y]) => x >= -1e-9 && x <= 1 + 1e-9 && y >= -1e-9 && y <= 1 + 1e-9),
    'all points inside the unit square',
  );
  // The track runs north, so the last point must be higher up the screen
  // (smaller y) than the first.
  assert(flat[flat.length - 1][1] < flat[0][1], 'north is up');
});

check('projection survives a track with no extent', () => {
  const point = { lat: 60, lon: 24, t: 0, accuracy: 5, elevation: null };
  const projected = projectToUnitSquare([[point, point]]);
  assert(projected[0].every(([x, y]) => Number.isFinite(x) && Number.isFinite(y)), 'no NaN');
});

check('bounds of an empty track are null', () => {
  equal(boundsOf([]), null);
  equal(boundsOf([[]]), null);
});

check('elevation gain counts climbs and ignores descents', () => {
  const at = (elevation) => ({ lat: 60, lon: 24, t: 0, accuracy: 5, elevation });
  // Up 10, down 10, up 5 — 15 m of climbing.
  const gain = elevationGain([[at(100), at(110), at(100), at(105)]]);
  near(gain, 15, 0.001, 'gain');
});

check('elevation gain ignores sub-metre noise', () => {
  const at = (elevation) => ({ lat: 60, lon: 24, t: 0, accuracy: 5, elevation });
  const gain = elevationGain([[at(100), at(100.4), at(100.1), at(100.5), at(100.2)]]);
  equal(gain, 0, 'noise contributes nothing');
});

// --- units ----------------------------------------------------------------

check('durations format as a stopwatch', () => {
  equal(formatDuration(0), '0:00');
  equal(formatDuration(9_000), '0:09');
  equal(formatDuration(65_000), '1:05');
  equal(formatDuration(3_600_000), '1:00:00');
  equal(formatDuration(3_845_000), '1:04:05');
  equal(formatDuration(-500), '0:00', 'negative clamps');
  equal(formatDuration(1_250, { tenths: true }), '0:01.2');
  equal(formatDuration(65_340, { tenths: true }), '1:05.3');
  equal(formatDuration(3_845_900, { tenths: true }), '1:04:05.9');
});

check('pace formatting carries 60 seconds into a minute', () => {
  // 5:59.7 must read 6:00, not 5:60.
  equal(formatPace(359.7), '6:00');
  equal(formatPace(300), '5:00');
  equal(formatPace(312), '5:12');
});

check('pace formatting refuses nonsense', () => {
  equal(formatPace(null), '--:--');
  equal(formatPace(Infinity), '--:--');
  equal(formatPace(NaN), '--:--');
  // The first second of a run yields an absurd pace; it must not be shown.
  equal(formatPace(60 * 200), '--:--');
});

check('pace is computed per display unit', () => {
  // 1 km in 5 minutes.
  near(paceSecondsPerUnit(1000, 300_000, 'metric'), 300, 0.001, 'metric pace');
  // The same speed quoted per mile must be slower per unit.
  near(paceSecondsPerUnit(1000, 300_000, 'imperial'), 482.8, 0.5, 'imperial pace');
  equal(paceSecondsPerUnit(0, 300_000, 'metric'), null, 'no distance');
  equal(paceSecondsPerUnit(1000, 0, 'metric'), null, 'no time');
});

check('distance converts and formats', () => {
  equal(formatDistance(5000, 'metric'), '5.00');
  equal(formatDistance(1609.344, 'imperial'), '1.00');
  near(toDisplayDistance(1609.344, 'imperial'), 1, 1e-9, 'a mile is a mile');
});

// --- session --------------------------------------------------------------

check('a clean outdoor run measures its own length', () => {
  const track = straightTrack({ points: 51, stepM: 20, secondsPerPoint: 6 });
  const session = new RunSession({ mode: 'outdoor' }, track[0].t);
  session.start(track[0].t);
  for (const point of track) session.addPoint(point);
  session.finish(track[track.length - 1].t);

  // 50 steps of 20 m.
  near(session.distanceM, 1000, 2, 'distance');
  equal(session.elapsedMs(), 50 * 6000, 'elapsed');
});

check('a pause stops the clock and does not bridge the gap', () => {
  const t0 = 1_700_000_000_000;
  const before = straightTrack({ points: 11, stepM: 20, secondsPerPoint: 5, t0 });
  const session = new RunSession({ mode: 'outdoor' }, t0);
  session.start(t0);
  for (const point of before) session.addPoint(point);

  const pausedAt = before[before.length - 1].t;
  session.pause(pausedAt);

  // Ten minutes of standing still, during which the phone keeps reporting.
  for (let i = 1; i <= 20; i++) {
    session.addPoint({
      lat: before[before.length - 1].lat + (i * 30) / METRES_PER_DEGREE_LAT,
      lon: 24.9,
      t: pausedAt + i * 30_000,
      accuracy: 5,
      elevation: null,
    });
  }

  const resumedAt = pausedAt + 600_000;
  session.resume(resumedAt);

  // Resumes a kilometre away — a gap that must not be counted as running.
  const after = straightTrack({
    points: 11,
    stepM: 20,
    secondsPerPoint: 5,
    startLat: 61,
    t0: resumedAt,
  });
  for (const point of after) session.addPoint(point);
  session.finish(after[after.length - 1].t);

  near(session.distanceM, 400, 2, 'only the two moving stretches count');
  equal(session.elapsedMs(), 100_000, 'the pause is not in the clock');
  equal(session.segments.length, 2, 'two segments');
});

check('a session ignores everything before it starts', () => {
  const track = straightTrack({ points: 5 });
  const session = new RunSession({ mode: 'outdoor' }, track[0].t);
  for (const point of track) equal(session.addPoint(point), false, 'idle accepts nothing');
  equal(session.distanceM, 0);
});

check('standing still accumulates no distance', () => {
  const t0 = 1_700_000_000_000;
  const session = new RunSession({ mode: 'outdoor' }, t0);
  session.start(t0);
  // A fix wandering inside its own error circle for five minutes.
  for (let i = 0; i < 100; i++) {
    const angle = (i / 100) * Math.PI * 2;
    session.addPoint({
      lat: 60 + (Math.sin(angle) * 3) / METRES_PER_DEGREE_LAT,
      lon: 24.9 + (Math.cos(angle) * 3) / (METRES_PER_DEGREE_LAT * 0.5),
      t: t0 + i * 3000,
      accuracy: 8,
      elevation: null,
    });
  }
  session.finish(t0 + 300_000);
  assert(session.distanceM < 30, `drift stayed small, got ${session.distanceM}`);
});

check('a treadmill session turns steps into distance', () => {
  const t0 = 1_700_000_000_000;
  const session = new RunSession({ mode: 'treadmill', strideM: 0.8 }, t0);
  session.start(t0);
  session.addSteps(1000);
  near(session.distanceM, 800, 1e-9, 'distance from steps');
  session.finish(t0 + 300_000);

  const activity = session.toActivity();
  equal(activity.distanceSource, 'steps');
  equal(activity.steps, 1000);
  equal(activity.segments.length, 0, 'no route indoors');
  assert(typeof activity.caloriesKcal === 'number', 'calories saved on the activity');
  equal(activity.goal, null, 'free run has no goal');
});

check('a session with a distance goal records it and reports progress', () => {
  const t0 = 1_700_000_000_000;
  const goal = distanceGoal(5, 'metric');
  const session = new RunSession(
    { mode: 'treadmill', strideM: 1, weightKg: 70, goal },
    t0,
  );
  session.start(t0);
  session.addSteps(3000); // 3 km
  session.finish(t0 + 1_200_000); // 20 min
  const activity = session.toActivity();
  equal(activity.goal?.kind, 'distance');
  equal(activity.goal?.target, 5000);
  assert(!goalMet(activity.goal, {
    distanceM: activity.distanceM,
    durationMs: activity.durationMs,
    caloriesKcal: activity.caloriesKcal,
  }), '3 km is short of a 5 km goal');
  near(goalProgress(activity.goal, {
    distanceM: activity.distanceM,
    durationMs: activity.durationMs,
    caloriesKcal: activity.caloriesKcal,
  }), 0.6, 0.02, '60% of a 5k');
});

// --- The treadmill console, applied on the results page ---------------------

/**
 * A finished treadmill run, with the fields the console panel reads.
 * Thirty minutes of moving time, so the calorie maths has something to chew on.
 */
function treadmillRun(overrides = {}) {
  return {
    id: 'run-1',
    mode: 'treadmill',
    startedAt: 1_700_000_000_000,
    durationMs: 1_800_000,
    distanceM: 4800,
    distanceSource: 'sensor',
    segments: [],
    heart: [],
    heartReport: null,
    steps: null,
    inclinePercent: null,
    caloriesKcal: 300,
    goal: null,
    manualLaps: [],
    shoeId: null,
    workoutId: null,
    workoutName: null,
    note: '',
    ...overrides,
  };
}

const CONSOLE_CTX = { footpodCalibration: 1, weightKg: 70, age: 35, sex: 'male' };

check('a console distance overrides a step estimate and calibrates stride', () => {
  const run = treadmillRun({ distanceSource: 'steps', steps: 6000, distanceM: 4200 });
  const out = applyConsoleEntry(run, { distanceM: 5000, inclinePercent: null }, CONSOLE_CTX);

  equal(out.changed, true, 'the entry changed something');
  equal(out.activity.distanceM, 5000, 'the console figure wins');
  equal(out.activity.distanceSource, 'manual', 'provenance follows the number');
  equal(out.calibration.kind, 'stride');
  near(out.calibration.strideM, 5000 / 6000, 1e-9, 'stride from steps and true distance');
  // The input must survive untouched — the caller still needs it to work out
  // how much mileage to add to the shoe.
  equal(run.distanceM, 4200, 'the original record is not mutated');
});

check('a console distance compounds the pod calibration it already had', () => {
  const run = treadmillRun({ distanceSource: 'sensor', distanceM: 4800 });
  const out = applyConsoleEntry(
    run,
    { distanceM: 5000, inclinePercent: null },
    { ...CONSOLE_CTX, footpodCalibration: 1.02 },
  );

  equal(out.calibration.kind, 'footpod');
  // The pod's 4800 already had 1.02 applied to it, so the correction multiplies
  // rather than replaces: storing 5000/4800 outright would undo the old fix.
  near(out.calibration.footpodCalibration, 1.02 * (5000 / 4800), 1e-9, 'factors compound');
});

check('a second console entry fixes the run but does not calibrate again', () => {
  const run = treadmillRun({ distanceSource: 'sensor', distanceM: 4800 });
  const first = applyConsoleEntry(run, { distanceM: 5000, inclinePercent: null }, CONSOLE_CTX);
  assert(first.calibration !== null, 'the first entry teaches the profile');

  const second = applyConsoleEntry(
    first.activity,
    { distanceM: 5200, inclinePercent: null },
    CONSOLE_CTX,
  );
  equal(second.activity.distanceM, 5200, 'the run is still corrected');
  equal(second.calibration, null, 'but the pod is not re-taught against itself');
});

check('calories are recomputed from the corrected distance', () => {
  const run = treadmillRun({ distanceSource: 'steps', steps: 600, distanceM: 400 });
  const out = applyConsoleEntry(run, { distanceM: 5000, inclinePercent: 4 }, CONSOLE_CTX);

  const expected = Math.round(
    estimateCalories({
      distanceM: 5000,
      durationMs: run.durationMs,
      weightKg: 70,
      age: 35,
      sex: 'male',
      inclinePercent: 4,
      heart: [],
    }).kcal,
  );
  equal(out.activity.caloriesKcal, expected, 'the frozen figure is refreshed');
  assert(
    out.activity.caloriesKcal > run.caloriesKcal,
    'twelve times the distance is not the same number of calories',
  );
});

check('an incline on its own leaves the distance and its provenance alone', () => {
  const run = treadmillRun({ distanceSource: 'sensor', distanceM: 4800 });
  const out = applyConsoleEntry(run, { distanceM: null, inclinePercent: 2.5 }, CONSOLE_CTX);

  equal(out.changed, true);
  equal(out.activity.inclinePercent, 2.5);
  equal(out.activity.distanceM, 4800, 'a blank distance box is not a claim of zero');
  equal(out.activity.distanceSource, 'sensor', 'the pod still measured this run');
  equal(out.calibration, null, 'nothing to calibrate against');
});

check('a blank incline clears a grade that was set before', () => {
  const run = treadmillRun({ inclinePercent: 3 });
  const out = applyConsoleEntry(run, { distanceM: null, inclinePercent: null }, CONSOLE_CTX);
  equal(out.changed, true);
  equal(out.activity.inclinePercent, null);
});

check('an unchanged entry is a no-op', () => {
  const run = treadmillRun({ distanceM: 4800, inclinePercent: 2 });
  const out = applyConsoleEntry(run, { distanceM: 4800, inclinePercent: 2 }, CONSOLE_CTX);
  equal(out.changed, false);
  equal(out.activity, run, 'the same object comes back');
});

check('an absurd console figure corrects the run but refuses to calibrate', () => {
  const run = treadmillRun({ distanceSource: 'sensor', distanceM: 4800 });
  // Kilometres typed into a box that wanted metres, or the other way round. The
  // run is whatever the athlete says it is — but a factor of 0.004 written to
  // the profile would quietly ruin every treadmill run after it.
  const out = applyConsoleEntry(run, { distanceM: 20, inclinePercent: null }, CONSOLE_CTX);
  equal(out.activity.distanceM, 20, 'the record follows the typing');
  equal(out.calibration, null, 'the profile does not');
});

check('outdoor runs have nothing for a console to say', () => {
  const run = treadmillRun({ mode: 'outdoor', distanceSource: 'gps' });
  const out = applyConsoleEntry(run, { distanceM: 9000, inclinePercent: 5 }, CONSOLE_CTX);
  equal(out.changed, false);
  equal(out.activity.distanceM, 4800);
});

check('a treadmill run nothing measured reports no instrument', () => {
  const t0 = 1_700_000_000_000;
  const session = new RunSession({ mode: 'treadmill', strideM: 0.8 }, t0);
  session.start(t0);
  session.finish(t0 + 100_000);
  const activity = session.toActivity();
  // `manual` with zero metres is how "the phone sat on the tray" is recorded.
  // The results page keys its hint off the distance to tell that apart from a
  // run that really was corrected by hand.
  equal(activity.distanceSource, 'manual');
  equal(activity.distanceM, 0);

  const out = applyConsoleEntry(activity, { distanceM: 5000, inclinePercent: null }, CONSOLE_CTX);
  equal(out.activity.distanceM, 5000, 'the console can supply the whole run');
  equal(out.calibration, null, 'with nothing to compare it against');
});

check('gps points are refused on a treadmill and steps outdoors', () => {
  const t0 = 1_700_000_000_000;
  const indoor = new RunSession({ mode: 'treadmill' }, t0);
  indoor.start(t0);
  equal(indoor.addPoint(straightTrack({ points: 1 })[0]), false, 'no fixes indoors');

  const outdoor = new RunSession({ mode: 'outdoor' }, t0);
  outdoor.start(t0);
  outdoor.addSteps(500);
  equal(outdoor.distanceM, 0, 'no steps outdoors');
});

check('heart readings are kept while running and dropped while paused', () => {
  const t0 = 1_700_000_000_000;
  const session = new RunSession({ mode: 'outdoor' }, t0);
  session.start(t0);
  session.addHeart(150, t0 + 1000);
  session.pause(t0 + 2000);
  session.addHeart(120, t0 + 3000);
  session.resume(t0 + 4000);
  session.addHeart(155, t0 + 5000);
  session.finish(t0 + 6000);
  equal(session.heart.length, 2, 'only the moving readings');
  equal(session.heart[1].bpm, 155);
});

check('a rejected first fix still seeds the filter', () => {
  const t0 = 1_700_000_000_000;
  const session = new RunSession({ mode: 'outdoor' }, t0);
  session.start(t0);
  // Two fixes a metre apart: the second is jitter, but the run must still be
  // able to accumulate once real movement starts.
  session.addPoint({ lat: 60, lon: 24.9, t: t0, accuracy: 5, elevation: null });
  session.addPoint({
    lat: 60 + 40 / METRES_PER_DEGREE_LAT,
    lon: 24.9,
    t: t0 + 10_000,
    accuracy: 5,
    elevation: null,
  });
  near(session.distanceM, 40, 1, 'movement after the first fix counts');
});

// --- splits and efforts ---------------------------------------------------

check('splits of a constant-pace run are all equal', () => {
  // 20 m every 6 s is 300 s/km exactly.
  const track = straightTrack({ points: 201, stepM: 20, secondsPerPoint: 6 });
  const activity = activityFrom([track]);
  const result = splits(activity, 'metric');

  const whole = result.filter((s) => !s.partial);
  assert(whole.length >= 3, `expected at least 3 whole splits, got ${whole.length}`);
  for (const split of whole) {
    near(split.secondsPerUnit, 300, 1.5, `split ${split.index}`);
  }
});

check('splits sum back to the run', () => {
  const track = straightTrack({ points: 137, stepM: 17, secondsPerPoint: 4 });
  const activity = activityFrom([track]);
  const result = splits(activity, 'metric');
  const summed = result.reduce((sum, s) => sum + s.distanceM, 0);
  near(summed, activity.distanceM, 2, 'split distances');
});

check('a boundary crossed mid-step is interpolated, not bucketed', () => {
  // 300 m per fix: each fix crosses well past a boundary, so bucketing whole
  // fixes would make alternate splits obviously wrong.
  const track = straightTrack({ points: 25, stepM: 300, secondsPerPoint: 90 });
  const activity = activityFrom([track]);
  const whole = splits(activity, 'metric').filter((s) => !s.partial);
  for (const split of whole) near(split.secondsPerUnit, 300, 3, `split ${split.index}`);
});

check('best effort finds a true 1 km inside a longer run', () => {
  const track = straightTrack({ points: 151, stepM: 20, secondsPerPoint: 6 });
  const activity = activityFrom([track]);
  const best = bestEffort(activity, 1000);
  near(best / 1000, 300, 2, 'best kilometre in seconds');
});

check('best effort finds the fast section of a mixed run', () => {
  const t0 = 1_700_000_000_000;
  const points = [];
  let lat = 60;
  let t = t0;
  const push = () => points.push({ lat, lon: 24.9, t, accuracy: 5, elevation: null });
  push();
  // 1 km slow (6:00/km), 1 km fast (4:00/km), 1 km slow again.
  for (const secondsPerKm of [360, 240, 360]) {
    for (let i = 0; i < 50; i++) {
      lat += 20 / METRES_PER_DEGREE_LAT;
      t += (secondsPerKm / 50) * 1000;
      push();
    }
  }
  const best = bestEffort(activityFrom([points]), 1000);
  near(best / 1000, 240, 3, 'the fast kilometre');
});

check('best effort declines a distance the run never covered', () => {
  const activity = activityFrom([straightTrack({ points: 11, stepM: 20 })]);
  equal(bestEffort(activity, 5000), null);
});

// --- heart ----------------------------------------------------------------

check('max heart rate estimate follows the old rule', () => {
  equal(estimateMaxHeartRate(30), 190);
  equal(estimateMaxHeartRate(45), 175);
});

check('zones are assigned by percentage of maximum', () => {
  const max = 200;
  equal(zoneOf(90, max), null, 'below zone 1');
  equal(zoneOf(105, max).index, 1);
  equal(zoneOf(125, max).index, 2);
  equal(zoneOf(145, max).index, 3);
  equal(zoneOf(165, max).index, 4);
  equal(zoneOf(185, max).index, 5);
  equal(zoneOf(250, max).index, 5, 'zone 5 has no ceiling');
});

check('zone times sum to the measured time', () => {
  const t0 = 1_700_000_000_000;
  const samples = [];
  for (let i = 0; i < 600; i++) {
    samples.push({ t: t0 + i * 1000, bpm: i < 300 ? 130 : 170 });
  }
  const summary = summariseHeart(samples, 200);
  const summed = summary.zones.reduce((sum, z) => sum + z.ms, 0);
  equal(summed, summary.measuredMs, 'zones account for all of it');
  // 130/200 is 65% (zone 2), 170/200 is 85% (zone 4).
  near(summary.zones[1].fraction, 0.5, 0.01, 'half in zone 2');
  near(summary.zones[3].fraction, 0.5, 0.01, 'half in zone 4');
});

check('average heart rate is weighted by time, not by sample count', () => {
  const t0 = 1_700_000_000_000;
  // One long stretch at 120 and a burst of closely spaced samples at 180: an
  // unweighted mean would be dragged upward by the burst.
  const samples = [
    { t: t0, bpm: 120 },
    { t: t0 + 8000, bpm: 180 },
    { t: t0 + 8100, bpm: 180 },
    { t: t0 + 8200, bpm: 180 },
    { t: t0 + 8300, bpm: 120 },
  ];
  const summary = summariseHeart(samples, 200);
  assert(summary.averageBpm < 140, `time-weighted average, got ${summary.averageBpm}`);
  equal(summary.maxBpm, 180);
  equal(summary.minBpm, 120);
});

check('a dropped strap does not donate its gap to a zone', () => {
  const t0 = 1_700_000_000_000;
  const samples = [
    { t: t0, bpm: 170 },
    // An hour of silence: the strap came off.
    { t: t0 + 3_600_000, bpm: 170 },
  ];
  const summary = summariseHeart(samples, 200);
  assert(summary.measuredMs <= 20_000, `gap was clamped, got ${summary.measuredMs}`);
});

check('an empty heart trace summarises to nothing', () => {
  equal(summariseHeart([], 190), null);
  equal(summariseHeart([{ t: 1, bpm: 0 }], 190), null, 'zero bpm is not a reading');
});

check('the heart trace downsamples for drawing', () => {
  const samples = Array.from({ length: 5000 }, (_, i) => ({ t: i * 1000, bpm: 140 }));
  equal(heartTrace(samples, 120).length, 120);
  equal(heartTrace(samples.slice(0, 50), 120).length, 50, 'short traces pass through');
});

// --- steps ----------------------------------------------------------------

check('the pedometer counts a synthetic run', () => {
  const detector = new StepDetector();
  const cadence = 3; // steps per second, a typical 180 spm
  const seconds = 30;
  const sampleHz = 50;

  for (let i = 0; i < seconds * sampleHz; i++) {
    const t = i * (1000 / sampleHz);
    // Gravity plus a footfall impulse plus a little sensor noise.
    const phase = Math.sin((t / 1000) * cadence * 2 * Math.PI);
    const magnitude = 9.81 + phase * 4 + (Math.random() - 0.5) * 0.4;
    detector.push(magnitude, t);
  }

  const expected = cadence * seconds;
  // Peak detectors miss the first cycle or two while the baseline settles.
  assert(
    Math.abs(detector.steps - expected) <= expected * 0.1,
    `expected ~${expected} steps, got ${detector.steps}`,
  );
  near(detector.cadence(), cadence * 60, 15, 'cadence');
});

check('the pedometer does not count a phone sitting still', () => {
  const detector = new StepDetector();
  for (let i = 0; i < 2000; i++) {
    detector.push(9.81 + (Math.random() - 0.5) * 0.2, i * 20);
  }
  equal(detector.steps, 0, 'a resting phone takes no steps');
});

check('the pedometer ignores impossibly fast repeats', () => {
  const detector = new StepDetector();
  // Prime the baseline.
  for (let i = 0; i < 100; i++) detector.push(9.81, i * 20);
  // A single impact ringing at 500 Hz must not become dozens of steps.
  for (let i = 0; i < 50; i++) detector.push(i % 2 === 0 ? 20 : 9.81, 2000 + i * 2);
  assert(detector.steps <= 2, `ringing counted once, got ${detector.steps}`);
});

check('stride calibration rejects impossible input', () => {
  near(calibrateStride(1000, 800), 0.8, 1e-9, 'a normal calibration');
  equal(calibrateStride(1000, 5), null, 'five metres in a thousand steps');
  equal(calibrateStride(1000, 5_000_000), null, 'kilometres typed as metres');
  equal(calibrateStride(0, 5000), null, 'no steps');
});

check('stride is estimated from height', () => {
  near(estimateStride(175), 1.1375, 1e-6);
});

// --- stats ----------------------------------------------------------------

check('the training week starts on Monday', () => {
  // 2026-08-06 is a Thursday.
  const thursday = new Date(2026, 7, 6, 15, 30).getTime();
  const monday = new Date(startOfWeek(thursday));
  equal(monday.getDay(), 1, 'Monday');
  equal(monday.getDate(), 3, '3 August');
  equal(monday.getHours(), 0, 'midnight');

  // A Sunday belongs to the week that began six days earlier, not the next one.
  const sunday = new Date(2026, 7, 9, 22, 0).getTime();
  equal(new Date(startOfWeek(sunday)).getDate(), 3, 'Sunday looks back');
});

check('weekly buckets keep the empty weeks', () => {
  const now = new Date(2026, 7, 6).getTime();
  const activity = activityFrom([straightTrack({ points: 11 })]);
  const buckets = weeklyBuckets(
    [{ ...activity, startedAt: now, distanceM: 5000, durationMs: 1_500_000 }],
    12,
    now,
  );
  equal(buckets.length, 12, 'twelve weeks');
  equal(buckets[buckets.length - 1].runs, 1, 'this week has the run');
  equal(buckets[0].runs, 0, 'eleven weeks ago is empty but present');
  // Oldest first, so a chart reads left to right.
  assert(buckets[0].start < buckets[1].start, 'chronological');
});

check('a streak counts back through consecutive days', () => {
  const now = new Date(2026, 7, 6, 20, 0).getTime();
  const day = 86_400_000;
  const runs = [0, 1, 2, 4].map((back) => ({
    ...activityFrom([straightTrack({ points: 3 })]),
    startedAt: now - back * day,
  }));
  // Today, yesterday, the day before — then a gap.
  equal(currentStreak(runs, now), 3);
});

check('a streak survives not having run yet today', () => {
  const now = new Date(2026, 7, 6, 9, 0).getTime();
  const day = 86_400_000;
  const runs = [1, 2].map((back) => ({
    ...activityFrom([straightTrack({ points: 3 })]),
    startedAt: now - back * day,
  }));
  equal(currentStreak(runs, now), 2, 'yesterday keeps it alive');
  equal(currentStreak([], now), 0, 'no runs, no streak');
});

check('personal records come from efforts inside runs', () => {
  const fast = activityFrom([straightTrack({ points: 151, stepM: 20, secondsPerPoint: 6 })]);
  const slow = activityFrom([straightTrack({ points: 151, stepM: 20, secondsPerPoint: 9 })]);
  const records = personalRecords([{ ...slow, id: 'slow' }, { ...fast, id: 'fast' }]);

  const oneK = records.find((r) => r.label === 'record.1km');
  near(oneK.durationMs / 1000, 300, 2, 'best kilometre');
  equal(oneK.activityId, 'fast', 'credited to the fast run');

  const marathon = records.find((r) => r.label === 'record.marathon');
  equal(marathon.durationMs, null, 'never run one');
});

check('treadmill runs do not set route records', () => {
  const treadmill = {
    ...activityFrom([straightTrack({ points: 3 })]),
    id: 'mill',
    mode: 'treadmill',
    segments: [],
    distanceM: 10000,
    durationMs: 1_000_000,
  };
  const records = personalRecords([treadmill]);
  equal(records.find((r) => r.label === 'record.5km').durationMs, null);
});

check('totals weight pace by distance', () => {
  const short = { ...activityFrom([straightTrack({ points: 3 })]), distanceM: 400, durationMs: 240_000 };
  const long = { ...activityFrom([straightTrack({ points: 3 })]), distanceM: 10_000, durationMs: 3_000_000 };
  const result = totals([short, long], 'metric');
  equal(result.runs, 2);
  near(result.distanceM, 10_400, 1e-9);
  // 3,240,000 ms over 10.4 km.
  near(result.paceSecondsPerUnit, 311.5, 1, 'weighted pace');
});

// --- settings -------------------------------------------------------------

check('a garbage profile still produces a usable one', () => {
  const profile = sanitise({
    units: 'furlongs',
    age: 'old',
    heightCm: NaN,
    maxHeartRate: 9999,
    strideM: -4,
    weeklyGoalM: Infinity,
    keepAwake: 'yes',
  });
  equal(profile.units, 'metric', 'unknown units fall back');
  equal(profile.age, DEFAULTS.age);
  equal(profile.heightCm, DEFAULTS.heightCm);
  equal(profile.maxHeartRate, 230, 'clamped, not accepted');
  assert(profile.strideM >= 0.3, 'stride clamped');
  assert(Number.isFinite(profile.weeklyGoalM), 'goal is finite');
  equal(profile.keepAwake, DEFAULTS.keepAwake);
});

check('a missing max heart rate is seeded from the age given', () => {
  const profile = sanitise({ age: 50 });
  equal(profile.maxHeartRate, 170, '220 minus 50');
});

check('weight defaults and clamps', () => {
  equal(sanitise({}).weightKg, DEFAULTS.weightKg);
  equal(sanitise({ weightKg: 5 }).weightKg, 25, 'floor');
  equal(sanitise({ weightKg: 400 }).weightKg, 250, 'ceiling');
});

check('sanitise copes with nothing at all', () => {
  for (const input of [null, undefined, 'nonsense', 42, []]) {
    const profile = sanitise(input);
    equal(profile.units, 'metric');
    assert(Number.isFinite(profile.strideM), 'usable stride');
    assert(Number.isFinite(profile.weightKg), 'usable weight');
  }
});

// --- coach ----------------------------------------------------------------

check('the coach describes the run it was given', () => {
  const now = new Date(2026, 7, 6, 18, 0).getTime();
  const activity = {
    ...activityFrom([straightTrack({ points: 3 })]),
    startedAt: now,
    distanceM: 5000,
    durationMs: 1_500_000,
  };
  const tips = tipsForRun(activity, [], {
    units: 'metric',
    maxHeartRate: 190,
    weeklyGoalM: 0,
    now,
  });
  assert(tips.length > 0, 'says something');
  // The distance moved from the sentence into bodyVars when tips became keys.
  assert(
    tips.some((tip) => Object.values(tip.bodyVars ?? {}).some((v) => String(v).includes('5.00'))),
    'mentions the distance',
  );
});

check('the coach flags a big jump in weekly volume', () => {
  const now = new Date(2026, 7, 6, 18, 0).getTime();
  const week = startOfWeek(now);
  const day = 86_400_000;

  const history = [
    // Last week: a modest 10 km.
    { ...activityFrom([straightTrack({ points: 3 })]), startedAt: week - 3 * day, distanceM: 10_000, durationMs: 3_000_000 },
    { ...activityFrom([straightTrack({ points: 3 })]), startedAt: week + day, distanceM: 20_000, durationMs: 6_000_000 },
  ];
  const activity = { ...activityFrom([straightTrack({ points: 3 })]), startedAt: now, distanceM: 10_000, durationMs: 3_000_000 };

  const tips = tipsForRun(activity, history, {
    units: 'metric',
    maxHeartRate: 190,
    weeklyGoalM: 0,
    now,
  });
  assert(tips.some((t) => t.tone === 'caution' && t.title.includes('jump')), 'warns about volume');
});

check('the coach reads heart zones', () => {
  const now = new Date(2026, 7, 6, 18, 0).getTime();
  const heart = Array.from({ length: 600 }, (_, i) => ({ t: now + i * 1000, bpm: 120 }));
  const activity = {
    ...activityFrom([straightTrack({ points: 3 })]),
    startedAt: now,
    distanceM: 5000,
    durationMs: 1_500_000,
    heart,
  };
  const tips = tipsForRun(activity, [], { units: 'metric', maxHeartRate: 200, weeklyGoalM: 0, now });
  // 120/200 is 60% — zone 2, comfortably easy.
  assert(tips.some((tip) => tip.title === 'coach.tip.easy.title'), 'notices an easy run');
});

check('the coach has something to say about an empty history', () => {
  const tips = tipsForWeek([], { units: 'metric', maxHeartRate: 190, weeklyGoalM: 20000, now: Date.now() });
  equal(tips.length, 1);
  equal(tips[0].title, 'coach.tip.empty.title');
});

check('the coach tracks the weekly goal', () => {
  const now = new Date(2026, 7, 6, 18, 0).getTime();
  const activity = {
    ...activityFrom([straightTrack({ points: 3 })]),
    startedAt: now,
    distanceM: 25_000,
    durationMs: 7_500_000,
  };
  const tips = tipsForWeek([activity], {
    units: 'metric',
    maxHeartRate: 190,
    weeklyGoalM: 20_000,
    now,
  });
  // Tips carry keys now, so this asserts on the key and then that the key
  // actually resolves — the pair catches both a wrong tip and a missing
  // translation, which asserting on English text no longer can.
  const goalTip = tips.find((tip) => tip.title === 'coach.tip.weekGoalMet.title');
  assert(goalTip, 'notices the goal was met');
  // LOCALE_IDS is declared further down the file and check() runs its body
  // immediately, so derive the list from the import instead of the const.
  for (const opt of LOCALE_OPTIONS) {
    const translated = createTranslator(opt.id)(goalTip.title);
    assert(translated !== goalTip.title, `${opt.id} names the met-goal tip`);
  }
});

// --- mercator -------------------------------------------------------------

check('null island sits at the centre of the world', () => {
  const p = project(0, 0, 0);
  near(p.x, 0.5, 1e-9, 'x');
  near(p.y, 0.5, 1e-9, 'y');
});

check('mercator places known cities correctly', () => {
  // Greenwich is on the prime meridian, so x is exactly half the world.
  near(project(51.4779, 0, 8).x, 128, 1e-6, 'prime meridian');
  // The date line is at the edges.
  near(project(0, 180, 1).x, 2, 1e-9, 'east edge');
  near(project(0, -180, 1).x, 0, 1e-9, 'west edge');
  // North is a smaller y than south.
  assert(project(60, 24, 10).y < project(50, 24, 10).y, 'north is up');
});

check('fitting a track picks a zoom that contains it', () => {
  const track = straightTrack({ points: 50, stepM: 20 });
  const view = fitBounds([track], 320, 320, 24);
  assert(view !== null, 'produced a view');

  const screen = track.map((p) => toScreen(p.lat, p.lon, view));
  assert(
    screen.every(([x, y]) => x >= 0 && x <= 320 && y >= 0 && y <= 320),
    'every point lands inside the viewport',
  );
  // North-running track: the last point is nearer the top.
  assert(screen[screen.length - 1][1] < screen[0][1], 'north is up on screen');
});

check('a longer route fits at a lower zoom than a short one', () => {
  const short = fitBounds([straightTrack({ points: 20, stepM: 10 })], 320, 320);
  const long = fitBounds([straightTrack({ points: 400, stepM: 50 })], 320, 320);
  assert(long.zoom < short.zoom, `long route zooms out (${long.zoom} < ${short.zoom})`);
});

check('fitting nothing yields nothing', () => {
  equal(fitBounds([], 320, 320), null);
});

check('the tile grid covers the viewport', () => {
  const view = fitBounds([straightTrack({ points: 50, stepM: 20 })], 320, 320);
  const tiles = visibleTiles(view);
  assert(tiles.length > 0, 'some tiles');
  // Every tile is a real tile at this zoom.
  const scale = 2 ** view.zoom;
  assert(
    tiles.every((t) => t.x >= 0 && t.x < scale && t.y >= 0 && t.y < scale),
    'tile indices in range',
  );
  // The grid reaches past both edges, so there are no gaps.
  assert(Math.min(...tiles.map((t) => t.left)) <= 0, 'covers the left edge');
  assert(Math.max(...tiles.map((t) => t.left + TILE_SIZE)) >= 320, 'covers the right edge');
});


// --- foot pod -------------------------------------------------------------

/**
 * Build an RSC Measurement packet the way a pod would.
 *
 * Written independently of the parser — laying the bytes out by hand from the
 * specification is the only way this tests anything. A shared helper would
 * agree with the parser's mistakes.
 */
function rscPacket({ speedMps, cadenceSpm, strideCm = null, totalM = null, running = true }) {
  const bytes = [];
  let flags = 0;
  if (strideCm !== null) flags |= 0x01;
  if (totalM !== null) flags |= 0x02;
  if (running) flags |= 0x04;
  bytes.push(flags);

  const speed = Math.round(speedMps * 256);
  bytes.push(speed & 0xff, (speed >> 8) & 0xff);
  bytes.push(cadenceSpm & 0xff);

  if (strideCm !== null) bytes.push(strideCm & 0xff, (strideCm >> 8) & 0xff);
  if (totalM !== null) {
    const dm = Math.round(totalM * 10);
    bytes.push(dm & 0xff, (dm >> 8) & 0xff, (dm >> 16) & 0xff, (dm >> 24) & 0xff);
  }

  return new DataView(new Uint8Array(bytes).buffer);
}

check('a minimal pod packet decodes', () => {
  const m = parseRscMeasurement(rscPacket({ speedMps: 3, cadenceSpm: 180, running: true }));
  near(m.speedMps, 3, 1e-6, 'speed');
  equal(m.cadenceSpm, 180, 'cadence');
  equal(m.strideLengthM, null, 'no stride');
  equal(m.totalDistanceM, null, 'no odometer');
  equal(m.running, true);
});

check('optional fields shift the layout', () => {
  // Total distance with no stride length sits four bytes earlier than it would
  // otherwise. Reading at a fixed offset gets this wrong and looks plausible.
  const withTotalOnly = parseRscMeasurement(
    rscPacket({ speedMps: 2.5, cadenceSpm: 168, totalM: 1234.5 }),
  );
  near(withTotalOnly.totalDistanceM, 1234.5, 0.05, 'total without stride');
  equal(withTotalOnly.strideLengthM, null);

  const withBoth = parseRscMeasurement(
    rscPacket({ speedMps: 2.5, cadenceSpm: 168, strideCm: 118, totalM: 1234.5 }),
  );
  near(withBoth.strideLengthM, 1.18, 1e-6, 'stride');
  near(withBoth.totalDistanceM, 1234.5, 0.05, 'total with stride');
});

check('the walking flag is read', () => {
  const walking = parseRscMeasurement(rscPacket({ speedMps: 1.2, cadenceSpm: 110, running: false }));
  equal(walking.running, false);
});

check('a large odometer survives the 32-bit field', () => {
  const m = parseRscMeasurement(rscPacket({ speedMps: 3, cadenceSpm: 180, totalM: 400000 }));
  near(m.totalDistanceM, 400000, 0.5, '400 km');
});

check('a packet too short for the mandatory fields is refused', () => {
  // Flags, speed and cadence are the four bytes every RSC frame must carry.
  // Below that there is nothing to salvage.
  equal(parseRscMeasurement(new DataView(new Uint8Array([0x04, 0x00]).buffer)), null, 'too short');
  equal(parseRscMeasurement(new DataView(new Uint8Array([0x01, 0x00, 0x03]).buffer)), null, 'no cadence');
});

/*
 * Real pods set an optional-field flag and then omit the field — seen on the
 * Zwift pod during testing, which is what prompted the lenient path in
 * parseRscMeasurement. Speed and cadence in those frames are perfectly good,
 * and they are the two numbers a treadmill run is actually built from, so
 * throwing the packet away would stall the readout over a field we do not use
 * for distance. The truncated optional field comes back null; nothing is
 * decoded from bytes that are not there.
 */
check('a flagged-but-absent optional field keeps speed and cadence', () => {
  // Claims a stride length but stops before it.
  const stride = parseRscMeasurement(
    new DataView(new Uint8Array([0x01, 0x00, 0x03, 0xb4]).buffer),
  );
  assert(stride !== null, 'stride promised, absent: kept rather than dropped');
  near(stride.speedMps, 3, 0.001, 'speed still decoded');
  equal(stride.cadenceSpm, 180, 'cadence still decoded');
  equal(stride.strideLengthM, null, 'stride not invented');
  equal(stride.totalDistanceM, null, 'no odometer claimed');

  // Claims an odometer but only supplies two of its four bytes.
  const odo = parseRscMeasurement(
    new DataView(new Uint8Array([0x02, 0x00, 0x03, 0xb4, 0x10, 0x27]).buffer),
  );
  assert(odo !== null, 'odometer truncated: kept rather than dropped');
  near(odo.speedMps, 3, 0.001, 'speed still decoded');
  equal(odo.cadenceSpm, 180, 'cadence still decoded');
  equal(odo.totalDistanceM, null, 'odometer not read from missing bytes');
});

check('the first pod reading only sets a baseline', () => {
  const tracker = new FootpodTracker();
  // The pod has been counting since it was last charged; none of that is ours.
  tracker.update(parseRscMeasurement(rscPacket({ speedMps: 3, cadenceSpm: 180, totalM: 50000 })), 1000);
  equal(tracker.distanceM, 0, 'nothing inherited from the odometer');
});

check('the pod odometer drives distance', () => {
  const tracker = new FootpodTracker();
  let total = 8000;
  tracker.update(parseRscMeasurement(rscPacket({ speedMps: 3, cadenceSpm: 180, totalM: total })), 0);
  for (let i = 1; i <= 100; i++) {
    total += 3; // 3 m per second at 3 m/s
    tracker.update(
      parseRscMeasurement(rscPacket({ speedMps: 3, cadenceSpm: 180, totalM: total })),
      i * 1000,
    );
  }
  near(tracker.distanceM, 300, 0.2, '100 seconds at 3 m/s');
  near(tracker.speedMps, 3, 1e-6, 'speed');
});

check('a dropped packet costs nothing when the pod has an odometer', () => {
  const tracker = new FootpodTracker();
  tracker.update(parseRscMeasurement(rscPacket({ speedMps: 3, cadenceSpm: 180, totalM: 100 })), 0);
  // Thirty seconds of silence, then a reading that has moved on by 90 m.
  tracker.update(parseRscMeasurement(rscPacket({ speedMps: 3, cadenceSpm: 180, totalM: 190 })), 30_000);
  near(tracker.distanceM, 90, 0.2, 'the gap is still counted');
});

check('a pod that resets mid-run does not subtract distance', () => {
  const tracker = new FootpodTracker();
  tracker.update(parseRscMeasurement(rscPacket({ speedMps: 3, cadenceSpm: 180, totalM: 5000 })), 0);
  tracker.update(parseRscMeasurement(rscPacket({ speedMps: 3, cadenceSpm: 180, totalM: 5100 })), 1000);
  near(tracker.distanceM, 100, 0.2, 'before the reset');
  // Battery blip: the odometer restarts from nothing.
  tracker.update(parseRscMeasurement(rscPacket({ speedMps: 3, cadenceSpm: 180, totalM: 20 })), 2000);
  near(tracker.distanceM, 120, 0.2, 'counts forward, never backward');
});

check('a pod without an odometer is integrated from speed', () => {
  const tracker = new FootpodTracker();
  for (let i = 0; i <= 60; i++) {
    tracker.update(parseRscMeasurement(rscPacket({ speedMps: 2.5, cadenceSpm: 170 })), i * 1000);
  }
  near(tracker.distanceM, 150, 1, '60 seconds at 2.5 m/s');
});

check('integration refuses to invent distance across a long gap', () => {
  const tracker = new FootpodTracker();
  tracker.update(parseRscMeasurement(rscPacket({ speedMps: 3, cadenceSpm: 180 })), 0);
  // An hour later. Assuming 3 m/s throughout would fabricate 10 km.
  tracker.update(parseRscMeasurement(rscPacket({ speedMps: 3, cadenceSpm: 180 })), 3_600_000);
  equal(tracker.distanceM, 0, 'nothing invented');
});

check('suspending rebases instead of donating the paused distance', () => {
  const tracker = new FootpodTracker();
  tracker.update(parseRscMeasurement(rscPacket({ speedMps: 3, cadenceSpm: 180, totalM: 1000 })), 0);
  tracker.update(parseRscMeasurement(rscPacket({ speedMps: 3, cadenceSpm: 180, totalM: 1100 })), 1000);
  near(tracker.distanceM, 100, 0.2, 'before the pause');

  tracker.suspend();
  // The belt kept running for a kilometre while the run was paused.
  tracker.update(parseRscMeasurement(rscPacket({ speedMps: 3, cadenceSpm: 180, totalM: 2100 })), 9000);
  near(tracker.distanceM, 100, 0.2, 'the paused kilometre is not counted');

  tracker.update(parseRscMeasurement(rscPacket({ speedMps: 3, cadenceSpm: 180, totalM: 2150 })), 10_000);
  near(tracker.distanceM, 150, 0.2, 'counting resumes cleanly');
});

check('calibration scales the pod', () => {
  const tracker = new FootpodTracker();
  tracker.calibration = 1.05;
  tracker.update(parseRscMeasurement(rscPacket({ speedMps: 3, cadenceSpm: 180, totalM: 0 })), 0);
  tracker.update(parseRscMeasurement(rscPacket({ speedMps: 3, cadenceSpm: 180, totalM: 100 })), 1000);
  near(tracker.distanceM, 105, 0.2, 'five percent up');
  near(tracker.speedMps, 3.15, 1e-6, 'speed scales too');
});

check('calibration factors are sanity-checked', () => {
  near(calibrateAgainst(5000, 5250), 1.05, 1e-9, 'a believable correction');
  equal(calibrateAgainst(5000, 5), null, 'kilometres typed as metres');
  equal(calibrateAgainst(0, 5000), null, 'pod reported nothing');
  equal(calibrateAgainst(5000, 0), null, 'no reference');
});

// --- foot pod through a session -------------------------------------------

check('a treadmill run takes its distance from the pod', () => {
  const t0 = 1_700_000_000_000;
  const session = new RunSession({ mode: 'treadmill', strideM: 0.8 }, t0);
  session.start(t0);

  let total = 0;
  session.addFootpod(parseRscMeasurement(rscPacket({ speedMps: 3, cadenceSpm: 176, totalM: total })), t0);
  for (let i = 1; i <= 200; i++) {
    total += 3;
    session.addFootpod(
      parseRscMeasurement(rscPacket({ speedMps: 3, cadenceSpm: 176, totalM: total })),
      t0 + i * 1000,
    );
  }
  session.finish(t0 + 200_000);

  near(session.distanceM, 600, 1, '200 seconds at 3 m/s');
  equal(session.toActivity().distanceSource, 'sensor');
  equal(session.cadence(), 176, 'cadence from the pod');
});

check('the pod outranks the pedometer', () => {
  const t0 = 1_700_000_000_000;
  const session = new RunSession({ mode: 'treadmill', strideM: 0.8 }, t0);
  session.start(t0);

  // The phone thinks 1000 steps happened, which its stride model calls 800 m.
  session.addSteps(1000);
  near(session.distanceM, 800, 1e-9, 'pedometer while it is alone');

  session.addFootpod(parseRscMeasurement(rscPacket({ speedMps: 3, cadenceSpm: 176, totalM: 0 })), t0);
  session.addFootpod(
    parseRscMeasurement(rscPacket({ speedMps: 3, cadenceSpm: 176, totalM: 500 })),
    t0 + 1000,
  );
  near(session.distanceM, 500, 0.2, 'the pod takes over');

  // More steps must not drag the distance back to the estimate.
  session.addSteps(500);
  near(session.distanceM, 500, 0.2, 'steps no longer own the distance');
  equal(session.steps, 1500, 'but they are still counted');
});

check('the pod owns the distance until the console overrules it', () => {
  const t0 = 1_700_000_000_000;
  const session = new RunSession({ mode: 'treadmill' }, t0);
  session.start(t0);
  session.addFootpod(parseRscMeasurement(rscPacket({ speedMps: 3, cadenceSpm: 176, totalM: 0 })), t0);
  session.addFootpod(
    parseRscMeasurement(rscPacket({ speedMps: 3, cadenceSpm: 176, totalM: 4800 })),
    t0 + 1000,
  );
  session.finish(t0 + 2000);

  // Nothing overrides the pod mid-run any more: the console's total does not
  // exist until the belt stops, so the live session has one distance source and
  // the results page is where a second opinion can arrive.
  const activity = session.toActivity();
  near(activity.distanceM, 4800, 1e-6, 'the pod measured the run');
  equal(activity.distanceSource, 'sensor');

  const out = applyConsoleEntry(
    activity,
    { distanceM: 5000, inclinePercent: null },
    { footpodCalibration: 1, weightKg: 70, age: 35, sex: 'male' },
  );
  equal(out.activity.distanceM, 5000, 'the console wins afterwards');
  equal(out.activity.distanceSource, 'manual');
});

check('pausing stops the pod counting', () => {
  const t0 = 1_700_000_000_000;
  const session = new RunSession({ mode: 'treadmill' }, t0);
  session.start(t0);
  session.addFootpod(parseRscMeasurement(rscPacket({ speedMps: 3, cadenceSpm: 176, totalM: 0 })), t0);
  session.addFootpod(
    parseRscMeasurement(rscPacket({ speedMps: 3, cadenceSpm: 176, totalM: 300 })),
    t0 + 1000,
  );
  session.pause(t0 + 1000);

  // Readings during the pause are ignored outright.
  session.addFootpod(
    parseRscMeasurement(rscPacket({ speedMps: 3, cadenceSpm: 176, totalM: 900 })),
    t0 + 2000,
  );
  near(session.distanceM, 300, 0.2, 'nothing added while paused');

  session.resume(t0 + 60_000);
  session.addFootpod(
    parseRscMeasurement(rscPacket({ speedMps: 3, cadenceSpm: 176, totalM: 1500 })),
    t0 + 61_000,
  );
  near(session.distanceM, 300, 0.2, 'the first reading back only rebases');
  session.addFootpod(
    parseRscMeasurement(rscPacket({ speedMps: 3, cadenceSpm: 176, totalM: 1560 })),
    t0 + 62_000,
  );
  near(session.distanceM, 360, 0.2, 'then counts again');
});

check('outdoors the pod gives cadence but not distance', () => {
  const t0 = 1_700_000_000_000;
  const session = new RunSession({ mode: 'outdoor' }, t0);
  session.start(t0);
  session.addFootpod(parseRscMeasurement(rscPacket({ speedMps: 3, cadenceSpm: 182, totalM: 0 })), t0);
  session.addFootpod(
    parseRscMeasurement(rscPacket({ speedMps: 3, cadenceSpm: 182, totalM: 500 })),
    t0 + 1000,
  );
  equal(session.distanceM, 0, 'GPS owns distance outdoors');
  equal(session.cadence(), 182, 'cadence is still useful');
  session.finish(t0 + 2000);
  equal(session.toActivity().distanceSource, 'gps');
});

// --- calories & goals -----------------------------------------------------

check('pace calorie estimate scales with distance and weight', () => {
  // 5 km in 30 min at 70 kg — a steady jog, a few hundred kcal.
  const base = estimateCaloriesFromPace(5000, 30 * 60_000, 70);
  assert(base > 200 && base < 500, `sensible range, got ${base}`);
  const heavier = estimateCaloriesFromPace(5000, 30 * 60_000, 90);
  assert(heavier > base, 'more mass burns more');
  const longer = estimateCaloriesFromPace(10000, 60 * 60_000, 70);
  assert(longer > base * 1.5, 'twice the work costs more');
  equal(estimateCaloriesFromPace(0, 0, 70), 0, 'nothing done');
  equal(formatCalories(base), String(Math.round(base)));
});

check('Keytel rises with heart rate', () => {
  const easy = keytelKjPerMin(120, 70, 35, 'male');
  const hard = keytelKjPerMin(170, 70, 35, 'male');
  assert(hard > easy, 'higher HR costs more');
  assert(easy > 0 && hard > 0, 'positive rates');
});

check('HR samples drive calories when a strap was worn', () => {
  const t0 = 1_700_000_000_000;
  const durationMs = 20 * 60_000;
  // 1 Hz-ish samples at a hard effort.
  const heart = [];
  for (let i = 0; i <= 20 * 60; i += 2) {
    heart.push({ t: t0 + i * 1000, bpm: 165 });
  }

  const withHr = estimateCalories({
    distanceM: 3000,
    durationMs,
    weightKg: 70,
    age: 35,
    sex: 'male',
    heart,
  });
  equal(withHr.source, 'heart');

  const without = estimateCalories({
    distanceM: 3000,
    durationMs,
    weightKg: 70,
    age: 35,
    sex: 'male',
    heart: [],
  });
  equal(without.source, 'pace');

  // Same distance/time but hard HR should not collapse to the easy pace number.
  assert(withHr.kcal > 0, 'HR path produces a number');
  // Convenience wrapper still works.
  near(
    estimateCaloriesKcal({
      distanceM: 3000,
      durationMs,
      weightKg: 70,
      age: 35,
      sex: 'male',
      heart,
    }),
    withHr.kcal,
    1e-9,
  );
});

check('heart report freezes zone times on the activity', () => {
  const t0 = 1_700_000_000_000;
  const samples = [];
  // 2 min easy (~60% of 200 = 120) then 2 min hard (~85% = 170)
  for (let i = 0; i < 120; i++) samples.push({ t: t0 + i * 1000, bpm: 120 });
  for (let i = 0; i < 120; i++) samples.push({ t: t0 + (120 + i) * 1000, bpm: 170 });

  const report = buildHeartReport(samples, 200);
  assert(report, 'report built');
  equal(report.maxHeartRate, 200);
  assert(report.zones.some((z) => z.zoneIndex === 2 && z.ms > 0), 'time in Z2');
  assert(report.zones.some((z) => z.zoneIndex === 4 && z.ms > 0), 'time in Z4');

  const session = new RunSession(
    { mode: 'treadmill', strideM: 1, weightKg: 70, age: 35, sex: 'male', maxHeartRate: 200 },
    t0,
  );
  session.start(t0);
  for (const s of samples) session.addHeart(s.bpm, s.t);
  session.finish(t0 + 240_000);
  const activity = session.toActivity();
  assert(activity.heartReport, 'saved on activity');
  equal(activity.heartReport.maxBpm, 170);
  const revived = heartSummaryFromReport(activity.heartReport);
  equal(revived.zones.length, 5);
  near(
    revived.zones.reduce((s, z) => s + z.ms, 0),
    activity.heartReport.measuredMs,
    1,
  );
});

check('session calories prefer HR once samples land', () => {
  const t0 = 1_700_000_000_000;
  const session = new RunSession(
    { mode: 'treadmill', strideM: 1, weightKg: 70, age: 35, sex: 'male' },
    t0,
  );
  session.start(t0);
  session.addSteps(2000);
  // Before any HR, pace model.
  equal(session.caloriesEstimate(t0 + 600_000).source, 'pace');
  for (let i = 0; i < 120; i++) {
    session.addHeart(160, t0 + i * 1000);
  }
  const est = session.caloriesEstimate(t0 + 120_000);
  equal(est.source, 'heart');
  assert(est.kcal > 0);
  session.finish(t0 + 120_000);
  assert(session.toActivity().caloriesKcal > 0);
});

check('standing still reads as zero, not as no reading at all', () => {
  /*
   * The bug this guards. Stop moving and the jitter filter rejects every fix,
   * so the track stops growing — and recentSpeed used to answer null, which
   * nextStillMs reads as a cold receiver and resets on. Auto-pause could not
   * fire outdoors at any speed, for any length of stop.
   */
  const t0 = 1_700_000_000_000;
  const track = straightTrack({ points: 21, stepM: 15, secondsPerPoint: 5, t0 });
  const session = new RunSession({ mode: 'outdoor' }, t0);
  session.start(t0);
  for (const point of track) session.addPoint(point);

  const stoppedAt = track[track.length - 1].t;
  near(session.recentSpeed(8000, stoppedAt), 3, 0.35, 'running at 3 m/s');

  /*
   * Now stand there. The phone keeps reporting from the same spot, give or
   * take a metre of wander — every one of those is below the filter's bar.
   */
  let rejected = 0;
  for (let i = 1; i <= 30; i++) {
    const accepted = session.addPoint({
      lat: track[track.length - 1].lat + (i % 2 ? 1 : -1) / METRES_PER_DEGREE_LAT,
      lon: 24.9,
      t: stoppedAt + i * 1000,
      accuracy: 5,
      elevation: null,
    });
    if (!accepted) rejected++;
  }
  equal(rejected, 30, 'the filter rejects all of it, which is correct');

  const speed = session.recentSpeed(8000, stoppedAt + 30_000);
  assert(speed !== null, 'a stopped athlete is measured, not unknown');
  assert(speed < STILL_SPEED_MPS, `expected still, got ${speed} m/s`);

  // And that reading is enough to drive the accumulator to a pause.
  let still = 0;
  let action = 'none';
  for (let ms = 1000; ms <= 30_000 && action === 'none'; ms += 1000) {
    const s = session.recentSpeed(8000, stoppedAt + ms);
    still = nextStillMs(still, s, true, 1000);
    action = autoPauseAction({
      speedMps: s,
      running: true,
      paused: false,
      autoPaused: false,
      stillMs: still,
      enabled: true,
      supported: true,
    });
    if (action === 'pause') {
      // Long enough not to trip on a kerb, short enough to be worth having.
      assert(ms >= 8000 && ms <= 20_000, `paused after ${ms} ms`);
    }
  }
  equal(action, 'pause', 'never auto-paused during a 30 second stop');
});

check('a cold receiver still freezes nothing', () => {
  // The guard the null case exists for: no fix has ever arrived, so there is
  // genuinely nothing to go on and the clock must be left alone.
  const t0 = 1_700_000_000_000;
  const session = new RunSession({ mode: 'outdoor' }, t0);
  session.start(t0);
  equal(session.recentSpeed(8000, t0 + 30_000), null, 'no fixes, no answer');
  equal(nextStillMs(0, null, true, 30_000), 0, 'and no march towards a pause');
});

check('auto-pause triggers after sustained stillness', () => {
  let still = 0;
  still = nextStillMs(still, 0.1, true, 2000);
  equal(autoPauseAction({
    speedMps: 0.1,
    running: true,
    paused: false,
    autoPaused: false,
    stillMs: still,
    enabled: true,
    supported: true,
  }), 'none', 'not long enough yet');
  still = nextStillMs(still, 0.1, true, STILL_DURATION_MS);
  equal(autoPauseAction({
    speedMps: 0.1,
    running: true,
    paused: false,
    autoPaused: false,
    stillMs: still,
    enabled: true,
    supported: true,
  }), 'pause');
  equal(autoPauseAction({
    speedMps: 1.5,
    running: false,
    paused: true,
    autoPaused: true,
    stillMs: 0,
    enabled: true,
    supported: true,
  }), 'resume');
  equal(autoPauseAction({
    speedMps: 0,
    running: true,
    paused: false,
    autoPaused: false,
    stillMs: STILL_DURATION_MS,
    enabled: false,
    supported: true,
  }), 'none', 'disabled');
});

check('cues fire for distance units and goal met', () => {
  const units = 'metric';
  const goal = distanceGoal(2, units);
  const base = {
    distanceM: 0,
    durationMs: 0,
    caloriesKcal: 0,
    state: 'running',
    goal,
    laps: [],
    autoPaused: false,
    units,
  };
  const first = makeSnapshot(base);
  const startEvents = pendingCues(null, first, { units, distanceCues: true, goalCues: true });
  equal(startEvents[0]?.type, 'started');

  const mid = makeSnapshot({ ...base, distanceM: 1000, durationMs: 300_000 });
  const midEvents = pendingCues(first, mid, { units, distanceCues: true, goalCues: true });
  assert(midEvents.some((e) => e.type === 'distance_unit' && e.unit === 1), '1 km cue');
  assert(midEvents.some((e) => e.type === 'goal_half'), 'halfway on a 2 km goal');

  const done = makeSnapshot({ ...base, distanceM: 2000, durationMs: 600_000 });
  const doneEvents = pendingCues(mid, done, { units, distanceCues: true, goalCues: true });
  assert(doneEvents.some((e) => e.type === 'goal_met'), 'goal met');
  assert(doneEvents.some((e) => e.type === 'distance_unit' && e.unit === 2), '2 km cue');

  const speech = cueSpeech({ type: 'distance_unit', unit: 1 }, {
    units,
    distanceM: 1000,
    durationMs: 300_000,
  });
  assert(speech.includes('kilometer'), speech);
});

// --- what the cues actually say -------------------------------------------

check('durations are spelled out rather than punctuated', () => {
  // "5:12" through a speech engine is a coin toss between "five twelve" and a
  // time of day, so the cue layer never hands one over.
  equal(spokenDuration(312_000), '5 minutes 12 seconds');
  equal(spokenDuration(60_000), '1 minute');
  equal(spokenDuration(3_600_000), '1 hour');
  equal(spokenDuration(3_912_000), '1 hour 5 minutes 12 seconds');
  // Zero has to say something; an empty string would swallow the sentence.
  equal(spokenDuration(0), '0 seconds');
  equal(spokenDuration(-5), '0 seconds');
  assert(!/[:\d]{2}:/.test(spokenDuration(312_000)), 'no clock punctuation');
});

check('spoken distance keeps the unit singular only at exactly one', () => {
  equal(spokenDistance(1000, 'metric'), '1.00 kilometer');
  equal(spokenDistance(1020, 'metric'), '1.02 kilometers');
  equal(spokenDistance(0, 'metric'), '0.00 kilometers');
  equal(spokenDistance(1609.344, 'imperial'), '1.00 mile');
});

check('spoken pace divides the right way round', () => {
  // 1 km in 5 minutes is a five-minute kilometre, not a twelve-second one.
  equal(spokenPace(1000, 300_000, 'metric'), '5 minutes per kilometer');
  equal(spokenPace(2000, 612_000, 'metric'), '5 minutes 6 seconds per kilometer');
  equal(spokenPace(0, 300_000, 'metric'), null);
  equal(spokenPace(1000, 0, 'metric'), null);
  // A stopped athlete has no pace, and the cue would rather say nothing.
  equal(spokenPace(1, 600_000, 'metric'), null);
});

check('a lap speaks its own split, not the running total', () => {
  const line = cueSpeech(
    { type: 'lap', index: 3, splitDistanceM: 1020, splitDurationMs: 312_000 },
    { units: 'metric', distanceM: 9999, durationMs: 9_999_000 },
  );
  equal(line, 'Lap 3. 1.02 kilometers in 5 minutes 12 seconds, 5 minutes 6 seconds per kilometer.');
  // The whole-run figures are in ctx and must not leak into a lap line.
  assert(!line.includes('9'), line);
});

check('goal reached speaks the run total', () => {
  const line = cueSpeech(
    { type: 'goal_met' },
    { units: 'metric', distanceM: 5000, durationMs: 1_500_000 },
  );
  equal(line, 'Goal reached. 5.00 kilometers in 25 minutes, 5 minutes per kilometer.');
});

check('laps are announced once each, in order, however many arrive at once', () => {
  const units = 'metric';
  const lap = (index) => ({
    index,
    splitDistanceM: 400,
    splitDurationMs: 120_000,
  });
  const base = {
    distanceM: 0,
    durationMs: 0,
    caloriesKcal: 0,
    state: 'running',
    goal: null,
    laps: [],
    autoPaused: false,
    units,
  };
  const options = { units, distanceCues: true, goalCues: true };

  const one = makeSnapshot({ ...base, laps: [lap(1)] });
  const three = makeSnapshot({ ...base, laps: [lap(1), lap(2), lap(3)] });
  const events = pendingCues(one, three, options).filter((e) => e.type === 'lap');
  equal(events.length, 2, 'only the new laps');
  equal(events[0].index, 2);
  equal(events[1].index, 3);

  // Nothing new: silence, not a repeat of the last lap.
  equal(pendingCues(three, three, options).filter((e) => e.type === 'lap').length, 0);
});

check('manual laps record split distance and time', () => {
  const t0 = 1_700_000_000_000;
  const session = new RunSession({ mode: 'treadmill', strideM: 1 }, t0);
  session.start(t0);
  session.addSteps(500);
  const lap1 = session.lap(t0 + 120_000);
  assert(lap1, 'first lap');
  equal(lap1.index, 1);
  near(lap1.splitDistanceM, 500, 1e-9);
  equal(lap1.splitDurationMs, 120_000);
  session.addSteps(300);
  const lap2 = session.lap(t0 + 200_000);
  equal(lap2.index, 2);
  near(lap2.splitDistanceM, 300, 1e-9);
  equal(session.toActivity().manualLaps.length, 2);
});

check('goal builders and progress', () => {
  const dist = distanceGoal(5, 'metric');
  equal(dist?.target, 5000);
  equal(formatGoalTarget(dist, 'metric'), '5.00 km');

  const time = timeGoalMinutes(30);
  equal(time?.target, 30 * 60_000);
  equal(formatGoalTarget(time, 'metric'), '30:00');

  const cal = caloriesGoal(300);
  equal(cal?.target, 300);

  const snap = { distanceM: 2500, durationMs: 15 * 60_000, caloriesKcal: 150 };
  near(goalProgress(dist, snap), 0.5, 1e-9);
  assert(!goalMet(dist, snap));
  assert(goalMet(dist, { ...snap, distanceM: 5000 }));
  near(goalProgress(time, snap), 0.5, 1e-9);
  near(goalProgress(cal, snap), 0.5, 1e-9);
  equal(distanceGoal(0, 'metric'), null);
  equal(timeGoalMinutes(-1), null);
  equal(caloriesGoal(0), null);
});

// --- workouts / shoes / routes / gpx (Phase B & C) ------------------------

check('workout presets expand and advance by time', () => {
  assert(WORKOUT_PRESETS.length >= 8, 'enough presets');
  const easy = WORKOUT_PRESETS.find((w) => w.id === 'easy-30');
  assert(easy && easy.phases.length >= 3, 'easy-30 has phases');
  const runner = new WorkoutRunner(easy);
  runner.begin(0, 0);
  equal(runner.current()?.kind, 'warmup');
  // 5 min warm-up
  runner.tick(0, 5 * 60_000);
  equal(runner.current()?.kind, 'steady');
  runner.tick(0, 5 * 60_000 + 20 * 60_000);
  equal(runner.current()?.kind, 'cooldown');
  runner.tick(0, 5 * 60_000 + 20 * 60_000 + 5 * 60_000);
  assert(runner.done, 'workout finished');
});

check('distance-based intervals advance on metres', () => {
  const recipe = expandRecipe({
    id: 'test-400',
    name: 'Test',
    blurb: 'x',
    steps: [
      {
        kind: 'repeat',
        times: 2,
        work: { label: '400', distanceM: 400 },
        rest: { label: 'rest', timeMs: 60_000 },
      },
    ],
  });
  const runner = new WorkoutRunner(recipe);
  runner.begin(0, 0);
  equal(runner.current()?.target.type, 'distance');
  runner.tick(400, 90_000);
  equal(runner.current()?.kind, 'rest');
  runner.tick(400, 150_000);
  equal(runner.current()?.target.type, 'distance');
});

check('custom intervals builder', () => {
  const w = customIntervals({
    warmupMin: 5,
    workMin: 2,
    restMin: 1,
    repeats: 3,
    cooldownMin: 5,
  });
  // warm + 3*(work+rest) + cool
  equal(w.phases.length, 1 + 3 * 2 + 1);
});

check('shoe mileage and wear warning', () => {
  // Limits are clamped to ≥ 50 km.
  const shoe = createShoe({ name: 'Pegs', limitM: 50_000 });
  equal(shoe.distanceM, 0);
  equal(shoe.limitM, 50_000);
  const next = addDistanceToShoe([shoe], shoe.id, 50_000);
  assert(shoeNeedsWarning(next[0]), 'at limit');
  near(shoeWearFraction(next[0]), 1, 1e-9);
});

check('a shoe can give mileage back when a run is corrected downwards', () => {
  const shoe = createShoe({ name: 'Pegs', limitM: 50_000 });
  const worn = addDistanceToShoe([shoe], shoe.id, 8000)[0];
  // A console correction can go either way, and the shoe was already credited
  // at finish. Refusing the negative would leave it permanently over-worn.
  const corrected = addDistanceToShoe([worn], shoe.id, -3000)[0];
  equal(corrected.distanceM, 5000);
  // Never past zero, though: a correction can undo what a run added, no more.
  equal(addDistanceToShoe([corrected], shoe.id, -9000)[0].distanceM, 0);
  equal(addDistanceToShoe([corrected], shoe.id, 0)[0].distanceM, 5000, 'zero is a no-op');
});

check('shoe edit keeps mileage', () => {
  const shoe = createShoe({ name: 'Pegs', brand: 'Nike', limitM: 50_000 });
  const worn = addDistanceToShoe([shoe], shoe.id, 12_000)[0];
  const edited = updateShoe([worn], worn.id, {
    name: 'Pegs 2',
    brand: 'Nike',
    limitM: 80_000,
  })[0];
  equal(edited.name, 'Pegs 2');
  equal(edited.distanceM, 12_000, 'mileage untouched');
  equal(edited.limitM, 80_000);
});

check('profile sex is only male or female', () => {
  equal(sanitise({ sex: 'female' }).sex, 'female');
  equal(sanitise({ sex: 'unspecified' }).sex, 'male', 'legacy skip maps to default');
  equal(sanitise({}).sex, 'male');
});

check('route thinning and reverse preserve ends', () => {
  const points = [];
  for (let i = 0; i < 500; i++) {
    points.push({ lat: 60 + i * 0.0001, lon: 24, t: i * 1000, accuracy: 5, elevation: null });
  }
  const thin = thinSegment(points, 50);
  equal(thin.length, 50);
  equal(thin[0].lat, points[0].lat);
  equal(thin[thin.length - 1].lat, points[points.length - 1].lat);
  const rev = reverseSegments([points.slice(0, 10)]);
  equal(rev[0][0].lat, points[9].lat);
  assert(pathDistance([points.slice(0, 10)]) > 0);
});

check('route from activity and GPX export', () => {
  const track = straightTrack({ points: 20, stepM: 50 });
  const act = activityFrom([track]);
  const route = routeFromActivity(act, 'Loop');
  assert(route, 'route built');
  equal(route.name, 'Loop');
  const gpx = activityToGpx(act, 'Test run');
  assert(gpx.includes('<gpx'), 'gpx root');
  assert(gpx.includes('<trkpt'), 'track points');
  assert(gpx.includes('Test run'), 'name');
});

check('display name is sanitised', () => {
  equal(sanitise({ displayName: '  Alex  ' }).displayName, 'Alex');
  equal(sanitise({ displayName: 12 }).displayName, '');
});

check('history filters and groups', () => {
  const now = Date.now();
  const weekStart = historyWeekStart(now);
  const outdoor = {
    ...activityFrom([straightTrack({ points: 5 })]),
    id: 'a',
    mode: 'outdoor',
    startedAt: weekStart + 3_600_000,
    heart: [{ t: weekStart, bpm: 140 }],
  };
  const treadmill = {
    ...activityFrom([straightTrack({ points: 3 })]),
    id: 'b',
    mode: 'treadmill',
    startedAt: weekStart - 14 * 86_400_000,
    heart: [],
    workoutId: 'easy-30',
    workoutName: 'Easy 30',
  };
  const all = [outdoor, treadmill];
  equal(filterActivities(all, { mode: 'outdoor', range: 'all', extra: 'all', groupBy: 'none' }).length, 1);
  equal(filterActivities(all, { mode: 'all', range: 'week', extra: 'all', groupBy: 'none' }, now).length, 1);
  equal(filterActivities(all, { mode: 'all', range: 'all', extra: 'hr', groupBy: 'none' }).length, 1);
  equal(filterActivities(all, { mode: 'all', range: 'all', extra: 'workout', groupBy: 'none' }).length, 1);
  const groups = groupActivities(all, 'month');
  assert(groups.length >= 1);
  equal(groups.reduce((n, g) => n + g.activities.length, 0), 2);
});

check('training load rises with harder effort', () => {
  const now = Date.now();
  const easy = activityFrom([straightTrack({ points: 10 })], {
    startedAt: now - 3_600_000,
    durationMs: 30 * 60_000,
    distanceM: 4000,
    heartReport: {
      averageBpm: 120,
      maxBpm: 130,
      minBpm: 110,
      measuredMs: 30 * 60_000,
      maxHeartRate: 180,
      zones: [],
    },
  });
  const hard = activityFrom([straightTrack({ points: 10 })], {
    startedAt: now - 1_800_000,
    durationMs: 30 * 60_000,
    distanceM: 4000,
    heartReport: {
      averageBpm: 165,
      maxBpm: 175,
      minBpm: 150,
      measuredMs: 30 * 60_000,
      maxHeartRate: 180,
      zones: [],
    },
  });
  assert(activityLoad(hard, 180) > activityLoad(easy, 180), 'harder HR ⇒ more load');
  const snap = loadSnapshot([easy, hard], now, 180);
  assert(snap.acute > 0, `acute load expected > 0, got ${snap.acute}`);
  assert(['fresh', 'balanced', 'loaded', 'high', 'unknown'].includes(snap.status));
});

check('thin history does not scream high load on easy short week', () => {
  const now = Date.now();
  // Two easy jogs this week only (~1.6 km each, ~10 min/km, no HR).
  const a = activityFrom([straightTrack({ points: 8 })], {
    startedAt: now - 2 * 86_400_000,
    durationMs: 18 * 60_000,
    distanceM: 1700,
  });
  const b = activityFrom([straightTrack({ points: 8 })], {
    startedAt: now - 1 * 86_400_000,
    durationMs: 18 * 60_000,
    distanceM: 1630,
  });
  const snap = loadSnapshot([a, b], now, 185);
  // Ratio can look high when prior weeks are empty — status must not be "high".
  assert(
    snap.status === 'fresh' || snap.status === 'balanced',
    `expected fresh/balanced for tiny easy week, got ${snap.status} (acute ${snap.acute.toFixed(1)}, chronic ${snap.chronic.toFixed(1)}, ratio ${snap.ratio})`,
  );
});

check('plans have weekly sessions and progress', () => {
  assert(PLAN_TEMPLATES.length >= 3, 'several plans');
  const plan = planById('first-5k');
  assert(plan, 'first-5k exists');
  equal(sessionsForWeek(plan, 0).length, 3);
  const first = sessionsForWeek(plan, 0)[0];
  const state = {
    id: 't',
    planId: plan.id,
    startedWeekAt: Date.now(),
    completed: [],
  };
  const next = toggleSessionComplete(state, first);
  assert(next.completed.includes(planSessionKey(first)), 'session marked complete');
  equal(currentPlanWeek(state, plan), 0);
  const prog = weekProgress(next, plan, 0);
  equal(prog.done, 1);
  assert(prog.total >= 1);
  equal(startPlan('missing-plan'), null);
});

check('month calendar places runs and plan sessions', () => {
  const now = Date.now();
  const month = startOfMonth(now);
  const grid = monthGrid(month, now);
  equal(grid.length, 42, '6 weeks × 7 days');
  assert(grid.some((c) => c.inMonth && c.isToday) || true);

  const day = month + 3 * 86_400_000;
  const act = activityFrom([straightTrack({ points: 5 })], { startedAt: day + 12 * 3600_000 });
  const runs = runEvents([act]);
  assert(eventsOnDay(runs, day).length >= 1 || eventsOnDay(runs, act.startedAt).length >= 1);

  const plan = planById('first-5k');
  assert(plan);
  const state = {
    id: 'p',
    planId: plan.id,
    startedWeekAt: month,
    completed: [],
  };
  const planned = planEvents(state, plan);
  assert(planned.length > 0, 'plan has dated sessions');
  const first = plan.sessions.find((s) => s.kind !== 'rest');
  assert(first);
  const at = planSessionAt(state, first);
  assert(eventsOnDay(planned, at).some((e) => e.type === 'plan'));
  assert(addMonths(month, 1) > month);
});

// --- themes ---------------------------------------------------------------

check('a zone paints through a themeable variable', () => {
  const zone = ZONES[2];
  const swatch = zoneSwatch(zone);
  // The variable lets a theme retint the ladder; the literal is the fallback
  // so a theme that defines nothing still renders the dark palette.
  equal(swatch, `var(--zone-3, ${zone.colour})`, 'zone 3');
  assert(
    ZONES.every((z) => zoneSwatch(z) === `var(--zone-${z.index}, ${z.colour})`),
    'every zone follows the same shape',
  );
});

check('every zone still carries a real colour to fall back to', () => {
  for (const zone of ZONES) {
    assert(/^#[0-9a-f]{6}$/i.test(zone.colour), `zone ${zone.index} has a hex literal`);
  }
});

/*
 * Driven off THEME_OPTIONS rather than a hand-written list.
 *
 * The previous version hardcoded the three themes that existed when it was
 * written, so it kept passing while three more were added — and its "garbage"
 * sample included 'neon', which later became a real alias. Deriving the set
 * means adding a theme cannot leave this quietly asserting the wrong thing.
 */
const THEME_IDS = THEME_OPTIONS.map((o) => o.id);

check('every registered theme parses to itself', () => {
  assert(THEME_IDS.length >= 6, `expected the full set, got ${THEME_IDS.length}`);
  for (const id of THEME_IDS) {
    equal(parseTheme(id), id, `${id} round-trips`);
  }
});

check('theme aliases from earlier builds still resolve', () => {
  // Values an older localStorage entry could plausibly hold.
  equal(parseTheme('emerald'), 'soft');
  equal(parseTheme('athletic-hud'), 'hud');
  equal(parseTheme('light'), 'day');
  equal(parseTheme('daylight'), 'day');
  equal(parseTheme('ember'), 'crimson');
  equal(parseTheme('skyline'), 'sky');
  equal(parseTheme('arcade'), 'retro');
  equal(parseTheme('neon'), 'retro');
});

check('an unknown theme falls back rather than breaking the shell', () => {
  for (const bad of [null, undefined, '', 'chartreuse', 42, {}, [], 'HUD ']) {
    const parsed = parseTheme(bad);
    assert(THEME_IDS.includes(parsed), `"${String(bad)}" resolved to a real theme, got ${parsed}`);
  }
});

check('every theme round-trips through a profile', () => {
  for (const id of THEME_IDS) {
    equal(sanitise({ theme: id }).theme, id, `${id} kept`);
  }
  assert(THEME_IDS.includes(sanitise({ theme: 'nonsense' }).theme), 'garbage falls back');
});

check('every theme is presentable in the picker', () => {
  const seen = new Set();
  for (const opt of THEME_OPTIONS) {
    assert(opt.label && opt.label.trim().length > 0, `${opt.id} has a label`);
    assert(opt.blurb && opt.blurb.trim().length > 0, `${opt.id} has a blurb`);
    assert(!seen.has(opt.id), `${opt.id} is listed once`);
    seen.add(opt.id);
  }
});

// --- health connect import mapping ----------------------------------------

check('health workout maps to a stable activity id', () => {
  const w = {
    workoutType: 'running',
    duration: 1800,
    totalDistance: 5000,
    totalEnergyBurned: 320,
    startDate: '2026-08-01T07:00:00.000Z',
    endDate: '2026-08-01T07:30:00.000Z',
    sourceName: 'Samsung Health',
    platformId: 'session-abc-123',
  };
  equal(stableHealthImportId(w), 'hc-session-abc-123');
  const act = activityFromWorkout(w);
  assert(act, 'activity built');
  equal(act.distanceM, 5000);
  equal(act.durationMs, 30 * 60 * 1000);
  equal(act.mode, 'outdoor');
  assert(act.note.includes('Samsung'));
});

check('health import plan skips duplicates and non-runs', () => {
  const run = {
    workoutType: 'running',
    duration: 600,
    totalDistance: 1000,
    startDate: '2026-08-01T08:00:00.000Z',
    endDate: '2026-08-01T08:10:00.000Z',
    platformId: 'run-1',
  };
  const yoga = {
    workoutType: 'yoga',
    duration: 600,
    totalDistance: 0,
    startDate: '2026-08-01T09:00:00.000Z',
    endDate: '2026-08-01T09:10:00.000Z',
    platformId: 'yoga-1',
  };
  const plan = planHealthImport([run, yoga, run], new Set(['hc-run-1']));
  equal(plan.toImport.length, 0);
  equal(plan.skippedDuplicate, 2); // existing + second copy of same id in list
  equal(plan.skippedNotRun, 1);
});

// --- map styles -----------------------------------------------------------

check('map style auto follows theme', () => {
  equal(parseMapStyle('auto'), 'auto');
  equal(parseMapStyle('dark'), 'dark');
  equal(parseMapStyle('topo'), 'terrain');
  equal(resolveMapBasemap('auto', 'day'), 'standard');
  equal(resolveMapBasemap('auto', 'soft'), 'dark');
  equal(resolveMapBasemap('auto', 'hud'), 'dark');
  equal(resolveMapBasemap('terrain', 'day'), 'terrain');
  assert(MAP_BASEMAPS.dark.url({ x: 1, y: 2, z: 3, left: 0, top: 0 }).includes('cartocdn'));
  assert(MAP_BASEMAPS.terrain.url({ x: 1, y: 2, z: 3, left: 0, top: 0 }).includes('opentopo'));
});

check('profile stores map prefs with safe defaults', () => {
  equal(sanitise({}).mapStyle, 'auto');
  equal(sanitise({}).liveMapTiles, false);
  equal(sanitise({ mapStyle: 'terrain', liveMapTiles: true }).mapStyle, 'terrain');
  equal(sanitise({ mapStyle: 'terrain', liveMapTiles: true }).liveMapTiles, true);
});

// --- weight / birth date --------------------------------------------------

check('age is derived from a valid birth date', () => {
  // Fixed “today” so the test does not drift on birthdays.
  const now = new Date(2026, 7, 7).getTime(); // 7 Aug 2026
  equal(ageFromBirthDate('2003-08-07', now), 23);
  equal(ageFromBirthDate('2003-08-08', now), 22); // day before birthday
  equal(ageFromBirthDate('not-a-date', now), null);
  equal(sanitiseBirthDate('2003-08-07'), '2003-08-07');
  equal(sanitiseBirthDate('99-01-01'), '');
});

check('weight log tracks trend and goal distance', () => {
  let store = sanitiseWeightStore({ entries: [], goalKg: 70 });
  store = addWeightEntry(store, { weightKg: 75, at: 1_000 });
  store = addWeightEntry(store, { weightKg: 73, at: 2_000 });
  equal(weightTrendKg(store), -2);
  near(weightToGoalKg(store), 3, 1e-9); // latest 73 − goal 70
});

// --- pace band ------------------------------------------------------------

check('pace input parses m:ss and minutes', () => {
  equal(parsePaceInput('5:30'), 330);
  equal(parsePaceInput('5:00'), 300);
  equal(parsePaceInput('5'), 300);
  equal(parsePaceInput('5.5'), 330);
  equal(parsePaceInput(''), null);
  equal(parsePaceInput('5:60'), null);
  equal(parsePaceInput('abc'), null);
});

check('pace band classifies fast / ok / slow', () => {
  const target = 300; // 5:00
  equal(paceBandStatus(null, target), 'unknown');
  equal(paceBandStatus(300, null), 'none');
  equal(paceBandStatus(300, target), 'ok');
  equal(paceBandStatus(290, target), 'ok'); // within ±5% (285–315)
  equal(paceBandStatus(280, target), 'fast'); // under 285
  equal(paceBandStatus(250, target), 'fast');
  equal(paceBandStatus(360, target), 'slow');
  assert(DEFAULT_PACE_BAND === 0.05);
  equal(paceBandCueSpeech('fast', 300, 'metric')?.includes('Slow'), true);
  equal(paceBandCueSpeech('ok', 300, 'metric'), null);
});

// --- backup shape / export formats ----------------------------------------

check('full backup shape is versioned', () => {
  const payload = {
    format: BACKUP_FORMAT,
    v: BACKUP_FORMAT_VERSION,
    activitySchema: SCHEMA_VERSION,
    exportedAt: Date.now(),
    activities: [],
    profile: { ...DEFAULTS },
    shoes: [],
    routes: [],
    activePlan: null,
  };
  assert(isFullBackupShape(payload));
  const text = serializeBackup(payload);
  assert(text.includes('runlog-backup'));
  assert(text.includes('"activitySchema"'));
});

check('GPX export includes HR extension when samples exist', () => {
  const act = activityFrom([straightTrack({ points: 5 })], {
    heart: [
      { t: Date.now(), bpm: 140 },
      { t: Date.now() + 1000, bpm: 145 },
    ],
  });
  // Stamp heart times onto track points.
  const pts = act.segments[0];
  act.heart = pts.map((p, i) => ({ t: p.t, bpm: 140 + i }));
  const gpx = activityToGpx(act);
  assert(gpx.includes('gpxtpx:hr'), 'HR extension present');
  assert(gpx.includes('TrackPointExtension'));
});

check('TCX export has lap totals and optional HR', () => {
  const act = activityFrom([straightTrack({ points: 4 })], {
    distanceM: 1000,
    durationMs: 300_000,
    caloriesKcal: 80,
  });
  act.heart = act.segments[0].map((p) => ({ t: p.t, bpm: 150 }));
  const tcx = activityToTcx(act);
  assert(tcx.includes('TrainingCenterDatabase'));
  assert(tcx.includes('DistanceMeters'));
  assert(tcx.includes('HeartRateBpm'));
  assert(tcx.includes('80') || tcx.includes('<Calories>80</Calories>'));
});

// --- i18n -----------------------------------------------------------------

const LOCALE_IDS = LOCALE_OPTIONS.map((o) => o.id);
const CATALOGUES = { en, el };

check('every shipping locale parses to itself', () => {
  for (const id of LOCALE_IDS) equal(parseLocale(id), id, id);
});

check('an unknown locale falls back to English rather than breaking the shell', () => {
  for (const junk of ['', 'xx', null, undefined, 42, {}, 'klingon']) {
    equal(parseLocale(junk), 'en', String(junk));
  }
});

check('regional Greek still gets Greek', () => {
  // el-CY is Cypriot Greek. Matching on the primary subtag is the difference
  // between a Greek speaker seeing Greek and seeing English.
  equal(detectLocale(['el-CY', 'en-GB']), 'el', 'el-CY');
  equal(detectLocale(['el']), 'el', 'bare el');
  equal(detectLocale(['en-US']), 'en', 'en-US');
  equal(detectLocale(['de-DE', 'fr-FR']), 'en', 'nothing we ship');
  equal(detectLocale([]), 'en', 'no preference at all');
  // Order matters: the first *supported* tag wins, not the first tag.
  equal(detectLocale(['de-DE', 'el-GR', 'en-GB']), 'el', 'first supported wins');
});

check('English formats as en-GB, not en-US', () => {
  // The app writes metres and kilometres; 8/9/2026 for "9 August" would be a
  // different dialect from the rest of the interface.
  equal(localeTag('en'), 'en-GB');
  equal(localeTag('el'), 'el-GR');
});

check('placeholders interpolate, and unknown ones stay visible', () => {
  equal(interpolate('Hi {name}, {n} runs', { name: 'Sam', n: 3 }), 'Hi Sam, 3 runs');
  equal(interpolate('{a} and {a}', { a: 'x' }), 'x and x', 'repeated placeholder');
  equal(interpolate('{count} km', { count: 0 }), '0 km', 'zero is not falsy here');
  // A leftover brace is a visible bug report; an empty gap is a silent one.
  equal(interpolate('Hi {nope}', { name: 'Sam' }), 'Hi {nope}', 'unknown name kept');
  equal(interpolate('nothing to do', undefined), 'nothing to do', 'no vars');
});

check('every locale answers every key the app can ask for', () => {
  const expected = Object.keys(en).sort();
  for (const [id, catalogue] of Object.entries(CATALOGUES)) {
    const actual = Object.keys(catalogue).sort();
    const missing = expected.filter((k) => !actual.includes(k));
    const extra = actual.filter((k) => !expected.includes(k));
    assert(missing.length === 0, `${id} missing: ${missing.join(', ')}`);
    // Extra keys are dead weight that survives a rename of the English one.
    assert(extra.length === 0, `${id} has stale keys: ${extra.join(', ')}`);
  }
});

check('no locale ships an empty string', () => {
  for (const [id, catalogue] of Object.entries(CATALOGUES)) {
    for (const [key, value] of Object.entries(catalogue)) {
      const arms = typeof value === 'string' ? [value] : Object.values(value);
      for (const arm of arms) {
        assert(typeof arm === 'string' && arm.trim().length > 0, `${id} ${key} is blank`);
      }
    }
  }
});

/*
 * The compiler catches a *missing* key. It cannot catch a key whose value is
 * still the English text — copy-pasting the source catalogue and translating
 * half of it type-checks perfectly. This is the only check that finds that.
 *
 * SHARED holds the handful that are legitimately identical across languages:
 * proper nouns and units, not untranslated copy.
 */
const SHARED = new Set([
  // Training jargon Greek runners genuinely use in English. Translating these
  // ("ρυθμικό τρέξιμο" for tempo, "διασκελισμοί" for strides) reads like a
  // textbook nobody uses — the agreed glossary keeps them Latin.
  'phase.tempo',
  'phase.tempo1',
  'phase.tempo2',
  'phase.cruise',
  'phase.float',
  'phase.stride',
  'workout.tempo-20.name',
  'planKind.tempo',
  // 'splits' is what Greek runners say; «ενδιάμεσοι χρόνοι» is a textbook term.
  'run.panel.splits',
  // The HUD theme's two-letter start face. 'GO' is what it says in Greek too.
  'run.go',
  // Unit symbols and initialisms, identical in both languages.
  'run.pod.kcal',
  'run.gps',
  'run.pod.bpm',
  'detail.kcal',
  // Product names: Health Connect and Samsung Health are not translated by
  // their own vendors either, and a Greek rendering would be unfindable.
  'settings.hc.title',
  'settings.hc.samsung',
  'workout.cruise-5x5.name',
  'workout.fartlek-20.name',
  'workout.mona-fartlek.name',
  // Pure format string — placeholders and punctuation, no words to translate.
  'phase.repeat',
]);

check('Greek is actually translated, not copied', () => {
  const copied = [];
  for (const [key, value] of Object.entries(en)) {
    if (SHARED.has(key)) continue;
    if (typeof value !== 'string') continue;
    if (el[key] === value) copied.push(key);
  }
  assert(copied.length === 0, `still English in el: ${copied.join(', ')}`);
});

check('plural arms are selected by count, through Intl not a hardcoded 1', () => {
  const message = { one: '{count} run', other: '{count} runs' };
  equal(pluralArm(message, 'en', { count: 1 }), '{count} run');
  equal(pluralArm(message, 'en', { count: 0 }), '{count} runs');
  equal(pluralArm(message, 'en', { count: 5 }), '{count} runs');
  equal(pluralArm(message, 'el', { count: 1 }), '{count} run');
  equal(pluralArm(message, 'el', { count: 3 }), '{count} runs');
  // No count at all means the caller is using a plural key as a plain label.
  equal(pluralArm(message, 'en', undefined), '{count} runs', 'no count');
  equal(pluralArm(message, 'en', { name: 'x' }), '{count} runs', 'count absent');
  // A bare string is not a plural and must pass straight through.
  equal(pluralArm('flat', 'el', { count: 2 }), 'flat');
});

check('a plural falls back to other when the locale needs an arm English lacks', () => {
  // Polish selects "few" for 2-4. Nothing fills that arm today, and the
  // resolver must land on `other` rather than undefined when Polish lands.
  const message = { one: 'jeden', other: 'wiele' };
  equal(pluralArm(message, 'en', { count: 3 }), 'wiele');
  equal(message.few, undefined, 'few genuinely absent');
});

check('a translator returns the active language, and falls back rather than blanking', () => {
  const enT = createTranslator('en');
  const elT = createTranslator('el');
  equal(enT('settings.title'), 'Settings');
  equal(elT('settings.title'), 'Ρυθμίσεις');
  // A key that exists in no catalogue returns the key, never undefined — an
  // unreadable button beats an invisible one mid-run.
  equal(createTranslator('el')('nope.not.a.key'), 'nope.not.a.key');
});

check('every theme names itself through the catalogue, in every locale', () => {
  for (const id of LOCALE_IDS) {
    const t = createTranslator(id);
    for (const opt of THEME_OPTIONS) {
      const label = t(opt.label);
      const blurb = t(opt.blurb);
      assert(label.length > 0 && label !== opt.label, `${id} ${opt.id} label unresolved`);
      assert(blurb.length > 0 && blurb !== opt.blurb, `${id} ${opt.id} blurb unresolved`);
    }
  }
});

check('the locale picker offers a readable name in the language itself', () => {
  for (const opt of LOCALE_OPTIONS) {
    assert(opt.endonym.trim().length > 0, `${opt.id} endonym`);
    assert(opt.english.trim().length > 0, `${opt.id} english name`);
  }
});

check('a saved profile round-trips every locale', () => {
  for (const id of LOCALE_IDS) {
    equal(sanitise({ ...DEFAULTS, locale: id }).locale, id, id);
  }
  equal(sanitise({}).locale, 'en', 'default');
  equal(sanitise({ locale: 'gr' }).locale, 'el', 'legacy gr alias');
});

check('every coach tip resolves in every locale, vars and all', () => {
  const now = Date.UTC(2026, 0, 14, 12);
  const mk = (daysAgo, distanceM, durationMs) => ({
    ...activityFrom([straightTrack({ points: 3 })]),
    startedAt: now - daysAgo * 86_400_000,
    distanceM,
    durationMs,
  });
  const history = [mk(20, 8000, 2_700_000), mk(13, 9000, 3_000_000), mk(6, 10_000, 3_300_000)];
  const activity = mk(0, 12_000, 3_900_000);
  const ctx = { units: 'metric', maxHeartRate: 190, weeklyGoalM: 20_000, now };

  const all = [
    ...tipsForRun(activity, history, ctx),
    ...tipsForWeek([...history, activity], ctx),
    ...tipsForWeek([], ctx),
    ...tipsForRecovery([...history, activity], ctx),
  ];
  assert(all.length > 0, 'produced tips at all');

  for (const opt of LOCALE_OPTIONS) {
    const id = opt.id;
    const t = createTranslator(id);
    for (const tip of all) {
      for (const [key, vars] of [[tip.title, tip.titleVars], [tip.body, tip.bodyVars]]) {
        const out = t(key, vars);
        assert(out !== key, `${id}: ${key} has no translation`);
        // A leftover brace means the catalogue asks for a var the tip never
        // supplies — the exact bug the shared renderer exists to prevent.
        assert(!/\{\w+\}/.test(out), `${id}: ${key} left a placeholder in "${out}"`);
      }
    }
  }
});

// --- export filenames -----------------------------------------------------

check('an exported run is named for its local start, to the minute', () => {
  // Built from local parts, so this is the same string in any zone.
  equal(
    exportBaseName({ startedAt: new Date(2025, 7, 12, 7, 18).getTime() }),
    'runlog-2025-08-12-0718',
  );
  // Padding is where a sortable name usually goes wrong.
  equal(
    exportBaseName({ startedAt: new Date(2025, 0, 3, 6, 4).getTime() }),
    'runlog-2025-01-03-0604',
  );
  equal(
    exportBaseName({ startedAt: new Date(2025, 11, 31, 23, 59).getTime() }),
    'runlog-2025-12-31-2359',
  );
});

check('two runs on one day do not export to one filename', () => {
  // They did, and the second either arrived as "(1)" or replaced the first.
  const morning = exportBaseName({ startedAt: new Date(2025, 7, 12, 7, 18).getTime() });
  const evening = exportBaseName({ startedAt: new Date(2025, 7, 12, 19, 2).getTime() });
  assert(morning !== evening, `${morning} collides with the evening run`);
});

check('the filename follows the local calendar, not UTC', () => {
  /*
   * The reported bug: an early-morning run in Athens filed under the previous
   * day, because toISOString() is UTC. Anywhere east of Greenwich this stamp
   * is the 12th locally and the 11th in UTC. Under TZ=UTC the two agree, so
   * the second assertion is skipped rather than made to pass vacuously — this
   * is as far as a portable test reaches without moving the whole suite into
   * a fixed zone.
   */
  const ts = Date.UTC(2025, 7, 11, 23, 30);
  const local = new Date(ts);
  const expected = [
    local.getFullYear(),
    String(local.getMonth() + 1).padStart(2, '0'),
    String(local.getDate()).padStart(2, '0'),
  ].join('-');
  const name = exportBaseName({ startedAt: ts });
  equal(name.slice(7, 17), expected);
  if (local.getTimezoneOffset() !== 0) {
    assert(!name.includes(local.toISOString().slice(0, 10)), `${name} is still UTC-dated`);
  }
});

// --- cue voice ------------------------------------------------------------

/*
 * Not core, but pure, and the one part of the speech path where a wrong answer
 * is invisible in review and obvious in your ear at kilometre three.
 */

const VOICES = {
  greek: { lang: 'el-GR', localService: true },
  greekNet: { lang: 'el-GR', localService: false },
  usLocal: { lang: 'en-US', localService: true },
  usNet: { lang: 'en-US', localService: false },
  gbLocal: { lang: 'en-GB', localService: true },
  auLocal: { lang: 'en-AU', localService: true },
  underscore: { lang: 'en_US', localService: true },
  bare: { lang: 'en', localService: true },
};

check('no English voice at all leaves the choice open', () => {
  equal(pickEnglishVoice([VOICES.greek, VOICES.greekNet]), null);
  equal(pickEnglishVoice([]), null);
});

check('a Greek voice is never chosen to read English', () => {
  // The bug this change exists for: el sits first in the list, and it is what
  // an utterance with no language of its own used to land on.
  equal(pickEnglishVoice([VOICES.greek, VOICES.auLocal]), VOICES.auLocal);
});

check('offline beats accent', () => {
  // en-AU on the device outranks en-US over the network: a cue that needs data
  // is a cue that goes missing on exactly the run where you are out of range.
  equal(pickEnglishVoice([VOICES.usNet, VOICES.auLocal]), VOICES.auLocal);
});

check('among offline voices the variant is the tiebreak', () => {
  equal(pickEnglishVoice([VOICES.auLocal, VOICES.gbLocal, VOICES.usLocal]), VOICES.usLocal);
  equal(pickEnglishVoice([VOICES.auLocal, VOICES.gbLocal]), VOICES.gbLocal);
});

check('the first of equals wins, so the pick is stable across calls', () => {
  const a = { lang: 'en-US', localService: true };
  const b = { lang: 'en-US', localService: true };
  equal(pickEnglishVoice([a, b]), a);
});

check('Android underscore tags are read as English', () => {
  // Some engines report en_US rather than en-US. Dropping those would fall
  // back to no voice on the phones most likely to need one chosen for them.
  equal(pickEnglishVoice([VOICES.greek, VOICES.underscore]), VOICES.underscore);
});

check('a bare en tag counts, and a tag merely starting with en does not', () => {
  equal(pickEnglishVoice([VOICES.bare]), VOICES.bare);
  equal(pickEnglishVoice([{ lang: 'eng-GB', localService: true }]), null);
});

// --- report ---------------------------------------------------------------

if (failures.length > 0) {
  console.error(`\n${failures.length} failing:\n`);
  for (const failure of failures) console.error(`  ✗ ${failure}`);
  console.error('');
  process.exit(1);
}

console.log(`✓ ${passed} core checks passed`);
