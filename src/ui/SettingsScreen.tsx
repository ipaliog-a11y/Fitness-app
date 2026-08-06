/** Profile, units, zones, and getting the data out. */

import { useRef, useState } from 'react';
import { estimateMaxHeartRate, ZONES, zoneBounds } from '../core/heart';
import { estimateStride } from '../core/steps';
import { clearAll, exportJson, importJson } from '../core/db';
import type { Profile } from '../core/settings';
import { distanceLabel, fromDisplayDistance, toDisplayDistance } from '../core/units';

interface Props {
  profile: Profile;
  onChange(profile: Profile): void;
  onReload(): void;
  onToast(message: string): void;
}

export function SettingsScreen({ profile, onChange, onReload, onToast }: Props) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [confirmingWipe, setConfirmingWipe] = useState(false);

  const set = <K extends keyof Profile>(key: K, value: Profile[K]) =>
    onChange({ ...profile, [key]: value });

  const download = async () => {
    const json = await exportJson();
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `runlog-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const upload = async (file: File) => {
    try {
      const result = await importJson(await file.text());
      onToast(`Imported ${result.imported}, skipped ${result.skipped}.`);
      onReload();
    } catch (error) {
      onToast(error instanceof Error ? error.message : 'That file could not be read.');
    }
  };

  return (
    <div className="screen">
      <h1>Settings</h1>
      <p className="subtitle">Everything here stays on this device.</p>

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
        <h2>You</h2>
        <div className="field">
          <label htmlFor="age">Age</label>
          <input
            id="age"
            type="number"
            inputMode="numeric"
            value={profile.age}
            onChange={(e) => {
              const age = Number(e.target.value);
              if (!Number.isFinite(age)) return;
              // Changing age re-seeds the max heart rate only while it still
              // matches the old estimate — a tested figure typed in by hand must
              // not be silently overwritten by a birthday.
              const reseed = profile.maxHeartRate === estimateMaxHeartRate(profile.age);
              onChange({
                ...profile,
                age,
                maxHeartRate: reseed ? estimateMaxHeartRate(age) : profile.maxHeartRate,
              });
            }}
          />
        </div>

        <div className="field">
          <label htmlFor="height">Height (cm)</label>
          <input
            id="height"
            type="number"
            inputMode="numeric"
            value={profile.heightCm}
            onChange={(e) => {
              const heightCm = Number(e.target.value);
              if (!Number.isFinite(heightCm)) return;
              set('heightCm', heightCm);
            }}
          />
        </div>

        <div className="field">
          <label htmlFor="stride">Treadmill stride (m per step)</label>
          <input
            id="stride"
            type="number"
            step="0.01"
            inputMode="decimal"
            value={profile.strideM.toFixed(2)}
            onChange={(e) => {
              const stride = Number(e.target.value);
              if (Number.isFinite(stride) && stride > 0) set('strideM', stride);
            }}
          />
          <p className="hint">
            Used to turn counted steps into distance. Finish a treadmill run with the console's
            distance typed in and this calibrates itself.{' '}
            <button
              className="pill"
              onClick={() => set('strideM', estimateStride(profile.heightCm))}
              style={{ cursor: 'pointer' }}
            >
              Reset from height
            </button>
          </p>
        </div>
      </div>

      <div className="card">
        <h2>Heart rate</h2>
        <div className="field">
          <label htmlFor="maxhr">Maximum heart rate (bpm)</label>
          <input
            id="maxhr"
            type="number"
            inputMode="numeric"
            value={profile.maxHeartRate}
            onChange={(e) => {
              const max = Number(e.target.value);
              if (Number.isFinite(max) && max > 0) set('maxHeartRate', max);
            }}
          />
          <p className="hint">
            Estimated as 220 − age ({estimateMaxHeartRate(profile.age)} for you), which is a
            population average with a good deal of scatter. If you know yours from a real test, put
            that in instead — every zone below depends on it.
          </p>
        </div>

        <div style={{ marginTop: 16 }}>
          {ZONES.map((zone) => {
            const range = zoneBounds(zone, profile.maxHeartRate);
            return (
              <div className="zone-row" key={zone.index}>
                <span className="swatch" style={{ background: zone.colour }} />
                <span className="name">
                  Z{zone.index} {zone.name}
                </span>
                <span style={{ flex: 1, fontSize: 12, color: 'var(--muted)' }}>{zone.blurb}</span>
                <span className="time">
                  {range.from}
                  {range.to ? `–${range.to}` : '+'}
                </span>
              </div>
            );
          })}
        </div>
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
          <p className="hint">Set to 0 to turn the goal off.</p>
        </div>
      </div>

      <div className="card">
        <h2>During a run</h2>
        <div className="row">
          <span>Keep the screen awake</span>
          <button
            className="btn"
            aria-pressed={profile.keepAwake}
            onClick={() => set('keepAwake', !profile.keepAwake)}
          >
            {profile.keepAwake ? 'On' : 'Off'}
          </button>
        </div>
      </div>

      <div className="card">
        <h2>Your data</h2>
        <p className="hint" style={{ marginTop: 0, marginBottom: 12 }}>
          Runs live in this browser's storage and nowhere else. Nothing is uploaded — which also
          means clearing site data deletes them. Export now and then.
        </p>
        <div className="btn-row" style={{ marginBottom: 10 }}>
          <button className="btn" onClick={download}>
            Export
          </button>
          <button className="btn" onClick={() => fileRef.current?.click()}>
            Import
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void upload(file);
            // Cleared so re-picking the same file fires change again.
            e.target.value = '';
          }}
        />

        {confirmingWipe ? (
          <div className="btn-row">
            <button className="btn" onClick={() => setConfirmingWipe(false)}>
              Cancel
            </button>
            <button
              className="btn danger"
              onClick={async () => {
                await clearAll();
                setConfirmingWipe(false);
                onReload();
                onToast('All runs deleted.');
              }}
            >
              Delete everything
            </button>
          </div>
        ) : (
          <button className="btn danger wide" onClick={() => setConfirmingWipe(true)}>
            Delete all runs
          </button>
        )}
      </div>
    </div>
  );
}
