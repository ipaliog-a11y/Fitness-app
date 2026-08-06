/** Every run, with filters and optional week/month grouping. */

import { useMemo, useState } from 'react';
import { averagePace, modeIcon, type Activity } from '../core/activity';
import { estimateCalories, formatCalories } from '../core/calories';
import { goalMet } from '../core/goal';
import { ZONES } from '../core/heart';
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

function RunRow({
  activity,
  profile,
  onOpen,
}: {
  activity: Activity;
  profile: Profile;
  onOpen(id: string): void;
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

  return (
    <button className="run-item" type="button" onClick={() => onOpen(activity.id)}>
      <span className="glyph">{modeIcon(activity.mode)}</span>
      <span className="body">
        <span className="headline">
          {formatDistance(activity.distanceM, profile.units)} {distanceLabel(profile.units)}
          {' · '}
          {formatDuration(activity.durationMs)}
          {' · '}
          {formatCalories(calories)} kcal
          {hit ? ' · ✓ goal' : ''}
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
                    background: zone.colour,
                  }}
                  title={`Z${zone.index} ${Math.round(fraction * 100)}%`}
                />
              );
            })}
          </span>
        )}
      </span>
      <span aria-hidden style={{ color: 'var(--muted)' }}>
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

export function HistoryScreen({ activities, profile, onOpen }: Props) {
  const [filters, setFilters] = useState<HistoryFilters>(DEFAULT_HISTORY_FILTERS);

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

  if (activities.length === 0) {
    return (
      <div className="screen">
        <h1>{title}</h1>
        <div className="empty">
          <span className="glyph">🏃</span>
          No runs yet.
          <br />
          Your first one will appear here.
        </div>
      </div>
    );
  }

  return (
    <div className="screen">
      <h1>{title}</h1>
      <p className="subtitle">
        {filtered.length === activities.length
          ? `${activities.length} run${activities.length === 1 ? '' : 's'}`
          : `${filtered.length} of ${activities.length} runs`}
      </p>

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
        {(filters.mode !== 'all' ||
          filters.range !== 'all' ||
          filters.extra !== 'all' ||
          filters.groupBy !== 'week') && (
          <button
            type="button"
            className="btn wide"
            style={{ marginTop: 8 }}
            onClick={() => setFilters(DEFAULT_HISTORY_FILTERS)}
          >
            Reset filters
          </button>
        )}
      </div>

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
    </div>
  );
}
