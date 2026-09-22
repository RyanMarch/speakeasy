import assert from 'node:assert/strict';
import { SEED_RECIPES } from '../public/js/data/seed-recipes.js';
import { MOODS, getRecipeMoods, summarizeMoods } from '../public/js/modules/moods.js';

console.log('--- Testing mood coverage over the bundled library ---');

const byMood = new Map(MOODS.map(m => [m.key, []]));
const uncovered = [];
for (const recipe of SEED_RECIPES) {
  const moods = getRecipeMoods(recipe);
  if (moods.length === 0) uncovered.push(recipe.name);
  moods.forEach(key => byMood.get(key).push(recipe.name));
}

// Every drink has to be reachable from at least one mood chip, or the chips
// would silently hide part of the library from a guest.
assert.deepEqual(uncovered, [], `Expected every bundled recipe to belong to a mood; missing: ${uncovered.join(', ')}`);

// A chip that matches almost nothing is clutter; one that matches most of the
// library doesn't help anyone choose. These bounds are loose on purpose: they
// flag a rule change that wrecks the balance, not normal library growth.
const total = SEED_RECIPES.length;
for (const mood of MOODS) {
  const count = byMood.get(mood.key).length;
  assert.ok(count >= 15, `Mood "${mood.label}" matches only ${count} recipes; too few to be a useful chip`);
  assert.ok(count <= total * 0.5, `Mood "${mood.label}" matches ${count}/${total} recipes; too broad to narrow anything`);
}

// Custom recipes carry auto-detected tags but not curated ones, so a drink with
// only computed data must still land somewhere sensible.
const customBitter = { name: 'Custom', method: 'Stirred', tags: [], specs: [
  { amount: 1, unit: 'oz', name: 'Campari' }, { amount: 1, unit: 'oz', name: 'Sweet Vermouth' }, { amount: 1, unit: 'oz', name: 'Gin' },
] };
assert.ok(getRecipeMoods(customBitter).includes('bittersweet'), 'Expected a Negroni-style custom recipe to be Bittersweet from its profile alone');
assert.deepEqual(getRecipeMoods({ name: 'Empty', specs: [], tags: [] }), [], 'Expected an empty recipe to match no mood');

// A menu's chips list only moods it actually has, with honest counts.
{
  const menu = SEED_RECIPES.filter(r => ['negroni', 'daiquiri', 'old-fashioned', 'moscow-mule'].includes(r.id));
  const { moods, byRecipe } = summarizeMoods(menu);
  assert.ok(moods.length > 0 && moods.length < MOODS.length, 'Expected a small menu to show only some moods');
  for (const mood of moods) {
    const actual = menu.filter(r => byRecipe.get(r.id).includes(mood.key)).length;
    assert.equal(mood.count, actual, `Count for "${mood.label}" should match its recipes`);
    assert.ok(mood.count >= 1, 'A chip with no drinks must not be offered');
  }
  assert.deepEqual(moods.map(m => m.key), MOODS.map(m => m.key).filter(k => moods.some(m => m.key === k)), 'Expected MOODS order');
  assert.deepEqual(summarizeMoods([]).moods, []);
  console.log('PASS: summarizeMoods offers only moods present on the menu, with accurate counts');
}

console.log(MOODS.map(m => `  ${m.label.padEnd(26)} ${byMood.get(m.key).length}`).join('\n'));
console.log('PASS: every bundled recipe has a mood, and every mood is a usable size');
console.log('PASS: custom recipes get moods from computed data');
