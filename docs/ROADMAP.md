# RunLog feature roadmap

Research-backed suggestions from top running apps (Strava, Nike Run Club, Garmin Connect, Runna, Runkeeper, MapMyRun/Adidas, Couch-to-5K style apps), adapted for RunLog’s **local-first, no-account** design.

Last updated from product discussion (2026).

---

## Design constraints

- No required account or server
- Data stays on device (export/backup OK)
- Prefer phone + Bluetooth sensors over a full watch OS app (for now)
- Do **not** copy social feeds first — optional file export later is enough

---

## Tier 1 — High value, fits RunLog’s DNA

| # | Feature | Inspired by | Notes |
|---|---------|-------------|--------|
| 1 | **In-run audio cues** | Runkeeper, MapMyRun | Distance/time/goal/lap/pause announcements offline via speech synthesis |
| 2 | **Structured workouts / interval builder** | Garmin, Seconds, NRC | Warm-up → work/rest → cool-down; presets + custom |
| 3 | **Auto-pause + live pacing feedback** | Most trackers | Auto-pause at lights; target pace band later |
| 4 | **Shoe / gear mileage** | Adidas, MapMyRun | Assign shoes to runs; warn at wear limit |
| 5 | **Goal-complete alert** (optional auto-finish later) | Goal-oriented apps | Strong cue when distance/time/kcal goal met |
| 6 | **Stronger offline backup** | Local-first tools | Reminders, auto backup, GPX/TCX import |

---

## Tier 2 — Differentiating without becoming Strava

| # | Feature | Inspired by | Notes |
|---|---------|-------------|--------|
| 7 | **Simple training plans** | NRC, Runna (lite) | C25K-style, first 10K, volume builder — not a paid AI coach |
| 8 | **Route library** | MapMyRun | Save/reuse/reverse past outdoor routes |
| 9 | **Lap button + virtual partner** | Nike, Garmin | Laps shipped. Ghost racing designed and parked — [`GHOST_RUNS.md`](./GHOST_RUNS.md) |
| 10 | **Post-run depth** | Garmin analytics lite | Load/recovery hints, pace distribution, elevation profile |
| 11 | **Weather at start** | MapMyRun premium-ish | Optional; one-shot at arming |
| 12 | **Cadence coaching** | Watches / form tools | Audible metronome designed — [`CADENCE_TRAINER.md`](./CADENCE_TRAINER.md) |

---

## Tier 3 — Nice later (carefully scoped)

| Feature | Who has it | Fit for RunLog |
|---------|------------|----------------|
| Social feed, clubs, segments | Strava | Poor fit (optional **GPX export** instead) |
| Cloud multi-device sync | Big apps | Later, optional encrypted only |
| Full AI coach chat | Intervals Pro, Runna | Rule-based coach first |
| Music-integrated guided runs | Nike | Heavy; audio cues first |
| Watch-native apps | Garmin, NRC | High cost; PWA + sensors first |
| Live location sharing | MapMyRun | Optional safety; privacy-sensitive |
| Strength / hybrid plans | Runna, Edge | Only if expanding beyond running |

---

## Delivery phases

### Phase A — In-run experience ✅ *shipped*

| Item | Status |
|------|--------|
| Audio cues | Done — Settings → During a run; distance units, goal half/met, lap, pause |
| Auto-pause | Done — stillness ~8s outdoors or treadmill+pod; auto-resume on move |
| Goal-complete alert | Done — speech, vibration, toast, progress flash |
| Manual lap button | Done — Lap control + list; saved on activity |

**Outcome:** Feels like a real run computer while moving.

### Phase B — Workouts ✅ *shipped*

| Item | Status |
|------|--------|
| Interval presets | Done — 9 built-ins (walk/run, tempo, 400s, VO2, pyramid, fartlek, long easy…) |
| Custom intervals | Done — warm / work / rest / cool + repeats on Run screen |
| Live phase UI | Done — countdown, progress, skip, audio on phase change |

### Phase C — Longevity ✅ *shipped*

| Item | Status |
|------|--------|
| Shoe mileage | Done — Settings manage pairs; assign on Run; add km on finish; wear limit warning |
| GPX export/import | Done — Detail export GPX; Settings import GPX; JSON backup still available |
| Saved routes | Done — save from detail; ghost overlay on next outdoor run; reverse; manage in Settings |

### Phase D — Training ✅ *shipped*

| Item | Status |
|------|--------|
| Coach tab | Done — own place (replaces Dashboard); recovery, plans, notes, volume, PRs |
| Lightweight plans | Done — Start to run, First 5K, Base builder, Return to run; check-off sessions |
| Load / recovery | Done — acute:chronic style load + coach cautions |

### Phase E — Pre-Android hardening ✅ *partially shipped*

| Item | Status |
|------|--------|
| Full backup / restore | Done — Settings export includes runs, profile, shoes, routes, plan (`docs/DATA.md`) |
| Schema documentation | Done — `docs/DATA.md` + backup format v1 / activity schema v1 |
| Target pace band | Done — optional target on Run setup; live bar + audio nudge per km/mi |
| Strava-friendly export | Done — GPX with HR extension; TCX from run detail |

Still optional later:

- Virtual partner
- Cadence targets

---

## Already shipped (baseline)

- Outdoor GPS + route map; treadmill (pod / steps / console)
- HR strap, zones, HR-aware (Keytel) + pace (ACSM) calories
- Pre-start sensor arming (wait vs start now)
- Per-run goals: distance / time / calories
- Live timer with tenths
- History, dashboard, PRs, streaks, weekly goal
- Rule-based coach tips
- Local-only storage + export/import JSON
- Run screen stays live across tab switches

---

## Suggested build order (summary)

1. **Phase A** — audio, auto-pause, goal alert, laps  
2. **Phase B** — intervals  
3. **Phase C** — shoes, GPX, routes  
4. **Phase D** — plans + load ✅  
5. **Phase E** — polish / export  

Strongest pitch to keep:

> **RunLog = serious run computer that stays on your phone.**  
> GPS + treadmill + HR + goals + intervals & audio — **no account, no feed, no upload.**
