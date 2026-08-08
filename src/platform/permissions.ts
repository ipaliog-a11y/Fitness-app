/**
 * Ask for runtime permissions once at launch so the first run does not chain
 * dialogs mid-session. Already-granted permissions resolve immediately.
 *
 * Order matters a little on Android: location and BT are the two that block
 * outdoor tracking and sensors; notifications matter for the live FGS;
 * Health Connect is optional but nicer up front if the user imports runs.
 */

import { Capacitor } from '@capacitor/core';
import { ensureNativeBle } from './ble';
import { primePermission as primeLocation } from './geolocation';
import { requestHealthConnectAccess, healthConnectSupported } from './healthConnect';
import { requestMotionPermission } from './motion';

export type PermissionStep =
  | 'starting'
  | 'location'
  | 'notifications'
  | 'motion'
  | 'bluetooth'
  | 'health'
  | 'done';

export interface BootstrapProgress {
  step: PermissionStep;
  label: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Android 13+ / web notifications for the live-run banner. */
export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof Notification === 'undefined') return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  try {
    const result = await Notification.requestPermission();
    return result === 'granted';
  } catch {
    return false;
  }
}

/**
 * Run the full permission pass. Safe to call every cold start — OS skips
 * prompts that are already decided.
 */
export async function bootstrapPermissions(
  onProgress?: (progress: BootstrapProgress) => void,
): Promise<void> {
  const report = (step: PermissionStep, label: string) => {
    onProgress?.({ step, label });
  };

  report('starting', 'Getting ready…');

  report('location', 'Location…');
  try {
    await primeLocation();
  } catch {
    /* denied or unavailable */
  }

  // Small gap so stacked system dialogs do not fight each other.
  await sleep(120);

  report('notifications', 'Notifications…');
  try {
    await requestNotificationPermission();
  } catch {
    /* ignore */
  }

  await sleep(80);

  report('motion', 'Motion & steps…');
  try {
    await requestMotionPermission();
  } catch {
    /* iOS needs a gesture; fine to skip on cold start */
  }

  if (Capacitor.isNativePlatform()) {
    await sleep(80);
    report('bluetooth', 'Bluetooth…');
    try {
      await ensureNativeBle();
    } catch {
      /* BT off or denied */
    }

    if (healthConnectSupported() && Capacitor.getPlatform() === 'android') {
      await sleep(80);
      report('health', 'Health Connect…');
      try {
        await requestHealthConnectAccess();
      } catch {
        /* optional — import can ask again later */
      }
    }
  }

  report('done', 'Ready');
}

/** Hide the native Capacitor splash once our in-app splash is up. */
export async function hideNativeSplash(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const { SplashScreen } = await import('@capacitor/splash-screen');
    await SplashScreen.hide({ fadeOutDuration: 200 });
  } catch {
    /* plugin missing or already hidden */
  }
}
