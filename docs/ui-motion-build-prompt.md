# Build prompt — RunLog depth & motion pass

Copy everything below the line into Grok.

---

You are working in the **RunLog** repo (`ipaliog-a11y/Fitness-app`) — a local-only
running tracker: React 18 + TypeScript (strict) + Vite 5, PWA, with a Capacitor
Android shell. Architecture is `src/core/` (pure, DOM-free, unit-tested),
`src/platform/` (browser APIs), `src/ui/` (React). All styling lives in one file,
`src/styles.css` (~3300 lines).

There are three themes: `soft` (Soft Emerald, dark), `hud` (Athletic HUD, pure
black), `day` (Daylight, white — built for direct sun). Every visual value is a
CSS custom property defined in three blocks at the top of `src/styles.css`.

**`data-theme` is carried on two elements**, kept in sync: `<html>`
(`src/core/settings.ts:166`) and `<div class="app">` (`src/App.tsx:163`). The
`.app` one is the one that governs everything you see, because it re-declares
the whole token set for its descendants. If you test by hand-editing the
attribute, change **both** or you will get one theme's tokens on the other
theme's ground and chase a bug that is not there.

Implement the five changes below, plus the prerequisite. They are all small and
mostly CSS. **Do not refactor anything else.**

## Non-negotiables

1. **Never hardcode a colour.** Every new colour comes from an existing token or
   a new token defined in all three theme blocks. A literal hex outside those
   blocks is a bug.
2. **Per-theme values, not one global value.** Several changes below
   deliberately resolve to *different* values — including `none` — per theme.
   That is the point, not an oversight.
3. **Legibility beats effect.** This app is read at arm's length, in sunlight,
   mid-run. Nothing may reduce contrast of a number or label.
4. **No new dependencies.** No animation library. Plain CSS, plus the small bits
   of React noted.
5. Keep the existing comment style: comments explain *why*, not *what*.
6. `npm run typecheck` and `npm run build` must pass.
7. **`npm run test` is already red on `main` before you start**, with one
   failure: *"a truncated packet is refused rather than misread: stride
   promised, absent"*. That is a stale test, not a bug you introduced — commit
   `86d18ef` deliberately made `parseRscMeasurement` lenient (real foot pods set
   the stride flag then omit the field, and dropping the whole packet loses good
   speed and cadence data), but the test still asserts the old strict `null`.
   **Do not "fix" it by reverting the parser.** Leave it alone; it is outside
   this task.

---

## Change 0 — Prerequisite: make reduced-motion a blanket rule

`prefers-reduced-motion` is currently honoured in exactly one place, and three
animations already run past it (`goal-pulse`, `pulse` — which loops forever —
and `live-rec-pulse`). Fix this **first**, so everything added afterwards is
covered by default rather than by memory.

Find this block in `src/styles.css` (around line 1682):

```css
/* Someone who gets motion sick should not be given a pulsing dot. */
@media (prefers-reduced-motion: reduce) {
  .dot.live {
    animation: none;
  }
}
```

Replace it with:

```css
/*
 * One gate for all motion. Previously only .dot.live was covered, and three
 * animations had quietly slipped past it — including one that loops forever.
 * A blanket rule means new motion is covered by default instead of remembered.
 *
 * Near-zero rather than `none` so transitionend/animationend still fire and
 * nothing that waits on them hangs.
 */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.001ms !important;
    scroll-behavior: auto !important;
  }
}
```

---

## Change 1 — Every tap answers back

**Problem.** Nothing in the app has an `:active` state except `.metric-pod`.
Buttons, history rows and tab items sit perfectly still under a thumb. On touch
there is no hover to fall back on, so this reads as a dropped input and the
instinct is to tap again.

**The amount must be a token, not a constant.** Soft and Daylight compress
slightly; HUD stays rigid and answers with brightness alone, because a springy
button contradicts everything else that theme says. And Daylight *darkens* on
press — on a white ground, "brighter" is invisible.

### 1a. Add a token to each of the three theme blocks in `src/styles.css`

In `:root, [data-theme='soft']`, after `--map-tile-dim: 0.72;`:

```css
  /* How far a control compresses when pressed. HUD overrides to 1 — see below. */
  --press-scale: 0.972;
```

In `[data-theme='hud']`, after `--map-tile-dim: 0.6;`:

```css
  /* Rigid on purpose: a springy control fights the instrument-panel language.
     HUD answers a press with brightness instead. */
  --press-scale: 1;
```

In `[data-theme='day']`, after `--map-tile-dim: 1;`:

```css
  --press-scale: 0.972;
```

### 1b. Add the rules

Put these next to the existing `.btn` rules:

```css
/*
 * Touch has no hover, so a control that does not move under a thumb reads as a
 * dropped tap. 90ms is under the ~100ms that registers as "instant".
 */
.btn,
.run-item,
.tabs button {
  transition:
    transform 90ms ease-out,
    filter 90ms ease-out;
}

.btn:active,
.run-item:active,
.tabs button:active {
  transform: scale(var(--press-scale, 0.972));
  filter: brightness(1.14);
}

/* On white, "brighter" is invisible — press has to darken instead. */
[data-theme='day'] .btn:active,
[data-theme='day'] .run-item:active,
[data-theme='day'] .tabs button:active {
  filter: brightness(0.95);
}

/* Pure black needs a bigger step to read at all. */
[data-theme='hud'] .btn:active,
[data-theme='hud'] .tabs button:active {
  filter: brightness(1.3);
}
```

### 1c. Extend the pod, don't fight it

`.metric-pod` already has its own `:active` (an accent border) and its own
transition list. Do **not** add it to the selectors above — extend it in place
instead, or the two rules will clobber each other's `transition`.

Change:

```css
.metric-pod {
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  text-align: center;
  transition: border-color 0.15s ease, background 0.15s ease;
  min-width: 0;
}

.metric-pod:active {
  border-color: var(--accent);
}
```

to:

```css
.metric-pod {
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  text-align: center;
  transition: border-color 0.15s ease, background 0.15s ease, transform 90ms ease-out;
  min-width: 0;
}

.metric-pod:active {
  border-color: var(--accent);
  transform: scale(var(--press-scale, 0.972));
}
```

---

## Change 2 — An elevation ladder each theme controls

**Problem.** `.card` has no `box-shadow` at all. Surfaces are separated purely by
a 1px border, so the whole interface sits on one plane.

**The trap is a single global shadow.** Soft takes a soft ambient cast; HUD sets
it to `none` because a glow under a hard-edged instrument panel just looks like
a mistake; Daylight gains the most, trading its heavy `#b3bfcc` 2px border for a
crisp low-alpha shadow and a lighter line.

### 2a. Tokens

In `:root, [data-theme='soft']`:

```css
  /*
   * Two planes, no more. A tight contact shadow plus a wide ambient one; the
   * wide one is heavily negative-spread so it reads as depth, not as a halo.
   */
  --shadow-1: 0 1px 2px rgba(0, 0, 0, 0.4), 0 10px 26px -14px rgba(0, 0, 0, 0.85);
  --shadow-2: 0 2px 6px rgba(0, 0, 0, 0.45), 0 18px 40px -18px rgba(0, 0, 0, 0.9);
```

In `[data-theme='hud']`:

```css
  /* Flat on purpose. This theme's depth cue is the border, and a soft shadow
     under a hard edge reads as a rendering fault rather than elevation. */
  --shadow-1: none;
  --shadow-2: none;
```

In `[data-theme='day']`:

```css
  /* On white the shadow does the work the border was doing, so the border can
     get out of the way — see the lighter --line-card below. */
  --shadow-1: 0 1px 2px rgba(11, 15, 20, 0.07), 0 6px 16px -10px rgba(11, 15, 20, 0.35);
  --shadow-2: 0 2px 5px rgba(11, 15, 20, 0.09), 0 14px 30px -14px rgba(11, 15, 20, 0.4);
```

### 2b. A card border token, so Daylight can soften

Add to all three blocks. Soft and HUD keep their existing `--line`; only Daylight
changes:

- `:root, [data-theme='soft']` → `--line-card: var(--line);`
- `[data-theme='hud']` → `--line-card: var(--line);`
- `[data-theme='day']` → `--line-card: #dfe5ec;`

### 2c. Apply

Change `.card`'s `border: 1px solid var(--line);` to `border: 1px solid var(--line-card);`
and add `box-shadow: var(--shadow-1);`. Do the same for `.run-item`.

**Leave `.tabs` alone.** It already has its own box-shadow with per-theme
overrides; do not route it through these tokens in this pass.

### 2d. Daylight actively blocks this — you must split its override

There is an existing rule near the bottom of `src/styles.css` that kills any
shadow on Daylight. **If you skip this step, change 2 silently does nothing on
the Daylight theme** and you will think the tokens are wrong.

Find:

```css
[data-theme='day'] .card,
[data-theme='day'] .metric,
[data-theme='day'] .run-item,
[data-theme='day'] .goal-track {
  border-width: 2px;
  box-shadow: none;
}
```

Replace with:

```css
/*
 * Metric tiles and the goal track keep the heavy border: they sit on a card,
 * not on the page, so a shadow has nothing to lift them off. Cards and run
 * items now use --shadow-1 instead and drop back to a 1px line.
 */
[data-theme='day'] .metric,
[data-theme='day'] .goal-track {
  border-width: 2px;
  box-shadow: none;
}
```

---

## Change 3 — Let content fade out under the tab bar

**Problem.** The tab bar is `position: fixed` with `backdrop-filter: blur(16px)`.
Content scrolls under it and is guillotined at its top edge. Worse, in the
`soft` theme the bar floats with `--tab-inset: 10px`, so live content is visible
in the gap *beneath* it.

A gradient scrim makes content dissolve instead of being cut, and signals there
is more below.

Add near the `.tabs` rules in `src/styles.css`:

```css
/*
 * Content slides under a fixed, blurred bar and gets cut off at its top edge —
 * and in the soft theme, which floats the bar with a 10px inset, it is also
 * visible in the gap underneath. A scrim dissolves it instead, and doubles as a
 * "there is more below" cue.
 *
 * z-index 19 puts it under the bar (20) but over content; the toast (40) and
 * modals (40+) stay clear of it.
 */
.app::after {
  content: '';
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  height: calc(92px + var(--safe-bottom));
  pointer-events: none;
  z-index: 19;
  background: linear-gradient(
    to top,
    var(--bg) 26%,
    color-mix(in srgb, var(--bg) 55%, transparent) 62%,
    transparent
  );
}
```

---

## Change 4 — Tint the heart-rate pill with its own zone

**Problem.** There is already a five-rung, per-theme, contrast-checked zone
colour ladder (`--zone-1` … `--zone-5`), and it is only used in charts and the
history strip. The live HR pill — the thing actually glanced at mid-run — is
neutral grey.

Tinting it means **zone reads peripherally, without focusing on the number**.

### 4a. `src/ui/RunScreen.tsx`

Add `zoneSwatch` to the existing heart import:

```ts
import { zoneOf, zoneSwatch } from '../core/heart';
```

Also add the `CSSProperties` type to the existing `react` import — the project
uses the modern JSX transform, so there is no `React` namespace in scope and
`as React.CSSProperties` will **not** compile:

```ts
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type Dispatch,
  type SetStateAction,
} from 'react';
```

`zoneSwatch(zone)` returns `var(--zone-N, #fallback)`, so it already resolves
per theme.

Find the HR pill (around line 1538):

```tsx
            <span className="live-hr-pill">
              ❤ {bpm}
              {hrZone ? ` · Z${hrZone.index}` : ''}
            </span>
```

Replace with:

```tsx
            <span
              className="live-hr-pill"
              /* The zone drives the pill's own colour, so effort is readable
                 without focusing on the number. Unset when there is no zone
                 yet — the CSS falls back to neutral. */
              style={hrZone ? ({ '--z': zoneSwatch(hrZone) } as CSSProperties) : undefined}
            >
              ❤ {bpm}
              {hrZone ? ` · Z${hrZone.index}` : ''}
            </span>
```

### 4b. `src/styles.css`

Find `.live-hr-pill` and add:

```css
.live-hr-pill {
  /* Neutral until a zone is known, so the pill never renders colourless. */
  --z: var(--muted);
  border-color: color-mix(in srgb, var(--z) 55%, transparent);
  background: color-mix(in srgb, var(--z) 13%, var(--surface-2));
  box-shadow: 0 0 18px -4px color-mix(in srgb, var(--z) 60%, transparent);
  /*
   * Slow on purpose. A heart rate sitting on a zone boundary flickers between
   * two rungs; at 500ms that reads as a drift rather than a strobe.
   */
  transition:
    box-shadow 500ms ease-out,
    background-color 500ms ease-out,
    border-color 500ms ease-out;
}
```

Keep whatever `.live-hr-pill` already declares for size, radius and font —
only add the above.

**Check the text still passes contrast on all three themes**, especially
Daylight, whose zone ladder is much darker. The tint is 13% so it should be
safe, but verify rather than assume.

---

## Change 5 — Mark the kilometre, ignore the second

**The restraint is the whole point.** The obvious move is animating numbers as
they change — but the clock ticks once a second for an hour. Animate that and
you have built a distraction that cannot be switched off.

So: animate nothing on tick, and flash the distance for 620ms **only when the
whole-unit digit rolls over**. That is a real event, it happens roughly every
five minutes, and it pairs with the split already being logged.

Two complications in the current code, both of which must be handled:

- The live metric grid uses **flippable pods**. The distance pod (`id: 'distance'`)
  shows distance on face 0 and goal-remaining on face 1. Only flash when face 0
  is showing.
- The user may be in **miles**. Fire on whole units of the *displayed* unit, and
  do not fire a spurious flash when the unit setting itself changes.

### 5a. `src/ui/RunScreen.tsx`

Add `toDisplayDistance` to the units import:

```ts
import {
  distanceLabel,
  formatDistance,
  formatDuration,
  formatPace,
  paceLabel,
  paceSecondsPerUnit,
  toDisplayDistance,
} from '../core/units';
```

Then, near the other hooks in the component (after `const distance = session.distanceM;`
is in scope):

```tsx
  /*
   * A whole kilometre (or mile) is worth reporting; a passing second is not.
   * Fires on the displayed unit so a miles user gets miles, and re-baselines
   * instead of flashing when the unit setting itself changes.
   */
  const [unitFlash, setUnitFlash] = useState(false);
  const lastWholeRef = useRef<number | null>(null);
  const flashUnitsRef = useRef(profile.units);

  useEffect(() => {
    const whole = Math.floor(toDisplayDistance(distance, profile.units));
    const previous = lastWholeRef.current;
    const rebase = previous === null || flashUnitsRef.current !== profile.units;
    flashUnitsRef.current = profile.units;
    lastWholeRef.current = whole;

    if (rebase || whole <= previous) return;

    setUnitFlash(true);
    const timer = setTimeout(() => setUnitFlash(false), 700);
    return () => clearTimeout(timer);
  }, [distance, profile.units]);
```

Then in the pod `.map()`, extend the className (around line 1794):

```tsx
                    className={`metric metric-pod${podFace[pod.id] === 1 ? ' alt' : ''}${
                      pod.id === 'distance' && podFace.distance === 0 && unitFlash
                        ? ' unit-tick'
                        : ''
                    }`}
```

### 5b. `src/styles.css`

```css
/*
 * Named for the unit, not the kilometre: a miles user crosses miles.
 * inline-block because a transform does nothing to an inline box.
 */
@keyframes unit-tick {
  0% {
    transform: scale(1);
    color: var(--text);
  }
  22% {
    transform: scale(1.07);
    color: var(--accent);
  }
  100% {
    transform: scale(1);
    color: var(--text);
  }
}

.metric-pod.unit-tick .value {
  display: inline-block;
  animation: unit-tick 620ms cubic-bezier(0.2, 0.7, 0.3, 1);
}
```

---

## Acceptance checks

Run all three themes (Settings → Theme) and confirm:

1. `npm run typecheck` clean and `npm run build` succeeds. `npm run test` shows
   the same single pre-existing foot-pod failure as before your changes — no
   more, no fewer.
2. **Press** — buttons, history rows and tabs visibly respond to a tap in Soft
   and Daylight. HUD does **not** scale but does brighten. Daylight darkens
   rather than brightens.
3. **Elevation** — cards and history rows are lifted in Soft and Daylight;
   in HUD `getComputedStyle(card).boxShadow` is exactly `none`. Daylight's card
   border is visibly lighter than before.
4. **Scrim** — scrolling a long list, content fades out above the tab bar
   instead of being cut. In Soft, nothing is visible in the gap beneath the
   floating bar any more. Taps near the bottom of the screen still work
   (`pointer-events: none` must be present).
5. **HR pill** — during a run with a strap connected the pill takes the zone
   colour and changes colour smoothly, not abruptly, when the zone changes.
   With no strap it is neutral, not colourless.
6. **Unit tick** — the distance pod flashes once when crossing a whole
   kilometre, does **not** flash on every clock tick, does not flash when the
   pod is flipped to goal-remaining, and does not flash when switching
   km ↔ miles in Settings.
7. **Reduced motion** — with the OS setting on, none of the above animates, and
   the app remains fully usable.

## Out of scope — do not do these

- Tab-change transitions (`@starting-style`), scroll-condensed headers
  (`animation-timeline: scroll()`), and View Transitions on history rows. These
  are a separate decision.
- Any change to `.tabs`' existing box-shadow.
- Any restructuring of `RunScreen.tsx`, the pod system, or the theme blocks
  beyond adding the tokens listed above.
