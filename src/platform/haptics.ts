/**
 * Light haptic when a *value* changes (tab switch, setting flip), not on raw
 * touch. Honours profile.haptics and no-ops when the motor/API is missing.
 */

import { Capacitor } from '@capacitor/core';
import { loadProfile } from '../core/settings';

let lastMs = 0;

/** Soft impact after a real UI change (throttled). */
export async function hapticChange(): Promise<void> {
  try {
    if (!loadProfile().haptics) return;
  } catch {
    return;
  }

  const now = Date.now();
  if (now - lastMs < 50) return;
  lastMs = now;

  try {
    if (Capacitor.isNativePlatform()) {
      const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
      await Haptics.impact({ style: ImpactStyle.Light });
      return;
    }
  } catch {
    /* fall through */
  }

  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(10);
    }
  } catch {
    /* ignore */
  }
}

/** @deprecated use hapticChange — kept as alias for call-site clarity. */
export const hapticTap = hapticChange;
