/**
 * Heart rate: zones, and what the strap said about the run.
 *
 * The zone model is percentage-of-maximum, the one every consumer watch uses.
 * It is not the most physiologically precise choice — lactate-threshold zones
 * are better — but it needs exactly one number the athlete already knows or can
 * estimate, and a zone chart nobody can configure is a zone chart nobody uses.
 */

import type { HeartSample } from './activity';

export interface Zone {
  /** 1–5, low to high. */
  index: number;
  name: string;
  /** Inclusive lower bound as a fraction of max HR. */
  from: number;
  /** Exclusive upper bound, except zone 5 which has no ceiling. */
  to: number;
  blurb: string;
  colour: string;
}

/**
 * The classic five. Boundaries are the widely used 50/60/70/80/90 split, so the
 * numbers here agree with what a Garmin or Polar would show for the same max.
 */
export const ZONES: Zone[] = [
  {
    index: 1,
    name: 'Recovery',
    from: 0.5,
    to: 0.6,
    blurb: 'Very light. Warm-ups, cool-downs, and the easy end of easy.',
    colour: '#6b7f9e',
  },
  {
    index: 2,
    name: 'Easy',
    from: 0.6,
    to: 0.7,
    blurb: 'Conversational. Where most of a sane training week lives.',
    colour: '#3fa66a',
  },
  {
    index: 3,
    name: 'Aerobic',
    from: 0.7,
    to: 0.8,
    blurb: 'Steady and purposeful. Talking gets clipped.',
    colour: '#d8a13a',
  },
  {
    index: 4,
    name: 'Threshold',
    from: 0.8,
    to: 0.9,
    blurb: 'Hard, sustainable for a while. This is where speed is bought.',
    colour: '#e2703a',
  },
  {
    index: 5,
    name: 'Maximum',
    from: 0.9,
    to: Infinity,
    blurb: 'All out. Minutes, not hours.',
    colour: '#d2453f',
  },
];

/**
 * The old 220-minus-age rule.
 *
 * It is a population average with a standard deviation of about 10 bpm, so it is
 * a starting point and not a measurement — which is why the settings screen lets
 * you overwrite it with a number from a real test.
 */
export function estimateMaxHeartRate(age: number): number {
  return Math.round(220 - age);
}

/** Which zone a reading falls in, or null when it is below zone 1. */
export function zoneOf(bpm: number, maxHeartRate: number): Zone | null {
  if (maxHeartRate <= 0) return null;
  const fraction = bpm / maxHeartRate;
  // Searched top-down so the open-ended zone 5 catches anything above 90%.
  for (let i = ZONES.length - 1; i >= 0; i--) {
    if (fraction >= ZONES[i].from) return ZONES[i];
  }
  return null;
}

/** Beats per minute at the bottom of a zone, for showing the ranges. */
export function zoneBounds(zone: Zone, maxHeartRate: number): { from: number; to: number | null } {
  return {
    from: Math.round(zone.from * maxHeartRate),
    to: Number.isFinite(zone.to) ? Math.round(zone.to * maxHeartRate) - 1 : null,
  };
}

export interface ZoneTime {
  zone: Zone;
  ms: number;
  /** Share of the run's measured heart-rate time, 0–1. */
  fraction: number;
}

export interface HeartSummary {
  averageBpm: number;
  maxBpm: number;
  minBpm: number;
  zones: ZoneTime[];
  /** Total time the zones were computed over. */
  measuredMs: number;
}

/**
 * Time spent in each zone.
 *
 * Each sample is credited with the interval up to the *next* sample, which is
 * the only interpretation that makes the parts sum to the whole. Straps report
 * about once a second but drop out; a gap longer than `maxGapMs` is treated as
 * lost signal rather than as a very long beat, so a strap that fell off mid-run
 * cannot donate ten minutes to whatever zone it was last in.
 */
export function summariseHeart(
  samples: HeartSample[],
  maxHeartRate: number,
  maxGapMs = 10_000,
): HeartSummary | null {
  const usable = samples.filter((s) => Number.isFinite(s.bpm) && s.bpm > 0);
  if (usable.length === 0) return null;

  const ordered = [...usable].sort((a, b) => a.t - b.t);

  const msByZone = new Map<number, number>();
  let measuredMs = 0;
  let sumWeighted = 0;
  let max = -Infinity;
  let min = Infinity;

  for (let i = 0; i < ordered.length; i++) {
    const sample = ordered[i];
    max = Math.max(max, sample.bpm);
    min = Math.min(min, sample.bpm);

    const next = ordered[i + 1];
    // The final sample has no successor to bound it; give it a nominal beat's
    // worth rather than zero so a short run still totals sensibly.
    const rawGap = next ? next.t - sample.t : 1000;
    const gap = Math.max(0, Math.min(rawGap, maxGapMs));

    measuredMs += gap;
    sumWeighted += sample.bpm * gap;

    const zone = zoneOf(sample.bpm, maxHeartRate);
    if (zone) msByZone.set(zone.index, (msByZone.get(zone.index) ?? 0) + gap);
  }

  const zones: ZoneTime[] = ZONES.map((zone) => {
    const ms = msByZone.get(zone.index) ?? 0;
    return { zone, ms, fraction: measuredMs > 0 ? ms / measuredMs : 0 };
  });

  return {
    // Time-weighted, not the mean of the readings: samples are not evenly
    // spaced, and an unweighted mean over-counts the bursts.
    averageBpm: measuredMs > 0 ? Math.round(sumWeighted / measuredMs) : ordered[0].bpm,
    maxBpm: Math.round(max),
    minBpm: Math.round(min),
    zones,
    measuredMs,
  };
}

/**
 * Down-sample a heart trace to at most `buckets` points for drawing.
 *
 * An hour at one sample a second is 3600 points fighting over maybe 300 pixels.
 * Averaging within each bucket keeps the shape while dropping the noise that no
 * screen could show anyway.
 */
export function heartTrace(samples: HeartSample[], buckets = 120): number[] {
  if (samples.length === 0) return [];
  if (samples.length <= buckets) return samples.map((s) => s.bpm);

  const out: number[] = [];
  const size = samples.length / buckets;
  for (let i = 0; i < buckets; i++) {
    const start = Math.floor(i * size);
    const end = Math.max(start + 1, Math.floor((i + 1) * size));
    let sum = 0;
    for (let j = start; j < end; j++) sum += samples[j].bpm;
    out.push(sum / (end - start));
  }
  return out;
}
