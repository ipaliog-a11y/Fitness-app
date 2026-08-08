/**
 * User-saved custom workouts (My Workouts).
 *
 * Built-in presets stay in workout.ts; these are localStorage-only recipes the
 * athlete creates from Custom intervals.
 */

import { newId } from './activity';
import type { PhaseKind, WorkoutPhase, WorkoutTemplate } from './workout';

const KEY = 'runlog:workouts:v1';
const MAX_SAVED = 40;

export interface SavedWorkout {
  id: string;
  name: string;
  blurb: string;
  phases: WorkoutPhase[];
  createdAt: number;
}

export function loadSavedWorkouts(): SavedWorkout[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((w) => sanitiseSavedWorkout(w))
      .filter((w): w is SavedWorkout => w !== null)
      .sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
}

export function saveSavedWorkouts(list: SavedWorkout[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX_SAVED)));
  } catch {
    try {
      localStorage.setItem(KEY, JSON.stringify(list.slice(0, Math.floor(MAX_SAVED / 2))));
    } catch {
      /* quota */
    }
  }
}

export function sanitiseSavedWorkout(raw: unknown): SavedWorkout | null {
  if (!raw || typeof raw !== 'object') return null;
  const w = raw as Partial<SavedWorkout>;
  if (typeof w.id !== 'string' || typeof w.name !== 'string') return null;
  if (!Array.isArray(w.phases) || w.phases.length === 0) return null;
  const phases: WorkoutPhase[] = [];
  for (const p of w.phases) {
    const phase = sanitisePhase(p);
    if (phase) phases.push(phase);
  }
  if (phases.length === 0) return null;
  return {
    id: w.id,
    name: w.name.trim() || 'Saved workout',
    blurb: typeof w.blurb === 'string' ? w.blurb : '',
    phases,
    createdAt: typeof w.createdAt === 'number' ? w.createdAt : Date.now(),
  };
}

function sanitisePhase(raw: unknown): WorkoutPhase | null {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as Partial<WorkoutPhase> & { target?: { type?: string; ms?: number; m?: number } };
  const kind = p.kind as PhaseKind | undefined;
  if (
    kind !== 'warmup' &&
    kind !== 'work' &&
    kind !== 'rest' &&
    kind !== 'cooldown' &&
    kind !== 'steady'
  ) {
    return null;
  }
  if (typeof p.label !== 'string') return null;
  if (!p.target || typeof p.target !== 'object') return null;
  if (p.target.type === 'distance' && typeof p.target.m === 'number' && p.target.m > 0) {
    return { kind, label: p.label, target: { type: 'distance', m: p.target.m } };
  }
  if (p.target.type === 'time' && typeof p.target.ms === 'number' && p.target.ms >= 0) {
    return { kind, label: p.label, target: { type: 'time', ms: p.target.ms } };
  }
  return null;
}

export function templateFromSaved(saved: SavedWorkout): WorkoutTemplate {
  return {
    id: saved.id,
    name: saved.name,
    blurb: saved.blurb,
    phases: saved.phases.map((p) => ({ ...p, target: { ...p.target } })),
  };
}

/** Persist a template under My Workouts (new id). */
export function addSavedWorkout(template: WorkoutTemplate, name?: string): SavedWorkout {
  const list = loadSavedWorkouts();
  const saved: SavedWorkout = {
    id: `my-${newId()}`,
    name: (name?.trim() || template.name || 'My workout').slice(0, 48),
    blurb: template.blurb,
    phases: template.phases.map((p) => ({ ...p, target: { ...p.target } })),
    createdAt: Date.now(),
  };
  saveSavedWorkouts([saved, ...list.filter((w) => w.id !== saved.id)]);
  return saved;
}

export function deleteSavedWorkout(id: string): void {
  saveSavedWorkouts(loadSavedWorkouts().filter((w) => w.id !== id));
}

export function savedWorkoutById(id: string): SavedWorkout | null {
  return loadSavedWorkouts().find((w) => w.id === id) ?? null;
}
