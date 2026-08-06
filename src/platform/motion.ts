/**
 * The accelerometer, for counting steps on a treadmill.
 *
 * iOS gates DeviceMotion behind an explicit permission call that must come from
 * a user gesture; Android hands it over on a secure origin without asking. Both
 * paths end at the same callback.
 */

import { StepDetector } from '../core/steps';

export type MotionStatus = 'unsupported' | 'idle' | 'denied' | 'counting';

export interface MotionHandlers {
  onStep(totalSteps: number, cadence: number | null): void;
  onStatus(status: MotionStatus, detail?: string): void;
}

export interface MotionWatcher {
  stop(): void;
  detector: StepDetector;
}

export function motionSupported(): boolean {
  return typeof window !== 'undefined' && 'DeviceMotionEvent' in window;
}

type MotionEventWithPermission = typeof DeviceMotionEvent & {
  requestPermission?: () => Promise<'granted' | 'denied'>;
};

/** True when the browser will hand over motion data, asking the user if needed. */
export async function requestMotionPermission(): Promise<boolean> {
  if (!motionSupported()) return false;
  const ctor = DeviceMotionEvent as MotionEventWithPermission;
  if (typeof ctor.requestPermission !== 'function') return true; // Android and desktop.
  try {
    return (await ctor.requestPermission()) === 'granted';
  } catch {
    // Thrown when called outside a user gesture.
    return false;
  }
}

export function countSteps(handlers: MotionHandlers, strideM?: number): MotionWatcher {
  const detector = new StepDetector();

  if (!motionSupported()) {
    handlers.onStatus('unsupported', 'This device reports no motion sensor.');
    return { stop: () => {}, detector };
  }

  const onMotion = (event: DeviceMotionEvent) => {
    // Gravity is deliberately included: the detector tracks its own baseline, and
    // `acceleration` without gravity is unavailable or badly filtered on a lot
    // of hardware.
    const a = event.accelerationIncludingGravity;
    if (!a || a.x === null || a.y === null || a.z === null) return;
    const magnitude = Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z);
    if (detector.push(magnitude, Date.now())) {
      handlers.onStep(detector.steps, detector.cadence());
    }
  };

  window.addEventListener('devicemotion', onMotion);
  handlers.onStatus('counting', strideM ? `Stride ${strideM.toFixed(2)} m` : undefined);

  return {
    detector,
    stop: () => {
      window.removeEventListener('devicemotion', onMotion);
      handlers.onStatus('idle');
    },
  };
}
