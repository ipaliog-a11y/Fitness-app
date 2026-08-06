/**
 * The small charts: heart-rate trace, zone bars, weekly volume, splits.
 *
 * All SVG or plain divs rather than a charting library — each is a few dozen
 * lines, and none of them needs the 60 kB a general-purpose library would add to
 * a bundle meant to work over a phone connection.
 */

import { heartTrace, zoneBounds, type HeartSummary } from '../core/heart';
import type { HeartSample } from '../core/activity';
import type { Split } from '../core/activity';
import type { WeekBucket } from '../core/stats';
import {
  distanceLabel,
  formatDistance,
  formatDuration,
  formatPace,
  toDisplayDistance,
  type UnitSystem,
} from '../core/units';

export function ZoneBars({ summary, maxHeartRate }: { summary: HeartSummary; maxHeartRate: number }) {
  return (
    <div>
      {summary.zones.map(({ zone, ms, fraction }) => {
        const range = zoneBounds(zone, maxHeartRate);
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
            <span className="time" title={`${range.from}${range.to ? `–${range.to}` : '+'} bpm`}>
              {ms > 0 ? formatDuration(ms) : '—'}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function HeartChart({ samples, maxHeartRate }: { samples: HeartSample[]; maxHeartRate: number }) {
  const trace = heartTrace(samples, 140);
  if (trace.length < 2) return null;

  const low = Math.min(...trace);
  const high = Math.max(...trace);
  // A flat trace would otherwise divide by zero and vanish.
  const span = Math.max(high - low, 10);
  const top = high + span * 0.12;
  const bottom = Math.max(0, low - span * 0.12);

  const width = 100;
  const height = 40;
  const points = trace
    .map((bpm, i) => {
      const x = (i / (trace.length - 1)) * width;
      const y = height - ((bpm - bottom) / (top - bottom)) * height;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');

  return (
    <div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        style={{ width: '100%', height: 90, display: 'block' }}
        role="img"
        aria-label={`Heart rate from ${Math.round(low)} to ${Math.round(high)} beats per minute`}
      >
        <polyline points={points} fill="none" stroke="#f87171" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="row" style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>
        <span>{Math.round(low)} bpm</span>
        <span>{Math.round((high / maxHeartRate) * 100)}% of max at peak</span>
        <span>{Math.round(high)} bpm</span>
      </div>
    </div>
  );
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
