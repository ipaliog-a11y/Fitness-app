/**
 * Athlete identity and body setup: name, measurements, HR zones, shoes.
 *
 * Kept separate from Settings so gear/backup prefs stay out of the way of the
 * numbers that change how runs are measured.
 */

import { Component, useEffect, useMemo, useState, type ErrorInfo, type ReactNode } from 'react';
import type { Activity } from '../core/activity';
import {
  ACHIEVEMENTS,
  loadUnlocks,
  refreshAchievements,
  unlockedCount,
} from '../core/achievements';
import { estimateMaxHeartRate, ZONES, zoneBounds, zoneSwatch } from '../core/heart';
import { loadLifetime, syncLifetime, type LifetimeStats } from '../core/lifetime';
import {
  createShoe,
  DEFAULT_SHOE_LIMIT_M,
  loadShoes,
  saveShoes,
  shoeWearFraction,
  updateShoe,
  type Shoe,
} from '../core/shoes';
import { ageFromBirthDate, sanitise, type Profile } from '../core/settings';
import { estimateStride } from '../core/steps';
import {
  distanceLabel,
  formatDistance,
  fromDisplayDistance,
  toDisplayDistance,
} from '../core/units';
import {
  latestWeightKg,
  loadWeightStore,
  toDisplayWeight,
  weightToGoalKg,
  weightTrendKg,
  weightUnitLabel,
} from '../core/weight';
import { AchievementsScreen } from './AchievementsScreen';
import { WeightScreen } from './WeightScreen';
import { useT } from '../i18n/react';

interface Props {
  profile: Profile;
  activities: Activity[];
  onChange(profile: Profile): void;
  onToast(message: string): void;
  onWeightLogChange?(): void;
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

function ProfileScreenInner({
  profile: rawProfile,
  activities,
  onChange,
  onToast,
  onWeightLogChange,
}: Props) {
  const t = useT();
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
  const [achievementsOpen, setAchievementsOpen] = useState(false);
  const [lifetime, setLifetime] = useState<LifetimeStats>(() => loadLifetime());
  const [unlockTick, setUnlockTick] = useState(0);

  const set = <K extends keyof Profile>(key: K, value: Profile[K]) =>
    onChange({ ...profile, [key]: value });

  const runAchievementPass = (list: Activity[] = activities) => {
    const { lifetime: nextLife, newly } = refreshAchievements(list, profile);
    setLifetime(nextLife);
    setUnlockTick((t) => t + 1);
    if (newly.length === 1) onToast(t('toast.achievement.one', { name: t(newly[0].title) }));
    else if (newly.length > 1) onToast(t('toast.achievement.many', { count: newly.length }));
  };

  useEffect(() => {
    setLifetime(syncLifetime(activities));
    runAchievementPass(activities);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- evaluate when history/profile change
  }, [activities, profile.displayName, profile.birthDate, profile.heightCm]);

  const unlockN = useMemo(() => {
    void unlockTick;
    return unlockedCount(loadUnlocks());
  }, [unlockTick]);

  const persistShoes = (next: Shoe[]) => {
    setShoes(next);
    saveShoes(next);
    runAchievementPass();
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
  const hasBirth = Boolean(profile.birthDate);
  const identityComplete = hasName && hasBirth && profile.heightCm > 0;
  const [editingIdentity, setEditingIdentity] = useState(!identityComplete);
  const [nameDraft, setNameDraft] = useState(displayName);
  const [birthDraft, setBirthDraft] = useState(profile.birthDate || '');
  const [heightDraft, setHeightDraft] = useState(String(profile.heightCm || ''));
  const [sexDraft, setSexDraft] = useState<'male' | 'female'>(
    profile.sex === 'female' ? 'female' : 'male',
  );
  const [weightOpen, setWeightOpen] = useState(false);
  /** Local bump so Body overview refreshes after logging without leaving Profile. */
  const [weightTick, setWeightTick] = useState(0);

  useEffect(() => {
    setNameDraft(displayName);
    setBirthDraft(profile.birthDate || '');
    setHeightDraft(String(profile.heightCm || ''));
    setSexDraft(profile.sex === 'female' ? 'female' : 'male');
    if (!displayName.trim() || !profile.birthDate) setEditingIdentity(true);
  }, [displayName, profile.birthDate, profile.heightCm, profile.sex]);

  const saveIdentity = () => {
    const nextName = nameDraft.trim().slice(0, 40);
    const birth = birthDraft.trim();
    const ageFromDob = ageFromBirthDate(birth);
    if (birth && ageFromDob === null) {
      onToast('Enter a valid date of birth.');
      return;
    }
    const heightRaw = heightDraft.trim();
    let heightCm = profile.heightCm;
    if (heightRaw !== '') {
      const n = Number(heightRaw);
      if (!Number.isFinite(n) || n < 80 || n > 250) {
        onToast('Height must be between 80 and 250 cm.');
        return;
      }
      heightCm = n;
    }
    const age = ageFromDob ?? profile.age;
    const reseed = profile.maxHeartRate === estimateMaxHeartRate(profile.age);
    onChange({
      ...profile,
      displayName: nextName,
      birthDate: ageFromDob !== null ? birth : '',
      age,
      heightCm,
      sex: sexDraft,
      maxHeartRate: reseed ? estimateMaxHeartRate(age) : profile.maxHeartRate,
      strideM:
        Math.abs(heightCm - profile.heightCm) > 0.5
          ? estimateStride(heightCm)
          : profile.strideM,
    });
    setEditingIdentity(false);
    onToast(nextName ? `Profile saved · ${nextName}.` : 'Profile saved.');
  };

  const weightLog = loadWeightStore();
  void weightTick;
  const latestKg = latestWeightKg(weightLog) ?? profile.weightKg;
  const weightDisplay = toDisplayWeight(latestKg, profile.units);
  const unit = weightUnitLabel(profile.units);
  const trend = weightTrendKg(weightLog);
  const toGoal = weightToGoalKg(weightLog);
  const [maxHrDraft, setMaxHrDraft] = useState(String(profile.maxHeartRate));

  useEffect(() => {
    setMaxHrDraft(String(profile.maxHeartRate));
  }, [profile.maxHeartRate]);

  if (weightOpen) {
    return (
      <WeightScreen
        profile={profile}
        onProfileChange={onChange}
        onToast={onToast}
        onBack={() => {
          setWeightOpen(false);
          setWeightTick((t) => t + 1);
        }}
        onLogChange={() => {
          setWeightTick((t) => t + 1);
          onWeightLogChange?.();
        }}
      />
    );
  }

  if (achievementsOpen) {
    return (
      <AchievementsScreen
        profile={profile}
        activities={activities}
        onBack={() => {
          setAchievementsOpen(false);
          setUnlockTick((t) => t + 1);
          setLifetime(loadLifetime());
        }}
        onToast={onToast}
      />
    );
  }

  return (
    <div className="screen">
      <h1>{greeting}</h1>
      <p className="subtitle">Your body, zones, and shoes — all on this device.</p>

      <div className="card">
        <h2>Lifetime mileage</h2>
        <div className="metric-grid" style={{ marginTop: 8 }}>
          <div className="metric">
            <div className="value">
              {formatDistance(lifetime.distanceM, profile.units)}
            </div>
            <div className="label">{distanceLabel(profile.units)} total</div>
          </div>
          <div className="metric">
            <div className="value">{lifetime.runs}</div>
            <div className="label">Runs</div>
          </div>
          <div className="metric">
            <div className="value">
              {formatDistance(lifetime.longestRunM, profile.units)}
            </div>
            <div className="label">Longest</div>
          </div>
        </div>
        <p className="hint" style={{ marginBottom: 0 }}>
          Sum of every saved run on this device (updates when you finish or delete).
        </p>
      </div>

      <div className="card">
        <div className="row">
          <h2 style={{ margin: 0 }}>Achievements</h2>
          <span className="hint" style={{ margin: 0 }}>
            {unlockN}/{ACHIEVEMENTS.length}
          </span>
        </div>
        <p className="hint" style={{ marginTop: 8 }}>
          Distance, lifetime mileage, recovery, performance, and fun unlocks for using RunLog.
        </p>
        <button
          type="button"
          className="btn primary wide"
          onClick={() => setAchievementsOpen(true)}
        >
          Open achievements
        </button>
      </div>

      <div className="card">
        <h2>Profile</h2>
        {editingIdentity ? (
          <>
            <div className="field name-field">
              <label htmlFor="display-name">Name</label>
              <input
                id="display-name"
                type="text"
                autoComplete="nickname"
                placeholder="e.g. Alex"
                maxLength={40}
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="birth-date">Date of birth</label>
              <input
                id="birth-date"
                type="date"
                value={birthDraft}
                max={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setBirthDraft(e.target.value)}
              />
              <p className="hint">
                Age is calculated automatically for max HR and calorie estimates.
                {birthDraft && ageFromBirthDate(birthDraft) !== null
                  ? ` Currently ${ageFromBirthDate(birthDraft)} years.`
                  : ''}
              </p>
            </div>
            <div className="field">
              <label htmlFor="height">Height (cm)</label>
              <input
                id="height"
                type="text"
                inputMode="numeric"
                placeholder="e.g. 175"
                value={heightDraft}
                onChange={(e) => setHeightDraft(e.target.value)}
              />
              <p className="hint">You can clear the field while typing — nothing is saved until Save.</p>
            </div>
            <div className="field">
              <label>Sex (for calorie estimate)</label>
              <div className="segmented" style={{ marginTop: 6 }}>
                <button
                  type="button"
                  aria-pressed={sexDraft === 'female'}
                  onClick={() => setSexDraft('female')}
                >
                  Female
                </button>
                <button
                  type="button"
                  aria-pressed={sexDraft === 'male'}
                  onClick={() => setSexDraft('male')}
                >
                  Male
                </button>
              </div>
              <p className="hint">Used by the HR-based calorie model (Keytel).</p>
            </div>
            <div className="name-edit-row" style={{ marginTop: 8 }}>
              <button type="button" className="btn name-action primary-soft" onClick={saveIdentity}>
                Save
              </button>
              {identityComplete && (
                <button
                  type="button"
                  className="btn name-action"
                  onClick={() => {
                    setNameDraft(displayName);
                    setBirthDraft(profile.birthDate || '');
                    setHeightDraft(String(profile.heightCm || ''));
                    setSexDraft(profile.sex === 'female' ? 'female' : 'male');
                    setEditingIdentity(false);
                  }}
                >
                  Cancel
                </button>
              )}
            </div>
          </>
        ) : (
          <div className="identity-display">
            <div className="identity-row">
              <span className="kv-k">Name</span>
              <span className="kv-v">{savedName || '—'}</span>
            </div>
            <div className="identity-row">
              <span className="kv-k">Born</span>
              <span className="kv-v">
                {profile.birthDate
                  ? new Date(profile.birthDate + 'T12:00:00').toLocaleDateString(undefined, {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })
                  : '—'}
              </span>
            </div>
            <div className="identity-row">
              <span className="kv-k">Age</span>
              <span className="kv-v">{profile.age}</span>
            </div>
            <div className="identity-row">
              <span className="kv-k">Height</span>
              <span className="kv-v">{profile.heightCm} cm</span>
            </div>
            <div className="identity-row">
              <span className="kv-k">Sex</span>
              <span className="kv-v">
                {profile.sex === 'female' ? 'Female' : 'Male'}
              </span>
            </div>
            <button
              type="button"
              className="btn name-action"
              style={{ marginTop: 10 }}
              onClick={() => {
                setNameDraft(displayName);
                setBirthDraft(profile.birthDate || '');
                setHeightDraft(String(profile.heightCm || ''));
                setSexDraft(profile.sex === 'female' ? 'female' : 'male');
                setEditingIdentity(true);
              }}
            >
              Edit
            </button>
          </div>
        )}
      </div>

      <div className="card">
        <h2>Weight</h2>
        <div className="metric-grid" style={{ marginBottom: 12 }}>
          <div className="metric">
            <div className="value">{weightDisplay.toFixed(1)}</div>
            <div className="label">Current {unit}</div>
          </div>
          <div className="metric">
            <div className="value">
              {weightLog.goalKg !== null
                ? toDisplayWeight(weightLog.goalKg, profile.units).toFixed(1)
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
        {toGoal !== null && weightLog.goalKg !== null && (
          <p className="hint" style={{ marginTop: 0 }}>
            {Math.abs(toGoal) < 0.05
              ? 'At your goal weight.'
              : toGoal > 0
                ? `${toDisplayWeight(toGoal, profile.units).toFixed(1)} ${unit} above goal.`
                : `${toDisplayWeight(-toGoal, profile.units).toFixed(1)} ${unit} below goal.`}
          </p>
        )}
        <p className="hint" style={{ marginTop: 0 }}>
          Weigh-ins update calorie estimates and appear on the History calendar.
          {weightLog.entries.length === 0
            ? ' No log yet — add your starting weight.'
            : ` ${weightLog.entries.length} logged reading${weightLog.entries.length === 1 ? '' : 's'}.`}
        </p>
        <button
          type="button"
          className="btn primary wide"
          onClick={() => setWeightOpen(true)}
        >
          {weightLog.entries.length === 0 ? 'Set up weight log' : 'Open weight log'}
        </button>
      </div>

      <div className="card">
        <h2>Heart rate zones</h2>
        <div className="field">
          <label htmlFor="maxhr">Maximum heart rate (bpm)</label>
          <input
            id="maxhr"
            type="text"
            inputMode="numeric"
            value={maxHrDraft}
            onChange={(e) => setMaxHrDraft(e.target.value)}
            onBlur={() => {
              const max = Number(maxHrDraft);
              if (Number.isFinite(max) && max > 0) set('maxHeartRate', max);
              else setMaxHrDraft(String(profile.maxHeartRate));
            }}
          />
          <p className="hint">
            Default estimate 220 − age ({estimateMaxHeartRate(profile.age)}). Override with a
            tested figure if you have one. Clear and retype freely — commits on blur.
          </p>
        </div>

        <div style={{ marginTop: 16 }}>
          {ZONES.map((zone) => {
            const range = zoneBounds(zone, profile.maxHeartRate);
            return (
              <div className="zone-row" key={zone.index}>
                <span className="swatch" style={{ background: zoneSwatch(zone) }} />
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
