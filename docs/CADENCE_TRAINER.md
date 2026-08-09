# Audible cadence trainer — design note

**Status: designed, not built.** This records a design discussion and the
corrections that came out of it, so the reasoning survives and picking it up
again does not start from the blank page.

Roadmap context: [`ROADMAP.md`](./ROADMAP.md) tier 2, item 12 — *"Cadence
coaching · target spm range + soft cues from pod/phone"*. This note is that
item, worked out.

---

## The idea

A metronome in the runner's ear. Clicks at a target step rate so the runner can
lock onto a rhythm, hold turnover steady, and stop overstriding — on the
treadmill and outdoors alike.

---

## The arithmetic, and the definition that matters more

```
pace (min/km) = 1000 / (SPM × strideM)
```

The unit constant is the easy part. The trap is what "stride" means: in the
literature it usually denotes a full gait cycle, which is *two* steps. This
equation only holds if it means **metres per step**.

In this codebase it does — `calibrateStride` computes `knownDistanceM / steps`
(`src/core/steps.ts`), and `distanceFromSteps` is `steps * strideM`. Read it as
a gait cycle and every number here doubles. Anyone touching this should have
that settled before they start.

---

## Three decisions

### 1. Fixed SPM is the feature. The pace-driven metronome is not.

The original blueprint had three modes, and treated an adaptive one — *"if the
runner drops below target pace, the metronome speeds up to prompt quicker
turnover"* — as the clever one. It should be cut.

Runners do not get faster by stepping more often. They get faster by
lengthening stride. Cadence is close to constant across a broad range of speeds
for a given runner; nearly all the change in speed comes from stride length.

The numbers make it plain. 6:00/km is 167 m/min and 5:00/km is 200 m/min — 20%
more. Hold stride constant and that demands **180 SPM → 216 SPM**. Nobody holds
216; that is sprint turnover. The instruction cannot be followed, so what the
runner actually does is shuffle: shorter, quicker, choppier steps.

Which is the opposite of the stated goal. The feature exists partly to prevent
overstriding, and a pace-driven metronome drives the runner into understriding
instead — the less efficient error of the two.

It also has no equilibrium. Off pace, so the beat quickens; steps shorten; pace
does not recover; the beat quickens again. A runaway loop with a person in it.

**Cadence and pace are two feedback channels and must stay separate.** Hold the
beat steady. If pace is off, say so in words — `src/core/paceBand.ts` already
does exactly that.

### 2. There is no 180 SPM target.

The figure comes from Jack Daniels counting elite distance runners at race pace
at the 1984 Olympics. It is not a universal optimum. Best cadence scales with
leg length and speed, recreational runners self-select roughly 155–175, and
imposing 180 on someone who does not run there typically *raises* their energy
cost.

The defensible target is **the runner's own median cadence plus about 5%**,
computed from their history. A foot pod gives an accurate source through
`footpod.cadenceSpm`; the phone step detector is the fallback.

### 3. Web Audio, not a native audio engine.

The concern behind the original recommendation is right: `setInterval` drifts
under CPU scheduling, and a metronome that drifts is worse than none.

The prescribed fix — AVAudioEngine, AAudio, Oboe — is wrong for this stack.
This app is a PWA with a thin Capacitor shell and no native audio layer at all.
An Oboe plugin is weeks of C++ in a codebase that is React and TypeScript
throughout.

It is also unnecessary. The **lookahead scheduler** pattern solves this in the
browser: a coarse `setInterval` every ~25 ms that schedules every beat falling
inside the next ~100 ms via `AudioBufferSourceNode.start(exactTime)`. Those
start times are sample-accurate against `AudioContext.currentTime`, an audio
clock that is indifferent to JavaScript jitter. Metronome-grade timing, no
native code, identical behaviour in the PWA and the APK.

---

## Audio ducking is not available, and is not wanted

A web app cannot lower another app's volume. Audio focus is a native Android
concept (`AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK`) and is unreachable from a
WebView. There is also no "dedicated high-frequency audio channel" — that is
not a mechanism that exists.

For a metronome this is fine. Layering over the music is the desired behaviour;
ducking a podcast 180 times a minute would be unusable.

The real risk runs the other way and needs testing on a real phone before
anything is built: **does starting Web Audio cause the music app to pause?** If
the WebView takes exclusive audio focus, the feature is dead however good its
timing is.

Note this differs from the spoken cues, which go through the system TTS engine
and therefore *do* duck.

---

## Burst mode is the default, not an option

Continuous clicking for forty-five minutes is intolerable, and it keeps the
audio path busy for the whole run. Fifteen seconds at each kilometre, plus
fifteen whenever measured cadence drifts more than about 5% from target, gives
the runner the rhythm at the moments they need re-anchoring and silence the
rest of the time. It solves annoyance and battery in one decision.

---

## The treadmill claim, corrected

The original note suggested that a metronome plus step detection makes a
surprisingly accurate indoor distance estimator. As stated this is circular: if
the runner is following the beat then cadence is imposed, not measured, and
distance becomes `clicked_SPM × assumed_stride × time` — the app's own click
rate multiplied by a guess. That is not more accurate, only more precisely
wrong when the stride estimate is off.

There is a real version. Stride length varies *with* cadence, so a stride
calibrated at one turnover does not hold at another. Lock the cadence, then
correct the distance from the treadmill console on the results page, and
`calibrateStride` yields a stride that is valid **at that cadence**. Run the
same locked cadence next time and step-based distance is genuinely tighter,
because the variable that was making the calibration drift has been removed.

That makes this feature a natural partner to the console-entry calibration
rather than a competitor to it.

---

## Ghost cadence sync needs a schema change first

Syncing the beat to a friend's recorded cadence is blocked, but not by the
parked ghost feature ([`GHOST_RUNS.md`](./GHOST_RUNS.md)) — it is blocked by the
data. `footpod.cadenceSpm` is live only; `Activity` stores `steps` as a single
total and no cadence series, so there is nothing to sync against.

If that mode is ever wanted, **start recording a cadence series now**. It is
cheap, and history accumulates while the feature waits. Retrofitting it later
means every run recorded before the change can never be a cadence ghost.

---

## What already exists

| Piece | Where |
|---|---|
| Step detection | `StepDetector`, `src/core/steps.ts` |
| Stride calibration | `calibrateStride`, `estimateStride`, `src/core/steps.ts` |
| Live cadence from a pod | `footpod.cadenceSpm`, `src/core/footpod.ts` |
| Pace-band feedback, already verbal | `src/core/paceBand.ts` |
| Cue scheduling and speech | `src/core/cues.ts`, `src/platform/speech.ts` |
| Haptics | `pulse()`, `src/platform/speech.ts` |
| Treadmill distance correction | `applyConsoleEntry`, `src/core/consoleEntry.ts` |

---

## Build order

0. **Find out whether Web Audio pauses the music.** Ten minutes on a real
   phone, and it gates the whole feature.
1. **Fixed-SPM metronome** on a lookahead scheduler. Target defaults to the
   runner's own median cadence +5%. Three sound profiles; woodblock as default.
2. **Burst mode**, as described above — built in, not bolted on.
3. **Verbal cadence feedback** through the existing cue engine, kept strictly
   separate from pace feedback.
4. **Haptic mirror** using `pulse()`. Phone only; there is no watch app.

Record per-sample cadence from step 1 onward regardless of whether anything
consumes it yet.

---

## Open questions

- Does the phone step detector give a cadence stable enough to drive the "drift
  from target" trigger, or does burst mode need a pod to be trustworthy?
- What should the metronome do during an auto-pause? Silence is probably right,
  but resuming mid-bar has a feel to it that needs trying.
- Does a locked cadence belong in the recorded activity as a property of the
  run, so a later stride calibration knows which cadence it was measured at?
