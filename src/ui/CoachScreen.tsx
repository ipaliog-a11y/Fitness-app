/**
 * Coach home: recovery, training plans, weekly notes, and the old dashboard
 * volume / records view so training advice has one place to live.
 */

import { useMemo, useState, type CSSProperties } from 'react';
import type { Activity } from '../core/activity';
import { refreshAchievements } from '../core/achievements';
import { tipsForRecovery, tipsForWeek } from '../core/coach';
import {
  loadSnapshot,
  recoveryLabel,
  type RecoveryStatus,
} from '../core/load';
import {
  PLAN_TEMPLATES,
  clearPlan,
  currentPlanWeek,
  dayName,
  isSessionComplete,
  kindLabel,
  loadActivePlan,
  nextSession,
  planById,
  planOverallProgress,
  sessionsForWeek,
  startPlan,
  toggleSessionComplete,
  weekProgress,
  type ActivePlanState,
  type PlanSession,
  type PlanTemplate,
} from '../core/plans';
import type { Profile } from '../core/settings';
import {
  activitiesBetween,
  addWeeks,
  currentStreak,
  personalRecords,
  startOfWeek,
  totals,
  weeklyBuckets,
} from '../core/stats';
import {
  distanceLabel,
  formatDistance,
  formatDuration,
  formatPace,
  paceLabel,
} from '../core/units';
import { WeeklyBars } from './charts';
import type { MessageKey } from '../i18n';
import { useLocale, useT, useTipText } from '../i18n/react';

interface Props {
  activities: Activity[];
  profile: Profile;
  onOpen(id: string): void;
  onToast(message: string): void;
  /** Jump to Run tab so the athlete can start today’s session. */
  onStartRun?(): void;
  /** Controlled recovery guide (also closed by Android back). */
  guideOpen?: boolean;
  onGuideOpenChange?(open: boolean): void;
}

function statusClass(status: RecoveryStatus): string {
  switch (status) {
    case 'fresh':
      return 'good';
    case 'balanced':
      return 'good';
    case 'loaded':
      return 'warn';
    case 'high':
      return 'bad';
    default:
      return '';
  }
}

/** Short ring label — slice(0,3) made "High load" → "HIG" and looked broken on HUD. */
function recoveryRingLabel(status: RecoveryStatus): MessageKey {
  switch (status) {
    case 'fresh':
      return 'coach.ring.fresh';
    case 'balanced':
      return 'coach.ring.ok';
    case 'loaded':
      return 'coach.ring.load';
    case 'high':
      return 'coach.ring.high';
    default:
      return 'coach.ring.none';
  }
}

function sessionTarget(
  s: PlanSession,
  units: Profile['units'],
  t: (key: MessageKey) => string,
): string {
  if (s.targetDistanceM) {
    return `${formatDistance(s.targetDistanceM, units)} ${distanceLabel(units)}`;
  }
  if (s.targetDurationMs) return formatDuration(s.targetDurationMs);
  return t(kindLabel(s.kind));
}

export function CoachScreen({
  activities,
  profile,
  onOpen,
  onToast,
  onStartRun,
  guideOpen: guideOpenProp,
  onGuideOpenChange,
}: Props) {
  const tipText = useTipText();
  const t = useT();
  const { tag } = useLocale();
  const now = Date.now();
  const [active, setActive] = useState<ActivePlanState | null>(() => loadActivePlan());
  const [browse, setBrowse] = useState(false);
  const [guideLocal, setGuideLocal] = useState(false);
  const guideOpen = guideOpenProp ?? guideLocal;
  const setGuideOpen = (open: boolean) => {
    if (onGuideOpenChange) onGuideOpenChange(open);
    else setGuideLocal(open);
  };

  const name = (profile.displayName ?? '').trim();
  const greeting = name ? t('coach.titleFor', { name }) : t('coach.title');

  const load = useMemo(
    () => loadSnapshot(activities, now, profile.maxHeartRate),
    [activities, now, profile.maxHeartRate],
  );

  const weekTips = useMemo(
    () =>
      tipsForWeek(activities, {
        units: profile.units,
        maxHeartRate: profile.maxHeartRate,
        weeklyGoalM: profile.weeklyGoalM,
        now,
      }),
    [activities, profile, now],
  );

  const recoveryTips = useMemo(
    () =>
      tipsForRecovery(activities, {
        units: profile.units,
        maxHeartRate: profile.maxHeartRate,
        weeklyGoalM: profile.weeklyGoalM,
        now,
      }),
    [activities, profile, now],
  );

  const weekStart = startOfWeek(now);
  const thisWeek = totals(
    activitiesBetween(activities, weekStart, addWeeks(weekStart, 1)),
    profile.units,
  );
  const allTime = totals(activities, profile.units);
  const weeks = weeklyBuckets(activities, 12, now);
  const records = personalRecords(activities);
  const streak = currentStreak(activities, now);
  const goalShare =
    profile.weeklyGoalM > 0 ? Math.min(thisWeek.distanceM / profile.weeklyGoalM, 1) : 0;

  const plan: PlanTemplate | null = active ? planById(active.planId) : null;
  const planWeek = plan && active ? currentPlanWeek(active, plan, now) : 0;
  const weekSessions = plan ? sessionsForWeek(plan, planWeek) : [];
  const progress = plan && active ? weekProgress(active, plan, planWeek) : null;
  const overall = plan && active ? planOverallProgress(active, plan) : 0;
  const upcoming = plan && active ? nextSession(active, plan, now) : null;

  const start = (planId: string) => {
    const state = startPlan(planId, now);
    if (!state) {
      onToast(t('coach.planStartFailed'));
      return;
    }
    setActive(state);
    setBrowse(false);
    const started = planById(planId);
    onToast(t('coach.planStarted', { name: started ? t(started.name) : t('coach.planFallback') }));
    const { newly } = refreshAchievements(activities, profile);
    if (newly.length === 1) onToast(t('toast.achievement.one', { name: t(newly[0].title) }));
  };

  const stop = () => {
    clearPlan();
    setActive(null);
    onToast(t('coach.planCleared'));
  };

  const toggle = (session: PlanSession) => {
    if (!active) return;
    setActive(toggleSessionComplete(active, session));
  };

  if (guideOpen) {
    return (
      <div className="screen coach-guide">
        <button type="button" className="back" onClick={() => setGuideOpen(false)}>
          ‹ {t('common.back')}
        </button>
        <h1>{t('coach.guide.title')}</h1>
        <p className="subtitle">{t('coach.guide.subtitle')}</p>

        <div className="card">
          <h2>{t('coach.guide.whyTitle')}</h2>
          <p className="hint" style={{ marginTop: 0 }}>
            {t('coach.guide.whyBody')}
          </p>
          <ul className="coach-guide-list">
            <li>
              <strong>{t('recovery.fresh.label')}</strong> — {t('coach.guide.freshNote')}
            </li>
            <li>
              <strong>{t('recovery.balanced.label')}</strong> — {t('coach.guide.balancedNote')}
            </li>
            <li>
              <strong>{t('coach.guide.loadedHigh')}</strong> — {t('coach.guide.loadedNote')}
            </li>
          </ul>
        </div>

        <div className="card">
          <h2>{t('coach.sevenDay')}</h2>
          <p className="hint" style={{ marginTop: 0 }}>
            {t('coach.guide.sevenDayBody')}
          </p>
        </div>

        <div className="card">
          <h2>{t('coach.baseLoad')}</h2>
          <p className="hint" style={{ marginTop: 0 }}>{t('coach.guide.baseBody')}</p>
        </div>

        <div className="card">
          <h2>{t('coach.guide.acuteTitle')}</h2>
          <p className="hint" style={{ marginTop: 0 }}>{t('coach.guide.acuteIntro')}</p>
          <ul className="coach-guide-list">
            <li>
              <strong>{t('coach.guide.under08')}</strong> — {t('coach.guide.under08Note')}
            </li>
            <li>
              <strong>~0.8–1.3</strong> — {t('coach.guide.steadyNote')}
            </li>
            <li>
              <strong>{t('coach.guide.above15')}</strong> — {t('coach.guide.above15Note')}
            </li>
          </ul>
          <p className="hint">
            {t('coach.guide.ratioCaveat')}
          </p>
        </div>

        <div className="card">
          <h2>{t('coach.guide.weeklyTitle')}</h2>
          <p className="hint" style={{ marginTop: 0 }}>{t('coach.guide.weeklyBody')}</p>
        </div>

        <div className="card">
          <h2>{t('coach.guide.plansTitle')}</h2>
          <p className="hint" style={{ marginTop: 0 }}>{t('coach.guide.plansBody')}</p>
        </div>

        <button type="button" className="btn primary wide" onClick={() => setGuideOpen(false)}>
          {t('coach.guide.gotIt')}
        </button>
      </div>
    );
  }

  return (
    <div className="screen">
      <h1>{greeting}</h1>
      <p className="subtitle">
        {t('coach.subtitle')}
        {streak > 0 ? ` · ${t('stats.streak', { count: streak })}` : ''}.
      </p>

      {/* Recovery / load — hero layout (ring on HUD theme via CSS) */}
      <div className={`card recovery-hero status-${load.status}`}>
        <div className="recovery-hero-main">
          <div
            className="recovery-ring"
            style={
              {
                '--ring-pct': `${Math.min(100, Math.round((load.ratio ?? 1) * 50))}%`,
              } as CSSProperties
            }
            aria-hidden
          >
            <span className="recovery-ring-inner">
              <b>{t(recoveryRingLabel(load.status))}</b>
              <span>{t('coach.ringLoad')}</span>
            </span>
          </div>
          <div className="recovery-copy">
            <span className={`pill ${statusClass(load.status)}`}>{t(recoveryLabel(load.status))}</span>
            <h2 className="recovery-title">{t('achievement.category.recovery')}</h2>
            {recoveryTips.slice(0, 1).map((tip, i) => (
              <p className="hint" key={i} style={{ marginTop: 6, marginBottom: 0 }}>
                {tipText(tip).body}
              </p>
            ))}
          </div>
        </div>
        {recoveryTips.length > 1 &&
          recoveryTips.slice(1).map((tip, i) => (
            <p className="hint" key={`more-${i}`} style={{ marginTop: 10, marginBottom: 0 }}>
              {tipText(tip).body}
            </p>
          ))}
        <div className="metric-grid recovery-metrics" style={{ marginTop: 14 }}>
          <div className="metric">
            <div className="value">{Math.round(load.acute)}</div>
            <div className="label">{t('coach.sevenDay')}</div>
          </div>
          <div className="metric">
            <div className="value">{Math.round(load.chronic)}</div>
            <div className="label">{t('coach.baseLoad')}</div>
          </div>
          <div className="metric">
            <div className="value">
              {load.ratio !== null ? load.ratio.toFixed(2) : '—'}
            </div>
            <div className="label">{t('coach.acuteChronic')}</div>
          </div>
        </div>
        <p className="hint">
          {t('coach.loadNote')}
        </p>
        <button
          type="button"
          className="btn wide"
          style={{ marginTop: 12 }}
          onClick={() => setGuideOpen(true)}
        >
          {t('coach.explainNumbers')}
        </button>
      </div>

      {/* Active plan */}
      <div className="card">
        <div className="row">
          <h2 style={{ margin: 0 }}>{t('coach.planTitle')}</h2>
          {active && plan && (
            <button type="button" className="btn" onClick={stop}>
              {t('coach.endPlan')}
            </button>
          )}
        </div>

        {!active || !plan ? (
          <>
            <p className="hint" style={{ marginTop: 10 }}>
              {t('coach.planPitch')}
            </p>
            {!browse ? (
              <button
                type="button"
                className="btn primary wide"
                style={{ marginTop: 8 }}
                onClick={() => setBrowse(true)}
              >
                {t('coach.browsePlans')}
              </button>
            ) : (
              <div className="plan-list">
                {PLAN_TEMPLATES.map((p) => (
                  <div className="plan-card" key={p.id}>
                    <div className="row">
                      <strong>{t(p.name)}</strong>
                      <span className="pill">{t('coach.planWeeks', { count: p.weeks })}</span>
                    </div>
                    <p className="hint" style={{ marginTop: 6 }}>
                      {t(p.blurb)}
                    </p>
                    <button
                      type="button"
                      className="btn primary wide"
                      style={{ marginTop: 8 }}
                      onClick={() => start(p.id)}
                    >
                      {t('coach.startPlan')}
                    </button>
                  </div>
                ))}
                <button type="button" className="btn wide" onClick={() => setBrowse(false)}>
                  {t('common.cancel')}
                </button>
              </div>
            )}
          </>
        ) : (
          <>
            <p className="goal-summary" style={{ marginTop: 10 }}>
              {t(plan.name)}
            </p>
            <p className="hint">
              {t('coach.weekOf', { week: planWeek + 1, total: plan.weeks })}
              {progress
                ? ` · ${t('coach.sessionsThisWeek', { done: progress.done, total: progress.total })}`
                : ''}
            </p>
            <div className="goal-bar" style={{ marginTop: 8 }}>
              <span style={{ width: `${Math.min(100, overall * 100)}%` }} />
            </div>
            <p className="hint">
              {t('coach.planTicked', { percent: Math.round(overall * 100) })}
            </p>

            {upcoming && (
              <div className="next-session next-session-hero">
                <div className="next-session-label">{t('coach.nextSession')}</div>
                <div className="row">
                  <span className="pill">{t(kindLabel(upcoming.kind))}</span>
                  <span className="hint" style={{ margin: 0 }}>
                    {dayName(upcoming.dayOfWeek, tag)}
                    {upcoming.week !== planWeek
                      ? ` · ${t('coach.weekN', { week: upcoming.week + 1 })}`
                      : ''}
                  </span>
                </div>
                <strong>{t(upcoming.title)}</strong>
                <p className="hint" style={{ marginBottom: 8 }}>
                  {t(upcoming.blurb, upcoming.blurbVars)} ·{' '}
                  {sessionTarget(upcoming, profile.units, t)}
                </p>
                {onStartRun && (
                  <button type="button" className="btn primary wide" onClick={onStartRun}>
                    {t('coach.goToRun')}
                  </button>
                )}
              </div>
            )}

            <h3 className="coach-subhead">{t('stats.thisWeek')}</h3>
            <ul className="plan-session-list">
              {weekSessions.map((s) => {
                const done = isSessionComplete(active, s);
                return (
                  <li key={`${s.week}-${s.dayOfWeek}-${s.title}`}>
                    <button
                      type="button"
                      className={`plan-session${done ? ' done' : ''}`}
                      onClick={() => toggle(s)}
                    >
                      <span className="check" aria-hidden>
                        {done ? '✓' : '○'}
                      </span>
                      <span className="body">
                        <span className="headline">
                          {dayName(s.dayOfWeek, tag)} · {t(s.title)}
                        </span>
                        <span className="meta">
                          {t(kindLabel(s.kind))} · {sessionTarget(s, profile.units, t)}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <p className="hint">{t('coach.tapSession')}</p>
          </>
        )}
      </div>

      {/* Coach notes */}
      {weekTips.length > 0 && (
        <div className="card">
          <h2>{t('coach.notes')}</h2>
          {weekTips.map((tip, i) => (
            <div className={`tip ${tip.tone}`} key={i}>
              <div className="title">{tipText(tip).title}</div>
              <div className="body">{tipText(tip).body}</div>
            </div>
          ))}
        </div>
      )}

      {/* Volume (former dashboard) */}
      <div className="card">
        <h2>{t('stats.thisWeek')}</h2>
        <div className="metric-grid">
          <div className="metric">
            <div className="value">{formatDistance(thisWeek.distanceM, profile.units, 1)}</div>
            <div className="label">{distanceLabel(profile.units)}</div>
          </div>
          <div className="metric">
            <div className="value">{formatDuration(thisWeek.durationMs)}</div>
            <div className="label">{t('stats.time')}</div>
          </div>
          <div className="metric">
            <div className="value">{formatPace(thisWeek.paceSecondsPerUnit)}</div>
            <div className="label">{t('common.avgOf', { unit: paceLabel(profile.units) })}</div>
          </div>
        </div>
        {profile.weeklyGoalM > 0 && (
          <>
            <div className="zone-row" style={{ marginTop: 16, marginBottom: 4 }}>
              {/* Lone row, no bars to line up with, so it sizes to its label. */}
              <span className="name" style={{ flex: '0 0 auto' }}>
                {t('stats.goal')}
              </span>
              <span className="track">
                <span style={{ width: `${goalShare * 100}%`, background: 'var(--accent)' }} />
              </span>
              <span className="time">{Math.round(goalShare * 100)}%</span>
            </div>
            <p className="hint">
              {t('stats.goalProgress', {
                distance: formatDistance(thisWeek.distanceM, profile.units, 1),
                goal: formatDistance(profile.weeklyGoalM, profile.units, 1),
                unit: distanceLabel(profile.units),
              })}
            </p>
          </>
        )}
        <p className="hint" style={{ marginBottom: 0 }}>
          {t('stats.subtitle', {
            count: allTime.runs,
            runs: allTime.runs,
            distance: formatDistance(allTime.distanceM, profile.units, 1),
            unit: distanceLabel(profile.units),
          })}
        </p>
      </div>

      <div className="card">
        <h2>{t('stats.last12')}</h2>
        <WeeklyBars weeks={weeks} units={profile.units} />
      </div>

      <div className="card">
        <h2>{t('stats.records')}</h2>
        {records.every((r) => r.durationMs === null) ? (
          <p className="hint">{t('stats.recordsHint')}</p>
        ) : (
          records
            .filter((record) => record.durationMs !== null)
            .map((record) => (
              <div className="row" key={record.label}>
                {/* A MessageKey, not a label — rendering it bare printed
                    "record.1km" to anyone who had actually set a record. */}
                <span>{t(record.label)}</span>
                <span style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <strong>{formatDuration(record.durationMs!)}</strong>
                  {record.activityId && (
                    <button
                      type="button"
                      className="pill"
                      onClick={() => onOpen(record.activityId!)}
                      style={{ cursor: 'pointer' }}
                    >
                      {t('common.view')}
                    </button>
                  )}
                </span>
              </div>
            ))
        )}
      </div>
    </div>
  );
}
