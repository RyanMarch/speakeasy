/**
 * POST /api/admin/logout
 * Clears the admin session cookie.
 */
import { buildClearAdminSessionCookie } from './_session.js';
import { jsonResponse } from './_auth.js';

export async function onRequestPost(context) {
  const { request } = context;
  const cookie = buildClearAdminSessionCookie(request);

  return jsonResponse(
    { success: true, message: 'Logged out of admin session.' },
    200,
    { 'Set-Cookie': cookie }
  );
}
