import assert from 'node:assert/strict';

class MockLocalStorage {
  constructor() { this.store = new Map(); }
  getItem(key) { return this.store.has(key) ? this.store.get(key) : null; }
  setItem(key, value) { this.store.set(key, String(value)); }
  removeItem(key) { this.store.delete(key); }
}
Object.defineProperty(globalThis, 'localStorage', { value: new MockLocalStorage(), configurable: true, writable: true });

const { mergeMenuSets, normalizeMenu, menuStamp } = await import('../js/modules/menu-merge.js');
const { saveMenu, getMenus, deleteMenu, getDeletedMenus, buildBackupPayload, importData } = await import('../js/modules/storage.js');
const { onRequestPost, onRequestGet } = await import('../functions/api/sync.js');

console.log('--- Testing saved-menu sync ---');

const menu = (id, extra = {}) => ({ id, name: id, recipeIds: ['a'], createdAt: 1000, ...extra });
const ids = (set) => set.menus.map(m => m.id);

// Merging
{
  const merged = mergeMenuSets({ menus: [menu('laptop')] }, { menus: [menu('phone')] });
  assert.deepEqual(ids(merged).sort(), ['laptop', 'phone'], 'A menu from either side survives');

  const newer = mergeMenuSets(
    { menus: [menu('m', { name: 'Old', updatedAt: 2000 })] },
    { menus: [menu('m', { name: 'New', updatedAt: 3000 })] },
  );
  assert.equal(newer.menus[0].name, 'New', 'The most recently saved copy wins');
  const tie = mergeMenuSets({ menus: [menu('m', { name: 'Mine', updatedAt: 5 })] }, { menus: [menu('m', { name: 'Theirs', updatedAt: 5 })] });
  assert.equal(tie.menus[0].name, 'Mine', 'A tie keeps the local copy');
  assert.equal(menuStamp({ createdAt: 7 }), 7, 'Menus saved before updatedAt existed fall back to createdAt');

  // A deletion sticks against an older copy, and yields to a later save.
  const gone = mergeMenuSets({ menus: [], deleted: { m: 5000 } }, { menus: [menu('m', { updatedAt: 4000 })] });
  assert.deepEqual(ids(gone), [], 'A stale device cannot bring a deleted menu back');
  assert.deepEqual(gone.deleted, { m: 5000 }, 'The tombstone is kept while it is still needed');
  const back = mergeMenuSets({ menus: [], deleted: { m: 5000 } }, { menus: [menu('m', { updatedAt: 6000 })] });
  assert.deepEqual(ids(back), ['m'], 'Saving a menu again after deleting it brings it back');
  assert.deepEqual(back.deleted, {}, 'and retires the tombstone');

  // Nothing malformed gets in, and nothing without a tombstone is ever dropped.
  assert.equal(normalizeMenu({ id: 'x' }), null);
  assert.equal(normalizeMenu('nope'), null);
  const cleaned = mergeMenuSets({ menus: [menu('ok'), { id: 'bad' }, null] }, undefined);
  assert.deepEqual(ids(cleaned), ['ok']);
  const withShare = normalizeMenu(menu('s', { share: { id: 'velvet-smoky-nightcap', token: 't', outIds: ['a'], featuredIds: [], dietOverrides: { a: { nuts: 'none', x: 1 } } } }));
  assert.deepEqual(withShare.share.dietOverrides, { a: { nuts: 'none' } }, 'Guest-link credentials travel with the menu, cleaned');
  console.log('PASS: menu copies merge by id, newest wins, and deletions stick until saved again');
}

// The device: deleting leaves a tombstone, and the backup carries menus + tombstones.
{
  const kept = saveMenu({ id: 'menu-keep', name: 'Keep', recipeIds: ['a'] });
  const dropped = saveMenu({ id: 'menu-drop', name: 'Drop', recipeIds: ['b'] });
  assert.ok(getMenus().every(m => m.updatedAt > 0), 'Every saved menu is stamped');
  deleteMenu(dropped.id);
  assert.ok(getDeletedMenus()[dropped.id] > 0);
  const payload = buildBackupPayload();
  assert.deepEqual(payload.menus.map(m => m.id), [kept.id]);
  assert.ok(payload.deletedMenus[dropped.id] > 0);
  assert.equal(typeof payload.settings.foamerForEgg, 'boolean', 'The foamer setting is part of what syncs');
  console.log('PASS: the backup carries menus, tombstones, and the foamer setting');
}

// Pulling: a menu from the cloud appears, a menu deleted elsewhere goes, nothing else is lost.
{
  localStorage.removeItem('speakeasy_menus');
  localStorage.removeItem('speakeasy_deleted_menus');
  const local = saveMenu({ id: 'menu-local', name: 'Local only', recipeIds: ['a'] });
  const stale = saveMenu({ id: 'menu-stale', name: 'Deleted elsewhere', recipeIds: ['a'] });
  const cloud = {
    version: 2, customRecipes: [], bars: [],
    settings: { foamerForEgg: true },
    menus: [menu('from-laptop', { name: 'Built on the laptop', updatedAt: Date.now() + 5 })],
    deletedMenus: { [stale.id]: Date.now() + 10 },
  };
  importData(JSON.stringify(cloud));
  const names = getMenus().map(m => m.name).sort();
  assert.deepEqual(names, ['Built on the laptop', 'Local only'], 'The laptop menu arrives; the one deleted there is removed');
  assert.ok(getMenus().some(m => m.id === local.id));
  const { getFoamerPreference } = await import('../js/modules/storage.js');
  assert.equal(getFoamerPreference(), true, 'The foamer setting arrives too');
  console.log('PASS: pulling brings new menus and deletions across without losing local ones');
}

// The server: merges into what it holds, never replaces, and hands menus back.
{
  const users = new Map([['u1', { settings: '{"unitPref":"oz"}' }]]);
  const db = {
    prepare(sql) {
      const q = sql.trim();
      let params = [];
      const stmt = {
        bind(...p) { params = p; return stmt; },
        async first() {
          if (q.startsWith('SELECT settings FROM users')) return users.get(params[0]) || null;
          if (q.startsWith('SELECT user_id, expires_at FROM sessions')) return { user_id: 'u1', expires_at: new Date(Date.now() + 1e6).toISOString() };
          return null;
        },
        async all() { return { results: [] }; },
        async run() { return { success: true }; },
        _run: async () => {
          if (q.startsWith('UPDATE users SET settings')) users.get(params[1]).settings = params[0];
        },
      };
      return stmt;
    },
    async batch(statements) { for (const s of statements) await s._run(); },
  };
  const env = { speakeasy_db: db };
  const post = (body) => onRequestPost({
    request: new Request('https://example.com/api/sync', { method: 'POST', headers: { Cookie: 'speakeasy_session=t', 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
    env,
  });
  const get = async () => (await onRequestGet({ request: new Request('https://example.com/api/sync', { headers: { Cookie: 'speakeasy_session=t' } }), env })).json();

  assert.equal((await post({ settings: { unitPref: 'ml' }, menus: [menu('laptop', { updatedAt: 10 })] })).status, 200);
  // A second device that has no menus, and an older app that sends none at all, must not wipe it.
  assert.equal((await post({ settings: { unitPref: 'ml' }, menus: [], deletedMenus: {} })).status, 200);
  assert.equal((await post({ settings: { unitPref: 'oz' } })).status, 200);
  let backup = (await get()).backup;
  assert.deepEqual(backup.menus.map(m => m.id), ['laptop'], 'Other devices cannot wipe a menu');
  assert.equal(backup.settings.unitPref, 'oz');
  assert.equal('menuSync' in backup.settings, false, 'Menus are handed back as their own field, not inside settings');

  // A second menu from the phone merges in; a deletion from either device sticks.
  await post({ settings: {}, menus: [menu('phone', { updatedAt: 20 })] });
  assert.deepEqual((await get()).backup.menus.map(m => m.id).sort(), ['laptop', 'phone']);
  await post({ settings: {}, menus: [], deletedMenus: { laptop: 30 } });
  backup = (await get()).backup;
  assert.deepEqual(backup.menus.map(m => m.id), ['phone']);
  assert.deepEqual(backup.deletedMenus, { laptop: 30 });
  await post({ settings: {}, menus: [menu('laptop', { updatedAt: 15 })] });
  assert.deepEqual((await get()).backup.menus.map(m => m.id), ['phone'], 'A stale copy cannot resurrect a deleted menu');
  console.log('PASS: the server merges menus into what it holds and never lets one device wipe another');
}

console.log('All menu sync tests passed.');
process.exit(0);
