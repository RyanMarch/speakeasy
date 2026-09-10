/**
 * Cloudflare Pages Function: GET /api/auth/me
 *
 * Checks session authentication status and returns current user data.
 */

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json;charset=utf-8',
    },
  });
}

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

  if (!env || !env.DB) {
    return jsonResponse({ authenticated: false, error: 'Database binding (DB) is unavailable.' }, 500);
  }

  const authHeader = request.headers.get('Authorization') || '';
  const tokenMatch = authHeader.match(/^Bearer\s+(.+)$/i);

  if (!tokenMatch) {
    return jsonResponse({ authenticated: false });
  }

  const token = tokenMatch[1].trim();
  if (!token) {
    return jsonResponse({ authenticated: false });
  }

  // Look up session
  const sessionRow = await env.DB.prepare(
    `SELECT user_id, expires_at FROM sessions WHERE token = ?`
  ).bind(token).first();

  if (!sessionRow) {
    return jsonResponse({ authenticated: false });
  }

  const expiresTime = new Date(sessionRow.expires_at).getTime();
  if (!Number.isNaN(expiresTime) && Date.now() > expiresTime) {
    // Delete expired session
    await env.DB.prepare(`DELETE FROM sessions WHERE token = ?`).bind(token).run();
    return jsonResponse({ authenticated: false, message: 'Session expired' });
  }

  // Look up user
  const user = await env.DB.prepare(
    `SELECT id, email, display_name, settings FROM users WHERE id = ?`
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
    },
  });
}
