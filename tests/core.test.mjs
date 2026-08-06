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
import { splits, bestEffort } from '../src/core/activity.ts';
import { RunSession } from '../src/core/session.ts';
import { summariseHeart, zoneOf, estimateMaxHeartRate, heartTrace } from '../src/core/heart.ts';
import { StepDetector, calibrateStride, estimateStride } from '../src/core/steps.ts';
import {
  startOfWeek,
  weeklyBuckets,
  currentStreak,
  personalRecords,
  totals,
} from '../src/core/stats.ts';
import { sanitise, DEFAULTS } from '../src/core/settings.ts';
import { tipsForRun, tipsForWeek } from '../src/core/coach.ts';
import { project, fitBounds, toScreen, visibleTiles, TILE_SIZE } from '../src/core/mercator.ts';

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
    steps: null,
    inclinePercent: null,
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
});

check('a treadmill distance can be overridden from the console', () => {
  const t0 = 1_700_000_000_000;
  const session = new RunSession({ mode: 'treadmill', strideM: 0.8 }, t0);
  session.start(t0);
  session.addSteps(1000);
  session.setDistance(5000);
  session.finish(t0 + 100_000);
  equal(session.distanceM, 5000);
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

  const oneK = records.find((r) => r.label === '1 km');
  near(oneK.durationMs / 1000, 300, 2, 'best kilometre');
  equal(oneK.activityId, 'fast', 'credited to the fast run');

  const marathon = records.find((r) => r.label === 'Marathon');
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
  equal(records.find((r) => r.label === '5 km').durationMs, null);
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

check('sanitise copes with nothing at all', () => {
  for (const input of [null, undefined, 'nonsense', 42, []]) {
    const profile = sanitise(input);
    equal(profile.units, 'metric');
    assert(Number.isFinite(profile.strideM), 'usable stride');
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
  assert(tips.some((t) => t.body.includes('5.00')), 'mentions the distance');
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
  assert(tips.some((t) => t.title === 'Properly easy'), 'notices an easy run');
});

check('the coach has something to say about an empty history', () => {
  const tips = tipsForWeek([], { units: 'metric', maxHeartRate: 190, weeklyGoalM: 20000, now: Date.now() });
  equal(tips.length, 1);
  equal(tips[0].title, 'Nothing logged yet');
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
  assert(tips.some((t) => t.title === 'Goal met'), 'notices the goal was met');
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

// --- report ---------------------------------------------------------------

if (failures.length > 0) {
  console.error(`\n${failures.length} failing:\n`);
  for (const failure of failures) console.error(`  ✗ ${failure}`);
  console.error('');
  process.exit(1);
}

console.log(`✓ ${passed} core checks passed`);
