/**
 * Cloudflare Pages Function: POST /api/sync
 *
 * Ingestion and synchronization endpoint for Speakeasy unified backup payloads.
 */

import { jsonResponse } from './_lib/http.js';
import { requireSession } from './_lib/auth.js';
import { mapRecipeRow } from './_lib/recipes.js';
import { mergeMenuSets } from '../../public/js/modules/menu-merge.js';
import { mergeInventory } from '../../public/js/modules/inventory-merge.js';

function parseSettings(value) {
  if (!value) return {};
  try {
    const parsed = typeof value === 'object' ? value : JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env || !env.speakeasy_db) {
    return jsonResponse({ error: 'Database binding (speakeasy_db) is unavailable.' }, 500);
  }

  // 1. Verify session
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;
  const { userId } = session;

  // Parse payload
  let payload;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body.' }, 400);
  }

  if (!payload || typeof payload !== 'object') {
    return jsonResponse({ error: 'Payload must be a JSON object.' }, 400);
  }

  const statements = [];
  let inventoryCount = 0;
  let barsCount = 0;

  // The user's stored settings JSON also holds the sync bookkeeping that doesn't
  // have a table of its own (saved menus, and when bottles were added or removed).
  // Read it once; the bars below and the settings write at the end both use it.
  const settingsRow = await env.speakeasy_db.prepare(
    `SELECT settings FROM users WHERE id = ?`
  ).bind(userId).first();
  const currentSettings = parseSettings(settingsRow && settingsRow.settings);
  const inventorySync = { ...(currentSettings.inventorySync && typeof currentSettings.inventorySync === 'object' ? currentSettings.inventorySync : {}) };
  let inventorySyncChanged = false;

  // 2. Upsert bars + their inventories, if provided as a multi-bar payload
  if (Array.isArray(payload.bars) && payload.bars.length > 0) {
    const validBars = payload.bars.filter(
      b => b && typeof b === 'object' && typeof b.id === 'string' && b.id.trim().length > 0
    );
    barsCount = validBars.length;

    // Guard against a client-supplied barId belonging to another user: the
    // `bars` upsert below already no-ops on a foreign id (its WHERE clause
    // only updates rows owned by this user), but bar_inventory writes have no
    // such check of their own, so a foreign id must never reach them either.
    const requestedIds = validBars.map(b => b.id);
    const existingOwners = new Map();
    if (requestedIds.length > 0) {
      const placeholders = requestedIds.map(() => '?').join(',');
      const ownerRows = await env.speakeasy_db.prepare(
        `SELECT id, user_id FROM bars WHERE id IN (${placeholders})`
      ).bind(...requestedIds).all();
      for (const row of (ownerRows.results || [])) {
        existingOwners.set(row.id, row.user_id);
      }
    }

    for (const b of validBars) {
      const barId = b.id;
      const owner = existingOwners.get(barId);
      const isOwnedByCaller = owner === undefined || owner === userId;

      const name = (typeof b.name === 'string' && b.name.trim()) || 'Home Bar';
      const isDefault = b.isDefault ? 1 : 0;

      statements.push(
        env.speakeasy_db.prepare(
          `INSERT INTO bars (id, user_id, name, is_default) VALUES (?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             name = excluded.name,
             is_default = excluded.is_default
           WHERE bars.user_id = excluded.user_id`
        ).bind(barId, userId, name, isDefault)
      );

      if (!isOwnedByCaller) continue;

      const uniqueTaxonomyIds = Array.from(
        new Set((b.inventory || []).filter(id => typeof id === 'string' && id.trim().length > 0))
      );

      // Merge with the bottles already stored instead of only adding: a bottle
      // this device removed on purpose is removed here too, and a device that
      // simply hasn't heard about a removal can't put it back.
      const existingRows = await env.speakeasy_db.prepare(
        `SELECT ingredient_id FROM bar_inventory WHERE bar_id = ?`
      ).bind(barId).all();
      const existingIds = (existingRows.results || []).map(r => r.ingredient_id);
      const merged = mergeInventory(
        { items: existingIds, ...inventorySync[barId] },
        { items: uniqueTaxonomyIds, ...(payload.inventoryChanges && payload.inventoryChanges[barId]) },
      );
      inventoryCount += merged.items.length;

      const stored = new Set(existingIds);
      const keep = new Set(merged.items);
      for (const ingredientId of merged.items) {
        if (stored.has(ingredientId)) continue;
        statements.push(
          env.speakeasy_db.prepare(
            `INSERT INTO bar_inventory (bar_id, ingredient_id, is_low_stock)
             VALUES (?, ?, 0)
             ON CONFLICT(bar_id, ingredient_id) DO NOTHING`
          ).bind(barId, ingredientId)
        );
      }
      for (const ingredientId of existingIds) {
        if (keep.has(ingredientId)) continue;
        statements.push(
          env.speakeasy_db.prepare(
            `DELETE FROM bar_inventory WHERE bar_id = ? AND ingredient_id = ?`
          ).bind(barId, ingredientId)
        );
      }
      if (Object.keys(merged.added).length > 0 || Object.keys(merged.removed).length > 0) {
        inventorySync[barId] = { added: merged.added, removed: merged.removed };
      } else {
        delete inventorySync[barId];
      }
      inventorySyncChanged = true;
    }
  } else if (Array.isArray(payload.inventory)) {
    // Legacy v1 client fallback: upsert into the single default bar.
    let defaultBar = await env.speakeasy_db.prepare(
      `SELECT id FROM bars WHERE user_id = ? ORDER BY is_default DESC, created_at ASC LIMIT 1`
    ).bind(userId).first();

    let barId = defaultBar?.id;
    if (!barId) {
      barId = `bar-${crypto.randomUUID()}`;
      await env.speakeasy_db.prepare(
        `INSERT INTO bars (id, user_id, name, is_default) VALUES (?, ?, 'Home Bar', 1)`
      ).bind(barId, userId).run();
    }

    const uniqueTaxonomyIds = Array.from(
      new Set(payload.inventory.filter(id => typeof id === 'string' && id.trim().length > 0))
    );
    inventoryCount = uniqueTaxonomyIds.length;

    for (const ingredientId of uniqueTaxonomyIds) {
      statements.push(
        env.speakeasy_db.prepare(
          `INSERT INTO bar_inventory (bar_id, ingredient_id, is_low_stock)
           VALUES (?, ?, 0)
           ON CONFLICT(bar_id, ingredient_id) DO NOTHING`
        ).bind(barId, ingredientId)
      );
    }
  }

  // 4. Insert recipes from customRecipes into custom_recipes
  let recipeCount = 0;
  if (Array.isArray(payload.customRecipes)) {
    const validRecipes = payload.customRecipes.filter(
      r => r && typeof r === 'object' && typeof r.name === 'string' && r.name.trim().length > 0
    );
    recipeCount = validRecipes.length;

    for (const r of validRecipes) {
      const recipeId = r.id || `custom-${crypto.randomUUID()}`;
      const name = r.name.trim();
      const glassware = typeof r.glassware === 'string' ? r.glassware : null;
      const method = typeof r.method === 'string' ? r.method : null;
      const specs = JSON.stringify(Array.isArray(r.specs) ? r.specs : []);
      const instructions = typeof r.instructions === 'string' ? r.instructions : (typeof r.notes === 'string' ? r.notes : null);
      const description = typeof r.description === 'string' ? r.description : null;
      const notes = typeof r.notes === 'string' ? r.notes : null;
      const garnish = typeof r.garnish === 'string' ? r.garnish : null;
      const source = typeof r.source === 'string' ? r.source : null;
      const sourceUrl = typeof r.sourceUrl === 'string' ? r.sourceUrl : null;
      const riffOfId = r.riffOfId || r.riff_of_id || null;
      const riffOfName = r.riffOfName || r.riff_of_name || null;
      const tags = JSON.stringify(Array.isArray(r.tags) ? r.tags : []);
      const isPublic = r.is_public ? 1 : 0;

      statements.push(
        env.speakeasy_db.prepare(
          `INSERT INTO custom_recipes (
             id, user_id, name, glassware, method, specs, instructions,
             description, notes, garnish, source, source_url, riff_of_id, riff_of_name, tags, is_public, updated_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
           ON CONFLICT(id) DO UPDATE SET
             name = excluded.name,
             glassware = excluded.glassware,
             method = excluded.method,
             specs = excluded.specs,
             instructions = excluded.instructions,
             description = excluded.description,
             notes = excluded.notes,
             garnish = excluded.garnish,
             source = excluded.source,
             source_url = excluded.source_url,
             riff_of_id = excluded.riff_of_id,
             riff_of_name = excluded.riff_of_name,
             tags = excluded.tags,
             is_public = excluded.is_public,
             updated_at = CURRENT_TIMESTAMP
           WHERE custom_recipes.user_id = excluded.user_id`
        ).bind(
          recipeId,
          userId,
          name,
          glassware,
          method,
          specs,
          instructions,
          description,
          notes,
          garnish,
          source,
          sourceUrl,
          riffOfId,
          riffOfName,
          tags,
          isPublic
        )
      );
    }
  }

  // 5. Update user's settings JSON column if provided. Saved menus ride along in
  // the same JSON (under `menuSync`), so this needs no schema change: they're
  // merged with what's already stored rather than replaced, so one device can
  // never wipe the menus another one built.
  const hasSettings = payload.settings && typeof payload.settings === 'object';
  const hasMenus = Array.isArray(payload.menus) || (payload.deletedMenus && typeof payload.deletedMenus === 'object');
  if (hasSettings || hasMenus || inventorySyncChanged) {
    const current = currentSettings;
    const next = hasSettings ? { ...payload.settings } : { ...current };
    // Stored bookkeeping is kept even when this client doesn't know about it (older app).
    delete next.menuSync;
    delete next.inventorySync;
    const merged = mergeMenuSets(
      current.menuSync,
      hasMenus ? { menus: payload.menus, deleted: payload.deletedMenus } : {},
    );
    if (merged.menus.length > 0 || Object.keys(merged.deleted).length > 0) next.menuSync = merged;
    if (Object.keys(inventorySync).length > 0) next.inventorySync = inventorySync;
    statements.push(
      env.speakeasy_db.prepare(
        `UPDATE users SET settings = ? WHERE id = ?`
      ).bind(JSON.stringify(next), userId)
    );
  }

  if (statements.length > 0) {
    await env.speakeasy_db.batch(statements);
  }

  // 6. Return response
  return jsonResponse({
    success: true,
    imported: {
      recipes: recipeCount,
      inventory: inventoryCount,
      bars: barsCount,
    },
  });
}

export async function onRequestGet(context) {
  const { request, env } = context;

  if (!env || !env.speakeasy_db) {
    return jsonResponse({ error: 'Database binding (speakeasy_db) is unavailable.' }, 500);
  }

  // 1. Verify session
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;
  const { userId } = session;

  // 2. Query all of the user's bars, repairing an early-rollout data issue
  // first: before bar identity was reconciled correctly on import, a
  // pre-existing single-bar account's real cloud "Home Bar" and a freshly
  // (re-)migrated client could each mint their own bar row, producing two
  // rows both literally named "Home Bar" for the same user. Detect and
  // merge that specific pattern before returning bars, so affected
  // accounts self-heal on their next sync.
  let barRows = await env.speakeasy_db.prepare(
    `SELECT id, name, is_default, created_at FROM bars WHERE user_id = ? ORDER BY is_default DESC, created_at ASC`
  ).bind(userId).all();
  let barList = barRows.results || [];

  const homeBarDupes = barList.filter(b => b.name === 'Home Bar');
  if (homeBarDupes.length > 1) {
    const canonical = homeBarDupes.slice().sort((a, b) => a.created_at.localeCompare(b.created_at))[0];
    const duplicateIds = homeBarDupes.filter(b => b.id !== canonical.id).map(b => b.id);

    const repairStatements = [];
    for (const dupId of duplicateIds) {
      repairStatements.push(
        env.speakeasy_db.prepare(
          `INSERT INTO bar_inventory (bar_id, ingredient_id, is_low_stock)
           SELECT ?, ingredient_id, is_low_stock FROM bar_inventory WHERE bar_id = ?
           ON CONFLICT(bar_id, ingredient_id) DO NOTHING`
        ).bind(canonical.id, dupId)
      );
    }
    repairStatements.push(
      env.speakeasy_db.prepare(`UPDATE bars SET is_default = 1 WHERE id = ?`).bind(canonical.id)
    );
    for (const dupId of duplicateIds) {
      repairStatements.push(env.speakeasy_db.prepare(`DELETE FROM bars WHERE id = ?`).bind(dupId));
    }
    await env.speakeasy_db.batch(repairStatements);

    barRows = await env.speakeasy_db.prepare(
      `SELECT id, name, is_default, created_at FROM bars WHERE user_id = ? ORDER BY is_default DESC, created_at ASC`
    ).bind(userId).all();
    barList = barRows.results || [];
  }

  const bars = [];
  for (const row of barList) {
    const invRows = await env.speakeasy_db.prepare(
      `SELECT ingredient_id FROM bar_inventory WHERE bar_id = ?`
    ).bind(row.id).all();
    bars.push({
      id: row.id,
      name: row.name,
      isDefault: Boolean(row.is_default),
      inventory: (invRows.results || []).map(r => r.ingredient_id),
    });
  }

  // 3. Query custom recipes
  const recipeRows = await env.speakeasy_db.prepare(
    `SELECT id, name, glassware, method, specs, instructions, description, notes, garnish, source, source_url, riff_of_id, riff_of_name, tags, is_public
     FROM custom_recipes WHERE user_id = ?`
  ).bind(userId).all();

  const customRecipes = (recipeRows.results || []).map(r => mapRecipeRow(r, { includeIsPublic: true }));

  // 4. Query user settings
  const userRow = await env.speakeasy_db.prepare(
    `SELECT settings FROM users WHERE id = ?`
  ).bind(userId).first();

  let settings = { unitPref: 'oz', sortPref: 'curated', glassViewMode: 'layered' };
  if (userRow && userRow.settings) {
    try {
      settings = typeof userRow.settings === 'object' ? userRow.settings : JSON.parse(userRow.settings);
    } catch {
      // Keep default settings
    }
  }
  // Saved menus travel inside the settings JSON; hand them back as their own
  // fields, like the rest of a backup, and keep them out of `settings`.
  const { menuSync, inventorySync, ...settingsWithoutBookkeeping } = settings && typeof settings === 'object' ? settings : {};
  settings = settingsWithoutBookkeeping;

  // 5. Query active global recipes and globally hidden recipes
  let globalRecipes = [];
  let globallyHiddenIds = [];

  try {
    const globalRows = await env.speakeasy_db.prepare(
      `SELECT id, name, glassware, method, specs, instructions, description, notes, garnish, source, source_url, riff_of_id, riff_of_name, tags
       FROM global_recipes`
    ).all();

    globalRecipes = (globalRows.results || []).map(r => mapRecipeRow(r, { isGlobal: true }));

    const hiddenRows = await env.speakeasy_db.prepare(
      `SELECT recipe_id FROM global_hidden_recipes`
    ).all();
    globallyHiddenIds = (hiddenRows.results || []).map(r => r.recipe_id);
  } catch (err) {
    // If table hasn't migrated yet or query fails, fail soft
    console.warn('Could not query global recipes or hidden recipes:', err);
  }

  return jsonResponse({
    success: true,
    backup: {
      version: 2,
      exportedAt: new Date().toISOString(),
      bars,
      hiddenRecipes: [],
      settings,
      menus: Array.isArray(menuSync?.menus) ? menuSync.menus : [],
      deletedMenus: menuSync?.deleted && typeof menuSync.deleted === 'object' ? menuSync.deleted : {},
      inventoryChanges: inventorySync && typeof inventorySync === 'object' ? inventorySync : {},
      customRecipes,
      globalRecipes,
      globallyHiddenIds,
    },
  });
}

