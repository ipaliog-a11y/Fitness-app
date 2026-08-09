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
import { activityToTcx } from '../core/tcx';
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
import { resolveMapBasemap } from '../core/mercator';
import { HeartChart, SplitsTable, ZoneBars } from './charts';
import { RouteMap } from './RouteMap';
import { useT, useTipText } from '../i18n/react';

interface Props {
  activity: Activity;
  history: Activity[];
  profile: Profile;
  /**
   * Post-finish results: hide back and block leaving until Save or Delete.
   */
  decisionRequired?: boolean;
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
  decisionRequired = false,
  onBack,
  onSave,
  onDelete,
  onNoteChange,
  onToast,
}: Props) {
  const t = useT();
  const tipText = useTipText();
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
    <div className={`screen${decisionRequired ? ' detail-decision' : ''}`}>
      {!decisionRequired ? (
        <button type="button" className="back" onClick={onBack}>
          ‹ {t('common.back')}
        </button>
      ) : (
        <p className="hint detail-decision-banner">
          {t('detail.decisionBanner', { save: t('common.save'), delete: t('common.delete') })}
        </p>
      )}

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
          <RouteMap
            segments={activity.segments}
            basemap={resolveMapBasemap(profile.mapStyle, profile.theme)}
            emptyLabel={t('detail.noRouteRecorded')}
          />
        </div>
      )}

      {hasRoute(activity) && (
        <div className="btn-row" style={{ marginBottom: 12 }}>
          <button
            type="button"
            className="btn"
            onClick={() => {
              const gpx = activityToGpx(activity);
              const day = new Date(activity.startedAt).toISOString().slice(0, 10);
              downloadText(`runlog-${day}.gpx`, gpx, 'application/gpx+xml');
              onToast?.(t('detail.gpxDone'));
            }}
          >
            {t('detail.exportGpx')}
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => {
              const route = routeFromActivity(activity);
              if (!route) {
                onToast?.(t('detail.noRoute'));
                return;
              }
              const existing = loadRoutes();
              if (existing.some((r) => r.sourceActivityId === activity.id)) {
                onToast?.(t('detail.routeExists'));
                return;
              }
              saveRoutes([route, ...existing]);
              onToast?.(t('detail.routeSaved', { name: route.name }));
            }}
          >
            Save route
          </button>
        </div>
      )}

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
          <div className="label">{t('detail.moving')}</div>
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
          <h2>{t('run.laps.title')}</h2>
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
              <div className="label">{t('detail.avgBpm')}</div>
            </div>
          )}
          {heart && (
            <div className="metric">
              <div className="value">{heart.maxBpm}</div>
              <div className="label">{t('detail.maxBpm')}</div>
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
              <div className="label">{t('run.pod.steps')}</div>
            </div>
          )}
        </div>
      )}

      {heart && (
        <div className="card">
          <h2>{t('detail.hrReport')}</h2>
          <p className="hint" style={{ marginTop: 0, marginBottom: 12 }}>
            {t('detail.zoneTime')}
            {activity.heartReport
              ? ` · ${t('detail.zoneSaved', { max: reportMaxHr })}`
              : ` · ${t('detail.zoneSamples', { max: reportMaxHr })}`}
            {heart.measuredMs > 0
              ? ` · ${t('detail.zoneMeasured', { time: formatDuration(heart.measuredMs) })}`
              : ''}
          </p>
          <div className="metric-grid" style={{ marginBottom: 14 }}>
            <div className="metric">
              <div className="value">{heart.averageBpm}</div>
              <div className="label">{t('detail.avgBpm')}</div>
            </div>
            <div className="metric">
              <div className="value">{heart.maxBpm}</div>
              <div className="label">{t('detail.maxBpm')}</div>
            </div>
            <div className="metric">
              <div className="value">{heart.minBpm}</div>
              <div className="label">{t('detail.minBpm')}</div>
            </div>
          </div>
          <ZoneBars summary={heart} maxHeartRate={reportMaxHr} showPercent />
        </div>
      )}

      {(activity.heart.length > 1 || activity.segments.some((s) => s.length > 1)) && (
        <div className="card">
          <h2>
            {activity.heart.length > 1 ? t('detail.chartHr') : t('detail.chartPace')}
          </h2>
          <p className="hint" style={{ marginTop: 0, marginBottom: 12 }}>
            {activity.heart.length > 1 ? t('detail.chartHrHint') : t('detail.chartPaceHint')}
          </p>
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

      {runSplits.length > 0 && (
        <div className="card">
          <h2>{t('run.panel.splits')}</h2>
          <SplitsTable splits={runSplits} units={profile.units} />
        </div>
      )}

      {tips.length > 0 && (
        <div className="card">
          <h2>{t('detail.coachNotes')}</h2>
          {tips.map((tip, i) => (
            <div className={`tip ${tip.tone}`} key={i}>
              <div className="title">{tipText(tip).title}</div>
              <div className="body">{tipText(tip).body}</div>
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <h2>{t('detail.yourNote')}</h2>
        <textarea
          rows={3}
          value={note}
          placeholder={t('detail.notePlaceholder')}
          onChange={(e) => setNote(e.target.value)}
          // Saved on blur rather than per keystroke: every change is a write to
          // IndexedDB, and one per letter is a lot of writes for no benefit.
          onBlur={() => note !== activity.note && onNoteChange(activity.id, note)}
        />
      </div>

      <div className="btn-row" style={{ marginBottom: 12 }}>
        <button
          type="button"
          className="btn wide"
          onClick={() => {
            const tcx = activityToTcx(activity);
            const day = new Date(activity.startedAt).toISOString().slice(0, 10);
            downloadText(`runlog-${day}.tcx`, tcx, 'application/vnd.garmin.tcx+xml');
            onToast?.(t('detail.tcxDone'));
          }}
        >
          {t('detail.exportTcx')}
        </button>
      </div>

      {confirming ? (
        <div className="btn-row detail-actions">
          <button type="button" className="btn" onClick={() => setConfirming(false)}>
            {t('common.cancel')}
          </button>
          <button type="button" className="btn danger" onClick={() => onDelete(activity.id)}>
            {t('detail.deleteForGood')}
          </button>
        </div>
      ) : (
        <div className="btn-row detail-actions">
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
