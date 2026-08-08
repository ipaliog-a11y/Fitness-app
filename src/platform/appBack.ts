/**
 * Android system back (and future desktop Escape) via Capacitor App plugin.
 */

import { Capacitor } from '@capacitor/core';

export type BackListenerHandle = { remove: () => Promise<void> | void };

/**
 * Register a hardware-back handler. Returns a disposer.
 * On web this is a no-op (browser owns history).
 */
export async function listenHardwareBack(
  handler: () => void,
): Promise<() => void> {
  if (!Capacitor.isNativePlatform()) {
    return () => {};
  }
  try {
    const { App } = await import('@capacitor/app');
    const sub = await App.addListener('backButton', () => {
      handler();
    });
    return () => {
      void sub.remove();
    };
  } catch {
    return () => {};
  }
}

/** Send the app to the background (Android). */
export async function minimizeApp(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const { App } = await import('@capacitor/app');
    await App.minimizeApp();
  } catch {
    /* older shells */
  }
}

/** Leave the process (Android). Prefer minimize for mid-run. */
export async function exitApp(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const { App } = await import('@capacitor/app');
    await App.exitApp();
  } catch {
    /* ignore */
  }
}
