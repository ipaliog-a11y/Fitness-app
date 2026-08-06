/**
 * The run in progress.
 *
 * Holds the `RunSession` in a ref and re-renders on a one-second tick rather
 * than on every sensor event: fixes and heart readings arrive at their own
 * rates, and re-rendering per event makes the clock stutter while draining the
 * battery it is supposed to be preserving.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Activity, RunMode } from '../core/activity';
import { RunSession } from '../core/session';
import { calibrateAgainst } from '../core/footpod';
import { calibrateStride } from '../core/steps';
import type { Profile } from '../core/settings';
import {
  distanceLabel,
  formatDistance,
  formatDuration,
  formatPace,
  paceLabel,
  paceSecondsPerUnit,
} from '../core/units';
import { watchPosition, type GeoStatus, type GeoWatcher } from '../platform/geolocation';
import { connectHeartRate, bluetoothSupported, type HeartConnection, type HeartStatus } from '../platform/heartRate';
import { connectFootpod, type FootpodConnection, type FootpodStatus } from '../platform/footpod';
import { countSteps, requestMotionPermission, type MotionStatus, type MotionWatcher } from '../platform/motion';
import { keepScreenAwake, type ScreenLock } from '../platform/wakeLock';
import { RouteMap } from './RouteMap';

interface Props {
  profile: Profile;
  onFinish(activity: Activity): void;
  onProfileChange(profile: Profile): void;
  onToast(message: string): void;
}

export function RunScreen({ profile, onFinish, onProfileChange, onToast }: Props) {
  const [mode, setMode] = useState<RunMode>('outdoor');
  const [, setTick] = useState(0);

  const sessionRef = useRef<RunSession | null>(null);
  const geoRef = useRef<GeoWatcher | null>(null);
  const heartRef = useRef<HeartConnection | null>(null);
  const motionRef = useRef<MotionWatcher | null>(null);
  const podRef = useRef<FootpodConnection | null>(null);
  const lockRef = useRef<ScreenLock | null>(null);

  const [geoStatus, setGeoStatus] = useState<GeoStatus>('idle');
  const [geoDetail, setGeoDetail] = useState<string>();
  const [heartStatus, setHeartStatus] = useState<HeartStatus>('disconnected');
  const [heartName, setHeartName] = useState<string>();
  const [motionStatus, setMotionStatus] = useState<MotionStatus>('idle');
  const [podStatus, setPodStatus] = useState<FootpodStatus>('disconnected');
  const [podName, setPodName] = useState<string>();
  const [bpm, setBpm] = useState<number | null>(null);
  const [cadence, setCadence] = useState<number | null>(null);
  const [manualDistance, setManualDistance] = useState('');
  const [incline, setIncline] = useState('');

  const session = sessionRef.current;
  const running = session?.state === 'running';
  const active = running || session?.state === 'paused';

  // One tick a second drives the clock. Stopped when nothing is running so an
  // idle app is not waking the CPU every second.
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [active]);

  const stopSensors = useCallback(() => {
    geoRef.current?.stop();
    geoRef.current = null;
    motionRef.current?.stop();
    motionRef.current = null;
    lockRef.current?.release();
    lockRef.current = null;
  }, []);

  // Bluetooth devices deliberately survive this: they are disconnected only on
  // unmount, so they stay paired between back-to-back runs.
  useEffect(
    () => () => {
      stopSensors();
      heartRef.current?.disconnect();
      podRef.current?.disconnect();
    },
    [stopSensors],
  );

  const start = async () => {
    const created = new RunSession({
      mode,
      strideM: profile.strideM,
      footpodCalibration: profile.footpodCalibration,
    });
    sessionRef.current = created;
    created.start();

    if (profile.keepAwake) lockRef.current = await keepScreenAwake();

    if (mode === 'outdoor') {
      geoRef.current = watchPosition({
        onPoint: (point) => created.addPoint(point),
        onStatus: (status, detail) => {
          setGeoStatus(status);
          setGeoDetail(detail);
        },
      });
    } else if (podRef.current) {
      // A pod on the shoe measures better than a phone in an armband, and
      // running both would only drain the battery to be overruled.
      setMotionStatus('idle');
    } else {
      const granted = await requestMotionPermission();
      if (granted) {
        motionRef.current = countSteps(
          {
            onStep: (steps, stepCadence) => {
              // The detector owns the count; the session is told the delta so
              // its distance stays in step with it.
              created.addSteps(steps - created.steps);
              setCadence(stepCadence);
            },
            onStatus: setMotionStatus,
          },
          profile.strideM,
        );
      } else {
        setMotionStatus('denied');
        onToast('No motion sensor — type the distance in when you finish.');
      }
    }

    setTick((t) => t + 1);
  };

  const connectPod = async () => {
    const connection = await connectFootpod({
      onMeasurement: (measurement) => {
        sessionRef.current?.addFootpod(measurement);
        setCadence(measurement.cadenceSpm > 0 ? measurement.cadenceSpm : null);
      },
      onStatus: (status, detail) => {
        setPodStatus(status);
        if (status === 'connected') setPodName(detail);
        else if (detail) onToast(detail);
      },
    });
    if (connection) podRef.current = connection;
  };

  const connectStrap = async () => {
    const connection = await connectHeartRate({
      onReading: (reading) => {
        setBpm(reading);
        sessionRef.current?.addHeart(reading);
      },
      onStatus: (status, detail) => {
        setHeartStatus(status);
        if (status === 'connected') setHeartName(detail);
        else if (detail) onToast(detail);
        if (status === 'disconnected') setBpm(null);
      },
    });
    if (connection) heartRef.current = connection;
  };

  const finish = () => {
    const current = sessionRef.current;
    if (!current) return;

    current.finish();
    stopSensors();

    // A typed-in distance is the treadmill console's own figure, measured from
    // belt revolutions. That outranks anything worn, so it both wins and
    // calibrates whichever instrument was being used.
    const typed = Number(manualDistance);
    if (current.mode === 'treadmill' && Number.isFinite(typed) && typed > 0) {
      const metres = typed * (profile.units === 'metric' ? 1000 : 1609.344);

      if (current.footpod.distanceM > 0) {
        const factor = calibrateAgainst(current.footpod.distanceM, metres);
        if (factor) {
          // The pod's reading already includes the old factor, so the new one
          // multiplies rather than replaces it.
          const calibration = profile.footpodCalibration * factor;
          onProfileChange({ ...profile, footpodCalibration: calibration });
          onToast(`Foot pod calibrated — now ${((calibration - 1) * 100).toFixed(1)}% adjusted.`);
        }
      } else if (current.steps > 0) {
        const stride = calibrateStride(current.steps, metres);
        if (stride) {
          onProfileChange({ ...profile, strideM: stride });
          onToast(`Stride calibrated to ${stride.toFixed(2)} m.`);
        }
      }

      current.setDistance(metres);
    }

    const inclineValue = Number(incline);
    if (Number.isFinite(inclineValue) && incline.trim() !== '') {
      current.setIncline(inclineValue);
    }

    const activity = current.toActivity();
    sessionRef.current = null;
    setManualDistance('');
    setIncline('');
    setCadence(null);
    onFinish(activity);
  };

  const discard = () => {
    sessionRef.current?.finish();
    stopSensors();
    sessionRef.current = null;
    setManualDistance('');
    setIncline('');
    setTick((t) => t + 1);
  };

  // --- Idle ---------------------------------------------------------------

  if (!session) {
    return (
      <div className="screen">
        <h1>New run</h1>
        <p className="subtitle">Outdoors or on the treadmill.</p>

        <div className="mode-picker">
          <button aria-pressed={mode === 'outdoor'} onClick={() => setMode('outdoor')}>
            <span className="name">🏃 Outdoor</span>
            <span className="blurb">GPS tracks your route, distance and pace.</span>
          </button>
          <button aria-pressed={mode === 'treadmill'} onClick={() => setMode('treadmill')}>
            <span className="name">🎽 Treadmill</span>
            <span className="blurb">Foot pod, step counting, or type the distance in.</span>
          </button>
        </div>

        <div className="card">
          <h2>Foot pod</h2>
          {podStatus === 'connected' ? (
            <div className="row">
              <span>
                <span className="pill good">
                  <span className="dot live" /> {podName}
                </span>
              </span>
              <button
                className="btn"
                onClick={() => {
                  podRef.current?.disconnect();
                  podRef.current = null;
                }}
              >
                Disconnect
              </button>
            </div>
          ) : (
            <>
              <button className="btn wide" onClick={connectPod} disabled={!bluetoothSupported()}>
                {podStatus === 'connecting' ? 'Connecting…' : 'Connect a foot pod'}
              </button>
              <p className="hint">
                {bluetoothSupported()
                  ? 'Any pod using the standard running speed and cadence profile — a Zwift RunPod, Stryd, Garmin or Polar pod. On a treadmill it measures speed at the shoe, which beats counting the phone bouncing in your pocket. Give it a shake first; most pods only advertise once they are moving.'
                  : 'This browser has no Web Bluetooth. Chrome on Android supports it; Safari does not.'}
              </p>
            </>
          )}
        </div>

        <div className="card">
          <h2>Heart rate</h2>
          {heartStatus === 'connected' ? (
            <div className="row">
              <span>
                <span className="pill good">
                  <span className="dot live" /> {heartName}
                </span>
              </span>
              <button
                className="btn"
                onClick={() => {
                  heartRef.current?.disconnect();
                  heartRef.current = null;
                }}
              >
                Disconnect
              </button>
            </div>
          ) : (
            <>
              <button className="btn wide" onClick={connectStrap} disabled={!bluetoothSupported()}>
                {heartStatus === 'connecting' ? 'Connecting…' : 'Connect a strap'}
              </button>
              <p className="hint">
                {bluetoothSupported()
                  ? 'Any Bluetooth chest strap or watch using the standard heart rate service. Connect before you start and the zones come with the run.'
                  : 'This browser has no Web Bluetooth. Chrome on Android supports it; Safari does not.'}
              </p>
            </>
          )}
        </div>

        <button className="btn primary wide" onClick={start}>
          Start {mode === 'outdoor' ? 'outdoor run' : 'treadmill run'}
        </button>
      </div>
    );
  }

  // --- Running ------------------------------------------------------------

  const elapsed = session.elapsedMs();
  const distance = session.distanceM;
  const average = paceSecondsPerUnit(distance, elapsed, profile.units);
  const speed = session.recentSpeed();
  // Metres per second inverted into seconds per display unit.
  const current =
    speed && speed > 0 ? (profile.units === 'metric' ? 1000 : 1609.344) / speed : null;

  return (
    <div className="screen">
      <div className="pills">
        {session.mode === 'outdoor' ? (
          <span
            className={`pill ${
              geoStatus === 'tracking' ? 'good' : geoStatus === 'denied' ? 'bad' : 'warn'
            }`}
          >
            <span className={`dot${geoStatus === 'tracking' ? ' live' : ''}`} />
            {geoStatus === 'tracking'
              ? 'GPS'
              : geoStatus === 'denied'
                ? 'No location permission'
                : geoDetail ?? 'Finding GPS…'}
          </span>
        ) : (
          <span className={`pill ${motionStatus === 'counting' ? 'good' : 'warn'}`}>
            <span className={`dot${motionStatus === 'counting' ? ' live' : ''}`} />
            {motionStatus === 'counting'
              ? `${session.steps} steps`
              : 'No step counter — type the distance at the end'}
          </span>
        )}

        {session.mode === 'treadmill' && podStatus === 'connected' && (
          <span className="pill good">
            <span className="dot live" /> Foot pod
          </span>
        )}

        {bpm !== null && (
          <span className="pill bad">
            <span className="dot live" /> {bpm} bpm
          </span>
        )}
        {cadence !== null && <span className="pill">{Math.round(cadence)} spm</span>}
        {session.state === 'paused' && <span className="pill warn">Paused</span>}
      </div>

      <div className="metric-hero">
        <div className="value">{formatDuration(elapsed)}</div>
        <div className="label">{session.state === 'paused' ? 'Paused' : 'Moving time'}</div>
      </div>

      <div className="metric-grid" style={{ margin: '18px 0' }}>
        <div className="metric">
          <div className="value">{formatDistance(distance, profile.units)}</div>
          <div className="label">{distanceLabel(profile.units)}</div>
        </div>
        <div className="metric">
          <div className="value">{formatPace(current ?? average)}</div>
          <div className="label">{current ? 'Pace now' : `Avg ${paceLabel(profile.units)}`}</div>
        </div>
        <div className="metric">
          <div className="value">{bpm ?? '—'}</div>
          <div className="label">bpm</div>
        </div>
      </div>

      {session.mode === 'outdoor' && session.segments.some((s) => s.length > 1) && (
        <div style={{ marginBottom: 14 }}>
          {/* Tiles are off during the run: the map is a glance at the shape of
              the route, and it should not be pulling images over mobile data. */}
          <RouteMap segments={session.segments} tiles={false} live />
        </div>
      )}

      {session.mode === 'treadmill' && (
        <div className="card">
          <h2>From the console</h2>
          <div className="field">
            <label htmlFor="manual-distance">
              Distance ({distanceLabel(profile.units)}) — optional
            </label>
            <input
              id="manual-distance"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              placeholder={formatDistance(distance, profile.units)}
              value={manualDistance}
              onChange={(e) => setManualDistance(e.target.value)}
            />
            <p className="hint">
              {podStatus === 'connected'
                ? 'The console measures the belt itself, so it overrides the pod — and calibrates it for next time.'
                : 'Overrides the step estimate, and calibrates your stride for next time.'}
            </p>
          </div>
          <div className="field">
            <label htmlFor="incline">Incline (%) — optional</label>
            <input
              id="incline"
              type="number"
              inputMode="decimal"
              step="0.5"
              min="0"
              value={incline}
              onChange={(e) => setIncline(e.target.value)}
            />
          </div>
        </div>
      )}

      {session.mode === 'treadmill' && podStatus !== 'connected' && (
        <button className="btn wide" style={{ marginBottom: 10 }} onClick={connectPod} disabled={!bluetoothSupported()}>
          Connect a foot pod
        </button>
      )}

      {heartStatus !== 'connected' && (
        <button className="btn wide" style={{ marginBottom: 10 }} onClick={connectStrap} disabled={!bluetoothSupported()}>
          Connect a heart rate strap
        </button>
      )}

      <div className="btn-row" style={{ marginBottom: 10 }}>
        {running ? (
          <button
            className="btn"
            onClick={() => {
              session.pause();
              setTick((t) => t + 1);
            }}
          >
            Pause
          </button>
        ) : (
          <button
            className="btn primary"
            onClick={() => {
              session.resume();
              setTick((t) => t + 1);
            }}
          >
            Resume
          </button>
        )}
        <button className="btn primary" onClick={finish}>
          Finish
        </button>
      </div>

      <button className="btn danger wide" onClick={discard}>
        Discard
      </button>
    </div>
  );
}
