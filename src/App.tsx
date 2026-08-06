/**
 * The shell: which screen is showing, and the one copy of the data they share.
 *
 * State lives here rather than in a store library. There is one user, four
 * screens and a single list of runs; anything more elaborate would be
 * scaffolding around a problem this app does not have.
 */

import { useCallback, useEffect, useState } from 'react';
import type { Activity } from './core/activity';
import { byNewest } from './core/activity';
import { allActivities, deleteActivity, saveActivity } from './core/db';
import { loadProfile, saveProfile, type Profile } from './core/settings';
import { DetailScreen } from './ui/DetailScreen';
import { HistoryScreen } from './ui/HistoryScreen';
import { RunScreen } from './ui/RunScreen';
import { SettingsScreen } from './ui/SettingsScreen';
import { StatsScreen } from './ui/StatsScreen';

type Tab = 'run' | 'history' | 'stats' | 'settings';

const TABS: Array<{ id: Tab; label: string; glyph: string }> = [
  { id: 'run', label: 'Run', glyph: '▶' },
  { id: 'history', label: 'History', glyph: '☰' },
  { id: 'stats', label: 'Dashboard', glyph: '◴' },
  { id: 'settings', label: 'Settings', glyph: '⚙' },
];

export function App() {
  const [tab, setTab] = useState<Tab>('run');
  const [activities, setActivities] = useState<Activity[]>([]);
  const [profile, setProfile] = useState<Profile>(() => loadProfile());
  const [openId, setOpenId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const reload = useCallback(() => {
    void allActivities().then(setActivities);
  }, []);

  useEffect(reload, [reload]);

  const showToast = useCallback((message: string) => {
    setToast(message);
    setTimeout(() => setToast((current) => (current === message ? null : current)), 3500);
  }, []);

  const changeProfile = useCallback((next: Profile) => {
    setProfile(next);
    saveProfile(next);
  }, []);

  const handleFinish = useCallback(
    async (activity: Activity) => {
      // A run with nothing in it is a mis-tap, not a workout worth keeping.
      if (activity.distanceM < 10 && activity.durationMs < 30_000) {
        showToast('Run discarded — too short to keep.');
        return;
      }
      await saveActivity(activity);
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

  const body = open ? (
    <DetailScreen
      activity={open}
      // The run being looked at is excluded from its own history, so "longest
      // run yet" is measured against what came before it.
      history={activities.filter((a) => a.id !== open.id && a.startedAt < open.startedAt)}
      profile={profile}
      onBack={() => setOpenId(null)}
      onDelete={handleDelete}
      onNoteChange={handleNote}
    />
  ) : tab === 'run' ? (
    <RunScreen
      profile={profile}
      onFinish={handleFinish}
      onProfileChange={changeProfile}
      onToast={showToast}
    />
  ) : tab === 'history' ? (
    <HistoryScreen activities={activities} profile={profile} onOpen={setOpenId} />
  ) : tab === 'stats' ? (
    <StatsScreen
      activities={activities}
      profile={profile}
      onOpen={(id) => {
        setOpenId(id);
        setTab('history');
      }}
    />
  ) : (
    <SettingsScreen
      profile={profile}
      onChange={changeProfile}
      onReload={reload}
      onToast={showToast}
    />
  );

  return (
    <div className="app">
      {body}

      {toast && <div className="toast">{toast}</div>}

      <nav className="tabs">
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
            </span>
            {entry.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
