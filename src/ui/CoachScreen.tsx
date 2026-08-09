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

function sessionTarget(s: PlanSession, units: Profile['units']): string {
  if (s.targetDistanceM) {
    return `${formatDistance(s.targetDistanceM, units)} ${distanceLabel(units)}`;
  }
  if (s.targetDurationMs) return formatDuration(s.targetDurationMs);
  return kindLabel(s.kind);
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
  const greeting = name ? `Coach for ${name}` : 'Coach';

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
      onToast('Could not start that plan.');
      return;
    }
    setActive(state);
    setBrowse(false);
    onToast(`Started: ${planById(planId)?.name ?? 'plan'}`);
    const { newly } = refreshAchievements(activities, profile);
    if (newly.length === 1) onToast(`Achievement: ${newly[0].title}`);
  };

  const stop = () => {
    clearPlan();
    setActive(null);
    onToast('Plan cleared.');
  };

  const toggle = (session: PlanSession) => {
    if (!active) return;
    setActive(toggleSessionComplete(active, session));
  };

  if (guideOpen) {
    return (
      <div className="screen coach-guide">
        <button type="button" className="back" onClick={() => setGuideOpen(false)}>
          ‹ Back
        </button>
        <h1>Understanding Coach</h1>
        <p className="subtitle">
          Short plain-language guide to the recovery numbers — not medical advice.
        </p>

        <div className="card">
          <h2>Why recovery matters</h2>
          <p className="hint" style={{ marginTop: 0 }}>
            Hard training only works if the body adapts between sessions. Too much hard work
            stacked too close together raises injury risk and makes the next run feel flat.
            Easy days and sleep are part of the plan, not a break from it.
          </p>
          <ul className="coach-guide-list">
            <li>
              <strong>Fresh</strong> — room for a quality session if you feel good.
            </li>
            <li>
              <strong>Balanced</strong> — keep most running easy; hard days are planned.
            </li>
            <li>
              <strong>Loaded / High</strong> — ease volume and intensity until you bounce back.
            </li>
          </ul>
        </div>

        <div className="card">
          <h2>7-day load</h2>
          <p className="hint" style={{ marginTop: 0 }}>
            How much training stress you have piled up in the <strong>last week</strong>. It
            scores each run from time and effort (heart rate when available, otherwise pace).
            Higher means more recent work — not “good” or “bad” by itself.
          </p>
        </div>

        <div className="card">
          <h2>Base load</h2>
          <p className="hint" style={{ marginTop: 0 }}>
            Your recent <strong>average weekly load</strong> (about the last four weeks). Think of
            it as your fitness “normal.” New runners with little history will see a small base —
            that is expected.
          </p>
        </div>

        <div className="card">
          <h2>Acute : chronic</h2>
          <p className="hint" style={{ marginTop: 0 }}>
            The ratio of <strong>this week’s load ÷ your base</strong>. Roughly:
          </p>
          <ul className="coach-guide-list">
            <li>
              <strong>Under ~0.8</strong> — lighter than usual (fresh / taper).
            </li>
            <li>
              <strong>~0.8–1.3</strong> — steady build.
            </li>
            <li>
              <strong>Above ~1.5</strong> — a sharp jump; classic risk window if volume is high.
            </li>
          </ul>
          <p className="hint">
            With only a few easy runs, a high ratio can look scary while absolute load is still
            low. RunLog only flags “high load” when the base is solid enough — still use how you
            feel.
          </p>
        </div>

        <div className="card">
          <h2>Weekly distance &amp; records</h2>
          <p className="hint" style={{ marginTop: 0 }}>
            Simple totals and personal bests from runs saved on this device. The weekly goal bar
            (if you set one in Profile) is a distance target, separate from load.
          </p>
        </div>

        <div className="card">
          <h2>Training plans</h2>
          <p className="hint" style={{ marginTop: 0 }}>
            Multi-week templates you tick by hand. They guide structure; they do not auto-read
            your GPS and invent sessions.
          </p>
        </div>

        <button type="button" className="btn primary wide" onClick={() => setGuideOpen(false)}>
          Got it
        </button>
      </div>
    );
  }

  return (
    <div className="screen">
      <h1>{greeting}</h1>
      <p className="subtitle">
        Plans, recovery, and training notes — still all on this device
        {streak > 0 ? ` · ${streak}-day streak` : ''}.
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
              <b>{recoveryLabel(load.status).slice(0, 3).toUpperCase()}</b>
              <span>Load</span>
            </span>
          </div>
          <div className="recovery-copy">
            <span className={`pill ${statusClass(load.status)}`}>{recoveryLabel(load.status)}</span>
            <h2 className="recovery-title">Recovery</h2>
            {recoveryTips.slice(0, 1).map((tip, i) => (
              <p className="hint" key={i} style={{ marginTop: 6, marginBottom: 0 }}>
                {tip.body}
              </p>
            ))}
          </div>
        </div>
        {recoveryTips.length > 1 &&
          recoveryTips.slice(1).map((tip, i) => (
            <p className="hint" key={`more-${i}`} style={{ marginTop: 10, marginBottom: 0 }}>
              {tip.body}
            </p>
          ))}
        <div className="metric-grid recovery-metrics" style={{ marginTop: 14 }}>
          <div className="metric">
            <div className="value">{Math.round(load.acute)}</div>
            <div className="label">7-day load</div>
          </div>
          <div className="metric">
            <div className="value">{Math.round(load.chronic)}</div>
            <div className="label">Base load</div>
          </div>
          <div className="metric">
            <div className="value">
              {load.ratio !== null ? load.ratio.toFixed(2) : '—'}
            </div>
            <div className="label">Acute:chronic</div>
          </div>
        </div>
        <p className="hint">
          Load is a simple score from time and effort (HR when available). It is a guide, not a
          medical reading.
        </p>
        <button
          type="button"
          className="btn wide"
          style={{ marginTop: 12 }}
          onClick={() => setGuideOpen(true)}
        >
          What do these numbers mean?
        </button>
      </div>

      {/* Active plan */}
      <div className="card">
        <div className="row">
          <h2 style={{ margin: 0 }}>Training plan</h2>
          {active && plan && (
            <button type="button" className="btn" onClick={stop}>
              End plan
            </button>
          )}
        </div>

        {!active || !plan ? (
          <>
            <p className="hint" style={{ marginTop: 10 }}>
              Pick a simple multi-week plan. Tick sessions when you complete them — the coach does
              not invent workouts from GPS alone.
            </p>
            {!browse ? (
              <button
                type="button"
                className="btn primary wide"
                style={{ marginTop: 8 }}
                onClick={() => setBrowse(true)}
              >
                Browse plans
              </button>
            ) : (
              <div className="plan-list">
                {PLAN_TEMPLATES.map((p) => (
                  <div className="plan-card" key={p.id}>
                    <div className="row">
                      <strong>{p.name}</strong>
                      <span className="pill">{p.weeks} wk</span>
                    </div>
                    <p className="hint" style={{ marginTop: 6 }}>
                      {p.blurb}
                    </p>
                    <button
                      type="button"
                      className="btn primary wide"
                      style={{ marginTop: 8 }}
                      onClick={() => start(p.id)}
                    >
                      Start this plan
                    </button>
                  </div>
                ))}
                <button type="button" className="btn wide" onClick={() => setBrowse(false)}>
                  Cancel
                </button>
              </div>
            )}
          </>
        ) : (
          <>
            <p className="goal-summary" style={{ marginTop: 10 }}>
              {plan.name}
            </p>
            <p className="hint">
              Week {planWeek + 1} of {plan.weeks}
              {progress ? ` · ${progress.done}/${progress.total} sessions this week` : ''}
            </p>
            <div className="goal-bar" style={{ marginTop: 8 }}>
              <span style={{ width: `${Math.min(100, overall * 100)}%` }} />
            </div>
            <p className="hint">{Math.round(overall * 100)}% of plan ticked off</p>

            {upcoming && (
              <div className="next-session next-session-hero">
                <div className="next-session-label">Next session</div>
                <div className="row">
                  <span className="pill">{kindLabel(upcoming.kind)}</span>
                  <span className="hint" style={{ margin: 0 }}>
                    {dayName(upcoming.dayOfWeek)}
                    {upcoming.week !== planWeek ? ` · week ${upcoming.week + 1}` : ''}
                  </span>
                </div>
                <strong>{upcoming.title}</strong>
                <p className="hint" style={{ marginBottom: 8 }}>
                  {upcoming.blurb} · {sessionTarget(upcoming, profile.units)}
                </p>
                {onStartRun && (
                  <button type="button" className="btn primary wide" onClick={onStartRun}>
                    Go to Run
                  </button>
                )}
              </div>
            )}

            <h3 className="coach-subhead">This week</h3>
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
                          {dayName(s.dayOfWeek)} · {s.title}
                        </span>
                        <span className="meta">
                          {kindLabel(s.kind)} · {sessionTarget(s, profile.units)}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <p className="hint">Tap a session to mark it complete.</p>
          </>
        )}
      </div>

      {/* Coach notes */}
      {weekTips.length > 0 && (
        <div className="card">
          <h2>Coach notes</h2>
          {weekTips.map((tip, i) => (
            <div className={`tip ${tip.tone}`} key={i}>
              <div className="title">{tip.title}</div>
              <div className="body">{tip.body}</div>
            </div>
          ))}
        </div>
      )}

      {/* Volume (former dashboard) */}
      <div className="card">
        <h2>This week</h2>
        <div className="metric-grid">
          <div className="metric">
            <div className="value">{formatDistance(thisWeek.distanceM, profile.units, 1)}</div>
            <div className="label">{distanceLabel(profile.units)}</div>
          </div>
          <div className="metric">
            <div className="value">{formatDuration(thisWeek.durationMs)}</div>
            <div className="label">Time</div>
          </div>
          <div className="metric">
            <div className="value">{formatPace(thisWeek.paceSecondsPerUnit)}</div>
            <div className="label">Avg {paceLabel(profile.units)}</div>
          </div>
        </div>
        {profile.weeklyGoalM > 0 && (
          <>
            <div className="zone-row" style={{ marginTop: 16, marginBottom: 4 }}>
              <span className="name" style={{ width: 'auto' }}>
                Goal
              </span>
              <span className="track">
                <span style={{ width: `${goalShare * 100}%`, background: 'var(--accent)' }} />
              </span>
              <span className="time">{Math.round(goalShare * 100)}%</span>
            </div>
            <p className="hint">
              {formatDistance(thisWeek.distanceM, profile.units, 1)} of{' '}
              {formatDistance(profile.weeklyGoalM, profile.units, 1)}{' '}
              {distanceLabel(profile.units)} this week
            </p>
          </>
        )}
        <p className="hint" style={{ marginBottom: 0 }}>
          {allTime.runs} run{allTime.runs === 1 ? '' : 's'} ·{' '}
          {formatDistance(allTime.distanceM, profile.units, 1)} {distanceLabel(profile.units)} all
          time
        </p>
      </div>

      <div className="card">
        <h2>Last 12 weeks</h2>
        <WeeklyBars weeks={weeks} units={profile.units} />
      </div>

      <div className="card">
        <h2>Personal records</h2>
        {records.every((r) => r.durationMs === null) ? (
          <p className="hint">
            Records come from GPS runs — the fastest continuous stretch inside any run.
          </p>
        ) : (
          records
            .filter((record) => record.durationMs !== null)
            .map((record) => (
              <div className="row" key={record.label}>
                <span>{record.label}</span>
                <span style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <strong>{formatDuration(record.durationMs!)}</strong>
                  {record.activityId && (
                    <button
                      type="button"
                      className="pill"
                      onClick={() => onOpen(record.activityId!)}
                      style={{ cursor: 'pointer' }}
                    >
                      View
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
