/**
 * Cloudflare Pages Function: POST /api/auth/request-otp
 *
 * Requests a 6-digit numeric OTP code for the given email address.
 */

import { jsonResponse } from '../_lib/http.js';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
  if (!rawEmail || typeof rawEmail !== 'string') {
    return jsonResponse({ error: 'Valid email is required.' }, 400);
  }

  const email = rawEmail.trim().toLowerCase();
  if (!EMAIL_REGEX.test(email)) {
    return jsonResponse({ error: 'Invalid email address format.' }, 400);
  }

  // Refuse to mint a fresh code (and reset the attempt budget) more than
  // once a minute for the same email — otherwise a brute-force script could
  // just request a new code every time it burns through the attempt cap.
  const existing = await env.speakeasy_db.prepare(
    `SELECT expires_at, created_at FROM otp_codes WHERE email = ?`
  ).bind(email).first();
  if (existing) {
    const stillValid = Date.now() <= new Date(existing.expires_at).getTime();
    const issuedRecently = Date.now() - new Date(existing.created_at).getTime() < 60 * 1000;
    if (stillValid && issuedRecently) {
      return jsonResponse({ success: true, message: 'Code sent' });
    }
  }

  // Generate a cryptographically secure 6-digit numeric code
  const randomArray = new Uint32Array(1);
  crypto.getRandomValues(randomArray);
  const code = String(100000 + (randomArray[0] % 900000));

  // 10-minute expiration
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  // Delete previous codes for this email and insert new code
  const deleteStmt = env.speakeasy_db.prepare(`DELETE FROM otp_codes WHERE email = ?`).bind(email);
  const insertStmt = env.speakeasy_db.prepare(
    `INSERT INTO otp_codes (email, code, expires_at) VALUES (?, ?, ?)`
  ).bind(email, code, expiresAt);

  await env.speakeasy_db.batch([deleteStmt, insertStmt]);

  // If Cloudflare Worker email relay URL is configured
  if (env.EMAIL_RELAY_URL) {
    try {
      const relayRes = await fetch(env.EMAIL_RELAY_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${env.EMAIL_RELAY_SECRET || ''}`,
        },
        body: JSON.stringify({ to: email, code }),
      });

      if (!relayRes.ok) {
        console.warn(`[Email Relay] Failed to deliver OTP via relay: HTTP ${relayRes.status}`);
      }
    } catch (err) {
      console.warn('[Email Relay Error] Failed to call email relay worker:', err.message || err);
    }
  } else {
    // Local development fallback without relay
    console.log(`[DEV AUTH] OTP for ${email}: ${code}`);
  }

  return jsonResponse({
    success: true,
    message: 'Code sent',
  });
}
