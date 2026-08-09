/** App preferences, routes, and getting the data out — not the athlete profile. */

import { useEffect, useMemo, useRef, useState } from 'react';
import { modeName, type Activity } from '../core/activity';
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
import { LOCALE_OPTIONS, type LocaleId } from '../i18n';
import { useDateText, useT } from '../i18n/react';
import { estimateStride } from '../core/steps';
import {
  distanceLabel,
  formatDistance,
  formatDuration,
  fromDisplayDistance,
  toDisplayDistance,
} from '../core/units';
import {
  healthConnectSupported,
  importSelectedHealthActivities,
  openHealthConnectSettings,
  previewHealthConnectImport,
} from '../platform/healthConnect';

type HealthRangePreset = 7 | 30 | 90 | 'custom';

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
  const [healthImporting, setHealthImporting] = useState(false);
  const [healthRange, setHealthRange] = useState<HealthRangePreset>(30);
  const [healthFrom, setHealthFrom] = useState(() => {
    const d = new Date(Date.now() - 30 * 86_400_000);
    return d.toISOString().slice(0, 10);
  });
  const [healthTo, setHealthTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [healthCandidates, setHealthCandidates] = useState<Activity[] | null>(null);
  const [healthSelected, setHealthSelected] = useState<Set<string>>(new Set());
  const [healthSkippedDup, setHealthSkippedDup] = useState(0);

  const set = <K extends keyof Profile>(key: K, value: Profile[K]) =>
    onChange({ ...profile, [key]: value });

  const healthWindow = useMemo(() => {
    const endOfDay = (iso: string) => {
      const d = new Date(`${iso}T23:59:59.999`);
      return d.getTime();
    };
    const startOfDay = (iso: string) => {
      const d = new Date(`${iso}T00:00:00`);
      return d.getTime();
    };
    if (healthRange === 'custom') {
      return {
        startMs: startOfDay(healthFrom),
        endMs: endOfDay(healthTo) + 1,
      };
    }
    const endMs = Date.now();
    return {
      startMs: endMs - healthRange * 86_400_000,
      endMs,
    };
  }, [healthRange, healthFrom, healthTo]);

  const scanHealth = async () => {
    if (!healthConnectSupported()) {
      onToast(t('settings.hc.androidOnly'));
      return;
    }
    setHealthImporting(true);
    setHealthCandidates(null);
    try {
      const preview = await previewHealthConnectImport({
        startMs: healthWindow.startMs,
        endMs: healthWindow.endMs,
      });
      setHealthSkippedDup(preview.skippedDuplicate);
      setHealthCandidates(preview.candidates);
      setHealthSelected(new Set(preview.candidates.map((a) => a.id)));
      if (preview.candidates.length === 0) {
        onToast(
          preview.skippedDuplicate > 0
            ? t('settings.hc.noneNew', { count: preview.skippedDuplicate })
            : t('settings.hc.noneFound'),
        );
      }
    } catch (error) {
      onToast(error instanceof Error ? error.message : t('settings.hc.scanFailed'));
    } finally {
      setHealthImporting(false);
    }
  };

  const importHealthSelected = async () => {
    if (!healthCandidates || healthSelected.size === 0) {
      onToast(t('settings.hc.selectOne'));
      return;
    }
    setHealthImporting(true);
    try {
      const list = healthCandidates.filter((a) => healthSelected.has(a.id));
      const result = await importSelectedHealthActivities(list);
      onReload();
      setHealthCandidates(null);
      setHealthSelected(new Set());
      onToast(
        result.imported > 0
          ? t('settings.hc.imported', { count: result.imported })
          : t('settings.hc.nothingNew'),
      );
    } catch (error) {
      onToast(error instanceof Error ? error.message : t('settings.hc.importFailed'));
    } finally {
      setHealthImporting(false);
    }
  };

  const toggleHealthId = (id: string) => {
    setHealthSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const t = useT();
  const dates = useDateText();
  const [themeOpen, setThemeOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const activeTheme = THEME_OPTIONS.find((o) => o.id === profile.theme) ?? THEME_OPTIONS[0];
  const activeLocale = LOCALE_OPTIONS.find((o) => o.id === profile.locale) ?? LOCALE_OPTIONS[0];

  // One handler for both sheets: two effects racing the same Escape press
  // would close the wrong one when they are ever open together.
  useEffect(() => {
    if (!themeOpen && !langOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setThemeOpen(false);
      setLangOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [themeOpen, langOpen]);

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
    onToast(t('settings.backup.done'));
  };

  const upload = async (file: File) => {
    try {
      const result = await importBackup(await file.text());
      if (result.profileRestored) onChange(loadProfile());
      onReload();
      setRoutesTick((t) => t + 1);
      /*
        * Assembled as a list rather than one sentence per outcome. Seven
        * optional clauses is 128 sentences, and no catalogue should hold
        * those — so the catalogue holds the pieces and the join is code.
        */
      const parts = [t('settings.backup.partRuns', { count: result.activitiesImported })];
      if (result.activitiesSkipped) {
        parts.push(t('settings.backup.partSkipped', { count: result.activitiesSkipped }));
      }
      if (result.fullBackup) {
        if (result.profileRestored) parts.push(t('settings.backup.partProfile'));
        if (result.shoes) parts.push(t('settings.backup.partShoes', { count: result.shoes }));
        if (result.routes) parts.push(t('settings.backup.partRoutes', { count: result.routes }));
        if (result.planRestored) parts.push(t('settings.backup.partPlan'));
        if (result.weightRestored) parts.push(t('settings.backup.partWeight'));
      }
      onToast(
        t(result.fullBackup ? 'settings.backup.restored' : 'settings.backup.imported', {
          parts: parts.join(', '),
        }),
      );
    } catch (error) {
      onToast(error instanceof Error ? error.message : t('settings.backup.unreadable'));
    }
  };

  const uploadGpx = async (file: File) => {
    try {
      const activity = activityFromGpx(await file.text());
      await saveActivity(activity);
      onToast(
        t('settings.gpxDone', {
          distance: formatDistance(activity.distanceM, profile.units),
          unit: distanceLabel(profile.units),
        }),
      );
      onReload();
    } catch (error) {
      onToast(error instanceof Error ? error.message : t('settings.gpxFailed'));
    }
  };

  return (
    <div className="screen">
      <h1>{t('settings.title')}</h1>
      <p className="subtitle">{t('settings.subtitle')}</p>

      <div className="card">
        <h2>{t('settings.language.title')}</h2>
        <p className="hint" style={{ marginTop: 0, marginBottom: 12 }}>
          {t('settings.language.hint')}
        </p>
        <button
          type="button"
          className="theme-trigger locale-trigger"
          onClick={() => setLangOpen(true)}
          aria-haspopup="dialog"
        >
          <span className="locale-swatch" aria-hidden>
            {activeLocale.id.toUpperCase()}
          </span>
          <span className="theme-option-body">
            <span className="theme-option-label">{activeLocale.endonym}</span>
            <span className="theme-option-blurb">{activeLocale.english}</span>
          </span>
          <span className="theme-trigger-cue" aria-hidden>
            {t('common.change')}
          </span>
        </button>
      </div>

      <div className="card">
        <h2>{t('settings.theme.title')}</h2>
        <p className="hint" style={{ marginTop: 0, marginBottom: 12 }}>
          {t('settings.theme.hint')}
        </p>
        <button
          type="button"
          className={`theme-trigger theme-option-${profile.theme}`}
          onClick={() => setThemeOpen(true)}
          aria-haspopup="dialog"
        >
          <span className="theme-swatch" aria-hidden>
            <span className="theme-swatch-dot" />
            <span className="theme-swatch-bar" />
            <span className="theme-swatch-bar short" />
          </span>
          <span className="theme-option-body">
            <span className="theme-option-label">{t(activeTheme.label)}</span>
            <span className="theme-option-blurb">{t(activeTheme.blurb)}</span>
          </span>
          <span className="theme-trigger-cue" aria-hidden>
            {t('common.change')}
          </span>
        </button>
      </div>

      <div className="card">
        <h2>{t('settings.units.title')}</h2>
        <div className="segmented">
          <button aria-pressed={profile.units === 'metric'} onClick={() => set('units', 'metric')}>
            {t('settings.units.km')}
          </button>
          <button
            aria-pressed={profile.units === 'imperial'}
            onClick={() => set('units', 'imperial')}
          >
            {t('settings.units.miles')}
          </button>
        </div>
      </div>

      <div className="card">
        <h2>{t('settings.map.title')}</h2>
        <p className="hint" style={{ marginTop: 0, marginBottom: 12 }}>
          {profile.liveMapTiles ? t('settings.map.hintLive') : t('settings.map.hint')}{' '}
          {profile.mapStyle === 'auto'
            ? t('settings.map.autoNote', {
                basemap:
                  resolveMapBasemap('auto', profile.theme) === 'dark'
                    ? t('mapStyle.dark.label')
                    : t('mapStyle.standard.label'),
              })
            : null}
        </p>
        <div className="theme-picker map-style-picker" role="radiogroup" aria-label={t('settings.map.styleLabel')}>
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
                  <span className="theme-option-label">{t(opt.label)}</span>
                  <span className="theme-option-blurb">{t(opt.blurb)}</span>
                </span>
                <span className="theme-option-check" aria-hidden>
                  {selected ? '✓' : ''}
                </span>
              </button>
            );
          })}
        </div>
        <div className="row" style={{ marginTop: 14 }}>
          <span>{t('settings.map.liveTiles')}</span>
          <button
            type="button"
            className="btn"
            aria-pressed={profile.liveMapTiles}
            onClick={() => set('liveMapTiles', !profile.liveMapTiles)}
          >
            {profile.liveMapTiles ? t('common.on') : t('common.off')}
          </button>
        </div>
        <p className="hint">
          {t('settings.map.liveTilesHint')}
        </p>
      </div>

      <div className="card">
        <h2>{t('settings.goal.title')}</h2>
        <div className="field">
          <label htmlFor="goal">{t('settings.goal.label', { unit: distanceLabel(profile.units) })}</label>
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
          <p className="hint">{t('settings.goal.hint')}</p>
        </div>
      </div>

      <div className="card">
        <h2>{t('run.treadmill')}</h2>
        <div className="field">
          <label htmlFor="settings-stride">{t('settings.strideLabel')}</label>
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
            {t('settings.strideHint')}{' '}
            <button
              type="button"
              className="pill"
              style={{ cursor: 'pointer' }}
              onClick={() => {
                const next = estimateStride(profile.heightCm);
                set('strideM', next);
                setStrideDraft(next.toFixed(2));
                onToast(t('settings.strideResetDone', { metres: next.toFixed(2) }));
              }}
            >
              {t('settings.strideReset')}
            </button>
          </p>
        </div>
      </div>

      <div className="card">
        <h2>{t('settings.duringRun')}</h2>
        <div className="row">
          <span>{t('settings.keepAwake')}</span>
          <button
            type="button"
            className="btn"
            aria-pressed={profile.keepAwake}
            onClick={() => set('keepAwake', !profile.keepAwake)}
          >
            {profile.keepAwake ? t('common.on') : t('common.off')}
          </button>
        </div>
        <div className="row" style={{ marginTop: 12 }}>
          <span>{t('settings.audioCues')}</span>
          <button
            type="button"
            className="btn"
            aria-pressed={profile.audioCues}
            onClick={() => set('audioCues', !profile.audioCues)}
          >
            {profile.audioCues ? t('common.on') : t('common.off')}
          </button>
        </div>
        <p className="hint">
          {t('settings.audioCuesHint')}
        </p>
        <div className="row" style={{ marginTop: 12 }}>
          <span>{t('settings.haptics')}</span>
          <button
            type="button"
            className="btn"
            aria-pressed={profile.haptics}
            onClick={() => set('haptics', !profile.haptics)}
          >
            {profile.haptics ? t('common.on') : t('common.off')}
          </button>
        </div>
        <p className="hint">
          {t('settings.hapticsHint')}
        </p>
        <div className="row" style={{ marginTop: 12 }}>
          <span>{t('settings.autoPause')}</span>
          <button
            type="button"
            className="btn"
            aria-pressed={profile.autoPause}
            onClick={() => set('autoPause', !profile.autoPause)}
          >
            {profile.autoPause ? t('common.on') : t('common.off')}
          </button>
        </div>
        <p className="hint">
          {t('settings.autoPauseHint')}
        </p>
      </div>

      <div className="card">
        <h2>{t('settings.footpod.title')}</h2>
        <div className="field">
          <label htmlFor="podcal">{t('settings.footpod.correction')}</label>
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
              ? t('settings.footpod.hint')
              : t('settings.footpod.offBy', {
                  reported: ((1 / profile.footpodCalibration - 1) * 100).toFixed(1),
                  applied: ((profile.footpodCalibration - 1) * 100).toFixed(1),
                })}{' '}
            <button
              type="button"
              className="pill"
              onClick={() => set('footpodCalibration', 1)}
              style={{ cursor: 'pointer' }}
            >
              {t('settings.footpod.reset')}
            </button>
          </p>
        </div>
      </div>

      <div className="card">
        <h2>{t('settings.routes.title')}</h2>
        <p className="hint" style={{ marginTop: 0 }}>
          {t('settings.routes.hint')}
        </p>
        {routes.length === 0 && <p className="hint">{t('settings.routes.empty')}</p>}
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
                onToast(t('settings.routeDeleted'));
                setRoutesTick((t) => t + 1);
              }}
            >
              {t('common.delete')}
            </button>
          </div>
        ))}
      </div>

      <div className="card">
        <h2>{t('settings.hc.title')}</h2>
        <p className="hint" style={{ marginTop: 0, marginBottom: 12 }}>
          {t('settings.hc.blurbBefore')} <strong>{t('settings.hc.samsung')}</strong>{' '}
          {t('settings.hc.blurbAfter')}
        </p>

        <div className="chip-row" style={{ marginBottom: 10 }}>
          {([7, 30, 90] as const).map((d) => (
            <button
              key={d}
              type="button"
              className={`chip${healthRange === d ? ' active' : ''}`}
              onClick={() => setHealthRange(d)}
            >
              {t('settings.hc.lastDays', { days: d })}
            </button>
          ))}
          <button
            type="button"
            className={`chip${healthRange === 'custom' ? ' active' : ''}`}
            onClick={() => setHealthRange('custom')}
          >
            {t('settings.hc.custom')}
          </button>
        </div>

        {healthRange === 'custom' && (
          <div className="field-row" style={{ marginBottom: 10 }}>
            <div className="field">
              <label htmlFor="hc-from">{t('settings.hc.from')}</label>
              <input
                id="hc-from"
                type="date"
                value={healthFrom}
                onChange={(e) => setHealthFrom(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="hc-to">{t('settings.hc.to')}</label>
              <input
                id="hc-to"
                type="date"
                value={healthTo}
                onChange={(e) => setHealthTo(e.target.value)}
              />
            </div>
          </div>
        )}

        <button
          type="button"
          className="btn primary wide"
          style={{ marginBottom: 8 }}
          disabled={healthImporting}
          onClick={() => void scanHealth()}
        >
          {healthImporting ? t('settings.hc.scanning') : t('settings.hc.scan')}
        </button>

        {healthCandidates && healthCandidates.length > 0 && (
          <div className="health-import-list">
            <div className="row" style={{ marginBottom: 8 }}>
              <span className="hint" style={{ margin: 0 }}>
                {t('settings.hc.selected', {
                  selected: healthSelected.size,
                  total: healthCandidates.length,
                })}
                {healthSkippedDup > 0
                  ? ` · ${t('settings.hc.alreadySaved', { count: healthSkippedDup })}`
                  : ''}
              </span>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  if (healthSelected.size === healthCandidates.length) {
                    setHealthSelected(new Set());
                  } else {
                    setHealthSelected(new Set(healthCandidates.map((a) => a.id)));
                  }
                }}
              >
                {healthSelected.size === healthCandidates.length
                  ? t('settings.hc.clear')
                  : t('settings.hc.all')}
              </button>
            </div>
            <ul className="health-import-items">
              {healthCandidates.map((a) => (
                <li key={a.id}>
                  <label className="health-import-item">
                    <input
                      type="checkbox"
                      checked={healthSelected.has(a.id)}
                      onChange={() => toggleHealthId(a.id)}
                    />
                    <span className="health-import-item-body">
                      <strong>
                        {formatDistance(a.distanceM, profile.units)}{' '}
                        {distanceLabel(profile.units)}
                      </strong>
                      <span>
                        {dates.day(a.startedAt)} · {formatDuration(a.durationMs)}
                        {a.caloriesKcal != null ? ` · ${a.caloriesKcal} kcal` : ''}
                      </span>
                      <span className="muted">{a.note || t(modeName(a.mode))}</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            <button
              type="button"
              className="btn primary wide"
              style={{ marginTop: 10 }}
              disabled={healthImporting || healthSelected.size === 0}
              onClick={() => void importHealthSelected()}
            >
              {healthImporting
                ? t('settings.hc.importing')
                : t('settings.hc.importSelected', { count: healthSelected.size })}
            </button>
            <button
              type="button"
              className="btn wide"
              style={{ marginTop: 8 }}
              onClick={() => {
                setHealthCandidates(null);
                setHealthSelected(new Set());
              }}
            >
              {t('common.cancel')}
            </button>
          </div>
        )}

        {healthConnectSupported() ? (
          <button
            type="button"
            className="btn wide"
            style={{ marginTop: 8 }}
            onClick={() => void openHealthConnectSettings()}
          >
            {t('settings.hc.openSettings')}
          </button>
        ) : (
          <p className="hint">{t('settings.hc.androidNote')}</p>
        )}
      </div>

      <div className="card">
        <h2>{t('settings.data.title')}</h2>
        <p className="hint" style={{ marginTop: 0, marginBottom: 12 }}>
          {t('settings.data.blurbBefore')} <strong>{t('settings.data.fullBackup')}</strong>{' '}
          {t('settings.data.blurbAfter')}
        </p>
        <div className="btn-row" style={{ marginBottom: 10 }}>
          <button type="button" className="btn primary" onClick={() => void download()}>
            {t('settings.data.export')}
          </button>
          <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
            {t('settings.data.import')}
          </button>
        </div>
        <p className="hint" style={{ marginBottom: 12 }}>
          {t('settings.data.backupNote')}
        </p>
        <button
          type="button"
          className="btn wide"
          style={{ marginBottom: 10 }}
          onClick={() => gpxRef.current?.click()}
        >
          {t('settings.data.importGpx')}
        </button>
        <p className="hint">
          {t('settings.data.gpxNote')}
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
              {t('common.cancel')}
            </button>
            <button
              type="button"
              className="btn danger"
              onClick={async () => {
                await wipeAllLocalData();
                setConfirmingWipe(false);
                onReload();
                setRoutesTick((t) => t + 1);
                onToast(t('settings.wiped'));
              }}
            >
              {t('settings.data.deleteEverything')}
            </button>
          </div>
        ) : (
          <button type="button" className="btn danger wide" onClick={() => setConfirmingWipe(true)}>
            {t('settings.data.deleteAll')}
          </button>
        )}
      </div>

      {themeOpen && (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) setThemeOpen(false);
          }}
        >
          <div className="modal theme-modal" role="dialog" aria-modal="true" aria-labelledby="theme-modal-title">
            <h2 id="theme-modal-title">{t('settings.theme.title')}</h2>
            <p className="hint" style={{ marginTop: 0 }}>
              {t('settings.theme.modalHint')}
            </p>
            <div
              className="theme-picker"
              role="radiogroup"
              aria-label={t('settings.theme.groupLabel')}
            >
              {THEME_OPTIONS.map((opt) => {
                const selected = profile.theme === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    className={`theme-option theme-option-${opt.id}${selected ? ' selected' : ''}`}
                    /*
                     * Apply immediately and leave the sheet open: the whole app
                     * behind the backdrop repaints, so the picker doubles as a
                     * live preview and comparing two themes is one tap each.
                     */
                    onClick={() => set('theme', opt.id as ThemeId)}
                  >
                    <span className="theme-swatch" aria-hidden>
                      <span className="theme-swatch-dot" />
                      <span className="theme-swatch-bar" />
                      <span className="theme-swatch-bar short" />
                    </span>
                    <span className="theme-option-body">
                      <span className="theme-option-label">{t(opt.label)}</span>
                      <span className="theme-option-blurb">{t(opt.blurb)}</span>
                    </span>
                    <span className="theme-option-check" aria-hidden>
                      {selected ? '\u2713' : ''}
                    </span>
                  </button>
                );
              })}
            </div>
            <button type="button" className="btn primary wide" onClick={() => setThemeOpen(false)}>
              {t('common.done')}
            </button>
          </div>
        </div>
      )}

      {langOpen && (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) setLangOpen(false);
          }}
        >
          <div
            className="modal theme-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="lang-modal-title"
          >
            <h2 id="lang-modal-title">{t('settings.language.title')}</h2>
            <p className="hint" style={{ marginTop: 0 }}>
              {t('settings.language.modalHint')}
            </p>
            <div
              className="theme-picker"
              role="radiogroup"
              aria-label={t('settings.language.groupLabel')}
            >
              {LOCALE_OPTIONS.map((opt) => {
                const selected = profile.locale === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    className={`theme-option${selected ? ' selected' : ''}`}
                    /*
                     * Applies immediately and leaves the sheet open, like the
                     * theme picker: the sheet's own copy is translated behind
                     * the tap, which is the clearest possible confirmation
                     * that the right language was chosen.
                     */
                    onClick={() => set('locale', opt.id as LocaleId)}
                  >
                    <span className="locale-swatch" aria-hidden>
                      {opt.id.toUpperCase()}
                    </span>
                    <span className="theme-option-body">
                      <span className="theme-option-label" lang={opt.id}>
                        {opt.endonym}
                      </span>
                      <span className="theme-option-blurb">{opt.english}</span>
                    </span>
                    <span className="theme-option-check" aria-hidden>
                      {selected ? '\u2713' : ''}
                    </span>
                  </button>
                );
              })}
            </div>
            <button type="button" className="btn primary wide" onClick={() => setLangOpen(false)}>
              {t('common.done')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
