/**
 * Cloudflare Pages Function: POST /api/auth/logout
 *
 * Terminates the active session by deleting the token from D1 sessions.
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
    return jsonResponse({ success: true, message: 'No active session' });
  }

  const token = tokenMatch[1].trim();
  if (token) {
    await env.speakeasy_db.prepare(`DELETE FROM sessions WHERE token = ?`).bind(token).run();
  }

  return jsonResponse({ success: true, message: 'Logged out' });
}
