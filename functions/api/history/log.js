/**
 * Cloudflare Pages Function: POST /api/history/log
 *
 * Logs a drink creation event to the D1 drink_history table for authenticated users.
 */

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json;charset=utf-8',
    },
  });
}

export async function onRequestPost(context) {
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

  // 2. Parse payload: { recipeId: string, madeAt?: string }
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body.' }, 400);
  }

  if (!body || typeof body !== 'object') {
    return jsonResponse({ error: 'Payload must be a JSON object.' }, 400);
  }

  const recipeId = typeof body.recipeId === 'string' ? body.recipeId.trim() : '';
  if (!recipeId) {
    return jsonResponse({ error: 'Missing or invalid recipeId.' }, 400);
  }

  // Determine timestamp
  const madeAt = typeof body.madeAt === 'string' && body.madeAt.trim()
    ? body.madeAt.trim()
    : new Date().toISOString();

  const id = crypto.randomUUID();

  // 3. Insert into drink_history
  await env.speakeasy_db.prepare(
    `INSERT INTO drink_history (id, user_id, recipe_id, made_at) VALUES (?, ?, ?, ?)`
  ).bind(id, userId, recipeId, madeAt).run();

  return jsonResponse({
    success: true,
    entry: {
      id,
      recipeId,
      madeAt,
    },
  });
}
