import assert from 'node:assert/strict';

class MockLocalStorage {
  constructor() { this.store = new Map(); }
  getItem(key) { return this.store.has(key) ? this.store.get(key) : null; }
  setItem(key, value) { this.store.set(key, String(value)); }
  removeItem(key) { this.store.delete(key); }
}
Object.defineProperty(globalThis, 'localStorage', { value: new MockLocalStorage(), configurable: true, writable: true });

const { mergeRecipeDeletions } = await import('../public/js/modules/recipe-merge.js');
const { saveRecipe, deleteRecipe, getRecipes, getDeletedRecipeIds, buildBackupPayload, importData } = await import('../public/js/modules/storage.js');
const { onRequestPost, onRequestGet } = await import('../functions/api/sync.js');

console.log('--- Testing custom-recipe delete sync ---');

// Merging tombstones
{
  const merged = mergeRecipeDeletions({ deleted: { a: 100 } }, { deleted: { b: 200 } });
  assert.deepEqual(merged, { a: 100, b: 200 }, 'Tombstones from either side survive');

  const newer = mergeRecipeDeletions({ deleted: { x: 100 } }, { deleted: { x: 200 } });
  assert.deepEqual(newer, { x: 200 }, 'The later deletion timestamp wins');

  const cleaned = mergeRecipeDeletions({ deleted: { ok: 5, bad: -1, weird: 'nope' } }, { deleted: null });
  assert.deepEqual(cleaned, { ok: 5 }, 'Malformed tombstone entries are dropped');
  console.log('PASS: recipe tombstones merge by id, newest deletion wins');
}

// The device: deleting a custom recipe leaves a tombstone, and the backup carries it.
{
  const kept = saveRecipe({ id: 'test-keep', name: 'Keep', glassware: 'Rocks', method: 'Stirred', specs: [] });
  const dropped = saveRecipe({ id: 'test-drop', name: 'Drop', glassware: 'Rocks', method: 'Stirred', specs: [] });
  assert.ok(getRecipes().some(r => r.id === kept.id) && getRecipes().some(r => r.id === dropped.id));

  deleteRecipe(dropped.id);
  assert.ok(getDeletedRecipeIds()[dropped.id] > 0, 'Deleting stamps a tombstone');
  assert.ok(!getRecipes().some(r => r.id === dropped.id), 'The deleted recipe is gone locally');

  const payload = buildBackupPayload();
  assert.ok(payload.deletedRecipes[dropped.id] > 0, 'The backup carries the tombstone');
  assert.ok(!payload.customRecipes.some(r => r.id === dropped.id), 'The backup does not resurrect the deleted recipe');
  assert.ok(payload.customRecipes.some(r => r.id === kept.id), 'An untouched custom recipe still backs up');

  // Recreating under the same id is a deliberate un-delete.
  saveRecipe({ id: dropped.id, name: 'Drop Again', glassware: 'Rocks', method: 'Stirred', specs: [] });
  assert.equal(getDeletedRecipeIds()[dropped.id], undefined, 'Saving the id again retires its tombstone');
  assert.ok(getRecipes().some(r => r.id === dropped.id), 'The recreated recipe is back locally');
  console.log('PASS: deleting a custom recipe tombstones it, and recreating it clears the tombstone');
}

// Pulling: a recipe deleted on another device is removed here too; nothing untouched is lost.
{
  localStorage.removeItem('speakeasy_recipes');
  localStorage.removeItem('speakeasy_deleted_recipes');
  const local = saveRecipe({ id: 'local-only', name: 'Local Only', glassware: 'Rocks', method: 'Stirred', specs: [] });
  const stale = saveRecipe({ id: 'stale-copy', name: 'Deleted Elsewhere', glassware: 'Rocks', method: 'Stirred', specs: [] });

  const cloud = {
    version: 2,
    bars: [],
    settings: {},
    customRecipes: [{ id: 'from-cloud', name: 'From The Cloud', glassware: 'Coupe', method: 'Shaken', specs: [] }],
    deletedRecipes: { [stale.id]: Date.now() + 10 },
  };
  importData(JSON.stringify(cloud));

  const ids = getRecipes().map(r => r.id);
  assert.ok(ids.includes(local.id), 'A local-only recipe survives the pull');
  assert.ok(ids.includes('from-cloud'), 'A recipe added elsewhere arrives');
  assert.ok(!ids.includes(stale.id), 'A recipe deleted elsewhere is removed here too, not just left stale');
  assert.ok(getDeletedRecipeIds()[stale.id] > 0, 'The tombstone is adopted locally so it keeps sticking');
  console.log('PASS: pulling a cloud backup removes recipes deleted elsewhere without losing local ones');
}

// The server: a deleted recipe is physically removed and stays out of future pulls.
{
  const users = new Map([['u1', { settings: '{"unitPref":"oz"}' }]]);
  const recipes = new Map();
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
        async all() {
          if (q.includes('FROM custom_recipes WHERE user_id = ?')) {
            const [userId] = params;
            return { results: Array.from(recipes.values()).filter(r => r.user_id === userId) };
          }
          return { results: [] };
        },
        async run() { return { success: true }; },
        _run: async () => {
          if (q.startsWith('UPDATE users SET settings')) users.get(params[1]).settings = params[0];
          if (q.startsWith('INSERT INTO custom_recipes')) {
            const [id, userId, name, glassware, method, specs, instructions, description, notes, garnish, source, sourceUrl, riffOfId, riffOfName, tags, isPublic] = params;
            recipes.set(id, { id, user_id: userId, name, glassware, method, specs, instructions, description, notes, garnish, source, source_url: sourceUrl, riff_of_id: riffOfId, riff_of_name: riffOfName, tags, is_public: isPublic });
          }
          if (q.startsWith('DELETE FROM custom_recipes WHERE user_id = ? AND id IN')) {
            const [userId, ...deleteIds] = params;
            for (const id of deleteIds) {
              const row = recipes.get(id);
              if (row && row.user_id === userId) recipes.delete(id);
            }
          }
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

  const recipe = (id, extra = {}) => ({ id, name: id, glassware: 'Rocks', method: 'Stirred', specs: [], ...extra });

  // A recipe syncs up normally.
  assert.equal((await post({ settings: {}, customRecipes: [recipe('pickletini')] })).status, 200);
  assert.deepEqual((await get()).backup.customRecipes.map(r => r.id), ['pickletini']);

  // The reported bug: deleting it and syncing must not leave it re-pullable.
  await post({ settings: {}, customRecipes: [], deletedRecipes: { pickletini: Date.now() } });
  let backup = (await get()).backup;
  assert.deepEqual(backup.customRecipes.map(r => r.id), [], 'Deleted recipe no longer comes back from a GET');
  assert.ok(backup.deletedRecipes.pickletini > 0, 'The tombstone is handed back so other devices adopt it');
  assert.equal(recipes.has('pickletini'), false, 'The row is physically removed from storage, not just filtered');

  // A later sync that still lists it (this device un-deleting it on purpose)
  // without re-asserting the tombstone brings it back.
  await post({ settings: {}, customRecipes: [recipe('pickletini', { name: 'Pickletini Again' })] });
  backup = (await get()).backup;
  assert.deepEqual(backup.customRecipes.map(r => r.id), ['pickletini'], 'Recreating the id afterward is a deliberate un-delete');
  assert.equal(backup.deletedRecipes.pickletini, undefined, 'and retires the tombstone');

  console.log('PASS: the server actually deletes a tombstoned recipe and keeps it out of future pulls');
}

console.log('All recipe sync tests passed.');
process.exit(0);
