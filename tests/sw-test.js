/**
 * Service Worker Test Suite
 * Runs sw.js in a sandbox with a fake Cache Storage and verifies that (a) the
 * precache list covers the app's whole static module/CSS graph and (b) a cold
 * offline open can still serve the `?v=N` cache-busted URLs the page requests.
 */

import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let failed = false;

function assert(condition, message) {
  if (!condition) { console.error(`FAIL: ${message}`); failed = true; process.exitCode = 1; }
  else console.log(`PASS: ${message}`);
}

const ORIGIN = 'https://speakeasy.test';
const normalize = (u) => new URL(u, `${ORIGIN}/`).href;

class FakeResponse {
  constructor(body, init = {}) { this.body = body; this.status = init.status ?? 200; this.ok = this.status < 400; }
  clone() { return new FakeResponse(this.body, { status: this.status }); }
}

function makeCache() {
  const store = new Map();
  return {
    async add(url) { const r = await sandbox.fetch(url); if (!r.ok) throw new Error(`HTTP ${r.status}`); store.set(normalize(url), r.clone()); },
    async put(req, res) { store.set(normalize(req.url ?? req), res); },
    async match(req, opts = {}) {
      const href = normalize(req.url ?? req);
      if (store.has(href)) return store.get(href);
      if (opts.ignoreSearch) {
        const bare = href.split('?')[0];
        for (const [k, v] of store) if (k.split('?')[0] === bare) return v;
      }
      return undefined;
    },
    store,
  };
}

const cacheStores = new Map();
let online = true;
const listeners = {};
const sandbox = {
  URL, Response: FakeResponse, Promise, console: { ...console, warn() {} },
  caches: {
    async open(name) { if (!cacheStores.has(name)) cacheStores.set(name, makeCache()); return cacheStores.get(name); },
    async keys() { return [...cacheStores.keys()]; },
    async delete(name) { return cacheStores.delete(name); },
  },
  // Every file on disk "exists" on the server; anything else 404s. Offline throws like a real failed fetch.
  async fetch(input) {
    if (!online) throw new TypeError('Failed to fetch');
    const url = new URL(typeof input === 'string' ? input : input.url, `${ORIGIN}/`);
    const file = path.join(rootDir, url.pathname === '/' ? 'index.html' : url.pathname);
    return fs.existsSync(file) && fs.statSync(file).isFile() ? new FakeResponse(`file:${url.pathname}`) : new FakeResponse('nope', { status: 404 });
  },
};
sandbox.self = {
  location: { origin: ORIGIN },
  addEventListener: (type, fn) => { listeners[type] = fn; },
  skipWaiting() {}, clients: { claim: async () => {} },
};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(rootDir, 'sw.js'), 'utf8'), sandbox);

async function fire(type, extra = {}) {
  let pending;
  await listeners[type]({ waitUntil: (p) => { pending = p; }, respondWith: (p) => { pending = p; }, ...extra });
  return pending;
}

function staticGraph() {
  const files = new Set();
  const walk = (f) => {
    if (files.has(f)) return; files.add(f);
    const src = fs.readFileSync(path.join(rootDir, f), 'utf8');
    const re = f.endsWith('.css') ? /@import\s+url\(['"]\.\/([^'"?]+)/g : /(?:from|import)\s*\(?\s*['"](\.[^'"?]+)/g;
    for (const m of src.matchAll(re)) walk(path.posix.normalize(path.posix.join(path.posix.dirname(f), m[1])));
  };
  walk('app.js');
  walk('css/index.css');
  return [...files];
}

// 1. Precache covers the app's static graph
const precached = new Set();
await fire('install');
const cacheName = [...cacheStores.keys()][0];
for (const k of cacheStores.get(cacheName).store.keys()) precached.add(new URL(k).pathname.slice(1));
const missing = staticGraph().filter((f) => !precached.has(f));
assert(missing.length === 0, `precache covers every module/CSS file reachable from app.js and index.css${missing.length ? ` (missing: ${missing.join(', ')})` : ''}`);

// 2. Cold offline open serves versioned URLs from the bare-path precache
online = false;
const offline = (p, mode = 'cors') => fire('fetch', { request: { method: 'GET', url: `${ORIGIN}${p}`, mode } });
assert((await offline('/js/state.js?v=4')).ok, 'cold offline: /js/state.js?v=4 is served from the bare precache entry');
assert((await offline('/css/index.css?v=57')).ok, 'cold offline: /css/index.css?v=57 is served');
assert((await offline('/app', 'navigate')).body === 'file:/app.html', 'cold offline: /app navigation falls back to the app shell');
assert((await offline('/js/never-cached.js')).status === 503, 'uncached asset offline returns 503');

// 3. Non-cacheable requests pass through
let handled = false;
await listeners.fetch({ request: { method: 'POST', url: `${ORIGIN}/api/x` }, respondWith: () => { handled = true; } });
assert(!handled, 'POST requests bypass the service worker');
await listeners.fetch({ request: { method: 'GET', url: `${ORIGIN}/api/x` }, respondWith: () => { handled = true; } });
assert(!handled, '/api/* requests bypass the service worker');

if (!failed) console.log('All service worker tests passed successfully!');
