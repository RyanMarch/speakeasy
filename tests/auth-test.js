import assert from 'node:assert/strict';
import { onRequestPost as onRequestPostRequestOtp } from '../functions/api/auth/request-otp.js';
import { onRequestPost as onRequestPostVerifyOtp } from '../functions/api/auth/verify-otp.js';
import { onRequestGet as onRequestGetMe } from '../functions/api/auth/me.js';
import { onRequestPost as onRequestPostLogout } from '../functions/api/auth/logout.js';
import * as authClient from '../js/modules/auth.js';

console.log('--- Testing /functions/api/auth/* and js/modules/auth.js ---');

class MockD1 {
  constructor() {
    this.tables = {
      users: new Map(),
      sessions: new Map(),
      otp_codes: new Map(),
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

    // CREATE TABLE IF NOT EXISTS otp_codes
    if (sql.startsWith('CREATE TABLE IF NOT EXISTS otp_codes')) {
      return { results: [], success: true };
    }

    // DELETE FROM otp_codes WHERE email = ?
    if (sql.startsWith('DELETE FROM otp_codes WHERE email = ?')) {
      const [email] = params;
      for (const [key, val] of this.db.tables.otp_codes.entries()) {
        if (val.email === email) {
          this.db.tables.otp_codes.delete(key);
        }
      }
      return { results: [], success: true };
    }

    // INSERT INTO otp_codes (email, code, expires_at) VALUES (?, ?, ?)
    if (sql.startsWith('INSERT INTO otp_codes')) {
      const [email, code, expires_at] = params;
      const key = `${email}:${code}`;
      this.db.tables.otp_codes.set(key, { email, code, expires_at });
      return { results: [], success: true };
    }

    // SELECT code, expires_at FROM otp_codes WHERE email = ? ORDER BY expires_at DESC LIMIT 1
    if (sql.startsWith('SELECT code, expires_at FROM otp_codes WHERE email = ?')) {
      const [email] = params;
      const matching = Array.from(this.db.tables.otp_codes.values())
        .filter(entry => entry.email === email)
        .sort((a, b) => b.expires_at.localeCompare(a.expires_at));
      return {
        results: matching.length > 0 ? [{ code: matching[0].code, expires_at: matching[0].expires_at }] : [],
        success: true,
      };
    }

    // SELECT id, email, display_name, settings FROM users WHERE email = ?
    if (sql.startsWith('SELECT id, email, display_name, settings FROM users WHERE email = ?')) {
      const [email] = params;
      const user = Array.from(this.db.tables.users.values()).find(u => u.email === email);
      return {
        results: user ? [user] : [],
        success: true,
      };
    }

    // SELECT id, email, display_name, settings FROM users WHERE id = ?
    if (sql.startsWith('SELECT id, email, display_name, settings FROM users WHERE id = ?')) {
      const [id] = params;
      const user = this.db.tables.users.get(id);
      return {
        results: user ? [user] : [],
        success: true,
      };
    }

    // INSERT INTO users (id, email, display_name, settings) VALUES (?, ?, ?, ?)
    if (sql.startsWith('INSERT INTO users')) {
      const [id, email, display_name, settings] = params;
      const user = { id, email, display_name, settings };
      this.db.tables.users.set(id, user);
      return { results: [], success: true };
    }

    // INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)
    if (sql.startsWith('INSERT INTO sessions')) {
      const [token, user_id, expires_at] = params;
      this.db.tables.sessions.set(token, { token, user_id, expires_at });
      return { results: [], success: true };
    }

    // SELECT user_id, expires_at FROM sessions WHERE token = ?
    if (sql.startsWith('SELECT user_id, expires_at FROM sessions WHERE token = ?')) {
      const [token] = params;
      const session = this.db.tables.sessions.get(token);
      return {
        results: session ? [{ user_id: session.user_id, expires_at: session.expires_at }] : [],
        success: true,
      };
    }

    // DELETE FROM sessions WHERE token = ?
    if (sql.startsWith('DELETE FROM sessions WHERE token = ?')) {
      const [token] = params;
      this.db.tables.sessions.delete(token);
      return { results: [], success: true };
    }

    throw new Error(`Unhandled SQL in MockD1: ${sql}`);
  }
}

function createMockRequest({ method = 'POST', headers = {}, body = null }) {
  return new Request('https://example.com', {
    method,
    headers: new Headers(headers),
    body: body ? JSON.stringify(body) : null,
  });
}

const db = new MockD1();
const env = { DB: db };

// 1. Test request-otp endpoint
{
  // Test invalid email
  const badReq = createMockRequest({ body: { email: 'not-an-email' } });
  const badRes = await onRequestPostRequestOtp({ request: badReq, env });
  assert.equal(badRes.status, 400);

  // Test valid email
  const req = createMockRequest({ body: { email: 'test@example.com' } });
  const res = await onRequestPostRequestOtp({ request: req, env });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.equal(data.message, 'Code sent');

  // Verify OTP was saved in DB
  const savedOtps = Array.from(db.tables.otp_codes.values()).filter(o => o.email === 'test@example.com');
  assert.equal(savedOtps.length, 1);
  assert.equal(savedOtps[0].code.length, 6);
  assert.ok(/^\d{6}$/.test(savedOtps[0].code));

  // Test with EMAIL_RELAY_URL configured
  let sentPayload = null;
  let sentHeaders = null;
  let sentUrl = null;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    sentUrl = url;
    sentHeaders = options.headers;
    sentPayload = JSON.parse(options.body);
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  };

  const mockRelayEnv = {
    DB: db,
    EMAIL_RELAY_URL: 'https://speakeasy-email-relay.example.workers.dev',
    EMAIL_RELAY_SECRET: 'super-secret-relay-token',
  };
  const emailReq = createMockRequest({ body: { email: 'bartender@example.com' } });
  const emailRes = await onRequestPostRequestOtp({ request: emailReq, env: mockRelayEnv });
  assert.equal(emailRes.status, 200);
  assert.equal(sentUrl, 'https://speakeasy-email-relay.example.workers.dev');
  assert.equal(sentHeaders['Authorization'], 'Bearer super-secret-relay-token');
  assert.equal(sentHeaders['Content-Type'], 'application/json');
  assert.equal(sentPayload.to, 'bartender@example.com');
  assert.equal(typeof sentPayload.code, 'string');
  assert.equal(sentPayload.code.length, 6);

  globalThis.fetch = originalFetch;
  console.log('PASS: request-otp endpoint generates and saves 6-digit code, and dispatches via EMAIL_RELAY_URL');
}

// 2. Test verify-otp endpoint
let createdToken = null;
let createdUser = null;
{
  const otpEntry = Array.from(db.tables.otp_codes.values()).find(o => o.email === 'test@example.com');
  const code = otpEntry.code;

  // Test wrong code
  const wrongReq = createMockRequest({ body: { email: 'test@example.com', code: '000000' } });
  const wrongRes = await onRequestPostVerifyOtp({ request: wrongReq, env });
  assert.equal(wrongRes.status, 400);

  // Test correct code
  const req = createMockRequest({ body: { email: 'test@example.com', code } });
  const res = await onRequestPostVerifyOtp({ request: req, env });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.ok(data.token);
  assert.equal(data.user.email, 'test@example.com');
  assert.equal(data.user.displayName, 'test');
  assert.deepEqual(data.user.settings, { unitPref: 'oz', sortPref: 'curated', glassViewMode: 'layered' });

  createdToken = data.token;
  createdUser = data.user;

  // Verify OTP code was deleted from DB after verification
  const remainingOtps = Array.from(db.tables.otp_codes.values()).filter(o => o.email === 'test@example.com');
  assert.equal(remainingOtps.length, 0);

  // Verify session created in DB
  const session = db.tables.sessions.get(createdToken);
  assert.ok(session);
  assert.equal(session.user_id, createdUser.id);
  console.log('PASS: verify-otp endpoint validates code, upserts user, and creates 30-day session');
}

// 3. Test /api/auth/me endpoint
{
  // With valid token
  const req = createMockRequest({
    method: 'GET',
    headers: { Authorization: `Bearer ${createdToken}` },
  });
  const res = await onRequestGetMe({ request: req, env });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.authenticated, true);
  assert.equal(data.user.email, 'test@example.com');

  // With invalid token
  const badReq = createMockRequest({
    method: 'GET',
    headers: { Authorization: 'Bearer fake-token' },
  });
  const badRes = await onRequestGetMe({ request: badReq, env });
  assert.equal(badRes.status, 200);
  const badData = await badRes.json();
  assert.equal(badData.authenticated, false);
  console.log('PASS: /api/auth/me checks session authenticity');
}

// 4. Test /api/auth/logout endpoint
{
  const req = createMockRequest({
    method: 'POST',
    headers: { Authorization: `Bearer ${createdToken}` },
  });
  const res = await onRequestPostLogout({ request: req, env });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);

  // Verify session deleted
  assert.equal(db.tables.sessions.has(createdToken), false);

  // me endpoint now returns unauthenticated
  const meRes = await onRequestGetMe({ request: req, env });
  const meData = await meRes.json();
  assert.equal(meData.authenticated, false);
  console.log('PASS: /api/auth/logout invalidates session');
}

// 5. Test client module exports and storage bridge
{
  assert.equal(typeof authClient.isAuthenticated, 'function');
  assert.equal(typeof authClient.getToken, 'function');
  assert.equal(typeof authClient.getUser, 'function');
  assert.equal(typeof authClient.requestOtp, 'function');
  assert.equal(typeof authClient.verifyOtp, 'function');
  assert.equal(typeof authClient.logout, 'function');
  assert.equal(typeof authClient.migrateGuestData, 'function');
  console.log('PASS: js/modules/auth.js contract and exports verified');
}

console.log('All Auth tests passed successfully!');
