/**
 * Is the app actually translated?
 *
 * The catalogue types already guarantee that every key has a Greek value, and a
 * separate scan checks that no raw key escapes into the DOM. Neither of those
 * notices the failure that actually happened: a string that was never made a
 * key at all, sitting in the JSX in English, rendering happily in every locale.
 *
 * So this walks the app in Greek and treats any Latin-script word on screen as
 * a bug. That works because Greek shares no letters with the Latin alphabet —
 * the two scripts are disjoint, which makes "wrong language" mechanically
 * detectable in a way it would not be between, say, English and Dutch.
 *
 *   npm run build && npm run test:i18n
 */

import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readdir, readFile } from 'node:fs/promises';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const SRC = join(ROOT, 'src');

const TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json',
  '.json': 'application/json',
};

/**
 * Latin words that are correct in Greek prose.
 *
 * Units and symbols mostly: Greek runners write "km", not "χλμ". Brand and
 * format names are here because translating "Strava" or "GPX" would be wrong,
 * not merely unnecessary. Everything else is guilty until added here on
 * purpose, which is what keeps the list from quietly swallowing real misses.
 */
const ALLOWED = new Set(
  [
    // Units and measures.
    'km', 'mi', 'm', 'cm', 'kg', 'lb', 'kcal', 'bpm', 'spm', 'h', 'min', 's',
    // Heart-rate zones, written Z1–Z5 on the dial itself.
    'Z1', 'Z2', 'Z3', 'Z4', 'Z5', 'HR', 'VO2',
    // Names, formats and standards.
    'RunLog', 'GPS', 'GPX', 'TCX', 'JSON', 'Strava', 'Garmin', 'Android',
    'Samsung', 'Google', 'Health', 'Connect', 'Bluetooth', 'OpenStreetMap',
    'OpenTopoMap', 'Carto', 'Keytel', 'ACSM', 'PWA', 'IndexedDB',
    // The language picker is deliberately readable to someone who cannot read
    // the current UI: each row shows the endonym in its own script plus the
    // English name, and the swatch shows the code.
    'English', 'Nederlands', 'Polski', 'Greek', 'EN', 'EL', 'NL', 'PL',
    /*
     * The running glossary, and the one place this check has to defer to a
     * translator's judgement. Greek runners say "tempo", "fartlek", "strides"
     * and "cruise" in English; el.ts records the decision at the phase-label
     * block. Rendering "χαλαρός ρυθμός κατωφλίου" instead reads like a
     * textbook, not like something anyone says at a track.
     */
    'tempo', 'fartlek', 'strides', 'cruise', 'threshold', 'splits',
    // The x-axis, named as a letter inside otherwise Greek copy.
    'x',
    // Theme names keeping an English term the Greek copy also keeps.
    'HUD', 'Arcade',
    // Greek prose says "browser"; "περιηγητής" is correct and nobody uses it.
    'browser',
    // The info-button glyph. A lowercase i in a circle is a symbol, not a
    // word — its aria-label is the part that had to be translated.
    'i',
  ].map((w) => w.toLowerCase()),
);

function serve() {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    let path = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '');
    if (path === '/' || path === '\\') path = '/index.html';
    try {
      const body = await readFile(join(DIST, path));
      res.writeHead(200, { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream' });
      res.end(body);
    } catch {
      try {
        res.writeHead(200, { 'content-type': 'text/html' });
        res.end(await readFile(join(DIST, 'index.html')));
      } catch {
        res.writeHead(404).end('not found');
      }
    }
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

/*
 * Part one: read the sources.
 *
 * The crawl below is the better check where it reaches, because it sees what
 * actually renders. But it only sees states it can drive itself into — it
 * missed "Not connected" for a whole pass because that pill only exists on the
 * treadmill arming screen, and the crawler had armed an outdoor run. A source
 * scan has no such blind spot: an English sentence sitting between two JSX
 * tags is findable whether or not anything can be clicked to show it.
 *
 * Neither check subsumes the other. This one cannot see strings built by
 * concatenation or returned from a helper; the crawl cannot see screens it
 * cannot open.
 */
const JSX_TEXT = />([^<>{}]*?[A-Za-z]{3}[^<>{}]*?)</g;
/*
 * Fragments of TypeScript that land between a `>` and a `<` — generics closing
 * into JSX, comparisons, ternary arms. Prose is what is wanted, not code.
 *
 * Straight quotes and backticks are the giveaway for the ternaries: this
 * codebase writes apostrophes as ’ in copy, so a ' between two tags is a string
 * literal in an expression rather than a word.
 */
const LOOKS_LIKE_CODE = /[=;()[\]'"`]|=>|\.\w|^\w+\.\w+$/;

/*
 * Copy also hides in attributes, and none of it sits between two tags.
 *
 * `label="Type"` and `placeholder="e.g. Tuesday hills"` both shipped
 * untranslated past the check above, because it only ever reads what a `>` and
 * a `<` enclose. These are the attributes a user can actually read — `id`,
 * `className` and the rest are not prose and are not listed.
 */
const JSX_ATTR = /\b(?:label|title|placeholder|aria-label|alt)="([^"]*[A-Za-z]{3}[^"]*)"/g;

const sourceHits = [];
for (const file of await readdir(SRC, { recursive: true })) {
  if (!file.endsWith('.tsx')) continue;
  const full = join(SRC, file);
  const text = await readFile(full, 'utf8');
  for (const match of text.matchAll(JSX_TEXT)) {
    const value = match[1].replace(/\s+/g, ' ').trim();
    if (!value || LOOKS_LIKE_CODE.test(value)) continue;
    if (!/[A-Za-z]{3}/.test(value)) continue;
    const line = text.slice(0, match.index).split('\n').length;
    sourceHits.push(`${file}:${line}  ${value.slice(0, 70)}`);
  }
  for (const match of text.matchAll(JSX_ATTR)) {
    const line = text.slice(0, match.index).split('\n').length;
    sourceHits.push(`${file}:${line}  ${match[0].slice(0, 70)}`);
  }
}

if (sourceHits.length > 0) {
  console.error(`\n${sourceHits.length} untranslated literals in JSX:\n`);
  for (const hit of sourceHits) console.error(`  ${hit}`);
  console.error('\nWrap each in t() with a key in src/i18n/en.ts and src/i18n/el.ts.\n');
  process.exit(1);
}

/*
 * A saved run, so the crawl can reach the screens that need one.
 *
 * Without it History is empty and the run detail page is unreachable — the
 * heart-rate report, the splits, the chart legend, none of them ever drawn, all
 * of them reported clean. That is exactly how `Z1 zone.recovery.name` shipped:
 * the zone rows put a message key straight into the DOM and nothing in this
 * file had ever rendered one.
 *
 * The track is short and tidy on purpose. This check is about text, not about
 * GPS fidelity; it only has to make the screens exist.
 */
function seedRun() {
  const t0 = 1_755_000_000_000;
  const segment = [];
  const heart = [];
  let lat = 37.9838;
  for (let i = 0; i < 600; i++) {
    lat += 3.2 / 111_320;
    const t = t0 + i * 1000;
    segment.push({ lat, lon: 23.7275, t, accuracy: 5, elevation: 60 + (i % 9) });
    // Climbing across the whole range, so all five zone rows have a bar.
    if (i % 2 === 0) heart.push({ t, bpm: 105 + Math.round((i / 600) * 80) });
  }
  return {
    id: 'i18n-seed-run',
    mode: 'outdoor',
    startedAt: t0,
    durationMs: 600_000,
    distanceM: 1920,
    distanceSource: 'gps',
    segments: [segment],
    heart,
    heartReport: null,
    steps: null,
    inclinePercent: null,
    caloriesKcal: 168,
    goal: null,
    manualLaps: [
      {
        index: 1,
        atDistanceM: 1000,
        atDurationMs: 312_000,
        splitDistanceM: 1000,
        splitDurationMs: 312_000,
      },
    ],
    shoeId: null,
    workoutId: null,
    workoutName: null,
    note: '',
  };
}

// Part two: drive the app and read the screen.
const { server, port } = await serve();
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM ?? undefined,
});
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
});

// Into the database before the app boots and reads it.
await context.addInitScript(
  `(${String(function seed(record) {
    if (typeof indexedDB === 'undefined') return;
    const request = indexedDB.open('runlog', 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('activities')) {
        const store = db.createObjectStore('activities', { keyPath: 'id' });
        store.createIndex('startedAt', 'startedAt');
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction('activities', 'readwrite');
      tx.objectStore('activities').put(record);
    };
  })})(${JSON.stringify(seedRun())})`,
);

const page = await context.newPage();

const pageErrors = [];
page.on('pageerror', (error) => pageErrors.push(String(error)));

await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);

// Greek, and a name so the screens that greet the athlete have one.
await page.evaluate(() => {
  localStorage.setItem(
    'runlog:settings:v1',
    JSON.stringify({ locale: 'el', displayName: 'Άννα', weeklyGoalM: 20000 }),
  );
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(2500);

function visibleText() {
  return page.evaluate(() =>
    [...document.querySelectorAll('.screen, .modal')]
      .filter((el) => el.offsetParent !== null)
      .map((el) => el.innerText)
      .join('\n'),
  );
}

/*
 * Message keys that reached the screen instead of their translation.
 *
 * A different failure to an untranslated literal, and it needs its own eye. The
 * catalogue types cannot help here: MessageKey *is* a string, so `{zone.name}`
 * in JSX compiles happily and renders the key. What gives it away is the shape
 * — `zone.recovery.name` is dotted, lowercase and unspaced, which no piece of
 * copy in any language ever is.
 */
const KEY_SHAPED = /\b[a-z][a-z0-9]*(?:\.[a-z][a-zA-Z0-9]*)+\b/g;

async function leakedKeys() {
  const text = await visibleText();
  return new Set(text.match(KEY_SHAPED) ?? []);
}

/** Every Latin-script word visible right now, minus the allowlist. */
async function latinWords() {
  const text = await visibleText();
  const out = new Set();
  for (const raw of text.split(/[\s·—–…,.:;!?()[\]{}%/+«»"'’]+/)) {
    const word = raw.replace(/^[-–]+|[-–]+$/g, '');
    if (!word) continue;
    // Mixed-script words cannot be a stray literal; pure-Latin ones can.
    if (!/^[A-Za-z][A-Za-z-]*$/.test(word)) continue;
    if (ALLOWED.has(word.toLowerCase())) continue;
    out.add(word);
  }
  return out;
}

const found = new Map();
const keys = new Map();
async function sweep(where) {
  for (const word of await latinWords()) {
    if (!found.has(word)) found.set(word, where);
  }
  for (const key of await leakedKeys()) {
    if (!keys.has(key)) keys.set(key, where);
  }
}

const tabs = page.locator('.tabs button');
const tabCount = await tabs.count();

for (let i = 0; i < tabCount; i++) {
  await tabs.nth(i).click({ force: true });
  await page.waitForTimeout(700);
  const name = (await tabs.nth(i).innerText()).trim().replace(/\s+/g, ' ');
  await sweep(name);

  /*
   * Tabs are the doors, not the rooms. Half of this app's copy lives one tap
   * further in — a plan browser, a recovery guide, a workout picker — and a
   * sweep that only visits tabs reports clean over all of it. That is exactly
   * how the previous check missed three screens.
   */
  const openers = page.locator(
    `.screen:visible button:not(.tabs button):not([aria-pressed]):visible`,
  );
  const openerCount = Math.min(await openers.count(), 14);
  for (let j = 0; j < openerCount; j++) {
    const opener = openers.nth(j);
    let label = '';
    try {
      label = (await opener.innerText()).trim().replace(/\s+/g, ' ').slice(0, 30);
      await opener.click({ timeout: 2000 });
    } catch {
      continue; // Moved, vanished, or covered — nothing to read here.
    }
    await page.waitForTimeout(500);
    await sweep(`${name} › ${label}`);
    /*
     * Get back to a clean tab before the next opener.
     *
     * A left-open sheet is not a cosmetic problem: its backdrop swallows the
     * pointer, so the next tab click times out and the sweep dies partway
     * through reporting clean on everything it never reached. Escape, then the
     * backdrop, then a forced tab click — each covers a case the one before it
     * does not.
     */
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    const backdrop = page.locator('.modal-backdrop');
    if (await backdrop.count()) {
      // Clicking the backdrop itself, away from the sheet, is the dismiss
      // gesture these sheets implement.
      try {
        await backdrop.first().click({ position: { x: 5, y: 5 }, timeout: 1500 });
      } catch {
        /* covered by something else; the forced tab click below still works */
      }
    }
    await page.waitForTimeout(200);
    await tabs.nth(i).click({ force: true, timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(400);
  }

  /*
   * A history row is a door too, and not a `button` the opener sweep above
   * would find its way through. Behind it is the longest single screen in the
   * app — the heart report, the splits, the chart legend, the coach's notes.
   */
  const run = page.locator('.screen:visible .run-item').first();
  if (await run.count()) {
    try {
      await run.click({ timeout: 3000 });
      await page.waitForTimeout(1200);
      await sweep(`${name} › run`);

      // Every control on the detail page: the chart's own series toggles and
      // fullscreen live here and nowhere else.
      const inner = page.locator('.screen:visible button:not(.tabs button):visible');
      for (let k = 0; k < Math.min(await inner.count(), 10); k++) {
        const control = inner.nth(k);
        let label = '';
        try {
          label = (await control.innerText()).trim().replace(/\s+/g, ' ').slice(0, 30);
          await control.click({ timeout: 1500 });
        } catch {
          continue;
        }
        await page.waitForTimeout(400);
        await sweep(`${name} › run › ${label}`);
        await page.keyboard.press('Escape');
        await page.waitForTimeout(200);
      }
    } catch {
      /* Could not open it; the tab click below puts us back either way. */
    }
    await tabs.nth(i).click({ force: true, timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(400);
  }
}

await browser.close();
server.close();

if (pageErrors.length > 0) {
  console.error(`\nUncaught page errors:\n`);
  for (const error of pageErrors) console.error(`  ✗ ${error}`);
  process.exit(1);
}

if (keys.size > 0) {
  console.error(`\n${keys.size} message keys rendered instead of their translation:\n`);
  for (const [key, where] of [...keys].sort((a, b) => a[0].localeCompare(b[0]))) {
    console.error(`  ${key}\n    on ${where}`);
  }
  console.error(
    '\nSomething put a MessageKey into JSX without calling t() on it. The types\n' +
      'cannot catch this — MessageKey is a string, so `{zone.name}` compiles and\n' +
      'renders the key. Wrap it: `{t(zone.name)}`.\n',
  );
  process.exit(1);
}

if (found.size > 0) {
  const byPlace = new Map();
  for (const [word, where] of [...found].sort((a, b) => a[0].localeCompare(b[0]))) {
    if (!byPlace.has(where)) byPlace.set(where, []);
    byPlace.get(where).push(word);
  }
  console.error(`\n${found.size} untranslated words on screen in Greek:\n`);
  for (const [where, words] of byPlace) {
    console.error(`  ${where}\n    ${words.join(', ')}\n`);
  }
  console.error(
    'Each of these is a string that was never made a message key. Add it to\n' +
      'src/i18n/en.ts and src/i18n/el.ts, or to ALLOWED here if it is genuinely\n' +
      'Latin in Greek (a unit, a brand, a file format).\n',
  );
  process.exit(1);
}

console.log('✓ no untranslated text found in Greek');
