/**
 * POST /api/admin/login
 * Validates admin password and issues a signed session cookie.
 */
import { signAdminSession, buildAdminSessionCookie } from './_session.js';
import { jsonResponse, getAdminSecret } from './_auth.js';

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'invalid_json', message: 'Invalid JSON request body.' }, 400);
  }

  const configuredPassword = env.ADMIN_PASSWORD || 'speakeasy-admin-dev-secret';
  const secret = getAdminSecret(env);

  if (!body.password || body.password !== configuredPassword) {
    return jsonResponse({ error: 'invalid_credentials', message: 'Incorrect admin password.' }, 401);
  }

  const token = await signAdminSession(secret);
  const cookie = buildAdminSessionCookie(token, request);

  return jsonResponse(
    { success: true, message: 'Admin authenticated successfully.' },
    200,
    { 'Set-Cookie': cookie }
  );
}
