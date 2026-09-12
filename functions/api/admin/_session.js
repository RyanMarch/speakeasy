/**
 * Signed admin session tokens for Speakeasy Admin.
 * Uses HMAC-SHA256 with ADMIN_PASSWORD or fallback secret.
 */
const COOKIE_NAME = 'speakeasy_admin_session';
const SESSION_MAX_AGE_SECONDS = 86400; // 24 hours

function isSecureRequest(request) {
  return new URL(request.url).protocol === 'https:';
}

async function hmac(secret, data) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function signAdminSession(secret) {
  const exp = Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS;
  const payloadStr = JSON.stringify({
    admin: true,
    exp,
  });
  const b64Payload = btoa(payloadStr).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const sigHex = await hmac(secret, payloadStr);
  return `${b64Payload}.${sigHex}`;
}

export async function verifyAdminSession(token, secret) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [b64Payload, sigHex] = token.split('.');
  try {
    let base64 = b64Payload.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) base64 += '=';
    const payloadStr = atob(base64);
    const expectedSig = await hmac(secret, payloadStr);
    if (expectedSig !== sigHex) return null;
    const payload = JSON.parse(payloadStr);
    if (!payload.admin) return null;
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function getAdminSessionToken(request) {
  const cookieHeader = request.headers.get('Cookie');
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export function buildAdminSessionCookie(token, request) {
  const secure = isSecureRequest(request) ? '; Secure' : '';
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MAX_AGE_SECONDS}${secure}`;
}

export function buildClearAdminSessionCookie(request) {
  const secure = isSecureRequest(request) ? '; Secure' : '';
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}
