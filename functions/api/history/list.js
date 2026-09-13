/**
 * Cloudflare Pages Function: GET /api/history/list
 *
 * Retrieves drink tracking history for authenticated users sorted descending by made_at.
 */

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json;charset=utf-8',
    },
  });
}

export async function onRequestGet(context) {
  const { request, env } = context;

  if (!env || !env.speakeasy_db) {
    return jsonResponse({ error: 'Database binding (speakeasy_db) is unavailable.' }, 500);
  }

  // 1. Verify Authorization Bearer token
  const authHeader = request.headers.get('Authorization') || '';
  const tokenMatch = authHeader.match(/^Bearer\s+(.+)$/i);

  if (!tokenMatch) {
    return jsonResponse({ error: 'Missing or malformed Authorization header.' }, 401);
  }

  const token = tokenMatch[1].trim();
  if (!token) {
    return jsonResponse({ error: 'Empty bearer token.' }, 401);
  }

  // Look up active session
  const sessionRow = await env.speakeasy_db.prepare(
    `SELECT user_id, expires_at FROM sessions WHERE token = ?`
  ).bind(token).first();

  if (!sessionRow) {
    return jsonResponse({ error: 'Invalid or expired session token.' }, 401);
  }

  const expiresAt = new Date(sessionRow.expires_at).getTime();
  if (!Number.isNaN(expiresAt) && Date.now() > expiresAt) {
    return jsonResponse({ error: 'Session token has expired.' }, 401);
  }

  const userId = sessionRow.user_id;

  // 2. Parse query parameters (?limit=20, default 15)
  const url = new URL(request.url);
  const limitParam = parseInt(url.searchParams.get('limit'), 10);
  const limit = Number.isInteger(limitParam) && limitParam > 0 ? Math.min(limitParam, 100) : 15;

  // 3. Query drink history
  const result = await env.speakeasy_db.prepare(
    `SELECT id, recipe_id, made_at FROM drink_history WHERE user_id = ? ORDER BY made_at DESC LIMIT ?`
  ).bind(userId, limit).all();

  const history = (result.results || []).map(row => ({
    id: row.id,
    recipeId: row.recipe_id,
    madeAt: row.made_at,
  }));

  return jsonResponse({ history });
}
