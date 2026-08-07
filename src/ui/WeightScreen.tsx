/**
 * Body-weight log: free first entry, then ongoing readings, goal, and trend chart.
 */

import { useMemo, useState } from 'react';
import type { Profile } from '../core/settings';
import {
  addWeightEntry,
  deleteWeightEntry,
  fromDisplayWeight,
  latestWeightKg,
  loadWeightStore,
  saveWeightStore,
  setWeightGoal,
  toDisplayWeight,
  weightEntriesChronological,
  weightToGoalKg,
  weightTrendKg,
  weightUnitLabel,
  type WeightStore,
} from '../core/weight';

interface Props {
  profile: Profile;
  onProfileChange(profile: Profile): void;
  onToast(message: string): void;
  /** Bump when calendar should refresh weight dots. */
  onLogChange?(): void;
  /** When opened from Profile, show a back control instead of a main tab. */
  onBack?(): void;
}

function formatDay(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function WeightChart({
  store,
  units,
}: {
  store: WeightStore;
  units: Profile['units'];
}) {
  const points = weightEntriesChronological(store);
  if (points.length < 2) {
    return (
      <p className="hint" style={{ margin: 0 }}>
        Log at least two weigh-ins to see a trend line.
      </p>
    );
  }

  const values = points.map((p) => toDisplayWeight(p.weightKg, units));
  const goal =
    store.goalKg !== null ? toDisplayWeight(store.goalKg, units) : null;
  const all = goal !== null ? [...values, goal] : values;
  const min = Math.min(...all);
  const max = Math.max(...all);
  const span = Math.max(max - min, 0.5);
  const pad = span * 0.15;
  const lo = min - pad;
  const hi = max + pad;
  const w = 100;
  const h = 42;

  const path = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * w;
      const y = h - ((toDisplayWeight(p.weightKg, units) - lo) / (hi - lo)) * h;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');

  const goalY =
    goal !== null ? h - ((goal - lo) / (hi - lo)) * h : null;

  return (
    <div className="weight-chart">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="none"
        className="weight-chart-svg"
        role="img"
        aria-label="Weight trend"
      >
        {goalY !== null && (
          <line
            x1={0}
            y1={goalY}
            x2={w}
            y2={goalY}
            className="weight-chart-goal"
          />
        )}
        <path d={path} fill="none" className="weight-chart-line" vectorEffect="non-scaling-stroke" />
        {points.map((p, i) => {
          const x = (i / (points.length - 1)) * w;
          const y = h - ((toDisplayWeight(p.weightKg, units) - lo) / (hi - lo)) * h;
          return (
            <circle
              key={p.id}
              cx={x}
              cy={y}
              r={1.2}
              className="weight-chart-dot"
            />
          );
        })}
      </svg>
      <div className="row weight-chart-axis">
        <span>
          {toDisplayWeight(points[0].weightKg, units).toFixed(1)} {weightUnitLabel(units)}
        </span>
        <span>
          {toDisplayWeight(points[points.length - 1].weightKg, units).toFixed(1)}{' '}
          {weightUnitLabel(units)}
        </span>
      </div>
    </div>
  );
}

export function WeightScreen({
  profile,
  onProfileChange,
  onToast,
  onLogChange,
  onBack,
}: Props) {
  const [store, setStore] = useState<WeightStore>(() => loadWeightStore());
  const unit = weightUnitLabel(profile.units);
  const latest = latestWeightKg(store);
  const displayLatest =
    latest !== null ? toDisplayWeight(latest, profile.units) : null;

  // Free-text drafts so clearing the field never jumps to a clamped minimum.
  const [entryDraft, setEntryDraft] = useState(
    displayLatest !== null ? String(displayLatest) : '',
  );
  const [goalDraft, setGoalDraft] = useState(
    store.goalKg !== null ? String(toDisplayWeight(store.goalKg, profile.units)) : '',
  );
  const [noteDraft, setNoteDraft] = useState('');

  const persist = (next: WeightStore, syncProfileWeight: boolean) => {
    const clean = next;
    setStore(clean);
    saveWeightStore(clean);
    if (syncProfileWeight) {
      const kg = latestWeightKg(clean);
      if (kg !== null && Math.abs(kg - profile.weightKg) > 0.01) {
        onProfileChange({ ...profile, weightKg: kg });
      }
    }
    onLogChange?.();
  };

  const parseDraft = (text: string): number | null => {
    const n = Number(text.replace(',', '.').trim());
    if (!Number.isFinite(n) || n <= 0) return null;
    return fromDisplayWeight(n, profile.units);
  };

  const logWeight = () => {
    const kg = parseDraft(entryDraft);
    if (kg === null) {
      onToast(`Enter a weight in ${unit}.`);
      return;
    }
    const next = addWeightEntry(store, { weightKg: kg, note: noteDraft });
    persist(next, true);
    setNoteDraft('');
    setEntryDraft(String(toDisplayWeight(kg, profile.units)));
    onToast(
      store.entries.length === 0
        ? `Starting weight saved: ${toDisplayWeight(kg, profile.units)} ${unit}.`
        : `Logged ${toDisplayWeight(kg, profile.units)} ${unit}.`,
    );
  };

  const saveGoal = () => {
    const raw = goalDraft.trim();
    if (!raw) {
      persist(setWeightGoal(store, null), false);
      onToast('Weight goal cleared.');
      return;
    }
    const kg = parseDraft(goalDraft);
    if (kg === null) {
      onToast(`Enter a goal in ${unit}, or clear the field.`);
      return;
    }
    persist(setWeightGoal(store, kg), false);
    onToast(`Goal set to ${toDisplayWeight(kg, profile.units)} ${unit}.`);
  };

  const trend = weightTrendKg(store);
  const toGoal = weightToGoalKg(store);
  const hasLog = store.entries.length > 0;

  const sortedNewest = useMemo(
    () => [...store.entries].sort((a, b) => b.at - a.at),
    [store.entries],
  );

  return (
    <div className="screen">
      {onBack && (
        <button type="button" className="back" onClick={onBack}>
          ‹ Back to profile
        </button>
      )}
      <h1>Weight</h1>
      <p className="subtitle">
        Log weigh-ins, set a goal, and watch the trend. Readings also show on the History
        calendar.
      </p>

      {!hasLog ? (
        <div className="card">
          <h2>Starting weight</h2>
          <p className="hint" style={{ marginTop: 0 }}>
            Type freely — nothing is saved until you press Save. This becomes your first log
            entry and is used for calorie estimates on runs.
          </p>
          <div className="field">
            <label htmlFor="weight-start">Weight ({unit})</label>
            <input
              id="weight-start"
              type="text"
              inputMode="decimal"
              placeholder={profile.units === 'metric' ? 'e.g. 72.5' : 'e.g. 160'}
              value={entryDraft}
              onChange={(e) => setEntryDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  logWeight();
                }
              }}
            />
          </div>
          <button type="button" className="btn primary wide" onClick={logWeight}>
            Save starting weight
          </button>
        </div>
      ) : (
        <>
          <div className="metric-grid" style={{ marginBottom: 12 }}>
            <div className="metric">
              <div className="value">
                {displayLatest !== null ? displayLatest.toFixed(1) : '—'}
              </div>
              <div className="label">Latest {unit}</div>
            </div>
            <div className="metric">
              <div className="value">
                {store.goalKg !== null
                  ? toDisplayWeight(store.goalKg, profile.units).toFixed(1)
                  : '—'}
              </div>
              <div className="label">Goal {unit}</div>
            </div>
            <div className="metric">
              <div className="value">
                {trend === null
                  ? '—'
                  : `${trend > 0 ? '+' : trend < 0 ? '−' : ''}${toDisplayWeight(
                      Math.abs(trend),
                      profile.units,
                    ).toFixed(1)}`}
              </div>
              <div className="label">Since first</div>
            </div>
          </div>

          {toGoal !== null && store.goalKg !== null && (
            <p className="hint" style={{ marginTop: 0, marginBottom: 12 }}>
              {Math.abs(toGoal) < 0.05
                ? 'At your goal weight.'
                : toGoal > 0
                  ? `${toDisplayWeight(toGoal, profile.units).toFixed(1)} ${unit} above goal.`
                  : `${toDisplayWeight(-toGoal, profile.units).toFixed(1)} ${unit} below goal.`}
            </p>
          )}

          <div className="card">
            <h2>Log a weigh-in</h2>
            <div className="field">
              <label htmlFor="weight-entry">Weight ({unit})</label>
              <input
                id="weight-entry"
                type="text"
                inputMode="decimal"
                value={entryDraft}
                onChange={(e) => setEntryDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    logWeight();
                  }
                }}
              />
            </div>
            <div className="field">
              <label htmlFor="weight-note">Note (optional)</label>
              <input
                id="weight-note"
                type="text"
                maxLength={120}
                placeholder="Morning, after run…"
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
              />
            </div>
            <button type="button" className="btn primary wide" onClick={logWeight}>
              Add to log
            </button>
          </div>

          <div className="card">
            <h2>Goal weight</h2>
            <div className="field">
              <label htmlFor="weight-goal">Target ({unit})</label>
              <div className="name-edit-row">
                <input
                  id="weight-goal"
                  type="text"
                  inputMode="decimal"
                  placeholder="Optional"
                  value={goalDraft}
                  onChange={(e) => setGoalDraft(e.target.value)}
                />
                <button type="button" className="btn name-action primary-soft" onClick={saveGoal}>
                  Save
                </button>
              </div>
              <p className="hint">Clear the field and save to remove the goal.</p>
            </div>
          </div>

          <div className="card">
            <h2>Trend</h2>
            <WeightChart store={store} units={profile.units} />
          </div>

          <div className="card">
            <h2>History</h2>
            {sortedNewest.length === 0 ? (
              <p className="hint" style={{ margin: 0 }}>
                No entries yet.
              </p>
            ) : (
              <ul className="weight-log-list">
                {sortedNewest.map((e) => (
                  <li key={e.id}>
                    <span className="weight-log-main">
                      <strong>
                        {toDisplayWeight(e.weightKg, profile.units).toFixed(1)} {unit}
                      </strong>
                      <span className="meta">
                        {formatDay(e.at)}
                        {e.note ? ` · ${e.note}` : ''}
                      </span>
                    </span>
                    <button
                      type="button"
                      className="btn"
                      onClick={() => {
                        const next = deleteWeightEntry(store, e.id);
                        persist(next, true);
                        const latestNext = latestWeightKg(next);
                        if (latestNext !== null) {
                          setEntryDraft(String(toDisplayWeight(latestNext, profile.units)));
                        } else {
                          setEntryDraft('');
                        }
                        onToast('Entry removed.');
                      }}
                    >
                      Delete
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
