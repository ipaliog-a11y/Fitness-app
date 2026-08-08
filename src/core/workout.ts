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
  /** Picker effort 1–5 (explicit on presets; else derived). */
  effort?: number;
}

/** Compact recipe used to build presets. */
export interface WorkoutRecipe {
  id: string;
  name: string;
  blurb: string;
  /** Display / sort effort 1 (easiest) … 5 (hardest). Optional for custom. */
  effort?: number;
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
  return {
    id: recipe.id,
    name: recipe.name,
    blurb: recipe.blurb,
    phases,
    effort: recipe.effort,
  };
}

const min = (n: number) => n * 60_000;
const sec = (n: number) => n * 1_000;

/**
 * Built-in recipes. Expanded and sorted by effort for the picker
 * (easy → hard). New templates should be added here, not hand-ordered.
 */
const WORKOUT_RECIPES: WorkoutRecipe[] = [
  // --- Easy / recovery -------------------------------------------------
  {
    id: 'easy-30',
    name: 'Easy 30',
    blurb: 'Continuous easy effort with bookends.',
    effort: 1,
    steps: [
      { kind: 'warmup', label: 'Warm-up', timeMs: min(5) },
      { kind: 'steady', label: 'Easy run', timeMs: min(20) },
      { kind: 'cooldown', label: 'Cool-down', timeMs: min(5) },
    ],
  },
  {
    id: 'easy-40',
    name: 'Easy 40',
    blurb: 'Conversational aerobic base — longer easy block.',
    effort: 1,
    steps: [
      { kind: 'warmup', label: 'Warm-up', timeMs: min(5) },
      { kind: 'steady', label: 'Easy run', timeMs: min(30) },
      { kind: 'cooldown', label: 'Cool-down', timeMs: min(5) },
    ],
  },
  {
    id: 'long-easy-45',
    name: 'Long easy 45',
    blurb: 'Steady volume builder.',
    effort: 1,
    steps: [
      { kind: 'warmup', label: 'Warm-up', timeMs: min(5) },
      { kind: 'steady', label: 'Easy', timeMs: min(35) },
      { kind: 'cooldown', label: 'Cool-down', timeMs: min(5) },
    ],
  },
  {
    id: 'long-easy-60',
    name: 'Long easy 60',
    blurb: 'Hour of easy volume for endurance base.',
    effort: 2,
    steps: [
      { kind: 'warmup', label: 'Warm-up', timeMs: min(5) },
      { kind: 'steady', label: 'Easy', timeMs: min(50) },
      { kind: 'cooldown', label: 'Cool-down', timeMs: min(5) },
    ],
  },
  {
    id: 'recovery-strides',
    name: 'Recovery + strides',
    blurb: 'Easy run with 6 short form strides (20 s).',
    effort: 2,
    steps: [
      { kind: 'warmup', label: 'Easy warm-up', timeMs: min(10) },
      { kind: 'steady', label: 'Easy', timeMs: min(15) },
      {
        kind: 'repeat',
        times: 6,
        work: { label: 'Stride', timeMs: sec(20) },
        rest: { label: 'Walk', timeMs: sec(40) },
      },
      { kind: 'cooldown', label: 'Cool-down', timeMs: min(5) },
    ],
  },
  // --- Walk/run progression --------------------------------------------
  {
    id: 'beginner-walk-run',
    name: 'Beginner walk/run',
    blurb: '8 × 1 min run / 90 s walk — classic starter.',
    effort: 2,
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
  },
  {
    id: 'walk-run-2-1',
    name: 'Walk/run 2–1',
    blurb: '6 × 2 min run / 1 min walk.',
    effort: 2,
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
  },
  {
    id: 'walk-run-3-1',
    name: 'Walk/run 3–1',
    blurb: '5 × 3 min run / 1 min walk — next step up.',
    effort: 3,
    steps: [
      { kind: 'warmup', label: 'Warm-up', timeMs: min(5) },
      {
        kind: 'repeat',
        times: 5,
        work: { label: 'Run', timeMs: min(3) },
        rest: { label: 'Walk', timeMs: min(1) },
      },
      { kind: 'cooldown', label: 'Cool-down', timeMs: min(5) },
    ],
  },
  // --- Aerobic quality / progressive -----------------------------------
  {
    id: 'progressive-35',
    name: 'Progressive 35',
    blurb: 'Easy → steady → strong finish (builds without intervals).',
    effort: 3,
    steps: [
      { kind: 'warmup', label: 'Warm-up', timeMs: min(5) },
      { kind: 'steady', label: 'Easy', timeMs: min(12) },
      { kind: 'steady', label: 'Steady', timeMs: min(10) },
      { kind: 'work', label: 'Strong', timeMs: min(8) },
      { kind: 'cooldown', label: 'Cool-down', timeMs: min(5) },
    ],
  },
  {
    id: 'fartlek-20',
    name: 'Fartlek 20',
    blurb: 'Playful surges: 1 hard / 1 easy, ten times.',
    effort: 3,
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
  },
  {
    id: 'ladder-fartlek',
    name: 'Ladder 5–4–3–2–1',
    blurb: 'Descending hard blocks with equal easy recovery.',
    effort: 4,
    steps: [
      { kind: 'warmup', label: 'Warm-up', timeMs: min(10) },
      { kind: 'work', label: '5 min hard', timeMs: min(5) },
      { kind: 'rest', label: 'Easy', timeMs: min(5) },
      { kind: 'work', label: '4 min hard', timeMs: min(4) },
      { kind: 'rest', label: 'Easy', timeMs: min(4) },
      { kind: 'work', label: '3 min hard', timeMs: min(3) },
      { kind: 'rest', label: 'Easy', timeMs: min(3) },
      { kind: 'work', label: '2 min hard', timeMs: min(2) },
      { kind: 'rest', label: 'Easy', timeMs: min(2) },
      { kind: 'work', label: '1 min hard', timeMs: min(1) },
      { kind: 'cooldown', label: 'Cool-down', timeMs: min(10) },
    ],
  },
  {
    id: 'mona-fartlek',
    name: 'Mona fartlek',
    blurb: '2×90 s, 4×60 s, 4×30 s, 4×15 s hard / equal float.',
    effort: 4,
    steps: [
      { kind: 'warmup', label: 'Warm-up', timeMs: min(10) },
      {
        kind: 'repeat',
        times: 2,
        work: { label: 'Hard 90 s', timeMs: sec(90) },
        rest: { label: 'Float', timeMs: sec(90) },
      },
      {
        kind: 'repeat',
        times: 4,
        work: { label: 'Hard 60 s', timeMs: sec(60) },
        rest: { label: 'Float', timeMs: sec(60) },
      },
      {
        kind: 'repeat',
        times: 4,
        work: { label: 'Hard 30 s', timeMs: sec(30) },
        rest: { label: 'Float', timeMs: sec(30) },
      },
      {
        kind: 'repeat',
        times: 4,
        work: { label: 'Hard 15 s', timeMs: sec(15) },
        rest: { label: 'Float', timeMs: sec(15) },
      },
      { kind: 'cooldown', label: 'Cool-down', timeMs: min(10) },
    ],
  },
  // --- Threshold / tempo -----------------------------------------------
  {
    id: 'tempo-20',
    name: 'Tempo 20',
    blurb: 'Comfortably hard middle block.',
    effort: 4,
    steps: [
      { kind: 'warmup', label: 'Warm-up', timeMs: min(10) },
      { kind: 'work', label: 'Tempo', timeMs: min(20) },
      { kind: 'cooldown', label: 'Cool-down', timeMs: min(10) },
    ],
  },
  {
    id: 'cruise-5x5',
    name: 'Cruise 5 × 5',
    blurb: 'Threshold intervals with short 1 min recoveries.',
    effort: 4,
    steps: [
      { kind: 'warmup', label: 'Warm-up', timeMs: min(10) },
      {
        kind: 'repeat',
        times: 5,
        work: { label: 'Cruise', timeMs: min(5) },
        rest: { label: 'Easy', timeMs: min(1) },
      },
      { kind: 'cooldown', label: 'Cool-down', timeMs: min(10) },
    ],
  },
  {
    id: 'double-tempo',
    name: 'Double tempo 2 × 12',
    blurb: 'Two threshold blocks with a 3 min jog between.',
    effort: 4,
    steps: [
      { kind: 'warmup', label: 'Warm-up', timeMs: min(10) },
      { kind: 'work', label: 'Tempo 1', timeMs: min(12) },
      { kind: 'rest', label: 'Easy jog', timeMs: min(3) },
      { kind: 'work', label: 'Tempo 2', timeMs: min(12) },
      { kind: 'cooldown', label: 'Cool-down', timeMs: min(10) },
    ],
  },
  // --- Speed / hills / VO2 ---------------------------------------------
  {
    id: 'pyramid',
    name: 'Pyramid 1–2–3–2–1',
    blurb: 'Climb and descend the minutes.',
    effort: 4,
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
  },
  {
    id: 'hill-8x45',
    name: 'Hills 8 × 45 s',
    blurb: 'Hard uphill efforts, easy down / recover (or flat power).',
    effort: 4,
    steps: [
      { kind: 'warmup', label: 'Warm-up', timeMs: min(12) },
      {
        kind: 'repeat',
        times: 8,
        work: { label: 'Hill hard', timeMs: sec(45) },
        rest: { label: 'Easy down', timeMs: sec(90) },
      },
      { kind: 'cooldown', label: 'Cool-down', timeMs: min(10) },
    ],
  },
  {
    id: '400-repeats',
    name: '6 × 400 m',
    blurb: 'Speed work with 90 s recoveries (distance-based).',
    effort: 5,
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
  },
  {
    id: '800-repeats',
    name: '5 × 800 m',
    blurb: 'Classic track intervals, 2 min recoveries.',
    effort: 5,
    steps: [
      { kind: 'warmup', label: 'Warm-up', timeMs: min(12) },
      {
        kind: 'repeat',
        times: 5,
        work: { label: '800 m', distanceM: 800 },
        rest: { label: 'Recover', timeMs: min(2) },
      },
      { kind: 'cooldown', label: 'Cool-down', timeMs: min(10) },
    ],
  },
  {
    id: 'vo2-3min',
    name: '5 × 3 min',
    blurb: 'Hard 3-minute efforts, equal rest.',
    effort: 5,
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
  },
  {
    id: 'vo2-4x4',
    name: '4 × 4 min',
    blurb: 'Classic VO₂ intervals — hard with equal easy recovery.',
    effort: 5,
    steps: [
      { kind: 'warmup', label: 'Warm-up', timeMs: min(12) },
      {
        kind: 'repeat',
        times: 4,
        work: { label: 'Hard', timeMs: min(4) },
        rest: { label: 'Easy', timeMs: min(4) },
      },
      { kind: 'cooldown', label: 'Cool-down', timeMs: min(10) },
    ],
  },
];

/** Built-in presets — sorted easiest → hardest for the workout picker. */
export let WORKOUT_PRESETS: WorkoutTemplate[] = WORKOUT_RECIPES.map(expandRecipe);

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
    effort: 3,
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

/**
 * Relative width for an interval strip segment. Time phases use ms;
 * distance phases use a rough time-equivalent so bars still read as shape.
 */
export function phaseVisualWeight(phase: WorkoutPhase): number {
  if (phase.target.type === 'time') return Math.max(1, phase.target.ms);
  // ~4 min/km → 240 ms per metre as a display scale only.
  return Math.max(1, Math.round(phase.target.m * 240));
}

/** Total of phase weights (for flex strips). */
export function workoutStripWeights(phases: WorkoutPhase[]): number[] {
  return phases.map(phaseVisualWeight);
}

/**
 * Effort 1–5 for tile dots and picker sort.
 * Presets set `effort` explicitly; custom workouts fall back to phase mix.
 */
export function workoutEffortLevel(template: WorkoutTemplate): number {
  if (typeof template.effort === 'number' && template.effort >= 1 && template.effort <= 5) {
    return Math.round(template.effort);
  }
  const weights = workoutStripWeights(template.phases);
  const total = weights.reduce((a, b) => a + b, 0) || 1;
  let score = 0;
  template.phases.forEach((phase, i) => {
    const w = weights[i] / total;
    switch (phase.kind) {
      case 'work':
        score += w * 1;
        break;
      case 'steady':
        score += w * 0.45;
        break;
      case 'rest':
        score += w * 0.12;
        break;
      case 'warmup':
      case 'cooldown':
        score += w * 0.2;
        break;
    }
  });
  if (score < 0.28) return 1;
  if (score < 0.4) return 2;
  if (score < 0.52) return 3;
  if (score < 0.68) return 4;
  return 5;
}

/** Sum of time phases in ms, or null if any phase is distance-based. */
export function workoutTimeMs(template: WorkoutTemplate): number | null {
  let total = 0;
  for (const phase of template.phases) {
    if (phase.target.type !== 'time') return null;
    total += phase.target.ms;
  }
  return total;
}

/** Count of work (hard) intervals in the template. */
export function workoutWorkCount(template: WorkoutTemplate): number {
  return template.phases.filter((p) => p.kind === 'work').length;
}

/** Easiest first, then name — used by the picker tile list. */
function sortWorkoutsByEffort(list: WorkoutTemplate[]): WorkoutTemplate[] {
  return [...list].sort((a, b) => {
    const ea = workoutEffortLevel(a);
    const eb = workoutEffortLevel(b);
    if (ea !== eb) return ea - eb;
    return a.name.localeCompare(b.name);
  });
}

// Re-order after effort helpers exist (recipes are declared above).
WORKOUT_PRESETS = sortWorkoutsByEffort(WORKOUT_PRESETS);
