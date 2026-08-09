/**
 * Lifetime mileage and run counts for Profile and achievements.
 *
 * Source of truth is the activity history; we also cache a snapshot in
 * localStorage so Profile can show totals without waiting on IndexedDB, and so
 * delete/import can re-sync cleanly.
 */

import type { Activity } from './activity';

const KEY = 'runlog:lifetime:v1';

export interface LifetimeStats {
  /** Sum of all saved run distances (metres). */
  distanceM: number;
  /** Number of saved runs. */
  runs: number;
  outdoorRuns: number;
  treadmillRuns: number;
  /** Longest single saved run (metres). */
  longestRunM: number;
  /** Epoch ms when this snapshot was last written. */
  updatedAt: number;
}

export const EMPTY_LIFETIME: LifetimeStats = {
  distanceM: 0,
  runs: 0,
  outdoorRuns: 0,
  treadmillRuns: 0,
  longestRunM: 0,
  updatedAt: 0,
};

export function computeLifetime(activities: Activity[]): LifetimeStats {
  let distanceM = 0;
  let outdoorRuns = 0;
  let treadmillRuns = 0;
  let longestRunM = 0;
  for (const a of activities) {
    distanceM += a.distanceM;
    if (a.mode === 'outdoor') outdoorRuns += 1;
    else treadmillRuns += 1;
    if (a.distanceM > longestRunM) longestRunM = a.distanceM;
  }
  return {
    distanceM,
    runs: activities.length,
    outdoorRuns,
    treadmillRuns,
    longestRunM,
    updatedAt: Date.now(),
  };
}

export function loadLifetime(): LifetimeStats {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...EMPTY_LIFETIME };
    const p = JSON.parse(raw) as Partial<LifetimeStats>;
    return {
      distanceM: Math.max(0, Number(p.distanceM) || 0),
      runs: Math.max(0, Math.floor(Number(p.runs) || 0)),
      outdoorRuns: Math.max(0, Math.floor(Number(p.outdoorRuns) || 0)),
      treadmillRuns: Math.max(0, Math.floor(Number(p.treadmillRuns) || 0)),
      longestRunM: Math.max(0, Number(p.longestRunM) || 0),
      updatedAt: typeof p.updatedAt === 'number' ? p.updatedAt : 0,
    };
  } catch {
    return { ...EMPTY_LIFETIME };
  }
}

export function saveLifetime(stats: LifetimeStats): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(stats));
  } catch {
    /* private mode */
  }
}

/** Recompute from history and persist. */
export function syncLifetime(activities: Activity[]): LifetimeStats {
  const next = computeLifetime(activities);
  saveLifetime(next);
  return next;
}
