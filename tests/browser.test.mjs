/**
 * A run, in a real browser.
 *
 * The core tests prove the arithmetic; this proves the app is wired to it —
 * that permissions are asked for, fixes reach the session, the clock advances,
 * and a finished run survives into IndexedDB and back out onto the history and
 * dashboard screens.
 *
 * Geolocation is driven through Playwright's mock, so a whole outdoor run
 * happens at a desk. It still takes about twenty seconds of real time, because
 * the fixes carry real timestamps and the app rejects anything moving faster
 * than a sprinter.
 *
 *   npm run build && npm run test:browser
 */

import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIST = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');

const TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json',
  '.json': 'application/json',
};

function serve() {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    // Everything that is not a file falls back to the shell, the way any static
    // host serving a single-page app would.
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

const failures = [];
let passed = 0;

function check(name, condition, detail = '') {
  if (condition) passed++;
  else failures.push(`${name}${detail ? `: ${detail}` : ''}`);
}

const METRES_PER_DEGREE_LAT = 111195;

const { server, port } = await serve();
const browser = await chromium.launch({
  // Provided by the image; Playwright's own download is disabled here.
  executablePath: process.env.PLAYWRIGHT_CHROMIUM ?? undefined,
});

const context = await browser.newContext({
  permissions: ['geolocation'],
  geolocation: { latitude: 60, longitude: 24.9, accuracy: 5 },
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
});

const page = await context.newPage();

const consoleErrors = [];
page.on('pageerror', (error) => consoleErrors.push(String(error)));
page.on('console', (message) => {
  if (message.type() === 'error') consoleErrors.push(message.text());
});

await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load' });

// --- The app renders ------------------------------------------------------

await page.waitForSelector('.mode-picker', { timeout: 10_000 });
check('the run screen renders', await page.isVisible('text=New run'));
check('both modes are offered', (await page.locator('.mode-picker button').count()) === 2);
check('all four tabs are present', (await page.locator('.tabs button').count()) === 4);

// --- An outdoor run -------------------------------------------------------

await page.click('text=Start outdoor run');
await page.waitForSelector('.metric-hero', { timeout: 5000 });
check('the run screen takes over', await page.isVisible('text=Finish'));

// Run north at about 10 m/s.
//
// The speed has to be physically plausible in *wall clock* time, because the
// fixes carry the browser's own timestamps and the filter rejects anything
// faster than a sprint as a GPS glitch. Firing these off as fast as the loop
// allows implies several hundred metres a second, and the app correctly throws
// every one of them away — so the test has to actually take its fourteen
// seconds.
const FIXES = 12;
const STEP_M = 12;
for (let i = 1; i <= FIXES; i++) {
  await context.setGeolocation({
    latitude: 60 + (i * STEP_M) / METRES_PER_DEGREE_LAT,
    longitude: 24.9,
    accuracy: 5,
  });
  await page.waitForTimeout(1200);
}

// Let the one-second tick land so the displayed numbers are current.
await page.waitForTimeout(1400);

const distanceText = await page.locator('.metric .value').first().textContent();
const distance = Number(distanceText);
const expectedKm = (FIXES * STEP_M) / 1000;
check(
  'distance accumulates from the fixes',
  distance > expectedKm * 0.7 && distance < expectedKm * 1.2,
  `showed ${distanceText} km for a ~${expectedKm.toFixed(2)} km run`,
);
check('the map appears once there is a track', await page.isVisible('.map'));

const clock = await page.locator('.metric-hero .value').textContent();
check('the clock is running', /^\d+:\d{2}/.test(clock.trim()), `showed "${clock}"`);

// Pause must stop the clock.
await page.click('button:has-text("Pause")');
const paused = await page.locator('.metric-hero .value').textContent();
await page.waitForTimeout(2200);
const stillPaused = await page.locator('.metric-hero .value').textContent();
check('pausing stops the clock', paused === stillPaused, `${paused} then ${stillPaused}`);
check('the paused state is shown', await page.isVisible('.pill.warn:has-text("Paused")'));

await page.click('button:has-text("Resume")');
await page.click('button:has-text("Finish")');

// --- It is saved and shown ------------------------------------------------

await page.waitForSelector('.screen h1', { timeout: 5000 });
check('the finished run opens its detail screen', await page.isVisible('text=Outdoor run'));
check('the detail screen draws the route', await page.isVisible('.map'));
check('splits are computed', await page.isVisible('text=Splits'));
check('the coach says something', await page.isVisible('text=Notes from the coach'));

// It must survive a reload — that is the whole point of the database.
await page.reload({ waitUntil: 'load' });
await page.waitForSelector('.tabs', { timeout: 10_000 });
await page.click('.tabs button:has-text("History")');
await page.waitForSelector('.run-item', { timeout: 5000 });
check('the run is still there after a reload', (await page.locator('.run-item').count()) === 1);

await page.click('.tabs button:has-text("Dashboard")');
await page.waitForSelector('text=Dashboard', { timeout: 5000 });
check('the dashboard renders', await page.isVisible('text=This week'));
check('the weekly chart renders', (await page.locator('.bars .bar').count()) >= 12);

// --- Treadmill ------------------------------------------------------------

await page.click('.tabs button:has-text("Run")');
await page.waitForSelector('.mode-picker');
await page.click('text=🎽 Treadmill');
await page.click('text=Start treadmill run');
await page.waitForSelector('.metric-hero');
check('the treadmill run offers a manual distance', await page.isVisible('text=From the console'));

await page.fill('#manual-distance', '3');
await page.waitForTimeout(1200);
await page.click('button:has-text("Finish")');
await page.waitForSelector('.screen h1', { timeout: 5000 });

const treadmillDistance = await page.locator('.screen h1').textContent();
check(
  'the typed distance is used',
  treadmillDistance.trim().startsWith('3.00'),
  `showed "${treadmillDistance.trim()}"`,
);
check('the treadmill run is labelled', await page.isVisible('text=Treadmill run'));

// --- Settings -------------------------------------------------------------

await page.click('.tabs button:has-text("Settings")');
await page.waitForSelector('text=Units');
await page.click('button:has-text("Miles")');
await page.click('.tabs button:has-text("History")');
await page.waitForSelector('.run-item');
const inMiles = await page.locator('.run-item .headline').first().textContent();
check('switching units re-renders distances', inMiles.includes('mi'), `showed "${inMiles}"`);

check('no uncaught errors', consoleErrors.length === 0, consoleErrors.join(' | '));

// --- Report ---------------------------------------------------------------

await browser.close();
server.close();

if (failures.length > 0) {
  console.error(`\n${failures.length} failing:\n`);
  for (const failure of failures) console.error(`  ✗ ${failure}`);
  console.error('');
  process.exit(1);
}

console.log(`✓ ${passed} browser checks passed`);
