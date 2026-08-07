/**
 * Athlete identity and body setup: name, measurements, HR zones, shoes.
 *
 * Kept separate from Settings so gear/backup prefs stay out of the way of the
 * numbers that change how runs are measured.
 */

import { Component, useEffect, useState, type ErrorInfo, type ReactNode } from 'react';
import { estimateMaxHeartRate, ZONES, zoneBounds } from '../core/heart';
import {
  createShoe,
  DEFAULT_SHOE_LIMIT_M,
  loadShoes,
  saveShoes,
  shoeWearFraction,
  updateShoe,
  type Shoe,
} from '../core/shoes';
import { sanitise, type Profile } from '../core/settings';
import { estimateStride } from '../core/steps';
import {
  distanceLabel,
  formatDistance,
  fromDisplayDistance,
  toDisplayDistance,
} from '../core/units';

interface Props {
  profile: Profile;
  onChange(profile: Profile): void;
  onToast(message: string): void;
}

/** Catch render crashes so the tab never goes fully blank. */
class ProfileErrorBoundary extends Component<
  { children: ReactNode },
  { error: string | null }
> {
  override state: { error: string | null } = { error: null };

  static getDerivedStateFromError(error: Error): { error: string } {
    return { error: error?.message || 'Something went wrong' };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('ProfileScreen crashed', error, info);
  }

  override render(): ReactNode {
    if (this.state.error) {
      return (
        <div className="screen">
          <h1>Profile</h1>
          <div className="card">
            <p className="hint" style={{ marginTop: 0 }}>
              Could not open Profile: {this.state.error}
            </p>
            <button
              type="button"
              className="btn primary wide"
              onClick={() => this.setState({ error: null })}
            >
              Try again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export function ProfileScreen(props: Props) {
  return (
    <ProfileErrorBoundary>
      <ProfileScreenInner {...props} />
    </ProfileErrorBoundary>
  );
}

function ProfileScreenInner({ profile: rawProfile, onChange, onToast }: Props) {
  // Never trust a half-written profile from storage/HMR.
  const profile = sanitise(rawProfile);

  const [shoes, setShoes] = useState<Shoe[]>(() => {
    try {
      return loadShoes();
    } catch {
      return [];
    }
  });
  /** null = closed; 'new' = add; string id = edit that pair. */
  const [shoeModal, setShoeModal] = useState<'new' | string | null>(null);
  const [shoeName, setShoeName] = useState('');
  const [shoeBrand, setShoeBrand] = useState('');
  const [shoeLimit, setShoeLimit] = useState(
    String(toDisplayDistance(DEFAULT_SHOE_LIMIT_M, profile.units).toFixed(0)),
  );

  const set = <K extends keyof Profile>(key: K, value: Profile[K]) =>
    onChange({ ...profile, [key]: value });

  const persistShoes = (next: Shoe[]) => {
    setShoes(next);
    saveShoes(next);
  };

  const openAddShoe = () => {
    setShoeName('');
    setShoeBrand('');
    setShoeLimit(String(toDisplayDistance(DEFAULT_SHOE_LIMIT_M, profile.units).toFixed(0)));
    setShoeModal('new');
  };

  const openEditShoe = (shoe: Shoe) => {
    setShoeName(shoe.name ?? '');
    setShoeBrand(shoe.brand ?? '');
    setShoeLimit(String(toDisplayDistance(shoe.limitM ?? DEFAULT_SHOE_LIMIT_M, profile.units).toFixed(0)));
    setShoeModal(shoe.id);
  };

  const closeShoeModal = () => setShoeModal(null);

  const saveShoeModal = () => {
    if (!shoeName.trim()) {
      onToast('Give the shoes a name.');
      return;
    }
    const limitDisplay = Number(shoeLimit);
    const limitM = Number.isFinite(limitDisplay)
      ? fromDisplayDistance(limitDisplay, profile.units)
      : DEFAULT_SHOE_LIMIT_M;

    if (shoeModal === 'new') {
      const shoe = createShoe({ name: shoeName, brand: shoeBrand, limitM });
      persistShoes([shoe, ...shoes]);
      onToast(`Added ${shoe.name}.`);
    } else if (typeof shoeModal === 'string') {
      persistShoes(
        updateShoe(shoes, shoeModal, {
          name: shoeName,
          brand: shoeBrand,
          limitM,
        }),
      );
      onToast('Shoes updated.');
    }
    closeShoeModal();
  };

  const displayName = typeof profile.displayName === 'string' ? profile.displayName : '';
  const savedName = displayName.trim();
  const hasName = savedName.length > 0;
  const greeting = savedName || 'Runner';
  const [editingName, setEditingName] = useState(!hasName);
  const [nameDraft, setNameDraft] = useState(displayName);

  useEffect(() => {
    setNameDraft(displayName);
    if (!displayName.trim()) setEditingName(true);
  }, [displayName]);

  const saveName = () => {
    const next = nameDraft.trim().slice(0, 40);
    set('displayName', next);
    setEditingName(!next);
    if (next) onToast(`Name set to ${next}.`);
  };

  const sex = profile.sex === 'female' ? 'female' : 'male';
  const weightDisplay =
    profile.units === 'metric'
      ? profile.weightKg
      : Math.round(profile.weightKg * 2.20462 * 10) / 10;
  const strideDisplay = Number.isFinite(profile.strideM) ? profile.strideM.toFixed(2) : '0.75';

  return (
    <div className="screen">
      <h1>{greeting}</h1>
      <p className="subtitle">Your body, zones, and shoes — all on this device.</p>

      <div className="card">
        <h2>Name</h2>
        {editingName || !hasName ? (
          <div className="field name-field">
            {!hasName && (
              <label htmlFor="display-name">What should we call you?</label>
            )}
            <div className="name-edit-row">
              <input
                id="display-name"
                type="text"
                autoComplete="nickname"
                placeholder="e.g. Alex"
                maxLength={40}
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    saveName();
                  }
                }}
              />
              <button type="button" className="btn name-action primary-soft" onClick={saveName}>
                Save
              </button>
              {hasName && (
                <button
                  type="button"
                  className="btn name-action"
                  onClick={() => {
                    setNameDraft(displayName);
                    setEditingName(false);
                  }}
                >
                  Cancel
                </button>
              )}
            </div>
            {!hasName && (
              <p className="hint">
                Used for greetings and future personalised coaching. Not shared anywhere.
              </p>
            )}
          </div>
        ) : (
          <div className="name-display-row">
            <span className="name-value">{savedName}</span>
            <button
              type="button"
              className="btn name-action"
              onClick={() => {
                setNameDraft(displayName);
                setEditingName(true);
              }}
            >
              Edit
            </button>
          </div>
        )}
      </div>

      <div className="card">
        <h2>Body</h2>
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
          <label htmlFor="weight">Weight ({profile.units === 'metric' ? 'kg' : 'lb'})</label>
          <input
            id="weight"
            type="number"
            inputMode="decimal"
            step="0.1"
            value={weightDisplay}
            onChange={(e) => {
              const raw = Number(e.target.value);
              if (!Number.isFinite(raw) || raw <= 0) return;
              const weightKg = profile.units === 'metric' ? raw : raw / 2.20462;
              set('weightKg', weightKg);
            }}
          />
          <p className="hint">
            Used for calorie estimates (HR when a strap is connected, otherwise pace).
          </p>
        </div>

        <div className="field">
          <label>Sex (for calorie estimate)</label>
          <div className="segmented" style={{ marginTop: 6 }}>
            <button
              type="button"
              aria-pressed={sex === 'female'}
              onClick={() => set('sex', 'female')}
            >
              Female
            </button>
            <button
              type="button"
              aria-pressed={sex === 'male'}
              onClick={() => set('sex', 'male')}
            >
              Male
            </button>
          </div>
          <p className="hint">Used by the HR-based calorie model (Keytel).</p>
        </div>

        <div className="field">
          <label htmlFor="stride">Treadmill stride (m per step)</label>
          <input
            id="stride"
            type="number"
            step="0.01"
            inputMode="decimal"
            value={strideDisplay}
            onChange={(e) => {
              const stride = Number(e.target.value);
              if (Number.isFinite(stride) && stride > 0) set('strideM', stride);
            }}
          />
          <p className="hint">
            For step counting without a foot pod.{' '}
            <button
              type="button"
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
        <h2>Heart rate zones</h2>
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
            Default estimate 220 − age ({estimateMaxHeartRate(profile.age)}). Override with a
            tested figure if you have one.
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
        <h2>Shoes</h2>
        <p className="hint" style={{ marginTop: 0 }}>
          Pick a pair on the <strong>Get ready</strong> screen before you start; mileage is added
          when you finish.
        </p>
        {shoes.length === 0 && <p className="hint">No shoes yet — tap Add a pair.</p>}
        {shoes.map((shoe) => {
          const wear = Math.round(shoeWearFraction(shoe) * 100);
          return (
            <div className="shoe-row" key={shoe.id}>
              <div className="body">
                <strong>
                  {shoe.name}
                  {shoe.retired ? ' (retired)' : ''}
                </strong>
                <span className="meta">
                  {shoe.brand ? `${shoe.brand} · ` : ''}
                  {formatDistance(shoe.distanceM, profile.units)} /{' '}
                  {formatDistance(shoe.limitM, profile.units)} {distanceLabel(profile.units)}
                  {' · '}
                  {wear}%
                </span>
                <div className="goal-bar" style={{ marginTop: 6 }}>
                  <span
                    style={{
                      width: `${Math.min(100, wear)}%`,
                      background: wear >= 100 ? 'var(--danger)' : 'var(--accent)',
                    }}
                  />
                </div>
              </div>
              <div className="shoe-actions">
                <button type="button" className="btn" onClick={() => openEditShoe(shoe)}>
                  Edit
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={() =>
                    persistShoes(
                      shoes.map((s) => (s.id === shoe.id ? { ...s, retired: !s.retired } : s)),
                    )
                  }
                >
                  {shoe.retired ? 'Restore' : 'Retire'}
                </button>
                <button
                  type="button"
                  className="btn danger"
                  onClick={() => persistShoes(shoes.filter((s) => s.id !== shoe.id))}
                >
                  Delete
                </button>
              </div>
            </div>
          );
        })}
        <button
          type="button"
          className="btn primary wide"
          style={{ marginTop: 12 }}
          onClick={openAddShoe}
        >
          Add a pair
        </button>
      </div>

      {shoeModal !== null && (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeShoeModal();
          }}
        >
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="shoe-modal-title"
          >
            <h2 id="shoe-modal-title">
              {shoeModal === 'new' ? 'Add a pair' : 'Edit pair'}
            </h2>
            <div className="field">
              <label htmlFor="shoe-name">Name</label>
              <input
                id="shoe-name"
                placeholder="e.g. Daily trainers"
                value={shoeName}
                // eslint-disable-next-line jsx-a11y/no-autofocus
                autoFocus
                onChange={(e) => setShoeName(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="shoe-brand">Brand (optional)</label>
              <input
                id="shoe-brand"
                placeholder="Brand"
                value={shoeBrand}
                onChange={(e) => setShoeBrand(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="shoe-limit">Wear limit ({distanceLabel(profile.units)})</label>
              <input
                id="shoe-limit"
                type="number"
                value={shoeLimit}
                onChange={(e) => setShoeLimit(e.target.value)}
              />
            </div>
            {shoeModal !== 'new' && (
              <p className="hint">
                Mileage is not changed here — it only grows when you finish runs in these shoes.
              </p>
            )}
            <div className="btn-row" style={{ marginTop: 8 }}>
              <button type="button" className="btn" onClick={closeShoeModal}>
                Cancel
              </button>
              <button type="button" className="btn primary" onClick={saveShoeModal}>
                {shoeModal === 'new' ? 'Save pair' : 'Save changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
