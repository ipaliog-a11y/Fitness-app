/**
 * GPX interchange for outdoor tracks.
 *
 * Export is GPX 1.1 with one track and multiple segments (pauses). Import
 * accepts common Strava / Garmin / phone exports and builds a synthetic
 * Activity the rest of the app can store.
 */

import {
  newId,
  type Activity,
  type DistanceSource,
  type HeartSample,
} from './activity';
import { distanceBetween, type GeoPoint } from './geo';

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function iso(ms: number): string {
  return new Date(ms).toISOString();
}

function bpmAt(samples: HeartSample[], t: number): number | null {
  if (samples.length === 0) return null;
  let best: number | null = null;
  for (const s of samples) {
    if (s.t > t) break;
    best = s.bpm;
  }
  if (best === null && samples[0] && Math.abs(samples[0].t - t) < 30_000) {
    return samples[0].bpm;
  }
  return best;
}

/**
 * Serialize an activity’s GPS track to GPX 1.1.
 *
 * Includes Garmin TrackPointExtension heart-rate when samples exist so Strava
 * and similar importers can attach HR without a separate TCX file.
 */
export function activityToGpx(activity: Activity, name?: string): string {
  const title = xmlEscape(name ?? `Run ${iso(activity.startedAt)}`);
  const heart = [...activity.heart].sort((a, b) => a.t - b.t);
  const hasHr = heart.length > 0;

  const trksegs = activity.segments
    .filter((s) => s.length > 0)
    .map((seg) => {
      const pts = seg
        .map((p) => {
          const elev =
            p.elevation !== null && Number.isFinite(p.elevation)
              ? `\n          <ele>${p.elevation.toFixed(1)}</ele>`
              : '';
          const bpm = bpmAt(heart, p.t);
          const hrExt =
            bpm !== null
              ? `\n          <extensions>
            <gpxtpx:TrackPointExtension>
              <gpxtpx:hr>${Math.round(bpm)}</gpxtpx:hr>
            </gpxtpx:TrackPointExtension>
          </extensions>`
              : '';
          return `        <trkpt lat="${p.lat}" lon="${p.lon}">${elev}
          <time>${iso(p.t)}</time>${hrExt}
        </trkpt>`;
        })
        .join('\n');
      return `      <trkseg>\n${pts}\n      </trkseg>`;
    })
    .join('\n');

  const hrNs = hasHr
    ? `
  xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v1"`
    : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="RunLog"
  xmlns="http://www.topografix.com/GPX/1/1"${hrNs}
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata>
    <name>${title}</name>
    <time>${iso(activity.startedAt)}</time>
  </metadata>
  <trk>
    <name>${title}</name>
    <type>running</type>
${trksegs}
  </trk>
</gpx>
`;
}

function attr(el: Element, name: string): number | null {
  const v = el.getAttribute(name);
  if (v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function childText(el: Element, local: string): string | null {
  for (const child of Array.from(el.children)) {
    if (child.localName === local || child.tagName === local || child.tagName.endsWith(`:${local}`)) {
      return child.textContent;
    }
  }
  return null;
}

function parsePoint(el: Element): GeoPoint | null {
  const lat = attr(el, 'lat');
  const lon = attr(el, 'lon');
  if (lat === null || lon === null) return null;
  const timeText = childText(el, 'time');
  const t = timeText ? Date.parse(timeText) : NaN;
  const elevText = childText(el, 'ele');
  const elevation = elevText !== null && elevText !== '' ? Number(elevText) : null;
  return {
    lat,
    lon,
    t: Number.isFinite(t) ? t : 0,
    accuracy: 5,
    elevation: elevation !== null && Number.isFinite(elevation) ? elevation : null,
  };
}

function collectTrkpts(root: Document): GeoPoint[][] {
  const segments: GeoPoint[][] = [];
  const segs = root.getElementsByTagNameNS('*', 'trkseg');
  const list = segs.length > 0 ? Array.from(segs) : [root.documentElement];

  for (const seg of list) {
    const pts: GeoPoint[] = [];
    const nodes = seg.getElementsByTagNameNS('*', 'trkpt');
    for (const node of Array.from(nodes)) {
      // Only direct-ish points: if we used documentElement fallback, still OK.
      const p = parsePoint(node);
      if (p) pts.push(p);
    }
    // Also support rtept (routes without time)
    if (pts.length === 0) {
      const rtes = seg.getElementsByTagNameNS('*', 'rtept');
      for (const node of Array.from(rtes)) {
        const p = parsePoint(node);
        if (p) pts.push(p);
      }
    }
    if (pts.length > 1) segments.push(pts);
  }

  // Waypoints-only file: one segment
  if (segments.length === 0) {
    const wpts = root.getElementsByTagNameNS('*', 'wpt');
    const pts: GeoPoint[] = [];
    for (const node of Array.from(wpts)) {
      const p = parsePoint(node);
      if (p) pts.push(p);
    }
    if (pts.length > 1) segments.push(pts);
  }

  return segments;
}

function pathStats(segments: GeoPoint[][]): { distanceM: number; durationMs: number; startedAt: number } {
  let distanceM = 0;
  let startedAt = 0;
  let endedAt = 0;
  for (const seg of segments) {
    for (let i = 0; i < seg.length; i++) {
      if (!startedAt && seg[i].t) startedAt = seg[i].t;
      if (seg[i].t) endedAt = seg[i].t;
      if (i > 0) distanceM += distanceBetween(seg[i - 1], seg[i]);
    }
  }
  if (!startedAt) startedAt = Date.now();
  const durationMs = endedAt > startedAt ? endedAt - startedAt : 0;
  return { distanceM, durationMs, startedAt };
}

/**
 * Parse a GPX string into a storable Activity (outdoor GPS).
 * Throws if the document has no usable track.
 */
export function activityFromGpx(xml: string, note = ''): Activity {
  if (typeof DOMParser === 'undefined') {
    throw new Error('GPX import needs a browser DOMParser.');
  }
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.querySelector('parsererror')) {
    throw new Error('That file is not valid GPX/XML.');
  }

  const segments = collectTrkpts(doc);
  if (segments.length === 0) {
    throw new Error('No track points found in that GPX file.');
  }

  // Fill missing timestamps with 1 Hz sequence so duration is usable.
  let cursor = segments[0][0].t || Date.now();
  for (const seg of segments) {
    for (const p of seg) {
      if (!p.t) {
        cursor += 1000;
        p.t = cursor;
      } else {
        cursor = p.t;
      }
    }
  }

  const { distanceM, durationMs, startedAt } = pathStats(segments);
  const nameNode =
    doc.getElementsByTagNameNS('*', 'name')[0]?.textContent?.trim() ||
    `Imported ${new Date(startedAt).toLocaleDateString()}`;

  return {
    id: newId(),
    mode: 'outdoor',
    startedAt,
    durationMs: durationMs > 0 ? durationMs : Math.round((distanceM / 3) * 1000),
    distanceM,
    distanceSource: 'gps' as DistanceSource,
    segments,
    heart: [],
    heartReport: null,
    steps: null,
    inclinePercent: null,
    caloriesKcal: null,
    goal: null,
    manualLaps: [],
    shoeId: null,
    workoutId: null,
    workoutName: null,
    note: note || `Imported: ${nameNode}`,
  };
}


export function downloadText(filename: string, text: string, mime: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
