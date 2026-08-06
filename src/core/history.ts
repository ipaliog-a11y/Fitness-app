/**
 * History list filters and grouping — pure so the screen stays thin.
 */

import type { Activity, RunMode } from './activity';

export type HistoryModeFilter = 'all' | RunMode;
export type HistoryRangeFilter = 'all' | 'week' | 'month' | 'year';
export type HistoryExtraFilter = 'all' | 'hr' | 'workout' | 'goal';
export type HistoryGroupBy = 'none' | 'week' | 'month';

export interface HistoryFilters {
  mode: HistoryModeFilter;
  range: HistoryRangeFilter;
  extra: HistoryExtraFilter;
  groupBy: HistoryGroupBy;
}

export const DEFAULT_HISTORY_FILTERS: HistoryFilters = {
  mode: 'all',
  range: 'all',
  extra: 'all',
  groupBy: 'week',
};

function startOfLocalDay(t: number): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Monday-based week start (local), matching the dashboard. */
export function startOfWeek(t: number): number {
  const d = new Date(startOfLocalDay(t));
  const day = d.getDay(); // 0 Sun … 6 Sat
  const offset = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - offset);
  return d.getTime();
}

export function startOfMonth(t: number): number {
  const d = new Date(t);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function startOfYear(t: number): number {
  const d = new Date(t);
  d.setMonth(0, 1);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function filterActivities(
  activities: Activity[],
  filters: HistoryFilters,
  now = Date.now(),
): Activity[] {
  let rangeStart = 0;
  if (filters.range === 'week') rangeStart = startOfWeek(now);
  else if (filters.range === 'month') rangeStart = startOfMonth(now);
  else if (filters.range === 'year') rangeStart = startOfYear(now);

  return activities.filter((a) => {
    if (filters.mode !== 'all' && a.mode !== filters.mode) return false;
    if (rangeStart > 0 && a.startedAt < rangeStart) return false;
    if (filters.extra === 'hr' && (!a.heart || a.heart.length === 0)) return false;
    if (filters.extra === 'workout' && !a.workoutId && !a.workoutName) return false;
    if (filters.extra === 'goal' && !a.goal) return false;
    return true;
  });
}

export interface HistoryGroup {
  key: string;
  label: string;
  activities: Activity[];
}

function monthLabel(t: number): string {
  return new Date(t).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

function weekLabel(weekStart: number): string {
  const end = new Date(weekStart);
  end.setDate(end.getDate() + 6);
  const a = new Date(weekStart).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const b = end.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return `${a} – ${b}`;
}

export function groupActivities(
  activities: Activity[],
  groupBy: HistoryGroupBy,
): HistoryGroup[] {
  if (groupBy === 'none') {
    return [{ key: 'all', label: '', activities }];
  }

  const map = new Map<string, HistoryGroup>();
  for (const a of activities) {
    const key =
      groupBy === 'week' ? String(startOfWeek(a.startedAt)) : String(startOfMonth(a.startedAt));
    let group = map.get(key);
    if (!group) {
      const t = Number(key);
      group = {
        key,
        label: groupBy === 'week' ? weekLabel(t) : monthLabel(t),
        activities: [],
      };
      map.set(key, group);
    }
    group.activities.push(a);
  }

  // Newest group first (keys are epoch starts).
  return [...map.values()].sort((a, b) => Number(b.key) - Number(a.key));
}
