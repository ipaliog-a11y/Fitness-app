/** History: filterable list or monthly calendar (runs + coach plan). */

import { useMemo, useState } from 'react';
import { averagePace, modeIcon, type Activity } from '../core/activity';
import {
  WEEKDAY_LABELS,
  addMonths,
  dayHasRuns,
  eventsOnDay,
  loadPlanEvents,
  monthGrid,
  monthTitle,
  runEvents,
  startOfDay,
  startOfMonth,
  type CalendarEvent,
} from '../core/calendar';
import { estimateCalories, formatCalories } from '../core/calories';
import { goalMet } from '../core/goal';
import { ZONES, zoneSwatch } from '../core/heart';
import {
  DEFAULT_HISTORY_FILTERS,
  filterActivities,
  groupActivities,
  type HistoryExtraFilter,
  type HistoryFilters,
  type HistoryGroupBy,
  type HistoryModeFilter,
  type HistoryRangeFilter,
} from '../core/history';
import type { Profile } from '../core/settings';
import {
  distanceLabel,
  formatDay,
  formatDistance,
  formatDuration,
  formatClock,
  formatPace,
  paceLabel,
} from '../core/units';

interface Props {
  activities: Activity[];
  profile: Profile;
  onOpen(id: string): void;
}

type ViewMode = 'list' | 'calendar';

function RunRow({
  activity,
  profile,
  onOpen,
  variant = 'list',
}: {
  activity: Activity;
  profile: Profile;
  onOpen(id: string): void;
  /** Calendar day list uses a compact run badge instead of the date badge. */
  variant?: 'list' | 'cal-run';
}) {
  const calories =
    activity.caloriesKcal ??
    Math.round(
      estimateCalories({
        distanceM: activity.distanceM,
        durationMs: activity.durationMs,
        weightKg: profile.weightKg,
        age: profile.age,
        sex: profile.sex,
        inclinePercent: activity.inclinePercent,
        heart: activity.heart,
      }).kcal,
    );
  const hit =
    activity.goal &&
    goalMet(activity.goal, {
      distanceM: activity.distanceM,
      durationMs: activity.durationMs,
      caloriesKcal: calories,
    });

  const report = activity.heartReport;
  const hasHr = Boolean(report || (activity.heart && activity.heart.length > 0));
  const started = new Date(activity.startedAt);
  const dayNum = started.getDate();
  const weekday = started.toLocaleDateString(undefined, { weekday: 'short' });
  const monoWhen = started
    .toLocaleDateString(undefined, { weekday: 'short', day: '2-digit' })
    .replace(',', '')
    .toUpperCase();

  return (
    <button
      className={`run-item${variant === 'cal-run' ? ' cal-run-row' : ''}`}
      type="button"
      onClick={() => onOpen(activity.id)}
    >
      <span className="run-item-bar" aria-hidden />
      <span className={`run-item-day${variant === 'cal-run' ? ' run' : ''}`} aria-hidden>
        {variant === 'cal-run' ? (
          <>
            <b>✓</b>
            <small>run</small>
          </>
        ) : (
          <>
            <b>{dayNum}</b>
            <small>{weekday}</small>
          </>
        )}
      </span>
      <span className="glyph">{modeIcon(activity.mode)}</span>
      <span className="body">
        <span className="run-item-top">
          <span className="headline">
            {formatDistance(activity.distanceM, profile.units)} {distanceLabel(profile.units)}
            {' · '}
            {formatDuration(activity.durationMs)}
            {' · '}
            {formatCalories(calories)} kcal
            {hit ? ' · ✓ goal' : ''}
          </span>
          <span className="run-item-when">{monoWhen}</span>
        </span>
        <span className="meta">
          {formatDay(activity.startedAt)} at {formatClock(activity.startedAt)} ·{' '}
          {formatPace(averagePace(activity, profile.units))} {paceLabel(profile.units)}
          {hasHr ? ' · ❤' : ''}
          {report ? ` · avg ${report.averageBpm} bpm` : ''}
          {activity.workoutName ? ` · ${activity.workoutName}` : ''}
        </span>
        {report && report.measuredMs > 0 && (
          <span className="history-zone-strip" aria-hidden>
            {ZONES.map((zone) => {
              const row = report.zones.find((z) => z.zoneIndex === zone.index);
              const fraction = row?.fraction ?? 0;
              if (fraction <= 0) return null;
              return (
                <span
                  key={zone.index}
                  style={{
                    flex: Math.max(fraction, 0.02),
                    background: zoneSwatch(zone),
                  }}
                  title={`Z${zone.index} ${Math.round(fraction * 100)}%`}
                />
              );
            })}
          </span>
        )}
      </span>
      <span className="run-item-chev" aria-hidden>
        ›
      </span>
    </button>
  );
}

function ChipRow<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Array<{ id: T; label: string }>;
  onChange(next: T): void;
}) {
  return (
    <div className="filter-row">
      <span className="filter-label">{label}</span>
      <div className="chip-row filter-chips">
        {options.map((opt) => (
          <button
            key={opt.id}
            type="button"
            className={`chip${value === opt.id ? ' active' : ''}`}
            aria-pressed={value === opt.id}
            onClick={() => onChange(opt.id)}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function CalendarView({
  activities,
  profile,
  onOpen,
}: {
  activities: Activity[];
  profile: Profile;
  onOpen(id: string): void;
}) {
  const now = Date.now();
  const [monthStart, setMonthStart] = useState(() => startOfMonth(now));
  const [selected, setSelected] = useState<number>(() => startOfDay(now));

  // Rebuild plan events when activities change (coach may have ticked sessions).
  const events: CalendarEvent[] = useMemo(() => {
    return [...runEvents(activities), ...loadPlanEvents()];
  }, [activities]);

  const cells = useMemo(() => monthGrid(monthStart, now), [monthStart, now]);

  const dayEvents = useMemo(() => eventsOnDay(events, selected), [events, selected]);

  const selectedLabel = new Date(selected).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });

  return (
    <div className="history-calendar-wrap">
      <div className="card history-calendar">
        <div className="cal-head">
          <h2 className="cal-title">{monthTitle(monthStart)}</h2>
          <div className="cal-nav-btns">
            <button
              type="button"
              className="cal-nav-btn"
              aria-label="Previous month"
              onClick={() => {
                const next = addMonths(monthStart, -1);
                setMonthStart(next);
                setSelected(next);
              }}
            >
              ‹
            </button>
            <button
              type="button"
              className="cal-nav-btn"
              aria-label="Next month"
              onClick={() => {
                const next = addMonths(monthStart, 1);
                setMonthStart(next);
                setSelected(next);
              }}
            >
              ›
            </button>
          </div>
        </div>

        <div className="cal-weekdays">
          {WEEKDAY_LABELS.map((d) => (
            <span key={d}>{d.slice(0, 1)}</span>
          ))}
        </div>

        <div className="cal-grid" role="grid" aria-label="Training calendar">
          {cells.map((cell, i) => {
            if (cell.dayStart === null || cell.day === null) {
              return <div className="cal-cell empty" key={`pad-${i}`} aria-hidden />;
            }
            const hasRun = cell.inMonth && dayHasRuns(events, cell.dayStart);
            const dayEv = cell.inMonth ? eventsOnDay(events, cell.dayStart) : [];
            const planOpen = dayEv.some((e) => e.type === 'plan' && !e.done);
            const planDone = dayEv.some((e) => e.type === 'plan' && e.done);
            const hasPlan = planOpen || planDone;
            const isSelected = cell.inMonth && cell.dayStart === selected;

            return (
              <button
                type="button"
                key={`${cell.dayStart}-${i}`}
                disabled={!cell.inMonth}
                className={[
                  'cal-cell',
                  cell.inMonth ? '' : 'outside',
                  cell.isToday ? 'today' : '',
                  isSelected ? 'selected' : '',
                  hasRun ? 'has-run' : '',
                  hasPlan ? 'has-plan' : '',
                  hasRun && hasPlan ? 'has-both' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => {
                  if (cell.inMonth) setSelected(cell.dayStart!);
                }}
              >
                <span className="cal-daynum">{cell.day}</span>
                {hasPlan && <span className="cal-plan-dot" aria-hidden />}
              </button>
            );
          })}
        </div>
      </div>

      <div className="cal-day-detail">
        <h3 className="history-group-title cal-day-heading">{selectedLabel}</h3>
        {dayEvents.length === 0 ? (
          <p className="hint" style={{ margin: 0 }}>
            Nothing logged or planned this day.
            {!loadPlanEvents().length && (
              <>
                {' '}
                Start a plan under <strong>Coach</strong> to see future sessions here.
              </>
            )}
          </p>
        ) : (
          dayEvents.map((ev) => {
            if (ev.type === 'run') {
              return (
                <RunRow
                  key={ev.id}
                  activity={ev.activity}
                  profile={profile}
                  onOpen={onOpen}
                  variant="cal-run"
                />
              );
            }
            return (
              <div
                key={ev.id}
                className={`run-item cal-plan-row${ev.done ? ' done' : ''}`}
              >
                <span className="run-item-bar plan" aria-hidden />
                <span className="run-item-day plan" aria-hidden>
                  <b>{ev.done ? '✓' : 'P'}</b>
                  <small>plan</small>
                </span>
                <span className="body">
                  <span className="headline">{ev.session.title}</span>
                  <span className="meta">
                    {ev.planName} · {ev.kindLabel}
                    {ev.at >= startOfDay(now) && !ev.done ? ' · upcoming' : ''}
                    {ev.done ? ' · done' : ''}
                    {ev.session.blurb ? ` · ${ev.session.blurb}` : ''}
                  </span>
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export function HistoryScreen({ activities, profile, onOpen }: Props) {
  const [view, setView] = useState<ViewMode>('list');
  const [filters, setFilters] = useState<HistoryFilters>(DEFAULT_HISTORY_FILTERS);
  const [moreFilters, setMoreFilters] = useState(false);

  const filtered = useMemo(
    () => filterActivities(activities, filters),
    [activities, filters],
  );
  const groups = useMemo(
    () => groupActivities(filtered, filters.groupBy),
    [filtered, filters.groupBy],
  );

  const set = <K extends keyof HistoryFilters>(key: K, value: HistoryFilters[K]) =>
    setFilters((f) => ({ ...f, [key]: value }));

  const name = (profile.displayName ?? '').trim();
  const title = name ? `${name}'s runs` : 'History';
  const hasPlan = loadPlanEvents().length > 0;

  const monthCount = useMemo(() => {
    const start = new Date();
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    return activities.filter((a) => a.startedAt >= start.getTime()).length;
  }, [activities]);

  const subtitle =
    view === 'calendar'
      ? new Date().toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
      : activities.length === 0
        ? 'No runs yet'
        : filtered.length === activities.length
          ? monthCount > 0
            ? `${monthCount} run${monthCount === 1 ? '' : 's'} this month`
            : `${activities.length} run${activities.length === 1 ? '' : 's'}`
          : `${filtered.length} of ${activities.length} runs`;

  const quickAll = filters.mode === 'all' && filters.range === 'all' && filters.extra === 'all';
  const filtersDirty =
    !quickAll || filters.groupBy !== 'week';

  return (
    <div className="screen history-screen">
      <div className="history-header">
        <div>
          <h1>{title}</h1>
          <p className="subtitle">{subtitle}</p>
        </div>
        <div className="view-toggle-compact" role="group" aria-label="History view">
          <button type="button" aria-pressed={view === 'list'} onClick={() => setView('list')}>
            List
          </button>
          <button
            type="button"
            aria-pressed={view === 'calendar'}
            onClick={() => setView('calendar')}
          >
            Cal
          </button>
        </div>
      </div>

      {view === 'calendar' ? (
        <CalendarView activities={activities} profile={profile} onOpen={onOpen} />
      ) : activities.length === 0 ? (
        <div className="empty">
          <span className="glyph">🏃</span>
          No runs yet.
          <br />
          Your first one will appear here.
          {hasPlan && (
            <>
              <br />
              <button
                type="button"
                className="btn"
                style={{ marginTop: 12 }}
                onClick={() => setView('calendar')}
              >
                See planned sessions
              </button>
            </>
          )}
        </div>
      ) : (
        <>
          <div className="filter-bar" role="toolbar" aria-label="Quick filters">
            <button
              type="button"
              className={`chip${quickAll ? ' active' : ''}`}
              onClick={() =>
                setFilters({
                  ...DEFAULT_HISTORY_FILTERS,
                  groupBy: filters.groupBy,
                })
              }
            >
              All
            </button>
            <button
              type="button"
              className={`chip${filters.range === 'week' ? ' active' : ''}`}
              onClick={() => set('range', filters.range === 'week' ? 'all' : 'week')}
            >
              This week
            </button>
            <button
              type="button"
              className={`chip${filters.mode === 'outdoor' ? ' active' : ''}`}
              onClick={() => set('mode', filters.mode === 'outdoor' ? 'all' : 'outdoor')}
            >
              Outdoor
            </button>
            <button
              type="button"
              className={`chip${moreFilters || filtersDirty ? ' active' : ''}`}
              aria-expanded={moreFilters}
              onClick={() => setMoreFilters((v) => !v)}
            >
              {moreFilters ? 'Less' : '+ Filters'}
            </button>
          </div>

          {moreFilters && (
            <div className="card history-filters">
              <ChipRow<HistoryModeFilter>
                label="Type"
                value={filters.mode}
                onChange={(v) => set('mode', v)}
                options={[
                  { id: 'all', label: 'All' },
                  { id: 'outdoor', label: 'Outdoor' },
                  { id: 'treadmill', label: 'Treadmill' },
                ]}
              />
              <ChipRow<HistoryRangeFilter>
                label="When"
                value={filters.range}
                onChange={(v) => set('range', v)}
                options={[
                  { id: 'all', label: 'All time' },
                  { id: 'week', label: 'This week' },
                  { id: 'month', label: 'This month' },
                  { id: 'year', label: 'This year' },
                ]}
              />
              <ChipRow<HistoryExtraFilter>
                label="With"
                value={filters.extra}
                onChange={(v) => set('extra', v)}
                options={[
                  { id: 'all', label: 'Anything' },
                  { id: 'hr', label: 'Heart rate' },
                  { id: 'workout', label: 'Workout' },
                  { id: 'goal', label: 'Had a goal' },
                ]}
              />
              <ChipRow<HistoryGroupBy>
                label="Group"
                value={filters.groupBy}
                onChange={(v) => set('groupBy', v)}
                options={[
                  { id: 'week', label: 'By week' },
                  { id: 'month', label: 'By month' },
                  { id: 'none', label: 'Flat list' },
                ]}
              />
              {filtersDirty && (
                <button
                  type="button"
                  className="btn wide"
                  style={{ marginTop: 8 }}
                  onClick={() => {
                    setFilters(DEFAULT_HISTORY_FILTERS);
                    setMoreFilters(false);
                  }}
                >
                  Reset filters
                </button>
              )}
            </div>
          )}

          {filtered.length === 0 ? (
            <div className="empty" style={{ marginTop: 12 }}>
              No runs match these filters.
            </div>
          ) : (
            groups.map((group) => (
              <section className="history-group" key={group.key}>
                {group.label && <h2 className="history-group-title">{group.label}</h2>}
                {group.activities.map((activity) => (
                  <RunRow
                    key={activity.id}
                    activity={activity}
                    profile={profile}
                    onOpen={onOpen}
                  />
                ))}
              </section>
            ))
          )}
        </>
      )}
    </div>
  );
}
