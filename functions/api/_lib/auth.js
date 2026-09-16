/**
 * Shared Bearer-token session lookup for Speakeasy /api/* endpoints. Consolidates
 * what auth/me.js, auth/logout.js, auth/delete-account.js, history/list.js,
 * history/log.js, and sync.js each used to hand-roll separately (and, before
 * this, inconsistently — some deleted an expired session row, some didn't).
 */
import { jsonResponse } from './http.js';

/**
 * Resolves the caller's session from the request's Authorization header.
 * Returns `{ userId }` on success, or a ready-made 401 Response to return
 * directly when there's no valid session — always deleting an expired
 * session row as part of rejecting it.
 */
export async function requireSession(request, env) {
  const authHeader = request.headers.get('Authorization') || '';
  const tokenMatch = authHeader.match(/^Bearer\s+(.+)$/i);
  const token = tokenMatch ? tokenMatch[1].trim() : '';

  if (!token) {
    return jsonResponse({ error: 'Missing or malformed Authorization header.' }, 401);
  }

  const sessionRow = await env.speakeasy_db.prepare(
    `SELECT user_id, expires_at FROM sessions WHERE token = ?`
  ).bind(token).first();

  if (!sessionRow) {
    return jsonResponse({ error: 'Invalid or expired session token.' }, 401);
  }

  const expiresTime = new Date(sessionRow.expires_at).getTime();
  if (!Number.isNaN(expiresTime) && Date.now() > expiresTime) {
    await env.speakeasy_db.prepare(`DELETE FROM sessions WHERE token = ?`).bind(token).run();
    return jsonResponse({ error: 'Session token has expired.' }, 401);
  }

  return { userId: sessionRow.user_id, token };
}
