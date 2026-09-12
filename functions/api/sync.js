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

  const statements = [];
  let inventoryCount = 0;
  let barsCount = 0;

  // 2. Upsert bars + their inventories, if provided as a multi-bar payload
  if (Array.isArray(payload.bars) && payload.bars.length > 0) {
    const validBars = payload.bars.filter(
      b => b && typeof b === 'object' && typeof b.id === 'string' && b.id.trim().length > 0
    );
    barsCount = validBars.length;

    for (const b of validBars) {
      const barId = b.id;
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

      const uniqueTaxonomyIds = Array.from(
        new Set((b.inventory || []).filter(id => typeof id === 'string' && id.trim().length > 0))
      );
      inventoryCount += uniqueTaxonomyIds.length;

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
      bars: barsCount,
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
      version: 2,
      exportedAt: new Date().toISOString(),
      bars,
      hiddenRecipes: [],
      settings,
      customRecipes,
    },
  });
}

