/**
 * Full device backup / restore.
 *
 * Activities live in IndexedDB; profile, shoes, routes and active plan live in
 * localStorage. A single JSON file holds all of it so a phone wipe or Android
 * port can restore the whole training history, not just runs.
 */

import type { Activity } from './activity';
import { SCHEMA_VERSION as ACTIVITY_SCHEMA_VERSION } from './activity';
import { allActivities, clearAll, saveActivity } from './db';
import { sanitiseGoal } from './goal';
import { sanitiseHeartReport } from './heart';
import {
  loadActivePlan,
  saveActivePlan,
  type ActivePlanState,
  planById,
} from './plans';
import { loadRoutes, saveRoutes, sanitiseRoute, type SavedRoute } from './routes';
import { loadProfile, saveProfile, sanitise, type Profile } from './settings';
import { loadShoes, saveShoes, sanitiseShoe, type Shoe } from './shoes';
import {
  loadWeightStore,
  saveWeightStore,
  sanitiseWeightStore,
  type WeightStore,
} from './weight';

/** Version of the backup *file* shape (not the activity record). */
export const BACKUP_FORMAT_VERSION = 1;

export const BACKUP_FORMAT = 'runlog-backup' as const;

export interface RunLogBackup {
  format: typeof BACKUP_FORMAT;
  /** Backup file schema version. */
  v: number;
  /** Activity record schema version used when exporting. */
  activitySchema: number;
  exportedAt: number;
  activities: Activity[];
  profile: Profile;
  shoes: Shoe[];
  routes: SavedRoute[];
  activePlan: ActivePlanState | null;
  weight: WeightStore;
}

export interface BackupImportResult {
  activitiesImported: number;
  activitiesSkipped: number;
  shoes: number;
  routes: number;
  profileRestored: boolean;
  planRestored: boolean;
  weightRestored: boolean;
  /** True when the file was a full backup (vs legacy activities-only JSON). */
  fullBackup: boolean;
}

/** Build a full backup object from current device state. */
export async function collectBackup(): Promise<RunLogBackup> {
  return {
    format: BACKUP_FORMAT,
    v: BACKUP_FORMAT_VERSION,
    activitySchema: ACTIVITY_SCHEMA_VERSION,
    exportedAt: Date.now(),
    activities: await allActivities(),
    profile: loadProfile(),
    shoes: loadShoes(),
    routes: loadRoutes(),
    activePlan: loadActivePlan(),
    weight: loadWeightStore(),
  };
}

export function serializeBackup(backup: RunLogBackup): string {
  return JSON.stringify(backup, null, 2);
}

export async function exportFullBackup(): Promise<string> {
  return serializeBackup(await collectBackup());
}

function sanitiseActivity(raw: unknown): Activity | null {
  if (!raw || typeof raw !== 'object') return null;
  const a = raw as Partial<Activity>;
  if (typeof a.id !== 'string' || typeof a.distanceM !== 'number') return null;
  if (typeof a.startedAt !== 'number' || typeof a.durationMs !== 'number') return null;
  const mode = a.mode === 'treadmill' ? 'treadmill' : 'outdoor';
  const source: Activity['distanceSource'] =
    a.distanceSource === 'steps' ||
    a.distanceSource === 'manual' ||
    a.distanceSource === 'sensor' ||
    a.distanceSource === 'gps'
      ? a.distanceSource
      : mode === 'outdoor'
        ? 'gps'
        : 'steps';

  return {
    id: a.id,
    mode,
    startedAt: a.startedAt,
    durationMs: Math.max(0, a.durationMs),
    distanceM: Math.max(0, a.distanceM),
    distanceSource: source,
    segments: Array.isArray(a.segments) ? a.segments : [],
    heart: Array.isArray(a.heart) ? a.heart : [],
    heartReport: sanitiseHeartReport(a.heartReport),
    steps: typeof a.steps === 'number' && Number.isFinite(a.steps) ? a.steps : null,
    inclinePercent:
      typeof a.inclinePercent === 'number' && Number.isFinite(a.inclinePercent)
        ? a.inclinePercent
        : null,
    caloriesKcal:
      typeof a.caloriesKcal === 'number' && Number.isFinite(a.caloriesKcal)
        ? a.caloriesKcal
        : null,
    goal: sanitiseGoal(a.goal),
    manualLaps: Array.isArray(a.manualLaps) ? a.manualLaps : [],
    shoeId: typeof a.shoeId === 'string' ? a.shoeId : null,
    workoutId: typeof a.workoutId === 'string' ? a.workoutId : null,
    workoutName: typeof a.workoutName === 'string' ? a.workoutName : null,
    note: typeof a.note === 'string' ? a.note : '',
  };
}

function sanitiseActivePlan(raw: unknown): ActivePlanState | null {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as Partial<ActivePlanState>;
  if (typeof p.planId !== 'string' || typeof p.startedWeekAt !== 'number') return null;
  if (!planById(p.planId)) return null;
  return {
    id: typeof p.id === 'string' ? p.id : `restored-${Date.now()}`,
    planId: p.planId,
    startedWeekAt: p.startedWeekAt,
    completed: Array.isArray(p.completed)
      ? p.completed.filter((x): x is string => typeof x === 'string')
      : [],
  };
}

/**
 * Parse a backup or legacy activities-only JSON file and apply it.
 *
 * Activities: merge by id (existing ids skipped).
 * Full backup also restores profile, shoes, routes, and active plan.
 */
export async function importBackup(text: string): Promise<BackupImportResult> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('That file is not valid JSON.');
  }
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('That file is not a RunLog backup.');
  }

  const root = parsed as Record<string, unknown>;
  const fullBackup =
    root.format === BACKUP_FORMAT ||
    (Array.isArray(root.activities) &&
      (root.profile !== undefined || root.shoes !== undefined || root.routes !== undefined));

  if (!Array.isArray(root.activities)) {
    throw new Error('No activities in that file.');
  }

  const existing = new Set((await allActivities()).map((a) => a.id));
  let activitiesImported = 0;
  let activitiesSkipped = 0;

  for (const raw of root.activities) {
    const activity = sanitiseActivity(raw);
    if (!activity) {
      activitiesSkipped++;
      continue;
    }
    if (existing.has(activity.id)) {
      activitiesSkipped++;
      continue;
    }
    await saveActivity(activity);
    existing.add(activity.id);
    activitiesImported++;
  }

  let shoes = 0;
  let routes = 0;
  let profileRestored = false;
  let planRestored = false;
  let weightRestored = false;
  let restoredProfile: Profile | null = null;

  if (fullBackup) {
    if (root.profile !== undefined) {
      restoredProfile = sanitise(root.profile);
      saveProfile(restoredProfile);
      profileRestored = true;
    }

    if (Array.isArray(root.shoes)) {
      const next: Shoe[] = [];
      const seen = new Set<string>();
      // Prefer backup shoes, then keep any local shoes with new ids.
      for (const raw of root.shoes) {
        const s = sanitiseShoe(raw);
        if (s && !seen.has(s.id)) {
          next.push(s);
          seen.add(s.id);
        }
      }
      for (const s of loadShoes()) {
        if (!seen.has(s.id)) {
          next.push(s);
          seen.add(s.id);
        }
      }
      saveShoes(next);
      shoes = next.length;
    }

    if (Array.isArray(root.routes)) {
      const next: SavedRoute[] = [];
      const seen = new Set<string>();
      for (const raw of root.routes) {
        const r = sanitiseRoute(raw);
        if (r && !seen.has(r.id)) {
          next.push(r);
          seen.add(r.id);
        }
      }
      for (const r of loadRoutes()) {
        if (!seen.has(r.id)) {
          next.push(r);
          seen.add(r.id);
        }
      }
      saveRoutes(next);
      routes = next.length;
    }

    if (root.activePlan !== undefined) {
      const plan = sanitiseActivePlan(root.activePlan);
      saveActivePlan(plan);
      planRestored = plan !== null || root.activePlan === null;
    }

    if (root.weight !== undefined) {
      const local = loadWeightStore();
      const incoming = sanitiseWeightStore(root.weight);
      const seen = new Set(incoming.entries.map((e) => e.id));
      const merged = sanitiseWeightStore({
        goalKg: incoming.goalKg ?? local.goalKg,
        entries: [
          ...incoming.entries,
          ...local.entries.filter((e) => !seen.has(e.id)),
        ],
      });
      saveWeightStore(merged);
      weightRestored = true;
    }
  }

  void restoredProfile;

  return {
    activitiesImported,
    activitiesSkipped,
    shoes,
    routes,
    profileRestored,
    planRestored,
    weightRestored,
    fullBackup,
  };
}

/** Wipe all runs and local settings stores (used by Settings danger zone). */
export async function wipeAllLocalData(): Promise<void> {
  await clearAll();
  saveShoes([]);
  saveRoutes([]);
  saveActivePlan(null);
  saveWeightStore({ entries: [], goalKg: null });
  // Profile intentionally kept — body stats are not "runs".
}

/** Pure helper for tests: round-trip shape without IndexedDB. */
export function isFullBackupShape(value: unknown): value is RunLogBackup {
  if (!value || typeof value !== 'object') return false;
  const v = value as Partial<RunLogBackup>;
  return (
    v.format === BACKUP_FORMAT &&
    typeof v.v === 'number' &&
    Array.isArray(v.activities) &&
    typeof v.exportedAt === 'number'
  );
}
