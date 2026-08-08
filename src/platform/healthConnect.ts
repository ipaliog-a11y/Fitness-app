/**
 * Health Connect (Android) / HealthKit (iOS) bridge for importing workouts.
 *
 * Samsung Health → Health Connect → this module → Activity records.
 * Requires Capacitor + @capgo/capacitor-health; no-ops with a clear error on web.
 */

import { Capacitor } from '@capacitor/core';
import { Health, type Workout } from '@capgo/capacitor-health';
import {
  planHealthImport,
  type HealthImportPlan,
  type ImportableWorkout,
} from '../core/healthImport';
import type { Activity } from '../core/activity';
import { allActivities, saveActivity } from '../core/db';
import { loadProfile } from '../core/settings';

export function healthConnectSupported(): boolean {
  return Capacitor.isNativePlatform();
}

export async function healthConnectAvailable(): Promise<{
  available: boolean;
  reason?: string;
}> {
  if (!healthConnectSupported()) {
    return {
      available: false,
      reason: 'Health Connect import only works in the Android app, not in the browser.',
    };
  }
  try {
    const result = await Health.isAvailable();
    return {
      available: Boolean(result.available),
      reason: result.reason,
    };
  } catch (error) {
    return {
      available: false,
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function requestHealthConnectAccess(): Promise<void> {
  await Health.requestAuthorization({
    read: ['workouts', 'distance', 'calories', 'heartRate'],
    write: [],
    requestHistoryAccess: true,
  });
}

function toImportable(w: Workout): ImportableWorkout {
  return {
    workoutType: w.workoutType,
    duration: w.duration,
    totalEnergyBurned: w.totalEnergyBurned,
    totalDistance: w.totalDistance,
    startDate: w.startDate,
    endDate: w.endDate,
    sourceName: w.sourceName,
    sourceId: w.sourceId,
    platformId: w.platformId,
  };
}

export interface HealthFetchWindow {
  /** Inclusive start (ms epoch). */
  startMs: number;
  /** Exclusive end (ms epoch). Default: now. */
  endMs?: number;
}

/**
 * Fetch workouts from Health Connect (paginated).
 * Prefer `window`; `days` is a convenience lookback from now.
 */
export async function fetchHealthWorkouts(
  daysOrWindow: number | HealthFetchWindow = 90,
): Promise<ImportableWorkout[]> {
  const endMs =
    typeof daysOrWindow === 'number'
      ? Date.now()
      : (daysOrWindow.endMs ?? Date.now());
  const startMs =
    typeof daysOrWindow === 'number'
      ? endMs - daysOrWindow * 86_400_000
      : daysOrWindow.startMs;
  const startDate = new Date(startMs).toISOString();
  const endDate = new Date(endMs).toISOString();

  const all: ImportableWorkout[] = [];
  let anchor: string | undefined;

  // Cap pages so a huge history cannot hang the UI forever.
  for (let page = 0; page < 20; page++) {
    const result = await Health.queryWorkouts({
      startDate,
      endDate,
      limit: 50,
      ascending: false,
      ...(anchor ? { anchor } : {}),
    });
    for (const w of result.workouts) {
      all.push(toImportable(w));
    }
    if (!result.anchor || result.workouts.length === 0) break;
    anchor = result.anchor;
  }

  return all;
}

export interface HealthImportResult extends HealthImportPlan {
  imported: number;
}

export interface HealthPreviewResult extends HealthImportPlan {
  /** Candidates you can tick before import. */
  candidates: Activity[];
}

async function ensureHealthReady(): Promise<void> {
  const availability = await healthConnectAvailable();
  if (!availability.available) {
    throw new Error(availability.reason || 'Health Connect is not available on this device.');
  }
  await requestHealthConnectAccess();
}

/**
 * Pull + plan only (no writes). Use for date-range preview + multi-select UI.
 */
export async function previewHealthConnectImport(options?: {
  days?: number;
  startMs?: number;
  endMs?: number;
}): Promise<HealthPreviewResult> {
  await ensureHealthReady();

  const endMs = options?.endMs ?? Date.now();
  const startMs =
    options?.startMs ??
    endMs - (options?.days ?? 90) * 86_400_000;

  const workouts = await fetchHealthWorkouts({ startMs, endMs });
  const existing = new Set((await allActivities()).map((a) => a.id));
  const profile = loadProfile();
  const plan = planHealthImport(workouts, existing, {
    maxHeartRate: profile.maxHeartRate,
  });

  return {
    ...plan,
    candidates: plan.toImport,
  };
}

/** Persist a chosen subset from a preview (by activity id). */
export async function importSelectedHealthActivities(
  activities: Activity[],
): Promise<HealthImportResult> {
  const existing = new Set((await allActivities()).map((a) => a.id));
  let skippedDuplicate = 0;
  let imported = 0;
  const toImport: Activity[] = [];

  for (const activity of activities) {
    if (existing.has(activity.id)) {
      skippedDuplicate++;
      continue;
    }
    await saveActivity(activity);
    existing.add(activity.id);
    toImport.push(activity);
    imported++;
  }

  return {
    toImport,
    skippedDuplicate,
    skippedNotRun: 0,
    skippedInvalid: 0,
    imported,
  };
}

/**
 * Authorize (if needed), pull workouts, import run-like sessions not already stored.
 * Prefer preview + importSelected for UI with choice; this remains a one-shot path.
 */
export async function importRunsFromHealthConnect(options?: {
  days?: number;
  startMs?: number;
  endMs?: number;
  /** When set, only these activity ids from the planned set are saved. */
  onlyIds?: string[];
}): Promise<HealthImportResult> {
  const preview = await previewHealthConnectImport(options);
  let list = preview.candidates;
  if (options?.onlyIds && options.onlyIds.length > 0) {
    const want = new Set(options.onlyIds);
    list = list.filter((a) => want.has(a.id));
  }

  const result = await importSelectedHealthActivities(list);
  return {
    ...preview,
    toImport: result.toImport,
    imported: result.imported,
    skippedDuplicate: preview.skippedDuplicate + result.skippedDuplicate,
  };
}

export async function openHealthConnectSettings(): Promise<void> {
  if (!healthConnectSupported()) return;
  try {
    await Health.openHealthConnectSettings();
  } catch {
    /* plugin may not implement on all versions */
  }
}
