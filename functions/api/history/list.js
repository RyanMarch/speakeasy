/**
 * Cloudflare Pages Function: GET /api/history/list
 *
 * Retrieves drink tracking history for authenticated users sorted descending by made_at.
 */

import { jsonResponse } from '../_lib/http.js';
import { requireSession } from '../_lib/auth.js';

export async function onRequestGet(context) {
  const { request, env } = context;

  if (!env || !env.speakeasy_db) {
    return jsonResponse({ error: 'Database binding (speakeasy_db) is unavailable.' }, 500);
  }

  // 1. Verify session
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;
  const { userId } = session;

  // 2. Parse query parameters (?limit=20, default 15)
  const url = new URL(request.url);
  const limitParam = parseInt(url.searchParams.get('limit'), 10);
  const limit = Number.isInteger(limitParam) && limitParam > 0 ? Math.min(limitParam, 100) : 15;

  // 3. Query drink history
  const result = await env.speakeasy_db.prepare(
    `SELECT id, recipe_id, made_at FROM drink_history WHERE user_id = ? ORDER BY made_at DESC LIMIT ?`
  ).bind(userId, limit).all();

  const history = (result.results || []).map(row => ({
    id: row.id,
    recipeId: row.recipe_id,
    madeAt: row.made_at,
  }));

  return jsonResponse({ history });
}
