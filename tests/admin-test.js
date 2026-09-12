import assert from 'node:assert/strict';
import { onRequestPost as onRequestPostLogin } from '../functions/api/admin/login.js';
import { onRequestGet as onRequestGetMe } from '../functions/api/admin/me.js';
import { onRequestPost as onRequestPostLogout } from '../functions/api/admin/logout.js';
import { onRequestGet as onRequestGetRecipes, onRequestPost as onRequestPostRecipes, onRequestDelete as onRequestDeleteRecipes } from '../functions/api/admin/recipes.js';
import { onRequestPost as onRequestPostHide } from '../functions/api/admin/hide.js';

console.log('--- Testing /functions/api/admin/* Endpoints ---');

class MockD1 {
  constructor() {
    this.tables = {
      global_recipes: new Map(),
      global_hidden_recipes: new Map(),
      custom_recipes: new Map(),
      users: new Map(),
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

    // DELETE FROM global_hidden_recipes
    if (sql.includes('global_hidden_recipes') && sql.includes('DELETE')) {
      const [recipeId] = params;
      this.db.tables.global_hidden_recipes.delete(recipeId);
      return { results: [], success: true };
    }

    // DELETE FROM global_recipes
    if (sql.includes('global_recipes') && sql.includes('DELETE')) {
      const [id] = params;
      this.db.tables.global_recipes.delete(id);
      return { results: [], success: true };
    }

    // SELECT ... FROM global_recipes
    if (sql.includes('FROM global_recipes')) {
      const rows = Array.from(this.db.tables.global_recipes.values());
      return { results: rows, success: true };
    }

    // SELECT ... FROM global_hidden_recipes
    if (sql.includes('FROM global_hidden_recipes')) {
      const rows = Array.from(this.db.tables.global_hidden_recipes.values());
      return { results: rows, success: true };
    }

    // SELECT ... FROM custom_recipes
    if (sql.includes('FROM custom_recipes')) {
      const rows = Array.from(this.db.tables.custom_recipes.values());
      return { results: rows, success: true };
    }

    // INSERT INTO global_recipes
    if (sql.includes('INSERT INTO global_recipes')) {
      const [id, name, glassware, method, specs, instructions, description, notes, riff_of_id, riff_of_name, tags, published_by] = params;
      this.db.tables.global_recipes.set(id, {
        id, name, glassware, method, specs, instructions, description, notes, riff_of_id, riff_of_name, tags, published_by,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      return { results: [], success: true };
    }

    // INSERT INTO global_hidden_recipes
    if (sql.includes('global_hidden_recipes') && sql.includes('INSERT')) {
      const [recipeId, reason] = params;
      this.db.tables.global_hidden_recipes.set(recipeId, {
        recipe_id: recipeId,
        reason,
        hidden_at: new Date().toISOString(),
      });
      return { results: [], success: true };
    }

    throw new Error(`Unhandled mock query: ${sql}`);
  }
}

function createRequest(url, { method = 'GET', headers = {}, body = null } = {}) {
  const init = { method, headers: new Headers(headers) };
  if (body) {
    init.body = JSON.stringify(body);
  }
  return new Request(url, init);
}

async function testAdminFlow() {
  const db = new MockD1();
  const env = {
    speakeasy_db: db,
    ADMIN_PASSWORD: 'test-admin-secret',
    SESSION_SECRET: 'test-session-secret',
  };

  // 1. Unauthenticated request to /api/admin/me
  const unauthReq = createRequest('https://example.com/api/admin/me');
  const unauthRes = await onRequestGetMe({ request: unauthReq, env });
  assert.equal(unauthRes.status, 401, 'Unauthenticated request should return 401');

  // 2. Login with wrong password
  const failLoginReq = createRequest('https://example.com/api/admin/login', {
    method: 'POST',
    body: { password: 'wrong' },
  });
  const failLoginRes = await onRequestPostLogin({ request: failLoginReq, env });
  assert.equal(failLoginRes.status, 401, 'Wrong password should fail');

  // 3. Login with correct password
  const loginReq = createRequest('https://example.com/api/admin/login', {
    method: 'POST',
    body: { password: 'test-admin-secret' },
  });
  const loginRes = await onRequestPostLogin({ request: loginReq, env });
  assert.equal(loginRes.status, 200, 'Correct password should succeed');
  const setCookie = loginRes.headers.get('Set-Cookie');
  assert.ok(setCookie && setCookie.includes('speakeasy_admin_session='), 'Should return admin session cookie');

  // Extract session token
  const tokenMatch = setCookie.match(/speakeasy_admin_session=([^;]+)/);
  const cookieHeader = `speakeasy_admin_session=${tokenMatch[1]}`;

  // 4. Authenticated request to /api/admin/me
  const authReq = createRequest('https://example.com/api/admin/me', {
    headers: { Cookie: cookieHeader },
  });
  const authRes = await onRequestGetMe({ request: authReq, env });
  assert.equal(authRes.status, 200, 'Authenticated request to /me should succeed');

  // 5. Promote custom cocktail to global
  const newDrink = {
    id: 'midnight-riff',
    name: 'Midnight Riff',
    glassware: 'Coupe',
    method: 'Stirred',
    specs: [{ amount: 2, unit: 'oz', name: 'Rye Whiskey' }],
    instructions: 'Stir with ice and strain.',
    tags: ['craft', 'slow-sipper'],
  };
  const promoteReq = createRequest('https://example.com/api/admin/recipes', {
    method: 'POST',
    headers: { Cookie: cookieHeader },
    body: newDrink,
  });
  const promoteRes = await onRequestPostRecipes({ request: promoteReq, env });
  assert.equal(promoteRes.status, 200, 'Promoting recipe should succeed');
  assert.equal(db.tables.global_recipes.size, 1, 'global_recipes should contain 1 drink');

  // 6. Query /api/admin/recipes
  const listReq = createRequest('https://example.com/api/admin/recipes', {
    headers: { Cookie: cookieHeader },
  });
  const listRes = await onRequestGetRecipes({ request: listReq, env });
  assert.equal(listRes.status, 200);
  const listData = await listRes.json();
  assert.equal(listData.globalRecipes.length, 1);
  assert.equal(listData.globalRecipes[0].name, 'Midnight Riff');

  // 7. Hide a canonical recipe from global library
  const hideReq = createRequest('https://example.com/api/admin/hide', {
    method: 'POST',
    headers: { Cookie: cookieHeader },
    body: { recipeId: 'old-fashioned', hide: true, reason: 'Temporarily disabled' },
  });
  const hideRes = await onRequestPostHide({ request: hideReq, env });
  assert.equal(hideRes.status, 200);
  assert.equal(db.tables.global_hidden_recipes.size, 1);
  assert.ok(db.tables.global_hidden_recipes.has('old-fashioned'));

  // 8. Unhide the recipe
  const unhideReq = createRequest('https://example.com/api/admin/hide', {
    method: 'POST',
    headers: { Cookie: cookieHeader },
    body: { recipeId: 'old-fashioned', hide: false },
  });
  const unhideRes = await onRequestPostHide({ request: unhideReq, env });
  assert.equal(unhideRes.status, 200);
  assert.equal(db.tables.global_hidden_recipes.size, 0);

  // 9. Delete custom recipe from global
  const deleteReq = createRequest('https://example.com/api/admin/recipes?id=midnight-riff', {
    method: 'DELETE',
    headers: { Cookie: cookieHeader },
  });
  const deleteRes = await onRequestDeleteRecipes({ request: deleteReq, env });
  assert.equal(deleteRes.status, 200);
  assert.equal(db.tables.global_recipes.size, 0);

  // 10. Logout
  const logoutReq = createRequest('https://example.com/api/admin/logout', {
    method: 'POST',
    headers: { Cookie: cookieHeader },
  });
  const logoutRes = await onRequestPostLogout({ request: logoutReq, env });
  assert.equal(logoutRes.status, 200);
  const clearCookie = logoutRes.headers.get('Set-Cookie');
  assert.ok(clearCookie.includes('Max-Age=0'));

  console.log('PASS: All Admin Endpoints verified successfully!');
}

testAdminFlow().catch(err => {
  console.error('FAIL:', err);
  process.exit(1);
});
