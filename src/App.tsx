/**
 * The shell: which screen is showing, and the one copy of the data they share.
 *
 * State lives here rather than in a store library. There is one user, five
 * screens (Run, History, Coach, Profile, Settings) and a single list of runs.
 * Weight lives under Profile, not as a sixth tab.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Activity } from './core/activity';
import { byNewest } from './core/activity';
import { allActivities, deleteActivity, saveActivity } from './core/db';
import { applyTheme, loadProfile, saveProfile, sanitise, type Profile } from './core/settings';
import { addDistanceToShoe, loadShoes, saveShoes, shoeNeedsWarning } from './core/shoes';
import { refreshAchievements } from './core/achievements';
import { syncLifetime } from './core/lifetime';
import { exitApp, listenHardwareBack, minimizeApp } from './platform/appBack';
import { hapticChange } from './platform/haptics';
import {
  bootstrapPermissions,
  hideNativeSplash,
} from './platform/permissions';
import { CoachScreen } from './ui/CoachScreen';
import { DetailScreen } from './ui/DetailScreen';
import { HistoryScreen } from './ui/HistoryScreen';
import { ProfileScreen } from './ui/ProfileScreen';
import { RunScreen } from './ui/RunScreen';
import { SettingsScreen } from './ui/SettingsScreen';
import { SplashScreen } from './ui/SplashScreen';

type Tab = 'run' | 'history' | 'coach' | 'profile' | 'settings';

const TABS: Array<{ id: Tab; label: string; short: string; icon: string }> = [
  {
    id: 'run',
    label: 'Run',
    short: 'Run',
    icon: 'M12 5v14M5 12h14', // plus-like play via circle fill in CSS; path is play triangle below
  },
  {
    id: 'history',
    label: 'History',
    short: 'Hist',
    icon: 'M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01',
  },
  {
    id: 'coach',
    label: 'Coach',
    short: 'Coach',
    icon: 'M12 20a8 8 0 1 0-8-8M12 8v4l3 2',
  },
  {
    id: 'profile',
    label: 'Profile',
    short: 'You',
    icon: 'M12 8a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM5 19c1.5-3.5 4-5 7-5s5.5 1.5 7 5',
  },
  {
    id: 'settings',
    label: 'Settings',
    short: 'Set',
    icon: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4',
  },
];

function TabIcon({ id }: { id: Tab }) {
  if (id === 'run') {
    return (
      <svg className="tab-icon" viewBox="0 0 24 24" aria-hidden>
        <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path d="M10 8.5l6 3.5-6 3.5z" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  const path = TABS.find((t) => t.id === id)?.icon ?? '';
  return (
    <svg className="tab-icon" viewBox="0 0 24 24" aria-hidden>
      <path
        d={path}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const SPLASH_MIN_MS = 1000;

export function App() {
  const [tab, setTab] = useState<Tab>('run');
  const [activities, setActivities] = useState<Activity[]>([]);
  const [profile, setProfile] = useState<Profile>(() => loadProfile());
  const [openId, setOpenId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  // True while a run is armed or in progress. The Run screen stays mounted so
  // switching tabs does not tear down sensors or the clock.
  const [runLive, setRunLive] = useState(false);
  /** Bumps History calendar when weight log changes. */
  const [weightTick, setWeightTick] = useState(0);
  /** False until splash branding + permission bootstrap finish. */
  const [bootReady, setBootReady] = useState(false);
  const [bootStatus, setBootStatus] = useState('Getting ready…');
  /** Coach recovery guide overlay. */
  const [coachGuideOpen, setCoachGuideOpen] = useState(false);
  /**
   * After finishing a run the detail screen is locked until Save or Delete so
   * a stray tab tap cannot abandon the results flow.
   */
  const [resultDecisionLock, setResultDecisionLock] = useState(false);

  /** Run screen consumes hardware back (picker / Get ready). */
  const runBackHandlerRef = useRef<(() => boolean) | null>(null);
  /** Second-press window for exit or minimize. */
  const pendingBackActionRef = useRef<null | 'exit' | 'minimize'>(null);
  const pendingBackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reload = useCallback(() => {
    void allActivities().then(setActivities);
  }, []);

  useEffect(reload, [reload]);

  // Cold-start splash: logo + version, then prime OS permissions up front.
  useEffect(() => {
    let cancelled = false;
    const started = Date.now();

    void (async () => {
      await hideNativeSplash();
      try {
        await bootstrapPermissions((p) => {
          if (!cancelled) setBootStatus(p.label);
        });
      } catch {
        if (!cancelled) setBootStatus('Ready');
      }
      const elapsed = Date.now() - started;
      const remaining = Math.max(0, SPLASH_MIN_MS - elapsed);
      if (remaining > 0) {
        await new Promise((r) => setTimeout(r, remaining));
      }
      if (!cancelled) setBootReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const showToast = useCallback((message: string) => {
    setToast(message);
    setTimeout(() => setToast((current) => (current === message ? null : current)), 3500);
  }, []);

  const clearPendingBack = useCallback(() => {
    pendingBackActionRef.current = null;
    if (pendingBackTimerRef.current) {
      clearTimeout(pendingBackTimerRef.current);
      pendingBackTimerRef.current = null;
    }
  }, []);

  const armPendingBack = useCallback(
    (kind: 'exit' | 'minimize', toast: string) => {
      pendingBackActionRef.current = kind;
      if (pendingBackTimerRef.current) clearTimeout(pendingBackTimerRef.current);
      pendingBackTimerRef.current = setTimeout(() => {
        pendingBackActionRef.current = null;
        pendingBackTimerRef.current = null;
      }, 2000);
      showToast(toast);
    },
    [showToast],
  );

  // Android system back.
  useEffect(() => {
    if (!bootReady) return;
    let dispose: (() => void) | undefined;
    let cancelled = false;

    void listenHardwareBack(() => {
      // Post-run results: only Save / Delete may leave.
      if (resultDecisionLock && openId) {
        clearPendingBack();
        showToast('Choose Save or Delete to continue');
        return;
      }
      // 1) Nested overlays first
      if (openId) {
        clearPendingBack();
        setOpenId(null);
        return;
      }
      if (coachGuideOpen) {
        clearPendingBack();
        setCoachGuideOpen(false);
        return;
      }
      // 2) Any other tab → Run
      if (tab !== 'run') {
        clearPendingBack();
        setTab('run');
        void hapticChange();
        return;
      }
      // 3) Run screen internal (workout picker / Get ready)
      if (runBackHandlerRef.current?.()) {
        clearPendingBack();
        return;
      }
      // 4) Live run: double-back minimizes
      if (runLive) {
        if (pendingBackActionRef.current === 'minimize') {
          clearPendingBack();
          void minimizeApp();
          return;
        }
        armPendingBack('minimize', 'Press again to minimize');
        return;
      }
      // 5) Idle Run tab: double-back exits
      if (pendingBackActionRef.current === 'exit') {
        clearPendingBack();
        void exitApp();
        return;
      }
      armPendingBack('exit', 'Press again to exit');
    }).then((d) => {
      if (cancelled) d();
      else dispose = d;
    });

    return () => {
      cancelled = true;
      dispose?.();
      clearPendingBack();
    };
  }, [
    bootReady,
    openId,
    resultDecisionLock,
    coachGuideOpen,
    tab,
    runLive,
    armPendingBack,
    clearPendingBack,
    showToast,
  ]);

  const changeProfile = useCallback((next: Profile) => {
    // Always re-sanitise so a partial write never leaves the UI with missing
    // fields (e.g. displayName) that crash the Profile screen on .trim().
    const clean = sanitise(next);
    setProfile((prev) => {
      const changed =
        prev.theme !== clean.theme ||
        prev.units !== clean.units ||
        prev.audioCues !== clean.audioCues ||
        prev.haptics !== clean.haptics ||
        prev.autoPause !== clean.autoPause ||
        prev.keepAwake !== clean.keepAwake ||
        prev.liveMapTiles !== clean.liveMapTiles ||
        prev.mapStyle !== clean.mapStyle ||
        prev.displayName !== clean.displayName ||
        prev.birthDate !== clean.birthDate ||
        prev.age !== clean.age ||
        prev.heightCm !== clean.heightCm ||
        prev.weightKg !== clean.weightKg ||
        prev.sex !== clean.sex ||
        prev.maxHeartRate !== clean.maxHeartRate ||
        prev.strideM !== clean.strideM ||
        prev.footpodCalibration !== clean.footpodCalibration ||
        prev.weeklyGoalM !== clean.weeklyGoalM;
      if (changed) void hapticChange();
      return clean;
    });
    saveProfile(clean);
    applyTheme(clean.theme);
  }, []);

  useEffect(() => {
    applyTheme(profile.theme);
  }, [profile.theme]);

  const handleFinish = useCallback(
    async (activity: Activity) => {
      // A run with nothing in it is a mis-tap, not a workout worth keeping.
      if (activity.distanceM < 10 && activity.durationMs < 30_000) {
        showToast('Run discarded — too short to keep.');
        return;
      }
      await saveActivity(activity);
      if (activity.shoeId) {
        const shoes = addDistanceToShoe(loadShoes(), activity.shoeId, activity.distanceM);
        saveShoes(shoes);
        const shoe = shoes.find((s) => s.id === activity.shoeId);
        if (shoe && shoeNeedsWarning(shoe)) {
          showToast(`${shoe.name} has reached its wear limit.`);
        }
      }
      const nextList = [activity, ...activities].sort(byNewest);
      setActivities(nextList);
      syncLifetime(nextList);
      const { newly } = refreshAchievements(nextList, profile);
      if (newly.length === 1) showToast(`Achievement: ${newly[0].title}`);
      else if (newly.length > 1) showToast(`${newly.length} new achievements unlocked`);
      setOpenId(activity.id);
      setTab('history');
      setResultDecisionLock(true);
    },
    [showToast, activities, profile],
  );

  const handleDelete = useCallback(async (id: string) => {
    await deleteActivity(id);
    const nextList = activities.filter((a) => a.id !== id);
    setActivities(nextList);
    syncLifetime(nextList);
    refreshAchievements(nextList, profile);
    setOpenId(null);
    setResultDecisionLock(false);
  }, [activities, profile]);

  const handleNote = useCallback(async (id: string, note: string) => {
    setActivities((current) => {
      const next = current.map((a) => (a.id === id ? { ...a, note } : a));
      const updated = next.find((a) => a.id === id);
      if (updated) void saveActivity(updated);
      // Notes can unlock the note-taker achievement.
      queueMicrotask(() => {
        const { newly } = refreshAchievements(next, profile);
        if (newly.length === 1) showToast(`Achievement: ${newly[0].title}`);
      });
      return next;
    });
  }, [profile, showToast]);

  const open = activities.find((a) => a.id === openId) ?? null;
  const showRun = !open && tab === 'run';
  const showHistory = !open && tab === 'history';
  const showCoach = !open && tab === 'coach';
  const showProfile = !open && tab === 'profile';
  const showSettings = !open && tab === 'settings';

  if (!bootReady) {
    return (
      <div className="app" data-theme={profile.theme}>
        <SplashScreen status={bootStatus} />
      </div>
    );
  }

  return (
    <div className="app" data-theme={profile.theme}>
      {/* Always mounted so an in-progress run survives tab switches. Hidden
          rather than unmounted — cleanup would stop GPS and drop the session. */}
      <div className="screen-host" hidden={!showRun} aria-hidden={!showRun}>
        <RunScreen
          profile={profile}
          onFinish={handleFinish}
          onProfileChange={changeProfile}
          onToast={showToast}
          onLiveChange={setRunLive}
          visible={showRun}
          backHandlerRef={runBackHandlerRef}
        />
      </div>

      {open && (
        <DetailScreen
          activity={open}
          // The run being looked at is excluded from its own history, so
          // "longest run yet" is measured against what came before it.
          history={activities.filter((a) => a.id !== open.id && a.startedAt < open.startedAt)}
          profile={profile}
          decisionRequired={resultDecisionLock}
          onBack={() => {
            if (resultDecisionLock) {
              showToast('Choose Save or Delete to continue');
              return;
            }
            setOpenId(null);
          }}
          onSave={() => {
            setResultDecisionLock(false);
            setOpenId(null);
            setTab('run');
            void hapticChange();
          }}
          onDelete={handleDelete}
          onNoteChange={handleNote}
          onToast={showToast}
        />
      )}

      {showHistory && (
        <HistoryScreen
          activities={activities}
          profile={profile}
          onOpen={setOpenId}
          weightTick={weightTick}
        />
      )}

      {showCoach && (
        <CoachScreen
          activities={activities}
          profile={profile}
          onToast={showToast}
          onStartRun={() => setTab('run')}
          onOpen={(id) => {
            setOpenId(id);
            setTab('history');
          }}
          guideOpen={coachGuideOpen}
          onGuideOpenChange={setCoachGuideOpen}
        />
      )}

      {showProfile && (
        <ProfileScreen
          profile={profile}
          activities={activities}
          onChange={changeProfile}
          onToast={showToast}
          onWeightLogChange={() => setWeightTick((t) => t + 1)}
        />
      )}

      {showSettings && (
        <SettingsScreen
          profile={profile}
          onChange={changeProfile}
          onReload={reload}
          onToast={showToast}
        />
      )}

      {toast && <div className="toast">{toast}</div>}

      <nav
        className={`tabs tabs-5${resultDecisionLock && open ? ' tabs-locked' : ''}`}
        aria-label="Main"
        aria-disabled={resultDecisionLock && open ? true : undefined}
      >
        {TABS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            aria-disabled={resultDecisionLock && open ? true : undefined}
            aria-current={!open && tab === entry.id ? 'page' : undefined}
            onClick={() => {
              if (resultDecisionLock && open) {
                showToast('Choose Save or Delete to continue');
                return;
              }
              // Tapping a tab always leaves the detail view, so the tab bar
              // never looks inert.
              const tabChanged = entry.id !== tab;
              setOpenId(null);
              setTab(entry.id);
              if (tabChanged) void hapticChange();
            }}
          >
            <span className="glyph" aria-hidden>
              <TabIcon id={entry.id} />
              {entry.id === 'run' && runLive && <span className="tab-live" title="Run in progress" />}
            </span>
            <span className="tab-label">{entry.label}</span>
            <span className="tab-label-short">{entry.short}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
