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
import {
  calorieSourceLabel,
  estimateCalories,
  formatCalories,
} from '../core/calories';
import { tipsForRun } from '../core/coach';
import {
  formatGoalTarget,
  goalKindLabel,
  goalMet,
  goalProgress,
} from '../core/goal';
import { activityToGpx, downloadText } from '../core/gpx';
import {
  heartSummaryFromReport,
  summariseHeart,
  type HeartSummary,
} from '../core/heart';
import { loadRoutes, routeFromActivity, saveRoutes } from '../core/routes';
import type { Profile } from '../core/settings';
import { loadShoes } from '../core/shoes';
import { ascentFromIncline } from '../core/steps';
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
  /** Save note (if needed) and return to the main Run screen. */
  onSave(): void;
  onDelete(id: string): void;
  onNoteChange(id: string, note: string): void;
  onToast?(message: string): void;
}

export function DetailScreen({
  activity,
  history,
  profile,
  onBack,
  onSave,
  onDelete,
  onNoteChange,
  onToast,
}: Props) {
  const [note, setNote] = useState(activity.note);
  const [confirming, setConfirming] = useState(false);

  // Prefer the zone report frozen at finish (stable if max HR changes later).
  const heart: HeartSummary | null = activity.heartReport
    ? heartSummaryFromReport(activity.heartReport)
    : summariseHeart(activity.heart, profile.maxHeartRate);
  const reportMaxHr = activity.heartReport?.maxHeartRate ?? profile.maxHeartRate;
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

  const calorieEst = estimateCalories({
    distanceM: activity.distanceM,
    durationMs: activity.durationMs,
    weightKg: profile.weightKg,
    age: profile.age,
    sex: profile.sex,
    inclinePercent: activity.inclinePercent,
    heart: activity.heart,
  });
  // Prefer the number saved at finish; recompute only for older records.
  // Source is always derived from the same inputs so the label stays honest.
  const calories = activity.caloriesKcal ?? Math.round(calorieEst.kcal);
  const calorieSource = calorieEst.source;

  const goalSnap = {
    distanceM: activity.distanceM,
    durationMs: activity.durationMs,
    caloriesKcal: calories,
  };
  const goalHit = activity.goal ? goalMet(activity.goal, goalSnap) : false;
  const goalShare = activity.goal ? Math.min(1, goalProgress(activity.goal, goalSnap)) : 0;

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
        {activity.workoutName ? ` · ${activity.workoutName}` : ''}
      </p>

      {hasRoute(activity) && (
        <div style={{ marginBottom: 12 }}>
          <RouteMap segments={activity.segments} />
        </div>
      )}

      <div className="btn-row" style={{ marginBottom: 12 }}>
        {hasRoute(activity) && (
          <button
            type="button"
            className="btn"
            onClick={() => {
              const gpx = activityToGpx(activity);
              const day = new Date(activity.startedAt).toISOString().slice(0, 10);
              downloadText(`runlog-${day}.gpx`, gpx, 'application/gpx+xml');
              onToast?.('GPX downloaded.');
            }}
          >
            Export GPX
          </button>
        )}
        {hasRoute(activity) && (
          <button
            type="button"
            className="btn"
            onClick={() => {
              const route = routeFromActivity(activity);
              if (!route) {
                onToast?.('No route to save.');
                return;
              }
              const existing = loadRoutes();
              if (existing.some((r) => r.sourceActivityId === activity.id)) {
                onToast?.('This route is already saved.');
                return;
              }
              saveRoutes([route, ...existing]);
              onToast?.(`Saved route “${route.name}”.`);
            }}
          >
            Save route
          </button>
        )}
      </div>

      {(activity.shoeId || activity.workoutName) && (
        <p className="hint" style={{ marginTop: 0, marginBottom: 12 }}>
          {activity.workoutName ? `Workout: ${activity.workoutName}. ` : ''}
          {activity.shoeId
            ? `Shoes: ${loadShoes().find((s) => s.id === activity.shoeId)?.name ?? 'unknown'}.`
            : ''}
        </p>
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
          <div className="value">{formatCalories(calories)}</div>
          <div className="label">kcal</div>
        </div>
      </div>
      <p className="hint" style={{ marginTop: -4, marginBottom: 12, textAlign: 'center' }}>
        Estimated {calorieSourceLabel(calorieSource)}
      </p>

      {activity.goal && (
        <div className={`goal-track${goalHit ? ' met' : ''}`} style={{ marginBottom: 12 }}>
          <div className="goal-track-head">
            <span>
              {goalKindLabel(activity.goal.kind)} goal ·{' '}
              {formatGoalTarget(activity.goal, profile.units)}
              {goalHit ? ' · met' : ''}
            </span>
            <span>{Math.round(goalShare * 100)}%</span>
          </div>
          <div
            className="goal-bar"
            role="progressbar"
            aria-valuenow={Math.round(goalShare * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <span style={{ width: `${goalShare * 100}%` }} />
          </div>
        </div>
      )}

      {activity.manualLaps && activity.manualLaps.length > 0 && (
        <div className="card" style={{ marginBottom: 12 }}>
          <h2>Laps</h2>
          <ul className="lap-list">
            {activity.manualLaps.map((lap) => (
              <li key={lap.index}>
                <span>Lap {lap.index}</span>
                <span>
                  {formatDistance(lap.splitDistanceM, profile.units)} {distanceLabel(profile.units)}
                  {' · '}
                  {formatDuration(lap.splitDurationMs)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {(ascent > 1 || activity.steps !== null || heart) && (
        <div className="metric-grid" style={{ marginBottom: 12 }}>
          {heart && (
            <div className="metric">
              <div className="value">{heart.averageBpm}</div>
              <div className="label">Avg bpm</div>
            </div>
          )}
          {heart && (
            <div className="metric">
              <div className="value">{heart.maxBpm}</div>
              <div className="label">Max bpm</div>
            </div>
          )}
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
        </div>
      )}

      {heart && (
        <div className="card">
          <h2>Heart rate report</h2>
          <p className="hint" style={{ marginTop: 0, marginBottom: 12 }}>
            Time in each zone
            {activity.heartReport
              ? ` · saved with the run (max HR ${reportMaxHr})`
              : ` · from samples (max HR ${reportMaxHr})`}
            {heart.measuredMs > 0
              ? ` · ${formatDuration(heart.measuredMs)} measured`
              : ''}
          </p>
          <div className="metric-grid" style={{ marginBottom: 14 }}>
            <div className="metric">
              <div className="value">{heart.averageBpm}</div>
              <div className="label">Avg bpm</div>
            </div>
            <div className="metric">
              <div className="value">{heart.maxBpm}</div>
              <div className="label">Max bpm</div>
            </div>
            <div className="metric">
              <div className="value">{heart.minBpm}</div>
              <div className="label">Min bpm</div>
            </div>
          </div>
          <ZoneBars summary={heart} maxHeartRate={reportMaxHr} showPercent />
          {(activity.heart.length > 1 ||
            activity.segments.some((s) => s.length > 1)) && (
            <div style={{ marginTop: 14 }}>
              <HeartChart
                samples={activity.heart}
                maxHeartRate={reportMaxHr}
                segments={activity.segments}
                distanceM={activity.distanceM}
                durationMs={activity.durationMs}
                units={profile.units}
              />
            </div>
          )}
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
          <button type="button" className="btn" onClick={() => setConfirming(false)}>
            Cancel
          </button>
          <button type="button" className="btn danger" onClick={() => onDelete(activity.id)}>
            Delete for good
          </button>
        </div>
      ) : (
        <div className="btn-row">
          <button
            type="button"
            className="btn primary"
            onClick={() => {
              if (note !== activity.note) onNoteChange(activity.id, note);
              onSave();
            }}
          >
            Save
          </button>
          <button type="button" className="btn danger" onClick={() => setConfirming(true)}>
            Delete
          </button>
        </div>
      )}
    </div>
  );
}
