/**
 * The service worker.
 *
 * Two jobs: make the app open without a network, and keep map tiles you have
 * already seen. A running app that needs a signal to start is useless in exactly
 * the places people run.
 *
 * Plain JS in public/ rather than a bundled module, so it is served verbatim at
 * a stable URL and its scope covers the whole app.
 */

const VERSION = 'runlog-v1';
const SHELL = `${VERSION}-shell`;
const TILES = `${VERSION}-tiles`;

// Capped because a few long runs in unfamiliar places would otherwise fill the
// origin's storage quota with map imagery.
const TILE_LIMIT = 600;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      // './' rather than '/': the app may be served from a subpath.
      .then((cache) => cache.addAll(['./', './index.html', './manifest.webmanifest']))
      // A missing entry must not block activation — the runtime cache below
      // will pick everything up on first use anyway.
      .catch(() => {})
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => !key.startsWith(VERSION)).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

/** Oldest-first eviction, which for a tile cache is a good enough approximation of least-used. */
async function trim(cacheName, limit) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= limit) return;
  await Promise.all(keys.slice(0, keys.length - limit).map((key) => cache.delete(key)));
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Map tiles: cache first. They never change, and a cached tile is the
  // difference between a map and a blank square when the signal drops.
  if (url.hostname.endsWith('tile.openstreetmap.org')) {
    event.respondWith(
      caches.open(TILES).then(async (cache) => {
        const hit = await cache.match(request);
        if (hit) return hit;
        try {
          const response = await fetch(request);
          // Tile servers answer cross-origin requests opaquely; an opaque
          // response is still perfectly drawable, so it is worth keeping.
          if (response.ok || response.type === 'opaque') {
            await cache.put(request, response.clone());
            void trim(TILES, TILE_LIMIT);
          }
          return response;
        } catch {
          return new Response('', { status: 504, statusText: 'Offline' });
        }
      }),
    );
    return;
  }

  if (url.origin !== self.location.origin) return;

  // Navigations: network first, so a deployed update is picked up straight
  // away, with the cached shell as the offline fallback.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          void caches.open(SHELL).then((cache) => cache.put('./index.html', copy));
          return response;
        })
        .catch(() =>
          caches.match('./index.html').then((hit) => hit ?? new Response('Offline', { status: 503 })),
        ),
    );
    return;
  }

  // Everything else — the hashed JS and CSS — is immutable, so cache first.
  event.respondWith(
    caches.match(request).then(
      (hit) =>
        hit ??
        fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            void caches.open(SHELL).then((cache) => cache.put(request, copy));
          }
          return response;
        }),
    ),
  );
});
