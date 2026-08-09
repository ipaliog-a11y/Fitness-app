/**
 * Month calendar helpers: day grids, run placement, and coach plan dates.
 *
 * Weeks start on Monday to match the rest of the training week model.
 */

import type { MessageKey } from '../i18n';

import type { Activity } from './activity';
import {
  isSessionComplete,
  kindLabel,
  loadActivePlan,
  planById,
  type ActivePlanState,
  type PlanSession,
  type PlanTemplate,
} from './plans';
import { loadWeightStore, type WeightEntry } from './weight';

export function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function startOfMonth(ts: number): number {
  const d = new Date(ts);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function addMonths(ts: number, months: number): number {
  const d = new Date(ts);
  d.setMonth(d.getMonth() + months);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Absolute local midnight for a plan session (week 0 Monday + offsets). */
export function planSessionAt(state: ActivePlanState, session: PlanSession): number {
  const d = new Date(state.startedWeekAt);
  d.setDate(d.getDate() + session.week * 7 + session.dayOfWeek);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export type CalendarRunEvent = {
  type: 'run';
  id: string;
  at: number;
  activity: Activity;
};

export type CalendarPlanEvent = {
  type: 'plan';
  id: string;
  at: number;
  session: PlanSession;
  planName: MessageKey;
  done: boolean;
  kindLabel: MessageKey;
};

export type CalendarWeightEvent = {
  type: 'weight';
  id: string;
  at: number;
  entry: WeightEntry;
};

export type CalendarEvent = CalendarRunEvent | CalendarPlanEvent | CalendarWeightEvent;

export function runEvents(activities: Activity[]): CalendarRunEvent[] {
  return activities.map((a) => ({
    type: 'run' as const,
    id: `run-${a.id}`,
    at: startOfDay(a.startedAt),
    activity: a,
  }));
}

export function planEvents(
  state: ActivePlanState | null,
  plan: PlanTemplate | null = state ? planById(state.planId) : null,
): CalendarPlanEvent[] {
  if (!state || !plan) return [];
  return plan.sessions
    .filter((s) => s.kind !== 'rest')
    .map((session) => {
      const at = planSessionAt(state, session);
      return {
        type: 'plan' as const,
        id: `plan-${session.week}-${session.dayOfWeek}-${session.title}`,
        at,
        session,
        planName: plan.name,
        done: isSessionComplete(state, session),
        kindLabel: kindLabel(session.kind),
      };
    });
}

/** Active coach plan events (reads localStorage). */
export function loadPlanEvents(): CalendarPlanEvent[] {
  const state = loadActivePlan();
  if (!state) return [];
  return planEvents(state, planById(state.planId));
}

export function weightEvents(entries?: WeightEntry[]): CalendarWeightEvent[] {
  const list = entries ?? loadWeightStore().entries;
  return list.map((entry) => ({
    type: 'weight' as const,
    id: `weight-${entry.id}`,
    at: startOfDay(entry.at),
    entry,
  }));
}

const TYPE_ORDER: Record<CalendarEvent['type'], number> = {
  run: 0,
  weight: 1,
  plan: 2,
};

export function eventsOnDay(events: CalendarEvent[], dayStart: number): CalendarEvent[] {
  const start = startOfDay(dayStart);
  return events
    .filter((e) => e.at === start)
    .sort((a, b) => {
      if (a.type !== b.type) return TYPE_ORDER[a.type] - TYPE_ORDER[b.type];
      if (a.type === 'plan' && b.type === 'plan') {
        if (a.done !== b.done) return a.done ? 1 : -1;
      }
      return 0;
    });
}

export function dayHasRuns(events: CalendarEvent[], dayStart: number): boolean {
  return eventsOnDay(events, dayStart).some((e) => e.type === 'run');
}

export function dayHasPlan(events: CalendarEvent[], dayStart: number): boolean {
  return eventsOnDay(events, dayStart).some((e) => e.type === 'plan');
}

export interface MonthCell {
  /** Local midnight, or null for padding cells outside the month. */
  dayStart: number | null;
  /** 1–31 when in month. */
  day: number | null;
  inMonth: boolean;
  isToday: boolean;
}

/**
 * 6×7 grid (Mon→Sun) covering the month that contains `monthStart`.
 */
export function monthGrid(monthStart: number, now = Date.now()): MonthCell[] {
  const month = new Date(startOfMonth(monthStart));
  const year = month.getFullYear();
  const mon = month.getMonth();

  // Monday-based offset of the 1st.
  const first = new Date(year, mon, 1);
  const jsDay = first.getDay(); // 0 Sun
  const mondayOffset = jsDay === 0 ? 6 : jsDay - 1;

  const today = startOfDay(now);
  const cells: MonthCell[] = [];
  const cursor = new Date(year, mon, 1 - mondayOffset);

  for (let i = 0; i < 42; i++) {
    const dayStart = startOfDay(cursor.getTime());
    const inMonth = cursor.getMonth() === mon;
    cells.push({
      // Keep dayStart for padding cells so layout stays a full 6×7 grid with
      // muted adjacent-month numbers (matches mockups; avoids empty collapse).
      dayStart,
      day: cursor.getDate(),
      inMonth,
      isToday: inMonth && dayStart === today,
    });
    cursor.setDate(cursor.getDate() + 1);
  }
  return cells;
}

export function monthTitle(monthStart: number, tag: string): string {
  return new Date(monthStart).toLocaleDateString(tag, {
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Monday-first weekday initials for the calendar header.
 *
 * Built from Intl rather than held as a constant array: the old constant was
 * seven English strings, so the calendar stayed English in every language. Any
 * Monday works as the seed — 5 Jan 1970 is one.
 */
export function weekdayLabels(tag: string): string[] {
  const format = new Intl.DateTimeFormat(tag, { weekday: 'short' });
  const monday = new Date(1970, 0, 5);
  return Array.from({ length: 7 }, (_, i) =>
    format.format(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i)),
  );
}
