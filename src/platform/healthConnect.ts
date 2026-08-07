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

/**
 * Fetch workouts from Health Connect (paginated).
 * @param days lookback window (default 90)
 */
export async function fetchHealthWorkouts(days = 90): Promise<ImportableWorkout[]> {
  const end = Date.now();
  const start = end - days * 86_400_000;
  const startDate = new Date(start).toISOString();
  const endDate = new Date(end).toISOString();

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

/**
 * Authorize (if needed), pull workouts, import run-like sessions not already stored.
 */
export async function importRunsFromHealthConnect(options?: {
  days?: number;
}): Promise<HealthImportResult> {
  const availability = await healthConnectAvailable();
  if (!availability.available) {
    throw new Error(availability.reason || 'Health Connect is not available on this device.');
  }

  await requestHealthConnectAccess();

  const workouts = await fetchHealthWorkouts(options?.days ?? 90);
  const existing = new Set((await allActivities()).map((a) => a.id));
  const profile = loadProfile();
  const plan = planHealthImport(workouts, existing, {
    maxHeartRate: profile.maxHeartRate,
  });

  for (const activity of plan.toImport) {
    await saveActivity(activity as Activity);
  }

  return {
    ...plan,
    imported: plan.toImport.length,
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
