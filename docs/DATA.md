# RunLog data model

Interchange and storage contract for the local-first app. Use this when porting
to Android or writing importers. All distances are **metres**, times are
**milliseconds** (epoch or duration), unless noted.

Last aligned with **activity schema version 1** and **backup format version 1**.

---

## Schema versions

| Constant | Where | Meaning |
|----------|--------|---------|
| `SCHEMA_VERSION` (= 1) | `src/core/activity.ts` | Shape of one `Activity` record in IndexedDB |
| `BACKUP_FORMAT_VERSION` (= 1) | `src/core/backup.ts` | Shape of the full backup JSON file |
| IndexedDB `runlog` version | same as `SCHEMA_VERSION` | Object-store upgrade hook |

When you change required fields on `Activity`, bump `SCHEMA_VERSION` and document
a migration path (read old → write new). Backup format can bump independently
when shoes/routes/profile wrappers change.

---

## Storage map

| Data | Store | Key / notes |
|------|--------|-------------|
| Activities | IndexedDB `runlog` / store `activities` | `id` keyPath; index `startedAt` |
| Profile / settings | `localStorage` | `runlog:settings:v1` |
| Shoes | `localStorage` | `runlog:shoes:v1` |
| Saved routes | `localStorage` | `runlog:routes:v1` |
| Active training plan | `localStorage` | `runlog:active-plan:v1` |

There is **no server**. Clearing site data deletes everything unless the user
exported a backup.

---

## Activity (v1)

```ts
interface Activity {
  id: string;
  mode: 'outdoor' | 'treadmill';
  startedAt: number;          // epoch ms
  durationMs: number;         // moving time only
  distanceM: number;
  distanceSource: 'gps' | 'steps' | 'manual' | 'sensor';
  segments: GeoPoint[][];     // outdoor route; empty on treadmill
  heart: HeartSample[];       // { t, bpm }
  heartReport: HeartReport | null;  // frozen zone summary
  steps: number | null;
  inclinePercent: number | null;
  caloriesKcal: number | null;
  goal: RunGoal | null;       // { kind: distance|time|calories, target }
  manualLaps: ManualLap[];
  shoeId: string | null;
  workoutId: string | null;
  workoutName: string | null;
  note: string;
}
```

### GeoPoint

```ts
{ lat, lon, t /* epoch ms */, accuracy /* m */, elevation /* m | null */ }
```

### RunGoal targets

| kind | `target` unit |
|------|----------------|
| `distance` | metres |
| `time` | milliseconds of moving time |
| `calories` | kilocalories |

### Invariants

- Pace and averages use **moving time** (`durationMs`), not wall clock.
- Pauses split `segments` so maps do not draw lines across gaps.
- `heartReport` freezes zones at finish so later max-HR edits do not rewrite history.

---

## Full backup JSON (v1)

```json
{
  "format": "runlog-backup",
  "v": 1,
  "activitySchema": 1,
  "exportedAt": 0,
  "activities": [ /* Activity[] */ ],
  "profile": { /* Profile */ },
  "shoes": [ /* Shoe[] */ ],
  "routes": [ /* SavedRoute[] */ ],
  "activePlan": null
}
```

**Import rules**

- Activities: **merge** by `id`; existing ids are skipped (never overwrite).
- Profile: **replace** when present in a full backup.
- Shoes / routes: union by `id` (backup wins on conflict for that id).
- Active plan: restore when the key is present (including `null` to clear).

**Legacy** files with only `{ "v": 1, "activities": [...] }` still import activities.

---

## Profile (settings)

Stored as JSON under `runlog:settings:v1`. Fields include `displayName`,
`theme` (`soft` | `hud`), `units` (`metric` | `imperial`), body metrics
(`age`, `heightCm`, `weightKg`, `sex`, `maxHeartRate`), treadmill
(`strideM`, `footpodCalibration`), `weeklyGoalM`, and run toggles
(`keepAwake`, `audioCues`, `autoPause`). Always coerce with `sanitise()`.

Units: **stored always metric** for physical quantities (metres, kg, cm).
Display conversion happens at the UI edge (`src/core/units.ts`).

---

## Interchange files

| Format | Module | Use |
|--------|--------|-----|
| Full backup `.json` | `backup.ts` | Phone migrate / pre-Android dump |
| GPX 1.1 (+ optional HR extension) | `gpx.ts` | Route + HR for Strava-like apps |
| TCX 2 | `tcx.ts` | Track + HR + calories, Strava/Garmin friendly |

---

## Android port notes

1. Treat this document as the **canonical interchange**.
2. Reimplement `src/platform/*` only (geo, BLE HR, BLE RSC, motion, speech, wake lock).
3. Prefer keeping `src/core/*` logic (or a TypeScript/Kotlin port of the same formulae).
4. First-class restore path: **import full backup JSON** into native storage.
