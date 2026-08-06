/**
 * Geography: turning a stream of noisy GPS fixes into a distance you can trust.
 *
 * A phone's location is a guess with an error bar, and the error bar moves. Left
 * unfiltered, a runner standing still at a traffic light accumulates hundreds of
 * metres of "distance" as the fix wanders around them. Everything here exists to
 * stop that, because a tracker that inflates your distance is worse than no
 * tracker at all.
 */

export interface GeoPoint {
  lat: number;
  lon: number;
  /** Epoch milliseconds, from the fix itself rather than when we received it. */
  t: number;
  /** Horizontal accuracy in metres — the radius the device claims to be within. */
  accuracy: number;
  /** Metres above sea level, when the device offers it. */
  elevation: number | null;
}

const EARTH_RADIUS_M = 6371008.8;

const toRad = (deg: number): number => (deg * Math.PI) / 180;

/**
 * Great-circle distance in metres.
 *
 * Haversine rather than a projected approximation: it stays honest near the
 * poles and across the antimeridian, and at the scale of a single run the extra
 * trig costs nothing.
 */
export function distanceBetween(a: GeoPoint, b: GeoPoint): number {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Metres per second between two fixes, or 0 when they share a timestamp. */
export function speedBetween(a: GeoPoint, b: GeoPoint): number {
  const seconds = (b.t - a.t) / 1000;
  if (seconds <= 0) return 0;
  return distanceBetween(a, b) / seconds;
}

export interface FilterOptions {
  /** Fixes claiming to be worse than this many metres are discarded outright. */
  maxAccuracy: number;
  /**
   * Movement smaller than this is treated as the fix wandering, not the runner
   * moving. Scaled by accuracy, so a sloppy fix has to move further to count.
   */
  minStep: number;
  /** Metres per second above which a jump is assumed to be a glitch. */
  maxSpeed: number;
}

/**
 * Tuned for humans on foot. `maxSpeed` sits above a sprint but well below the
 * teleports a phone produces when it reacquires satellites after a tunnel.
 */
export const DEFAULT_FILTER: FilterOptions = {
  maxAccuracy: 40,
  minStep: 4,
  maxSpeed: 12,
};

export type RejectReason = 'accuracy' | 'jitter' | 'teleport' | 'stale';

export type FilterVerdict = { accept: true } | { accept: false; reason: RejectReason };

/**
 * Decide whether a new fix should extend the track.
 *
 * `previous` is the last *accepted* fix, not merely the last one seen — comparing
 * against a rejected point would let a single bad fix drag the whole track after
 * it.
 */
export function judgePoint(
  previous: GeoPoint | null,
  next: GeoPoint,
  options: FilterOptions = DEFAULT_FILTER,
): FilterVerdict {
  if (!Number.isFinite(next.accuracy) || next.accuracy > options.maxAccuracy) {
    return { accept: false, reason: 'accuracy' };
  }

  // The first good fix has nothing to be implausible relative to.
  if (!previous) return { accept: true };

  if (next.t <= previous.t) return { accept: false, reason: 'stale' };

  const step = distanceBetween(previous, next);

  // A fix accurate to 30 m can drift 30 m without anyone moving, so the bar for
  // "this was real movement" rises with the error bar rather than staying fixed.
  const threshold = Math.max(options.minStep, next.accuracy / 2);
  if (step < threshold) return { accept: false, reason: 'jitter' };

  if (speedBetween(previous, next) > options.maxSpeed) {
    return { accept: false, reason: 'teleport' };
  }

  return { accept: true };
}

export interface Bounds {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}

/** The lat/lon box containing every point, or null when there are none. */
export function boundsOf(segments: GeoPoint[][]): Bounds | null {
  let bounds: Bounds | null = null;
  for (const segment of segments) {
    for (const p of segment) {
      if (!bounds) {
        bounds = { minLat: p.lat, maxLat: p.lat, minLon: p.lon, maxLon: p.lon };
        continue;
      }
      bounds.minLat = Math.min(bounds.minLat, p.lat);
      bounds.maxLat = Math.max(bounds.maxLat, p.lat);
      bounds.minLon = Math.min(bounds.minLon, p.lon);
      bounds.maxLon = Math.max(bounds.maxLon, p.lon);
    }
  }
  return bounds;
}

/**
 * Project a track into a unit square for drawing.
 *
 * Longitude degrees shrink as you move away from the equator, so they are scaled
 * by cos(latitude) before fitting. Without it a north–south run in Helsinki
 * renders as a wide smear instead of a line. `y` is flipped so north is up.
 */
export function projectToUnitSquare(segments: GeoPoint[][]): Array<Array<[number, number]>> {
  const bounds = boundsOf(segments);
  if (!bounds) return [];

  const midLat = (bounds.minLat + bounds.maxLat) / 2;
  const lonScale = Math.cos(toRad(midLat));

  const width = (bounds.maxLon - bounds.minLon) * lonScale;
  const height = bounds.maxLat - bounds.minLat;
  // An out-and-back on one street has near-zero width; give it something to
  // divide by so the track still draws down the middle instead of vanishing.
  const span = Math.max(width, height, 1e-6);

  const xOffset = (span - width) / 2;
  const yOffset = (span - height) / 2;

  return segments.map((segment) =>
    segment.map((p): [number, number] => {
      const x = ((p.lon - bounds.minLon) * lonScale + xOffset) / span;
      const y = (p.lat - bounds.minLat + yOffset) / span;
      return [x, 1 - y];
    }),
  );
}

/** Total ascent in metres, ignoring drops and sub-metre elevation noise. */
export function elevationGain(segments: GeoPoint[][]): number {
  let gain = 0;
  for (const segment of segments) {
    let last: number | null = null;
    for (const p of segment) {
      if (p.elevation === null) continue;
      // Barometric and GPS altitude both jitter by a metre or two at rest; only
      // count a climb once it clears that.
      if (last !== null && p.elevation - last > 1) gain += p.elevation - last;
      if (last === null || Math.abs(p.elevation - last) > 1) last = p.elevation;
    }
  }
  return gain;
}
