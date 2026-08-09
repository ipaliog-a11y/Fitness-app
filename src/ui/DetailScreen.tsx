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
import type { ConsoleEntry } from '../core/consoleEntry';
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
  formatDistance,
  formatDuration,
  formatPace,
  fromDisplayDistance,
  paceLabel,
  toDisplayDistance,
} from '../core/units';
import { resolveMapBasemap } from '../core/mercator';
import { HeartChart, SplitsTable, ZoneBars } from './charts';
import { RouteMap } from './RouteMap';
import { useDateText, useT, useTipText } from '../i18n/react';

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
  /**
   * Apply a treadmill console reading to this run. Optional so the screen still
   * renders in contexts that have no writer for it.
   */
  onConsoleEntry?(id: string, entry: ConsoleEntry): void;
  onToast?(message: string): void;
}

/**
 * The treadmill console's own figures, typed after the belt has stopped.
 *
 * Lives here rather than on the live run screen because that is when the number
 * exists: a console shows a total, and a total is only final at the end. The
 * fields used to sit open mid-run, where they could be filled in but did
 * nothing until Finish read them — a form pretending to be an instrument.
 *
 * Keyed on the activity id by the caller, so opening a different run gets fresh
 * drafts instead of the last run's typing.
 */
function ConsolePanel({
  activity,
  units,
  onApply,
}: {
  activity: Activity;
  units: Profile['units'];
  onApply(entry: ConsoleEntry): void;
}) {
  const t = useT();
  // Prefilled only once the recorded distance *is* the typed one. Seeding the
  // box with an estimate would invite confirming it unchanged, which reads as
  // "the console agrees" and would calibrate the instrument against itself.
  const [distance, setDistance] = useState(
    activity.distanceSource === 'manual' && activity.distanceM > 0
      ? String(Number(toDisplayDistance(activity.distanceM, units).toFixed(3)))
      : '',
  );
  const [incline, setIncline] = useState(
    activity.inclinePercent !== null ? String(activity.inclinePercent) : '',
  );

  /*
   * Four states, not three. `manual` covers both "you already corrected this"
   * and "nothing measured it" — a treadmill run with the phone parked on the
   * tray counts no steps, so the session records zero metres from no
   * instrument. Telling that run it had "already been corrected once" would be
   * a plain lie, and it is the most common run this panel exists for.
   */
  const hint =
    activity.distanceSource === 'sensor'
      ? t('detail.console.hintPod')
      : activity.distanceSource === 'steps'
        ? t('detail.console.hintSteps')
        : activity.distanceM > 0
          ? t('detail.console.hintDone')
          : t('detail.console.hintNone');

  const parsed = (raw: string): number | null => {
    if (raw.trim() === '') return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  };

  const typedDistance = parsed(distance);
  const typedIncline = parsed(incline);
  const dirty =
    (typedDistance !== null && fromDisplayDistance(typedDistance, units) !== activity.distanceM) ||
    typedIncline !== activity.inclinePercent;

  return (
    <div className="card console-panel">
      <h2>{t('detail.console.title')}</h2>
      <p className="hint" style={{ marginTop: 0, marginBottom: 12 }}>
        {hint}
      </p>
      <div className="console-fields">
        <div className="field">
          <label htmlFor="console-distance">
            {t('detail.console.distanceLabel', { unit: distanceLabel(units) })}
          </label>
          <input
            id="console-distance"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            placeholder={formatDistance(activity.distanceM, units)}
            value={distance}
            onChange={(e) => setDistance(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="console-incline">{t('detail.console.inclineLabel')}</label>
          <input
            id="console-incline"
            type="number"
            inputMode="decimal"
            step="0.5"
            min="0"
            value={incline}
            onChange={(e) => setIncline(e.target.value)}
          />
        </div>
      </div>
      <button
        type="button"
        className="btn primary wide"
        disabled={!dirty}
        onClick={() =>
          onApply({
            distanceM: typedDistance === null ? null : fromDisplayDistance(typedDistance, units),
            inclinePercent: typedIncline,
          })
        }
      >
        {t('detail.console.apply')}
      </button>
    </div>
  );
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
  onConsoleEntry,
  onToast,
}: Props) {
  const t = useT();
  const tipText = useTipText();
  const dates = useDateText();
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
        {t(modeName(activity.mode))} ·{' '}
        {t('history.atTime', {
          day: dates.day(activity.startedAt),
          time: dates.clock(activity.startedAt),
        })}
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
            {t('detail.saveRoute')}
          </button>
        </div>
      )}

      {(activity.shoeId || activity.workoutName) && (
        <p className="hint" style={{ marginTop: 0, marginBottom: 12 }}>
          {activity.workoutName ? `${t('detail.workoutLine', { name: activity.workoutName })} ` : ''}
          {activity.shoeId
            ? t('detail.shoesLine', {
                name:
                  loadShoes().find((s) => s.id === activity.shoeId)?.name ??
                  t('detail.unknownShoe'),
              })
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
          <div className="label">{t('common.avgOf', { unit: paceLabel(profile.units) })}</div>
        </div>
        <div className="metric">
          <div className="value">{formatCalories(calories)}</div>
          <div className="label">{t('detail.kcal')}</div>
        </div>
      </div>
      <p className="hint" style={{ marginTop: -4, marginBottom: 12, textAlign: 'center' }}>
        {t('detail.estimated', { source: t(calorieSourceLabel(calorieSource)) })}
      </p>

      {activity.mode === 'treadmill' && onConsoleEntry && (
        <ConsolePanel
          key={activity.id}
          activity={activity}
          units={profile.units}
          onApply={(entry) => onConsoleEntry(activity.id, entry)}
        />
      )}

      {activity.goal && (
        <div className={`goal-track${goalHit ? ' met' : ''}`} style={{ marginBottom: 12 }}>
          <div className="goal-track-head">
            <span>
              {t('detail.goalLine', {
                kind: t(goalKindLabel(activity.goal.kind)),
                target: formatGoalTarget(activity.goal, profile.units),
              })}
              {goalHit ? ` · ${t('detail.goalMet')}` : ''}
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
                <span>{t('detail.lap', { index: lap.index })}</span>
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
              <div className="label">{t('detail.climbed')}</div>
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
            {t('common.save')}
          </button>
          <button type="button" className="btn danger" onClick={() => setConfirming(true)}>
            {t('common.delete')}
          </button>
        </div>
      )}
    </div>
  );
}
