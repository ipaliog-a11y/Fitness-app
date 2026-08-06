/**
 * Structured workouts: warm-up, intervals, cool-down.
 *
 * Templates expand into a flat list of phases. A WorkoutRunner tracks progress
 * against moving time and distance so the live screen can show "what now" and
 * auto-advance when a phase is done — pure logic, no DOM.
 */

import { newId } from './activity';

export type PhaseKind = 'warmup' | 'work' | 'rest' | 'cooldown' | 'steady';

export type PhaseTarget =
  | { type: 'time'; ms: number }
  | { type: 'distance'; m: number };

export interface WorkoutPhase {
  kind: PhaseKind;
  label: string;
  target: PhaseTarget;
}

export interface WorkoutTemplate {
  id: string;
  name: string;
  blurb: string;
  /** Expanded phase list (repeats already unrolled). */
  phases: WorkoutPhase[];
}

/** Compact recipe used to build presets. */
export interface WorkoutRecipe {
  id: string;
  name: string;
  blurb: string;
  steps: Array<
    | { kind: PhaseKind; label: string; timeMs: number }
    | { kind: PhaseKind; label: string; distanceM: number }
    | {
        kind: 'repeat';
        times: number;
        work: { label: string; timeMs?: number; distanceM?: number };
        rest: { label: string; timeMs?: number; distanceM?: number };
      }
  >;
}

function phaseFrom(
  kind: PhaseKind,
  label: string,
  timeMs?: number,
  distanceM?: number,
): WorkoutPhase {
  if (distanceM !== undefined && distanceM > 0) {
    return { kind, label, target: { type: 'distance', m: distanceM } };
  }
  return { kind, label, target: { type: 'time', ms: Math.max(0, timeMs ?? 0) } };
}

export function expandRecipe(recipe: WorkoutRecipe): WorkoutTemplate {
  const phases: WorkoutPhase[] = [];
  for (const step of recipe.steps) {
    if (step.kind === 'repeat') {
      for (let i = 1; i <= step.times; i++) {
        phases.push(
          phaseFrom(
            'work',
            `${step.work.label} (${i}/${step.times})`,
            step.work.timeMs,
            step.work.distanceM,
          ),
        );
        phases.push(
          phaseFrom(
            'rest',
            `${step.rest.label} (${i}/${step.times})`,
            step.rest.timeMs,
            step.rest.distanceM,
          ),
        );
      }
    } else if ('distanceM' in step && step.distanceM !== undefined) {
      phases.push(phaseFrom(step.kind, step.label, undefined, step.distanceM));
    } else if ('timeMs' in step) {
      phases.push(phaseFrom(step.kind, step.label, step.timeMs));
    }
  }
  return { id: recipe.id, name: recipe.name, blurb: recipe.blurb, phases };
}

const min = (n: number) => n * 60_000;

/** Built-in presets (Phase B). */
export const WORKOUT_PRESETS: WorkoutTemplate[] = [
  expandRecipe({
    id: 'beginner-walk-run',
    name: 'Beginner walk/run',
    blurb: '8 × 1 min run / 90 s walk — classic starter.',
    steps: [
      { kind: 'warmup', label: 'Warm-up walk', timeMs: min(5) },
      {
        kind: 'repeat',
        times: 8,
        work: { label: 'Run', timeMs: min(1) },
        rest: { label: 'Walk', timeMs: 90_000 },
      },
      { kind: 'cooldown', label: 'Cool-down walk', timeMs: min(5) },
    ],
  }),
  expandRecipe({
    id: 'walk-run-2-1',
    name: 'Walk/run 2–1',
    blurb: '6 × 2 min run / 1 min walk.',
    steps: [
      { kind: 'warmup', label: 'Warm-up', timeMs: min(5) },
      {
        kind: 'repeat',
        times: 6,
        work: { label: 'Run', timeMs: min(2) },
        rest: { label: 'Walk', timeMs: min(1) },
      },
      { kind: 'cooldown', label: 'Cool-down', timeMs: min(5) },
    ],
  }),
  expandRecipe({
    id: 'easy-30',
    name: 'Easy 30',
    blurb: 'Continuous easy effort with bookends.',
    steps: [
      { kind: 'warmup', label: 'Warm-up', timeMs: min(5) },
      { kind: 'steady', label: 'Easy run', timeMs: min(20) },
      { kind: 'cooldown', label: 'Cool-down', timeMs: min(5) },
    ],
  }),
  expandRecipe({
    id: 'tempo-20',
    name: 'Tempo 20',
    blurb: 'Comfortably hard middle block.',
    steps: [
      { kind: 'warmup', label: 'Warm-up', timeMs: min(10) },
      { kind: 'work', label: 'Tempo', timeMs: min(20) },
      { kind: 'cooldown', label: 'Cool-down', timeMs: min(10) },
    ],
  }),
  expandRecipe({
    id: '400-repeats',
    name: '6 × 400 m',
    blurb: 'Speed work with 90 s recoveries (distance-based).',
    steps: [
      { kind: 'warmup', label: 'Warm-up', timeMs: min(10) },
      {
        kind: 'repeat',
        times: 6,
        work: { label: '400 m', distanceM: 400 },
        rest: { label: 'Recover', timeMs: 90_000 },
      },
      { kind: 'cooldown', label: 'Cool-down', timeMs: min(10) },
    ],
  }),
  expandRecipe({
    id: 'vo2-3min',
    name: '5 × 3 min',
    blurb: 'Hard 3-minute efforts, equal rest.',
    steps: [
      { kind: 'warmup', label: 'Warm-up', timeMs: min(10) },
      {
        kind: 'repeat',
        times: 5,
        work: { label: 'Hard', timeMs: min(3) },
        rest: { label: 'Easy', timeMs: min(3) },
      },
      { kind: 'cooldown', label: 'Cool-down', timeMs: min(10) },
    ],
  }),
  expandRecipe({
    id: 'pyramid',
    name: 'Pyramid 1–2–3–2–1',
    blurb: 'Climb and descend the minutes.',
    steps: [
      { kind: 'warmup', label: 'Warm-up', timeMs: min(8) },
      { kind: 'work', label: '1 min hard', timeMs: min(1) },
      { kind: 'rest', label: 'Recover', timeMs: min(1) },
      { kind: 'work', label: '2 min hard', timeMs: min(2) },
      { kind: 'rest', label: 'Recover', timeMs: min(1) },
      { kind: 'work', label: '3 min hard', timeMs: min(3) },
      { kind: 'rest', label: 'Recover', timeMs: min(2) },
      { kind: 'work', label: '2 min hard', timeMs: min(2) },
      { kind: 'rest', label: 'Recover', timeMs: min(1) },
      { kind: 'work', label: '1 min hard', timeMs: min(1) },
      { kind: 'cooldown', label: 'Cool-down', timeMs: min(8) },
    ],
  }),
  expandRecipe({
    id: 'fartlek-20',
    name: 'Fartlek 20',
    blurb: 'Playful surges: 1 hard / 1 easy, ten times.',
    steps: [
      { kind: 'warmup', label: 'Warm-up', timeMs: min(5) },
      {
        kind: 'repeat',
        times: 10,
        work: { label: 'Surge', timeMs: min(1) },
        rest: { label: 'Easy', timeMs: min(1) },
      },
      { kind: 'cooldown', label: 'Cool-down', timeMs: min(5) },
    ],
  }),
  expandRecipe({
    id: 'long-easy-45',
    name: 'Long easy 45',
    blurb: 'Steady volume builder.',
    steps: [
      { kind: 'warmup', label: 'Warm-up', timeMs: min(5) },
      { kind: 'steady', label: 'Easy', timeMs: min(35) },
      { kind: 'cooldown', label: 'Cool-down', timeMs: min(5) },
    ],
  }),
];

export function workoutById(id: string): WorkoutTemplate | null {
  return WORKOUT_PRESETS.find((w) => w.id === id) ?? null;
}

export function phaseKindLabel(kind: PhaseKind): string {
  switch (kind) {
    case 'warmup':
      return 'Warm-up';
    case 'work':
      return 'Work';
    case 'rest':
      return 'Rest';
    case 'cooldown':
      return 'Cool-down';
    case 'steady':
      return 'Steady';
  }
}

export interface PhaseProgress {
  phase: WorkoutPhase;
  index: number;
  total: number;
  /** 0…1 within the current phase. */
  fraction: number;
  /** Remaining time (ms) if time-based; else null. */
  remainingMs: number | null;
  /** Remaining distance (m) if distance-based; else null. */
  remainingM: number | null;
  complete: boolean;
}

/**
 * Tracks which phase of a template the athlete is on.
 *
 * Anchors each phase to distance and moving time at the moment it started so
 * pauses do not steal work intervals (elapsed is already moving-time).
 */
export class WorkoutRunner {
  readonly template: WorkoutTemplate;
  private index = 0;
  private phaseStartDistanceM = 0;
  private phaseStartDurationMs = 0;
  private finished = false;

  constructor(template: WorkoutTemplate) {
    this.template = {
      ...template,
      phases: template.phases.map((p) => ({ ...p, target: { ...p.target } })),
    };
  }

  get phaseIndex(): number {
    return this.index;
  }

  get done(): boolean {
    return this.finished;
  }

  /** Call when the run clock starts. */
  begin(distanceM: number, durationMs: number): void {
    this.index = 0;
    this.phaseStartDistanceM = distanceM;
    this.phaseStartDurationMs = durationMs;
    this.finished = this.template.phases.length === 0;
  }

  current(): WorkoutPhase | null {
    if (this.finished) return null;
    return this.template.phases[this.index] ?? null;
  }

  progress(distanceM: number, durationMs: number): PhaseProgress | null {
    const phase = this.current();
    if (!phase) return null;

    const dDist = Math.max(0, distanceM - this.phaseStartDistanceM);
    const dTime = Math.max(0, durationMs - this.phaseStartDurationMs);

    let fraction = 0;
    let remainingMs: number | null = null;
    let remainingM: number | null = null;

    if (phase.target.type === 'time') {
      fraction = phase.target.ms <= 0 ? 1 : Math.min(1, dTime / phase.target.ms);
      remainingMs = Math.max(0, phase.target.ms - dTime);
    } else {
      fraction = phase.target.m <= 0 ? 1 : Math.min(1, dDist / phase.target.m);
      remainingM = Math.max(0, phase.target.m - dDist);
    }

    return {
      phase,
      index: this.index,
      total: this.template.phases.length,
      fraction,
      remainingMs,
      remainingM,
      complete: this.finished,
    };
  }

  /**
   * Advance through any completed phases. Returns how many phases were closed
   * (for cues).
   */
  tick(distanceM: number, durationMs: number): number {
    if (this.finished) return 0;
    let advanced = 0;
    while (!this.finished) {
      const phase = this.template.phases[this.index];
      if (!phase) {
        this.finished = true;
        break;
      }
      const dDist = Math.max(0, distanceM - this.phaseStartDistanceM);
      const dTime = Math.max(0, durationMs - this.phaseStartDurationMs);
      const done =
        phase.target.type === 'time'
          ? dTime >= phase.target.ms
          : dDist >= phase.target.m;
      if (!done) break;
      this.index += 1;
      advanced += 1;
      this.phaseStartDistanceM = distanceM;
      this.phaseStartDurationMs = durationMs;
      if (this.index >= this.template.phases.length) {
        this.finished = true;
        break;
      }
    }
    return advanced;
  }

  /** Skip to next phase (athlete override). */
  skip(distanceM: number, durationMs: number): boolean {
    if (this.finished) return false;
    this.index += 1;
    this.phaseStartDistanceM = distanceM;
    this.phaseStartDurationMs = durationMs;
    if (this.index >= this.template.phases.length) this.finished = true;
    return true;
  }

  summary(): { id: string; name: string } {
    return { id: this.template.id, name: this.template.name };
  }
}

/** Custom single-block builder for the simple UI. */
export function customIntervals(options: {
  name?: string;
  warmupMin: number;
  workMin: number;
  restMin: number;
  repeats: number;
  cooldownMin: number;
}): WorkoutTemplate {
  const repeats = Math.min(40, Math.max(1, Math.round(options.repeats)));
  return expandRecipe({
    id: `custom-${newId()}`,
    name: options.name ?? `Custom ${repeats}×`,
    blurb: `${repeats} × ${options.workMin} min / ${options.restMin} min rest`,
    steps: [
      { kind: 'warmup', label: 'Warm-up', timeMs: min(options.warmupMin) },
      {
        kind: 'repeat',
        times: repeats,
        work: { label: 'Work', timeMs: min(options.workMin) },
        rest: { label: 'Rest', timeMs: min(options.restMin) },
      },
      { kind: 'cooldown', label: 'Cool-down', timeMs: min(options.cooldownMin) },
    ],
  });
}
