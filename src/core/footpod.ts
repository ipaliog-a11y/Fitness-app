/**
 * Foot pods: Running Speed and Cadence, the standard Bluetooth profile.
 *
 * A pod on the shoe is the right instrument for a treadmill. It reports speed
 * and cadence directly rather than leaving them to be inferred from a phone
 * bouncing in an armband, and it does not care where the phone is or whether
 * the treadmill has any electronics worth talking to.
 *
 * Parsing lives here, away from the browser, because the wire format is a
 * bit-packed struct with optional fields — precisely the kind of thing that is
 * easy to get subtly wrong and impossible to notice on a run.
 */

export interface RscMeasurement {
  /** Metres per second. */
  speedMps: number;
  /** Steps per minute, counting both feet. */
  cadenceSpm: number;
  /** Metres per stride, when the pod reports it. */
  strideLengthM: number | null;
  /** The pod's own cumulative odometer in metres, when it reports one. */
  totalDistanceM: number | null;
  /** The pod's own opinion on whether this is running or walking. */
  running: boolean;
}

/**
 * Decode an RSC Measurement characteristic (0x2A53).
 *
 * Layout, little-endian throughout:
 *
 * ```
 *   0      flags
 *   1..2   instantaneous speed      uint16, units of 1/256 m/s
 *   3      instantaneous cadence    uint8, steps per minute
 *   4..5   stride length            uint16, centimetres   (flags bit 0)
 *   ..     total distance           uint32, decimetres    (flags bit 1)
 * ```
 *
 * The optional fields are why this cannot be read at fixed offsets: a pod that
 * omits stride length puts total distance four bytes earlier than one that
 * includes it.
 */
export function parseRscMeasurement(view: DataView): RscMeasurement | null {
  // Flags, speed and cadence are mandatory: four bytes minimum.
  if (view.byteLength < 4) return null;

  const flags = view.getUint8(0);
  const hasStride = (flags & 0x01) !== 0;
  const hasTotal = (flags & 0x02) !== 0;
  const running = (flags & 0x04) !== 0;

  const speedMps = view.getUint16(1, true) / 256;
  const cadenceSpm = view.getUint8(3);

  let offset = 4;
  let strideLengthM: number | null = null;
  if (hasStride) {
    if (view.byteLength < offset + 2) return null;
    strideLengthM = view.getUint16(offset, true) / 100;
    offset += 2;
  }

  let totalDistanceM: number | null = null;
  if (hasTotal) {
    if (view.byteLength < offset + 4) return null;
    totalDistanceM = view.getUint32(offset, true) / 10;
  }

  return { speedMps, cadenceSpm, strideLengthM, totalDistanceM, running };
}

/**
 * Turns a stream of measurements into a distance.
 *
 * Two sources, in order of preference:
 *
 * 1. The pod's own odometer, when it has one. Deltas between readings are
 *    exact and immune to dropped notifications — miss five seconds of packets
 *    and the next reading still carries the distance covered during them.
 * 2. Otherwise, integrating speed over time. Correct in principle, but it
 *    accumulates error and silently loses ground during a dropout.
 */
export class FootpodTracker {
  /** Metres covered since this tracker started counting. */
  distanceM = 0;
  speedMps = 0;
  cadenceSpm = 0;
  strideLengthM: number | null = null;

  /**
   * Multiplier applied to everything the pod reports.
   *
   * A foot pod infers speed from the motion of a shoe, so it carries a personal
   * bias — most are a few percent out until calibrated. 1 means "believe the
   * pod"; `calibrateAgainst` replaces it with a measured figure.
   */
  calibration = 1;

  private lastTotal: number | null = null;
  private lastT: number | null = null;

  update(measurement: RscMeasurement, t: number): void {
    this.speedMps = measurement.speedMps * this.calibration;
    this.cadenceSpm = measurement.cadenceSpm;
    this.strideLengthM = measurement.strideLengthM;

    if (measurement.totalDistanceM !== null) {
      const total = measurement.totalDistanceM;
      if (this.lastTotal === null) {
        // First reading only establishes the baseline. The pod's odometer has
        // been counting since who knows when, and none of that is this run.
        this.lastTotal = total;
      } else {
        let delta = total - this.lastTotal;
        // A pod that was power-cycled mid-run restarts its odometer; treat a
        // backwards jump as a reset rather than subtracting distance.
        if (delta < 0) delta = total;
        this.distanceM += delta * this.calibration;
        this.lastTotal = total;
      }
    } else if (this.lastT !== null) {
      const seconds = (t - this.lastT) / 1000;
      // A long gap means dropped packets, not a long stride at the last known
      // speed. Integrating across it would invent distance.
      if (seconds > 0 && seconds <= 10) {
        this.distanceM += measurement.speedMps * this.calibration * seconds;
      }
    }

    this.lastT = t;
  }

  /**
   * Stop counting without forgetting the distance so far.
   *
   * Called when a run is paused. Dropping the baseline means the first reading
   * after resuming rebases instead of donating everything the pod counted while
   * the runner was standing at the water fountain.
   */
  suspend(): void {
    this.lastTotal = null;
    this.lastT = null;
    this.speedMps = 0;
  }

  reset(): void {
    this.distanceM = 0;
    this.speedMps = 0;
    this.cadenceSpm = 0;
    this.strideLengthM = null;
    this.suspend();
  }
}

/**
 * A correction factor from a run of known length.
 *
 * The treadmill console's own figure is the reference: it comes from belt
 * revolutions rather than from anything strapped to a shoe. One calibration run
 * is usually enough to bring a pod within a percent or so.
 */
export function calibrateAgainst(reportedM: number, actualM: number): number | null {
  if (reportedM <= 0 || actualM <= 0) return null;
  const factor = actualM / reportedM;
  // Beyond this the input was wrong — kilometres typed as metres, or a pod that
  // was not running — and a bad factor quietly corrupts every later run.
  if (factor < 0.5 || factor > 2) return null;
  return factor;
}
