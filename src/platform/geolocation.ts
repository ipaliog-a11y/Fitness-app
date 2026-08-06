/**
 * The Geolocation API, wrapped so the rest of the app never touches it.
 */

import type { GeoPoint } from '../core/geo';

export type GeoStatus = 'idle' | 'acquiring' | 'tracking' | 'denied' | 'unavailable' | 'error';

export interface GeoWatcher {
  stop(): void;
}

export interface GeoHandlers {
  onPoint(point: GeoPoint): void;
  onStatus(status: GeoStatus, detail?: string): void;
}

function toPoint(position: GeolocationPosition): GeoPoint {
  return {
    lat: position.coords.latitude,
    lon: position.coords.longitude,
    // The fix's own timestamp, not Date.now(): a fix can be delivered a second
    // or two after it was taken, and pace is sensitive to exactly that.
    t: position.timestamp,
    accuracy: position.coords.accuracy,
    elevation: position.coords.altitude,
  };
}

export function watchPosition(handlers: GeoHandlers): GeoWatcher {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    handlers.onStatus('unavailable', 'This browser has no location support.');
    return { stop: () => {} };
  }

  handlers.onStatus('acquiring');
  let seenFix = false;

  const id = navigator.geolocation.watchPosition(
    (position) => {
      if (!seenFix) {
        seenFix = true;
        handlers.onStatus('tracking');
      }
      handlers.onPoint(toPoint(position));
    },
    (error) => {
      if (error.code === error.PERMISSION_DENIED) {
        handlers.onStatus('denied', 'Location permission was refused.');
      } else if (error.code === error.POSITION_UNAVAILABLE) {
        handlers.onStatus('error', 'No position available — is GPS on?');
      } else {
        // A timeout mid-run is normal in a tunnel or a stairwell; it is not
        // worth tearing the run down over, so the watch keeps running.
        handlers.onStatus(seenFix ? 'tracking' : 'acquiring', 'Waiting for a fix…');
      }
    },
    {
      enableHighAccuracy: true,
      // Never hand back a cached fix: a stale position is how a run starts with
      // a phantom 200 m jump from wherever the phone last was.
      maximumAge: 0,
      timeout: 20_000,
    },
  );

  return {
    stop: () => navigator.geolocation.clearWatch(id),
  };
}

/** Ask for permission early, so the run itself starts without a dialog. */
export function primePermission(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return Promise.resolve(false);
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      () => resolve(true),
      () => resolve(false),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  });
}
