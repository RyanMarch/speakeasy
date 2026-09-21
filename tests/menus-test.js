import assert from 'node:assert/strict';
import { onRequestPost } from '../functions/api/menus/index.js';
import { onRequestGet, onRequestPut, onRequestDelete } from '../functions/api/menus/[id].js';
import { onRequestGet as onRequestGetMenuPage } from '../functions/menu/[id].js';
import { parseMenuCode } from '../js/modules/menu-publish.js';

console.log('--- Testing /functions/api/menus/* Endpoints ---');

const MENU_ID_PATTERN = /^[23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]{10}$/;

// In-memory mock D1, scoped to the `menus` table. UPDATE is interpreted from
// its SET clause so the test exercises the real partial-update SQL.
class MockD1 {
  constructor() {
    this.menus = new Map();
  }

  prepare(sql) {
    return new MockStatement(this, sql);
  }
}

class MockStatement {
  constructor(db, sql) {
    this.db = db;
    this.sql = sql.trim();
    this.params = [];
  }

  bind(...params) {
    this.params = params;
    return this;
  }

  async first() {
    const sql = this.sql;
    if (sql.startsWith('SELECT') && sql.includes('FROM menus WHERE menu_id = ?')) {
      return this.db.menus.get(this.params[0]) || null;
    }
    throw new Error(`Unhandled SQL in mock (first): ${sql}`);
  }

  async run() {
    const sql = this.sql;
    const params = this.params;
    if (sql.startsWith('INSERT INTO menus')) {
      const [menuId, hash, name, recipes, unavailable] = params;
      if (this.db.menus.has(menuId)) throw new Error('UNIQUE constraint failed: menus.menu_id');
      this.db.menus.set(menuId, {
        menu_id: menuId, edit_token_hash: hash, name, recipes, unavailable, updated_at: 'now',
      });
      return { success: true };
    }
    if (sql.startsWith('UPDATE menus SET')) {
      const setClause = sql.slice('UPDATE menus SET '.length, sql.indexOf(' WHERE'));
      const columns = setClause.split(', ').map(part => part.split(' = ')[0]);
      const menuId = params[params.length - 1];
      const row = this.db.menus.get(menuId);
      let i = 0;
      for (const column of columns) {
        if (column === 'updated_at') row.updated_at = 'later';
        else row[column] = params[i++];
      }
      return { success: true };
    }
    if (sql.startsWith('DELETE FROM menus')) {
      this.db.menus.delete(params[0]);
      return { success: true };
    }
    throw new Error(`Unhandled SQL in mock (run): ${sql}`);
  }
}

const jsonRequest = (method, body, token) => new Request('https://example.com/api/menus', {
  method,
  headers: new Headers({
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }),
  body: body === undefined ? undefined : JSON.stringify(body),
});

const drink = (id, name, extra = {}) => ({
  id,
  name,
  glassware: 'Coupe',
  method: 'Shaken',
  specs: [{ amount: 2, unit: 'oz', name: 'Gin' }],
  ...extra,
});

const db = new MockD1();
const env = { speakeasy_db: db };

// Test 1: publishing returns a link, a one-time token, and stores only the token's hash
let menuId;
let token;
{
  const res = await onRequestPost({
    request: jsonRequest('POST', {
      name: '  Friday Night  ',
      recipes: [
        drink('negroni', 'Negroni', { notes: 'my private note', description: 'Bitter and bold.' }),
        drink('custom-1', 'House Riff'),
        drink('negroni', 'Duplicate Negroni'),
        { id: 'no-name' },
      ],
      unavailable: ['custom-1', 'not-on-the-menu'],
    }),
    env,
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.match(data.menuId, MENU_ID_PATTERN);
  assert.equal(data.url, `https://example.com/menu/${data.menuId}`);
  assert.ok(data.editToken && data.editToken.length >= 24, 'Expected an edit token');
  menuId = data.menuId;
  token = data.editToken;

  const row = db.menus.get(menuId);
  assert.notEqual(row.edit_token_hash, token, 'The token must be stored hashed, never raw');
  assert.equal(row.name, 'Friday Night');
  const stored = JSON.parse(row.recipes);
  assert.deepEqual(stored.map(r => r.id), ['negroni', 'custom-1'], 'Expected duplicates and nameless recipes dropped');
  assert.equal(stored[0].notes, '', "The host's private notes must never be published");
  assert.equal(stored[0].description, 'Bitter and bold.');
  assert.deepEqual(JSON.parse(row.unavailable), ['custom-1'], 'Expected unknown ids pruned from the out list');
  console.log('PASS: POST /api/menus publishes a sanitized snapshot and stores only a token hash');
}

// Test 2: validation
{
  const empty = await onRequestPost({ request: jsonRequest('POST', { name: 'X', recipes: [] }), env });
  assert.equal(empty.status, 400);
  const badJson = await onRequestPost({
    request: new Request('https://example.com/api/menus', { method: 'POST', body: '{nope' }),
    env,
  });
  assert.equal(badJson.status, 400);
  const noDb = await onRequestPost({ request: jsonRequest('POST', { recipes: [drink('a', 'A')] }), env: {} });
  assert.equal(noDb.status, 500);
  console.log('PASS: POST /api/menus rejects empty menus, bad JSON, and a missing database');
}

// Test 3: guests can read it, and never receive the token hash
{
  const res = await onRequestGet({ params: { id: menuId }, env });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('Cache-Control'), 'no-store');
  const data = await res.json();
  assert.equal(data.menu.name, 'Friday Night');
  assert.equal(data.menu.recipes.length, 2);
  assert.deepEqual(data.menu.unavailable, ['custom-1']);
  assert.ok(!JSON.stringify(data).includes(db.menus.get(menuId).edit_token_hash), 'Public GET must not leak the token hash');

  const missing = await onRequestGet({ params: { id: 'ZZZZZZZZZZ' }, env });
  assert.equal(missing.status, 404);
  const malformed = await onRequestGet({ params: { id: 'bad id!' }, env });
  assert.equal(malformed.status, 404);
  console.log('PASS: GET /api/menus/:id serves the guest view uncached, without credentials');
}

// Test 4: only the token holder can change it
{
  const noToken = await onRequestPut({ params: { id: menuId }, request: jsonRequest('PUT', { unavailable: [] }), env });
  assert.equal(noToken.status, 403);
  const wrong = await onRequestPut({ params: { id: menuId }, request: jsonRequest('PUT', { unavailable: [] }, 'wrong-token'), env });
  assert.equal(wrong.status, 403);
  assert.deepEqual(JSON.parse(db.menus.get(menuId).unavailable), ['custom-1'], 'A rejected update must change nothing');
  const wrongDelete = await onRequestDelete({ params: { id: menuId }, request: jsonRequest('DELETE', undefined, 'wrong-token'), env });
  assert.equal(wrongDelete.status, 403);
  assert.ok(db.menus.has(menuId));
  console.log('PASS: PUT/DELETE require the edit token');
}

// Test 5: partial updates
{
  const toggle = await onRequestPut({ params: { id: menuId }, request: jsonRequest('PUT', { unavailable: ['negroni', 'custom-1'] }, token), env });
  assert.equal(toggle.status, 200);
  assert.deepEqual(JSON.parse(db.menus.get(menuId).unavailable), ['negroni', 'custom-1']);
  assert.equal(JSON.parse(db.menus.get(menuId).recipes).length, 2, 'An availability toggle must not touch the recipes');

  // Replacing the drinks prunes the out list of drinks that are gone.
  const swap = await onRequestPut({
    params: { id: menuId },
    request: jsonRequest('PUT', { name: 'Saturday', recipes: [drink('negroni', 'Negroni'), drink('daiquiri', 'Daiquiri')] }, token),
    env,
  });
  assert.equal(swap.status, 200);
  const row = db.menus.get(menuId);
  assert.equal(row.name, 'Saturday');
  assert.deepEqual(JSON.parse(row.recipes).map(r => r.id), ['negroni', 'daiquiri']);
  assert.deepEqual(JSON.parse(row.unavailable), ['negroni'], 'Removed drinks must drop out of the out list');

  const nothing = await onRequestPut({ params: { id: menuId }, request: jsonRequest('PUT', {}, token), env });
  assert.equal(nothing.status, 400);
  const emptied = await onRequestPut({ params: { id: menuId }, request: jsonRequest('PUT', { recipes: [] }, token), env });
  assert.equal(emptied.status, 400);
  console.log('PASS: PUT applies partial updates and keeps the out list consistent');
}

// Test 6: the crawler-visible page
{
  const res = await onRequestGetMenuPage({ params: { id: menuId }, env, request: new Request(`https://example.com/menu/${menuId}`) });
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.ok(html.includes('<title>Saturday — Speakeasy</title>'));
  assert.ok(html.includes(`https://example.com/app#menu/${menuId}`), 'Expected a redirect into the SPA guest route');
  assert.ok(html.includes('2 cocktails'));

  const gone = await onRequestGetMenuPage({ params: { id: 'ZZZZZZZZZZ' }, env, request: new Request('https://example.com/menu/ZZZZZZZZZZ') });
  assert.equal(gone.status, 404);
  console.log('PASS: /menu/:id renders an unfurl-friendly shell and 404s for unknown menus');
}

// Test 7: unpublishing
{
  const res = await onRequestDelete({ params: { id: menuId }, request: jsonRequest('DELETE', undefined, token), env });
  assert.equal(res.status, 200);
  assert.ok(!db.menus.has(menuId));
  const after = await onRequestGet({ params: { id: menuId }, env });
  assert.equal(after.status, 404);
  console.log('PASS: DELETE unpublishes the menu');
}

// Test 8: menu-code parsing (the guest "type the code" box)
{
  assert.equal(parseMenuCode('FiAhadLB8G'), 'FiAhadLB8G');
  assert.equal(parseMenuCode('  FiAhadLB8G \n'), 'FiAhadLB8G', 'Expected surrounding whitespace to be ignored');
  assert.equal(parseMenuCode('https://speakeasy.ryanmarch.me/menu/FiAhadLB8G'), 'FiAhadLB8G');
  assert.equal(parseMenuCode('https://speakeasy.ryanmarch.me/app#menu/FiAhadLB8G'), 'FiAhadLB8G');
  assert.equal(parseMenuCode('fiahadmb8g'), 'fiahadmb8g', 'Codes are case-sensitive, so case must be preserved');
  for (const bad of ['', null, 'short', 'FiAhadLB8G1', 'Fi0hadLB8G', 'https://example.com/menu/short', 'hello world']) {
    assert.equal(parseMenuCode(bad), null, `Expected ${JSON.stringify(bad)} to be rejected`);
  }
  console.log('PASS: parseMenuCode accepts codes and menu links and rejects everything else');
}

console.log('All menus tests passed.');
