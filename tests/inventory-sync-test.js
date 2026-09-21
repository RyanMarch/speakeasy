import assert from 'node:assert/strict';

class MockLocalStorage {
  constructor() { this.store = new Map(); }
  getItem(key) { return this.store.has(key) ? this.store.get(key) : null; }
  setItem(key, value) { this.store.set(key, String(value)); }
  removeItem(key) { this.store.delete(key); }
}
Object.defineProperty(globalThis, 'localStorage', { value: new MockLocalStorage(), configurable: true, writable: true });

const { mergeInventory, recordInventoryChange } = await import('../js/modules/inventory-merge.js');
const storage = await import('../js/modules/storage.js');
const { onRequestPost, onRequestGet } = await import('../functions/api/sync.js');

console.log('--- Testing bar-inventory sync ---');

const sorted = (list) => [...list].sort();

// Merging
{
  // Plain union when nothing was ever removed on purpose.
  assert.deepEqual(sorted(mergeInventory({ items: ['gin'] }, { items: ['rum', 'gin'] }).items), ['gin', 'rum']);

  // A removal beats a device that simply still lists the bottle (no newer "added").
  const removedOnLaptop = { items: ['gin'], removed: { rum: 200 } };
  const stalePhone = { items: ['gin', 'rum'] };
  assert.deepEqual(mergeInventory(removedOnLaptop, stalePhone, 300).items, ['gin'], 'A stale device cannot put a removed bottle back');
  assert.deepEqual(mergeInventory(stalePhone, removedOnLaptop, 300).items, ['gin'], 'Either order');
  assert.equal(mergeInventory(removedOnLaptop, stalePhone, 300).removed.rum, 200, 'The removal is remembered for the next device');

  // Adding it again afterwards wins, and retires the removal.
  const readded = mergeInventory({ items: ['gin'], removed: { rum: 200 } }, { items: ['gin', 'rum'], added: { rum: 250 } }, 300);
  assert.deepEqual(sorted(readded.items), ['gin', 'rum']);
  assert.equal('rum' in readded.removed, false);
  assert.equal(readded.added.rum, 250, 'The add is kept so other devices still holding the removal learn of it');

  // Old records fall away; malformed input is ignored; nothing is dropped without a record.
  const DAY = 24 * 60 * 60 * 1000;
  assert.deepEqual(mergeInventory({ items: [], removed: { rum: 1 } }, { items: ['rum'] }, 400 * DAY).items, ['rum'], 'A removal older than the retention window is forgotten');
  assert.deepEqual(mergeInventory({ items: ['gin', 7, null], removed: 'x' }, { items: 'nope', added: [1] }).items, ['gin']);

  // Recording a device's own change.
  const rec = recordInventoryChange({ added: {}, removed: { gin: 5 } }, ['rum', 'vodka'], ['rum', 'gin'], 100);
  assert.deepEqual(rec, { added: { gin: 100 }, removed: { vodka: 100 } }, 'Adds and removes get times, and each replaces the opposite record');
  console.log('PASS: bottles merge, a removal beats a stale device, and a later add beats a removal');
}

// The device records what the user does, but not what a sync does.
{
  storage.saveInventory(['gin', 'rum', 'vodka']);
  const barId = storage.getActiveBarId();
  storage.saveInventory(['gin', 'rum']);
  const records = storage.getInventoryChanges()[barId];
  assert.ok(records.removed.vodka > 0, 'Taking a bottle off is recorded');
  assert.ok(records.added.gin > 0 && records.added.rum > 0, 'Putting bottles on is recorded');

  // Pulling from the cloud: this device's own removal survives a cloud copy that still lists the bottle.
  storage.importData(JSON.stringify({
    version: 2, customRecipes: [], hiddenRecipes: [],
    bars: [{ id: barId, name: 'Home Bar', isDefault: true, inventory: ['gin', 'rum', 'vodka', 'campari'] }],
    inventoryChanges: {},
  }));
  assert.deepEqual(sorted(storage.getInventory()), ['campari', 'gin', 'rum'], 'The removed bottle stays off; a genuinely new one arrives');

  // ...and a cloud removal takes the bottle off this device.
  storage.importData(JSON.stringify({
    version: 2, customRecipes: [], hiddenRecipes: [],
    bars: [{ id: barId, name: 'Home Bar', isDefault: true, inventory: ['gin', 'rum'] }],
    inventoryChanges: { [barId]: { removed: { campari: Date.now() + 10 } } },
  }));
  assert.deepEqual(sorted(storage.getInventory()), ['gin', 'rum'], 'A removal made on another device arrives');
  assert.ok(storage.getInventoryChanges()[barId].removed.campari > 0, 'and is remembered here');

  // A backup file from before these records existed is a deliberate restore: plain merge.
  storage.importData(JSON.stringify({
    version: 2, customRecipes: [], hiddenRecipes: [],
    bars: [{ id: barId, name: 'Home Bar', isDefault: true, inventory: ['vodka'] }],
  }));
  assert.ok(storage.getInventory().includes('vodka'), 'Restoring an old backup file adds its bottles back');

  const payload = storage.buildBackupPayload();
  assert.ok(payload.inventoryChanges[barId], 'The backup carries the records');
  console.log('PASS: the device records its own changes and merges cloud copies without undoing them');
}

// The server: a removal on one device reaches the others, and a stale device cannot undo it.
{
  const bars = new Map();
  const inventory = new Map(); // barId -> Set
  const users = new Map([['u1', { settings: '{"unitPref":"oz"}' }]]);
  const db = {
    prepare(sql) {
      const q = sql.trim().replace(/\s+/g, ' ');
      let params = [];
      const stmt = {
        bind(...p) { params = p; return stmt; },
        async first() {
          if (q.startsWith('SELECT settings FROM users')) return users.get('u1');
          if (q.startsWith('SELECT user_id, expires_at FROM sessions')) return { user_id: 'u1', expires_at: new Date(Date.now() + 1e6).toISOString() };
          return null;
        },
        async all() {
          if (q.startsWith('SELECT id, user_id FROM bars WHERE id IN')) return { results: params.filter(id => bars.has(id)).map(id => ({ id, user_id: 'u1' })) };
          if (q.startsWith('SELECT ingredient_id FROM bar_inventory WHERE bar_id = ?')) return { results: [...(inventory.get(params[0]) || [])].map(ingredient_id => ({ ingredient_id })) };
          if (q.startsWith('SELECT id, name, is_default, created_at FROM bars')) return { results: [...bars.values()] };
          return { results: [] };
        },
        async run() { return { success: true }; },
        _run: async () => {
          if (q.startsWith('INSERT INTO bars')) bars.set(params[0], { id: params[0], name: params[2], is_default: params[3], created_at: '2026-01-01' });
          else if (q.startsWith('INSERT INTO bar_inventory')) { if (!inventory.has(params[0])) inventory.set(params[0], new Set()); inventory.get(params[0]).add(params[1]); }
          else if (q.startsWith('DELETE FROM bar_inventory')) inventory.get(params[0])?.delete(params[1]);
          else if (q.startsWith('UPDATE users SET settings')) users.get('u1').settings = params[0];
        },
      };
      return stmt;
    },
    async batch(statements) { for (const s of statements) await s._run(); },
  };
  const env = { speakeasy_db: db };
  const post = async (body) => (await onRequestPost({ request: new Request('https://example.com/api/sync', { method: 'POST', headers: { Cookie: 'speakeasy_session=t', 'Content-Type': 'application/json' }, body: JSON.stringify(body) }), env })).status;
  const get = async () => (await onRequestGet({ request: new Request('https://example.com/api/sync', { headers: { Cookie: 'speakeasy_session=t' } }), env })).json();
  const bar = (items) => [{ id: 'bar-1', name: 'Home Bar', isDefault: true, inventory: items }];

  // Three devices share a bar. The cloud already holds gin, rum and vodka.
  assert.equal(await post({ bars: bar(['gin', 'rum', 'vodka']) }), 200);
  assert.deepEqual(sorted(inventory.get('bar-1')), ['gin', 'rum', 'vodka']);

  // The laptop removes vodka on purpose and syncs.
  assert.equal(await post({ bars: bar(['gin', 'rum']), inventoryChanges: { 'bar-1': { removed: { vodka: Date.now() } } } }), 200);
  assert.deepEqual(sorted(inventory.get('bar-1')), ['gin', 'rum'], 'The removal reaches the cloud');

  // The phone, which never heard, syncs its old list, and an old app sends no records at all.
  assert.equal(await post({ bars: bar(['gin', 'rum', 'vodka']) }), 200);
  assert.equal(await post({ bars: bar(['gin', 'rum', 'vodka']), inventoryChanges: {} }), 200);
  assert.deepEqual(sorted(inventory.get('bar-1')), ['gin', 'rum'], 'A stale device cannot bring the bottle back');

  const backup = (await get()).backup;
  assert.deepEqual(sorted(backup.bars[0].inventory), ['gin', 'rum'], 'and the phone is handed the corrected list');
  assert.ok(backup.inventoryChanges['bar-1'].removed.vodka > 0, 'along with the removal record');
  assert.equal('inventorySync' in backup.settings, false, 'Bookkeeping stays out of the settings handed back');

  // Buying it again later brings it back everywhere.
  assert.equal(await post({ bars: bar(['gin', 'rum', 'vodka']), inventoryChanges: { 'bar-1': { added: { vodka: Date.now() + 1000 } } } }), 200);
  assert.deepEqual(sorted(inventory.get('bar-1')), ['gin', 'rum', 'vodka']);
  console.log('PASS: the server carries a removal to every device and refuses a stale re-add');
}

console.log('All inventory sync tests passed.');
process.exit(0);
