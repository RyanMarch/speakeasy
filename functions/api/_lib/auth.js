/**
 * Shared Bearer-token session lookup for Speakeasy /api/* endpoints. Consolidates
 * what auth/me.js, auth/logout.js, auth/delete-account.js, history/list.js,
 * history/log.js, and sync.js each used to hand-roll separately (and, before
 * this, inconsistently — some deleted an expired session row, some didn't).
 */
import { jsonResponse } from './http.js';

export const SESSION_COOKIE_NAME = 'speakeasy_session';
const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30 days, matches sessions.expires_at

/**
 * Extracts the session token from the request's Cookie header, or '' if absent.
 */
export function getSessionToken(request) {
  const cookieHeader = request.headers.get('Cookie') || '';
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE_NAME}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : '';
}

/**
 * Builds a Set-Cookie header value that stores the session token as an
 * HttpOnly cookie, unreadable by page JS. `Secure` is only attached when the
 * request itself came in over HTTPS — browsers (Safari in particular) drop a
 * Secure cookie outright on plain-HTTP local dev, which would silently break
 * every authenticated request.
 */
export function sessionCookieHeader(token, request) {
  const secure = isHttps(request) ? ' Secure;' : '';
  return `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}; HttpOnly;${secure} SameSite=Lax; Path=/; Max-Age=${SESSION_MAX_AGE_SECONDS}`;
}

/**
 * Builds a Set-Cookie header value that clears the session cookie. Must
 * match sessionCookieHeader's Secure attribute or the browser won't apply it.
 */
export function clearSessionCookieHeader(request) {
  const secure = isHttps(request) ? ' Secure;' : '';
  return `${SESSION_COOKIE_NAME}=; HttpOnly;${secure} SameSite=Lax; Path=/; Max-Age=0`;
}

function isHttps(request) {
  try {
    return new URL(request.url).protocol === 'https:';
  } catch {
    return true;
  }
}

/**
 * Resolves the caller's session from the request's session cookie.
 * Returns `{ userId }` on success, or a ready-made 401 Response to return
 * directly when there's no valid session — always deleting an expired
 * session row as part of rejecting it.
 */
export async function requireSession(request, env) {
  const token = getSessionToken(request);

  if (!token) {
    return jsonResponse({ error: 'Missing or invalid session cookie.' }, 401);
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
