import assert from 'node:assert/strict';
import { onRequestGet as getSharePage } from '../functions/share/[id].js';
import { onRequestGet as getOgImage } from '../functions/share/[id]/og.png.js';

console.log('--- Testing /share/:id and /share/:id/og.png Endpoints ---');

// In-memory mock D1, scoped to just the `shares` table.
class MockD1 {
  constructor() {
    this.shares = new Map();
  }
  prepare(sql) {
    return new MockD1PreparedStatement(this, sql);
  }
}

class MockD1PreparedStatement {
  constructor(db, sql) {
    this.db = db;
    this.sql = sql.trim();
    this.boundParams = [];
  }
  bind(...params) {
    this.boundParams = params;
    return this;
  }
  async first() {
    const [shareId] = this.boundParams;
    const row = this.db.shares.get(shareId);
    if (!row) return null;
    if (this.sql.startsWith('SELECT recipe FROM shares')) return { recipe: row.recipe };
    if (this.sql.startsWith('SELECT og_image FROM shares')) return { og_image: row.og_image };
    throw new Error(`Unhandled SQL in mock: ${this.sql}`);
  }
}

const db = new MockD1();
db.shares.set('TestShareABC', {
  recipe: JSON.stringify({ name: 'Test Riff', glassware: 'Coupe', method: 'Stirred', riffOfName: 'Martini' }),
  og_image: new Uint8Array([1, 2, 3, 4]),
});
db.shares.set('NoPicShareXY', {
  recipe: JSON.stringify({ name: 'No Preview Drink' }),
  og_image: null,
});

const fallbackBytes = new Uint8Array([9, 9, 9]);
const mockAssets = {
  fetch: async () => new Response(fallbackBytes, { headers: { 'Content-Type': 'image/png' } }),
};

function makeRequest(path) {
  return new Request(`https://example.com${path}`);
}

// Test 1: HTML shell carries per-recipe OG tags and a redirect
{
  const res = await getSharePage({
    params: { id: 'TestShareABC' },
    env: { speakeasy_db: db },
    request: makeRequest('/share/TestShareABC'),
  });
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /<title>Test Riff — Speakeasy<\/title>/);
  assert.match(html, /og:image" content="https:\/\/example\.com\/share\/TestShareABC\/og\.png"/);
  assert.match(html, /A riff on Martini/);
  assert.match(html, /location\.replace\("https:\/\/example\.com\/app#share\/TestShareABC"\)/);
  console.log('PASS: GET /share/:id renders per-recipe OG tags and a redirect to the SPA route');
}

// Test 2: unknown id renders the generic 404 shell without crashing
{
  const res = await getSharePage({
    params: { id: 'doesNotExist1' },
    env: { speakeasy_db: db },
    request: makeRequest('/share/doesNotExist1'),
  });
  assert.equal(res.status, 404);
  console.log('PASS: GET /share/:id returns 404 for an unknown id');
}

// Test 3: og.png serves the stored bytes directly, with a long cache lifetime
{
  const res = await getOgImage({
    params: { id: 'TestShareABC' },
    env: { speakeasy_db: db, ASSETS: mockAssets },
    request: makeRequest('/share/TestShareABC/og.png'),
  });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('Content-Type'), 'image/png');
  assert.match(res.headers.get('Cache-Control'), /immutable/);
  const bytes = new Uint8Array(await res.arrayBuffer());
  assert.deepEqual(Array.from(bytes), [1, 2, 3, 4]);
  console.log('PASS: GET /share/:id/og.png serves the stored client-rendered image bytes');
}

// Test 4: a share with no stored image falls back to the static asset
{
  const res = await getOgImage({
    params: { id: 'NoPicShareXY' },
    env: { speakeasy_db: db, ASSETS: mockAssets },
    request: makeRequest('/share/NoPicShareXY/og.png'),
  });
  const bytes = new Uint8Array(await res.arrayBuffer());
  assert.deepEqual(Array.from(bytes), Array.from(fallbackBytes));
  console.log('PASS: GET /share/:id/og.png falls back to the static asset when no image is stored');
}

// Test 5: an unknown id also falls back to the static asset rather than erroring
{
  const res = await getOgImage({
    params: { id: 'doesNotExist1' },
    env: { speakeasy_db: db, ASSETS: mockAssets },
    request: makeRequest('/share/doesNotExist1/og.png'),
  });
  const bytes = new Uint8Array(await res.arrayBuffer());
  assert.deepEqual(Array.from(bytes), Array.from(fallbackBytes));
  console.log('PASS: GET /share/:id/og.png falls back to the static asset for an unknown id');
}

console.log('All /share/:id and /share/:id/og.png tests passed successfully!');
