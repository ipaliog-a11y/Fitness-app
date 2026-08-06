/**
 * Saved outdoor routes for reuse as map overlays / “run this again” ghosts.
 *
 * Stored in localStorage after thinning so a season of long GPS tracks does not
 * blow the quota. Not a full navigation product — just “here is the shape”.
 */

import { newId, type Activity } from './activity';
import { distanceBetween, type GeoPoint } from './geo';

const KEY = 'runlog:routes:v1';
const MAX_POINTS = 250;

export interface SavedRoute {
  id: string;
  name: string;
  /** Thinned track segments. */
  segments: GeoPoint[][];
  distanceM: number;
  createdAt: number;
  sourceActivityId?: string;
}

/** Keep endpoints; drop intermediate points that add little shape. */
export function thinSegment(points: GeoPoint[], maxPoints = MAX_POINTS): GeoPoint[] {
  if (points.length <= maxPoints) return points.map((p) => ({ ...p }));
  const out: GeoPoint[] = [points[0]];
  const step = (points.length - 1) / (maxPoints - 1);
  for (let i = 1; i < maxPoints - 1; i++) {
    out.push(points[Math.round(i * step)]);
  }
  out.push(points[points.length - 1]);
  return out;
}

export function pathDistance(segments: GeoPoint[][]): number {
  let d = 0;
  for (const seg of segments) {
    for (let i = 1; i < seg.length; i++) d += distanceBetween(seg[i - 1], seg[i]);
  }
  return d;
}

export function reverseSegments(segments: GeoPoint[][]): GeoPoint[][] {
  return segments
    .slice()
    .reverse()
    .map((seg) => seg.slice().reverse().map((p) => ({ ...p })));
}

export function routeFromActivity(activity: Activity, name?: string): SavedRoute | null {
  const usable = activity.segments.filter((s) => s.length > 1);
  if (usable.length === 0) return null;
  const segments = usable.map((s) => thinSegment(s));
  return {
    id: newId(),
    name: name?.trim() || `Route ${new Date(activity.startedAt).toLocaleDateString()}`,
    segments,
    distanceM: pathDistance(segments) || activity.distanceM,
    createdAt: Date.now(),
    sourceActivityId: activity.id,
  };
}

export function loadRoutes(): SavedRoute[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((r) => sanitiseRoute(r))
      .filter((r): r is SavedRoute => r !== null)
      .sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
}

export function saveRoutes(routes: SavedRoute[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(routes));
  } catch {
    // Quota — drop oldest and retry once.
    try {
      const trimmed = routes.slice(0, Math.max(1, Math.floor(routes.length / 2)));
      localStorage.setItem(KEY, JSON.stringify(trimmed));
    } catch {
      /* give up */
    }
  }
}

export function sanitiseRoute(raw: unknown): SavedRoute | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Partial<SavedRoute>;
  if (typeof r.id !== 'string' || typeof r.name !== 'string') return null;
  if (!Array.isArray(r.segments)) return null;
  const segments: GeoPoint[][] = [];
  for (const seg of r.segments) {
    if (!Array.isArray(seg)) continue;
    const points: GeoPoint[] = [];
    for (const p of seg) {
      if (!p || typeof p !== 'object') continue;
      const g = p as Partial<GeoPoint>;
      if (typeof g.lat !== 'number' || typeof g.lon !== 'number') continue;
      points.push({
        lat: g.lat,
        lon: g.lon,
        t: typeof g.t === 'number' ? g.t : 0,
        accuracy: typeof g.accuracy === 'number' ? g.accuracy : 0,
        elevation: typeof g.elevation === 'number' ? g.elevation : null,
      });
    }
    if (points.length > 1) segments.push(points);
  }
  if (segments.length === 0) return null;
  return {
    id: r.id,
    name: r.name.trim().slice(0, 80) || 'Route',
    segments,
    distanceM:
      typeof r.distanceM === 'number' && Number.isFinite(r.distanceM)
        ? r.distanceM
        : pathDistance(segments),
    createdAt: typeof r.createdAt === 'number' ? r.createdAt : Date.now(),
    sourceActivityId: typeof r.sourceActivityId === 'string' ? r.sourceActivityId : undefined,
  };
}
