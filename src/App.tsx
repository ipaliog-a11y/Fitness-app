/**
 * The shell: which screen is showing, and the one copy of the data they share.
 *
 * State lives here rather than in a store library. There is one user, five
 * screens (Run, History, Coach, Profile, Settings) and a single list of runs.
 * Weight lives under Profile, not as a sixth tab.
 */

import { useCallback, useEffect, useState } from 'react';
import type { Activity } from './core/activity';
import { byNewest } from './core/activity';
import { allActivities, deleteActivity, saveActivity } from './core/db';
import { applyTheme, loadProfile, saveProfile, sanitise, type Profile } from './core/settings';
import { addDistanceToShoe, loadShoes, saveShoes, shoeNeedsWarning } from './core/shoes';
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

  const changeProfile = useCallback((next: Profile) => {
    // Always re-sanitise so a partial write never leaves the UI with missing
    // fields (e.g. displayName) that crash the Profile screen on .trim().
    const clean = sanitise(next);
    setProfile(clean);
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
      setActivities((current) => [activity, ...current].sort(byNewest));
      setOpenId(activity.id);
      setTab('history');
    },
    [showToast],
  );

  const handleDelete = useCallback(async (id: string) => {
    await deleteActivity(id);
    setActivities((current) => current.filter((a) => a.id !== id));
    setOpenId(null);
  }, []);

  const handleNote = useCallback(async (id: string, note: string) => {
    setActivities((current) => {
      const next = current.map((a) => (a.id === id ? { ...a, note } : a));
      const updated = next.find((a) => a.id === id);
      if (updated) void saveActivity(updated);
      return next;
    });
  }, []);

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
        />
      </div>

      {open && (
        <DetailScreen
          activity={open}
          // The run being looked at is excluded from its own history, so
          // "longest run yet" is measured against what came before it.
          history={activities.filter((a) => a.id !== open.id && a.startedAt < open.startedAt)}
          profile={profile}
          onBack={() => setOpenId(null)}
          onSave={() => {
            setOpenId(null);
            setTab('run');
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
        />
      )}

      {showProfile && (
        <ProfileScreen
          profile={profile}
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

      <nav className="tabs tabs-5" aria-label="Main">
        {TABS.map((entry) => (
          <button
            key={entry.id}
            aria-current={!open && tab === entry.id ? 'page' : undefined}
            onClick={() => {
              // Tapping a tab always leaves the detail view, so the tab bar
              // never looks inert.
              setOpenId(null);
              setTab(entry.id);
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
