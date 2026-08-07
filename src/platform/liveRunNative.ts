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

/** Throttle native updates so we do not hammer the service every 100ms tick. */
let lastUpdateMs = 0;
let started = false;

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
    started = true;
    lastUpdateMs = Date.now();
  } catch {
    started = false;
  }
}

export async function updateLiveRunNotification(stats: LiveRunSnapshot): Promise<void> {
  if (!liveRunNativeAvailable()) return;
  const now = Date.now();
  // ~1 Hz is enough for a notification/widget; avoids FGS restart storms.
  if (started && now - lastUpdateMs < 900 && stats.active !== false) {
    return;
  }
  lastUpdateMs = now;
  try {
    if (!started && stats.active !== false) {
      await startLiveRunNotification(stats);
      return;
    }
    await LiveRun.update({
      active: stats.active !== false,
      title: stats.title ?? 'RunLog',
      time: stats.time ?? '0:00',
      distance: stats.distance ?? '—',
      pace: stats.pace ?? '--:--',
      hr: stats.hr ?? '',
      paused: Boolean(stats.paused),
    });
    if (stats.active === false) started = false;
    else started = true;
  } catch {
    /* ignore — never crash the run UI */
  }
}

export async function stopLiveRunNotification(): Promise<void> {
  if (!liveRunNativeAvailable()) return;
  started = false;
  lastUpdateMs = 0;
  try {
    await LiveRun.stop();
  } catch {
    /* ignore */
  }
}
