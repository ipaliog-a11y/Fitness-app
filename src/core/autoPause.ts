/**
 * When to auto-pause / auto-resume from movement sensors.
 *
 * Pure thresholds so outdoor GPS jitter and treadmill belt speed can share one
 * rule without dragging the Geolocation API into the tests.
 */

/** Below this, treat the athlete as stopped (≈ 1.4 km/h). */
export const STILL_SPEED_MPS = 0.4;

/** Above this after a pause, treat them as moving again. */
export const MOVING_SPEED_MPS = 0.7;

/**
 * How long speed must stay “still” before auto-pause (ms).
 *
 * This is not the whole delay. The speed reading is itself an average over a
 * window, so it decays towards zero across most of that window before this
 * timer even starts: the felt latency is roughly the two added together. Held
 * against the caller's 8 s window that lands near twelve seconds, which is
 * long enough to ride out a kerb-side hesitation and short enough that a red
 * light does not quietly pad the run.
 */
export const STILL_DURATION_MS = 5_000;

export interface AutoPauseInput {
  /** Recent speed in m/s, or null when unknown. */
  speedMps: number | null;
  /** Session is currently running (clock ticking). */
  running: boolean;
  /** Session is paused. */
  paused: boolean;
  /** Whether the current pause was caused by auto-pause. */
  autoPaused: boolean;
  /** Continuous ms spent under the still threshold while running. */
  stillMs: number;
  /** Feature enabled in settings. */
  enabled: boolean;
  /**
   * Mode supports auto-pause: outdoor GPS or treadmill with a speed source
   * (foot pod). Step-only treadmill is too noisy to trust.
   */
  supported: boolean;
}

export type AutoPauseAction = 'none' | 'pause' | 'resume';

/**
 * Decide whether to auto-pause or auto-resume on this tick.
 *
 * Call once per UI tick (~100–1000 ms) with updated `stillMs`:
 * - while running and speed is still or unknown-after-move, accumulate stillMs
 * - while running and clearly moving, stillMs = 0
 */
export function autoPauseAction(input: AutoPauseInput): AutoPauseAction {
  if (!input.enabled || !input.supported) return 'none';

  if (input.running) {
    if (input.stillMs >= STILL_DURATION_MS) return 'pause';
    return 'none';
  }

  if (input.paused && input.autoPaused) {
    if (input.speedMps !== null && input.speedMps >= MOVING_SPEED_MPS) return 'resume';
  }

  return 'none';
}

/**
 * Update the “how long have we been still?” accumulator.
 *
 * `speedMps` must be null only when nothing has been measured yet. A stopped
 * athlete reads zero; null is a cold receiver. The two used to arrive here as
 * the same value, and since null resets the accumulator, auto-pause could
 * never fire outdoors at all — see RunSession.recentSpeed.
 */
export function nextStillMs(
  prevStillMs: number,
  speedMps: number | null,
  running: boolean,
  dtMs: number,
): number {
  if (!running) return 0;
  // No fix yet: do not auto-pause (a cold GPS would freeze the clock).
  if (speedMps === null) return 0;
  if (speedMps < STILL_SPEED_MPS) return prevStillMs + dtMs;
  return 0;
}
