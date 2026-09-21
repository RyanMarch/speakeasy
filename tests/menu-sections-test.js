import assert from 'node:assert/strict';
import { SEED_RECIPES } from '../js/data/seed-recipes.js';
import { groupBySpirit, sectionKeyFor, shouldUseSections, MIN_DRINKS_FOR_SECTIONS, OTHER_SECTION } from '../js/modules/menu-sections.js';

console.log('--- Testing menu sections ---');

const sections = groupBySpirit(SEED_RECIPES);

// Test 1: every drink appears exactly once, in original relative order within its section
{
  const ids = sections.flatMap(s => s.recipes.map(r => r.id));
  assert.equal(ids.length, SEED_RECIPES.length, 'No drink may be dropped or duplicated');
  assert.equal(new Set(ids).size, SEED_RECIPES.length, 'No drink may appear in two sections');
  for (const section of sections) {
    const positions = section.recipes.map(r => SEED_RECIPES.indexOf(r));
    assert.deepEqual(positions, [...positions].sort((a, b) => a - b), `"${section.heading}" should keep the menu's order`);
  }
  console.log(`PASS: all ${ids.length} drinks land in exactly one section, order preserved`);
}

// Test 2: fixed, predictable section order with the catch-all last
{
  const order = sections.map(s => s.key);
  const expected = ['whiskey', 'gin', 'rum', 'agave', 'vodka', 'brandy', 'other'];
  assert.deepEqual(order, expected.filter(k => order.includes(k)), 'Sections should follow the fixed order');
  assert.equal(order[order.length - 1], OTHER_SECTION.key, '"Liqueurs & more" goes last');
  assert.ok(sections.every(s => s.recipes.length > 0), 'Empty sections are left out');
  console.log('PASS: sections appear in a fixed order with the catch-all last, none empty');
}

// Test 3: a drink goes where its first (dominant) spirit tag says
{
  const drink = (id, tags) => ({ id, tags });
  assert.equal(sectionKeyFor(drink('a', ['classic', 'rum-forward', 'whiskey-forward'])), 'rum', 'First spirit tag wins');
  assert.equal(sectionKeyFor(drink('b', ['classic', 'whiskey-forward', 'rum-forward'])), 'whiskey');
  assert.equal(sectionKeyFor(drink('c', ['cachaca-forward'])), 'rum', 'Cachaça is with rum');
  assert.equal(sectionKeyFor(drink('d', ['mezcal-forward'])), 'agave');
  assert.equal(sectionKeyFor(drink('e', ['cognac-forward'])), 'brandy');
  assert.equal(sectionKeyFor(drink('f', ['classic', 'bittersweet'])), 'other', 'No spirit tag: Liqueurs & more');
  assert.equal(sectionKeyFor({ id: 'g' }), 'other', 'A recipe with no tags at all still has a home');
  console.log('PASS: spirit tags decide the section, dominant (first) spirit wins');
}

// Test 4: headings only when a menu is long enough to need them
{
  assert.equal(shouldUseSections(SEED_RECIPES), true, 'The full library is long enough');
  const short = SEED_RECIPES.slice(0, MIN_DRINKS_FOR_SECTIONS - 1);
  assert.equal(shouldUseSections(short), false, `Under ${MIN_DRINKS_FOR_SECTIONS} drinks isn't worth headings`);
  const oneSpirit = SEED_RECIPES.filter(r => sectionKeyFor(r) === 'whiskey').slice(0, 30);
  assert.equal(shouldUseSections(oneSpirit), false, 'A menu that is all one section needs no headings');
  assert.equal(shouldUseSections([]), false);
  console.log('PASS: headings only appear on long menus spread over several sections');
}

// Test 5: the sizes are sane on the real library (guards against a tag change emptying a section)
{
  const size = Object.fromEntries(sections.map(s => [s.key, s.recipes.length]));
  assert.ok(size.whiskey >= 30 && size.gin >= 30 && size.rum >= 30, `Big three should be big: ${JSON.stringify(size)}`);
  assert.ok(size.other >= 10 && size.other <= SEED_RECIPES.length * 0.3, `"Liqueurs & more" should be a minority: ${size.other}`);
  console.log(`PASS: section sizes look sane ${JSON.stringify(size)}`);
}

console.log('All menu section tests passed.');
