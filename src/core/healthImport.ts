/**
 * Map Health Connect / HealthKit workout summaries into RunLog activities.
 *
 * Pure: no Capacitor, no DOM. The platform layer fetches workouts; this builds
 * storable records. GPS routes are usually missing — Samsung often shares
 * session totals only.
 */

import { newId, type Activity, type HeartSample } from './activity';
import { buildHeartReport } from './heart';

/** Subset of plugin Workout we actually need. */
export interface ImportableWorkout {
  workoutType: string;
  duration: number; // seconds
  totalEnergyBurned?: number;
  totalDistance?: number;
  startDate: string;
  endDate: string;
  sourceName?: string;
  sourceId?: string;
  platformId?: string;
}

export interface HealthImportOptions {
  /** Only these workout types (plugin ids). Empty = all running-like. */
  types?: string[];
  /** Max HR for freezing zone report when HR samples are attached. */
  maxHeartRate?: number;
  /** Optional HR series already clipped to the session (ms timestamps). */
  heartByWorkoutId?: Record<string, HeartSample[]>;
}

/** Running-ish types we import by default. */
export const DEFAULT_RUN_TYPES = new Set([
  'running',
  'runningTreadmill',
  'walking',
  'hiking',
  'trailRunning',
  'other', // some watches label outdoor runs poorly
]);

export function isRunLikeWorkout(type: string, allowed?: Set<string>): boolean {
  const set = allowed ?? DEFAULT_RUN_TYPES;
  if (set.has(type)) return true;
  // Catch vendor-specific strings.
  const t = type.toLowerCase();
  return t.includes('run') || t.includes('walk') || t.includes('hike') || t.includes('jog');
}

/** Stable id so re-importing the same Health Connect session is skipped. */
export function stableHealthImportId(w: ImportableWorkout): string {
  if (w.platformId && w.platformId.trim()) {
    return `hc-${w.platformId.trim().slice(0, 80)}`;
  }
  const start = Date.parse(w.startDate) || 0;
  const end = Date.parse(w.endDate) || start;
  const dist = Math.round(w.totalDistance ?? 0);
  const src = (w.sourceId || w.sourceName || 'health').replace(/\W+/g, '').slice(0, 24);
  return `hc-${src}-${start}-${end}-${dist}`;
}

export function activityFromWorkout(
  w: ImportableWorkout,
  options: HealthImportOptions = {},
): Activity | null {
  if (!isRunLikeWorkout(w.workoutType, options.types ? new Set(options.types) : undefined)) {
    return null;
  }

  const startedAt = Date.parse(w.startDate);
  const endedAt = Date.parse(w.endDate);
  if (!Number.isFinite(startedAt)) return null;

  let durationMs =
    Number.isFinite(endedAt) && endedAt > startedAt
      ? endedAt - startedAt
      : Math.max(0, Math.round((w.duration || 0) * 1000));
  // Prefer explicit duration when wall span is missing.
  if (durationMs <= 0 && w.duration > 0) durationMs = Math.round(w.duration * 1000);
  if (durationMs < 30_000 && (w.totalDistance ?? 0) < 50) return null; // noise

  const distanceM = Math.max(0, w.totalDistance ?? 0);
  const treadmill =
    w.workoutType === 'runningTreadmill' ||
    /treadmill/i.test(w.workoutType) ||
    /treadmill/i.test(w.sourceName ?? '');

  const key = w.platformId || stableHealthImportId(w);
  const heart = options.heartByWorkoutId?.[key] ?? [];
  const maxHr = options.maxHeartRate ?? 190;
  const heartReport = heart.length > 0 ? buildHeartReport(heart, maxHr) : null;

  const sourceLabel = w.sourceName?.trim() || 'Health Connect';
  const typeLabel =
    w.workoutType === 'runningTreadmill'
      ? 'Treadmill'
      : w.workoutType === 'walking'
        ? 'Walk'
        : w.workoutType === 'hiking'
          ? 'Hike'
          : 'Run';

  return {
    id: stableHealthImportId(w),
    mode: treadmill ? 'treadmill' : 'outdoor',
    startedAt,
    durationMs,
    distanceM,
    distanceSource: distanceM > 0 ? 'manual' : 'manual',
    segments: [],
    heart,
    heartReport,
    steps: null,
    inclinePercent: null,
    caloriesKcal:
      typeof w.totalEnergyBurned === 'number' && Number.isFinite(w.totalEnergyBurned)
        ? Math.round(w.totalEnergyBurned)
        : null,
    goal: null,
    manualLaps: [],
    shoeId: null,
    workoutId: null,
    workoutName: null,
    note: `Imported from ${sourceLabel} · ${typeLabel}`,
  };
}

export interface HealthImportPlan {
  toImport: Activity[];
  skippedDuplicate: number;
  skippedNotRun: number;
  skippedInvalid: number;
}

/**
 * Build activities to insert, skipping ids already present and non-runs.
 */
export function planHealthImport(
  workouts: ImportableWorkout[],
  existingIds: Set<string>,
  options: HealthImportOptions = {},
): HealthImportPlan {
  let skippedDuplicate = 0;
  let skippedNotRun = 0;
  let skippedInvalid = 0;
  const toImport: Activity[] = [];
  const seen = new Set<string>();

  for (const w of workouts) {
    if (!isRunLikeWorkout(w.workoutType, options.types ? new Set(options.types) : undefined)) {
      skippedNotRun++;
      continue;
    }
    const activity = activityFromWorkout(w, options);
    if (!activity) {
      skippedInvalid++;
      continue;
    }
    if (existingIds.has(activity.id) || seen.has(activity.id)) {
      skippedDuplicate++;
      continue;
    }
    seen.add(activity.id);
    toImport.push(activity);
  }

  return { toImport, skippedDuplicate, skippedNotRun, skippedInvalid };
}

// Keep newId available if we ever need non-stable ids for manual clones.
void newId;
