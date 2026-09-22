import assert from 'node:assert/strict';

class MockLocalStorage {
  constructor() { this.store = new Map(); }
  getItem(key) { return this.store.has(key) ? this.store.get(key) : null; }
  setItem(key, value) { this.store.set(key, String(value)); }
  removeItem(key) { this.store.delete(key); }
}
Object.defineProperty(globalThis, 'localStorage', { value: new MockLocalStorage(), configurable: true, writable: true });

const { saveMenu, getMenus } = await import('../public/js/modules/storage.js');
const { state } = await import('../public/js/state.js');
const { canAddToMenu, addRecipeToMenu } = await import('../public/js/views/add-to-menu.js');

console.log('--- Testing Add to Menu ---');

const signIn = () => localStorage.setItem('speakeasy_user', JSON.stringify({ id: 'u1', email: 'a@example.com' }));
const signOut = () => localStorage.removeItem('speakeasy_user');
const clearMenus = () => localStorage.removeItem('speakeasy_menus');
const drink = (id, name = id) => ({ id, name, glassware: 'Coupe', method: 'Shaken', specs: [{ amount: 2, unit: 'oz', name: 'Gin' }] });

// The action is only offered to a signed-in user who has a menu to add to.
{
  clearMenus();
  signOut();
  assert.equal(canAddToMenu(), false, 'Signed out, no menus');
  saveMenu({ name: 'Party', recipeIds: ['a'] });
  assert.equal(canAddToMenu(), false, 'Signed out: menus belong to an account, even ones saved before');
  signIn();
  assert.equal(canAddToMenu(), true, 'Signed in with a menu');
  clearMenus();
  assert.equal(canAddToMenu(), false, 'Signed in but no menus: nothing to add to');

  // An Always Ready menu's list is computed automatically — never a target.
  saveMenu({ id: 'menu-ready-test', name: 'Always Ready', recipeIds: ['a'], dynamic: 'ready', readyBarId: 'bar-1' });
  assert.equal(canAddToMenu(), false, 'A Ready menu alone offers nothing to add to by hand');
  saveMenu({ id: 'menu-manual-test', name: 'Party', recipeIds: ['a'] });
  assert.equal(canAddToMenu(), true, 'A manual menu alongside it is offered');
  assert.equal((await addRecipeToMenu(drink('z'), 'menu-ready-test')).status, 'missing', 'Directly targeting a Ready menu is refused, same as one that does not exist');
  console.log('PASS: Add to Menu is offered only when signed in and there is a menu, and skips Always Ready menus');
}

// Adding to a plain (never published) menu.
{
  clearMenus();
  signIn();
  const menu = saveMenu({ name: 'Party', recipeIds: ['a', 'b'] });
  assert.deepEqual(await addRecipeToMenu(drink('c'), menu.id), { status: 'added', link: 'none' });
  assert.deepEqual(getMenus()[0].recipeIds, ['a', 'b', 'c'], 'Appended at the end');
  assert.equal((await addRecipeToMenu(drink('c'), menu.id)).status, 'exists', 'No duplicates');
  assert.deepEqual(getMenus()[0].recipeIds, ['a', 'b', 'c']);
  assert.equal((await addRecipeToMenu(drink('z'), 'no-such-menu')).status, 'missing');
  const big = saveMenu({ name: 'Big', recipeIds: Array.from({ length: 100 }, (_, i) => `d${i}`) });
  assert.equal((await addRecipeToMenu(drink('extra'), big.id)).status, 'full', 'The server caps a menu at 100 drinks');
  assert.equal(getMenus().find(m => m.id === big.id).recipeIds.length, 100);
  console.log('PASS: a drink is appended once, and a missing or full menu is refused');
}

// A published menu is republished, including the bar-wide foamer habit.
{
  clearMenus();
  signIn();
  state.recipes = [
    { ...drink('clover-club', 'Clover Club'), specs: [{ amount: 1, unit: 'oz', name: 'Egg White' }] },
    drink('negroni', 'Negroni'),
  ];
  state.foamerForEgg = true;
  const menu = saveMenu({
    name: 'Live', recipeIds: ['negroni'],
    share: { id: 'velvet-smoky-nightcap', token: 'tok', outIds: [], featuredIds: [] },
  });
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return { ok: true, json: async () => ({ success: true }) };
  };
  assert.deepEqual(await addRecipeToMenu(state.recipes[0], menu.id), { status: 'added', link: 'updated' });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, '/api/menus/velvet-smoky-nightcap');
  assert.equal(calls[0].options.method, 'PUT');
  assert.equal(calls[0].options.headers.Authorization, 'Bearer tok');
  const sent = JSON.parse(calls[0].options.body);
  assert.deepEqual(sent.recipes.map(r => r.id), ['negroni', 'clover-club']);
  assert.deepEqual(sent.recipes[1].diet, { foamer: true }, 'Guests are told it is made with foamer');
  assert.equal(sent.name, 'Live');

  // A dead guest link is dropped rather than left looking live.
  globalThis.fetch = async () => ({ ok: false, status: 404, json: async () => ({ success: false, error: 'Not found' }) });
  assert.deepEqual(await addRecipeToMenu(drink('gimlet'), menu.id), { status: 'added', link: 'dead' });
  assert.equal(getMenus()[0].share, undefined, 'The stale link is forgotten');
  assert.ok(getMenus()[0].recipeIds.includes('gimlet'), 'The drink is still added locally');
  console.log('PASS: adding to a live menu republishes it, and a dead link is dropped');
}

console.log('All Add to Menu tests passed.');
// Signed-in storage writes schedule a cloud sync that keeps retrying; nothing here needs it.
process.exit(0);
