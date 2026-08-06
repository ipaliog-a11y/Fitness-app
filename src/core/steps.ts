/**
 * Counting steps from the phone's accelerometer, for treadmill runs.
 *
 * There are no satellites indoors, so distance has to come from somewhere. The
 * phone in an armband bounces once per footfall, and that bounce is large and
 * regular enough to count without any hardware at all.
 *
 * This is deliberately a simple peak detector rather than an FFT: running
 * cadence is a strong, near-periodic signal in the 2.5–3.5 Hz range, and the
 * failure mode of something cleverer — silently mis-locking onto a harmonic — is
 * much worse than the occasional missed step.
 */

export interface StepDetectorOptions {
  /**
   * Metres per second squared the smoothed signal must rise above the running
   * baseline to count as a footfall. Running produces peaks of several g; this
   * sits well below that but above the wobble of a phone held while walking.
   */
  threshold: number;
  /**
   * Shortest believable gap between footfalls. 5 steps a second is faster than
   * any human sprints, so anything closer is the same impact ringing twice.
   */
  minIntervalMs: number;
  /** Smoothing factor for the low-pass, 0–1. Higher follows the signal faster. */
  smoothing: number;
}

export const DEFAULT_STEP_OPTIONS: StepDetectorOptions = {
  threshold: 1.6,
  minIntervalMs: 200,
  smoothing: 0.25,
};

/**
 * Feeds on raw accelerometer magnitudes and emits a step count.
 *
 * Orientation is deliberately ignored — the magnitude of the acceleration
 * vector is used, so it does not matter which way up the phone sits in the
 * armband. Gravity is removed by tracking a slow-moving baseline rather than by
 * subtracting 9.81, because the baseline also absorbs the treadmill's own
 * vibration and the phone's resting tilt.
 */
export class StepDetector {
  private readonly options: StepDetectorOptions;
  /** Fast low-pass: the signal with sensor hash removed. */
  private smoothed = 0;
  /** Slow low-pass: gravity plus whatever else is steady. */
  private baseline = 0;
  private primed = false;
  private above = false;
  private lastStepAt = 0;

  steps = 0;
  /** Timestamps of recent steps, used for cadence. */
  private recent: number[] = [];

  constructor(options: Partial<StepDetectorOptions> = {}) {
    this.options = { ...DEFAULT_STEP_OPTIONS, ...options };
  }

  /**
   * Push one accelerometer reading.
   *
   * @param magnitude √(x²+y²+z²) in m/s², including gravity.
   * @param t Epoch milliseconds.
   * @returns true when this reading completed a step.
   */
  push(magnitude: number, t: number): boolean {
    if (!Number.isFinite(magnitude)) return false;

    if (!this.primed) {
      this.smoothed = magnitude;
      this.baseline = magnitude;
      this.primed = true;
      return false;
    }

    const { smoothing, threshold, minIntervalMs } = this.options;
    this.smoothed += (magnitude - this.smoothed) * smoothing;
    // An order of magnitude slower than the signal, so it tracks posture and
    // gravity but not the footfalls themselves.
    this.baseline += (this.smoothed - this.baseline) * 0.02;

    const excess = this.smoothed - this.baseline;

    // A step is the *rising* crossing of the threshold. Requiring the signal to
    // fall back below half the threshold before arming again gives hysteresis,
    // without which a peak hovering at the line counts a dozen times.
    if (!this.above && excess > threshold) {
      this.above = true;
      if (t - this.lastStepAt >= minIntervalMs) {
        this.lastStepAt = t;
        this.steps++;
        this.recent.push(t);
        if (this.recent.length > 16) this.recent.shift();
        return true;
      }
    } else if (this.above && excess < threshold * 0.5) {
      this.above = false;
    }

    return false;
  }

  /** Steps per minute over the last handful of steps, or null when unknown. */
  cadence(): number | null {
    if (this.recent.length < 4) return null;
    const span = this.recent[this.recent.length - 1] - this.recent[0];
    if (span <= 0) return null;
    return ((this.recent.length - 1) / span) * 60_000;
  }

  reset(): void {
    this.steps = 0;
    this.recent = [];
    this.primed = false;
    this.above = false;
    this.lastStepAt = 0;
  }
}

/**
 * Stride length from height, as a starting guess.
 *
 * The 0.65 coefficient is a rough average for running; walking is nearer 0.4.
 * It exists so a first treadmill run is roughly right before any calibration,
 * and is meant to be replaced by `calibrateStride` the moment there is real data.
 */
export function estimateStride(heightCm: number): number {
  return (heightCm / 100) * 0.65;
}

/**
 * Metres per step, worked out from a run of known distance.
 *
 * After a treadmill session the machine's own console shows the real distance;
 * typing that in turns this run into a calibration for every future one.
 */
export function calibrateStride(steps: number, knownDistanceM: number): number | null {
  if (steps <= 0 || knownDistanceM <= 0) return null;
  const stride = knownDistanceM / steps;
  // Outside this range the input was almost certainly wrong — a distance in
  // kilometres typed as metres, say — and a bad stride poisons every later run.
  if (stride < 0.3 || stride > 2.5) return null;
  return stride;
}

export function distanceFromSteps(steps: number, strideM: number): number {
  return steps * strideM;
}

/**
 * Treadmill incline turns horizontal metres into climbed metres.
 *
 * Percent grade is rise over run, which is what the console displays, so this is
 * a straight multiplication rather than a trigonometric one. At the single-digit
 * grades a treadmill offers, the difference is under half a percent.
 */
export function ascentFromIncline(distanceM: number, inclinePercent: number): number {
  return distanceM * (inclinePercent / 100);
}
