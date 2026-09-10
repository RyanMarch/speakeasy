/**
 * Cloudflare Pages Function: POST /api/auth/request-otp
 *
 * Requests a 6-digit numeric OTP code for the given email address.
 */

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json;charset=utf-8',
    },
  });
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env || !env.DB) {
    return jsonResponse({ error: 'Database binding (DB) is unavailable.' }, 500);
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

  // Ensure otp_codes table exists
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS otp_codes (
      email TEXT NOT NULL,
      code TEXT NOT NULL,
      expires_at DATETIME NOT NULL
    )`
  ).run();

  // Generate a cryptographically secure 6-digit numeric code
  const randomArray = new Uint32Array(1);
  crypto.getRandomValues(randomArray);
  const code = String(100000 + (randomArray[0] % 900000));

  // 10-minute expiration
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  // Delete previous codes for this email and insert new code
  const deleteStmt = env.DB.prepare(`DELETE FROM otp_codes WHERE email = ?`).bind(email);
  const insertStmt = env.DB.prepare(
    `INSERT INTO otp_codes (email, code, expires_at) VALUES (?, ?, ?)`
  ).bind(email, code, expiresAt);

  await env.DB.batch([deleteStmt, insertStmt]);

  // If Cloudflare's send_email binding is available (deployed worker environment)
  if (env.EMAIL && typeof env.EMAIL.send === 'function') {
    try {
      let EmailMessageClass = globalThis.EmailMessage;
      if (!EmailMessageClass) {
        try {
          const emailMod = await import('cloudflare:email');
          EmailMessageClass = emailMod.EmailMessage;
        } catch {
          // In environments without cloudflare:email module support, fallback to global or mock
          EmailMessageClass = globalThis.EmailMessage;
        }
      }

      if (EmailMessageClass) {
        const fromAddress = 'auth@ryanmarch.me';
        const mimeMessage = [
          `From: Speakeasy <${fromAddress}>`,
          `To: ${email}`,
          `Subject: Your Speakeasy Sign-In Code`,
          `MIME-Version: 1.0`,
          `Content-Type: text/html; charset=UTF-8`,
          ``,
          `<div style="background:#0f1117;color:#f3f4f6;padding:32px;font-family:sans-serif;text-align:center;">`,
          `  <h1 style="color:#e5a93c;">Speakeasy</h1>`,
          `  <p>Your 6-digit verification code is:</p>`,
          `  <div style="font-size:36px;font-weight:bold;letter-spacing:6px;padding:12px;background:#171a23;display:inline-block;border-radius:8px;color:#fff;">${code}</div>`,
          `  <p style="color:#888;font-size:12px;margin-top:20px;">Expires in 10 minutes.</p>`,
          `</div>`,
        ].join('\r\n');

        const msg = new EmailMessageClass(fromAddress, email, mimeMessage);
        await env.EMAIL.send(msg);
      } else {
        console.warn('[Cloudflare Email] EmailMessage constructor unavailable in runtime.');
      }
    } catch (err) {
      console.warn('[Cloudflare Email Error] Failed to send email via send_email binding:', err.message || err);
    }
  } else {
    // Local development fallback
    console.log(`[DEV AUTH] OTP for ${email}: ${code}`);
  }

  return jsonResponse({
    success: true,
    message: 'Code sent',
  });
}
