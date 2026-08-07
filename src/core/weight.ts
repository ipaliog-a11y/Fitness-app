/**
 * Body-weight log and goal — separate from run history, still local-only.
 *
 * Profile.weightKg stays the "current" mass used for calorie estimates; the log
 * is the history. Adding a reading updates both.
 */

import { newId } from './activity';

const KEY = 'runlog:weight:v1';

export interface WeightEntry {
  id: string;
  /** Epoch ms (usually local midnight or the moment logged). */
  at: number;
  weightKg: number;
  note: string;
}

export interface WeightStore {
  entries: WeightEntry[];
  /** Target body weight in kg; null when no goal. */
  goalKg: number | null;
}

const EMPTY: WeightStore = { entries: [], goalKg: null };

function clampKg(kg: number): number {
  if (!Number.isFinite(kg)) return 70;
  return Math.min(250, Math.max(25, kg));
}

export function sanitiseWeightEntry(raw: unknown): WeightEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  const e = raw as Partial<WeightEntry>;
  if (typeof e.weightKg !== 'number' || !Number.isFinite(e.weightKg) || e.weightKg <= 0) {
    return null;
  }
  return {
    id: typeof e.id === 'string' ? e.id : newId(),
    at: typeof e.at === 'number' && Number.isFinite(e.at) ? e.at : Date.now(),
    weightKg: clampKg(e.weightKg),
    note: typeof e.note === 'string' ? e.note.trim().slice(0, 120) : '',
  };
}

export function sanitiseWeightStore(raw: unknown): WeightStore {
  if (!raw || typeof raw !== 'object') return { ...EMPTY, entries: [] };
  const s = raw as Partial<WeightStore>;
  const entries = Array.isArray(s.entries)
    ? s.entries
        .map(sanitiseWeightEntry)
        .filter((e): e is WeightEntry => e !== null)
        .sort((a, b) => b.at - a.at)
    : [];
  const goalKg =
    typeof s.goalKg === 'number' && Number.isFinite(s.goalKg) && s.goalKg > 0
      ? clampKg(s.goalKg)
      : null;
  return { entries, goalKg };
}

export function loadWeightStore(): WeightStore {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...EMPTY, entries: [] };
    return sanitiseWeightStore(JSON.parse(raw));
  } catch {
    return { ...EMPTY, entries: [] };
  }
}

export function saveWeightStore(store: WeightStore): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(sanitiseWeightStore(store)));
  } catch {
    /* private mode */
  }
}

export function latestWeightKg(store: WeightStore = loadWeightStore()): number | null {
  if (store.entries.length === 0) return null;
  const sorted = [...store.entries].sort((a, b) => b.at - a.at);
  return sorted[0]?.weightKg ?? null;
}

/** Newest first. */
export function weightEntriesChronological(store: WeightStore): WeightEntry[] {
  return [...store.entries].sort((a, b) => a.at - b.at);
}

export function addWeightEntry(
  store: WeightStore,
  input: { weightKg: number; at?: number; note?: string },
): WeightStore {
  const entry: WeightEntry = {
    id: newId(),
    at: input.at ?? Date.now(),
    weightKg: clampKg(input.weightKg),
    note: (input.note ?? '').trim().slice(0, 120),
  };
  return sanitiseWeightStore({
    ...store,
    entries: [entry, ...store.entries],
  });
}

export function deleteWeightEntry(store: WeightStore, id: string): WeightStore {
  return sanitiseWeightStore({
    ...store,
    entries: store.entries.filter((e) => e.id !== id),
  });
}

export function setWeightGoal(store: WeightStore, goalKg: number | null): WeightStore {
  return sanitiseWeightStore({
    ...store,
    goalKg: goalKg === null || !(goalKg > 0) ? null : goalKg,
  });
}

/** Display kg or lb from stored kg. */
export function toDisplayWeight(kg: number, units: 'metric' | 'imperial'): number {
  if (units === 'imperial') return Math.round(kg * 2.20462 * 10) / 10;
  return Math.round(kg * 10) / 10;
}

export function fromDisplayWeight(value: number, units: 'metric' | 'imperial'): number {
  if (units === 'imperial') return value / 2.20462;
  return value;
}

export function weightUnitLabel(units: 'metric' | 'imperial'): string {
  return units === 'metric' ? 'kg' : 'lb';
}

/** Delta from first chronological reading to latest (kg). Negative = lost weight. */
export function weightTrendKg(store: WeightStore): number | null {
  const chrono = weightEntriesChronological(store);
  if (chrono.length < 2) return null;
  return chrono[chrono.length - 1].weightKg - chrono[0].weightKg;
}

/** How far from goal (kg). Positive = still above goal (if goal is lower). */
export function weightToGoalKg(store: WeightStore): number | null {
  if (store.goalKg === null) return null;
  const latest = latestWeightKg(store);
  if (latest === null) return null;
  return latest - store.goalKg;
}
