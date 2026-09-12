/**
 * GET /api/admin/me
 * Returns admin session status.
 */
import { checkAdminAuth, jsonResponse } from './_auth.js';

export async function onRequestGet(context) {
  const authErr = await checkAdminAuth(context);
  if (authErr) return authErr;

  return jsonResponse({
    authenticated: true,
    role: 'admin',
  });
}
