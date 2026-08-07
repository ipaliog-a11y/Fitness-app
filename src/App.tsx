/**
 * The shell: which screen is showing, and the one copy of the data they share.
 *
 * State lives here rather than in a store library. There is one user, five
 * screens (Run, History, Coach, Profile, Settings) and a single list of runs.
 */

import { useCallback, useEffect, useState } from 'react';
import type { Activity } from './core/activity';
import { byNewest } from './core/activity';
import { allActivities, deleteActivity, saveActivity } from './core/db';
import { applyTheme, loadProfile, saveProfile, sanitise, type Profile } from './core/settings';
import { addDistanceToShoe, loadShoes, saveShoes, shoeNeedsWarning } from './core/shoes';
import { CoachScreen } from './ui/CoachScreen';
import { DetailScreen } from './ui/DetailScreen';
import { HistoryScreen } from './ui/HistoryScreen';
import { ProfileScreen } from './ui/ProfileScreen';
import { RunScreen } from './ui/RunScreen';
import { SettingsScreen } from './ui/SettingsScreen';

type Tab = 'run' | 'history' | 'coach' | 'profile' | 'settings';

const TABS: Array<{ id: Tab; label: string; glyph: string }> = [
  { id: 'run', label: 'Run', glyph: '▶' },
  { id: 'history', label: 'History', glyph: '☰' },
  { id: 'coach', label: 'Coach', glyph: '◔' },
  { id: 'profile', label: 'Profile', glyph: '◉' },
  { id: 'settings', label: 'Settings', glyph: '⚙' },
];

export function App() {
  const [tab, setTab] = useState<Tab>('run');
  const [activities, setActivities] = useState<Activity[]>([]);
  const [profile, setProfile] = useState<Profile>(() => loadProfile());
  const [openId, setOpenId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  // True while a run is armed or in progress. The Run screen stays mounted so
  // switching tabs does not tear down sensors or the clock.
  const [runLive, setRunLive] = useState(false);

  const reload = useCallback(() => {
    void allActivities().then(setActivities);
  }, []);

  useEffect(reload, [reload]);

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
        <HistoryScreen activities={activities} profile={profile} onOpen={setOpenId} />
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
        <ProfileScreen profile={profile} onChange={changeProfile} onToast={showToast} />
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

      <nav className="tabs tabs-5">
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
              {entry.glyph}
              {entry.id === 'run' && runLive && <span className="tab-live" title="Run in progress" />}
            </span>
            {entry.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
