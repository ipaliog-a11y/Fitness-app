/**
 * Live-run notification + home widget bridge (Android Capacitor only).
 *
 * Starts a foreground service with an ongoing notification while a run is
 * active, and mirrors the same stats into SharedPreferences for the widget.
 */

import { Capacitor, registerPlugin } from '@capacitor/core';

export interface LiveRunSnapshot {
  active?: boolean;
  paused?: boolean;
  title?: string;
  time?: string;
  distance?: string;
  pace?: string;
  hr?: string;
}

interface LiveRunPlugin {
  start(options: LiveRunSnapshot): Promise<void>;
  update(options: LiveRunSnapshot): Promise<void>;
  stop(): Promise<void>;
  getSnapshot(): Promise<LiveRunSnapshot>;
}

const LiveRun = registerPlugin<LiveRunPlugin>('LiveRun');

export function liveRunNativeAvailable(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

export async function startLiveRunNotification(stats: LiveRunSnapshot): Promise<void> {
  if (!liveRunNativeAvailable()) return;
  try {
    await LiveRun.start({
      title: stats.title ?? 'RunLog',
      time: stats.time ?? '0:00',
      distance: stats.distance ?? '—',
      pace: stats.pace ?? '--:--',
      hr: stats.hr ?? '',
      paused: Boolean(stats.paused),
    });
  } catch {
    /* permission denied or plugin missing */
  }
}

export async function updateLiveRunNotification(stats: LiveRunSnapshot): Promise<void> {
  if (!liveRunNativeAvailable()) return;
  try {
    await LiveRun.update({
      active: stats.active !== false,
      title: stats.title ?? 'RunLog',
      time: stats.time ?? '0:00',
      distance: stats.distance ?? '—',
      pace: stats.pace ?? '--:--',
      hr: stats.hr ?? '',
      paused: Boolean(stats.paused),
    });
  } catch {
    /* ignore */
  }
}

export async function stopLiveRunNotification(): Promise<void> {
  if (!liveRunNativeAvailable()) return;
  try {
    await LiveRun.stop();
  } catch {
    /* ignore */
  }
}
