/**
 * Shared JSON response helper for Speakeasy /api/* endpoints (excluding the
 * admin surface, which already has its own copy in admin/_auth.js).
 */
export function jsonResponse(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json;charset=utf-8',
      ...headers,
    },
  });
}
