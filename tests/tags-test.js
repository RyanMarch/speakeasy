/**
 * Tag vocabulary hygiene and auto-tag quality.
 *
 * Two jobs:
 *  1. Keep the tag vocabulary consistent (one spelling per idea, no drift
 *     back to near-duplicates).
 *  2. Keep the auto-tagger honest. Its rules were tuned against the curated
 *     tags on the bundled library; the floors and ceilings below flag a rule
 *     change that makes it noisy or blind, without pinning exact output.
 */

import assert from 'node:assert/strict';

class MockLocalStorage {
  constructor() { this.store = new Map(); }
  getItem(key) { return this.store.has(key) ? this.store.get(key) : null; }
  setItem(key, value) { this.store.set(key, String(value)); }
  removeItem(key) { this.store.delete(key); }
  clear() { this.store.clear(); }
}
Object.defineProperty(globalThis, 'localStorage', { value: new MockLocalStorage(), configurable: true, writable: true });

const { SEED_RECIPES } = await import('../js/data/seed-recipes.js');
const { normalizeTagName, getPinnedTags, savePinnedTags } = await import('../js/modules/storage.js');
const { detectTagsFromRecipe } = await import('../js/modules/auto-detect.js');

console.log('--- Testing tag vocabulary ---');

// Test 1: the bundled library uses only canonical, well-formed tags
{
  const used = new Map();
  for (const recipe of SEED_RECIPES) {
    for (const tag of recipe.tags) used.set(tag, (used.get(tag) || 0) + 1);
  }
  for (const tag of used.keys()) {
    assert.equal(normalizeTagName(tag), tag, `Seed tag "${tag}" isn't canonical (it renames to "${normalizeTagName(tag)}")`);
    assert.match(tag, /^[a-z0-9]+(-[a-z0-9]+)*$/, `Seed tag "${tag}" isn't lowercase kebab-case`);
    assert.ok(!used.has(`${tag}s`), `Tags "${tag}" and "${tag}s" are the same idea; pick one`);
  }
  // A tag on one recipe is a filter nobody can use, unless it's a member of a
  // family that's otherwise coherent (seasons; spirit tags the auto-tagger emits).
  const ALLOWED_SINGLETONS = new Set(['brandy-forward', 'wine-forward', 'spring', 'winter']);
  const stray = [...used].filter(([tag, n]) => n < 2 && !ALLOWED_SINGLETONS.has(tag)).map(([tag]) => tag);
  assert.deepEqual(stray, [], `Tags used by only one bundled recipe: ${stray.join(', ')}`);
  console.log(`PASS: ${used.size} seed tags, all canonical kebab-case with no plural/singular twins or stray one-offs`);
}

// Test 2: retired spellings fold into their canonical tag; one-off flourishes are dropped
{
  const expectations = {
    'low-proof': 'low-abv', 'Tequila': 'tequila-forward', '#historic': 'classic', 'crowd-pleaser': 'party',
    'celebratory': 'party', 'berry': 'fruity', 'nightcap': 'nightcaps', 'tiki': 'tropical-tiki',
    'visually-stunning': '', 'elegant': '', 'beer': '', 'digestif': '',
  };
  for (const [input, expected] of Object.entries(expectations)) {
    assert.equal(normalizeTagName(input), expected, `normalizeTagName(${JSON.stringify(input)})`);
  }
  console.log('PASS: retired tag spellings fold into their canonical tag');
}

// Test 3: pins on a retired spelling follow the rename instead of becoming an empty shelf
{
  savePinnedTags(['historic', 'classic', 'low-proof', 'nightcaps', 'beer', 'refreshing']);
  assert.deepEqual(getPinnedTags(), ['classic', 'low-abv', 'nightcaps', 'refreshing']);
  console.log('PASS: pinned tags are normalized and deduped when read');
}

console.log('--- Testing auto-tag quality against the curated library ---');

const rows = SEED_RECIPES.map(recipe => ({
  name: recipe.name,
  curated: new Set(recipe.tags),
  auto: new Set(detectTagsFromRecipe(recipe.specs, recipe.method, {
    glassware: recipe.glassware, name: recipe.name, instructions: recipe.instructions,
  })),
}));

function measure(tag) {
  const tp = rows.filter(r => r.curated.has(tag) && r.auto.has(tag)).length;
  const fired = rows.filter(r => r.auto.has(tag)).length;
  const curated = rows.filter(r => r.curated.has(tag)).length;
  return { fired, precision: fired ? tp / fired : 0, recall: curated ? tp / curated : 0 };
}

// Test 4: tags with a solid signal keep a measured floor (percent)
{
  const FLOORS = {
    'whiskey-forward': [85, 85], 'gin-forward': [85, 85], 'rum-forward': [85, 65],
    'coffee': [90, 90], 'smoky': [90, 85], 'creamy': [65, 90], 'sparkling': [40, 90],
    'tropical-tiki': [70, 70], 'bittersweet': [60, 60], 'highball': [55, 90],
    'refreshing': [50, 65], 'silky': [60, 70], 'spiced': [55, 90], 'hot': [90, 90],
  };
  for (const [tag, [minPrecision, minRecall]] of Object.entries(FLOORS)) {
    const m = measure(tag);
    assert.ok(m.precision * 100 >= minPrecision, `"${tag}" precision ${Math.round(m.precision * 100)}% fell below ${minPrecision}%`);
    assert.ok(m.recall * 100 >= minRecall, `"${tag}" recall ${Math.round(m.recall * 100)}% fell below ${minRecall}%`);
  }
  console.log('PASS: auto-tags keep their precision and recall floors');
}

// Test 5: noisy tags stay quiet. These once fired on far more drinks than the
// curated library uses them for, which buries the tags that matter.
{
  const total = rows.length;
  for (const tag of ['sweet', 'bitter']) {
    assert.equal(rows.filter(r => r.auto.has(tag)).length, 0, `"${tag}" was retired from auto-tagging`);
  }
  assert.ok(measure('citrus-forward').fired <= 25, 'citrus-forward should mean citrus leads the drink, not "has lime juice"');
  assert.ok(measure('split-base').fired <= 15, 'split-base should count base spirits only (a Negroni is not split-base)');
  const negroni = rows.find(r => r.name === 'Negroni');
  assert.ok(!negroni.auto.has('split-base'), 'Negroni is not a split-base drink');
  for (const tag of new Set(rows.flatMap(r => [...r.auto]))) {
    assert.ok(measure(tag).fired <= total * 0.5, `"${tag}" is auto-applied to over half the library; too common to help anyone choose`);
  }
  console.log('PASS: noisy tags stay retired or restrained, and no auto-tag fires on most drinks');
}

// Test 6: never more than the cap, never duplicates, never tags on an empty recipe
{
  for (const r of rows) assert.ok(r.auto.size <= 6, `${r.name} got ${r.auto.size} auto tags; the cap is 6`);
  assert.deepEqual(detectTagsFromRecipe([], 'Shaken', {}), []);
  console.log('PASS: auto-tags are capped at 6 and empty recipes get none');
}

// Test 7: the headline gaps are closed for a brand-new custom recipe
{
  const daiquiriLike = detectTagsFromRecipe([
    { amount: 2, unit: 'oz', name: 'White Rum' }, { amount: 1, unit: 'oz', name: 'Lime Juice' }, { amount: 0.75, unit: 'oz', name: 'Simple Syrup' },
  ], 'Shaken', { glassware: 'Coupe' });
  assert.ok(daiquiriLike.includes('rum-forward') && daiquiriLike.includes('sour'), `Expected rum-forward + sour, got ${daiquiriLike}`);

  const painkiller = detectTagsFromRecipe([
    { amount: 2, unit: 'oz', name: 'Dark Rum' }, { amount: 4, unit: 'oz', name: 'Pineapple Juice' }, { amount: 1, unit: 'oz', name: 'Cream of Coconut' },
  ], 'Shaken', { glassware: 'Tiki Mug' });
  assert.ok(painkiller.includes('tropical-tiki'), `Expected tropical-tiki, got ${painkiller}`);

  const gAndT = detectTagsFromRecipe([
    { amount: 2, unit: 'oz', name: 'London Dry Gin' }, { amount: 4, unit: 'oz', name: 'Tonic Water' },
  ], 'Built', { glassware: 'Highball' });
  assert.ok(gAndT.includes('highball') && gAndT.includes('refreshing'), `Expected highball + refreshing, got ${gAndT}`);
  console.log('PASS: new custom recipes get tropical-tiki, highball, and refreshing');
}

console.log('All tag tests passed.');
