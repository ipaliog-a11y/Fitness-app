/**
 * The run in progress.
 *
 * Holds the `RunSession` in a ref and re-renders on a short tick while the
 * clock is live rather than on every sensor event: fixes and heart readings
 * arrive at their own rates, and re-rendering per event makes the clock
 * stutter while draining the battery it is supposed to be preserving.
 *
 * Starting a run is two steps: arm (start sensors, show readiness) then
 * begin (start the clock). That way a cold GPS fix does not burn free seconds
 * into the moving-time total.
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type Dispatch,
  type SetStateAction,
} from 'react';
import type { Activity, RunMode } from '../core/activity';
import type { GeoPoint } from '../core/geo';
import { autoPauseAction, nextStillMs } from '../core/autoPause';
import { formatCalories } from '../core/calories';
import { cueSpeech, makeSnapshot, pendingCues, type CueSnapshot } from '../core/cues';
import { calibrateAgainst } from '../core/footpod';
import {
  caloriesGoal,
  distanceGoal,
  formatGoalProgress,
  formatGoalTarget,
  goalKindLabel,
  goalMet,
  goalProgress,
  timeGoalMinutes,
  type GoalKind,
  type RunGoal,
} from '../core/goal';
import {
  activeShoes,
  loadShoes,
  shoeNeedsWarning,
  type Shoe,
} from '../core/shoes';
import { loadRoutes, type SavedRoute } from '../core/routes';
import { RunSession } from '../core/session';
import type { Profile } from '../core/settings';
import { zoneOf, zoneSwatch } from '../core/heart';
import { calibrateStride } from '../core/steps';
import {
  DEFAULT_PACE_BAND,
  formatTargetPace,
  paceBandCueSpeech,
  paceBandLabel,
  paceBandStatus,
  parsePaceInput,
} from '../core/paceBand';
import {
  distanceLabel,
  formatDistance,
  formatDuration,
  formatPace,
  paceLabel,
  paceSecondsPerUnit,
  toDisplayDistance,
} from '../core/units';
import {
  addSavedWorkout,
  deleteSavedWorkout,
  loadSavedWorkouts,
  savedWorkoutById,
  templateFromSaved,
  type SavedWorkout,
} from '../core/savedWorkouts';
import {
  WORKOUT_PRESETS,
  WorkoutRunner,
  customIntervals,
  phaseKindLabel,
  phaseVisualWeight,
  workoutEffortLevel,
  workoutTimeMs,
  workoutWorkCount,
  type PhaseKind,
  type WorkoutPhase,
  type WorkoutTemplate,
} from '../core/workout';
import { watchPosition, type GeoStatus, type GeoWatcher } from '../platform/geolocation';
import { connectHeartRate, bluetoothSupported, type HeartConnection, type HeartStatus } from '../platform/heartRate';
import { connectFootpod, type FootpodConnection, type FootpodStatus } from '../platform/footpod';
import { countSteps, requestMotionPermission, type MotionStatus, type MotionWatcher } from '../platform/motion';
import { pulse, speak, warmSpeech } from '../platform/speech';
import { keepScreenAwake, type ScreenLock } from '../platform/wakeLock';
import {
  startLiveRunNotification,
  stopLiveRunNotification,
  updateLiveRunNotification,
} from '../platform/liveRunNative';
import { resolveMapBasemap } from '../core/mercator';
import { RouteMap } from './RouteMap';

interface Props {
  profile: Profile;
  onFinish(activity: Activity): void;
  onProfileChange(profile: Profile): void;
  onToast(message: string): void;
  /** True while arming or mid-run so the shell can keep this screen mounted. */
  onLiveChange?(live: boolean): void;
  /**
   * True when the Run tab is the visible screen. Used to reload shoes/routes
   * that may have been edited under Settings while this screen stayed mounted.
   */
  visible?: boolean;
}

function geoLabel(status: GeoStatus, detail?: string): string {
  switch (status) {
    case 'tracking':
      return 'Ready';
    case 'acquiring':
      return detail ?? 'Finding fix…';
    case 'denied':
      return 'Permission denied';
    case 'unavailable':
      return 'Unavailable';
    case 'error':
      return detail ?? 'Error';
    default:
      return 'Idle';
  }
}

/** Compact interval strip for workout tiles (warmup / work / rest / …). */
function WorkoutIntervalStrip({ phases }: { phases: WorkoutPhase[] }) {
  if (phases.length === 0) {
    return (
      <div className="workout-interval-strip" aria-hidden>
        <span className="interval-seg kind-steady" style={{ flexGrow: 1 }} />
      </div>
    );
  }
  return (
    <div className="workout-interval-strip" aria-hidden>
      {phases.map((phase, i) => (
        <span
          key={`${phase.kind}-${i}`}
          className={`interval-seg kind-${phase.kind as PhaseKind}`}
          style={{ flexGrow: Math.max(1, Math.round(phaseVisualWeight(phase) / 15_000)) }}
          title={`${phaseKindLabel(phase.kind)}: ${phase.label}`}
        />
      ))}
    </div>
  );
}

function EffortDots({ level }: { level: number }) {
  const n = Math.min(5, Math.max(1, Math.round(level)));
  return (
    <span className="effort-dots" aria-label={`Effort ${n} of 5`}>
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className={`effort-dot${i < n ? ' on' : ''}`} />
      ))}
    </span>
  );
}

function workoutTileMeta(template: WorkoutTemplate): string {
  const parts: string[] = [];
  const ms = workoutTimeMs(template);
  if (ms != null) parts.push(formatDuration(ms));
  const work = workoutWorkCount(template);
  if (work > 0) parts.push(`${work} hard`);
  else parts.push(`${template.phases.length} phases`);
  return parts.join(' · ');
}

function sensorPillClass(kind: 'good' | 'warn' | 'bad' | 'neutral'): string {
  if (kind === 'neutral') return 'pill';
  return `pill ${kind}`;
}

type GoalPick = 'none' | GoalKind;

/** Six live pods; face 0 = primary, face 1 = alternate (tap to flip). */
type LivePodId = 'pace' | 'distance' | 'hr' | 'kcal' | 'avg' | 'cadence';

function flipPod(
  setPodFace: Dispatch<SetStateAction<Record<LivePodId, 0 | 1>>>,
  id: LivePodId,
) {
  setPodFace((prev) => ({ ...prev, [id]: prev[id] === 0 ? 1 : 0 }));
}

function formatSpeedMps(mps: number | null, units: Profile['units']): string {
  if (mps === null || !(mps > 0) || !Number.isFinite(mps)) return '—';
  // m/s → km/h or mph
  const display = mps * (units === 'metric' ? 3.6 : 2.2369362921);
  return display.toFixed(1);
}

function speedUnitLabel(units: Profile['units']): string {
  return units === 'metric' ? 'km/h' : 'mph';
}

export function RunScreen({
  profile,
  onFinish,
  onProfileChange,
  onToast,
  onLiveChange,
  visible = true,
}: Props) {
  const [mode, setMode] = useState<RunMode>('outdoor');
  const [tick, setTick] = useState(0);
  /** Sensors warming up; clock has not started. */
  const [arming, setArming] = useState(false);

  /** Optional bout target, chosen on the idle screen before arming. */
  const [goalPick, setGoalPick] = useState<GoalPick>('none');
  const [goalInput, setGoalInput] = useState('');

  const [workoutId, setWorkoutId] = useState<string>('none');
  /** Dedicated workout tile picker (replaces the old <select>). */
  const [workoutPickerOpen, setWorkoutPickerOpen] = useState(false);
  /** Main grid vs My Workouts list. */
  const [workoutPickerView, setWorkoutPickerView] = useState<'main' | 'mine'>('main');
  const [myWorkouts, setMyWorkouts] = useState<SavedWorkout[]>(() => loadSavedWorkouts());
  const [customWork, setCustomWork] = useState('3');
  const [customRest, setCustomRest] = useState('2');
  const [customRepeats, setCustomRepeats] = useState('6');
  const [customWarm, setCustomWarm] = useState('5');
  const [customCool, setCustomCool] = useState('5');
  const [customName, setCustomName] = useState('');
  const [customTemplate, setCustomTemplate] = useState<WorkoutTemplate | null>(null);

  const [shoes, setShoes] = useState<Shoe[]>(() => loadShoes());
  const [shoeId, setShoeId] = useState<string>(() => {
    const list = activeShoes(loadShoes());
    return list[0]?.id ?? '';
  });
  const [routes, setRoutes] = useState<SavedRoute[]>(() => loadRoutes());
  const [routeId, setRouteId] = useState<string>('');
  const [routeReversed, setRouteReversed] = useState(false);

  const sessionRef = useRef<RunSession | null>(null);
  const workoutRef = useRef<WorkoutRunner | null>(null);
  const geoRef = useRef<GeoWatcher | null>(null);
  const heartRef = useRef<HeartConnection | null>(null);
  const motionRef = useRef<MotionWatcher | null>(null);
  const podRef = useRef<FootpodConnection | null>(null);
  const lockRef = useRef<ScreenLock | null>(null);

  const [geoStatus, setGeoStatus] = useState<GeoStatus>('idle');
  const [geoDetail, setGeoDetail] = useState<string>();
  /** Latest GPS reading for the live map (even before two track points exist). */
  const [lastGeo, setLastGeo] = useState<GeoPoint | null>(null);
  const [heartStatus, setHeartStatus] = useState<HeartStatus>('disconnected');
  const [heartName, setHeartName] = useState<string>();
  const [motionStatus, setMotionStatus] = useState<MotionStatus>('idle');
  const [podStatus, setPodStatus] = useState<FootpodStatus>('disconnected');
  const [podName, setPodName] = useState<string>();
  const [bpm, setBpm] = useState<number | null>(null);
  const [cadence, setCadence] = useState<number | null>(null);
  const [manualDistance, setManualDistance] = useState('');
  const [incline, setIncline] = useState('');
  /** Pause was triggered by stillness, not the Pause button. */
  const [autoPaused, setAutoPaused] = useState(false);
  const [goalFlash, setGoalFlash] = useState(false);
  /** Expand long help text under compact sensor chips on the idle screen. */
  const [podInfoOpen, setPodInfoOpen] = useState(false);
  const [hrInfoOpen, setHrInfoOpen] = useState(false);
  /** Idle setup panels — keep Start above the fold (mockup hierarchy). */
  const [panelGoalOpen, setPanelGoalOpen] = useState(true);
  const [panelGearOpen, setPanelGearOpen] = useState(false);
  /**
   * Live metric pods: each cell flips between a primary and alternate reading
   * on tap (pace↔speed, distance↔remaining, etc.).
   */
  const [podFace, setPodFace] = useState<Record<LivePodId, 0 | 1>>({
    pace: 0,
    distance: 0,
    hr: 0,
    kcal: 0,
    avg: 0,
    cadence: 0,
  });
  /** Confirm before ending a run so Finish / Discard are not one-tap accidents. */
  const [confirmAction, setConfirmAction] = useState<null | 'finish' | 'discard'>(null);
  /** Optional target pace (m:ss per unit) for live band feedback. */
  const [paceTargetInput, setPaceTargetInput] = useState('');
  /**
   * Flash the distance pod when a whole km/mi rolls over — not every clock tick.
   * Hooks live at the top of the component (early returns later for idle/arm).
   */
  const [unitFlash, setUnitFlash] = useState(false);
  const lastWholeRef = useRef<number | null>(null);
  const flashUnitsRef = useRef(profile.units);

  const stillMsRef = useRef(0);
  const lastTickAtRef = useRef<number | null>(null);
  const cuePrevRef = useRef<CueSnapshot | null>(null);
  const cuesReadyRef = useRef(false);

  const resolveGoal = useCallback((): RunGoal | null => {
    if (goalPick === 'none') return null;
    const value = Number(goalInput);
    if (!Number.isFinite(value) || value <= 0) return null;
    if (goalPick === 'distance') return distanceGoal(value, profile.units);
    if (goalPick === 'time') return timeGoalMinutes(value);
    return caloriesGoal(value);
  }, [goalInput, goalPick, profile.units]);

  const selectedWorkout = useCallback((): WorkoutTemplate | null => {
    if (workoutId === 'none') return null;
    if (workoutId === 'custom') return customTemplate;
    const preset = WORKOUT_PRESETS.find((w) => w.id === workoutId);
    if (preset) return preset;
    const saved = savedWorkoutById(workoutId);
    return saved ? templateFromSaved(saved) : null;
  }, [workoutId, customTemplate]);

  const buildCustomFromForm = useCallback((): WorkoutTemplate => {
    return customIntervals({
      name: customName.trim() || undefined,
      warmupMin: Number(customWarm) || 0,
      workMin: Number(customWork) || 1,
      restMin: Number(customRest) || 0,
      repeats: Number(customRepeats) || 1,
      cooldownMin: Number(customCool) || 0,
    });
  }, [customName, customWarm, customWork, customRest, customRepeats, customCool]);

  const ghostRoute = (() => {
    const r = routes.find((x) => x.id === routeId);
    if (!r) return undefined;
    if (!routeReversed) return r.segments;
    return r.segments
      .slice()
      .reverse()
      .map((seg) => seg.slice().reverse());
  })();

  const session = sessionRef.current;
  const running = session?.state === 'running';
  const active = running || session?.state === 'paused';
  const live = arming || active;
  const liveDistanceM = session?.distanceM ?? 0;

  useEffect(() => {
    onLiveChange?.(live);
  }, [live, onLiveChange]);

  /*
   * A whole kilometre (or mile) is worth reporting; a passing second is not.
   * Fires on the displayed unit so a miles user gets miles, and re-baselines
   * instead of flashing when the unit setting itself changes.
   * Kept above early returns so hook order never changes.
   */
  useEffect(() => {
    if (!session || (session.state !== 'running' && session.state !== 'paused')) {
      lastWholeRef.current = null;
      return;
    }
    const whole = Math.floor(toDisplayDistance(liveDistanceM, profile.units));
    const previous = lastWholeRef.current;
    const rebase = previous === null || flashUnitsRef.current !== profile.units;
    flashUnitsRef.current = profile.units;
    lastWholeRef.current = whole;

    if (rebase || whole <= previous) return;

    setUnitFlash(true);
    const timer = setTimeout(() => setUnitFlash(false), 700);
    return () => clearTimeout(timer);
  }, [liveDistanceM, profile.units, session, session?.state]);

  // Android: ongoing notification + home widget while the clock is live.
  useEffect(() => {
    if (!active || !session) {
      void stopLiveRunNotification();
      return;
    }
    const elapsedMs = session.elapsedMs();
    const distanceM = session.distanceM;
    const paceSec = paceSecondsPerUnit(distanceM, elapsedMs, profile.units);
    const distLabel = `${formatDistance(distanceM, profile.units)} ${distanceLabel(profile.units)}`;
    const paceStr = `${formatPace(paceSec)} ${paceLabel(profile.units)}`;
    const timeStr = formatDuration(elapsedMs);
    const hrStr = bpm !== null ? `${bpm} bpm` : '';
    const title = session.mode === 'treadmill' ? 'Treadmill' : 'Outdoor run';
    const snapshot = {
      active: true,
      paused: session.state === 'paused',
      title,
      time: timeStr,
      distance: distLabel,
      pace: paceStr,
      hr: hrStr,
    };
    void updateLiveRunNotification(snapshot);
  }, [active, running, tick, session, bpm, profile.units]);

  // RunScreen stays mounted across tabs — reload shoes/routes whenever the
  // tab is shown again so Settings changes appear without a full reload.
  useEffect(() => {
    if (!visible || live) return;
    const nextShoes = loadShoes();
    setShoes(nextShoes);
    setRoutes(loadRoutes());
    const active = activeShoes(nextShoes);
    setShoeId((current) => {
      if (current && active.some((s) => s.id === current)) return current;
      return active[0]?.id ?? '';
    });
  }, [visible, live]);

  // Tenths while the clock is running; one second is enough when paused.
  useEffect(() => {
    if (!active) return;
    const ms = running ? 100 : 1000;
    const id = setInterval(() => setTick((t) => t + 1), ms);
    return () => clearInterval(id);
  }, [active, running]);

  // Auto-pause / auto-resume + audio / goal alerts on each UI tick.
  useEffect(() => {
    const current = sessionRef.current;
    if (!current || (current.state !== 'running' && current.state !== 'paused')) {
      lastTickAtRef.current = null;
      return;
    }

    const now = Date.now();
    const last = lastTickAtRef.current;
    const dt = last === null ? 0 : Math.min(2000, Math.max(0, now - last));
    lastTickAtRef.current = now;

    const speed = current.recentSpeed(15_000, now);
    const supported =
      current.mode === 'outdoor' || (current.mode === 'treadmill' && podStatus === 'connected');

    if (current.state === 'running') {
      stillMsRef.current = nextStillMs(stillMsRef.current, speed, true, dt);
    } else {
      stillMsRef.current = 0;
    }

    let autoFlag = autoPaused;
    const action = autoPauseAction({
      speedMps: speed,
      running: current.state === 'running',
      paused: current.state === 'paused',
      autoPaused: autoFlag,
      stillMs: stillMsRef.current,
      enabled: profile.autoPause,
      supported,
    });

    if (action === 'pause' && current.state === 'running') {
      current.pause(now);
      autoFlag = true;
      setAutoPaused(true);
      stillMsRef.current = 0;
    } else if (action === 'resume' && current.state === 'paused' && autoFlag) {
      current.resume(now);
      autoFlag = false;
      setAutoPaused(false);
    }

    // Cues (after auto-pause may have changed state)
    if (!cuesReadyRef.current) return;

    const elapsed = current.elapsedMs(now);
    const calories = current.caloriesKcal(now);
    const snap = makeSnapshot({
      distanceM: current.distanceM,
      durationMs: elapsed,
      caloriesKcal: calories,
      state: current.state,
      goal: current.goal,
      lapCount: current.manualLaps.length,
      autoPaused: autoFlag,
      units: profile.units,
    });

    const events = pendingCues(cuePrevRef.current, snap, {
      units: profile.units,
      distanceCues: profile.audioCues,
      goalCues: true,
    });
    cuePrevRef.current = snap;

    const paceTargetSec = parsePaceInput(paceTargetInput);

    for (const event of events) {
      if (event.type === 'goal_met') {
        setGoalFlash(true);
        pulse([80, 40, 80, 40, 120]);
        onToast('Goal reached!');
      }
      if (event.type === 'auto_paused') pulse(50);
      if (event.type === 'auto_resumed') pulse(30);

      const speakable =
        profile.audioCues || event.type === 'goal_met' || event.type === 'auto_paused';
      if (speakable) {
        speak(
          cueSpeech(event, {
            units: profile.units,
            distanceM: current.distanceM,
            durationMs: elapsed,
            formatDistance: (m) => formatDistance(m, profile.units),
            formatDuration,
          }),
        );
      }

      // Soft pace-band nudge on each whole km/mi when audio cues are on.
      if (event.type === 'distance_unit' && profile.audioCues && paceTargetSec) {
        const unitM = profile.units === 'metric' ? 1000 : 1609.344;
        const recent = current.recentSpeed(20_000, now);
        const paceNow = recent && recent > 0 ? unitM / recent : null;
        const band = paceBandStatus(paceNow, paceTargetSec);
        const line = paceBandCueSpeech(band, paceTargetSec, profile.units);
        if (line) speak(line);
      }
    }

    // Structured workout phase advances.
    const runner = workoutRef.current;
    if (runner && current.state === 'running') {
      const advanced = runner.tick(current.distanceM, elapsed);
      if (advanced > 0) {
        pulse([40, 30, 60]);
        if (runner.done) {
          onToast('Workout complete');
          if (profile.audioCues) speak('Workout complete.');
        } else {
          const phase = runner.current();
          if (phase && profile.audioCues) {
            speak(`${phaseKindLabel(phase.kind)}. ${phase.label}.`);
          }
        }
      }
    }
    // `tick` re-fires this on the live clock interval.
  }, [
    tick,
    active,
    running,
    autoPaused,
    profile.autoPause,
    profile.audioCues,
    profile.units,
    paceTargetInput,
    podStatus,
    onToast,
  ]);

  const stopSensors = useCallback(() => {
    geoRef.current?.stop();
    geoRef.current = null;
    motionRef.current?.stop();
    motionRef.current = null;
    lockRef.current?.release();
    lockRef.current = null;
  }, []);

  // Bluetooth devices deliberately survive this: they are disconnected only on
  // unmount, so they stay paired between back-to-back runs. Mid-run the parent
  // keeps this component mounted across tabs, so this cleanup only runs when
  // the app itself tears down.
  useEffect(
    () => () => {
      stopSensors();
      heartRef.current?.disconnect();
      podRef.current?.disconnect();
    },
    [stopSensors],
  );

  const startGeoWatch = useCallback((target: RunSession) => {
    geoRef.current?.stop();
    geoRef.current = watchPosition({
      onPoint: (point) => {
        // Always keep a position for the map; distance only counts while running.
        setLastGeo(point);
        if (sessionRef.current?.state === 'running') target.addPoint(point);
      },
      onStatus: (status, detail) => {
        setGeoStatus(status);
        setGeoDetail(detail);
      },
    });
  }, []);

  const startMotionWatch = useCallback(
    async (target: RunSession) => {
      const granted = await requestMotionPermission();
      if (granted) {
        motionRef.current?.stop();
        motionRef.current = countSteps(
          {
            onStep: (steps, stepCadence) => {
              if (sessionRef.current?.state === 'running') {
                // The detector owns the count; the session is told the delta so
                // its distance stays in step with it.
                target.addSteps(steps - target.steps);
              }
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
    },
    [onToast, profile.strideM],
  );

  /**
   * Arm: create the session and warm sensors, but leave the clock at zero
   * until the athlete explicitly starts (or starts after waiting for a fix).
   */
  const arm = async () => {
    // Reload shoes so Profile edits show on Get ready.
    const nextShoes = loadShoes();
    setShoes(nextShoes);
    const active = activeShoes(nextShoes);
    const resolvedShoe =
      shoeId && active.some((s) => s.id === shoeId) ? shoeId : (active[0]?.id ?? '');
    setShoeId(resolvedShoe);

    const workout = selectedWorkout();
    const created = new RunSession({
      mode,
      strideM: profile.strideM,
      footpodCalibration: profile.footpodCalibration,
      weightKg: profile.weightKg,
      age: profile.age,
      sex: profile.sex,
      maxHeartRate: profile.maxHeartRate,
      goal: resolveGoal(),
      shoeId: resolvedShoe || null,
      workoutId: workout?.id ?? null,
      workoutName: workout?.name ?? null,
    });
    sessionRef.current = created;
    workoutRef.current = workout ? new WorkoutRunner(workout) : null;
    setArming(true);
    setGeoStatus(mode === 'outdoor' ? 'acquiring' : 'idle');
    setGeoDetail(undefined);

    if (mode === 'outdoor') {
      startGeoWatch(created);
    } else if (podRef.current) {
      // Pod already connected from the idle screen; motion is not needed.
      setMotionStatus('idle');
    } else {
      await startMotionWatch(created);
    }

    setTick((t) => t + 1);
  };

  /** Begin: start the moving-time clock (and wake lock). Sensors already warm. */
  const begin = async () => {
    const current = sessionRef.current;
    if (!current || current.state !== 'idle') return;

    warmSpeech();
    // Shoe may have been chosen on the get-ready screen after arm().
    current.setShoeId(shoeId || null);
    current.start();
    workoutRef.current?.begin(current.distanceM, current.elapsedMs());
    setArming(false);
    setAutoPaused(false);
    setGoalFlash(false);
    stillMsRef.current = 0;
    lastTickAtRef.current = null;
    cuePrevRef.current = null;
    cuesReadyRef.current = true;

    if (profile.keepAwake) lockRef.current = await keepScreenAwake();

    if (profile.audioCues && workoutRef.current?.current()) {
      const phase = workoutRef.current.current()!;
      speak(`${phaseKindLabel(phase.kind)}. ${phase.label}.`);
    }

    void startLiveRunNotification({
      title: current.mode === 'treadmill' ? 'Treadmill' : 'Outdoor run',
      time: '0:00',
      distance: `0.00 ${distanceLabel(profile.units)}`,
      pace: `--:-- ${paceLabel(profile.units)}`,
      hr: bpm !== null ? `${bpm} bpm` : '',
      paused: false,
    });

    setTick((t) => t + 1);
  };

  const cancelArming = () => {
    stopSensors();
    sessionRef.current = null;
    workoutRef.current = null;
    setArming(false);
    setAutoPaused(false);
    setGoalFlash(false);
    cuesReadyRef.current = false;
    cuePrevRef.current = null;
    setGeoStatus('idle');
    setGeoDetail(undefined);
    setLastGeo(null);
    setCadence(null);
    void stopLiveRunNotification();
    setShoes(loadShoes());
    setRoutes(loadRoutes());
    setTick((t) => t + 1);
  };

  const connectPod = async () => {
    const connection = await connectFootpod({
      onMeasurement: (measurement) => {
        // Always accept packets when connected; session only stores while running.
        if (sessionRef.current?.state === 'running') {
          sessionRef.current.addFootpod(measurement);
        }
        // Show cadence even at idle so the user sees the pod is streaming.
        if (measurement.cadenceSpm > 0) {
          setCadence(measurement.cadenceSpm);
        } else if (measurement.speedMps > 0.1) {
          // Some pods report speed before cadence ticks up.
          setCadence((c) => c ?? 0);
        }
        setTick((t) => t + 1);
      },
      onStatus: (status, detail) => {
        setPodStatus(status);
        if (status === 'connected') {
          setPodName(detail);
          if (detail && /waiting for motion|shake/i.test(detail)) {
            onToast(detail);
          }
        } else if (detail) {
          onToast(detail);
        }
        if (status === 'disconnected') setCadence(null);
      },
    });
    if (connection) podRef.current = connection;
  };

  const connectStrap = async () => {
    const connection = await connectHeartRate({
      onReading: (reading) => {
        setBpm(reading);
        if (sessionRef.current?.state === 'running') {
          sessionRef.current.addHeart(reading);
        }
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
    setArming(false);
    void stopLiveRunNotification();

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
    setLastGeo(null);
    setAutoPaused(false);
    setGoalFlash(false);
    cuesReadyRef.current = false;
    cuePrevRef.current = null;
    workoutRef.current = null;
    onFinish(activity);
  };

  const discard = () => {
    sessionRef.current?.finish();
    stopSensors();
    sessionRef.current = null;
    setArming(false);
    setManualDistance('');
    setIncline('');
    setAutoPaused(false);
    setGoalFlash(false);
    cuesReadyRef.current = false;
    cuePrevRef.current = null;
    workoutRef.current = null;
    setGeoStatus('idle');
    setGeoDetail(undefined);
    setLastGeo(null);
    void stopLiveRunNotification();
    setShoes(loadShoes());
    setRoutes(loadRoutes());
    setTick((t) => t + 1);
  };

  const markLap = () => {
    const current = sessionRef.current;
    if (!current) return;
    const lap = current.lap();
    if (lap) setTick((t) => t + 1);
  };

  // --- Idle ---------------------------------------------------------------

  if (!session && !arming && workoutPickerOpen) {
    const freeSelected = workoutId === 'none';
    const customSelected = workoutId === 'custom';

    if (workoutPickerView === 'mine') {
      return (
        <div className="screen workout-picker-screen">
          <button
            type="button"
            className="back"
            onClick={() => setWorkoutPickerView('main')}
          >
            ‹ Workouts
          </button>
          <h1>My Workouts</h1>
          <p className="subtitle">
            {myWorkouts.length === 0
              ? 'Nothing saved yet — build one under Custom intervals'
              : 'Your saved interval sessions'}
          </p>
          <div className="workout-tile-grid">
            {myWorkouts.map((w) => {
              const t = templateFromSaved(w);
              const selected = workoutId === w.id;
              return (
                <div
                  key={w.id}
                  className={`workout-tile workout-tile-saved${selected ? ' selected' : ''}`}
                >
                  <button
                    type="button"
                    className="workout-tile-hit"
                    onClick={() => {
                      setCustomTemplate(t);
                      setWorkoutId(w.id);
                      setWorkoutPickerOpen(false);
                      setWorkoutPickerView('main');
                      onToast(`Workout: ${w.name}`);
                    }}
                  >
                    <div className="workout-tile-top">
                      <span className="workout-tile-name">{w.name}</span>
                      <EffortDots level={workoutEffortLevel(t)} />
                    </div>
                    <WorkoutIntervalStrip phases={w.phases} />
                    <p className="workout-tile-blurb">{w.blurb || 'Saved custom workout'}</p>
                    <span className="workout-tile-meta">{workoutTileMeta(t)}</span>
                  </button>
                  <button
                    type="button"
                    className="btn danger workout-tile-delete"
                    onClick={() => {
                      deleteSavedWorkout(w.id);
                      setMyWorkouts(loadSavedWorkouts());
                      if (workoutId === w.id) {
                        setWorkoutId('none');
                        setCustomTemplate(null);
                      }
                      onToast('Workout deleted');
                    }}
                  >
                    Delete
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    return (
      <div className="screen workout-picker-screen">
        <button
          type="button"
          className="back"
          onClick={() => {
            setWorkoutPickerOpen(false);
            setWorkoutPickerView('main');
          }}
        >
          ‹ Back
        </button>
        <h1>Workout</h1>
        <p className="subtitle">Choose a structure — each tile shows effort and intervals</p>

        <div className="workout-tile-grid">
          <button
            type="button"
            className={`workout-tile${freeSelected ? ' selected' : ''}`}
            onClick={() => {
              setWorkoutId('none');
              setWorkoutPickerOpen(false);
            }}
          >
            <div className="workout-tile-top">
              <span className="workout-tile-name">Free run</span>
              <EffortDots level={1} />
            </div>
            <WorkoutIntervalStrip
              phases={[{ kind: 'steady', label: 'Free', target: { type: 'time', ms: 1 } }]}
            />
            <p className="workout-tile-blurb">No structure — just start and go.</p>
            <span className="workout-tile-meta">Open-ended</span>
          </button>

          <button
            type="button"
            className={`workout-tile${workoutId.startsWith('my-') ? ' selected' : ''}`}
            onClick={() => {
              setMyWorkouts(loadSavedWorkouts());
              setWorkoutPickerView('mine');
            }}
          >
            <div className="workout-tile-top">
              <span className="workout-tile-name">My Workouts</span>
              <span className="workout-tile-badge">{myWorkouts.length}</span>
            </div>
            <WorkoutIntervalStrip
              phases={
                myWorkouts[0]?.phases ?? [
                  { kind: 'work', label: 'W', target: { type: 'time', ms: 1 } },
                  { kind: 'rest', label: 'R', target: { type: 'time', ms: 1 } },
                  { kind: 'work', label: 'W', target: { type: 'time', ms: 1 } },
                ]
              }
            />
            <p className="workout-tile-blurb">
              {myWorkouts.length === 0
                ? 'Save custom intervals here for reuse.'
                : 'Open your saved sessions.'}
            </p>
            <span className="workout-tile-meta">
              {myWorkouts.length === 0 ? 'Empty' : `${myWorkouts.length} saved`} ›
            </span>
          </button>

          {WORKOUT_PRESETS.map((w) => {
            const selected = workoutId === w.id;
            return (
              <button
                key={w.id}
                type="button"
                className={`workout-tile${selected ? ' selected' : ''}`}
                onClick={() => {
                  setWorkoutId(w.id);
                  setWorkoutPickerOpen(false);
                }}
              >
                <div className="workout-tile-top">
                  <span className="workout-tile-name">{w.name}</span>
                  <EffortDots level={workoutEffortLevel(w)} />
                </div>
                <WorkoutIntervalStrip phases={w.phases} />
                <p className="workout-tile-blurb">{w.blurb}</p>
                <span className="workout-tile-meta">{workoutTileMeta(w)}</span>
              </button>
            );
          })}

          <div className={`workout-tile workout-tile-custom${customSelected ? ' selected' : ''}`}>
            <button
              type="button"
              className="workout-tile-hit"
              onClick={() => setWorkoutId('custom')}
            >
              <div className="workout-tile-top">
                <span className="workout-tile-name">Custom intervals</span>
                <EffortDots
                  level={
                    customTemplate ? workoutEffortLevel(customTemplate) : 3
                  }
                />
              </div>
              <WorkoutIntervalStrip
                phases={
                  customTemplate?.phases ?? [
                    { kind: 'warmup', label: 'W', target: { type: 'time', ms: 5 * 60_000 } },
                    { kind: 'work', label: 'H', target: { type: 'time', ms: 3 * 60_000 } },
                    { kind: 'rest', label: 'R', target: { type: 'time', ms: 2 * 60_000 } },
                    { kind: 'work', label: 'H', target: { type: 'time', ms: 3 * 60_000 } },
                    { kind: 'rest', label: 'R', target: { type: 'time', ms: 2 * 60_000 } },
                    { kind: 'cooldown', label: 'C', target: { type: 'time', ms: 5 * 60_000 } },
                  ]
                }
              />
              <p className="workout-tile-blurb">
                {customTemplate?.blurb ?? 'Build your own work / rest repeats.'}
              </p>
              <span className="workout-tile-meta">
                {customTemplate ? workoutTileMeta(customTemplate) : 'Tap to edit below'}
              </span>
            </button>

            {(customSelected || workoutId === 'custom') && (
              <div className="custom-workout workout-tile-custom-form">
                <div className="field">
                  <label htmlFor="cw-name">Name (for Save)</label>
                  <input
                    id="cw-name"
                    type="text"
                    maxLength={48}
                    placeholder="e.g. Tuesday hills"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                  />
                </div>
                <div className="field-row">
                  <div className="field">
                    <label htmlFor="cw-warm">Warm-up (min)</label>
                    <input
                      id="cw-warm"
                      type="number"
                      min="0"
                      value={customWarm}
                      onChange={(e) => setCustomWarm(e.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="cw-cool">Cool-down (min)</label>
                    <input
                      id="cw-cool"
                      type="number"
                      min="0"
                      value={customCool}
                      onChange={(e) => setCustomCool(e.target.value)}
                    />
                  </div>
                </div>
                <div className="field-row">
                  <div className="field">
                    <label htmlFor="cw-work">Work (min)</label>
                    <input
                      id="cw-work"
                      type="number"
                      min="0.5"
                      step="0.5"
                      value={customWork}
                      onChange={(e) => setCustomWork(e.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="cw-rest">Rest (min)</label>
                    <input
                      id="cw-rest"
                      type="number"
                      min="0"
                      step="0.5"
                      value={customRest}
                      onChange={(e) => setCustomRest(e.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="cw-reps">Repeats</label>
                    <input
                      id="cw-reps"
                      type="number"
                      min="1"
                      max="40"
                      value={customRepeats}
                      onChange={(e) => setCustomRepeats(e.target.value)}
                    />
                  </div>
                </div>
                <div className="btn-row">
                  <button
                    type="button"
                    className="btn primary"
                    onClick={() => {
                      const t = buildCustomFromForm();
                      setCustomTemplate(t);
                      setWorkoutId('custom');
                      onToast(`Custom workout: ${t.blurb}`);
                      setWorkoutPickerOpen(false);
                      setWorkoutPickerView('main');
                    }}
                  >
                    Use this workout
                  </button>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => {
                      const t = buildCustomFromForm();
                      const saved = addSavedWorkout(
                        t,
                        customName.trim() || t.name,
                      );
                      setMyWorkouts(loadSavedWorkouts());
                      setCustomTemplate(templateFromSaved(saved));
                      setWorkoutId(saved.id);
                      onToast(`Saved “${saved.name}” to My Workouts`);
                    }}
                  >
                    Save workout
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (!session && !arming) {
    const isHud = profile.theme === 'hud';
    const resolvedWorkout = selectedWorkout();
    const workoutSummary =
      workoutId === 'none'
        ? 'Free run'
        : resolvedWorkout?.name ??
          (workoutId === 'custom' ? 'Custom intervals' : 'Workout');
    const workoutBlurb =
      workoutId === 'none'
        ? 'No structure'
        : resolvedWorkout?.blurb ?? '';
    const goalSummary =
      goalPick === 'none'
        ? 'Free run'
        : resolveGoal()
          ? formatGoalTarget(resolveGoal()!, profile.units)
          : goalKindLabel(goalPick);
    const shoeSummary =
      activeShoes(shoes).find((s) => s.id === shoeId)?.name ??
      (activeShoes(shoes).length === 0 ? 'None' : 'None');
    const selectedForStrip: WorkoutPhase[] | null =
      workoutId === 'none' ? null : resolvedWorkout?.phases ?? null;

    return (
      <div className="screen run-idle">
        <div className="title-row">
          <div>
            <h1>New run</h1>
            <p className="subtitle">Local only · data stays on this device</p>
          </div>
        </div>

        <div className="mode-switch" role="group" aria-label="Run mode">
          <button type="button" aria-pressed={mode === 'outdoor'} onClick={() => setMode('outdoor')}>
            Outdoor
          </button>
          <button
            type="button"
            aria-pressed={mode === 'treadmill'}
            onClick={() => setMode('treadmill')}
          >
            Treadmill
          </button>
        </div>
        <p className="mode-blurb">
          {mode === 'outdoor'
            ? 'GPS tracks route, distance and pace.'
            : 'Foot pod, step counting, or type the console distance in.'}
        </p>

        <div className="run-hero-start">
          <span className="run-ready-pill">Ready when you are</span>
          <button type="button" className="start-control" onClick={arm}>
            <span className="start-control-face" aria-hidden />
            <span className="start-control-label">{isHud ? 'GO' : 'START'}</span>
            <span className="start-control-sub">{isHud ? 'Tap to arm' : 'Arm sensors'}</span>
          </button>
          <p className="hint run-hero-hint">
            Arms GPS / sensors first — the clock starts on the next screen.
          </p>
        </div>

        <div className={`card setup-panel${panelGoalOpen ? ' open' : ''}`}>
          <button
            type="button"
            className="setup-panel-head"
            aria-expanded={panelGoalOpen}
            onClick={() => setPanelGoalOpen((v) => !v)}
          >
            <h2>Goal</h2>
            <span className="setup-panel-summary">{goalSummary}</span>
            <span className="setup-panel-chev" aria-hidden>
              {panelGoalOpen ? '▾' : '▸'}
            </span>
          </button>
          {panelGoalOpen && (
            <div className="setup-panel-body">
              <div className="goal-kinds">
                {(
                  [
                    ['none', 'Free run'],
                    ['distance', 'Distance'],
                    ['time', 'Time'],
                    ['calories', 'Calories'],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={goalPick === id}
                    onClick={() => {
                      setGoalPick(id);
                      if (id === 'none') setGoalInput('');
                      else if (id === 'distance' && !goalInput) {
                        setGoalInput(profile.units === 'metric' ? '5' : '3');
                      } else if (id === 'time' && !goalInput) {
                        setGoalInput('30');
                      } else if (id === 'calories' && !goalInput) {
                        setGoalInput('300');
                      }
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {goalPick !== 'none' && (
                <>
                  <div className="field" style={{ marginTop: 14 }}>
                    <label htmlFor="run-goal">
                      {goalPick === 'distance'
                        ? `Target (${distanceLabel(profile.units)})`
                        : goalPick === 'time'
                          ? 'Target (minutes)'
                          : 'Target (kcal)'}
                    </label>
                    <input
                      id="run-goal"
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step={goalPick === 'distance' ? '0.1' : '1'}
                      value={goalInput}
                      onChange={(e) => setGoalInput(e.target.value)}
                    />
                  </div>

                  <div className="chip-row">
                    {goalPick === 'distance' &&
                      (profile.units === 'metric' ? [1, 3, 5, 10] : [1, 2, 3, 5]).map((n) => (
                        <button
                          key={n}
                          type="button"
                          className={`chip${goalInput === String(n) ? ' active' : ''}`}
                          onClick={() => setGoalInput(String(n))}
                        >
                          {n}
                          {profile.units === 'metric' ? ' km' : ' mi'}
                        </button>
                      ))}
                    {goalPick === 'time' &&
                      [15, 20, 30, 45, 60].map((n) => (
                        <button
                          key={n}
                          type="button"
                          className={`chip${goalInput === String(n) ? ' active' : ''}`}
                          onClick={() => setGoalInput(String(n))}
                        >
                          {n} min
                        </button>
                      ))}
                    {goalPick === 'calories' &&
                      [150, 250, 350, 500].map((n) => (
                        <button
                          key={n}
                          type="button"
                          className={`chip${goalInput === String(n) ? ' active' : ''}`}
                          onClick={() => setGoalInput(String(n))}
                        >
                          {n} kcal
                        </button>
                      ))}
                  </div>

                  {resolveGoal() ? (
                    <p className="hint">
                      Goal: {formatGoalTarget(resolveGoal()!, profile.units)}. Progress shows live
                      once you start.
                    </p>
                  ) : (
                    <p className="hint">Enter a target above, or pick a preset.</p>
                  )}
                </>
              )}

              {goalPick === 'none' && (
                <p className="hint">No target — just start and run. Calories are still estimated.</p>
              )}

              <div className="field" style={{ marginTop: 14 }}>
                <label htmlFor="pace-target">Target pace (optional)</label>
                <input
                  id="pace-target"
                  type="text"
                  inputMode="decimal"
                  placeholder={profile.units === 'metric' ? 'e.g. 5:30' : 'e.g. 8:30'}
                  value={paceTargetInput}
                  onChange={(e) => setPaceTargetInput(e.target.value)}
                />
                <div className="chip-row" style={{ marginTop: 8 }}>
                  {(profile.units === 'metric'
                    ? ['4:30', '5:00', '5:30', '6:00', '6:30']
                    : ['7:00', '8:00', '8:30', '9:00', '10:00']
                  ).map((p) => (
                    <button
                      key={p}
                      type="button"
                      className={`chip${paceTargetInput === p ? ' active' : ''}`}
                      onClick={() => setPaceTargetInput(p)}
                    >
                      {p}
                    </button>
                  ))}
                  {paceTargetInput && (
                    <button
                      type="button"
                      className="chip"
                      onClick={() => setPaceTargetInput('')}
                    >
                      Off
                    </button>
                  )}
                </div>
                {parsePaceInput(paceTargetInput) ? (
                  <p className="hint">
                    Band ±{Math.round(DEFAULT_PACE_BAND * 100)}% around{' '}
                    {formatTargetPace(parsePaceInput(paceTargetInput)!, profile.units)}. Live cue
                    if you drift.
                  </p>
                ) : paceTargetInput.trim() ? (
                  <p className="hint" style={{ color: 'var(--warn)' }}>
                    Use m:ss (e.g. 5:30).
                  </p>
                ) : (
                  <p className="hint">
                    Optional pacing guide — independent of distance/time goals above.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="card workout-card">
          <button
            type="button"
            className="workout-open-btn"
            onClick={() => {
              setMyWorkouts(loadSavedWorkouts());
              setWorkoutPickerView('main');
              setWorkoutPickerOpen(true);
            }}
          >
            <div className="workout-open-btn-main">
              <span className="workout-open-btn-label">Workout</span>
              <span className="workout-open-btn-name">{workoutSummary}</span>
              {workoutBlurb && (
                <span className="workout-open-btn-blurb">{workoutBlurb}</span>
              )}
            </div>
            {selectedForStrip && selectedForStrip.length > 0 ? (
              <WorkoutIntervalStrip phases={selectedForStrip} />
            ) : (
              <WorkoutIntervalStrip
                phases={[{ kind: 'steady', label: 'Free', target: { type: 'time', ms: 1 } }]}
              />
            )}
            <span className="workout-open-btn-cta">Choose workout ›</span>
          </button>
        </div>

        <div className={`card setup-panel${panelGearOpen ? ' open' : ''}`}>
          <button
            type="button"
            className="setup-panel-head"
            aria-expanded={panelGearOpen}
            onClick={() => setPanelGearOpen((v) => !v)}
          >
            <h2>Route &amp; shoes</h2>
            <span className="setup-panel-summary">
              {mode === 'outdoor' && routeId
                ? routes.find((r) => r.id === routeId)?.name ?? 'Route'
                : mode === 'outdoor'
                  ? 'No ghost route'
                  : 'Treadmill'}
              {' · '}
              {shoeSummary}
            </span>
            <span className="setup-panel-chev" aria-hidden>
              {panelGearOpen ? '▾' : '▸'}
            </span>
          </button>
          {panelGearOpen && (
            <div className="setup-panel-body">
              {mode === 'outdoor' && routes.length > 0 && (
                <>
                  <div className="kv-row" style={{ marginTop: 12 }}>
                    <span className="kv-k">Ghost route</span>
                    <span className="kv-v">
                      {routeId ? routes.find((r) => r.id === routeId)?.name ?? '—' : 'None'}
                    </span>
                  </div>
                  <select
                    className="select"
                    value={routeId}
                    onChange={(e) => setRouteId(e.target.value)}
                  >
                    <option value="">None</option>
                    {routes.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} · {formatDistance(r.distanceM, profile.units)}{' '}
                        {distanceLabel(profile.units)}
                      </option>
                    ))}
                  </select>
                  {routeId && (
                    <div className="row" style={{ marginTop: 10 }}>
                      <span>Reverse direction</span>
                      <button
                        type="button"
                        className="btn"
                        aria-pressed={routeReversed}
                        onClick={() => setRouteReversed((v) => !v)}
                      >
                        {routeReversed ? 'On' : 'Off'}
                      </button>
                    </div>
                  )}
                  <p className="hint">Grey path under your live track — not turn-by-turn nav.</p>
                </>
              )}

              <div className="kv-row" style={{ marginTop: 12 }}>
                <span className="kv-k">Shoes</span>
                <span className="kv-v">{shoeSummary}</span>
              </div>
              <p className="hint" style={{ marginBottom: 0 }}>
                Pair assignment is on the Get ready screen after you arm.
              </p>
            </div>
          )}
        </div>

        <div className="card sensor-compact">
          <h2>Sensors</h2>
          <div className="sensor-chip-row sensor-chip-row-pair">
            <div className="sensor-chip-group">
              <button
                type="button"
                className={`sensor-chip${podStatus === 'connected' ? ' on' : ''}${podStatus === 'connecting' ? ' busy' : ''}`}
                disabled={!bluetoothSupported() && podStatus !== 'connected'}
                onClick={() => {
                  if (podStatus === 'connected') {
                    podRef.current?.disconnect();
                    podRef.current = null;
                    setPodStatus('disconnected');
                    setPodName(undefined);
                  } else {
                    void connectPod();
                  }
                }}
              >
                <span
                  className={`dot${podStatus === 'connected' ? ' live' : ''}`}
                  data-state={
                    podStatus === 'connected'
                      ? 'good'
                      : podStatus === 'connecting'
                        ? 'warn'
                        : 'idle'
                  }
                />
                <span className="sensor-chip-text">
                  <span className="sensor-chip-title">Foot pod</span>
                  <span className="sensor-chip-status">
                    {podStatus === 'connected'
                      ? podName ?? 'Connected'
                      : podStatus === 'connecting'
                        ? 'Connecting…'
                        : bluetoothSupported()
                          ? 'Tap'
                          : 'N/A'}
                  </span>
                </span>
              </button>
              <button
                type="button"
                className={`sensor-info${podInfoOpen ? ' open' : ''}`}
                aria-label="Foot pod information"
                aria-expanded={podInfoOpen}
                onClick={() => setPodInfoOpen((v) => !v)}
              >
                i
              </button>
            </div>

            <div className="sensor-chip-group">
              <button
                type="button"
                className={`sensor-chip${heartStatus === 'connected' ? ' on' : ''}${heartStatus === 'connecting' ? ' busy' : ''}`}
                disabled={!bluetoothSupported() && heartStatus !== 'connected'}
                onClick={() => {
                  if (heartStatus === 'connected') {
                    heartRef.current?.disconnect();
                    heartRef.current = null;
                    setHeartStatus('disconnected');
                    setHeartName(undefined);
                    setBpm(null);
                  } else {
                    void connectStrap();
                  }
                }}
              >
                <span
                  className={`dot${heartStatus === 'connected' ? ' live' : ''}`}
                  data-state={
                    heartStatus === 'connected'
                      ? 'good'
                      : heartStatus === 'connecting'
                        ? 'warn'
                        : 'idle'
                  }
                />
                <span className="sensor-chip-text">
                  <span className="sensor-chip-title">Heart rate</span>
                  <span className="sensor-chip-status">
                    {heartStatus === 'connected'
                      ? heartName ?? 'Connected'
                      : heartStatus === 'connecting'
                        ? 'Connecting…'
                        : bluetoothSupported()
                          ? 'Tap'
                          : 'N/A'}
                  </span>
                </span>
              </button>
              <button
                type="button"
                className={`sensor-info${hrInfoOpen ? ' open' : ''}`}
                aria-label="Heart rate information"
                aria-expanded={hrInfoOpen}
                onClick={() => setHrInfoOpen((v) => !v)}
              >
                i
              </button>
            </div>
          </div>
          {podInfoOpen && (
            <p className="hint sensor-info-body">
              {bluetoothSupported()
                ? 'Any pod using the standard running speed and cadence profile — Zwift RunPod, Stryd, Garmin or Polar. On a treadmill it measures speed at the shoe. Give it a shake first; most pods only advertise once they are moving. Tap the button again to disconnect.'
                : 'This browser has no Web Bluetooth. Chrome on Android supports it; Safari does not.'}
            </p>
          )}
          {hrInfoOpen && (
            <p className="hint sensor-info-body">
              {bluetoothSupported()
                ? 'Any Bluetooth chest strap or watch using the standard heart rate service. Connect before you start so zones and the HR calorie model come with the run. Tap the button again to disconnect.'
                : 'This browser has no Web Bluetooth. Chrome on Android supports it; Safari does not.'}
            </p>
          )}
        </div>
      </div>
    );
  }

  // --- Arming: sensors on, clock not yet ------------------------------------------------

  if (arming && session?.state === 'idle') {
    const gpsReady = geoStatus === 'tracking';
    const gpsBad = geoStatus === 'denied' || geoStatus === 'unavailable' || geoStatus === 'error';
    const hrReady = heartStatus === 'connected';
    const podReady = podStatus === 'connected';
    const stepsReady = motionStatus === 'counting';
    const armedGoal = session.goal;

    return (
      <div className="screen">
        <h1>Get ready</h1>
        <p className="subtitle">
          Check sensors before the clock starts. Wait for a fix, or start immediately.
        </p>

        {armedGoal && (
          <div className="card">
            <h2>Goal</h2>
            <p className="goal-summary">
              {goalKindLabel(armedGoal.kind)} · {formatGoalTarget(armedGoal, profile.units)}
            </p>
          </div>
        )}

        <div className="card">
          <h2>Shoes</h2>
          {activeShoes(shoes).length === 0 ? (
            <p className="hint" style={{ marginTop: 0 }}>
              No active pairs yet. Add shoes under <strong>Profile → Shoes</strong>, then return
              here to assign them.
            </p>
          ) : (
            <>
              <select
                className="select"
                id="ready-shoe"
                value={shoeId}
                onChange={(e) => {
                  const id = e.target.value;
                  setShoeId(id);
                  session.setShoeId(id || null);
                }}
              >
                <option value="">None</option>
                {activeShoes(shoes).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {s.brand ? ` (${s.brand})` : ''} ·{' '}
                    {formatDistance(s.distanceM, profile.units)} {distanceLabel(profile.units)}
                    {shoeNeedsWarning(s) ? ' ⚠' : ''}
                  </option>
                ))}
              </select>
              {(() => {
                const shoe = shoes.find((s) => s.id === shoeId);
                return shoe && shoeNeedsWarning(shoe) ? (
                  <p className="hint" style={{ color: 'var(--warn)' }}>
                    This pair is at or past its wear limit — consider retiring it in Profile.
                  </p>
                ) : (
                  <p className="hint">Mileage is added when you finish the run.</p>
                );
              })()}
            </>
          )}
        </div>

        <div className="card sensor-status">
          <h2>Sensors</h2>

          {mode === 'outdoor' && (
            <div className="row">
              <span className="sensor-name">GPS</span>
              <span
                className={sensorPillClass(gpsReady ? 'good' : gpsBad ? 'bad' : 'warn')}
              >
                <span className={`dot${gpsReady ? ' live' : ''}`} />
                {geoLabel(geoStatus, geoDetail)}
              </span>
            </div>
          )}

          {mode === 'treadmill' && (
            <>
              <div className="row">
                <span className="sensor-name">Foot pod</span>
                {podReady ? (
                  <span className="pill good">
                    <span className="dot live" /> {podName ?? 'Connected'}
                  </span>
                ) : (
                  <span className="pill warn">
                    <span className="dot" /> Not connected
                  </span>
                )}
              </div>
              {!podReady && (
                <div className="row">
                  <span className="sensor-name">Steps</span>
                  <span
                    className={sensorPillClass(
                      stepsReady ? 'good' : motionStatus === 'denied' ? 'bad' : 'warn',
                    )}
                  >
                    <span className={`dot${stepsReady ? ' live' : ''}`} />
                    {stepsReady
                      ? 'Counting'
                      : motionStatus === 'denied'
                        ? 'Unavailable'
                        : 'Starting…'}
                  </span>
                </div>
              )}
            </>
          )}

          <div className="row">
            <span className="sensor-name">Heart rate</span>
            {hrReady ? (
              <span className="pill good">
                <span className="dot live" /> {bpm !== null ? `${bpm} bpm` : (heartName ?? 'Connected')}
              </span>
            ) : (
              <span className="pill">
                <span className="dot" /> Optional — not connected
              </span>
            )}
          </div>

          {mode === 'outdoor' && !gpsReady && !gpsBad && (
            <p className="hint">
              Waiting for GPS… stay outdoors with a clear view of the sky if you can. You can
              still start now; distance begins once the first good fix lands.
            </p>
          )}
          {mode === 'outdoor' && gpsReady && (
            <p className="hint">GPS has a fix. Ready when you are.</p>
          )}
          {mode === 'treadmill' && !podReady && !stepsReady && motionStatus !== 'denied' && (
            <p className="hint">Warming up the step counter, or connect a foot pod above.</p>
          )}
        </div>

        {mode === 'treadmill' && !podReady && (
          <button
            className="btn wide"
            style={{ marginBottom: 10 }}
            onClick={connectPod}
            disabled={!bluetoothSupported()}
          >
            Connect a foot pod
          </button>
        )}

        {heartStatus !== 'connected' && (
          <button
            className="btn wide"
            style={{ marginBottom: 10 }}
            onClick={connectStrap}
            disabled={!bluetoothSupported()}
          >
            Connect a heart rate strap
          </button>
        )}

        <div className="run-hero-start arming">
          <button type="button" className="start-control" onClick={begin}>
            <span className="start-control-face" aria-hidden />
            <span className="start-control-label">
              {profile.theme === 'hud' ? 'GO' : 'START'}
            </span>
            <span className="start-control-sub">
              {mode === 'outdoor' && !gpsReady ? 'Start without fix' : 'Start clock'}
            </span>
          </button>
          {mode === 'outdoor' && !gpsReady && !gpsBad && (
            <p className="hint run-hero-hint">Or wait until GPS shows Ready.</p>
          )}
        </div>

        {mode === 'outdoor' && (
          <div className="map-slot map-slot-arming">
            <RouteMap
              segments={[]}
              ghostSegments={ghostRoute}
              position={lastGeo}
              tiles={profile.liveMapTiles}
              basemap={resolveMapBasemap(profile.mapStyle, profile.theme)}
              live
              emptyLabel={
                gpsBad
                  ? geoDetail || 'GPS unavailable'
                  : lastGeo
                    ? 'GPS lock'
                    : 'Waiting for GPS…'
              }
            />
          </div>
        )}

        <button className="btn wide" style={{ marginTop: 10 }} onClick={cancelArming}>
          Cancel
        </button>
      </div>
    );
  }

  // --- Running ------------------------------------------------------------

  if (!session) return null;

  const elapsed = session.elapsedMs();
  const distance = session.distanceM;
  const calorieEst = session.caloriesEstimate();
  const calories = calorieEst.kcal;
  const average = paceSecondsPerUnit(distance, elapsed, profile.units);
  const speed = session.recentSpeed();
  // Metres per second inverted into seconds per display unit.
  const current =
    speed && speed > 0 ? (profile.units === 'metric' ? 1000 : 1609.344) / speed : null;
  const targetPaceSec = parsePaceInput(paceTargetInput);
  const bandStatus = paceBandStatus(current ?? average, targetPaceSec);

  const goal = session.goal;
  const snap = { distanceM: distance, durationMs: elapsed, caloriesKcal: calories };
  const progress = goal ? goalProgress(goal, snap) : 0;
  const met = goal ? goalMet(goal, snap) : false;
  const phaseProgress = workoutRef.current?.progress(distance, elapsed) ?? null;

  const hrZone = bpm !== null ? zoneOf(bpm, profile.maxHeartRate) : null;
  const modeReady =
    session.mode === 'outdoor'
      ? geoStatus === 'tracking'
      : podStatus === 'connected' || motionStatus === 'counting';
  const modeLabel =
    session.mode === 'outdoor'
      ? geoStatus === 'tracking'
        ? 'Outdoor'
        : geoStatus === 'denied'
          ? 'No GPS'
          : geoDetail ?? 'Finding GPS…'
      : podStatus === 'connected'
        ? 'Foot pod'
        : motionStatus === 'counting'
          ? `${session.steps} steps`
          : 'Treadmill';
  const heroLabel =
    session.state === 'paused' ? (autoPaused ? 'Auto-paused' : 'Paused') : 'Moving';
  const isHud = profile.theme === 'hud';

  return (
    <div className="screen run-live">
      <div className="live-top">
        <span className={`live-status-pill${modeReady ? ' ok' : ' warn'}`}>
          {isHud && running && <i className="live-rec" aria-hidden />}
          {isHud && running ? `Live · ${modeLabel}` : modeLabel}
        </span>
        <div className="live-top-right">
          {bpm !== null && (
            <span
              className="live-hr-pill"
              /* Zone drives the pill colour so effort reads without focusing the number. */
              style={hrZone ? ({ '--z': zoneSwatch(hrZone) } as CSSProperties) : undefined}
            >
              ❤ {bpm}
              {hrZone ? ` · Z${hrZone.index}` : ''}
            </span>
          )}
          {cadence !== null && <span className="live-meta-pill">{Math.round(cadence)} spm</span>}
          {session.state === 'paused' && (
            <span className="live-meta-pill warn">{autoPaused ? 'Auto-paused' : 'Paused'}</span>
          )}
          {(met || goalFlash) && <span className="live-meta-pill ok">Goal</span>}
          {targetPaceSec && bandStatus !== 'none' && (
            <span
              className={`live-meta-pill pace-band pace-band-${bandStatus}${
                bandStatus === 'ok' ? ' ok' : bandStatus === 'unknown' ? '' : ' warn'
              }`}
            >
              {paceBandLabel(bandStatus) || 'Pace'}
            </span>
          )}
        </div>
      </div>

      <div className="metric-hero">
        <div className="value">{formatDuration(elapsed, { tenths: !isHud })}</div>
        <div className="label">{heroLabel}</div>
      </div>

      {targetPaceSec && (
        <div className={`pace-band-track pace-band-${bandStatus}`}>
          <div className="goal-track-head">
            <span>
              Target pace · {formatTargetPace(targetPaceSec, profile.units)}
              {bandStatus === 'ok'
                ? ' · on band'
                : bandStatus === 'fast'
                  ? ' · too fast'
                  : bandStatus === 'slow'
                    ? ' · too slow'
                    : ''}
            </span>
            <span>
              now {formatPace(current ?? average)} {paceLabel(profile.units)}
            </span>
          </div>
          <div className="pace-band-bar" aria-hidden>
            <span className="pace-band-zone" />
            <i
              className="pace-band-needle"
              style={{
                left: `${(() => {
                  if (!current && !average) return 50;
                  const p = current ?? average!;
                  // Map pace onto 0–100 with target at centre; ±20% fills the bar.
                  const lo = targetPaceSec * 0.8;
                  const hi = targetPaceSec * 1.2;
                  const ratio = (p - lo) / (hi - lo);
                  return Math.max(4, Math.min(96, ratio * 100));
                })()}%`,
              }}
            />
          </div>
        </div>
      )}

      {phaseProgress && !workoutRef.current?.done && (
        <div className={`workout-phase kind-${phaseProgress.phase.kind}`}>
          <div className="goal-track-head">
            <span>
              {phaseKindLabel(phaseProgress.phase.kind)} · {phaseProgress.phase.label}
            </span>
            <span>
              {phaseProgress.index + 1}/{phaseProgress.total}
            </span>
          </div>
          <div className="workout-remaining">
            {phaseProgress.remainingMs !== null
              ? formatDuration(phaseProgress.remainingMs, { tenths: true })
              : phaseProgress.remainingM !== null
                ? `${formatDistance(phaseProgress.remainingM, profile.units)} ${distanceLabel(profile.units)} left`
                : '—'}
          </div>
          <div
            className="goal-bar"
            role="progressbar"
            aria-valuenow={Math.round(phaseProgress.fraction * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <span style={{ width: `${phaseProgress.fraction * 100}%` }} />
          </div>
          <button
            type="button"
            className="btn wide"
            style={{ marginTop: 10 }}
            onClick={() => {
              workoutRef.current?.skip(distance, elapsed);
              setTick((t) => t + 1);
            }}
          >
            Skip phase
          </button>
        </div>
      )}

      {workoutRef.current?.done && (
        <div className="pill good" style={{ marginTop: 12, display: 'inline-flex' }}>
          Workout complete
        </div>
      )}

      {goal && (
        <div
          className={`goal-track live-goal${met || goalFlash ? ' met' : ''}${goalFlash ? ' goal-flash' : ''}`}
        >
          <div className="goal-track-head">
            <span>
              Goal · {goalKindLabel(goal.kind)}
              {(met || goalFlash) ? ' · done' : ''}
            </span>
            <strong>{formatGoalProgress(goal, snap, profile.units)}</strong>
          </div>
          <div
            className="goal-bar"
            role="progressbar"
            aria-valuenow={Math.round(progress * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <span style={{ width: `${Math.min(100, progress * 100)}%` }} />
          </div>
        </div>
      )}

      {(() => {
        const paceNow = current;
        const paceAvg = average;
        const speedMps = speed && speed > 0 ? speed : null;
        const avgSpeedMps =
          distance > 0 && elapsed > 0 ? distance / (elapsed / 1000) : null;

        // Goal remaining: distance left, time left, or kcal left.
        let remainValue = '—';
        let remainLabel = 'remaining';
        if (goal) {
          if (goal.kind === 'distance') {
            const left = Math.max(0, goal.target - distance);
            remainValue = formatDistance(left, profile.units);
            remainLabel = `${distanceLabel(profile.units)} left`;
          } else if (goal.kind === 'time') {
            const left = Math.max(0, goal.target - elapsed);
            remainValue = formatDuration(left);
            remainLabel = 'time left';
          } else {
            const left = Math.max(0, Math.round(goal.target - calories));
            remainValue = formatCalories(left);
            remainLabel = 'kcal left';
          }
        }

        const hours = elapsed / 3_600_000;
        const kcalPerHour =
          hours > 0.01 && calories > 0 ? Math.round(calories / hours) : null;

        const pods: Array<{
          id: LivePodId;
          face0: { value: string; label: string };
          face1: { value: string; label: string };
        }> = [
          {
            id: 'pace',
            face0: {
              value: formatPace(paceNow ?? paceAvg),
              label: paceNow ? `pace ${paceLabel(profile.units)}` : `avg ${paceLabel(profile.units)}`,
            },
            face1: {
              value: formatSpeedMps(speedMps ?? avgSpeedMps, profile.units),
              label: speedUnitLabel(profile.units),
            },
          },
          {
            id: 'distance',
            face0: {
              value: formatDistance(distance, profile.units),
              label: distanceLabel(profile.units),
            },
            face1: {
              value: remainValue,
              label: goal ? remainLabel : 'set a goal',
            },
          },
          {
            id: 'hr',
            face0: {
              value: hrZone ? `Z${hrZone.index}` : bpm !== null ? '—' : '—',
              label: hrZone ? hrZone.name : 'HR zone',
            },
            face1: {
              value: bpm !== null ? String(bpm) : '—',
              label: bpm !== null ? 'bpm' : 'no strap',
            },
          },
          {
            id: 'kcal',
            face0: {
              value: formatCalories(calories),
              label: calorieEst.source === 'heart' ? 'kcal · hr' : 'kcal',
            },
            face1: {
              value: kcalPerHour !== null ? String(kcalPerHour) : '—',
              label: 'kcal/h',
            },
          },
          {
            id: 'avg',
            face0: {
              value: formatPace(paceAvg),
              label: `avg ${paceLabel(profile.units)}`,
            },
            face1: {
              value: formatPace(paceNow),
              label: `now ${paceLabel(profile.units)}`,
            },
          },
          {
            id: 'cadence',
            face0: {
              value: cadence !== null ? String(Math.round(cadence)) : '—',
              label: cadence !== null ? 'spm' : 'cadence',
            },
            face1: {
              value:
                session.manualLaps.length > 0
                  ? String(session.manualLaps.length)
                  : session.mode === 'treadmill' && session.steps > 0
                    ? String(session.steps)
                    : '—',
              label:
                session.manualLaps.length > 0
                  ? 'laps'
                  : session.mode === 'treadmill'
                    ? 'steps'
                    : 'laps',
            },
          },
        ];

        return (
          <>
            <div className="metric-grid metric-grid-live metric-grid-3x2">
              {pods.map((pod) => {
                const face = podFace[pod.id] === 1 ? pod.face1 : pod.face0;
                const other = podFace[pod.id] === 1 ? pod.face0.label : pod.face1.label;
                return (
                  <button
                    key={pod.id}
                    type="button"
                    className={`metric metric-pod${podFace[pod.id] === 1 ? ' alt' : ''}${
                      pod.id === 'distance' && podFace.distance === 0 && unitFlash
                        ? ' unit-tick'
                        : ''
                    }`}
                    onClick={() => flipPod(setPodFace, pod.id)}
                    aria-label={`${face.label} ${face.value}. Tap to show ${other}`}
                    title={`Tap for ${other}`}
                  >
                    <div className="value">{face.value}</div>
                    <div className="label">{face.label}</div>
                    <span className="metric-pod-dots" aria-hidden>
                      <i className={podFace[pod.id] === 0 ? 'on' : ''} />
                      <i className={podFace[pod.id] === 1 ? 'on' : ''} />
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        );
      })()}

      {session.mode === 'outdoor' && (
        <div className="map-slot">
          {/* Always mount mid-run — do not wait for two track points.
              Tiles optional (Settings → Map); off by default for data/glance. */}
          <RouteMap
            segments={session.segments}
            ghostSegments={ghostRoute}
            position={lastGeo}
            tiles={profile.liveMapTiles}
            basemap={resolveMapBasemap(profile.mapStyle, profile.theme)}
            live
            emptyLabel={
              geoStatus === 'denied' || geoStatus === 'unavailable' || geoStatus === 'error'
                ? geoDetail || 'GPS unavailable'
                : geoStatus === 'acquiring' || !lastGeo
                  ? 'Waiting for GPS…'
                  : 'Recording route…'
            }
          />
        </div>
      )}

      {session.mode === 'treadmill' && (
        <div className="card live-console">
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
                ? 'Console distance overrides the pod and calibrates it.'
                : 'Overrides the step estimate and calibrates stride.'}
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
              onChange={(e) => {
                setIncline(e.target.value);
                const n = Number(e.target.value);
                if (Number.isFinite(n) && e.target.value.trim() !== '') {
                  session.setIncline(n);
                } else {
                  session.setIncline(null);
                }
              }}
            />
          </div>
        </div>
      )}

      <div className="run-actions run-actions-primary">
        {running ? (
          <button
            type="button"
            className="btn run-action-pause"
            onClick={() => {
              session.pause();
              setAutoPaused(false);
              stillMsRef.current = 0;
              setTick((t) => t + 1);
            }}
          >
            Pause
          </button>
        ) : (
          <button
            type="button"
            className="btn primary run-action-pause"
            onClick={() => {
              session.resume();
              setAutoPaused(false);
              stillMsRef.current = 0;
              setTick((t) => t + 1);
            }}
          >
            Resume
          </button>
        )}
        <button
          type="button"
          className="btn danger run-action-finish"
          onClick={() => setConfirmAction('finish')}
        >
          Finish
        </button>
      </div>

      <div className="run-actions-secondary">
        <button className="btn run-action-lap" onClick={markLap} type="button">
          Lap
          {session.manualLaps.length > 0 ? ` (${session.manualLaps.length})` : ''}
        </button>
        {session.mode === 'treadmill' && podStatus !== 'connected' && (
          <button
            className="btn"
            type="button"
            onClick={connectPod}
            disabled={!bluetoothSupported()}
          >
            Foot pod
          </button>
        )}
        {heartStatus !== 'connected' && (
          <button
            className="btn"
            type="button"
            onClick={connectStrap}
            disabled={!bluetoothSupported()}
          >
            HR strap
          </button>
        )}
      </div>

      {session.manualLaps.length > 0 && (
        <div className="card" style={{ marginBottom: 10, marginTop: 10 }}>
          <h2>Laps</h2>
          <ul className="lap-list">
            {session.manualLaps.map((lap) => (
              <li key={lap.index}>
                <span>Lap {lap.index}</span>
                <span>
                  {formatDistance(lap.splitDistanceM, profile.units)} {distanceLabel(profile.units)}
                  {' · '}
                  {formatDuration(lap.splitDurationMs)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <button
        className="btn discard-link"
        type="button"
        onClick={() => setConfirmAction('discard')}
      >
        Discard run
      </button>

      {confirmAction && (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={() => setConfirmAction(null)}
        >
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="run-confirm-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="run-confirm-title">
              {confirmAction === 'finish' ? 'Finish this run?' : 'Discard this run?'}
            </h2>
            <p className="hint" style={{ marginTop: 0, marginBottom: 16 }}>
              {confirmAction === 'finish'
                ? 'Save the run to history and stop tracking.'
                : 'The run will not be saved. This cannot be undone.'}
            </p>
            <div className="btn-row">
              <button type="button" className="btn" onClick={() => setConfirmAction(null)}>
                Cancel
              </button>
              <button
                type="button"
                className={`btn${confirmAction === 'discard' ? ' danger' : ' primary'}`}
                onClick={() => {
                  const action = confirmAction;
                  setConfirmAction(null);
                  if (action === 'finish') finish();
                  else discard();
                }}
              >
                {confirmAction === 'finish' ? 'Finish' : 'Discard'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
