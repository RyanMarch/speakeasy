/**
 * Cloudflare Pages Function: GET /api/auth/me
 *
 * Checks session authentication status and returns current user data.
 */

import { jsonResponse } from '../_lib/http.js';
import { requireSession, getSessionToken } from '../_lib/auth.js';

function parseSettings(settingsRaw) {
  if (!settingsRaw) {
    return { unitPref: 'oz', sortPref: 'curated', glassViewMode: 'layered' };
  }
  if (typeof settingsRaw === 'object') {
    return settingsRaw;
  }
  try {
    return JSON.parse(settingsRaw);
  } catch {
    return { unitPref: 'oz', sortPref: 'curated', glassViewMode: 'layered' };
  }
}

export async function onRequestGet(context) {
  const { request, env } = context;

  if (!env || !env.speakeasy_db) {
    return jsonResponse({ authenticated: false, error: 'Database binding (speakeasy_db) is unavailable.' }, 500);
  }

  const token = getSessionToken(request);
  if (!token) {
    return jsonResponse({ authenticated: false });
  }

  // Look up session
  const sessionRow = await env.speakeasy_db.prepare(
    `SELECT user_id, expires_at FROM sessions WHERE token = ?`
  ).bind(token).first();

  if (!sessionRow) {
    return jsonResponse({ authenticated: false });
  }

  const expiresTime = new Date(sessionRow.expires_at).getTime();
  if (!Number.isNaN(expiresTime) && Date.now() > expiresTime) {
    // Delete expired session
    await env.speakeasy_db.prepare(`DELETE FROM sessions WHERE token = ?`).bind(token).run();
    return jsonResponse({ authenticated: false, message: 'Session expired' });
  }

  // Look up user
  const user = await env.speakeasy_db.prepare(
    `SELECT id, email, display_name, settings, created_at FROM users WHERE id = ?`
  ).bind(sessionRow.user_id).first();

  if (!user) {
    return jsonResponse({ authenticated: false });
  }

  return jsonResponse({
    authenticated: true,
    user: {
      id: user.id,
      email: user.email,
      displayName: user.display_name,
      settings: parseSettings(user.settings),
      createdAt: user.created_at || null,
    },
  });
}

export async function onRequestPatch(context) {
  const { request, env } = context;

  if (!env || !env.speakeasy_db) {
    return jsonResponse({ error: 'Database binding (speakeasy_db) is unavailable.' }, 500);
  }

  const session = await requireSession(request, env);
  if (session instanceof Response) return session;
  const { userId } = session;

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON payload' }, 400);
  }

  const displayName = typeof body.displayName === 'string' ? body.displayName.trim() : null;
  if (!displayName) {
    return jsonResponse({ error: 'Display name cannot be empty' }, 400);
  }

  await env.speakeasy_db.prepare(
    `UPDATE users SET display_name = ? WHERE id = ?`
  ).bind(displayName, userId).run();

  const user = await env.speakeasy_db.prepare(
    `SELECT id, email, display_name, settings, created_at FROM users WHERE id = ?`
  ).bind(userId).first();

  return jsonResponse({
    success: true,
    user: {
      id: user.id,
      email: user.email,
      displayName: user.display_name,
      settings: parseSettings(user.settings),
      createdAt: user.created_at || null,
    },
  });
}
