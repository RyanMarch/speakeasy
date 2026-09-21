/**
 * Speakeasy Service Worker
 * Vanilla network-first-with-cache-fallback strategy: fresh whenever online,
 * offline-capable when not. No build step, no Workbox — just the Cache
 * Storage and Fetch APIs.
 */

const CACHE_NAME = 'speakeasy-v10';

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
  'app.html',
  'terms.html',
  'manifest.webmanifest',
  'wrangler.toml',
  'app.js',
  'css/base.css',
  'css/theme-deco.css',
  'css/index.css',
  'css/marketing.css',
  // The modular stylesheets index.css pulls in via @import — the browser
  // fetches those separately, so without their own precache entries a cold
  // offline-first open (no prior online visit) would render app.html unstyled.
  'css/shared-animations.css',
  'css/layout.css',
  'css/recipe-list.css',
  'css/counter-view.css',
  'css/home-view.css',
  'css/menu-builder-view.css',
  'css/guest-menu-view.css',
  'css/guest-recipe-view.css',
  'css/editor.css',
  'css/modals.css',
  'css/responsive.css',
  'css/print.css',
  'js/router.js',
  'js/state.js',
  'js/components/auth-modal.js',
  'js/components/backbar-modal.js',
  'js/components/bar-basics-sheet.js',
  'js/components/calculator-modal.js',
  'js/components/editor-modal.js',
  'js/components/hidden-modal.js',
  'js/components/print-window.js',
  'js/components/rating-modal.js',
  'js/components/timer-modal.js',
  'js/components/site-footer.js',
  'js/components/dialog-motion.js',
  'js/components/toast.js',
  'js/components/top-bar.js',
  'js/data/bar-basics.js',
  'js/data/featured-cocktails.js',
  'js/data/seed-recipes.js',
  'js/modules/abv.js',
  'js/modules/auth.js',
  'js/modules/auto-detect.js',
  'js/modules/bar-basics-format.js',
  'js/modules/balance.js',
  'js/modules/calculators.js',
  'js/modules/cloud-sync.js',
  'js/modules/colors.js',
  'js/modules/garnishes.js',
  'js/modules/glass-view.js',
  'js/modules/glassware.js',
  'js/modules/history.js',
  'js/modules/parser.js',
  'js/modules/share-card.js',
  'js/modules/menu-publish.js',
  'js/modules/moods.js',
  'js/modules/quiz.js',
  'js/modules/guest-search.js',
  'js/modules/menu-sections.js',
  'js/modules/guest-saved.js',
  'js/modules/guest-order.js',
  'js/modules/dietary.js',
  'js/components/diet-notes.js',
  'js/modules/shuffle-schedule.js',
  'js/modules/storage.js',
  'js/modules/taxonomy.js',
  'js/modules/telemetry.js',
  'js/modules/view-transition.js',
  'js/modules/mobile-search-focus.js',
  'js/views/counter-view.js',
  'js/views/home-view.js',
  'js/views/menu-builder-view.js',
  'js/views/recipe-list-view.js',
  'js/views/shared-recipe-view.js',
  'js/views/guest-menu-view.js',
  'js/views/surprise-overlay.js',
  'js/views/guest-recipe-view.js',
  'js/views/guest-diet-sheet.js',
  'js/views/add-to-menu.js',
  'js/views/order-card.js',
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

  event.respondWith(
    // cache: 'no-store' forces this past the browser's own HTTP cache — this
    // handler's whole point is "genuinely fresh whenever online," but the
    // default fetch() cache mode would otherwise let a heuristically-cached
    // response (an update-in-place asset like this app's own CSS/JS, with no
    // `?v=` on its @import/import specifiers) satisfy the request without
    // ever reaching the network. Cache Storage below still carries the
    // offline fallback, so this doesn't cost the offline story anything.
    fetch(request, { cache: 'no-store' })
      .then((response) => {
        if (response && response.ok) {
          caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()));
        }
        return response;
      })
      .catch(async () => {
        const cache = await caches.open(CACHE_NAME);
        // ignoreSearch: the page requests `?v=N` cache-busted URLs, but the
        // precache above stores bare paths — without this a cold offline open
        // (no prior online visit) misses every precached asset.
        const cached = await cache.match(request) || await cache.match(request, { ignoreSearch: true });
        if (cached) return cached;
        if (request.mode === 'navigate') {
          if (url.pathname.startsWith('/app')) {
            const appShell = await cache.match('app.html');
            if (appShell) return appShell;
          }
          if (url.pathname.startsWith('/terms')) {
            const termsPage = await cache.match('terms.html');
            if (termsPage) return termsPage;
          }
          const shell = await cache.match('index.html');
          if (shell) return shell;
        }
        return new Response('Offline and not cached.', { status: 503, statusText: 'Offline' });
      })
  );
});
