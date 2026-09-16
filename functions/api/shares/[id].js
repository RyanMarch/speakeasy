/**
 * Cloudflare Pages Function: GET /api/shares/:id
 *
 * Fetches a shared recipe snapshot by its public share id. No authentication
 * required — this is a public, read-only lookup.
 */

import { jsonResponse } from '../_lib/http.js';
import { SHARE_ID_PATTERN } from './_lib.js';

export async function onRequestGet(context) {
  const { params, env } = context;

  if (!env || !env.speakeasy_db) {
    return jsonResponse({ error: 'Database binding (speakeasy_db) is unavailable.' }, 500);
  }

  const shareId = typeof params.id === 'string' ? params.id.trim() : '';
  if (!shareId || !SHARE_ID_PATTERN.test(shareId)) {
    return jsonResponse({ error: 'Share not found.' }, 404);
  }

  const row = await env.speakeasy_db.prepare(
    `SELECT recipe, created_at FROM shares WHERE share_id = ?`
  ).bind(shareId).first();

  if (!row) {
    return jsonResponse({ error: 'Share not found.' }, 404);
  }

  let recipe;
  try {
    recipe = JSON.parse(row.recipe);
  } catch {
    return jsonResponse({ error: 'Share data is corrupted.' }, 500);
  }

  return jsonResponse({
    success: true,
    recipe,
    createdAt: row.created_at,
  });
}
