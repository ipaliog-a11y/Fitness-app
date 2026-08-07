# RunLog UI design kit

Saved visual system from the refresh mockups.

**In app:** Settings → **Theme** switches between Soft Emerald (`soft`) and Athletic HUD (`hud`). Preference is on the profile (`theme` field in `localStorage` key `runlog:settings:v1`) and applied as `document.documentElement.dataset.theme`.

| File | What |
|------|------|
| [ui-mockups.html](ui-mockups.html) | Side-by-side chooser |
| [ui-mockup-A-soft-emerald.html](ui-mockup-A-soft-emerald.html) | **Direction A** full screens |
| [ui-mockup-B-athletic-hud.html](ui-mockup-B-athletic-hud.html) | **Direction B** full screens |
| [ui-mockup-refresh.html](ui-mockup-refresh.html) | Alias of Direction A (original path) |

Both directions keep:

- Dark outdoor-readable base (no forced light mode)
- Five-tab shell: Run · History · Coach · Profile · Settings
- Large primary numbers + tabular numerals
- Full-width Pause / Finish on live run
- Local-first IA (no social feed)

---

## Direction A — Soft Emerald

**Personality:** calm modern product UI (wellness / polished consumer).

### Tokens

```css
:root {
  --bg: #0a0d12;
  --bg-elev: #0f141c;
  --surface: #151b25;
  --surface-2: #1c2430;
  --surface-3: #242d3b;
  --line: #2e3848;
  --line-soft: rgba(148, 163, 184, 0.12);
  --text: #f1f5f9;
  --muted: #94a3b8;
  --muted-2: #64748b;
  --accent: #34d399;
  --accent-bright: #6ee7b7;
  --accent-dim: rgba(16, 185, 129, 0.18);
  --accent-glow: rgba(52, 211, 153, 0.35);
  --warn: #fbbf24;
  --danger: #fb7185;
  --info: #38bdf8;
  --radius: 16px;
  --radius-sm: 12px;
  --radius-lg: 22px;
  --shadow: 0 8px 28px rgba(0, 0, 0, 0.45);
  --font: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
}
```

### Elements (save list)

| Element | Spec |
|---------|------|
| **Floating tab bar** | Pill, inset 10px from edges, `backdrop-filter: blur(16px)`, active tab tint square behind icon |
| **Stroke icons** | 20×20 SVG outline, 5 tabs, live green dot on Run while armed/running |
| **Hero START** | 92px circle, emerald gradient fill, outer glow ring, “GPS ready” pill above |
| **Mode segment** | 2-up pill control Outdoor / Treadmill |
| **Collapsible cards** | Uppercase micro-label `h2`, chevron, soft border, 16px radius |
| **Goal chips** | Pill chips, active = accent-dim fill + accent border |
| **Sensor chips** | 2-column, status dot (good/warn/idle) |
| **Live hero metric** | ~56px time, uppercase micro-label under |
| **Goal track** | Soft card + 7px rounded progress bar |
| **Metric grid** | 2×2 tiles with soft borders |
| **Run actions** | Pause (surface) + Finish (danger tint), equal height large hits |
| **History row** | Date badge (day number + weekday), headline, meta, optional HR zone strip |
| **Calendar cell** | Soft rounded, run = accent-dim fill, plan = blue bottom dot |
| **Coach recovery** | Large soft card + status tag + 3 mini stats |
| **Next session** | Card with full-width green CTA “Start on Run tab” |

### Hierarchy rules (A)

1. One primary action above the fold on Run ready (START).
2. Secondary setup (goal / workout / shoes) collapses; sensors stay visible.
3. Live run: time first, goal second, secondaries third, map fourth, actions sticky-feel at bottom.
4. Coach: recovery → next session → tips (never tips first).

---

## Direction B — Athletic HUD

**Personality:** sport watch / race-day instrument panel.

### Tokens

```css
:root {
  --bg: #050505;
  --bg-elev: #0a0a0a;
  --surface: #111111;
  --surface-2: #181818;
  --surface-3: #222222;
  --line: #2a2a2a;
  --line-hard: #3a3a3a;
  --text: #fafafa;
  --muted: #a3a3a3;
  --muted-2: #6b6b6b;
  --accent: #c8ff00;          /* volt lime — high sun contrast */
  --accent-dim: rgba(200, 255, 0, 0.12);
  --accent-ink: #0a0f00;      /* text on volt buttons */
  --cyan: #00e5ff;            /* HR / plan secondary */
  --warn: #ffb020;
  --danger: #ff2d55;
  --info: #5ac8ff;
  --radius: 10px;
  --radius-sm: 8px;
  --radius-lg: 14px;
  --font: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  --mono: ui-monospace, "Cascadia Mono", Consolas, monospace;
}
```

### Elements (save list)

| Element | Spec |
|---------|------|
| **Solid tab bar** | Edge-to-edge, no float, hairline top border, uppercase 8–9px labels, active = volt stroke icons |
| **Live tab indicator** | Red recording dot (not green) on Run while live |
| **Mode underline tabs** | Full-width Outdoor / Treadmill with 2px volt underline |
| **Ring GO** | Conic-gradient ring (readiness/progress), center “GO”, mono status under |
| **Dense panels** | Flat `#111` panels, uppercase 10px headers, mono “Edit” actions |
| **Goal segment** | 4 hard chips Free / Dist / Time / Kcal, active = solid volt on black text |
| **KV setup rows** | Label uppercase muted / value mono right-aligned |
| **Sensor grid** | 2 flat cells, live border volt + volt value |
| **HUD time** | ~58px **mono** clock, letter-spaced MOVING label |
| **Goal strip** | Thin volt border, mono “GOAL 5.00 KM”, 4px hard progress |
| **Metric rows** | Stacked full-width rows: LABEL left, number right (watch face) |
| **Actions** | Square-ish 4px radius; Pause dark; Finish **solid danger red** |
| **History row** | 4px left accent bar, mono date code `THU 07`, mono meta line |
| **Calendar cell** | Hard 2px radius squares; run = **solid volt** fill (max outdoor contrast) |
| **Coach load ring** | Small conic ring + BALANCED tag + 3 mono ATL/CTL/TSB cells |
| **Next CTA** | Solid volt button, black ink, uppercase |

### Hierarchy rules (B)

1. Instrument first: mono time / distance dominate; decoration almost none.
2. Prefer rows over tiles for mid-run metrics (faster vertical scan).
3. Accent used sparingly: active state, progress, GO — not large soft fills.
4. Finish is unmistakably red (destructive end of bout).

---

## Shared component inventory (both)

Implement once, theme with tokens:

1. `TabBar` — prop: `variant: 'floating' | 'solid'`
2. `ModeSwitch` — prop: `variant: 'segment' | 'underline'`
3. `StartControl` — prop: `variant: 'circle' | 'ring'`
4. `MetricHero` — time/distance large value
5. `MetricGrid` vs `MetricRows`
6. `GoalTrack`
7. `SensorChip` / `SensorCell`
8. `RunListItem` — prop: `variant: 'badge' | 'bar'`
9. `CalMonth`
10. `RecoveryCard` / `LoadRing`
11. `NextSessionCard`
12. `PrimaryButton` / `DangerButton` / `GhostChip`

---

## Suggested decision

| Choose A if… | Choose B if… |
|--------------|--------------|
| You want friendlier, calmer, “app store modern” | You want aggressive sport / data HUD |
| Prefer soft green continuity with current app | Want a clear break from current slate-green |
| Like floating blur chrome | Prefer solid dock (more Android-native feel) |
| Rounded cards and chips | Hard panels and mono numbers |

**Hybrid option:** Direction A chrome (floating tabs + soft surfaces) + Direction B live-run metric **rows** and solid Finish. Document that as Direction C only if you want it later.

---

## Implementation order (either direction)

1. **Tokens only** in `styles.css` `:root` + tab bar + icons  
2. Run ready hierarchy (Start control + fold setup)  
3. Live metrics layout  
4. History + Coach polish  

No flow/API changes required for visual-only PRs.
