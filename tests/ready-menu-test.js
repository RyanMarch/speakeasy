import assert from 'node:assert/strict';

class MockLocalStorage {
  constructor() { this.store = new Map(); }
  getItem(key) { return this.store.has(key) ? this.store.get(key) : null; }
  setItem(key, value) { this.store.set(key, String(value)); }
  removeItem(key) { this.store.delete(key); }
}
Object.defineProperty(globalThis, 'localStorage', { value: new MockLocalStorage(), configurable: true, writable: true });

const { state } = await import('../public/js/state.js');
const storage = await import('../public/js/modules/storage.js');
const {
  computeReadyRecipeIds, isReadyMenu, findReadyMenuForBar, defaultReadyMenuName,
  createReadyMenu, refreshReadyMenu, refreshReadyMenusForBar, deleteReadyMenusForBar, PUSH_DEBOUNCE_MS,
} = await import('../public/js/modules/ready-menu.js');

console.log('--- Testing the Always Ready menu ---');

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const drink = (id, specNames) => ({ id, name: id, glassware: 'Coupe', method: 'Shaken', specs: specNames.map(name => ({ amount: 1, unit: 'oz', name })) });

state.recipes = [
  drink('gin-and-tonic', ['Gin', 'Tonic Water']),
  drink('martini', ['Gin', 'Dry Vermouth']),
  drink('daiquiri', ['White Rum', 'Lime Juice', 'Simple Syrup']),
];
state.foamerForEgg = false;

// Two bars: reset storage, create both, and stock only the first.
localStorage.setItem('speakeasy_bars', JSON.stringify([]));
const barA = storage.createBar('Home Bar');
const barB = storage.createBar('Office Bar');
storage.setActiveBarId(barA.id);
storage.saveInventory(['london_dry_gin', 'tonic_water']);

console.log('--- computeReadyRecipeIds ---');
{
  assert.deepEqual(computeReadyRecipeIds(barA.id), ['gin-and-tonic'], 'Only the exact-match drink is ready');
  assert.deepEqual(computeReadyRecipeIds(barB.id), [], 'An empty bar has nothing ready');
  assert.deepEqual(computeReadyRecipeIds(null), [], "No bar id, no drinks — doesn't throw");
  console.log('PASS: readiness is computed per bar, exact matches only');
}

console.log('--- creating and finding ---');
let menuA;
{
  assert.equal(findReadyMenuForBar(barA.id), null, 'No Ready menu for this bar yet');
  assert.equal(defaultReadyMenuName('Home Bar', 1), 'Always Ready', 'Single-bar accounts get the plain name');
  assert.equal(defaultReadyMenuName('Home Bar', 2), 'Home Bar — Always Ready', 'Multi-bar accounts name the bar');

  menuA = createReadyMenu(barA.id, barA.name, 2);
  assert.equal(menuA.dynamic, 'ready');
  assert.equal(menuA.readyBarId, barA.id);
  assert.deepEqual(menuA.recipeIds, ['gin-and-tonic']);
  assert.equal(isReadyMenu(menuA), true);
  assert.equal(findReadyMenuForBar(barA.id).id, menuA.id, 'Now it can be found');
  assert.equal(findReadyMenuForBar(barB.id), null, "Bar B's own menu doesn't exist yet");

  assert.equal(isReadyMenu({ dynamic: 'ready' }), false, 'No readyBarId, not a Ready menu');
  assert.equal(isReadyMenu({ readyBarId: barA.id }), false, 'No dynamic flag, not a Ready menu');
  assert.equal(isReadyMenu(null), false);
  console.log('PASS: a Ready menu is created with what is ready now, and found by its bar');
}

console.log('--- saveMenu persists the dynamic fields, and only for real ones ---');
{
  // Explicit ids: two saveMenu calls with none default to `menu-${Date.now()}`,
  // which can collide (and silently overwrite menuA) inside a fast test run.
  const plain = storage.saveMenu({ id: 'menu-plain-test', name: 'Party', recipeIds: ['martini'] });
  assert.equal('dynamic' in plain, false, "A normal menu doesn't pick up the fields");
  const bogus = storage.saveMenu({ id: 'menu-bogus-test', name: 'X', recipeIds: ['martini'], dynamic: 'ready' });
  assert.equal('dynamic' in bogus, false, 'dynamic without a readyBarId is dropped');
  storage.deleteMenu(plain.id);
  storage.deleteMenu(bogus.id);
  console.log('PASS: dynamic/readyBarId only stick together, on a real Ready menu');
}

console.log('--- refreshReadyMenu ---');
{
  // The bar gets a second bottle: the menu should pick up the newly-ready drink.
  storage.saveInventory(['london_dry_gin', 'tonic_water', 'dry_vermouth']);
  const refreshed = refreshReadyMenu(storage.getMenus().find(m => m.id === menuA.id));
  assert.deepEqual(refreshed.recipeIds.sort(), ['gin-and-tonic', 'martini']);
  assert.deepEqual(storage.getMenus().find(m => m.id === menuA.id).recipeIds.sort(), ['gin-and-tonic', 'martini'], 'Persisted locally');

  // Nothing changed: refreshing again is a no-op (same object back, not a fresh save).
  const again = refreshReadyMenu(refreshed);
  assert.equal(again, refreshed);

  // The bar goes empty: the menu keeps its last non-empty snapshot rather than publishing nothing.
  storage.saveInventory([]);
  const starved = refreshReadyMenu(storage.getMenus().find(m => m.id === menuA.id));
  assert.deepEqual(starved.recipeIds.sort(), ['gin-and-tonic', 'martini'], 'The last known ready set is kept, not emptied');
  assert.equal(computeReadyRecipeIds(barA.id).length, 0, "...even though nothing's actually ready right now");

  // Restock: the next refresh replaces the stale snapshot with what's true now.
  storage.saveInventory(['light_rum', 'lime_juice', 'simple_syrup']);
  const restocked = refreshReadyMenu(storage.getMenus().find(m => m.id === menuA.id));
  assert.deepEqual(restocked.recipeIds, ['daiquiri']);
  console.log('PASS: a Ready menu updates with the bar, keeps its last non-empty list when starved, and self-heals when restocked');
}

console.log('--- publishing is debounced, guarded against empty, and pruned to what remains ---');
{
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, body: options.body ? JSON.parse(options.body) : null });
    return { ok: true, json: async () => ({ success: true }) };
  };

  let menu = storage.getMenus().find(m => m.id === menuA.id);
  menu = storage.saveMenu({
    ...menu,
    share: { id: 'velvet-smoky-nightcap', token: 'tok', outIds: ['daiquiri'], featuredIds: ['daiquiri'], dietOverrides: { daiquiri: { nuts: 'none' } } },
  });

  storage.saveInventory(['light_rum', 'lime_juice', 'simple_syrup', 'london_dry_gin', 'tonic_water']);
  refreshReadyMenu(storage.getMenus().find(m => m.id === menuA.id));
  assert.equal(calls.length, 0, 'The push is debounced, not immediate');
  await sleep(PUSH_DEBOUNCE_MS + 300);
  assert.equal(calls.length, 1, 'One push after the debounce settles');
  assert.equal(calls[0].url, '/api/menus/velvet-smoky-nightcap');
  assert.deepEqual(calls[0].body.recipes.map(r => r.id).sort(), ['daiquiri', 'gin-and-tonic']);

  // Emptying the bar must never try to publish zero recipes.
  storage.saveInventory([]);
  refreshReadyMenu(storage.getMenus().find(m => m.id === menuA.id));
  await sleep(PUSH_DEBOUNCE_MS + 300);
  assert.equal(calls.length, 1, 'Still just one push: a starved bar keeps showing guests the last update');
  console.log('PASS: updates are debounced, and an empty bar never triggers a publish');
}

console.log('--- refreshReadyMenusForBar only touches the bar that changed ---');
{
  storage.setActiveBarId(barB.id);
  storage.saveInventory(['london_dry_gin', 'dry_vermouth']);
  const menuB = createReadyMenu(barB.id, barB.name, 2);
  const beforeA = storage.getMenus().find(m => m.id === menuA.id).recipeIds;

  refreshReadyMenusForBar(barB.id);
  const afterA = storage.getMenus().find(m => m.id === menuA.id).recipeIds;
  const afterB = storage.getMenus().find(m => m.id === menuB.id).recipeIds;
  assert.deepEqual(afterA, beforeA, "Bar A's menu is untouched by a change on Bar B");
  assert.deepEqual(afterB, ['martini'], "Bar B's menu picks up what's ready there");

  // No bar id and no active bar: nothing to do, doesn't throw.
  refreshReadyMenusForBar(null);
  console.log('PASS: refreshing scopes to the one bar that changed');
}

console.log('--- deleteReadyMenusForBar ---');
{
  const before = storage.getMenus().length;
  const removed = deleteReadyMenusForBar(barA.id);
  assert.equal(removed.length, 1);
  assert.equal(removed[0].readyBarId, barA.id);
  assert.ok(removed[0].share, 'Its guest-link credentials are handed back so the caller can unpublish them');
  assert.equal(storage.getMenus().length, before - 1);
  assert.equal(findReadyMenuForBar(barA.id), null);
  assert.deepEqual(deleteReadyMenusForBar(barA.id), [], 'Nothing left to remove the second time');
  console.log('PASS: deleting a bar\'s Ready menu removes it locally and hands back its share to unpublish');
}

console.log('All Always Ready menu tests passed.');
process.exit(0);
