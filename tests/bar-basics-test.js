/**
 * Bar Basics Test Suite
 * Validates the how-to-make dataset (js/data/bar-basics.js): every entry is
 * well-formed and keyed to a real taxonomy ingredient, measurements exist for
 * both unit systems without one leaking into the other, and the seed recipes'
 * ingredient rows actually resolve to entries (so the "How to make" link shows).
 */

import { BAR_BASICS, BAR_BASICS_GROUPS, getBarBasic, pickUnit } from '../public/js/data/bar-basics.js';
import { formatAmount, formatYield, scaledBrixInputs, BATCH_SCALES } from '../public/js/modules/bar-basics-format.js';
import { TAXONOMY, getIngredientMetadata } from '../public/js/modules/taxonomy.js';
import { SEED_RECIPES } from '../public/js/data/seed-recipes.js';

let failed = false;
function assert(condition, message) {
  if (!condition) { console.error(`FAIL: ${message}`); failed = true; process.exitCode = 1; }
  else console.log(`PASS: ${message}`);
}

const US_UNIT = /\b(cups?|tablespoons?|teaspoons?|tbsp|tsp|oz|ounces?|inch(es)?)\b/i;
const METRIC_UNIT = /\d\s?(g|kg|ml|l|cm)\b/i;

/** Every user-visible string in an entry that can carry a measurement, for one unit system. */
function measuredText(entry, unit, scale = 1) {
  return [
    formatYield(entry.yield, unit, scale),
    ...entry.ingredients.map(i => formatAmount(i.amount, unit, scale)),
    ...entry.steps.map(s => pickUnit(s, unit)),
    ...(entry.tips || []).map(t => pickUnit(t, unit)),
  ];
}

console.log('\n--- Testing js/data/bar-basics.js ---');

assert(BAR_BASICS.length >= 10, `has a starter set of entries (found: ${BAR_BASICS.length})`);
assert(new Set(BAR_BASICS.map(e => e.id)).size === BAR_BASICS.length, 'entry ids are unique');

for (const entry of BAR_BASICS) {
  assert(!!TAXONOMY[entry.id], `${entry.id} is a real taxonomy ingredient id`);
  assert(getIngredientMetadata(entry.name)?.id === entry.id, `the name "${entry.name}" resolves back to ${entry.id}`);
  assert(getBarBasic(entry.id) === entry, `getBarBasic('${entry.id}') returns the entry`);

  const complete = entry.name && entry.tagline && entry.ratio && entry.time && entry.keeps
    && Array.isArray(entry.ingredients) && entry.ingredients.length > 0
    && Array.isArray(entry.steps) && entry.steps.length >= 2;
  assert(complete, `${entry.id} has every required field`);

  for (const unit of ['oz', 'ml']) {
    const texts = measuredText(entry, unit);
    assert(texts.every(t => typeof t === 'string' && t.trim().length > 0), `${entry.id} has non-empty ${unit} text for every measurement`);
    assert(entry.ingredients.every(i => i.item && formatAmount(i.amount, unit)), `${entry.id} ingredients have an amount and item in ${unit} mode`);
  }
  // Scaling must not leak the other unit system or produce junk either
  for (const scale of BATCH_SCALES) {
    for (const unit of ['oz', 'ml']) {
      const texts = measuredText(entry, unit, scale);
      assert(texts.every(x => typeof x === 'string' && x.trim() && !/NaN|undefined|Infinity/.test(x)), `${entry.id} formats cleanly at ${scale}x in ${unit} mode`);
    }
    assert(!measuredText(entry, 'ml', scale).some(x => US_UNIT.test(x)), `${entry.id} shows no US units in metric mode at ${scale}x`);
    assert(!measuredText(entry, 'oz', scale).some(x => METRIC_UNIT.test(x)), `${entry.id} shows no metric units in US mode at ${scale}x`);
  }
  assert(!measuredText(entry, 'ml').some(t => US_UNIT.test(t)), `${entry.id} shows no US units in metric mode`);
  assert(!measuredText(entry, 'oz').some(t => METRIC_UNIT.test(t)), `${entry.id} shows no metric units in US mode`);
}

const groupIds = BAR_BASICS_GROUPS.map(g => g.id);
assert(BAR_BASICS.every(e => groupIds.includes(e.group)), 'every entry belongs to a defined group');
assert(BAR_BASICS_GROUPS.every(g => BAR_BASICS.some(e => e.group === g.id)), 'every group has at least one entry');
const groupOrder = BAR_BASICS.map(e => groupIds.indexOf(e.group));
assert(groupOrder.every((g, i) => i === 0 || g >= groupOrder[i - 1]), 'entries are kept together in group order');

assert(pickUnit({ us: '1 cup', metric: '240 ml' }, 'oz') === '1 cup', "pickUnit picks the US form for 'oz'");
assert(pickUnit({ us: '1 cup', metric: '240 ml' }, 'ml') === '240 ml', "pickUnit picks the metric form for 'ml'");
assert(pickUnit('3 sticks', 'ml') === '3 sticks', 'pickUnit passes plain strings through');

console.log('\n--- Amount formatting and scaling ---');
const simple = getBarBasic('simple_syrup');
const orgeat = getBarBasic('orgeat');
const amounts = (entry, unit, scale) => entry.ingredients.map(i => formatAmount(i.amount, unit, scale));
assert(amounts(simple, 'oz', 1).join('|') === '1 cup|1 cup', 'simple syrup at 1x (US): 1 cup, 1 cup');
assert(amounts(simple, 'ml', 1).join('|') === '200 g|240 ml', 'simple syrup at 1x (metric): 200 g, 240 ml');
assert(amounts(simple, 'oz', 2).join('|') === '2 cups|2 cups', 'simple syrup doubles to 2 cups');
assert(amounts(simple, 'oz', 0.5).join('|') === '½ cup|½ cup', 'simple syrup halves to ½ cup');
assert(amounts(simple, 'ml', 4).join('|') === '800 g|960 ml', 'simple syrup at 4x (metric): 800 g, 960 ml');
assert(amounts(orgeat, 'oz', 0.5)[1] === '¾ cup', 'orgeat sugar 1½ cups halves to ¾ cup');
assert(amounts(orgeat, 'oz', 0.5)[2] === '¼ teaspoon', 'orgeat extract ½ tsp halves to ¼ teaspoon');
assert(amounts(orgeat, 'oz', 2)[5] === '¼ cup', 'orgeat cognac 2 tbsp doubles to ¼ cup (rolls up)');
assert(amounts(orgeat, 'ml', 0.5)[2] === '1.5 ml', 'orgeat extract 2.5 ml halves to 1.5 ml (rounded to 0.5)');
assert(formatYield(simple.yield, 'oz', 1) === 'about 12 oz' && formatYield(simple.yield, 'ml', 1) === 'about 350 ml', 'yield reads "about ..."');
assert(formatYield(simple.yield, 'ml', 4) === 'about 1.4 L', 'a large metric yield rolls up to litres');
assert(formatAmount('2 to 3 drops', 'oz', 4) === '2 to 3 drops', 'fixed-text amounts never scale');
assert(formatAmount(getBarBasic('cinnamon_syrup').ingredients[2].amount, 'ml', 2) === '6 sticks (8 cm)', 'counts scale and keep their size note');
assert(formatAmount(getBarBasic('vanilla_syrup').ingredients[2].amount, 'oz', 1) === '1 bean', 'a single bean stays singular');
assert(formatAmount(getBarBasic('vanilla_syrup').ingredients[2].amount, 'oz', 4) === '4 beans', 'and pluralizes when scaled');

console.log('\n--- Brix Blender links ---');
for (const id of ['simple_syrup', 'rich_simple_syrup', 'demerara_syrup']) {
  const inputs = scaledBrixInputs(getBarBasic(id), 1);
  assert(inputs && inputs.sugarG > 0 && inputs.waterMl > 0, `${id} has Brix Blender inputs`);
}
assert(scaledBrixInputs(getBarBasic('simple_syrup'), 2).sugarG === 400, 'Brix inputs scale with the batch');
assert(scaledBrixInputs(getBarBasic('orgeat'), 1) === null, 'entries without sugar/water inputs have no Brix link');

assert(getBarBasic('london_dry_gin') === null, 'getBarBasic returns null for an ingredient with no entry');
assert(getBarBasic(undefined) === null, 'getBarBasic tolerates a missing id');

console.log('\n--- Seed recipes surface the link ---');
const linked = new Set();
for (const recipe of SEED_RECIPES) {
  for (const spec of recipe.specs || []) {
    const id = getIngredientMetadata(spec.name || '')?.id;
    if (getBarBasic(id)) linked.add(id);
  }
}
assert(linked.has('honey_syrup'), 'a seed recipe with Honey Syrup resolves to its entry');
assert(linked.has('simple_syrup'), 'a seed recipe with Simple Syrup resolves to its entry');

const penicillin = SEED_RECIPES.find(r => r.id === 'penicillin');
assert(penicillin.specs.some(s => getIngredientMetadata(s.name)?.id === 'honey_ginger_syrup'), 'Penicillin uses honey-ginger syrup');
assert(!penicillin.specs.some(s => getIngredientMetadata(s.name)?.id === 'honey_syrup'), 'Penicillin no longer calls for plain honey syrup');
assert(/honey-ginger syrup/i.test(penicillin.instructions), 'Penicillin method names the honey-ginger syrup');
console.log(`INFO: ${linked.size} of ${BAR_BASICS.length} entries are used by seed recipes: ${[...linked].join(', ')}`);

if (!failed) console.log('All Bar Basics tests passed successfully!');
