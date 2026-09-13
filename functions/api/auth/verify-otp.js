/**
 * Cloudflare Pages Function: POST /api/auth/verify-otp
 *
 * Verifies the 6-digit numeric OTP code, creates/upserts the user,
 * generates a 30-day session token, and removes the used OTP code.
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

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env || !env.speakeasy_db) {
    return jsonResponse({ error: 'Database binding (speakeasy_db) is unavailable.' }, 500);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body.' }, 400);
  }

  const rawEmail = body?.email;
  const rawCode = body?.code;

  if (!rawEmail || typeof rawEmail !== 'string') {
    return jsonResponse({ error: 'Valid email is required.' }, 400);
  }
  if (!rawCode || (typeof rawCode !== 'string' && typeof rawCode !== 'number')) {
    return jsonResponse({ error: 'Valid code is required.' }, 400);
  }

  const email = rawEmail.trim().toLowerCase();
  const code = String(rawCode).trim();

  // Look up OTP code
  const otpRow = await env.speakeasy_db.prepare(
    `SELECT code, expires_at FROM otp_codes WHERE email = ? ORDER BY expires_at DESC LIMIT 1`
  ).bind(email).first();

  if (!otpRow || String(otpRow.code).trim() !== code) {
    return jsonResponse({ error: 'Invalid verification code.' }, 400);
  }

  const expiresTime = new Date(otpRow.expires_at).getTime();
  if (Number.isNaN(expiresTime) || Date.now() > expiresTime) {
    // Delete expired code
    await env.speakeasy_db.prepare(`DELETE FROM otp_codes WHERE email = ?`).bind(email).run();
    return jsonResponse({ error: 'Verification code has expired.' }, 400);
  }

  // Delete used OTP code
  await env.speakeasy_db.prepare(`DELETE FROM otp_codes WHERE email = ?`).bind(email).run();

  // Find or create user
  let user = await env.speakeasy_db.prepare(
    `SELECT id, email, display_name, settings, created_at FROM users WHERE email = ?`
  ).bind(email).first();

  if (!user) {
    const userId = crypto.randomUUID();
    const defaultSettings = JSON.stringify({ unitPref: 'oz', sortPref: 'curated', glassViewMode: 'layered' });
    const displayName = email.split('@')[0];
    const now = new Date().toISOString();

    await env.speakeasy_db.prepare(
      `INSERT INTO users (id, email, display_name, settings, created_at) VALUES (?, ?, ?, ?, ?)`
    ).bind(userId, email, displayName, defaultSettings, now).run();

    user = {
      id: userId,
      email,
      display_name: displayName,
      settings: defaultSettings,
      created_at: now,
    };
  }

  // Generate session token
  const token = crypto.randomUUID();
  // 30-day session expiration
  const sessionExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  await env.speakeasy_db.prepare(
    `INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)`
  ).bind(token, user.id, sessionExpiresAt).run();

  return jsonResponse({
    success: true,
    token,
    user: {
      id: user.id,
      email: user.email,
      displayName: user.display_name,
      settings: parseSettings(user.settings),
      createdAt: user.created_at || null,
    },
  });
}
