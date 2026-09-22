import assert from 'node:assert/strict';

class MockLocalStorage {
  constructor() { this.store = new Map(); }
  getItem(key) { return this.store.has(key) ? this.store.get(key) : null; }
  setItem(key, value) { this.store.set(key, String(value)); }
  removeItem(key) { this.store.delete(key); }
}
Object.defineProperty(globalThis, 'localStorage', { value: new MockLocalStorage(), configurable: true, writable: true });

const {
  detectDiet, dietFor, hasEggSwap, usesFoamer, applyBarDiet, flagsOnMenu, clashesWith, needsEggSwap, orderedAs,
  loadAvoid, saveAvoid, LIBRARY_AVOID_KEY, sanitizeDietOverride, sanitizeDietOverrides,
} = await import('../js/modules/dietary.js');
const { SEED_RECIPES } = await import('../js/data/seed-recipes.js');
const { getIngredientSubstitutes } = await import('../js/modules/taxonomy.js');
const { dietNotesHtml } = await import('../js/components/diet-notes.js');
const { sanitizeMenuRecipes, sanitizeDiet } = await import('../functions/api/menus/_lib.js');

console.log('--- Testing dietary flags ---');

const drink = (names, extra = {}) => ({ id: 'x', name: 'X', specs: names.map(name => ({ name })), ...extra });

// Plain ingredients.
{
  assert.deepEqual(detectDiet(drink(['Gin', 'Lemon Juice', 'Egg White'])).contains, ['egg']);
  assert.deepEqual(detectDiet(drink(['Bourbon', 'Heavy Cream'])).contains, ['dairy']);
  assert.deepEqual(detectDiet(drink(['Rum', 'Orgeat'])).contains, ['nuts']);
  assert.deepEqual(detectDiet(drink(['Scotch', 'Honey Syrup'])).contains, ['honey']);
  assert.deepEqual(detectDiet(drink(['Bourbon', 'Eggnog'])).contains, ['egg', 'dairy']);
  assert.deepEqual(detectDiet(drink(['Gin', 'Lime Juice'])), { contains: [], may: [] });
  // Garnish counts too.
  assert.deepEqual(detectDiet(drink(['Gin'], { garnish: 'Toasted almond slivers' })).contains, ['nuts']);
  console.log('PASS: egg, dairy, tree nuts and honey are read from ingredients and garnish');
}

// The taxonomy resolves "oat milk" and "almond milk" to whole milk; a dietary flag must not.
{
  assert.deepEqual(detectDiet(drink(['Oat Milk'])), { contains: [], may: [] }, 'Oat milk is not dairy');
  assert.deepEqual(detectDiet(drink(['Coconut Cream'])), { contains: [], may: [] }, 'Coconut cream is not dairy');
  assert.deepEqual(detectDiet(drink(['Cream of Coconut'])), { contains: [], may: [] });
  assert.deepEqual(detectDiet(drink(['Almond Milk'])), { contains: ['nuts'], may: [] }, 'Almond milk is a nut, not dairy');
  assert.deepEqual(detectDiet(drink(['Cream Soda'])), { contains: [], may: [] });
  assert.deepEqual(detectDiet(drink(['Cream Sherry'])), { contains: [], may: [] });
  assert.deepEqual(detectDiet(drink(['Orange Cream Citrate Bitters'])), { contains: [], may: [] }, 'Flavored bitters have no cream');
  assert.deepEqual(detectDiet(drink(['Peanut Butter'])), { contains: [], may: [] });
  assert.deepEqual(detectDiet(drink(['Honeydew Melon'])), { contains: [], may: [] }, 'Honeydew is not honey');
  assert.deepEqual(detectDiet(drink(['Crème de Cacao', 'Coffee Liqueur', 'Chocolate Liqueur'])), { contains: [], may: [] }, 'Coffee and chocolate liqueurs are not nut liqueurs');
  assert.deepEqual(detectDiet(drink(['Irish Cream'])).contains, ['dairy']);
  assert.deepEqual(detectDiet(drink(['Baileys'])).contains, ['dairy']);
  assert.deepEqual(detectDiet(drink(['Amaretto'])).contains, ['nuts']);
  assert.deepEqual(detectDiet(drink(['Velvet Falernum'])), { contains: [], may: ['nuts'] }, 'Falernum only may contain nuts');
  console.log('PASS: plant milks, cream sodas, bitters, and look-alike liqueurs are classified correctly');
}

// The bundled library: known counts, so a regex change can't silently drop a drink.
{
  const count = (level, key) => SEED_RECIPES.filter(r => dietFor(r)[level].includes(key)).length;
  assert.equal(count('contains', 'egg'), 11);
  assert.equal(count('contains', 'dairy'), 7);
  assert.equal(count('contains', 'nuts'), 20);
  assert.equal(count('contains', 'honey'), 12);
  assert.equal(count('may', 'nuts'), 9);
  const ramos = SEED_RECIPES.find(r => r.name === 'Ramos Gin Fizz');
  assert.deepEqual(dietFor(ramos).contains, ['egg', 'dairy']);
  assert.deepEqual(flagsOnMenu(SEED_RECIPES), ['egg', 'dairy', 'nuts', 'honey']);
  assert.deepEqual(flagsOnMenu([drink(['Gin'])]), [], 'A menu with nothing flagged offers no filter');
  console.log('PASS: the seed library flags the expected drinks');
}

// Host corrections.
{
  const falernumDrink = drink(['Rum', 'Velvet Falernum']);
  assert.deepEqual(dietFor(falernumDrink).may, ['nuts']);
  assert.deepEqual(dietFor({ ...falernumDrink, diet: { nuts: 'none' } }), { contains: [], may: [] }, 'Host says no almond');
  assert.deepEqual(dietFor({ ...falernumDrink, diet: { nuts: 'contains' } }).contains, ['nuts']);
  assert.deepEqual(dietFor(drink(['Gin'], { diet: { dairy: 'may' } })).may, ['dairy'], 'Host can add a flag the text missed');
  assert.deepEqual(dietFor(drink(['Gin'], { diet: { dairy: 'bogus' } })), { contains: [], may: [] }, 'Unknown levels are ignored');
  console.log('PASS: host corrections replace the automatic flag');
}

// The avoid filter and the egg-free swap.
{
  const egg = drink(['Gin', 'Egg White'], { name: 'Clover Club' });
  const eggSwap = { ...egg, diet: { swap: true } };
  const nutty = drink(['Rum', 'Velvet Falernum']);
  const plain = drink(['Gin', 'Lime']);
  const avoidEgg = new Set(['egg']);
  const avoidNuts = new Set(['nuts']);

  assert.equal(clashesWith(egg, avoidEgg), true);
  assert.equal(clashesWith(eggSwap, avoidEgg), false, 'A drink the host makes egg-free stays on the list');
  assert.equal(clashesWith(nutty, avoidNuts), true, '"May contain" counts as a clash');
  assert.equal(clashesWith(plain, avoidEgg), false);
  assert.equal(clashesWith(egg, new Set()), false);
  assert.equal(hasEggSwap(eggSwap), true);
  assert.equal(hasEggSwap({ ...plain, diet: { swap: true } }), false, 'The swap means nothing without egg');
  assert.equal(needsEggSwap(eggSwap, avoidEgg), true);
  assert.equal(needsEggSwap(eggSwap, avoidNuts), false);
  assert.equal(orderedAs(eggSwap, avoidEgg).name, 'Clover Club (egg-free)');
  assert.equal(orderedAs(eggSwap, avoidNuts).name, 'Clover Club');
  assert.equal(orderedAs(egg, avoidEgg).name, 'Clover Club');
  console.log('PASS: avoiding a flag hides clashing drinks, except egg drinks the host makes egg-free');
}

// The bar-wide habit: egg drinks are made with cocktail foamer.
{
  const cloverClub = drink(['Gin', 'Lemon Juice', 'Egg White'], { name: 'Clover Club' });
  const flip = drink(['Brandy', 'Whole Egg'], { name: 'Flip' });
  const nog = drink(['Bourbon', 'Eggnog'], { name: 'Nog' });
  const yolk = drink(['Rum', 'Egg Yolk'], { name: 'Yolk' });
  const plain = drink(['Gin', 'Lime']);

  assert.equal(applyBarDiet(cloverClub, false), cloverClub, 'Off: nothing changes');
  const foamed = applyBarDiet(cloverClub, true);
  assert.equal(usesFoamer(foamed), true);
  assert.deepEqual(dietFor(foamed), { contains: [], may: [] }, 'A foamer drink is not an egg drink');
  assert.equal(clashesWith(foamed, new Set(['egg'])), false, 'Avoiding egg keeps a foamer drink');
  assert.deepEqual(flagsOnMenu([foamed]), [], 'A menu whose only egg drink uses foamer offers no egg filter');

  // Foamer only stands in for egg white.
  for (const other of [flip, nog, yolk]) {
    assert.equal(applyBarDiet(other, true), other, `${other.name} keeps its egg`);
    assert.ok(dietFor(applyBarDiet(other, true)).contains.includes('egg'));
  }
  assert.equal(applyBarDiet(plain, true), plain, 'Drinks without egg are untouched');

  // An explicit correction beats the habit, and only the recipe's own text triggers it.
  const realEgg = applyBarDiet({ ...cloverClub, diet: { egg: 'contains' } }, true);
  assert.deepEqual(dietFor(realEgg).contains, ['egg'], 'The host can say this one really has egg');
  assert.equal(usesFoamer({ ...cloverClub, diet: { foamer: true } }), true);
  assert.equal(usesFoamer({ ...plain, diet: { foamer: true } }), false, 'The flag means nothing without egg white');

  // It survives the trip to guests, on both the client and server sides.
  assert.deepEqual(sanitizeDietOverride({ foamer: true }), { foamer: true });
  assert.deepEqual(sanitizeDiet({ foamer: true, junk: 1 }), { foamer: true });
  assert.equal(sanitizeDiet({ foamer: 'yes' }), null);

  const notes = dietNotesHtml(foamed);
  assert.match(notes, /Made with cocktail foamer/);
  assert.doesNotMatch(notes, /Contains/);
  assert.match(dietNotesHtml(cloverClub), /Contains<\/span> egg/);
  console.log('PASS: the bar-wide foamer habit turns egg-white drinks into foamer drinks, and only those');
}

// The engine's own substitutes back up the swap.
{
  const names = getIngredientSubstitutes('egg white').map(s => s.name);
  assert.ok(names.includes('Cocktail Foamer') && names.includes('Aquafaba'), 'Egg white should offer foamer and aquafaba');
  console.log('PASS: the taxonomy offers cocktail foamer and aquafaba for egg white');
}

// The guest's own choice.
{
  assert.equal(loadAvoid().size, 0);
  saveAvoid(new Set(['nuts', 'egg']));
  assert.deepEqual([...loadAvoid()], ['egg', 'nuts'], 'Saved in a stable order');
  localStorage.setItem('speakeasy_guest_avoid', JSON.stringify(['egg', 'gluten', 7]));
  assert.deepEqual([...loadAvoid()], ['egg'], 'Unknown flags are dropped');
  localStorage.setItem('speakeasy_guest_avoid', '{oops');
  assert.equal(loadAvoid().size, 0, 'Corrupt storage reads as nothing avoided');
  saveAvoid(new Set());
  assert.equal(localStorage.getItem('speakeasy_guest_avoid'), null, 'Clearing removes the key');
  saveAvoid(new Set(['dairy']), LIBRARY_AVOID_KEY);
  assert.deepEqual([...loadAvoid(LIBRARY_AVOID_KEY)], ['dairy']);
  assert.equal(loadAvoid().size, 0, 'The library filter and the guest filter are kept apart');
  saveAvoid(new Set(), LIBRARY_AVOID_KEY);
  console.log('PASS: the avoid list is remembered, ordered, and tolerant of bad data');
}

// Sanitizing, client and server.
{
  assert.deepEqual(sanitizeDietOverride({ egg: 'none', swap: true, evil: 'x', dairy: 'nope' }), { egg: 'none', swap: true });
  assert.equal(sanitizeDietOverride({ dairy: 'nope' }), null);
  assert.equal(sanitizeDietOverride(null), null);
  assert.deepEqual(sanitizeDietOverrides({ a: { nuts: 'may' }, b: {}, c: 'x' }), { a: { nuts: 'may' } });
  assert.deepEqual(sanitizeDietOverrides([1, 2]), {});
  assert.deepEqual(sanitizeDiet({ egg: 'contains', swap: true, extra: 1 }), { egg: 'contains', swap: true });
  assert.equal(sanitizeDiet({ egg: 'maybe' }), null);
  assert.equal(sanitizeDiet([]), null);

  const cleaned = sanitizeMenuRecipes([
    { id: 'a', name: 'A', specs: [], diet: { nuts: 'none', junk: 1 } },
    { id: 'b', name: 'B', specs: [], diet: { nuts: 'bogus' } },
    { id: 'c', name: 'C', specs: [] },
  ]);
  assert.deepEqual(cleaned[0].diet, { nuts: 'none' });
  assert.ok(!('diet' in cleaned[1]) && !('diet' in cleaned[2]), 'Empty or invalid corrections are not stored');
  console.log('PASS: dietary corrections are sanitized the same way on the client and the server');
}

{
  const { getFoamerPreference, saveFoamerPreference } = await import('../js/modules/storage.js');
  assert.equal(getFoamerPreference(), false, 'Off until the bartender turns it on');
  assert.equal(saveFoamerPreference(true), true);
  assert.equal(getFoamerPreference(), true);
  assert.equal(saveFoamerPreference(false), false);
  assert.equal(getFoamerPreference(), false);
  console.log('PASS: the foamer habit is remembered as an app setting');
}

console.log('All dietary tests passed.');
