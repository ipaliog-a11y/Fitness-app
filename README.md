# RunLog

A running tracker for one person, built as an installable web app. Outdoors it
follows you by GPS and draws the route; indoors it reads a Bluetooth foot pod,
counts your steps, or takes the treadmill console's number. It talks to a
heart-rate strap directly, works with no signal, and keeps every run on your own
device.

There is no server, no account and no upload. That is a deliberate constraint,
not a missing feature — but it does mean the data is one cleared browser away
from gone, so **Settings → Export** exists and is worth using now and then.

## Running it

```bash
npm install
npm run dev        # http://localhost:5173
```

```bash
npm run build      # typechecks, then builds to dist/
npm test           # the core maths, on node — no browser needed
npm run test:browser   # drives a real run through Chromium (needs a build first)
npm run icons      # regenerates the app icons
```

Two things need HTTPS to work at all, in every browser: **geolocation** and
**Web Bluetooth**. `localhost` counts as secure, so `npm run dev` is fine; any
other host needs a certificate.

## What it does

**Tracking.** Distance, time and pace on every run, live and afterwards.
Outdoors that comes from GPS, with the route drawn on an OpenStreetMap
background. Indoors it comes from a Bluetooth foot pod, or failing that the
phone's own accelerometer counting footfalls, or from typing in what the
treadmill console says.

**Foot pods.** Any pod speaking the standard Running Speed and Cadence profile
— Zwift RunPod, Stryd, Garmin, Polar — connects the same way the heart-rate
strap does. On a treadmill it is the best instrument available short of the
console itself: it measures at the shoe rather than inferring from a phone
bouncing in a pocket, and it reports cadence and live speed as well as
distance.

**Heart rate.** Connects to any strap or watch speaking the standard Bluetooth
Heart Rate Service — no vendor app in between. During the run you get live bpm;
afterwards, time in each of the five zones and a trace of the whole session.

**History and dashboard.** Every run, weekly volume over the last twelve weeks,
a weekly goal, streaks, and personal records taken from the *fastest stretch
inside* any run rather than from whole runs — so a quick 5 km buried in the
middle of a 10 km still counts.

**Coaching.** A handful of conservative, rule-based observations after each run
and on the dashboard: how the run compared, how much of it was genuinely easy,
whether this week is a big jump on last. It is deliberately not a training plan.

## How it is put together

```
src/core/       Pure logic. No DOM, no browser APIs — all of it unit-tested.
src/platform/   The browser: geolocation, Web Bluetooth (strap and pod),
                motion, wake lock.
src/ui/         React components.
tests/          core.test.mjs runs on node; browser.test.mjs drives Chromium.
tools/          The icon generator.
```

The split is what makes the arithmetic testable. `RunSession` is fed fixes,
heart readings, pod measurements and steps by whoever is holding it; in the app that is the
Geolocation API, and in the tests it is a loop. A whole run replays in about a
millisecond, which matters, because the other way to check that a 5 km run
measures 5 km is to go and run one.

A few decisions worth knowing about:

- **GPS is filtered before it counts.** Fixes are rejected for poor accuracy,
  for moving less than the error bar (a phone at a traffic light wanders far
  enough to invent hundreds of metres), and for implausible speed. The run
  screen shows what the filter is doing.
- **Pace is quoted against moving time.** Pauses are excluded, and a pause
  breaks the route into segments so the map never draws a straight line across a
  gap.
- **Splits interpolate.** Fixes arrive every few seconds and straddle the
  kilometre marks; bucketing them whole makes alternate splits read fast and
  slow in a way nobody ran.
- **Storage is IndexedDB**, because a GPS track is thousands of points and
  localStorage would fill within a season. Settings stay in localStorage — they
  are needed synchronously at first paint.

## Browser support

| | GPS | Heart rate | Foot pod | Step counting | Install |
|---|---|---|---|---|---|
| Chrome, Android | yes | yes | yes | yes | yes |
| Safari, iOS | yes | **no** | **no** | yes, after a permission prompt | yes |
| Desktop Chrome | yes | yes | yes | no sensor | yes |

Web Bluetooth is Chromium-only; Apple has declined to ship it. On an iPhone the
app works fully except for the strap and the pod, and the interface degrades to
saying so rather than offering a button that cannot work.

## Measuring a treadmill

There are four ways to get a distance out of an indoor run, and the app prefers
them in this order:

1. **The console's own figure**, typed in at the end. It comes from belt
   revolutions, so it is the closest thing to ground truth in the room, and it
   overrides everything else.
2. **A foot pod**, live over Bluetooth. Accurate to a percent or two once
   calibrated, and needs no attention during the run.
3. **The phone's pedometer**, counting footfalls through the accelerometer.
   Free, but it depends on where the phone is and on a stride estimate.
4. **Nothing at all** — type the distance and be done.

Typing the console figure at the end of a run does double duty: whichever
instrument was being used gets calibrated against it. A foot pod's correction
factor and the pedometer's stride length are both learned this way, so each
indoor run makes the next one's live numbers better.

That ordering is also why the project no longer needs a home-made belt sensor.
An IR reflector counting belt revolutions would reconstruct exactly the number
the console already displays; it would buy automation, not accuracy — and a foot
pod delivers live distance without any of the soldering. `distanceSource` still
reserves a `sensor` value, and it is what a pod records, so a purpose-built
device could take the same path later without touching `src/core/`.

## What is not here

Route planning, social features, sync between devices, and any kind of training
plan. Some of those are reasonable next steps; none of them are what a tracker
needs to be useful on day one.
