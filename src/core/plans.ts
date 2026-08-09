import type { MessageKey, Vars } from '../i18n';
/**
 * Lightweight training plans — schedules of easy / long / quality days.
 *
 * Plans are templates; progress is stored in localStorage. Completing a session
 * is manual (check-off) so GPS noise never falsely ticks a workout.
 */

import { newId } from './activity';
import { startOfWeek } from './stats';

const KEY = 'runlog:active-plan:v1';

export type PlanSessionKind = 'easy' | 'long' | 'intervals' | 'tempo' | 'rest';

export interface PlanSession {
  /** 0-based week within the plan. */
  week: number;
  /** 0 = Monday … 6 = Sunday. */
  dayOfWeek: number;
  title: MessageKey;
  kind: PlanSessionKind;
  blurb: MessageKey;
  /** Substitutions for blurbs that quote a target distance or duration. */
  blurbVars?: Vars;
  /** Suggested distance in metres, when relevant. */
  targetDistanceM?: number;
  /** Suggested moving time in ms. */
  targetDurationMs?: number;
  /** Optional structured workout id from WORKOUT_PRESETS. */
  workoutId?: string;
}

export interface PlanTemplate {
  id: string;
  name: MessageKey;
  blurb: MessageKey;
  weeks: number;
  level: 'beginner' | 'improver' | 'base';
  sessions: PlanSession[];
}

export interface ActivePlanState {
  id: string;
  planId: string;
  /** Monday 00:00 of plan week 0. */
  startedWeekAt: number;
  /** Keys `${week}-${dayOfWeek}-${title}` marked done. */
  completed: string[];
}

function sessionKey(s: PlanSession): string {
  return `${s.week}-${s.dayOfWeek}-${s.title}`;
}

export function planSessionKey(s: PlanSession): string {
  return sessionKey(s);
}

const min = (n: number) => n * 60_000;
const km = (n: number) => n * 1000;

/** Built-in plans (Phase D). */
export const PLAN_TEMPLATES: PlanTemplate[] = [
  {
    id: 'start-to-run',
    name: 'plan.start-to-run.name',
    blurb: 'plan.start-to-run.blurb',
    weeks: 8,
    level: 'beginner',
    sessions: flattenWeeks(8, (week) => {
      const runMin = Math.min(30, 10 + week * 2.5);
      const walkMin = Math.max(0, 5 - week * 0.5);
      return [
        {
          dayOfWeek: 1,
          title: 'planSession.easyWithWalkBreaks.title',
          kind: 'easy' as const,
          blurb: 'planSession.aboutMinEasy.blurb',
          blurbVars: { minutes: Math.round(runMin) },
          targetDurationMs: min(runMin + walkMin),
          workoutId: week < 3 ? 'beginner-walk-run' : week < 6 ? 'walk-run-2-1' : 'easy-30',
        },
        {
          dayOfWeek: 3,
          title: 'planSession.easy.title',
          kind: 'easy' as const,
          blurb: 'planSession.keepItConversationalShorterI.blurb',
          targetDurationMs: min(Math.max(15, runMin - 5)),
        },
        {
          dayOfWeek: 5,
          title: 'planSession.longerEasy.title',
          kind: 'long' as const,
          blurb: 'planSession.buildPatience.blurb',
          blurbVars: { minutes: Math.round(runMin + 5) },
          targetDurationMs: min(runMin + 5),
        },
      ];
    }),
  },
  {
    id: 'first-5k',
    name: 'plan.first-5k.name',
    blurb: 'plan.first-5k.blurb',
    weeks: 6,
    level: 'beginner',
    sessions: flattenWeeks(6, (week) => {
      const longKm = Math.min(5, 2.5 + week * 0.5);
      return [
        {
          dayOfWeek: 1,
          title: 'planSession.easy.title',
          kind: 'easy' as const,
          blurb: 'planSession.relaxedPaceAbout2030Minutes.blurb',
          targetDurationMs: min(25),
        },
        {
          dayOfWeek: 3,
          title: week >= 4 ? 'planSession.gentlePickups.title' : 'planSession.easy.title',
          kind: week >= 4 ? ('tempo' as const) : ('easy' as const),
          blurb:
            week >= 4
              ? 'planSession.finishQuicker.blurb'
              : 'planSession.stayEasy.blurb',
          targetDurationMs: min(30),
          workoutId: week >= 4 ? 'fartlek-20' : undefined,
        },
        {
          dayOfWeek: 6,
          title: 'planSession.longRun.title',
          kind: 'long' as const,
          blurb: 'planSession.buildToward5k.blurb',
          blurbVars: { km: longKm.toFixed(1) },
          targetDistanceM: km(longKm),
        },
      ];
    }),
  },
  {
    id: 'base-builder',
    name: 'plan.base-builder.name',
    blurb: 'plan.base-builder.blurb',
    weeks: 4,
    level: 'base',
    sessions: flattenWeeks(4, (week) => {
      const easyKm = 5 + week;
      const longKm = 8 + week * 1.5;
      return [
        {
          dayOfWeek: 0,
          title: 'planSession.easy.title',
          kind: 'easy' as const,
          blurb: 'planSession.kmEasy.blurb',
          blurbVars: { km: easyKm },
          targetDistanceM: km(easyKm),
        },
        {
          dayOfWeek: 2,
          title: 'planSession.easyOrStrides.title',
          kind: 'easy' as const,
          blurb: 'planSession.keepItLightOptionalShortStri.blurb',
          targetDistanceM: km(easyKm),
        },
        {
          dayOfWeek: 4,
          title: 'planSession.quality.title',
          kind: 'intervals' as const,
          blurb: 'planSession.oneFocusedSessionTempoOrShor.blurb',
          targetDurationMs: min(40),
          workoutId: week % 2 === 0 ? 'tempo-20' : 'vo2-3min',
        },
        {
          dayOfWeek: 6,
          title: 'planSession.longRun.title',
          kind: 'long' as const,
          blurb: 'planSession.longAerobic.blurb',
          blurbVars: { km: longKm.toFixed(0) },
          targetDistanceM: km(longKm),
        },
      ];
    }),
  },
  {
    id: 'return-to-run',
    name: 'plan.return-to-run.name',
    blurb: 'plan.return-to-run.blurb',
    weeks: 3,
    level: 'beginner',
    sessions: flattenWeeks(3, (week) => {
      const mins = 15 + week * 5;
      return [
        {
          dayOfWeek: 1,
          title: 'planSession.easy.title',
          kind: 'easy' as const,
          blurb: 'planSession.minutesEasyWalk.blurb',
          blurbVars: { minutes: mins },
          targetDurationMs: min(mins),
          workoutId: 'beginner-walk-run',
        },
        {
          dayOfWeek: 3,
          title: 'planSession.easy.title',
          kind: 'easy' as const,
          blurb: 'planSession.sameIdeaKeepItShort.blurb',
          targetDurationMs: min(mins),
        },
        {
          dayOfWeek: 5,
          title: 'planSession.easy.title',
          kind: 'easy' as const,
          blurb: 'planSession.finishTheWeekWithoutChasingP.blurb',
          targetDurationMs: min(mins + 5),
        },
      ];
    }),
  },
];

function flattenWeeks(
  weeks: number,
  builder: (week: number) => Array<Omit<PlanSession, 'week'>>,
): PlanSession[] {
  const out: PlanSession[] = [];
  for (let w = 0; w < weeks; w++) {
    for (const s of builder(w)) {
      out.push({ ...s, week: w });
    }
  }
  return out;
}

export function planById(id: string): PlanTemplate | null {
  return PLAN_TEMPLATES.find((p) => p.id === id) ?? null;
}

export function loadActivePlan(): ActivePlanState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<ActivePlanState>;
    if (typeof p.planId !== 'string' || typeof p.startedWeekAt !== 'number') return null;
    if (!planById(p.planId)) return null;
    return {
      id: typeof p.id === 'string' ? p.id : newId(),
      planId: p.planId,
      startedWeekAt: p.startedWeekAt,
      completed: Array.isArray(p.completed) ? p.completed.filter((x) => typeof x === 'string') : [],
    };
  } catch {
    return null;
  }
}

export function saveActivePlan(state: ActivePlanState | null): void {
  try {
    if (!state) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

export function startPlan(planId: string, now = Date.now()): ActivePlanState | null {
  if (!planById(planId)) return null;
  const state: ActivePlanState = {
    id: newId(),
    planId,
    startedWeekAt: startOfWeek(now),
    completed: [],
  };
  saveActivePlan(state);
  return state;
}

export function clearPlan(): void {
  saveActivePlan(null);
}

export function toggleSessionComplete(
  state: ActivePlanState,
  session: PlanSession,
): ActivePlanState {
  const key = sessionKey(session);
  const has = state.completed.includes(key);
  const completed = has
    ? state.completed.filter((k) => k !== key)
    : [...state.completed, key];
  const next = { ...state, completed };
  saveActivePlan(next);
  return next;
}

export function isSessionComplete(state: ActivePlanState, session: PlanSession): boolean {
  return state.completed.includes(sessionKey(session));
}

/** Current plan week index (0-based), clamped to the template. */
export function currentPlanWeek(state: ActivePlanState, plan: PlanTemplate, now = Date.now()): number {
  const elapsed = Math.floor((startOfWeek(now) - state.startedWeekAt) / (7 * 86_400_000));
  return Math.max(0, Math.min(plan.weeks - 1, elapsed));
}

export function sessionsForWeek(plan: PlanTemplate, week: number): PlanSession[] {
  return plan.sessions.filter((s) => s.week === week).sort((a, b) => a.dayOfWeek - b.dayOfWeek);
}

export function weekProgress(
  state: ActivePlanState,
  plan: PlanTemplate,
  week: number,
): { done: number; total: number } {
  const sessions = sessionsForWeek(plan, week).filter((s) => s.kind !== 'rest');
  const done = sessions.filter((s) => isSessionComplete(state, s)).length;
  return { done, total: sessions.length };
}

export function planOverallProgress(state: ActivePlanState, plan: PlanTemplate): number {
  const runnable = plan.sessions.filter((s) => s.kind !== 'rest');
  if (runnable.length === 0) return 0;
  const done = runnable.filter((s) => isSessionComplete(state, s)).length;
  return done / runnable.length;
}

/**
 * Short weekday name, from Intl rather than a catalogue.
 *
 * Weekday names are not app copy — every locale already ships them, correctly
 * abbreviated and correctly capitalised for that language. Putting seven
 * strings per locale in the catalogue would be work that Intl does better,
 * and would go wrong the moment a locale abbreviates differently.
 *
 * 2024-01-01 was a Monday, which is what makes dayOfWeek 0 = Monday line up.
 */
export function dayName(dayOfWeek: number, tag = 'en-GB'): string {
  const index = Math.trunc(dayOfWeek);
  if (!Number.isFinite(index) || index < 0 || index > 6) return `D${dayOfWeek}`;
  const monday = Date.UTC(2024, 0, 1 + index);
  return new Intl.DateTimeFormat(tag, { weekday: 'short', timeZone: 'UTC' }).format(monday);
}

export function kindLabel(kind: PlanSessionKind): MessageKey {
  switch (kind) {
    case 'easy':
      return 'planKind.easy';
    case 'long':
      return 'planKind.long';
    case 'intervals':
      return 'planKind.intervals';
    case 'tempo':
      return 'planKind.tempo';
    case 'rest':
      return 'planKind.rest';
  }
}

/** Next incomplete session on or after today within the current plan week. */
export function nextSession(
  state: ActivePlanState,
  plan: PlanTemplate,
  now = Date.now(),
): PlanSession | null {
  const week = currentPlanWeek(state, plan, now);
  const jsDay = new Date(now).getDay(); // 0 Sun
  const today = jsDay === 0 ? 6 : jsDay - 1;
  const sessions = sessionsForWeek(plan, week).filter((s) => s.kind !== 'rest');

  const upcoming = sessions.find(
    (s) => s.dayOfWeek >= today && !isSessionComplete(state, s),
  );
  if (upcoming) return upcoming;

  const later = sessions.find((s) => !isSessionComplete(state, s));
  if (later) return later;

  // Look ahead one week if any remain in plan.
  if (week + 1 < plan.weeks) {
    const next = sessionsForWeek(plan, week + 1).find(
      (s) => s.kind !== 'rest' && !isSessionComplete(state, s),
    );
    return next ?? null;
  }
  return null;
}
