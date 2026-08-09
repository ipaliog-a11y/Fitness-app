# Ghost runs — design note

**Status: parked.** Nothing built. This is the record of a design discussion so
the conclusions survive, and so picking it up again does not start from the
blank page.

Roadmap context: [`ROADMAP.md`](./ROADMAP.md) tier 2, item 9 — *"Lap button +
virtual partner … ghost of last similar run later"*. This note is that item,
worked out properly and widened from "your own past run" to "a friend's run,
sent as a file".

---

## The idea

Share a finished run with a friend as a file. Their run becomes your target: a
ghost moves along the route map or the distance graph while you run, you see a
live differential against it, and at the end you get a comparison card worth
sharing.

No account, no server, no feed — the file goes over whatever messenger the two
of you already use. That constraint is not a limitation to work around here; it
is the reason the feature is interesting in an app that refuses to have a
backend.

---

## Two decisions that shape everything else

### 1. Race on distance. Render on route.

The tempting model is "compete on the exact GPS path". Resist it. It means
matching your live position against their recorded track, which fails the
moment you start fifty metres away, take a different turn, or run the loop
backwards — and solving it properly is segment matching, which is a project in
itself.

Instead, **the race is always one-dimensional: distance against time.** The
ghost's position on the map is

```
pointAtDistance(yourRoute, ghostDistanceAtTime(now))
```

— their *distance* placed on *your* track. Wander off the route and the
comparison is still valid, because it never depended on the two of you being in
the same place.

This also collapses what looked like two features into one. "Pace/distance sync
for the treadmill" is not the indoor fallback; it is the primitive. The map
ghost is a second view of the same numbers, and the treadmill gets the feature
on day one rather than as a lesser variant.

### 2. GPX, not a custom format.

The instinct was that sharing runs as files needs a bespoke format. It does
not, and inventing one costs more than it returns.

What a ghost needs is timestamped positions. That is precisely what a GPX
`<trkpt>` is. The proposed telemetry shape — `[{t, lat, lng, dist}]` — is GPX
minus the XML plus one field that is a single pass to derive.

A custom extension also loses at exactly the moment it matters. `.runlog` has
no MIME registration, so Android will not offer the app as a handler without a
native intent filter, which the PWA build cannot install. Messengers refuse
unknown types unevenly. And a GPX ghost can come from Strava, Garmin, or a
friend who has never installed RunLog — which is a larger feature than the one
originally described.

If a field genuinely cannot be expressed, put it in `<extensions>` under an own
namespace. That mechanism is already in use: `activityToGpx` emits Garmin
`TrackPointExtension` heart rate (`src/core/gpx.ts`).

---

## What already exists

More of this is built than it looks. Worth reading before writing anything:

| Piece | Where | Note |
|---|---|---|
| Timestamped track | `Activity.segments: GeoPoint[][]` | `{lat, lon, t, accuracy, elevation}` — already the ghost telemetry |
| Distance-at-time interpolation | `distanceAtTime`, `charts.tsx` | The ghost engine, already written and tested |
| Cumulative distance marks | `buildTrackMarks`, `charts.tsx` | The `dist` field, derived in one pass |
| GPX in and out | `activityToGpx`, `activityFromGpx` | Including HR via Garmin extensions |
| **Receiving a shared file** | GPX import in `SettingsScreen` | The receive path already exists |
| Sending a file | `saveTextFile`, `src/platform/saveFile.ts` | Web Share API → any messenger |
| Saved routes | `src/core/routes.ts` | Docstring already says *"run this again' ghosts"* |
| Live differential against a target | `src/core/paceBand.ts` | A ghost is this with a moving target |
| Cue diffing | `pendingCues`, `src/core/cues.ts` | Ghost events fit the existing snapshot-diff shape |

The consequence: **an MVP needs no new format, no share target, and no server.**
Friend exports GPX → sends it over Viber → you import it in Settings → it is a
ghost.

---

## Data integrity — where this gets unfair without anyone noticing

**GPS accuracy changes the distance.** Measured on simulated tracks through the
real filter: the same 1908 m true run recorded **1953 m at 6 m accuracy and
2113 m at 34 m accuracy** — an 11% spread from the handset alone. A race
between two phones is not a fair race. The app knows every fix's accuracy, so
at minimum say so: *"their track was recorded at ±20 m."*

**Which clock.** `Activity.durationMs` is *moving* time; pauses are excluded.
If their run auto-paused and yours did not, moving and elapsed diverge and the
race quietly compares different things. The ghost timeline must be built on
moving time. This is easy to get wrong and invisible once wrong.

**Treadmill provenance.** `distanceSource` exists for exactly this question. A
treadmill run whose source is `manual` has a distance somebody typed into a
box; racing it is racing their typing. Exclude those, or mark them plainly.

**Elevation is nullable.** Any hill-climb comparison on the card needs a
fallback for tracks that have none.

---

## The QR code does not fit

A GPX for a thirty-minute run is around **113 KB** (measured). A QR code tops
out near 3 KB in theory and a few hundred bytes in practice when scanned off a
phone screen. There is no server to host a link behind, by design.

A smaller version does work. Cumulative seconds at each 100 m, delta-encoded,
is roughly **150–200 bytes for a 10 km run** — comfortably inside a QR. So a QR
can carry a **pace ghost**, never a **route ghost**. Worth settling before
designing a card around one.

---

## The comparison card

The card is an image, and the app currently shares text. `saveTextFile` handles
strings; a PNG needs canvas rasterisation.

The specific trap: this app themes everything with CSS custom properties, and
**`var(--zone-3)` does not resolve when an SVG is serialised into a canvas.**
The card's SVG has to carry literal colours. That problem has already been
solved once in this codebase — `zoneSwatch()` exists for the same reason.

---

## Naming

**Ghost.** Mario Kart, Garmin and Zwift all use it, so it costs no explanation.
The alternatives considered — *Shadow Match*, *Telemetry Rival*, *Dual Trace* —
each need a gloss, and a feature that needs a gloss loses.

(*Dual Trace* was proposed as a nod to a "dual" brand theme. No such theme
exists in the app today; it is RunLog throughout. If that direction is wanted,
it is a separate decision.)

---

## Build order

0. **Test the gate first.** Send yourself a GPX over WhatsApp and Viber and try
   to open it back into the installed PWA. If receiving does not work on a real
   phone, nothing below matters. Cheapest test, riskiest assumption — an
   afternoon, and it can kill the feature before a week goes into it.
1. **The one-dimensional ghost.** Import a GPX, race distance against time,
   show the differential. Works on the treadmill immediately.
2. **Live audio.** `paceBand.ts` already nudges against a target pace; point it
   at a moving one.
3. **Map ghost.** A rendering of step 1, not new logic.
4. **The card.** Last, once there is something worth putting on it.

---

## Open questions

- Does an installed PWA on Android actually receive a `.gpx` from a messenger,
  or does it need a `share_target` manifest entry? (iOS Safari has no share
  target at all — if iOS matters, the answer is the Files app.)
- What happens when the ghost finishes first, or you run further than they did?
  The differential has to mean something past the end of their data.
- Does a ghost from a *treadmill* run race against an *outdoor* run? The
  one-dimensional model permits it. Whether that is a fair contest is a
  product question, not a technical one.
