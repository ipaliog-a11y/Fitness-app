/** The dashboard: this week, the last twelve, and the records. */

import { type Activity } from '../core/activity';
import { tipsForWeek } from '../core/coach';
import type { Profile } from '../core/settings';
import {
  activitiesBetween,
  addWeeks,
  currentStreak,
  personalRecords,
  startOfWeek,
  totals,
  weeklyBuckets,
} from '../core/stats';
import { distanceLabel, formatDistance, formatDuration, formatPace, paceLabel } from '../core/units';
import { WeeklyBars } from './charts';
import { useTipText } from '../i18n/react';

interface Props {
  activities: Activity[];
  profile: Profile;
  onOpen(id: string): void;
}

export function StatsScreen({ activities, profile, onOpen }: Props) {
  const tipText = useTipText();
  const now = Date.now();
  const weekStart = startOfWeek(now);

  const thisWeek = totals(
    activitiesBetween(activities, weekStart, addWeeks(weekStart, 1)),
    profile.units,
  );
  const allTime = totals(activities, profile.units);
  const weeks = weeklyBuckets(activities, 12, now);
  const records = personalRecords(activities);
  const streak = currentStreak(activities, now);

  const tips = tipsForWeek(activities, {
    units: profile.units,
    maxHeartRate: profile.maxHeartRate,
    weeklyGoalM: profile.weeklyGoalM,
    now,
  });

  const goalShare =
    profile.weeklyGoalM > 0 ? Math.min(thisWeek.distanceM / profile.weeklyGoalM, 1) : 0;

  return (
    <div className="screen">
      <h1>Dashboard</h1>
      <p className="subtitle">
        {allTime.runs} run{allTime.runs === 1 ? '' : 's'} ·{' '}
        {formatDistance(allTime.distanceM, profile.units, 1)} {distanceLabel(profile.units)} all
        time
        {streak > 0 && ` · ${streak}-day streak`}
      </p>

      <div className="card">
        <h2>This week</h2>
        <div className="metric-grid">
          <div className="metric">
            <div className="value">{formatDistance(thisWeek.distanceM, profile.units, 1)}</div>
            <div className="label">{distanceLabel(profile.units)}</div>
          </div>
          <div className="metric">
            <div className="value">{formatDuration(thisWeek.durationMs)}</div>
            <div className="label">Time</div>
          </div>
          <div className="metric">
            <div className="value">{formatPace(thisWeek.paceSecondsPerUnit)}</div>
            <div className="label">Avg {paceLabel(profile.units)}</div>
          </div>
        </div>

        {profile.weeklyGoalM > 0 && (
          <>
            <div className="zone-row" style={{ marginTop: 16, marginBottom: 4 }}>
              <span className="name" style={{ width: 'auto' }}>
                Goal
              </span>
              <span className="track">
                <span style={{ width: `${goalShare * 100}%`, background: 'var(--accent)' }} />
              </span>
              <span className="time">{Math.round(goalShare * 100)}%</span>
            </div>
            <p className="hint">
              {formatDistance(thisWeek.distanceM, profile.units, 1)} of{' '}
              {formatDistance(profile.weeklyGoalM, profile.units, 1)}{' '}
              {distanceLabel(profile.units)} this week
            </p>
          </>
        )}
      </div>

      <div className="card">
        <h2>Last 12 weeks</h2>
        <WeeklyBars weeks={weeks} units={profile.units} />
      </div>

      <div className="card">
        <h2>Personal records</h2>
        {records.every((r) => r.durationMs === null) ? (
          <p className="hint">
            Records come from GPS runs — the fastest continuous stretch inside any run, so a quick
            5 km buried in a longer one still counts.
          </p>
        ) : (
          records
            .filter((record) => record.durationMs !== null)
            .map((record) => (
              <div className="row" key={record.label}>
                <span>{record.label}</span>
                <span style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <strong>{formatDuration(record.durationMs!)}</strong>
                  {record.activityId && (
                    <button
                      className="pill"
                      onClick={() => onOpen(record.activityId!)}
                      style={{ cursor: 'pointer' }}
                    >
                      View
                    </button>
                  )}
                </span>
              </div>
            ))
        )}
      </div>

      {tips.length > 0 && (
        <div className="card">
          <h2>Coach</h2>
          {tips.map((tip, i) => (
            <div className={`tip ${tip.tone}`} key={i}>
              <div className="title">{tipText(tip).title}</div>
              <div className="body">{tipText(tip).body}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
