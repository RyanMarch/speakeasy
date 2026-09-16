import assert from 'node:assert/strict';
import { onRequestGet as getDrinkPage } from '../functions/drink/[id].js';
import { onRequestGet as getDrinkOgImage } from '../functions/drink/[id]/og.png.js';
import { SEED_RECIPES } from '../js/data/seed-recipes.js';

console.log('--- Testing /drink/:id and /drink/:id/og.png Endpoints ---');

const fallbackBytes = new Uint8Array([9, 9, 9]);
const mockAssets = {
  fetch: async () => new Response(fallbackBytes, { headers: { 'Content-Type': 'image/png' } }),
};

function makeRequest(path) {
  return new Request(`https://example.com${path}`);
}

const knownRecipe = SEED_RECIPES[0];

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

// Test 3: og.png always serves the static fallback (no per-seed-drink art yet)
{
  const res = await getDrinkOgImage({
    env: { ASSETS: mockAssets },
    request: makeRequest(`/drink/${knownRecipe.id}/og.png`),
  });
  const bytes = new Uint8Array(await res.arrayBuffer());
  assert.deepEqual(Array.from(bytes), Array.from(fallbackBytes));
  console.log('PASS: GET /drink/:id/og.png serves the static fallback card');
}

console.log('All /drink/:id and /drink/:id/og.png tests passed successfully!');
