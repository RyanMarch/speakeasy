import assert from 'node:assert/strict';
import { onRequestPost, onRequestGet } from '../functions/api/sync.js';

console.log('--- Testing /functions/api/sync.js Endpoint ---');

// In-memory mock SQLite D1 database engine
class MockD1 {
  constructor() {
    this.tables = {
      users: new Map(),
      sessions: new Map(),
      bars: new Map(),
      bar_inventory: new Map(),
      custom_recipes: new Map(),
      drink_history: new Map(),
    };
  }

  prepare(sql) {
    return new MockD1PreparedStatement(this, sql);
  }

  async batch(statements) {
    const results = [];
    for (const stmt of statements) {
      results.push(await stmt.run());
    }
    return results;
  }
}

class MockD1PreparedStatement {
  constructor(db, sql) {
    this.db = db;
    this.sql = sql.trim();
    this.boundParams = [];
  }

  bind(...params) {
    this.boundParams = params;
    return this;
  }

  async first() {
    const res = await this.all();
    return res.results[0] || null;
  }

  async run() {
    return this.all();
  }

  async all() {
    const sql = this.sql;
    const params = this.boundParams;

    // SELECT user_id, expires_at FROM sessions WHERE token = ?
    if (sql.startsWith('SELECT user_id, expires_at FROM sessions WHERE token = ?')) {
      const [token] = params;
      const session = this.db.tables.sessions.get(token);
      return {
        results: session ? [{ user_id: session.user_id, expires_at: session.expires_at }] : [],
        success: true,
      };
    }

    // SELECT id FROM bars WHERE user_id = ? ... or SELECT id, name, is_default[, created_at] FROM bars WHERE user_id = ? ...
    if (sql.includes('FROM bars WHERE user_id = ?')) {
      const [userId] = params;
      const bars = Array.from(this.db.tables.bars.values())
        .filter(b => b.user_id === userId)
        .sort((a, b) => (b.is_default - a.is_default) || a.created_at.localeCompare(b.created_at));
      const limitOne = sql.includes('LIMIT 1');
      const rows = limitOne ? (bars.length > 0 ? [bars[0]] : []) : bars;
      return {
        results: rows.map(b => ({ id: b.id, name: b.name, is_default: b.is_default, created_at: b.created_at })),
        success: true,
      };
    }

    // UPDATE bars SET is_default = 1 WHERE id = ?
    if (sql.startsWith('UPDATE bars SET is_default = 1 WHERE id = ?')) {
      const [id] = params;
      const bar = this.db.tables.bars.get(id);
      if (bar) bar.is_default = 1;
      return { results: [], success: true };
    }

    // DELETE FROM bars WHERE id = ?
    if (sql.startsWith('DELETE FROM bars WHERE id = ?')) {
      const [id] = params;
      this.db.tables.bars.delete(id);
      for (const key of Array.from(this.db.tables.bar_inventory.keys())) {
        if (key.startsWith(`${id}:`)) this.db.tables.bar_inventory.delete(key);
      }
      return { results: [], success: true };
    }

    // Dedupe copy: INSERT INTO bar_inventory (...) SELECT ?, ingredient_id, is_low_stock FROM bar_inventory WHERE bar_id = ? ON CONFLICT...
    if (sql.startsWith('INSERT INTO bar_inventory') && sql.includes('SELECT')) {
      const [canonicalId, sourceBarId] = params;
      const sourceRows = Array.from(this.db.tables.bar_inventory.values()).filter(i => i.bar_id === sourceBarId);
      for (const row of sourceRows) {
        const key = `${canonicalId}:${row.ingredient_id}`;
        if (!this.db.tables.bar_inventory.has(key)) {
          this.db.tables.bar_inventory.set(key, { bar_id: canonicalId, ingredient_id: row.ingredient_id, is_low_stock: row.is_low_stock });
        }
      }
      return { results: [], success: true };
    }

    // Multi-bar upsert: INSERT INTO bars (id, user_id, name, is_default) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET ...
    if (sql.startsWith('INSERT INTO bars') && sql.includes('ON CONFLICT')) {
      const [id, userId, name, isDefault] = params;
      const existing = this.db.tables.bars.get(id);
      if (existing && existing.user_id === userId) {
        existing.name = name;
        existing.is_default = isDefault;
      } else {
        this.db.tables.bars.set(id, { id, user_id: userId, name, is_default: isDefault, created_at: new Date().toISOString() });
      }
      return { results: [], success: true };
    }

    // Legacy default-bar creation: INSERT INTO bars (id, user_id, name, is_default) VALUES (?, ?, 'Home Bar', 1)
    if (sql.startsWith('INSERT INTO bars')) {
      const [id, userId] = params;
      const bar = { id, user_id: userId, name: 'Home Bar', is_default: 1, created_at: new Date().toISOString() };
      this.db.tables.bars.set(id, bar);
      return { results: [], success: true };
    }

    // INSERT INTO bar_inventory (bar_id, ingredient_id, is_low_stock) VALUES (?, ?, 0)
    if (sql.startsWith('INSERT INTO bar_inventory')) {
      const [barId, ingredientId] = params;
      const key = `${barId}:${ingredientId}`;
      if (!this.db.tables.bar_inventory.has(key)) {
        this.db.tables.bar_inventory.set(key, { bar_id: barId, ingredient_id: ingredientId, is_low_stock: 0 });
      }
      return { results: [], success: true };
    }

    // INSERT INTO custom_recipes ...
    if (sql.startsWith('INSERT INTO custom_recipes')) {
      const [
        id, userId, name, glassware, method, specs, instructions,
        description, notes, riffOfId, riffOfName, tags, isPublic
      ] = params;
      const recipe = {
        id,
        user_id: userId,
        name,
        glassware,
        method,
        specs,
        instructions,
        description,
        notes,
        riff_of_id: riffOfId,
        riff_of_name: riffOfName,
        tags,
        is_public: isPublic,
        updated_at: new Date().toISOString(),
      };
      this.db.tables.custom_recipes.set(id, recipe);
      return { results: [], success: true };
    }

    // SELECT ingredient_id FROM bar_inventory WHERE bar_id = ?
    if (sql.startsWith('SELECT ingredient_id FROM bar_inventory WHERE bar_id = ?')) {
      const [barId] = params;
      const rows = Array.from(this.db.tables.bar_inventory.values())
        .filter(item => item.bar_id === barId)
        .map(item => ({ ingredient_id: item.ingredient_id }));
      return { results: rows, success: true };
    }

    // SELECT id, name, glassware, method, specs, instructions, description, notes, riff_of_id, riff_of_name, tags, is_public FROM custom_recipes WHERE user_id = ?
    if (sql.includes('FROM custom_recipes WHERE user_id = ?')) {
      const [userId] = params;
      const rows = Array.from(this.db.tables.custom_recipes.values())
        .filter(r => r.user_id === userId);
      return { results: rows, success: true };
    }

    // SELECT settings FROM users WHERE id = ?
    if (sql.startsWith('SELECT settings FROM users WHERE id = ?')) {
      const [userId] = params;
      const user = this.db.tables.users.get(userId);
      return { results: user ? [{ settings: user.settings }] : [], success: true };
    }

    // UPDATE users SET settings = ? WHERE id = ?
    if (sql.startsWith('UPDATE users SET settings = ? WHERE id = ?')) {
      const [settings, userId] = params;
      const user = this.db.tables.users.get(userId);
      if (user) {
        user.settings = settings;
      }
      return { results: [], success: true };
    }

    throw new Error(`Unhandled SQL query in mock: ${sql}`);
  }
}

// Helper to construct mock Request
function createMockRequest({ method = 'POST', headers = {}, body = null }) {
  return new Request('https://example.com/api/sync', {
    method,
    headers: new Headers(headers),
    body: body ? JSON.stringify(body) : null,
  });
}

// Seed test DB
const db = new MockD1();
db.tables.users.set('user-123', {
  id: 'user-123',
  email: 'ryan@example.com',
  display_name: 'Ryan',
  settings: '{"unitPref":"oz"}',
});
db.tables.sessions.set('valid-token', {
  token: 'valid-token',
  user_id: 'user-123',
  expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
});
db.tables.sessions.set('expired-token', {
  token: 'expired-token',
  user_id: 'user-123',
  expires_at: new Date(Date.now() - 3600 * 1000).toISOString(),
});

// Test 1: Missing DB binding
{
  const req = createMockRequest({ headers: { Authorization: 'Bearer valid-token' }, body: {} });
  const res = await onRequestPost({ request: req, env: {} });
  assert.equal(res.status, 500);
  const data = await res.json();
  assert.match(data.error, /Database binding/);
  console.log('PASS: Rejects request if DB binding is missing');
}

// Test 2: Missing or invalid token
{
  const reqNoAuth = createMockRequest({ body: {} });
  const resNoAuth = await onRequestPost({ request: reqNoAuth, env: { speakeasy_db: db } });
  assert.equal(resNoAuth.status, 401);

  const reqInvalid = createMockRequest({ headers: { Authorization: 'Bearer bogus-token' }, body: {} });
  const resInvalid = await onRequestPost({ request: reqInvalid, env: { speakeasy_db: db } });
  assert.equal(resInvalid.status, 401);

  const reqExpired = createMockRequest({ headers: { Authorization: 'Bearer expired-token' }, body: {} });
  const resExpired = await onRequestPost({ request: reqExpired, env: { speakeasy_db: db } });
  assert.equal(resExpired.status, 401);
  console.log('PASS: Session authentication validation');
}

// Test 3: Successful sync with default Home Bar creation, inventory, custom recipes, and settings update
{
  const syncPayload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    inventory: ['gin', 'campari', 'sweet_vermouth'],
    settings: {
      unitPref: 'ml',
      sortPref: 'name-asc',
      glassViewMode: 'blended',
    },
    customRecipes: [
      {
        id: 'user-martini',
        name: 'House Martini',
        glassware: 'Coupe',
        method: 'Stirred',
        specs: [{ amount: 2, unit: 'oz', name: 'Gin' }],
        instructions: 'Stir with ice and strain into a chilled coupe.',
        tags: ['classic', 'gin'],
      },
    ],
  };

  const req = createMockRequest({
    headers: { Authorization: 'Bearer valid-token', 'Content-Type': 'application/json' },
    body: syncPayload,
  });

  const res = await onRequestPost({ request: req, env: { speakeasy_db: db } });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.equal(data.imported.recipes, 1);
  assert.equal(data.imported.inventory, 3);

  // Verify DB state
  // Default Home Bar created
  const bars = Array.from(db.tables.bars.values()).filter(b => b.user_id === 'user-123');
  assert.equal(bars.length, 1);
  assert.equal(bars[0].name, 'Home Bar');
  assert.equal(bars[0].is_default, 1);

  // Bar inventory inserted
  const inventoryItems = Array.from(db.tables.bar_inventory.values()).filter(i => i.bar_id === bars[0].id);
  assert.equal(inventoryItems.length, 3);
  const ingredientIds = inventoryItems.map(i => i.ingredient_id);
  assert.ok(ingredientIds.includes('gin'));
  assert.ok(ingredientIds.includes('campari'));
  assert.ok(ingredientIds.includes('sweet_vermouth'));

  // Custom recipe inserted
  const customRecipe = db.tables.custom_recipes.get('user-martini');
  assert.ok(customRecipe);
  assert.equal(customRecipe.name, 'House Martini');
  assert.equal(customRecipe.user_id, 'user-123');

  // User settings updated
  const user = db.tables.users.get('user-123');
  assert.deepEqual(JSON.parse(user.settings), {
    unitPref: 'ml',
    sortPref: 'name-asc',
    glassViewMode: 'blended',
  });

  console.log('PASS: Successful sync and hydration verification');
}

// Test 4: Successful GET /api/sync returns user's cloud inventory, custom recipes, and settings
{
  const req = createMockRequest({
    method: 'GET',
    headers: { Authorization: 'Bearer valid-token' },
  });

  const res = await onRequestGet({ request: req, env: { speakeasy_db: db } });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.ok(data.backup);
  assert.equal(data.backup.version, 2);
  assert.equal(data.backup.bars.length, 1);
  const defaultBar = data.backup.bars[0];
  assert.equal(defaultBar.name, 'Home Bar');
  assert.equal(defaultBar.isDefault, true);
  assert.equal(defaultBar.inventory.length, 3);
  assert.ok(defaultBar.inventory.includes('gin'));
  assert.ok(defaultBar.inventory.includes('campari'));
  assert.ok(defaultBar.inventory.includes('sweet_vermouth'));
  assert.equal(data.backup.customRecipes.length, 1);
  assert.equal(data.backup.customRecipes[0].name, 'House Martini');
  assert.equal(data.backup.customRecipes[0].glassware, 'Coupe');
  assert.equal(data.backup.settings.unitPref, 'ml');
  assert.equal(data.backup.settings.sortPref, 'name-asc');
  assert.equal(data.backup.settings.glassViewMode, 'blended');

  console.log('PASS: GET /api/sync returns cloud backup payload for authenticated user');
}

// Test 5: Multi-bar POST payload creates/updates multiple bars, and GET returns all of them
{
  const homeBarId = Array.from(db.tables.bars.values()).find(b => b.user_id === 'user-123' && b.is_default)?.id;

  const multiBarPayload = {
    version: 2,
    exportedAt: new Date().toISOString(),
    bars: [
      { id: homeBarId, name: 'Home Bar', isDefault: true, inventory: ['gin', 'campari', 'sweet_vermouth', 'lemon_juice'] },
      { id: 'bar-tiki', name: 'Tiki Cart', isDefault: false, inventory: ['light_rum', 'lime_juice'] },
    ],
    customRecipes: [],
  };

  const req = createMockRequest({
    headers: { Authorization: 'Bearer valid-token', 'Content-Type': 'application/json' },
    body: multiBarPayload,
  });

  const res = await onRequestPost({ request: req, env: { speakeasy_db: db } });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.equal(data.imported.bars, 2);
  assert.equal(data.imported.inventory, 6);

  const bars = Array.from(db.tables.bars.values()).filter(b => b.user_id === 'user-123');
  assert.equal(bars.length, 2);

  const getReq = createMockRequest({ method: 'GET', headers: { Authorization: 'Bearer valid-token' } });
  const getRes = await onRequestGet({ request: getReq, env: { speakeasy_db: db } });
  const getData = await getRes.json();
  assert.equal(getData.backup.bars.length, 2);

  const tikiBar = getData.backup.bars.find(b => b.id === 'bar-tiki');
  assert.ok(tikiBar);
  assert.equal(tikiBar.name, 'Tiki Cart');
  assert.equal(tikiBar.isDefault, false);
  assert.equal(tikiBar.inventory.length, 2);
  assert.ok(tikiBar.inventory.includes('light_rum'));

  const homeBar = getData.backup.bars.find(b => b.id === homeBarId);
  assert.ok(homeBar);
  assert.equal(homeBar.inventory.length, 4);
  assert.ok(homeBar.inventory.includes('lemon_juice'));

  console.log('PASS: Multi-bar POST payload upserts bars and GET returns all of them');
}

// Test 6: GET repairs a pre-existing single-bar account left with two rows
// both literally named "Home Bar" (the exact early-rollout data issue where
// a locally re-migrated bar and the account's real cloud default bar had
// different ids and got pushed as two separate rows) — should self-heal
// into a single merged bar on the very next GET.
{
  db.tables.sessions.set('dupe-token', {
    token: 'dupe-token',
    user_id: 'user-dupe',
    expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
  });
  db.tables.users.set('user-dupe', { id: 'user-dupe', email: 'dupe@example.com', display_name: 'Dupe', settings: null });

  const olderBar = { id: 'bar-original', user_id: 'user-dupe', name: 'Home Bar', is_default: 0, created_at: new Date(Date.now() - 60000).toISOString() };
  const newerBar = { id: 'bar-freshly-migrated', user_id: 'user-dupe', name: 'Home Bar', is_default: 1, created_at: new Date().toISOString() };
  db.tables.bars.set(olderBar.id, olderBar);
  db.tables.bars.set(newerBar.id, newerBar);
  db.tables.bar_inventory.set('bar-original:gin', { bar_id: 'bar-original', ingredient_id: 'gin', is_low_stock: 0 });
  db.tables.bar_inventory.set('bar-original:campari', { bar_id: 'bar-original', ingredient_id: 'campari', is_low_stock: 0 });
  db.tables.bar_inventory.set('bar-freshly-migrated:campari', { bar_id: 'bar-freshly-migrated', ingredient_id: 'campari', is_low_stock: 0 });
  db.tables.bar_inventory.set('bar-freshly-migrated:sweet_vermouth', { bar_id: 'bar-freshly-migrated', ingredient_id: 'sweet_vermouth', is_low_stock: 0 });

  const req = createMockRequest({ method: 'GET', headers: { Authorization: 'Bearer dupe-token' } });
  const res = await onRequestGet({ request: req, env: { speakeasy_db: db } });
  assert.equal(res.status, 200);
  const data = await res.json();

  assert.equal(data.backup.bars.length, 1);
  const survivor = data.backup.bars[0];
  assert.equal(survivor.name, 'Home Bar');
  assert.equal(survivor.id, 'bar-original', 'Expected the older row to survive as canonical');
  assert.equal(survivor.isDefault, true, 'Expected the surviving bar to end up marked default');
  assert.equal(survivor.inventory.length, 3);
  assert.ok(survivor.inventory.includes('gin'));
  assert.ok(survivor.inventory.includes('campari'));
  assert.ok(survivor.inventory.includes('sweet_vermouth'));

  const remainingRows = Array.from(db.tables.bars.values()).filter(b => b.user_id === 'user-dupe');
  assert.equal(remainingRows.length, 1, 'Expected the duplicate row to be deleted from the database');

  console.log('PASS: GET repairs duplicate "Home Bar" rows into a single merged bar');
}

console.log('All /functions/api/sync.js tests passed successfully!');

