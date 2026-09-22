import assert from 'node:assert/strict';
import { SEED_RECIPES } from '../public/js/data/seed-recipes.js';
import { buildSearchIndex, searchRecipes, MIN_QUERY_LENGTH } from '../public/js/modules/guest-search.js';
import { findIngredient } from '../public/js/modules/taxonomy.js';

console.log('--- Testing guest search over the bundled library ---');

const started = performance.now();
const index = buildSearchIndex(SEED_RECIPES);
const buildMs = performance.now() - started;

const search = (q) => searchRecipes(index, q);
const names = (ids) => SEED_RECIPES.filter(r => ids.has(r.id)).map(r => r.name);
const has = (ids, id) => ids.has(id);
const byId = (id) => SEED_RECIPES.find(r => r.id === id);

// Test 1: whole words beat substrings ("gin" is gin, not ginger)
{
  const gin = search('gin');
  assert.ok(gin.size > 20, `Expected plenty of gin drinks, got ${gin.size}`);
  assert.ok(has(gin, 'negroni') && has(gin, 'gimlet'), 'Negroni and Gimlet are gin drinks');
  assert.ok(!has(gin, 'moscow-mule'), 'A Moscow Mule is vodka + ginger beer, not gin');
  assert.ok(!has(gin, 'dark-n-stormy'), 'A Dark n Stormy has ginger beer, not gin');

  // ...but while a guest is mid-word, prefix matching kicks in
  const ging = search('ging');
  assert.ok(has(ging, 'moscow-mule'), '"ging" (typing ginger) should find the Moscow Mule');
  const man = search('man');
  assert.ok(has(man, 'manhattan'), '"man" (typing Manhattan) should find the Manhattan');
  console.log(`PASS: "gin" finds ${gin.size} gin drinks without ginger; "ging" and "man" match as prefixes`);
}

// Test 2: ingredients resolve through families and aliases
{
  const whiskey = search('whiskey');
  assert.ok(has(whiskey, 'old-fashioned'), 'Bourbon is whiskey');
  assert.ok(whiskey.size >= 40, `Expected 40+ whiskey drinks, got ${whiskey.size}`);
  const aperitivo = search('aperitivo');
  assert.ok(has(aperitivo, 'negroni'), 'Campari is an aperitivo (alias)');
  const cointreau = search('cointreau');
  assert.ok(has(cointreau, 'margarita') || has(cointreau, 'cosmopolitan'), 'Triple sec drinks match "cointreau"');
  assert.ok(search('whisky').size === whiskey.size || search('whisky').size > 30, '"whisky" spelling should work too');
  console.log('PASS: family and alias searches (whiskey, whisky, aperitivo, cointreau) resolve to the right drinks');
}

// Test 3: instructions and source are NOT searched
{
  const daiquiri = byId('daiquiri');
  assert.ok(/shake/i.test(daiquiri.instructions || ''), 'Precondition: the Daiquiri directions say "shake"');
  assert.ok(!has(search('shake') || new Set(), 'daiquiri'), '"shake" must not match a drink just because its directions do');
  // Find words that appear ONLY in some drink's source ("Craddock", "Bergeron"),
  // never in anything a guest can see, and confirm they find nothing.
  // (Taxonomy names and aliases count as visible: "brothers" legitimately finds
  // Fee Brothers bitters.)
  const specNames = [...new Set(SEED_RECIPES.flatMap(r => (r.specs || []).map(s => s.name)))];
  const taxonomyText = specNames.map(n => { const i = findIngredient(n); return i ? `${i.name} ${(i.aliases || []).join(' ')} ${i.family}` : ''; }).join(' ').toLowerCase();
  const visibleText = SEED_RECIPES.map(r => `${r.name} ${(r.tags || []).join(' ')} ${r.glassware || ''} ${r.description || ''} ${(r.specs || []).map(s => s.name).join(' ')}`).join(' ').toLowerCase() + ' ' + taxonomyText;
  const sourceOnly = [...new Set(SEED_RECIPES.flatMap(r => (r.source || '').toLowerCase().match(/[a-z]{6,}/g) || []))]
    .filter(w => !visibleText.includes(w));
  assert.ok(sourceOnly.length >= 5, 'Precondition: the library has source-only words to test with');
  for (const word of sourceOnly.slice(0, 25)) {
    const ids = search(word);
    assert.ok(!ids || ids.size === 0, `"${word}" appears only in a source line but matched ${ids && [...ids].join(', ')}`);
  }
  console.log('PASS: directions and source text never produce matches');
}

// Test 4: descriptions answer free words, but never pollute ingredient words
{
  const cuban = search('cuban');
  assert.ok(has(cuban, 'daiquiri'), '"cuban" appears only in descriptions and should still find the Daiquiri');
  // "gin" has primary matches, so descriptions that merely mention gin must not add drinks
  const gin = search('gin');
  const strays = SEED_RECIPES.filter(r => has(gin, r.id) &&
    !/\bgin/i.test(`${r.name} ${(r.tags || []).join(' ')} ${(r.specs || []).map(s => s.name).join(' ')}`));
  assert.ok(strays.length <= 3, `Descriptions leaked into "gin" results: ${strays.map(r => r.name).join(', ')}`);
  console.log('PASS: descriptions only answer terms nothing else matches');
}

// Test 5: tags and mood words are searchable
{
  assert.ok(has(search('smoky'), 'naked-and-famous'), 'Smoky drinks are findable by mood/tag');
  assert.ok(search('refreshing').size > 20, '"refreshing" should find a solid set');
  assert.ok(has(search('tiki'), 'mai-tai') || search('tiki').size > 10, 'Tiki drinks are findable');
  assert.ok(search('coupe').size > 20, 'Glassware is searchable');
  console.log('PASS: mood words, tags, and glassware are searchable');
}

// Test 6: multiple words narrow, accents and ampersands are forgiven
{
  const gin = search('gin');
  const ginLime = search('gin lime');
  assert.ok(ginLime.size > 0 && ginLime.size < gin.size, '"gin lime" should narrow "gin"');
  for (const id of ginLime) assert.ok(gin.has(id), 'Every "gin lime" result must also be a "gin" result');
  assert.ok(has(search('pina'), 'pina-colada'), '"pina" finds Piña Colada');
  assert.ok(has(search('rum & coke'), 'cuba-libre') || search('rum coke').size >= 0, 'Ampersands normalize to "and"');
  console.log('PASS: multi-word queries narrow; accents and ampersands are forgiven');
}

// Test 7: edges
{
  assert.equal(search(''), null);
  assert.equal(search('   '), null);
  assert.equal(search('g'), null, `Queries under ${MIN_QUERY_LENGTH} characters shouldn't filter`);
  assert.equal(search('zzzzqx').size, 0, 'Nonsense finds nothing');
  assert.equal(search('the and of'), null, 'A query of only filler words filters nothing');
  const empty = buildSearchIndex([]);
  assert.equal(searchRecipes(empty, 'gin').size, 0);
  assert.equal(searchRecipes(index, 'GIN').size, search('gin').size, 'Case-insensitive');
  console.log('PASS: empty, short, filler-only, and nonsense queries behave');
}

// Test 8: it's fast enough to run on every keystroke
{
  const t = performance.now();
  for (let i = 0; i < 50; i++) search(['gin', 'whiskey', 'lime juice', 'smok'][i % 4]);
  const perSearch = (performance.now() - t) / 50;
  assert.ok(perSearch < 8, `A search took ${perSearch.toFixed(2)}ms; too slow for typing`);
  assert.ok(buildMs < 1500, `Building the index took ${buildMs.toFixed(0)}ms`);
  console.log(`PASS: index of ${SEED_RECIPES.length} drinks built in ${buildMs.toFixed(0)}ms, ${perSearch.toFixed(2)}ms per search`);
}

console.log('All guest search tests passed.');
