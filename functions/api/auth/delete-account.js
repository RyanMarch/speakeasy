/**
 * Cloudflare Pages Function: POST /api/auth/delete-account
 *
 * Permanently deletes the authenticated user's account and all associated
 * data via cascading foreign keys in D1.
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

  const authHeader = request.headers.get('Authorization') || '';
  const tokenMatch = authHeader.match(/^Bearer\s+(.+)$/i);

  if (!tokenMatch) {
    return jsonResponse({ error: 'Unauthorized: Missing authentication token.' }, 401);
  }

  const token = tokenMatch[1].trim();
  if (!token) {
    return jsonResponse({ error: 'Unauthorized: Empty token.' }, 401);
  }

  // Look up session
  const sessionRow = await env.speakeasy_db.prepare(
    `SELECT user_id, expires_at FROM sessions WHERE token = ?`
  ).bind(token).first();

  if (!sessionRow) {
    return jsonResponse({ error: 'Unauthorized: Invalid or expired session.' }, 401);
  }

  const expiresTime = new Date(sessionRow.expires_at).getTime();
  if (!Number.isNaN(expiresTime) && Date.now() > expiresTime) {
    await env.speakeasy_db.prepare(`DELETE FROM sessions WHERE token = ?`).bind(token).run();
    return jsonResponse({ error: 'Unauthorized: Session expired.' }, 401);
  }

  const userId = sessionRow.user_id;

  // Delete user record (foreign keys with ON DELETE CASCADE handle bars, inventory, recipes, history, and sessions)
  await env.speakeasy_db.batch([
    env.speakeasy_db.prepare(`DELETE FROM sessions WHERE user_id = ?`).bind(userId),
    env.speakeasy_db.prepare(`DELETE FROM custom_recipes WHERE user_id = ?`).bind(userId),
    env.speakeasy_db.prepare(`DELETE FROM drink_history WHERE user_id = ?`).bind(userId),
    env.speakeasy_db.prepare(`DELETE FROM bar_inventory WHERE bar_id IN (SELECT id FROM bars WHERE user_id = ?)`).bind(userId),
    env.speakeasy_db.prepare(`DELETE FROM bars WHERE user_id = ?`).bind(userId),
    env.speakeasy_db.prepare(`DELETE FROM users WHERE id = ?`).bind(userId),
  ]);

  return jsonResponse({ success: true, message: 'Account permanently deleted.' });
}
