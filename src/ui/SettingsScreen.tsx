/** App preferences, routes, and getting the data out — not the athlete profile. */

import { useRef, useState } from 'react';
import { exportFullBackup, importBackup, wipeAllLocalData } from '../core/backup';
import { saveActivity } from '../core/db';
import { activityFromGpx } from '../core/gpx';
import { loadRoutes, saveRoutes } from '../core/routes';
import {
  MAP_STYLE_OPTIONS,
  resolveMapBasemap,
  type MapStyleId,
} from '../core/mercator';
import { loadProfile, THEME_OPTIONS, type Profile, type ThemeId } from '../core/settings';
import { estimateStride } from '../core/steps';
import { distanceLabel, formatDistance, fromDisplayDistance, toDisplayDistance } from '../core/units';

interface Props {
  profile: Profile;
  onChange(profile: Profile): void;
  onReload(): void;
  onToast(message: string): void;
}

export function SettingsScreen({ profile, onChange, onReload, onToast }: Props) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const gpxRef = useRef<HTMLInputElement | null>(null);
  const [confirmingWipe, setConfirmingWipe] = useState(false);
  const [routesTick, setRoutesTick] = useState(0);
  const [strideDraft, setStrideDraft] = useState(
    Number.isFinite(profile.strideM) ? profile.strideM.toFixed(2) : '0.75',
  );

  const set = <K extends keyof Profile>(key: K, value: Profile[K]) =>
    onChange({ ...profile, [key]: value });

  const routes = loadRoutes();
  void routesTick;

  const download = async () => {
    const json = await exportFullBackup();
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `runlog-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    onToast('Full backup downloaded (runs, profile, shoes, routes, plan).');
  };

  const upload = async (file: File) => {
    try {
      const result = await importBackup(await file.text());
      if (result.profileRestored) onChange(loadProfile());
      onReload();
      setRoutesTick((t) => t + 1);
      if (result.fullBackup) {
        onToast(
          `Full backup: ${result.activitiesImported} runs` +
            (result.activitiesSkipped ? ` (${result.activitiesSkipped} skipped)` : '') +
            (result.profileRestored ? ', profile' : '') +
            (result.shoes ? `, ${result.shoes} shoes` : '') +
            (result.routes ? `, ${result.routes} routes` : '') +
            (result.planRestored ? ', plan' : '') +
            (result.weightRestored ? ', weight log' : '') +
            '.',
        );
      } else {
        onToast(
          `Imported ${result.activitiesImported} runs` +
            (result.activitiesSkipped ? `, skipped ${result.activitiesSkipped}` : '') +
            '.',
        );
      }
    } catch (error) {
      onToast(error instanceof Error ? error.message : 'That file could not be read.');
    }
  };

  const uploadGpx = async (file: File) => {
    try {
      const activity = activityFromGpx(await file.text());
      await saveActivity(activity);
      onToast(
        `Imported GPX — ${formatDistance(activity.distanceM, profile.units)} ${distanceLabel(profile.units)}.`,
      );
      onReload();
    } catch (error) {
      onToast(error instanceof Error ? error.message : 'GPX import failed.');
    }
  };

  return (
    <div className="screen">
      <h1>Settings</h1>
      <p className="subtitle">Theme, units, run behaviour, routes, and backups.</p>

      <div className="card">
        <h2>Theme</h2>
        <p className="hint" style={{ marginTop: 0, marginBottom: 12 }}>
          Same app, different look. Pick whichever is easier to read outdoors — you can switch any
          time.
        </p>
        <div className="theme-picker" role="radiogroup" aria-label="App theme">
          {THEME_OPTIONS.map((opt) => {
            const selected = profile.theme === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                role="radio"
                aria-checked={selected}
                className={`theme-option theme-option-${opt.id}${selected ? ' selected' : ''}`}
                onClick={() => set('theme', opt.id as ThemeId)}
              >
                <span className="theme-swatch" aria-hidden>
                  <span className="theme-swatch-dot" />
                  <span className="theme-swatch-bar" />
                  <span className="theme-swatch-bar short" />
                </span>
                <span className="theme-option-body">
                  <span className="theme-option-label">{opt.label}</span>
                  <span className="theme-option-blurb">{opt.blurb}</span>
                </span>
                <span className="theme-option-check" aria-hidden>
                  {selected ? '✓' : ''}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="card">
        <h2>Units</h2>
        <div className="segmented">
          <button aria-pressed={profile.units === 'metric'} onClick={() => set('units', 'metric')}>
            Kilometres
          </button>
          <button
            aria-pressed={profile.units === 'imperial'}
            onClick={() => set('units', 'imperial')}
          >
            Miles
          </button>
        </div>
      </div>

      <div className="card">
        <h2>Map</h2>
        <p className="hint" style={{ marginTop: 0, marginBottom: 12 }}>
          Basemap for history routes
          {profile.liveMapTiles ? ' and live outdoor runs' : ''}.{' '}
          {profile.mapStyle === 'auto'
            ? `Auto → ${resolveMapBasemap('auto', profile.theme) === 'dark' ? 'dark' : 'standard'} with this theme.`
            : null}
        </p>
        <div className="theme-picker map-style-picker" role="radiogroup" aria-label="Map style">
          {MAP_STYLE_OPTIONS.map((opt) => {
            const selected = profile.mapStyle === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                role="radio"
                aria-checked={selected}
                className={`theme-option map-style-option${selected ? ' selected' : ''}`}
                onClick={() => set('mapStyle', opt.id as MapStyleId)}
              >
                <span className="theme-option-body">
                  <span className="theme-option-label">{opt.label}</span>
                  <span className="theme-option-blurb">{opt.blurb}</span>
                </span>
                <span className="theme-option-check" aria-hidden>
                  {selected ? '✓' : ''}
                </span>
              </button>
            );
          })}
        </div>
        <div className="row" style={{ marginTop: 14 }}>
          <span>Map tiles on live run</span>
          <button
            type="button"
            className="btn"
            aria-pressed={profile.liveMapTiles}
            onClick={() => set('liveMapTiles', !profile.liveMapTiles)}
          >
            {profile.liveMapTiles ? 'On' : 'Off'}
          </button>
        </div>
        <p className="hint">
          Off by default — saves data and keeps the live screen simple. When on, the outdoor map
          loads the basemap while arming and running (needs network).
        </p>
      </div>

      <div className="card">
        <h2>Weekly goal</h2>
        <div className="field">
          <label htmlFor="goal">Distance per week ({distanceLabel(profile.units)})</label>
          <input
            id="goal"
            type="number"
            step="0.5"
            inputMode="decimal"
            value={toDisplayDistance(profile.weeklyGoalM, profile.units).toFixed(1)}
            onChange={(e) => {
              const value = Number(e.target.value);
              if (Number.isFinite(value) && value >= 0) {
                set('weeklyGoalM', fromDisplayDistance(value, profile.units));
              }
            }}
          />
          <p className="hint">Set to 0 to turn the goal off. Body &amp; shoes live under Profile.</p>
        </div>
      </div>

      <div className="card">
        <h2>Treadmill</h2>
        <div className="field">
          <label htmlFor="settings-stride">Stride length (m per step)</label>
          <input
            id="settings-stride"
            type="text"
            inputMode="decimal"
            value={strideDraft}
            onChange={(e) => setStrideDraft(e.target.value)}
            onBlur={() => {
              const stride = Number(strideDraft.replace(',', '.'));
              if (Number.isFinite(stride) && stride > 0) {
                set('strideM', stride);
                setStrideDraft(stride.toFixed(2));
              } else {
                setStrideDraft(profile.strideM.toFixed(2));
              }
            }}
          />
          <p className="hint">
            Used when counting steps without a foot pod. Finish a treadmill run with the console
            distance typed in to auto-calibrate.{' '}
            <button
              type="button"
              className="pill"
              style={{ cursor: 'pointer' }}
              onClick={() => {
                const next = estimateStride(profile.heightCm);
                set('strideM', next);
                setStrideDraft(next.toFixed(2));
                onToast(`Stride reset from height → ${next.toFixed(2)} m.`);
              }}
            >
              Reset from height
            </button>
          </p>
        </div>
      </div>

      <div className="card">
        <h2>During a run</h2>
        <div className="row">
          <span>Keep the screen awake</span>
          <button
            type="button"
            className="btn"
            aria-pressed={profile.keepAwake}
            onClick={() => set('keepAwake', !profile.keepAwake)}
          >
            {profile.keepAwake ? 'On' : 'Off'}
          </button>
        </div>
        <div className="row" style={{ marginTop: 12 }}>
          <span>Audio cues</span>
          <button
            type="button"
            className="btn"
            aria-pressed={profile.audioCues}
            onClick={() => set('audioCues', !profile.audioCues)}
          >
            {profile.audioCues ? 'On' : 'Off'}
          </button>
        </div>
        <p className="hint">
          Speaks kilometres/miles, goal progress, laps, and pause/resume. Uses the phone&apos;s
          voice (works offline).
        </p>
        <div className="row" style={{ marginTop: 12 }}>
          <span>Auto-pause</span>
          <button
            type="button"
            className="btn"
            aria-pressed={profile.autoPause}
            onClick={() => set('autoPause', !profile.autoPause)}
          >
            {profile.autoPause ? 'On' : 'Off'}
          </button>
        </div>
        <p className="hint">
          Pauses when you stop moving (outdoor GPS or treadmill foot pod) and resumes when you go
          again.
        </p>
      </div>

      <div className="card">
        <h2>Foot pod</h2>
        <div className="field">
          <label htmlFor="podcal">Distance correction</label>
          <input
            id="podcal"
            type="number"
            step="0.01"
            inputMode="decimal"
            value={profile.footpodCalibration.toFixed(3)}
            onChange={(e) => {
              const factor = Number(e.target.value);
              if (Number.isFinite(factor) && factor >= 0.5 && factor <= 2) {
                set('footpodCalibration', factor);
              }
            }}
          />
          <p className="hint">
            {profile.footpodCalibration === 1
              ? 'No correction — the pod is believed as-is. Finish a treadmill run with the console distance typed in and this sets itself.'
              : `The pod reads ${(
                  (1 / profile.footpodCalibration - 1) * 100
                ).toFixed(1)}% off; distances are corrected by ${(
                  (profile.footpodCalibration - 1) * 100
                ).toFixed(1)}%.`}{' '}
            <button
              type="button"
              className="pill"
              onClick={() => set('footpodCalibration', 1)}
              style={{ cursor: 'pointer' }}
            >
              Reset
            </button>
          </p>
        </div>
      </div>

      <div className="card">
        <h2>Saved routes</h2>
        <p className="hint" style={{ marginTop: 0 }}>
          Save a route from a finished outdoor run&apos;s detail screen.
        </p>
        {routes.length === 0 && <p className="hint">No saved routes yet.</p>}
        {routes.map((route) => (
          <div className="row" key={route.id} style={{ marginBottom: 8 }}>
            <span>
              {route.name}
              <span
                className="meta"
                style={{ display: 'block', fontSize: 12, color: 'var(--muted)' }}
              >
                {formatDistance(route.distanceM, profile.units)} {distanceLabel(profile.units)}
              </span>
            </span>
            <button
              type="button"
              className="btn danger"
              onClick={() => {
                saveRoutes(loadRoutes().filter((r) => r.id !== route.id));
                onToast('Route deleted.');
                setRoutesTick((t) => t + 1);
              }}
            >
              Delete
            </button>
          </div>
        ))}
      </div>

      <div className="card">
        <h2>Your data</h2>
        <p className="hint" style={{ marginTop: 0, marginBottom: 12 }}>
          Everything stays on this device. Use a <strong>full backup</strong> before clearing the
          browser or moving to another phone (or Android).
        </p>
        <div className="btn-row" style={{ marginBottom: 10 }}>
          <button type="button" className="btn primary" onClick={() => void download()}>
            Export full backup
          </button>
          <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
            Import backup
          </button>
        </div>
        <p className="hint" style={{ marginBottom: 12 }}>
          Backup includes runs, profile, shoes, routes, and active plan. Older activity-only JSON
          files still import.
        </p>
        <button
          type="button"
          className="btn wide"
          style={{ marginBottom: 10 }}
          onClick={() => gpxRef.current?.click()}
        >
          Import GPX
        </button>
        <p className="hint">
          GPX brings in outdoor tracks from other apps. Export GPX or TCX from a run&apos;s detail
          screen (Strava-friendly).
        </p>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void upload(file);
            e.target.value = '';
          }}
        />
        <input
          ref={gpxRef}
          type="file"
          accept=".gpx,application/gpx+xml,application/xml,text/xml"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void uploadGpx(file);
            e.target.value = '';
          }}
        />

        {confirmingWipe ? (
          <div className="btn-row">
            <button type="button" className="btn" onClick={() => setConfirmingWipe(false)}>
              Cancel
            </button>
            <button
              type="button"
              className="btn danger"
              onClick={async () => {
                await wipeAllLocalData();
                setConfirmingWipe(false);
                onReload();
                setRoutesTick((t) => t + 1);
                onToast('All runs, shoes, routes and plan cleared. Profile kept.');
              }}
            >
              Delete everything
            </button>
          </div>
        ) : (
          <button type="button" className="btn danger wide" onClick={() => setConfirmingWipe(true)}>
            Delete all runs &amp; gear data
          </button>
        )}
      </div>
    </div>
  );
}
