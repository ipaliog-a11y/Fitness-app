/**
 * Structured workouts: warm-up, intervals, cool-down.
 *
 * Templates expand into a flat list of phases. A WorkoutRunner tracks progress
 * against moving time and distance so the live screen can show "what now" and
 * auto-advance when a phase is done — pure logic, no DOM.
 */

import { newId } from './activity';

import type { MessageKey, Vars } from '../i18n';

export type PhaseKind = 'warmup' | 'work' | 'rest' | 'cooldown' | 'steady';

export type PhaseTarget =
  | { type: 'time'; ms: number }
  | { type: 'distance'; m: number };

export interface WorkoutPhase {
  kind: PhaseKind;
  /**
   * A message key. Every phase label in the app comes from one fixed
   * vocabulary — presets and custom intervals both draw on it — so unlike a
   * workout's *name* there is never arbitrary user text here.
   */
  label: MessageKey;
  /**
   * Which pass through a repeat block this is, 1-based, and how many there
   * are. Absent on phases outside a repeat.
   *
   * These used to be spliced into the label as "Hard (3/6)". That only worked
   * while the label was English prose; a key cannot carry a suffix. Keeping
   * them as numbers is better anyway — the renderer can put the counter where
   * the language wants it, and nothing has to parse a string to know a phase
   * is the third of six.
   */
  repeat?: { index: number; total: number };
  target: PhaseTarget;
}

/** Picker categories for built-in presets. */
export type WorkoutGroupId =
  | 'easy'
  | 'walk-run'
  | 'recovery'
  | 'mixed'
  | 'tempo'
  | 'speed';

export interface WorkoutGroup {
  id: WorkoutGroupId;
  name: MessageKey;
  /** Short line on the group tile. */
  blurb: MessageKey;
}

/** Six distinctive groups for the workout picker. */
export const WORKOUT_GROUPS: WorkoutGroup[] = [
  {
    id: 'easy',
    name: 'workoutGroup.easy.name',
    blurb: 'workoutGroup.easy.blurb',
  },
  {
    id: 'walk-run',
    name: 'workoutGroup.walk-run.name',
    blurb: 'workoutGroup.walk-run.blurb',
  },
  {
    id: 'recovery',
    name: 'workoutGroup.recovery.name',
    blurb: 'workoutGroup.recovery.blurb',
  },
  {
    id: 'mixed',
    name: 'workoutGroup.mixed.name',
    blurb: 'workoutGroup.mixed.blurb',
  },
  {
    id: 'tempo',
    name: 'workoutGroup.tempo.name',
    blurb: 'workoutGroup.tempo.blurb',
  },
  {
    id: 'speed',
    name: 'workoutGroup.speed.name',
    blurb: 'workoutGroup.speed.blurb',
  },
];

export interface WorkoutTemplate {
  id: string;
  /**
   * Literal text. Presets fill this with the English as a fallback; a saved
   * custom workout holds whatever the athlete typed, which is why this cannot
   * simply become a MessageKey the way phase labels did.
   */
  name: string;
  /** Preset name as a key. Absent on user-created workouts. */
  nameKey?: MessageKey;
  blurb: string;
  /** Preset blurb as a key, with substitutions for composed ones. */
  blurbKey?: MessageKey;
  blurbVars?: Vars;
  /** Expanded phase list (repeats already unrolled). */
  phases: WorkoutPhase[];
  /** Picker effort 1–5 (explicit on presets; else derived). */
  effort?: number;
  /** Built-in category; custom/saved omit this. */
  group?: WorkoutGroupId;
}

/** Compact recipe used to build presets. */
export interface WorkoutRecipe {
  id: string;
  /**
   * Literal text. Presets fill this with the English as a fallback; a saved
   * custom workout holds whatever the athlete typed, which is why this cannot
   * simply become a MessageKey the way phase labels did.
   */
  name: string;
  /** Preset name as a key. Absent on user-created workouts. */
  nameKey?: MessageKey;
  blurb: string;
  /** Preset blurb as a key, with substitutions for composed ones. */
  blurbKey?: MessageKey;
  blurbVars?: Vars;
  /** Built-in category; omit for custom intervals. */
  group?: WorkoutGroupId;
  /** Display / sort effort 1 (easiest) … 5 (hardest). Optional for custom. */
  effort?: number;
  steps: Array<
    | { kind: PhaseKind; label: MessageKey; timeMs: number }
    | { kind: PhaseKind; label: MessageKey; distanceM: number }
    | {
        kind: 'repeat';
        times: number;
        work: { label: MessageKey; timeMs?: number; distanceM?: number };
        rest: { label: MessageKey; timeMs?: number; distanceM?: number };
      }
  >;
}

function phaseFrom(
  kind: PhaseKind,
  label: MessageKey,
  timeMs?: number,
  distanceM?: number,
  repeat?: { index: number; total: number },
): WorkoutPhase {
  if (distanceM !== undefined && distanceM > 0) {
    return { kind, label, repeat, target: { type: 'distance', m: distanceM } };
  }
  return { kind, label, repeat, target: { type: 'time', ms: Math.max(0, timeMs ?? 0) } };
}

export function expandRecipe(recipe: WorkoutRecipe): WorkoutTemplate {
  const phases: WorkoutPhase[] = [];
  for (const step of recipe.steps) {
    if (step.kind === 'repeat') {
      for (let i = 1; i <= step.times; i++) {
        const repeat = { index: i, total: step.times };
        phases.push(
          phaseFrom('work', step.work.label, step.work.timeMs, step.work.distanceM, repeat),
        );
        phases.push(
          phaseFrom('rest', step.rest.label, step.rest.timeMs, step.rest.distanceM, repeat),
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
    nameKey: recipe.nameKey,
    blurb: recipe.blurb,
    blurbKey: recipe.blurbKey,
    blurbVars: recipe.blurbVars,
    phases,
    effort: recipe.effort,
    group: recipe.group,
  };
}

const min = (n: number) => n * 60_000;
const sec = (n: number) => n * 1_000;

/**
 * Built-in recipes. Expanded and sorted by effort for the picker
 * (easy → hard). New templates should be added here, not hand-ordered.
 */
const WORKOUT_RECIPES: WorkoutRecipe[] = [
  // --- Easy & base -----------------------------------------------------
  {
    id: 'easy-30',
    name: 'Easy 30',
    nameKey: 'workout.easy-30.name',
    group: 'easy',
    blurb: 'Short easy run. Builds aerobic base and habit with low injury risk — most training should feel this easy.',
    blurbKey: 'workout.easy-30.blurb',
    effort: 1,
    steps: [
      { kind: 'warmup', label: 'phase.warmup', timeMs: min(5) },
      { kind: 'steady', label: 'phase.easyRun', timeMs: min(20) },
      { kind: 'cooldown', label: 'phase.cooldown', timeMs: min(5) },
    ],
  },
  {
    id: 'easy-40',
    name: 'Easy 40',
    nameKey: 'workout.easy-40.name',
    group: 'easy',
    blurb: 'Longer conversational run. More time on feet for endurance without hard stress — great base day.',
    blurbKey: 'workout.easy-40.blurb',
    effort: 1,
    steps: [
      { kind: 'warmup', label: 'phase.warmup', timeMs: min(5) },
      { kind: 'steady', label: 'phase.easyRun', timeMs: min(30) },
      { kind: 'cooldown', label: 'phase.cooldown', timeMs: min(5) },
    ],
  },
  {
    id: 'long-easy-45',
    name: 'Long easy 45',
    nameKey: 'workout.long-easy-45.name',
    group: 'easy',
    blurb: 'Mid-length long run. Improves durability and fat-burning comfort at easy pace — weekly cornerstone.',
    blurbKey: 'workout.long-easy-45.blurb',
    effort: 1,
    steps: [
      { kind: 'warmup', label: 'phase.warmup', timeMs: min(5) },
      { kind: 'steady', label: 'phase.easy', timeMs: min(35) },
      { kind: 'cooldown', label: 'phase.cooldown', timeMs: min(5) },
    ],
  },
  {
    id: 'long-easy-60',
    name: 'Long easy 60',
    nameKey: 'workout.long-easy-60.name',
    group: 'easy',
    blurb: 'Hour of easy volume. Builds deep aerobic endurance and mental ease with long duration — when 45 min feels short.',
    blurbKey: 'workout.long-easy-60.blurb',
    effort: 2,
    steps: [
      { kind: 'warmup', label: 'phase.warmup', timeMs: min(5) },
      { kind: 'steady', label: 'phase.easy', timeMs: min(50) },
      { kind: 'cooldown', label: 'phase.cooldown', timeMs: min(5) },
    ],
  },
  // --- Walk / run ------------------------------------------------------
  {
    id: 'beginner-walk-run',
    name: 'Beginner walk/run',
    nameKey: 'workout.beginner-walk-run.name',
    group: 'walk-run',
    blurb: '8 × 1 min run / 90 s walk. Classic starter — builds run time safely and lowers overload risk for new runners.',
    blurbKey: 'workout.beginner-walk-run.blurb',
    effort: 2,
    steps: [
      { kind: 'warmup', label: 'phase.warmupWalk', timeMs: min(5) },
      {
        kind: 'repeat',
        times: 8,
        work: { label: 'phase.run', timeMs: min(1) },
        rest: { label: 'phase.walk', timeMs: 90_000 },
      },
      { kind: 'cooldown', label: 'phase.cooldownWalk', timeMs: min(5) },
    ],
  },
  {
    id: 'walk-run-2-1',
    name: 'Walk/run 2–1',
    nameKey: 'workout.walk-run-2-1.name',
    group: 'walk-run',
    blurb: '6 × 2 min run / 1 min walk. Next step after short bouts — more continuous running with still-easy recoveries.',
    blurbKey: 'workout.walk-run-2-1.blurb',
    effort: 2,
    steps: [
      { kind: 'warmup', label: 'phase.warmup', timeMs: min(5) },
      {
        kind: 'repeat',
        times: 6,
        work: { label: 'phase.run', timeMs: min(2) },
        rest: { label: 'phase.walk', timeMs: min(1) },
      },
      { kind: 'cooldown', label: 'phase.cooldown', timeMs: min(5) },
    ],
  },
  {
    id: 'walk-run-3-1',
    name: 'Walk/run 3–1',
    nameKey: 'workout.walk-run-3-1.name',
    group: 'walk-run',
    blurb: '5 × 3 min run / 1 min walk. Bridge toward continuous easy runs while keeping walk breaks for recovery.',
    blurbKey: 'workout.walk-run-3-1.blurb',
    effort: 3,
    steps: [
      { kind: 'warmup', label: 'phase.warmup', timeMs: min(5) },
      {
        kind: 'repeat',
        times: 5,
        work: { label: 'phase.run', timeMs: min(3) },
        rest: { label: 'phase.walk', timeMs: min(1) },
      },
      { kind: 'cooldown', label: 'phase.cooldown', timeMs: min(5) },
    ],
  },
  // --- Recovery + strides ----------------------------------------------
  {
    id: 'recovery-strides',
    name: 'Recovery + strides',
    nameKey: 'workout.recovery-strides.name',
    group: 'recovery',
    blurb: 'Easy run plus 6 × 20 s form strides. Active recovery with a little speed and technique — ideal day after hard work.',
    blurbKey: 'workout.recovery-strides.blurb',
    effort: 2,
    steps: [
      { kind: 'warmup', label: 'phase.easyWarmup', timeMs: min(10) },
      { kind: 'steady', label: 'phase.easy', timeMs: min(15) },
      {
        kind: 'repeat',
        times: 6,
        work: { label: 'phase.stride', timeMs: sec(20) },
        rest: { label: 'phase.walk', timeMs: sec(40) },
      },
      { kind: 'cooldown', label: 'phase.cooldown', timeMs: min(5) },
    ],
  },
  // --- Fartlek & mixed -------------------------------------------------
  {
    id: 'progressive-35',
    name: 'Progressive 35',
    nameKey: 'workout.progressive-35.name',
    group: 'mixed',
    blurb: 'Easy → steady → strong finish. Teaches pace control and late-run toughness without full track intervals.',
    blurbKey: 'workout.progressive-35.blurb',
    effort: 3,
    steps: [
      { kind: 'warmup', label: 'phase.warmup', timeMs: min(5) },
      { kind: 'steady', label: 'phase.easy', timeMs: min(12) },
      { kind: 'steady', label: 'phase.steady', timeMs: min(10) },
      { kind: 'work', label: 'phase.strong', timeMs: min(8) },
      { kind: 'cooldown', label: 'phase.cooldown', timeMs: min(5) },
    ],
  },
  {
    id: 'fartlek-20',
    name: 'Fartlek 20',
    nameKey: 'workout.fartlek-20.name',
    group: 'mixed',
    blurb: '10 × 1 min hard / 1 min easy. Playful speed + aerobic mix — fun quality without rigid track pacing.',
    blurbKey: 'workout.fartlek-20.blurb',
    effort: 3,
    steps: [
      { kind: 'warmup', label: 'phase.warmup', timeMs: min(5) },
      {
        kind: 'repeat',
        times: 10,
        work: { label: 'phase.surge', timeMs: min(1) },
        rest: { label: 'phase.easy', timeMs: min(1) },
      },
      { kind: 'cooldown', label: 'phase.cooldown', timeMs: min(5) },
    ],
  },
  {
    id: 'ladder-fartlek',
    name: 'Ladder 5–4–3–2–1',
    nameKey: 'workout.ladder-fartlek.name',
    group: 'mixed',
    blurb: 'Descending hard blocks with equal easy recovery. Sustained effort then sharper finish — strong quality session.',
    blurbKey: 'workout.ladder-fartlek.blurb',
    effort: 4,
    steps: [
      { kind: 'warmup', label: 'phase.warmup', timeMs: min(10) },
      { kind: 'work', label: 'phase.hard5min', timeMs: min(5) },
      { kind: 'rest', label: 'phase.easy', timeMs: min(5) },
      { kind: 'work', label: 'phase.hard4min', timeMs: min(4) },
      { kind: 'rest', label: 'phase.easy', timeMs: min(4) },
      { kind: 'work', label: 'phase.hard3min', timeMs: min(3) },
      { kind: 'rest', label: 'phase.easy', timeMs: min(3) },
      { kind: 'work', label: 'phase.hard2min', timeMs: min(2) },
      { kind: 'rest', label: 'phase.easy', timeMs: min(2) },
      { kind: 'work', label: 'phase.hard1min', timeMs: min(1) },
      { kind: 'cooldown', label: 'phase.cooldown', timeMs: min(10) },
    ],
  },
  {
    id: 'mona-fartlek',
    name: 'Mona fartlek',
    nameKey: 'workout.mona-fartlek.name',
    group: 'mixed',
    blurb: '2×90 s, 4×60 s, 4×30 s, 4×15 s hard with equal float. Classic speed-play — neuromuscular snap plus aerobic stress.',
    blurbKey: 'workout.mona-fartlek.blurb',
    effort: 4,
    steps: [
      { kind: 'warmup', label: 'phase.warmup', timeMs: min(10) },
      {
        kind: 'repeat',
        times: 2,
        work: { label: 'phase.hard90s', timeMs: sec(90) },
        rest: { label: 'phase.float', timeMs: sec(90) },
      },
      {
        kind: 'repeat',
        times: 4,
        work: { label: 'phase.hard60s', timeMs: sec(60) },
        rest: { label: 'phase.float', timeMs: sec(60) },
      },
      {
        kind: 'repeat',
        times: 4,
        work: { label: 'phase.hard30s', timeMs: sec(30) },
        rest: { label: 'phase.float', timeMs: sec(30) },
      },
      {
        kind: 'repeat',
        times: 4,
        work: { label: 'phase.hard15s', timeMs: sec(15) },
        rest: { label: 'phase.float', timeMs: sec(15) },
      },
      { kind: 'cooldown', label: 'phase.cooldown', timeMs: min(10) },
    ],
  },
  {
    id: 'pyramid',
    name: 'Pyramid 1–2–3–2–1',
    nameKey: 'workout.pyramid.name',
    group: 'mixed',
    blurb: 'Climb then descend hard minutes. Mixes short and mid efforts for variety and general fitness quality.',
    blurbKey: 'workout.pyramid.blurb',
    effort: 4,
    steps: [
      { kind: 'warmup', label: 'phase.warmup', timeMs: min(8) },
      { kind: 'work', label: 'phase.hard1min', timeMs: min(1) },
      { kind: 'rest', label: 'phase.recover', timeMs: min(1) },
      { kind: 'work', label: 'phase.hard2min', timeMs: min(2) },
      { kind: 'rest', label: 'phase.recover', timeMs: min(1) },
      { kind: 'work', label: 'phase.hard3min', timeMs: min(3) },
      { kind: 'rest', label: 'phase.recover', timeMs: min(2) },
      { kind: 'work', label: 'phase.hard2min', timeMs: min(2) },
      { kind: 'rest', label: 'phase.recover', timeMs: min(1) },
      { kind: 'work', label: 'phase.hard1min', timeMs: min(1) },
      { kind: 'cooldown', label: 'phase.cooldown', timeMs: min(8) },
    ],
  },
  // --- Tempo & threshold -----------------------------------------------
  {
    id: 'tempo-20',
    name: 'Tempo 20',
    nameKey: 'workout.tempo-20.name',
    group: 'tempo',
    blurb: '20 min comfortably hard. Classic threshold work — raises the pace you can hold and toughens race feel (10K–HM).',
    blurbKey: 'workout.tempo-20.blurb',
    effort: 4,
    steps: [
      { kind: 'warmup', label: 'phase.warmup', timeMs: min(10) },
      { kind: 'work', label: 'phase.tempo', timeMs: min(20) },
      { kind: 'cooldown', label: 'phase.cooldown', timeMs: min(10) },
    ],
  },
  {
    id: 'cruise-5x5',
    name: 'Cruise 5 × 5',
    nameKey: 'workout.cruise-5x5.name',
    group: 'tempo',
    blurb: '5 × 5 min threshold with 1 min easy. More total threshold time than one long tempo, with short resets between.',
    blurbKey: 'workout.cruise-5x5.blurb',
    effort: 4,
    steps: [
      { kind: 'warmup', label: 'phase.warmup', timeMs: min(10) },
      {
        kind: 'repeat',
        times: 5,
        work: { label: 'phase.cruise', timeMs: min(5) },
        rest: { label: 'phase.easy', timeMs: min(1) },
      },
      { kind: 'cooldown', label: 'phase.cooldown', timeMs: min(10) },
    ],
  },
  {
    id: 'double-tempo',
    name: 'Double tempo 2 × 12',
    nameKey: 'workout.double-tempo.name',
    group: 'tempo',
    blurb: 'Two 12 min threshold blocks with a 3 min jog. Same goal as tempo, often easier to complete with a short break.',
    blurbKey: 'workout.double-tempo.blurb',
    effort: 4,
    steps: [
      { kind: 'warmup', label: 'phase.warmup', timeMs: min(10) },
      { kind: 'work', label: 'phase.tempo1', timeMs: min(12) },
      { kind: 'rest', label: 'phase.easyJog', timeMs: min(3) },
      { kind: 'work', label: 'phase.tempo2', timeMs: min(12) },
      { kind: 'cooldown', label: 'phase.cooldown', timeMs: min(10) },
    ],
  },
  // --- Speed, hills & VO2 ----------------------------------------------
  {
    id: 'hill-8x45',
    name: 'Hills 8 × 45 s',
    nameKey: 'workout.hill-8x45.name',
    group: 'speed',
    blurb: '8 × 45 s hard up (or flat drive) / 90 s easy. Strength, form, and power without pure track speed — great for hills or “power” days.',
    blurbKey: 'workout.hill-8x45.blurb',
    effort: 4,
    steps: [
      { kind: 'warmup', label: 'phase.warmup', timeMs: min(12) },
      {
        kind: 'repeat',
        times: 8,
        work: { label: 'phase.hillHard', timeMs: sec(45) },
        rest: { label: 'phase.easyDown', timeMs: sec(90) },
      },
      { kind: 'cooldown', label: 'phase.cooldown', timeMs: min(10) },
    ],
  },
  {
    id: '400-repeats',
    name: '6 × 400 m',
    nameKey: 'workout.400-repeats.name',
    group: 'speed',
    blurb: 'Short fast reps with 90 s recoveries. Builds leg speed, economy, and anaerobic snap — classic 5K speed work.',
    blurbKey: 'workout.400-repeats.blurb',
    effort: 5,
    steps: [
      { kind: 'warmup', label: 'phase.warmup', timeMs: min(10) },
      {
        kind: 'repeat',
        times: 6,
        work: { label: 'phase.m400', distanceM: 400 },
        rest: { label: 'phase.recover', timeMs: 90_000 },
      },
      { kind: 'cooldown', label: 'phase.cooldown', timeMs: min(10) },
    ],
  },
  {
    id: '800-repeats',
    name: '5 × 800 m',
    nameKey: 'workout.800-repeats.name',
    group: 'speed',
    blurb: 'Classic mid-distance track intervals, 2 min recoveries. VO₂ and pace control around 3–5K effort — race prep staple.',
    blurbKey: 'workout.800-repeats.blurb',
    effort: 5,
    steps: [
      { kind: 'warmup', label: 'phase.warmup', timeMs: min(12) },
      {
        kind: 'repeat',
        times: 5,
        work: { label: 'phase.m800', distanceM: 800 },
        rest: { label: 'phase.recover', timeMs: min(2) },
      },
      { kind: 'cooldown', label: 'phase.cooldown', timeMs: min(10) },
    ],
  },
  {
    id: 'vo2-3min',
    name: '5 × 3 min',
    nameKey: 'workout.vo2-3min.name',
    group: 'speed',
    blurb: 'Hard 3 min with equal easy rest. Targets max aerobic capacity (VO₂) — high-quality fitness builder.',
    blurbKey: 'workout.vo2-3min.blurb',
    effort: 5,
    steps: [
      { kind: 'warmup', label: 'phase.warmup', timeMs: min(10) },
      {
        kind: 'repeat',
        times: 5,
        work: { label: 'phase.hard', timeMs: min(3) },
        rest: { label: 'phase.easy', timeMs: min(3) },
      },
      { kind: 'cooldown', label: 'phase.cooldown', timeMs: min(10) },
    ],
  },
  {
    id: 'vo2-4x4',
    name: '4 × 4 min',
    nameKey: 'workout.vo2-4x4.name',
    group: 'speed',
    blurb: 'Classic 4×4 VO₂ intervals with equal recovery. Strong stimulus for aerobic max — best when you already have a base.',
    blurbKey: 'workout.vo2-4x4.blurb',
    effort: 5,
    steps: [
      { kind: 'warmup', label: 'phase.warmup', timeMs: min(12) },
      {
        kind: 'repeat',
        times: 4,
        work: { label: 'phase.hard', timeMs: min(4) },
        rest: { label: 'phase.easy', timeMs: min(4) },
      },
      { kind: 'cooldown', label: 'phase.cooldown', timeMs: min(10) },
    ],
  },
];

/** Built-in presets — sorted easiest → hardest within the full list. */
export let WORKOUT_PRESETS: WorkoutTemplate[] = WORKOUT_RECIPES.map(expandRecipe);

export function workoutById(id: string): WorkoutTemplate | null {
  return WORKOUT_PRESETS.find((w) => w.id === id) ?? null;
}

export function workoutGroupById(id: WorkoutGroupId): WorkoutGroup | null {
  return WORKOUT_GROUPS.find((g) => g.id === id) ?? null;
}

/** Presets in a group, easiest first. */
export function workoutsInGroup(groupId: WorkoutGroupId): WorkoutTemplate[] {
  return WORKOUT_PRESETS.filter((w) => w.group === groupId).sort((a, b) => {
    const ea = workoutEffortLevel(a);
    const eb = workoutEffortLevel(b);
    if (ea !== eb) return ea - eb;
    return a.name.localeCompare(b.name);
  });
}

/** The kind of a phase, as a key. Shares the phase-label vocabulary. */
export function phaseKindLabel(kind: PhaseKind): MessageKey {
  switch (kind) {
    case 'warmup':
      return 'phase.warmup';
    case 'work':
      return 'phase.work';
    case 'rest':
      return 'phase.rest';
    case 'cooldown':
      return 'phase.cooldown';
    case 'steady':
      return 'phase.steady';
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
    // Only key the name when the athlete did not supply one — their own text
    // must never be replaced by a translation.
    nameKey: options.name ? undefined : 'workout.custom.name',
    blurb: `${repeats} × ${options.workMin} min / ${options.restMin} min rest`,
    blurbKey: 'workout.custom.blurb',
    blurbVars: { repeats, work: options.workMin, rest: options.restMin },
    effort: 3,
    steps: [
      { kind: 'warmup', label: 'phase.warmup', timeMs: min(options.warmupMin) },
      {
        kind: 'repeat',
        times: repeats,
        work: { label: 'phase.work', timeMs: min(options.workMin) },
        rest: { label: 'phase.rest', timeMs: min(options.restMin) },
      },
      { kind: 'cooldown', label: 'phase.cooldown', timeMs: min(options.cooldownMin) },
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
