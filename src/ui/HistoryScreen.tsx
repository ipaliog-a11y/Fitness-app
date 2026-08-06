/** Every run, newest first. */

import { averagePace, modeIcon, type Activity } from '../core/activity';
import type { Profile } from '../core/settings';
import {
  distanceLabel,
  formatDay,
  formatDistance,
  formatDuration,
  formatClock,
  formatPace,
  paceLabel,
} from '../core/units';

interface Props {
  activities: Activity[];
  profile: Profile;
  onOpen(id: string): void;
}

export function HistoryScreen({ activities, profile, onOpen }: Props) {
  if (activities.length === 0) {
    return (
      <div className="screen">
        <h1>History</h1>
        <div className="empty">
          <span className="glyph">🏃</span>
          No runs yet.
          <br />
          Your first one will appear here.
        </div>
      </div>
    );
  }

  return (
    <div className="screen">
      <h1>History</h1>
      <p className="subtitle">
        {activities.length} run{activities.length === 1 ? '' : 's'}
      </p>

      {activities.map((activity) => (
        <button className="run-item" key={activity.id} onClick={() => onOpen(activity.id)}>
          <span className="glyph">{modeIcon(activity.mode)}</span>
          <span className="body">
            <span className="headline">
              {formatDistance(activity.distanceM, profile.units)} {distanceLabel(profile.units)}
              {' · '}
              {formatDuration(activity.durationMs)}
            </span>
            <span className="meta">
              {formatDay(activity.startedAt)} at {formatClock(activity.startedAt)} ·{' '}
              {formatPace(averagePace(activity, profile.units))} {paceLabel(profile.units)}
              {activity.heart.length > 0 ? ' · ❤' : ''}
            </span>
          </span>
          <span aria-hidden style={{ color: 'var(--muted)' }}>›</span>
        </button>
      ))}
    </div>
  );
}
