/**
 * POST /api/admin/hide
 * Toggles global hidden state for any cocktail (canonical seed or global recipe).
 */
import { checkAdminAuth, jsonResponse } from './_auth.js';

export async function onRequestPost(context) {
  const authErr = await checkAdminAuth(context);
  if (authErr) return authErr;

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

  const { recipeId, hide, reason } = body || {};

  if (!recipeId || typeof recipeId !== 'string') {
    return jsonResponse({ error: 'recipeId is required.' }, 400);
  }

  if (hide) {
    await env.speakeasy_db.prepare(
      `INSERT INTO global_hidden_recipes (recipe_id, reason, hidden_at)
       VALUES (?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(recipe_id) DO UPDATE SET
         reason = excluded.reason,
         hidden_at = CURRENT_TIMESTAMP`
    ).bind(recipeId, reason || 'Hidden by admin').run();

    return jsonResponse({
      success: true,
      recipeId,
      hidden: true,
      message: `Recipe "${recipeId}" is now hidden from the global library.`,
    });
  } else {
    await env.speakeasy_db.prepare(
      `DELETE FROM global_hidden_recipes WHERE recipe_id = ?`
    ).bind(recipeId).run();

    return jsonResponse({
      success: true,
      recipeId,
      hidden: false,
      message: `Recipe "${recipeId}" is restored to the global library.`,
    });
  }
}
