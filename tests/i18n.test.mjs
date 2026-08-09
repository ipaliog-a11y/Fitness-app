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
    'tempo', 'fartlek', 'strides', 'cruise', 'threshold',
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
}

if (sourceHits.length > 0) {
  console.error(`\n${sourceHits.length} untranslated literals in JSX:\n`);
  for (const hit of sourceHits) console.error(`  ${hit}`);
  console.error('\nWrap each in t() with a key in src/i18n/en.ts and src/i18n/el.ts.\n');
  process.exit(1);
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
const page = await context.newPage();

const pageErrors = [];
page.on('pageerror', (error) => pageErrors.push(String(error)));

await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);

// Greek, and a saved treadmill run so the screens that need history have some.
await page.evaluate(() => {
  localStorage.setItem(
    'runlog:settings:v1',
    JSON.stringify({ locale: 'el', displayName: 'Άννα', weeklyGoalM: 20000 }),
  );
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(2500);

/** Every Latin-script word visible right now, minus the allowlist. */
async function latinWords() {
  const text = await page.evaluate(() =>
    [...document.querySelectorAll('.screen, .modal')]
      .filter((el) => el.offsetParent !== null)
      .map((el) => el.innerText)
      .join('\n'),
  );
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
async function sweep(where) {
  for (const word of await latinWords()) {
    if (!found.has(word)) found.set(word, where);
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
}

await browser.close();
server.close();

if (pageErrors.length > 0) {
  console.error(`\nUncaught page errors:\n`);
  for (const error of pageErrors) console.error(`  ✗ ${error}`);
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
