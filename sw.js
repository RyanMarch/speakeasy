/**
 * Speakeasy Service Worker
 * Vanilla cache-first-with-network-update strategy for true offline support.
 * No build step, no Workbox — just the Cache Storage and Fetch APIs.
 */

const CACHE_NAME = 'speakeasy-v2';

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

  // Page navigations are network-first: a cold launch should show what's
  // actually deployed, not whatever HTML happened to be cached from before.
  // Cache-first-with-background-update (below) means a PWA can otherwise sit
  // one full launch behind every deploy — the stale cached index.html keeps
  // requesting its own stale-versioned ?v= asset URLs, which are themselves
  // still cached, so the update never surfaces until a *second* cold launch.
  // Falling back to the cache only when the network is unreachable still
  // gives true offline support; it just stops preferring stale over fresh.
  if (request.mode === 'navigate') {
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
          const shell = (await cache.match(request)) || (await cache.match('index.html'));
          return shell || new Response('Offline and not cached.', { status: 503, statusText: 'Offline' });
        })
    );
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(request);

      // Always kick off a network fetch to refresh the cache for next time —
      // cache-first means "serve the cached copy immediately if we have one,"
      // not "never check for an update."
      const networkFetch = fetch(request)
        .then((response) => {
          if (response && response.ok) {
            cache.put(request, response.clone());
          }
          return response;
        })
        .catch(() => null);

      if (cached) {
        // Don't await it — this is a background update, the response the user
        // gets right now is the cached one.
        return cached;
      }

      const fresh = await networkFetch;
      if (fresh) return fresh;

      // Offline and this exact URL was never cached. Not a navigation (those
      // are handled above), so there's nothing sensible left to fall back to.
      return new Response('Offline and not cached.', { status: 503, statusText: 'Offline' });
    })
  );
});
