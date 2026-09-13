/**
 * /api/admin/recipes
 *
 * GET: Returns global recipes (both from DB and seed IDs), globally hidden recipe IDs, and all custom recipes from all users.
 * POST: Promotes or updates a recipe in the global_recipes table.
 * DELETE: Removes a promoted recipe from global_recipes.
 */
import { checkAdminAuth, jsonResponse } from './_auth.js';

export async function onRequestGet(context) {
  const authErr = await checkAdminAuth(context);
  if (authErr) return authErr;

  const { env } = context;
  if (!env || !env.speakeasy_db) {
    return jsonResponse({ error: 'Database binding (speakeasy_db) is unavailable.' }, 500);
  }

  // 1. Fetch published global recipes
  const globalRows = await env.speakeasy_db.prepare(
    `SELECT id, name, glassware, method, specs, instructions, description, notes, riff_of_id, riff_of_name, tags, published_by, created_at, updated_at
     FROM global_recipes ORDER BY name ASC`
  ).all();

  const globalRecipes = (globalRows.results || []).map(r => {
    let specs = [];
    try { specs = JSON.parse(r.specs || '[]'); } catch {}
    let tags = [];
    try { tags = JSON.parse(r.tags || '[]'); } catch {}
    return {
      id: r.id,
      name: r.name,
      glassware: r.glassware || 'Rocks',
      method: r.method || 'Stirred',
      specs,
      instructions: r.instructions || '',
      description: r.description || '',
      notes: r.notes || '',
      riffOfId: r.riff_of_id || null,
      riffOfName: r.riff_of_name || '',
      tags,
      publishedBy: r.published_by || 'admin',
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      isGlobal: true,
    };
  });

  // 2. Fetch globally hidden recipe IDs
  const hiddenRows = await env.speakeasy_db.prepare(
    `SELECT recipe_id, hidden_at, reason FROM global_hidden_recipes`
  ).all();

  const globallyHidden = (hiddenRows.results || []).map(r => ({
    recipeId: r.recipe_id,
    hiddenAt: r.hidden_at,
    reason: r.reason || '',
  }));

  // 3. Fetch custom recipes across users so admin can search and publish
  const customRows = await env.speakeasy_db.prepare(
    `SELECT id, user_id, name, glassware, method, specs, instructions, description, notes, riff_of_id, riff_of_name, tags, is_public, updated_at
     FROM custom_recipes
     ORDER BY updated_at DESC`
  ).all();

  const customRecipes = (customRows.results || []).map(r => {
    let specs = [];
    try { specs = JSON.parse(r.specs || '[]'); } catch {}
    let tags = [];
    try { tags = JSON.parse(r.tags || '[]'); } catch {}
    return {
      id: r.id,
      userId: r.user_id,
      name: r.name,
      glassware: r.glassware || 'Rocks',
      method: r.method || 'Stirred',
      specs,
      instructions: r.instructions || '',
      description: r.description || '',
      notes: r.notes || '',
      riffOfId: r.riff_of_id || null,
      riffOfName: r.riff_of_name || '',
      tags,
      isPublic: Boolean(r.is_public),
      updatedAt: r.updated_at,
    };
  });

  return jsonResponse({
    success: true,
    globalRecipes,
    globallyHidden,
    customRecipes,
  });
}

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

  if (!body || !body.name || !body.name.trim()) {
    return jsonResponse({ error: 'Cocktail name is required.' }, 400);
  }

  const recipeId = body.id || `global-${body.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}-${Date.now().toString(36)}`;
  const name = body.name.trim();
  const glassware = body.glassware || 'Coupe';
  const method = body.method || 'Shaken';
  const specsJson = JSON.stringify(Array.isArray(body.specs) ? body.specs : []);
  const instructions = body.instructions || '';
  const description = body.description || '';
  const notes = body.notes || '';
  const riffOfId = body.riffOfId || null;
  const riffOfName = body.riffOfName || null;
  const tagsJson = JSON.stringify(Array.isArray(body.tags) ? body.tags : []);
  const publishedBy = body.publishedBy || 'admin';

  await env.speakeasy_db.prepare(
    `INSERT INTO global_recipes (
      id, name, glassware, method, specs, instructions, description, notes, riff_of_id, riff_of_name, tags, published_by, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      glassware = excluded.glassware,
      method = excluded.method,
      specs = excluded.specs,
      instructions = excluded.instructions,
      description = excluded.description,
      notes = excluded.notes,
      riff_of_id = excluded.riff_of_id,
      riff_of_name = excluded.riff_of_name,
      tags = excluded.tags,
      published_by = excluded.published_by,
      updated_at = CURRENT_TIMESTAMP`
  ).bind(
    recipeId,
    name,
    glassware,
    method,
    specsJson,
    instructions,
    description,
    notes,
    riffOfId,
    riffOfName,
    tagsJson,
    publishedBy
  ).run();

  // If the recipe was previously globally hidden, unhide it on publishing
  await env.speakeasy_db.prepare(
    `DELETE FROM global_hidden_recipes WHERE recipe_id = ?`
  ).bind(recipeId).run();

  return jsonResponse({
    success: true,
    message: `Cocktail "${name}" added to the global library.`,
    recipeId,
  });
}

export async function onRequestDelete(context) {
  const authErr = await checkAdminAuth(context);
  if (authErr) return authErr;

  const { request, env } = context;
  if (!env || !env.speakeasy_db) {
    return jsonResponse({ error: 'Database binding (speakeasy_db) is unavailable.' }, 500);
  }

  const url = new URL(request.url);
  const id = url.searchParams.get('id');

  if (!id) {
    return jsonResponse({ error: 'Recipe id is required.' }, 400);
  }

  await env.speakeasy_db.prepare(
    `DELETE FROM global_recipes WHERE id = ?`
  ).bind(id).run();

  return jsonResponse({
    success: true,
    message: `Recipe "${id}" deleted from global library.`,
  });
}
