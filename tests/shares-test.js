import assert from 'node:assert/strict';
import { onRequestPost } from '../functions/api/shares/index.js';
import { onRequestGet } from '../functions/api/shares/[id].js';

console.log('--- Testing /functions/api/shares/* Endpoints ---');

const SHARE_ID_PATTERN = /^[23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]{10}$/;

// In-memory mock D1 database engine, scoped to just the `shares` table.
class MockD1 {
  constructor() {
    this.shares = new Map();
  }

  prepare(sql) {
    return new MockD1PreparedStatement(this, sql);
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
    const sql = this.sql;
    const params = this.boundParams;

    if (sql.startsWith('INSERT INTO shares')) {
      const [shareId, recipe] = params;
      if (this.db.shares.has(shareId)) {
        throw new Error('UNIQUE constraint failed: shares.share_id');
      }
      this.db.shares.set(shareId, { share_id: shareId, recipe, created_at: new Date().toISOString() });
      return { results: [], success: true };
    }

    throw new Error(`Unhandled SQL in mock (run): ${sql}`);
  }

  async all() {
    const sql = this.sql;
    const params = this.boundParams;

    if (sql.startsWith('SELECT recipe, created_at FROM shares WHERE share_id = ?')) {
      const [shareId] = params;
      const row = this.db.shares.get(shareId);
      return { results: row ? [row] : [], success: true };
    }

    throw new Error(`Unhandled SQL in mock (all): ${sql}`);
  }
}

function createMockPostRequest(body) {
  return new Request('https://example.com/api/shares', {
    method: 'POST',
    headers: new Headers({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  });
}

const db = new MockD1();

// Test 1: create a share
let firstShareId;
{
  const recipe = {
    name: 'Test Custom Riff',
    glassware: 'Coupe',
    method: 'Stirred',
    specs: [{ amount: 2, unit: 'oz', name: 'Gin' }, { amount: 0.5, unit: 'oz', name: 'Dry Vermouth' }],
    instructions: 'Stir with ice and strain into a chilled coupe.',
    description: 'A dry riff.',
    notes: 'Best with a lemon twist.',
    riffOfId: 'dry-martini',
    riffOfName: 'Dry Martini',
    tags: ['Classic', 'GIN', 'classic'],
    id: 'client-local-id-should-be-ignored',
  };

  const res = await onRequestPost({ request: createMockPostRequest(recipe), env: { speakeasy_db: db } });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.match(data.shareId, SHARE_ID_PATTERN, `Expected a 10-char share id, got ${data.shareId}`);
  assert.equal(data.url, `https://example.com/app#share/${data.shareId}`);

  firstShareId = data.shareId;
  const stored = JSON.parse(db.shares.get(firstShareId).recipe);
  assert.equal(stored.name, 'Test Custom Riff');
  assert.equal(stored.id, undefined, 'Expected the client-local id to be dropped from the stored snapshot');
  assert.deepEqual(stored.tags, ['classic', 'gin'], 'Expected tags to be lowercased and deduped');
  assert.equal(stored.specs.length, 2);

  console.log('PASS: POST /api/shares creates a share with a short, clean id and drops the client id');
}

// Test 2: fetch the share back
{
  const res = await onRequestGet({ params: { id: firstShareId }, env: { speakeasy_db: db } });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.equal(data.recipe.name, 'Test Custom Riff');
  assert.equal(data.recipe.riffOfName, 'Dry Martini');
  assert.equal(data.recipe.specs.length, 2);
  assert.equal(data.recipe.specs[0].name, 'Gin');
  console.log('PASS: GET /api/shares/:id returns the stored recipe snapshot');
}

// Test 3: missing name is rejected
{
  const res = await onRequestPost({ request: createMockPostRequest({ glassware: 'Rocks' }), env: { speakeasy_db: db } });
  assert.equal(res.status, 400);
  console.log('PASS: POST /api/shares rejects a recipe with no name');
}

// Test 4: fetching a nonexistent id returns 404
{
  const res = await onRequestGet({ params: { id: 'doesNotExist1' }, env: { speakeasy_db: db } });
  assert.equal(res.status, 404);
  console.log('PASS: GET /api/shares/:id returns 404 for an unknown id');
}

// Test 5: fetching an id with invalid characters is rejected without hitting the DB
{
  const res = await onRequestGet({ params: { id: '../../etc/passwd' }, env: { speakeasy_db: db } });
  assert.equal(res.status, 404);
  console.log('PASS: GET /api/shares/:id rejects malformed ids before querying the database');
}

// Test 6: a second share gets a different id (sanity check against accidental id reuse)
{
  const res = await onRequestPost({ request: createMockPostRequest({ name: 'Second Drink' }), env: { speakeasy_db: db } });
  const data = await res.json();
  assert.notEqual(data.shareId, firstShareId);
  console.log('PASS: Two shares get distinct ids');
}

console.log('All /functions/api/shares/* tests passed successfully!');
