/**
 * The small charts: heart-rate + pace/speed trace, zone bars, weekly volume, splits.
 *
 * All SVG or plain divs rather than a charting library — each is a few dozen
 * lines, and none of them needs the 60 kB a general-purpose library would add to
 * a bundle meant to work over a phone connection.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { distanceBetween, type GeoPoint } from '../core/geo';
import { zoneBounds, type HeartSummary } from '../core/heart';
import type { HeartSample } from '../core/activity';
import type { Split } from '../core/activity';
import type { WeekBucket } from '../core/stats';
import {
  distanceLabel,
  formatDistance,
  formatDuration,
  formatPace,
  paceLabel,
  paceUnitMetres,
  toDisplayDistance,
  type UnitSystem,
} from '../core/units';

const HR_COLOUR = '#f87171';
const PACE_COLOUR = '#60a5fa';
const SPEED_COLOUR = '#34d399';

export function ZoneBars({
  summary,
  maxHeartRate,
  showPercent = false,
}: {
  summary: HeartSummary;
  maxHeartRate: number;
  /** Append share of measured HR time next to the duration. */
  showPercent?: boolean;
}) {
  return (
    <div>
      {summary.zones.map(({ zone, ms, fraction }) => {
        const range = zoneBounds(zone, maxHeartRate);
        const pct = Math.round(fraction * 100);
        return (
          <div className="zone-row" key={zone.index}>
            <span className="swatch" style={{ background: zone.colour }} />
            <span className="name">
              Z{zone.index} {zone.name}
            </span>
            <span className="track">
              <span
                style={{
                  width: `${Math.max(fraction * 100, fraction > 0 ? 1.5 : 0)}%`,
                  background: zone.colour,
                }}
              />
            </span>
            <span
              className="time"
              title={`${range.from}${range.to ? `–${range.to}` : '+'} bpm`}
            >
              {ms > 0
                ? showPercent
                  ? `${formatDuration(ms)} · ${pct}%`
                  : formatDuration(ms)
                : '—'}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Cumulative distance marks along a GPS track (wall clock + metres). */
interface TrackMark {
  t: number;
  d: number;
}

function buildTrackMarks(segments: GeoPoint[][]): TrackMark[] {
  const marks: TrackMark[] = [];
  let d = 0;
  for (const segment of segments) {
    for (let i = 0; i < segment.length; i++) {
      if (i > 0) d += distanceBetween(segment[i - 1], segment[i]);
      marks.push({ t: segment[i].t, d });
    }
  }
  return marks;
}

function distanceAtTime(marks: TrackMark[], t: number): number {
  if (marks.length === 0) return 0;
  if (t <= marks[0].t) return marks[0].d;
  if (t >= marks[marks.length - 1].t) return marks[marks.length - 1].d;
  let lo = 0;
  let hi = marks.length - 1;
  while (lo + 1 < hi) {
    const mid = (lo + hi) >> 1;
    if (marks[mid].t <= t) lo = mid;
    else hi = mid;
  }
  const a = marks[lo];
  const b = marks[hi];
  const span = b.t - a.t;
  if (span <= 0) return a.d;
  return a.d + ((t - a.t) / span) * (b.d - a.d);
}

/** Rolling speed (m/s) along the track, window ~200 m or at least neighbouring fixes. */
function rollingSpeedMps(marks: TrackMark[], windowM = 200): Array<{ d: number; mps: number }> {
  if (marks.length < 2) return [];
  const out: Array<{ d: number; mps: number }> = [];
  let tail = 0;
  for (let head = 1; head < marks.length; head++) {
    while (tail < head - 1 && marks[head].d - marks[tail].d > windowM) tail++;
    const dd = marks[head].d - marks[tail].d;
    const dt = marks[head].t - marks[tail].t;
    if (dd > 1 && dt > 0) {
      const mps = dd / (dt / 1000);
      // Ignore standing still / GPS wander.
      if (mps > 0.3 && mps < 12) out.push({ d: marks[head].d, mps });
    }
  }
  return out;
}

interface SeriesPoint {
  /** Distance in metres from start. */
  d: number;
  bpm: number | null;
  /** Seconds per display unit. */
  pace: number | null;
  /** Display units per hour. */
  speed: number | null;
}

function buildSeries(
  samples: HeartSample[],
  segments: GeoPoint[][],
  distanceM: number,
  durationMs: number,
  units: UnitSystem,
  buckets = 120,
): SeriesPoint[] {
  if (samples.length < 2 && segments.every((s) => s.length < 2)) return [];

  const marks = buildTrackMarks(segments);
  const totalD = Math.max(distanceM, marks.length > 0 ? marks[marks.length - 1].d : 0, 1);
  const unitM = paceUnitMetres(units);
  const speeds = rollingSpeedMps(marks);

  const ordered = [...samples].sort((a, b) => a.t - b.t);
  const t0 = ordered.length > 0 ? ordered[0].t : marks[0]?.t ?? 0;
  const t1 =
    ordered.length > 0
      ? ordered[ordered.length - 1].t
      : marks[marks.length - 1]?.t ?? t0 + Math.max(durationMs, 1);
  const spanT = Math.max(t1 - t0, 1);

  // Average pace/speed for treadmill (or flat fallback).
  const avgPace =
    distanceM > 0 && durationMs > 0 ? durationMs / 1000 / (distanceM / unitM) : null;
  const avgSpeed =
    distanceM > 0 && durationMs > 0
      ? toDisplayDistance(distanceM, units) / (durationMs / 3_600_000)
      : null;

  const points: SeriesPoint[] = [];
  for (let i = 0; i < buckets; i++) {
    const d0 = (i / buckets) * totalD;
    const d1 = ((i + 1) / buckets) * totalD;
    const dMid = (d0 + d1) / 2;

    let bpmSum = 0;
    let bpmN = 0;
    for (const s of ordered) {
      const d =
        marks.length >= 2 ? distanceAtTime(marks, s.t) : ((s.t - t0) / spanT) * totalD;
      if (d >= d0 && d < d1 + (i === buckets - 1 ? 0.001 : 0)) {
        bpmSum += s.bpm;
        bpmN++;
      }
    }

    let mpsSum = 0;
    let mpsN = 0;
    for (const s of speeds) {
      if (s.d >= d0 && s.d < d1 + (i === buckets - 1 ? 0.001 : 0)) {
        mpsSum += s.mps;
        mpsN++;
      }
    }

    let pace: number | null = null;
    let speed: number | null = null;
    if (mpsN > 0) {
      const mps = mpsSum / mpsN;
      pace = unitM / mps;
      speed = toDisplayDistance(mps * 3600, units);
      if (pace > 99 * 60) pace = null;
    } else if (marks.length < 2 && avgPace !== null) {
      pace = avgPace;
      speed = avgSpeed;
    }

    points.push({
      d: dMid,
      bpm: bpmN > 0 ? bpmSum / bpmN : null,
      pace,
      speed,
    });
  }

  // Fill isolated HR gaps by nearest neighbour so the line stays continuous.
  for (let i = 0; i < points.length; i++) {
    if (points[i].bpm !== null) continue;
    let best: number | null = null;
    let bestDist = Infinity;
    for (let j = 0; j < points.length; j++) {
      if (points[j].bpm === null) continue;
      const dist = Math.abs(i - j);
      if (dist < bestDist) {
        bestDist = dist;
        best = points[j].bpm;
      }
    }
    if (best !== null && bestDist <= 4) points[i].bpm = best;
  }

  return points;
}

function yScale(value: number, min: number, max: number, height: number, pad = 2): number {
  const span = Math.max(max - min, 1e-6);
  return pad + (1 - (value - min) / span) * (height - pad * 2);
}

function seriesPath(
  points: SeriesPoint[],
  pick: (p: SeriesPoint) => number | null,
  min: number,
  max: number,
  width: number,
  height: number,
  totalD: number,
): string {
  const parts: string[] = [];
  let drawing = false;
  for (const p of points) {
    const v = pick(p);
    if (v === null || !Number.isFinite(v)) {
      drawing = false;
      continue;
    }
    const x = (p.d / totalD) * width;
    const y = yScale(v, min, max, height);
    parts.push(`${drawing ? 'L' : 'M'}${x.toFixed(2)},${y.toFixed(2)}`);
    drawing = true;
  }
  return parts.join(' ');
}

function niceRange(values: number[], padFrac = 0.12): { min: number; max: number } {
  if (values.length === 0) return { min: 0, max: 1 };
  const low = Math.min(...values);
  const high = Math.max(...values);
  const span = Math.max(high - low, 1);
  return {
    min: Math.max(0, low - span * padFrac),
    max: high + span * padFrac,
  };
}

/** Distance tick every 0.5 unit under 5 units, else every 1 or 2. */
function distanceTicks(totalD: number, units: UnitSystem): number[] {
  const displayTotal = toDisplayDistance(totalD, units);
  const step = displayTotal <= 5 ? 0.5 : displayTotal <= 15 ? 1 : 2;
  const ticks: number[] = [];
  for (let v = step; v < displayTotal - step * 0.15; v += step) {
    ticks.push(v * paceUnitMetres(units));
  }
  return ticks;
}

export function HeartChart({
  samples,
  maxHeartRate,
  segments = [],
  distanceM = 0,
  durationMs = 0,
  units = 'metric',
}: {
  samples: HeartSample[];
  maxHeartRate: number;
  segments?: GeoPoint[][];
  distanceM?: number;
  durationMs?: number;
  units?: UnitSystem;
}) {
  const series = useMemo(
    () => buildSeries(samples, segments, distanceM, durationMs, units),
    [samples, segments, distanceM, durationMs, units],
  );

  const [showHr, setShowHr] = useState(true);
  const [showPace, setShowPace] = useState(true);
  const [showSpeed, setShowSpeed] = useState(false);
  const [cursor, setCursor] = useState<number | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragging = useRef(false);

  const pickIndex = useCallback(
    (clientX: number) => {
      const el = svgRef.current;
      if (!el || series.length === 0) return;
      const rect = el.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / Math.max(rect.width, 1)));
      setCursor(Math.round(ratio * (series.length - 1)));
    },
    [series.length],
  );

  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFullscreen(false);
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [fullscreen]);

  if (series.length < 2) return null;

  const totalD = Math.max(...series.map((p) => p.d), distanceM, 1);
  const hrValues = series.map((p) => p.bpm).filter((v): v is number => v !== null);
  const paceValues = series
    .map((p) => p.pace)
    .filter((v): v is number => v !== null && v > 0 && v < 99 * 60);
  const speedValues = series.map((p) => p.speed).filter((v): v is number => v !== null && v > 0);

  const hasPace = paceValues.length > 0;
  const hasSpeed = speedValues.length > 0;
  const hasHr = hrValues.length > 0;

  if (!hasHr && !hasPace && !hasSpeed) return null;

  const hrRange = niceRange(hrValues.length ? hrValues : [120, 160]);
  // Faster pace = lower seconds; invert for plotting so faster rides higher.
  const paceRange = niceRange(paceValues.length ? paceValues : [300, 420]);
  const speedRange = niceRange(speedValues.length ? speedValues : [6, 12]);

  const width = 100;
  const height = 48;

  const hrPath =
    showHr && hasHr
      ? seriesPath(series, (p) => p.bpm, hrRange.min, hrRange.max, width, height, totalD)
      : '';
  const pacePath =
    showPace && hasPace
      ? seriesPath(
          series,
          (p) => (p.pace !== null ? -p.pace : null),
          -paceRange.max,
          -paceRange.min,
          width,
          height,
          totalD,
        )
      : '';
  const speedPath =
    showSpeed && hasSpeed
      ? seriesPath(series, (p) => p.speed, speedRange.min, speedRange.max, width, height, totalD)
      : '';

  const ticks = distanceTicks(totalD, units);
  const hrGrid: number[] = [];
  {
    const span = hrRange.max - hrRange.min;
    const step = span > 60 ? 20 : span > 30 ? 10 : 5;
    const start = Math.ceil(hrRange.min / step) * step;
    for (let v = start; v <= hrRange.max; v += step) hrGrid.push(v);
  }

  const cursorPoint =
    cursor !== null && series.length > 0
      ? series[Math.max(0, Math.min(series.length - 1, cursor))]
      : null;

  const onPointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    dragging.current = true;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    pickIndex(e.clientX);
  };
  const onPointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (e.pointerType === 'mouse' && e.buttons === 0 && !dragging.current) {
      pickIndex(e.clientX);
      return;
    }
    if (dragging.current) pickIndex(e.clientX);
  };
  const onPointerUp = () => {
    dragging.current = false;
  };
  const onPointerLeave = () => {
    if (!dragging.current) setCursor(null);
  };

  const lowHr = hrValues.length ? Math.min(...hrValues) : 0;
  const highHr = hrValues.length ? Math.max(...hrValues) : 0;
  const chartHeight = fullscreen ? 'min(55vh, 360px)' : 120;

  const chartBody = (
    <div className={`run-chart${fullscreen ? ' run-chart-fullscreen-inner' : ''}`}>
      <div className="run-chart-toolbar">
        <div className="run-chart-toggles" role="group" aria-label="Series visibility">
          {hasHr && (
            <button
              type="button"
              className={`run-chart-toggle${showHr ? ' on' : ''}`}
              style={{ ['--series' as string]: HR_COLOUR }}
              aria-pressed={showHr}
              onClick={() => setShowHr((v) => !v)}
            >
              HR
            </button>
          )}
          {hasPace && (
            <button
              type="button"
              className={`run-chart-toggle${showPace ? ' on' : ''}`}
              style={{ ['--series' as string]: PACE_COLOUR }}
              aria-pressed={showPace}
              onClick={() => setShowPace((v) => !v)}
            >
              Pace
            </button>
          )}
          {hasSpeed && (
            <button
              type="button"
              className={`run-chart-toggle${showSpeed ? ' on' : ''}`}
              style={{ ['--series' as string]: SPEED_COLOUR }}
              aria-pressed={showSpeed}
              onClick={() => setShowSpeed((v) => !v)}
            >
              Speed
            </button>
          )}
        </div>
        <button
          type="button"
          className="run-chart-fs-btn"
          onClick={() => setFullscreen((v) => !v)}
          aria-label={fullscreen ? 'Exit full screen' : 'Full screen chart'}
        >
          {fullscreen ? 'Close' : 'Full screen'}
        </button>
      </div>

      <div className="run-chart-plot-wrap">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          className="run-chart-svg"
          style={{ height: chartHeight }}
          role="img"
          aria-label="Heart rate, pace and speed by distance. Drag or tap to read values."
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onPointerLeave={onPointerLeave}
        >
          {ticks.map((d) => {
            const x = (d / totalD) * width;
            return (
              <line
                key={`v-${d}`}
                x1={x}
                y1={0}
                x2={x}
                y2={height}
                className="run-chart-grid"
              />
            );
          })}
          {showHr &&
            hrGrid.map((bpm) => {
              const y = yScale(bpm, hrRange.min, hrRange.max, height);
              return (
                <line
                  key={`h-${bpm}`}
                  x1={0}
                  y1={y}
                  x2={width}
                  y2={y}
                  className="run-chart-grid run-chart-grid-h"
                />
              );
            })}

          {speedPath ? (
            <path
              d={speedPath}
              fill="none"
              stroke={SPEED_COLOUR}
              strokeWidth="1.1"
              vectorEffect="non-scaling-stroke"
              opacity={0.95}
            />
          ) : null}
          {pacePath ? (
            <path
              d={pacePath}
              fill="none"
              stroke={PACE_COLOUR}
              strokeWidth="1.1"
              vectorEffect="non-scaling-stroke"
              opacity={0.95}
            />
          ) : null}
          {hrPath ? (
            <path
              d={hrPath}
              fill="none"
              stroke={HR_COLOUR}
              strokeWidth="1.35"
              vectorEffect="non-scaling-stroke"
            />
          ) : null}

          {cursorPoint ? (
            <>
              <line
                x1={(cursorPoint.d / totalD) * width}
                y1={0}
                x2={(cursorPoint.d / totalD) * width}
                y2={height}
                stroke="var(--text)"
                strokeOpacity={0.45}
                strokeWidth="0.6"
                vectorEffect="non-scaling-stroke"
              />
              {showHr && cursorPoint.bpm !== null ? (
                <circle
                  cx={(cursorPoint.d / totalD) * width}
                  cy={yScale(cursorPoint.bpm, hrRange.min, hrRange.max, height)}
                  r={1.4}
                  fill={HR_COLOUR}
                />
              ) : null}
            </>
          ) : null}
        </svg>

        {cursorPoint ? (
          <div className="run-chart-readout" role="status">
            <span>
              {formatDistance(cursorPoint.d, units)} {distanceLabel(units)}
            </span>
            {showHr && cursorPoint.bpm !== null ? (
              <span style={{ color: HR_COLOUR }}>{Math.round(cursorPoint.bpm)} bpm</span>
            ) : null}
            {showPace && cursorPoint.pace !== null ? (
              <span style={{ color: PACE_COLOUR }}>
                {formatPace(cursorPoint.pace)} {paceLabel(units)}
              </span>
            ) : null}
            {showSpeed && cursorPoint.speed !== null ? (
              <span style={{ color: SPEED_COLOUR }}>
                {cursorPoint.speed.toFixed(1)} {units === 'metric' ? 'km/h' : 'mph'}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="run-chart-axis-x">
        <span>0</span>
        {ticks
          .filter((_, i) => i % (ticks.length > 8 ? 2 : 1) === 0)
          .map((d) => (
            <span key={d} style={{ left: `${(d / totalD) * 100}%` }}>
              {toDisplayDistance(d, units).toFixed(d % paceUnitMetres(units) === 0 ? 0 : 1)}
            </span>
          ))}
        <span>
          {formatDistance(totalD, units)} {distanceLabel(units)}
        </span>
      </div>

      <div className="row run-chart-footer">
        {hasHr ? (
          <>
            <span>{Math.round(lowHr)} bpm</span>
            <span>
              {maxHeartRate > 0
                ? `${Math.round((highHr / maxHeartRate) * 100)}% of max at peak`
                : 'peak'}
            </span>
            <span>{Math.round(highHr)} bpm</span>
          </>
        ) : (
          <span>Drag or tap the chart to read values</span>
        )}
      </div>
      {!cursorPoint ? (
        <p className="hint run-chart-hint">Tap or drag on the chart · x-axis is distance</p>
      ) : null}
    </div>
  );

  if (fullscreen) {
    return (
      <>
        <div className="run-chart-placeholder" aria-hidden>
          <div className="run-chart-toolbar">
            <span className="hint" style={{ margin: 0 }}>
              Chart open full screen
            </span>
          </div>
        </div>
        <div
          className="run-chart-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Full screen run metrics chart"
          onClick={(e) => {
            if (e.target === e.currentTarget) setFullscreen(false);
          }}
        >
          {chartBody}
        </div>
      </>
    );
  }

  return chartBody;
}

export function WeeklyBars({ weeks, units }: { weeks: WeekBucket[]; units: UnitSystem }) {
  const peak = Math.max(...weeks.map((w) => w.distanceM), 1);

  return (
    <div>
      <div className="bars">
        {weeks.map((week, i) => (
          <div className="bar" key={week.start}>
            <div
              className={`fill${i === weeks.length - 1 ? ' current' : ''}`}
              style={{ height: `${(week.distanceM / peak) * 100}%` }}
              title={`${formatDistance(week.distanceM, units)} ${distanceLabel(units)}`}
            />
          </div>
        ))}
      </div>
      <div className="bars" style={{ height: 'auto', alignItems: 'flex-start' }}>
        {weeks.map((week, i) => (
          <div className="bar" key={week.start} style={{ height: 'auto' }}>
            {/* Only every other label, or they collide on a narrow phone. */}
            <div className="tick">
              {i % 2 === weeks.length % 2
                ? new Date(week.start).toLocaleDateString(undefined, {
                    day: 'numeric',
                    month: 'short',
                  })
                : ''}
            </div>
          </div>
        ))}
      </div>
      <div className="row" style={{ fontSize: 12, color: 'var(--muted)', marginTop: 10 }}>
        <span>Peak week</span>
        <span>
          {formatDistance(peak, units)} {distanceLabel(units)}
        </span>
      </div>
    </div>
  );
}

export function SplitsTable({ splits, units }: { splits: Split[]; units: UnitSystem }) {
  if (splits.length === 0) return null;

  const paces = splits.filter((s) => !s.partial).map((s) => s.secondsPerUnit);
  const fastest = Math.min(...paces, ...splits.map((s) => s.secondsPerUnit));
  const slowest = Math.max(...paces, ...splits.map((s) => s.secondsPerUnit));

  return (
    <table className="splits">
      <thead>
        <tr>
          <th>{units === 'metric' ? 'Km' : 'Mile'}</th>
          <th>Pace</th>
          <th className="barcell" />
        </tr>
      </thead>
      <tbody>
        {splits.map((split) => {
          // Bars are scaled between the fastest and slowest split rather than
          // from zero: from zero, every split looks the same length.
          const range = Math.max(slowest - fastest, 1);
          const share = 1 - (split.secondsPerUnit - fastest) / range;
          return (
            <tr key={split.index} className={split.partial ? 'partial' : undefined}>
              <td>
                {split.partial
                  ? `${toDisplayDistance(split.distanceM, units).toFixed(2)}`
                  : split.index}
              </td>
              <td>{formatPace(split.secondsPerUnit)}</td>
              <td className="barcell">
                <span style={{ width: `${20 + share * 80}%`, opacity: split.partial ? 0.5 : 1 }} />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
