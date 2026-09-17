import assert from 'node:assert/strict';
import { onRequestGet as getDrinkPage } from '../functions/drink/[id].js';
import { onRequestGet as getDrinkOgImage } from '../functions/drink/[id]/og.png.js';
import { SEED_RECIPES } from '../js/data/seed-recipes.js';

console.log('--- Testing /drink/:id and /drink/:id/og.png Endpoints ---');

// In-memory mock D1, scoped to just the `seed_drink_images` table.
class MockD1 {
  constructor() {
    this.seedDrinkImages = new Map();
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
    const [recipeId] = this.boundParams;
    if (this.sql.startsWith('SELECT og_image FROM seed_drink_images')) {
      const row = this.db.seedDrinkImages.get(recipeId);
      return row ? { og_image: row.og_image } : null;
    }
    throw new Error(`Unhandled SQL in mock: ${this.sql}`);
  }
}

const fallbackBytes = new Uint8Array([9, 9, 9]);
const mockAssets = {
  fetch: async () => new Response(fallbackBytes, { headers: { 'Content-Type': 'image/png' } }),
};

function makeRequest(path) {
  return new Request(`https://example.com${path}`);
}

const knownRecipe = SEED_RECIPES[0];
const secondRecipe = SEED_RECIPES[1];

const db = new MockD1();
db.seedDrinkImages.set(knownRecipe.id, { og_image: new Uint8Array([1, 2, 3, 4]) });

// Test 1: a known seed recipe id renders OG tags and a redirect, with no D1 involved
{
  const res = await getDrinkPage({
    params: { id: knownRecipe.id },
    request: makeRequest(`/drink/${knownRecipe.id}`),
  });
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, new RegExp(`<title>${knownRecipe.name} — Speakeasy</title>`));
  assert.match(html, new RegExp(`og:image" content="https://example\\.com/drink/${knownRecipe.id}/og\\.png"`));
  assert.match(html, new RegExp(`location\\.replace\\("https://example\\.com/app#${knownRecipe.id}"\\)`));
  console.log('PASS: GET /drink/:id renders per-recipe OG tags and a redirect, sourced from bundled seed data');
}

// Test 2: an unknown id returns 404 without crashing
{
  const res = await getDrinkPage({
    params: { id: 'not-a-real-seed-recipe' },
    request: makeRequest('/drink/not-a-real-seed-recipe'),
  });
  assert.equal(res.status, 404);
  console.log('PASS: GET /drink/:id returns 404 for an unknown id');
}

// Test 3: og.png serves the pre-rendered per-recipe image when one is stored
{
  const res = await getDrinkOgImage({
    params: { id: knownRecipe.id },
    env: { speakeasy_db: db, ASSETS: mockAssets },
    request: makeRequest(`/drink/${knownRecipe.id}/og.png`),
  });
  const bytes = new Uint8Array(await res.arrayBuffer());
  assert.deepEqual(Array.from(bytes), [1, 2, 3, 4]);
  console.log('PASS: GET /drink/:id/og.png serves the stored per-recipe image, glassware and all');
}

// Test 4: og.png falls back to the static card for a recipe with no stored image
{
  const res = await getDrinkOgImage({
    params: { id: secondRecipe.id },
    env: { speakeasy_db: db, ASSETS: mockAssets },
    request: makeRequest(`/drink/${secondRecipe.id}/og.png`),
  });
  const bytes = new Uint8Array(await res.arrayBuffer());
  assert.deepEqual(Array.from(bytes), Array.from(fallbackBytes));
  console.log('PASS: GET /drink/:id/og.png falls back to the static card when no image is stored');
}

console.log('All /drink/:id and /drink/:id/og.png tests passed successfully!');
