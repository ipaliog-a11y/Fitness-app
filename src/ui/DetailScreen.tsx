/** One run, in full: route, splits, heart zones and the coach's read on it. */

import { useState } from 'react';
import {
  averagePace,
  hasRoute,
  modeName,
  splits,
  totalAscent,
  type Activity,
} from '../core/activity';
import { tipsForRun } from '../core/coach';
import { summariseHeart } from '../core/heart';
import { ascentFromIncline } from '../core/steps';
import type { Profile } from '../core/settings';
import {
  distanceLabel,
  formatClock,
  formatDay,
  formatDistance,
  formatDuration,
  formatPace,
  paceLabel,
} from '../core/units';
import { HeartChart, SplitsTable, ZoneBars } from './charts';
import { RouteMap } from './RouteMap';

interface Props {
  activity: Activity;
  history: Activity[];
  profile: Profile;
  onBack(): void;
  onDelete(id: string): void;
  onNoteChange(id: string, note: string): void;
}

export function DetailScreen({
  activity,
  history,
  profile,
  onBack,
  onDelete,
  onNoteChange,
}: Props) {
  const [note, setNote] = useState(activity.note);
  const [confirming, setConfirming] = useState(false);

  const heart = summariseHeart(activity.heart, profile.maxHeartRate);
  const runSplits = splits(activity, profile.units);
  const tips = tipsForRun(activity, history, {
    units: profile.units,
    maxHeartRate: profile.maxHeartRate,
    weeklyGoalM: profile.weeklyGoalM,
    now: activity.startedAt,
  });

  const ascent =
    activity.inclinePercent !== null
      ? ascentFromIncline(activity.distanceM, activity.inclinePercent)
      : totalAscent(activity);

  return (
    <div className="screen">
      <button className="back" onClick={onBack}>
        ‹ Back
      </button>

      <h1>
        {formatDistance(activity.distanceM, profile.units)} {distanceLabel(profile.units)}
      </h1>
      <p className="subtitle">
        {modeName(activity.mode)} · {formatDay(activity.startedAt)} at{' '}
        {formatClock(activity.startedAt)}
      </p>

      {hasRoute(activity) && (
        <div style={{ marginBottom: 12 }}>
          <RouteMap segments={activity.segments} />
        </div>
      )}

      <div className="metric-grid" style={{ marginBottom: 12 }}>
        <div className="metric">
          <div className="value">{formatDuration(activity.durationMs)}</div>
          <div className="label">Moving</div>
        </div>
        <div className="metric">
          <div className="value">{formatPace(averagePace(activity, profile.units))}</div>
          <div className="label">Avg {paceLabel(profile.units)}</div>
        </div>
        <div className="metric">
          <div className="value">{heart ? heart.averageBpm : '—'}</div>
          <div className="label">Avg bpm</div>
        </div>
      </div>

      {(ascent > 1 || activity.steps !== null) && (
        <div className="metric-grid" style={{ marginBottom: 12 }}>
          {ascent > 1 && (
            <div className="metric">
              <div className="value">{Math.round(ascent)}</div>
              <div className="label">m climbed</div>
            </div>
          )}
          {activity.steps !== null && (
            <div className="metric">
              <div className="value">{activity.steps.toLocaleString()}</div>
              <div className="label">Steps</div>
            </div>
          )}
          {heart && (
            <div className="metric">
              <div className="value">{heart.maxBpm}</div>
              <div className="label">Max bpm</div>
            </div>
          )}
        </div>
      )}

      {heart && (
        <div className="card">
          <h2>Heart rate zones</h2>
          <ZoneBars summary={heart} maxHeartRate={profile.maxHeartRate} />
          <div style={{ marginTop: 14 }}>
            <HeartChart samples={activity.heart} maxHeartRate={profile.maxHeartRate} />
          </div>
        </div>
      )}

      {runSplits.length > 0 && (
        <div className="card">
          <h2>Splits</h2>
          <SplitsTable splits={runSplits} units={profile.units} />
        </div>
      )}

      {tips.length > 0 && (
        <div className="card">
          <h2>Notes from the coach</h2>
          {tips.map((tip, i) => (
            <div className={`tip ${tip.tone}`} key={i}>
              <div className="title">{tip.title}</div>
              <div className="body">{tip.body}</div>
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <h2>Your note</h2>
        <textarea
          rows={3}
          value={note}
          placeholder="How did it feel?"
          onChange={(e) => setNote(e.target.value)}
          // Saved on blur rather than per keystroke: every change is a write to
          // IndexedDB, and one per letter is a lot of writes for no benefit.
          onBlur={() => note !== activity.note && onNoteChange(activity.id, note)}
        />
      </div>

      {confirming ? (
        <div className="btn-row">
          <button className="btn" onClick={() => setConfirming(false)}>
            Keep
          </button>
          <button className="btn danger" onClick={() => onDelete(activity.id)}>
            Delete for good
          </button>
        </div>
      ) : (
        <button className="btn danger wide" onClick={() => setConfirming(true)}>
          Delete this run
        </button>
      )}
    </div>
  );
}
