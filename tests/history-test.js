import assert from 'node:assert/strict';
import { onRequestPost as onRequestPostLog } from '../functions/api/history/log.js';
import { onRequestGet as onRequestGetList } from '../functions/api/history/list.js';
import * as historyClient from '../js/modules/history.js';

console.log('--- Testing /functions/api/history/* and js/modules/history.js ---');

class MockD1 {
  constructor() {
    this.tables = {
      users: new Map(),
      sessions: new Map(),
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

    // INSERT INTO drink_history (id, user_id, recipe_id, made_at) VALUES (?, ?, ?, ?)
    if (sql.startsWith('INSERT INTO drink_history')) {
      const [id, userId, recipeId, madeAt] = params;
      const record = { id, user_id: userId, recipe_id: recipeId, made_at: madeAt };
      this.db.tables.drink_history.set(id, record);
      return { results: [], success: true };
    }

    // SELECT id, recipe_id, made_at FROM drink_history WHERE user_id = ? ORDER BY made_at DESC LIMIT ?
    if (sql.startsWith('SELECT id, recipe_id, made_at FROM drink_history WHERE user_id = ?')) {
      const [userId, limit] = params;
      const matching = Array.from(this.db.tables.drink_history.values())
        .filter(entry => entry.user_id === userId)
        .sort((a, b) => new Date(b.made_at).getTime() - new Date(a.made_at).getTime())
        .slice(0, limit);
      return {
        results: matching,
        success: true,
      };
    }

    throw new Error(`Unhandled SQL in MockD1: ${sql}`);
  }
}

function createMockRequest({ url = 'https://example.com/api/history', method = 'GET', headers = {}, body = null }) {
  return new Request(url, {
    method,
    headers: new Headers(headers),
    body: body ? JSON.stringify(body) : null,
  });
}

const db = new MockD1();
const env = { speakeasy_db: db };

// Seed test session
db.tables.users.set('user-1', { id: 'user-1', email: 'ryan@example.com' });
db.tables.sessions.set('valid-token', {
  token: 'valid-token',
  user_id: 'user-1',
  expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
});
db.tables.sessions.set('expired-token', {
  token: 'expired-token',
  user_id: 'user-1',
  expires_at: new Date(Date.now() - 3600 * 1000).toISOString(),
});

// 1. Test POST /api/history/log authentication and error cases
{
  // Missing DB
  const resNoDb = await onRequestPostLog({ request: createMockRequest({ method: 'POST', body: { recipeId: 'negroni' } }), env: {} });
  assert.equal(resNoDb.status, 500);

  // Missing Authorization header
  const resNoAuth = await onRequestPostLog({
    request: createMockRequest({ method: 'POST', body: { recipeId: 'negroni' } }),
    env,
  });
  assert.equal(resNoAuth.status, 401);

  // Expired token
  const resExpired = await onRequestPostLog({
    request: createMockRequest({
      method: 'POST',
      headers: { Authorization: 'Bearer expired-token' },
      body: { recipeId: 'negroni' },
    }),
    env,
  });
  assert.equal(resExpired.status, 401);

  // Invalid body (missing recipeId)
  const resNoRecipe = await onRequestPostLog({
    request: createMockRequest({
      method: 'POST',
      headers: { Authorization: 'Bearer valid-token' },
      body: {},
    }),
    env,
  });
  assert.equal(resNoRecipe.status, 400);

  console.log('PASS: /api/history/log auth and validation guards');
}

// 2. Test POST /api/history/log success
let loggedEntry1 = null;
let loggedEntry2 = null;
{
  const req1 = createMockRequest({
    method: 'POST',
    headers: { Authorization: 'Bearer valid-token' },
    body: { recipeId: 'negroni', madeAt: '2026-09-10T12:00:00.000Z' },
  });
  const res1 = await onRequestPostLog({ request: req1, env });
  assert.equal(res1.status, 200);
  const data1 = await res1.json();
  assert.equal(data1.success, true);
  assert.equal(data1.entry.recipeId, 'negroni');
  assert.equal(data1.entry.madeAt, '2026-09-10T12:00:00.000Z');
  assert.ok(data1.entry.id);
  loggedEntry1 = data1.entry;

  // Second entry with later timestamp
  const req2 = createMockRequest({
    method: 'POST',
    headers: { Authorization: 'Bearer valid-token' },
    body: { recipeId: 'manhattan', madeAt: '2026-09-10T14:00:00.000Z' },
  });
  const res2 = await onRequestPostLog({ request: req2, env });
  assert.equal(res2.status, 200);
  const data2 = await res2.json();
  assert.equal(data2.entry.recipeId, 'manhattan');
  loggedEntry2 = data2.entry;

  console.log('PASS: /api/history/log successfully inserts records');
}

// 3. Test GET /api/history/list chronological descending ordering
{
  const reqList = createMockRequest({
    url: 'https://example.com/api/history/list?limit=10',
    method: 'GET',
    headers: { Authorization: 'Bearer valid-token' },
  });
  const resList = await onRequestGetList({ request: reqList, env });
  assert.equal(resList.status, 200);
  const data = await resList.json();
  assert.ok(Array.isArray(data.history));
  assert.equal(data.history.length, 2);
  // Most recent first: manhattan (14:00) before negroni (12:00)
  assert.equal(data.history[0].recipeId, 'manhattan');
  assert.equal(data.history[1].recipeId, 'negroni');

  console.log('PASS: /api/history/list returns chronological descending results');
}

// 4. Test client-side history module (js/modules/history.js) in Guest Mode
{
  // Setup mock localStorage in Node global environment
  const store = new Map();
  global.localStorage = {
    getItem: (key) => store.get(key) || null,
    setItem: (key, val) => store.set(key, String(val)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear(),
  };

  let eventDispatched = false;
  let eventDetail = null;
  global.window = {
    dispatchEvent: (ev) => {
      if (ev.type === historyClient.HISTORY_UPDATED_EVENT) {
        eventDispatched = true;
        eventDetail = ev.detail;
      }
    },
  };
  global.CustomEvent = class {
    constructor(type, init = {}) {
      this.type = type;
      this.detail = init.detail;
    }
  };

  // Guest log: no token in localStorage
  const entry = await historyClient.logDrinkMade('daiquiri', '2026-09-10T16:00:00.000Z');
  assert.equal(entry.recipeId, 'daiquiri');
  assert.equal(eventDispatched, true);
  assert.equal(eventDetail.entry.recipeId, 'daiquiri');

  const history = historyClient.getDrinkHistory(10);
  assert.equal(history.length, 1);
  assert.equal(history[0].recipeId, 'daiquiri');

  // Log another drink
  await historyClient.logDrinkMade('margarita', '2026-09-10T17:00:00.000Z');
  const history2 = historyClient.getDrinkHistory(10);
  assert.equal(history2.length, 2);
  assert.equal(history2[0].recipeId, 'margarita');
  assert.equal(history2[1].recipeId, 'daiquiri');

  console.log('PASS: Client-side guest mode history logging and chronological retrieval');
}

// 5. Test syncLocalHistoryToCloud
{
  let uploadedPosts = [];
  global.fetch = async (url, options = {}) => {
    if (url.includes('/api/history/list')) {
      return {
        ok: true,
        json: async () => ({ history: [] }),
      };
    }
    if (url.includes('/api/history/log')) {
      const parsedBody = JSON.parse(options.body);
      uploadedPosts.push(parsedBody);
      return {
        ok: true,
        json: async () => ({
          success: true,
          entry: { id: `cloud-${parsedBody.recipeId}`, ...parsedBody },
        }),
      };
    }
    return { ok: false };
  };

  // Set auth token to simulate logged in user
  global.localStorage.setItem('speakeasy_auth_token', 'mock-session-token');

  const syncResult = await historyClient.syncLocalHistoryToCloud();
  assert.equal(syncResult.syncedCount, 2);
  assert.equal(uploadedPosts.length, 2);
  assert.ok(uploadedPosts.some(p => p.recipeId === 'daiquiri'));
  assert.ok(uploadedPosts.some(p => p.recipeId === 'margarita'));

  console.log('PASS: syncLocalHistoryToCloud uploads local guest entries upon login');
}

console.log('All Drink History tests passed successfully!');
