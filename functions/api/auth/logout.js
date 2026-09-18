/**
 * Cloudflare Pages Function: POST /api/auth/logout
 *
 * Terminates the active session by deleting the token from D1 sessions.
 */

import { jsonResponse } from '../_lib/http.js';
import { getSessionToken, clearSessionCookieHeader } from '../_lib/auth.js';

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env || !env.speakeasy_db) {
    return jsonResponse({ error: 'Database binding (speakeasy_db) is unavailable.' }, 500);
  }

  const token = getSessionToken(request);
  if (token) {
    await env.speakeasy_db.prepare(`DELETE FROM sessions WHERE token = ?`).bind(token).run();
  }

  return jsonResponse(
    { success: true, message: token ? 'Logged out' : 'No active session' },
    200,
    { 'Set-Cookie': clearSessionCookieHeader(request) }
  );
}
