import assert from 'node:assert/strict';
import { onRequestPost } from '../functions/api/sync.js';

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

    // SELECT id FROM bars WHERE user_id = ? ...
    if (sql.startsWith('SELECT id FROM bars WHERE user_id = ?')) {
      const [userId] = params;
      const bars = Array.from(this.db.tables.bars.values())
        .filter(b => b.user_id === userId)
        .sort((a, b) => (b.is_default - a.is_default) || a.created_at.localeCompare(b.created_at));
      return {
        results: bars.length > 0 ? [{ id: bars[0].id }] : [],
        success: true,
      };
    }

    // INSERT INTO bars (id, user_id, name, is_default) VALUES (?, ?, 'Home Bar', 1)
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

console.log('All /functions/api/sync.js tests passed successfully!');
