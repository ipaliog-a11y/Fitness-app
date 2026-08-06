/**
 * Keeping the screen on during a run.
 *
 * A phone that sleeps mid-run does not stop the GPS watch, but it does stop the
 * user being able to see anything, and on some devices it throttles the sensors.
 */

type WakeLockSentinel = { release(): Promise<void>; released: boolean };

export interface ScreenLock {
  release(): void;
}

export async function keepScreenAwake(): Promise<ScreenLock | null> {
  const nav = navigator as Navigator & {
    wakeLock?: { request(type: 'screen'): Promise<WakeLockSentinel> };
  };
  if (!nav.wakeLock) return null;

  let sentinel: WakeLockSentinel | null = null;
  let released = false;

  const acquire = async () => {
    try {
      sentinel = await nav.wakeLock!.request('screen');
    } catch {
      // Denied, or the tab is in the background. Not fatal.
    }
  };

  // The lock is dropped whenever the tab is hidden and is *not* restored
  // automatically, so it has to be re-taken when the run comes back into view.
  const onVisible = () => {
    if (!released && document.visibilityState === 'visible') void acquire();
  };

  await acquire();
  document.addEventListener('visibilitychange', onVisible);

  return {
    release: () => {
      released = true;
      document.removeEventListener('visibilitychange', onVisible);
      void sentinel?.release().catch(() => {});
    },
  };
}
