/**
 * Speakeasy Service Worker
 * Vanilla network-first-with-cache-fallback strategy: fresh whenever online,
 * offline-capable when not. No build step, no Workbox — just the Cache
 * Storage and Fetch APIs.
 */

const CACHE_NAME = 'speakeasy-v3';

// Core shell files precached at install time, so the app has *something* to serve
// on a cold offline open even before the fetch handler below has had a chance to
// warm the cache through normal browsing. Deliberately bare paths — no `?v=`
// cache-busting query strings — because index.html bumps those on every deploy
// and keeping this list in lockstep with that would be one more thing to remember
// to update. The fetch handler transparently caches whatever exact versioned URLs
// the page actually requests as it's visited, so this list only has to get the
// app running once; it doesn't need to track every asset's current version.
const PRECACHE_URLS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'wrangler.toml',
  'app.js',
  'css/base.css',
  'css/index.css',
  'js/modules/taxonomy.js',
  'js/modules/storage.js',
  'js/modules/parser.js',
  'js/modules/glassware.js',
  'js/modules/glass-view.js',
  'js/modules/garnishes.js',
  'js/modules/colors.js',
  'js/modules/abv.js',
  'js/modules/balance.js',
  'assets/icon.svg',
  'assets/icon-192.png',
  'assets/icon-512.png',
  'assets/apple-touch-icon.png',
  'favicon.ico',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => (
      // Cache each URL independently rather than cache.addAll(), which is
      // all-or-nothing — one missing/renamed asset shouldn't sink the entire
      // install and leave the app with zero offline support.
      Promise.all(
        PRECACHE_URLS.map((url) => cache.add(url).catch((err) => {
          console.warn(`[sw] Precache skipped for "${url}":`, err.message);
        }))
      )
    ))
  );
  // Activate this version immediately rather than waiting for all existing tabs
  // to close — the cache-versioning scheme below (activate handler) is what
  // keeps that safe, since it never serves a mix of old and new cache entries.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith('speakeasy-') && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only same-origin GET requests go through this cache. Everything else — form
  // POSTs, cross-origin Google Fonts requests, any future /api/* Cloudflare
  // Pages Function — passes straight through to the network untouched.
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  // Network-first for everything same-origin: whatever's actually being served
  // right now wins whenever the network is reachable, with the cache only used
  // as an offline fallback. This used to be cache-first-with-background-update
  // for CSS/JS (navigations were already network-first, below) — that meant
  // every asset was always one load behind whatever was just deployed (or, in
  // local dev, whatever was just edited): the stale cached copy served
  // immediately every time, with the fetch that would've updated it landing
  // in the background for a load nobody ever saw. Offline support still works
  // exactly the same, since the cache fallback is unchanged; this just stops
  // preferring stale over fresh when a network response is actually available.
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.ok) {
          caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()));
        }
        return response;
      })
      .catch(async () => {
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(request);
        if (cached) return cached;
        if (request.mode === 'navigate') {
          const shell = await cache.match('index.html');
          if (shell) return shell;
        }
        return new Response('Offline and not cached.', { status: 503, statusText: 'Offline' });
      })
  );
});
