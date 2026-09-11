/**
 * Cloudflare Pages Function: POST /api/sync
 *
 * Ingestion and synchronization endpoint for Speakeasy unified backup payloads.
 */

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json;charset=utf-8',
    },
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env || !env.speakeasy_db) {
    return jsonResponse({ error: 'Database binding (speakeasy_db) is unavailable.' }, 500);
  }

  // 1. Verify Authorization Bearer token
  const authHeader = request.headers.get('Authorization') || '';
  const tokenMatch = authHeader.match(/^Bearer\s+(.+)$/i);

  if (!tokenMatch) {
    return jsonResponse({ error: 'Missing or malformed Authorization header.' }, 401);
  }

  const token = tokenMatch[1].trim();
  if (!token) {
    return jsonResponse({ error: 'Empty bearer token.' }, 401);
  }

  // Query session from D1
  const sessionRow = await env.speakeasy_db.prepare(
    `SELECT user_id, expires_at FROM sessions WHERE token = ?`
  ).bind(token).first();

  if (!sessionRow) {
    return jsonResponse({ error: 'Invalid or expired session token.' }, 401);
  }

  // Check expiration if expires_at is in the past
  const expiresAt = new Date(sessionRow.expires_at).getTime();
  if (!Number.isNaN(expiresAt) && Date.now() > expiresAt) {
    return jsonResponse({ error: 'Session token has expired.' }, 401);
  }

  const userId = sessionRow.user_id;

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

  // 2. Ensure user has a default "Home Bar"
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

  const statements = [];

  // 3. Insert taxonomy IDs from inventory into bar_inventory
  let inventoryCount = 0;
  if (Array.isArray(payload.inventory)) {
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
      const riffOfId = r.riffOfId || r.riff_of_id || null;
      const riffOfName = r.riffOfName || r.riff_of_name || null;
      const tags = JSON.stringify(Array.isArray(r.tags) ? r.tags : []);
      const isPublic = r.is_public ? 1 : 0;

      statements.push(
        env.speakeasy_db.prepare(
          `INSERT INTO custom_recipes (
             id, user_id, name, glassware, method, specs, instructions,
             description, notes, riff_of_id, riff_of_name, tags, is_public, updated_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
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
          riffOfId,
          riffOfName,
          tags,
          isPublic
        )
      );
    }
  }

  // 5. Update user's settings JSON column if provided
  if (payload.settings && typeof payload.settings === 'object') {
    const settingsJson = JSON.stringify(payload.settings);
    statements.push(
      env.speakeasy_db.prepare(
        `UPDATE users SET settings = ? WHERE id = ?`
      ).bind(settingsJson, userId)
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
    },
  });
}

export async function onRequestGet(context) {
  const { request, env } = context;

  if (!env || !env.speakeasy_db) {
    return jsonResponse({ error: 'Database binding (speakeasy_db) is unavailable.' }, 500);
  }

  // 1. Verify Authorization Bearer token
  const authHeader = request.headers.get('Authorization') || '';
  const tokenMatch = authHeader.match(/^Bearer\s+(.+)$/i);

  if (!tokenMatch) {
    return jsonResponse({ error: 'Missing or malformed Authorization header.' }, 401);
  }

  const token = tokenMatch[1].trim();
  if (!token) {
    return jsonResponse({ error: 'Empty bearer token.' }, 401);
  }

  // Query session from D1
  const sessionRow = await env.speakeasy_db.prepare(
    `SELECT user_id, expires_at FROM sessions WHERE token = ?`
  ).bind(token).first();

  if (!sessionRow) {
    return jsonResponse({ error: 'Invalid or expired session token.' }, 401);
  }

  const expiresAt = new Date(sessionRow.expires_at).getTime();
  if (!Number.isNaN(expiresAt) && Date.now() > expiresAt) {
    return jsonResponse({ error: 'Session token has expired.' }, 401);
  }

  const userId = sessionRow.user_id;

  // 2. Query user's default or first bar
  const defaultBar = await env.speakeasy_db.prepare(
    `SELECT id, name FROM bars WHERE user_id = ? ORDER BY is_default DESC, created_at ASC LIMIT 1`
  ).bind(userId).first();

  let inventory = [];
  if (defaultBar && defaultBar.id) {
    const invRows = await env.speakeasy_db.prepare(
      `SELECT ingredient_id FROM bar_inventory WHERE bar_id = ?`
    ).bind(defaultBar.id).all();
    inventory = (invRows.results || []).map(row => row.ingredient_id);
  }

  // 3. Query custom recipes
  const recipeRows = await env.speakeasy_db.prepare(
    `SELECT id, name, glassware, method, specs, instructions, description, notes, riff_of_id, riff_of_name, tags, is_public
     FROM custom_recipes WHERE user_id = ?`
  ).bind(userId).all();

  const customRecipes = (recipeRows.results || []).map(r => {
    let specs = [];
    try {
      specs = JSON.parse(r.specs || '[]');
    } catch {
      specs = [];
    }
    let tags = [];
    try {
      tags = JSON.parse(r.tags || '[]');
    } catch {
      tags = [];
    }
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
      isPublic: Boolean(r.is_public),
    };
  });

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

  return jsonResponse({
    success: true,
    backup: {
      version: 1,
      exportedAt: new Date().toISOString(),
      inventory,
      hiddenRecipes: [],
      settings,
      customRecipes,
    },
  });
}

