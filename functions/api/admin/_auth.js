/**
 * Shared admin auth helper for Speakeasy /api/admin/* endpoints.
 */
import { getAdminSessionToken, verifyAdminSession } from './_session.js';

export function jsonResponse(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json;charset=utf-8',
      ...headers,
    },
  });
}

export function getAdminSecret(env) {
  return env.ADMIN_PASSWORD || env.SESSION_SECRET || null;
}

function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export async function checkAdminAuth(context) {
  const { request, env } = context;
  const secret = getAdminSecret(env);

  if (!secret) {
    return jsonResponse({ error: 'server_misconfigured', message: 'Admin authentication is not configured.' }, 500);
  }

  // 1. Check Bearer token or header if provided
  const authHeader = request.headers.get('Authorization') || '';
  const tokenMatch = authHeader.match(/^Bearer\s+(.+)$/i);
  const bearerToken = tokenMatch ? tokenMatch[1].trim() : null;

  // 2. Check admin cookie
  const cookieToken = getAdminSessionToken(request);
  const token = bearerToken || cookieToken;

  if (!token) {
    return jsonResponse({ error: 'Unauthorized', message: 'Admin authentication required' }, 401);
  }

  // If the token matches ADMIN_PASSWORD directly as a header/bearer
  if (env.ADMIN_PASSWORD && timingSafeEqual(token, env.ADMIN_PASSWORD)) {
    return null;
  }

  const payload = await verifyAdminSession(token, secret);
  if (!payload) {
    return jsonResponse({ error: 'Unauthorized', message: 'Invalid or expired admin session' }, 401);
  }

  return null; // Authorized
}
