/**
 * TCX (Training Center XML) export for Strava / Garmin / TrainingPeaks import.
 *
 * One activity, GPS track with optional heart rate and distance along the path.
 * TCX is often more reliable than bare GPX when heart rate matters.
 */

import type { Activity, HeartSample } from './activity';
import { distanceBetween } from './geo';

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

/** Nearest HR sample at or before t (samples assumed sorted). */
function bpmAt(samples: HeartSample[], t: number): number | null {
  if (samples.length === 0) return null;
  let best: number | null = null;
  for (const s of samples) {
    if (s.t > t) break;
    best = s.bpm;
  }
  if (best === null && samples[0]) {
    // Before first sample: use it if within 30s.
    if (Math.abs(samples[0].t - t) < 30_000) return samples[0].bpm;
  }
  return best;
}

/**
 * Serialize an outdoor (or any GPS) activity to TCX 2.
 * Treadmill runs without points export a single Lap with totals only.
 */
export function activityToTcx(activity: Activity, name?: string): string {
  const title = xmlEscape(name ?? `Run ${iso(activity.startedAt)}`);
  const heart = [...activity.heart].sort((a, b) => a.t - b.t);
  const endAt = activity.startedAt + activity.durationMs;
  const avgHr =
    heart.length > 0
      ? Math.round(heart.reduce((s, h) => s + h.bpm, 0) / heart.length)
      : null;
  const maxHr = heart.length > 0 ? Math.round(Math.max(...heart.map((h) => h.bpm))) : null;

  const trackPoints: string[] = [];
  let covered = 0;

  for (const segment of activity.segments) {
    for (let i = 0; i < segment.length; i++) {
      const p = segment[i];
      if (i > 0) covered += distanceBetween(segment[i - 1], p);
      const bpm = bpmAt(heart, p.t);
      const elev =
        p.elevation !== null && Number.isFinite(p.elevation)
          ? `\n            <AltitudeMeters>${p.elevation.toFixed(1)}</AltitudeMeters>`
          : '';
      const hr = bpm !== null
        ? `\n            <HeartRateBpm><Value>${Math.round(bpm)}</Value></HeartRateBpm>`
        : '';
      trackPoints.push(`          <Trackpoint>
            <Time>${iso(p.t)}</Time>
            <Position>
              <LatitudeDegrees>${p.lat}</LatitudeDegrees>
              <LongitudeDegrees>${p.lon}</LongitudeDegrees>
            </Position>${elev}
            <DistanceMeters>${covered.toFixed(1)}</DistanceMeters>${hr}
          </Trackpoint>`);
    }
  }

  // No GPS: still emit a lap so Strava accepts distance/time when user re-exports.
  const hasTrack = trackPoints.length > 0;
  const trackXml = hasTrack
    ? `        <Track>
${trackPoints.join('\n')}
        </Track>`
    : '';

  const avgHrXml =
    avgHr !== null
      ? `\n        <AverageHeartRateBpm><Value>${avgHr}</Value></AverageHeartRateBpm>`
      : '';
  const maxHrXml =
    maxHr !== null
      ? `\n        <MaximumHeartRateBpm><Value>${maxHr}</Value></MaximumHeartRateBpm>`
      : '';
  const cals =
    activity.caloriesKcal !== null && activity.caloriesKcal > 0
      ? `\n        <Calories>${Math.round(activity.caloriesKcal)}</Calories>`
      : '';

  const totalTimeSec = Math.max(1, Math.round(activity.durationMs / 1000));

  return `<?xml version="1.0" encoding="UTF-8"?>
<TrainingCenterDatabase
  xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2 http://www.garmin.com/xmlschemas/TrainingCenterDatabasev2.xsd">
  <Activities>
    <Activity Sport="Running">
      <Id>${iso(activity.startedAt)}</Id>
      <Lap StartTime="${iso(activity.startedAt)}">
        <TotalTimeSeconds>${totalTimeSec}</TotalTimeSeconds>
        <DistanceMeters>${Math.max(0, activity.distanceM).toFixed(1)}</DistanceMeters>${cals}
        <Intensity>Active</Intensity>
        <TriggerMethod>Manual</TriggerMethod>${avgHrXml}${maxHrXml}
${trackXml}
      </Lap>
      <Notes>${title}</Notes>
      <Creator xsi:type="Device_t">
        <Name>RunLog</Name>
        <UnitId>0</UnitId>
        <ProductID>0</ProductID>
        <Version>
          <VersionMajor>1</VersionMajor>
          <VersionMinor>0</VersionMinor>
          <BuildMajor>0</BuildMajor>
          <BuildMinor>0</BuildMinor>
        </Version>
      </Creator>
    </Activity>
  </Activities>
  <!-- end ${iso(endAt)} -->
</TrainingCenterDatabase>
`;
}
