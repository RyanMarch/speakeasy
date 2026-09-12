/**
 * Cloudflare Pages Function: POST /api/shares
 *
 * Creates a public, read-only, point-in-time snapshot of a custom cocktail
 * recipe and returns a short shareable link. No authentication required —
 * guests can share too, since the snapshot is independent of any account.
 */

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json;charset=utf-8',
    },
  });
}

// Unambiguous base58-style alphabet (no 0/O/l/I) for short, easy-to-read,
// hard-to-guess share ids. 10 chars ~= 58.6 bits of entropy.
const SHARE_ID_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const SHARE_ID_LENGTH = 10;
const MAX_RECIPE_JSON_BYTES = 50 * 1024;
const MAX_ARRAY_ITEMS = 100;

function generateShareId() {
  const bytes = new Uint8Array(SHARE_ID_LENGTH);
  crypto.getRandomValues(bytes);
  let id = '';
  for (let i = 0; i < SHARE_ID_LENGTH; i++) {
    id += SHARE_ID_ALPHABET[bytes[i] % SHARE_ID_ALPHABET.length];
  }
  return id;
}

function sanitizeSharedRecipe(body) {
  if (!body || typeof body !== 'object') return null;
  if (typeof body.name !== 'string' || !body.name.trim()) return null;

  const tags = Array.isArray(body.tags)
    ? Array.from(new Set(body.tags.map(t => String(t).trim().toLowerCase()).filter(Boolean))).slice(0, MAX_ARRAY_ITEMS)
    : [];

  const specs = Array.isArray(body.specs)
    ? body.specs.slice(0, MAX_ARRAY_ITEMS).map(s => ({
        amount: s && s.amount !== null && s.amount !== undefined && !isNaN(Number(s.amount)) ? Number(s.amount) : null,
        unit: (s && typeof s.unit === 'string') ? s.unit : '',
        name: (s && typeof s.name === 'string') ? s.name : '',
        abv: s && s.abv !== null && s.abv !== undefined && !isNaN(Number(s.abv)) ? Number(s.abv) : undefined,
      }))
    : [];

  return {
    name: body.name.trim(),
    glassware: typeof body.glassware === 'string' ? body.glassware : 'Rocks',
    method: typeof body.method === 'string' ? body.method : 'Stirred',
    instructions: typeof body.instructions === 'string' ? body.instructions : '',
    description: typeof body.description === 'string' ? body.description : '',
    notes: typeof body.notes === 'string' ? body.notes : '',
    riffOfId: typeof body.riffOfId === 'string' ? body.riffOfId : null,
    riffOfName: typeof body.riffOfName === 'string' ? body.riffOfName : '',
    tags,
    specs,
  };
}

export async function onRequestPost(context) {
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

  const recipe = sanitizeSharedRecipe(body);
  if (!recipe) {
    return jsonResponse({ error: 'A recipe with a non-empty name is required.' }, 400);
  }

  const recipeJson = JSON.stringify(recipe);
  if (recipeJson.length > MAX_RECIPE_JSON_BYTES) {
    return jsonResponse({ error: 'Recipe payload is too large to share.' }, 400);
  }

  let shareId = null;
  const MAX_ATTEMPTS = 5;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const candidate = generateShareId();
    try {
      await env.speakeasy_db.prepare(
        `INSERT INTO shares (share_id, recipe) VALUES (?, ?)`
      ).bind(candidate, recipeJson).run();
      shareId = candidate;
      break;
    } catch (err) {
      // Primary key collision — vanishingly unlikely at this id space, but
      // retry rather than fail outright. Any other DB error should surface.
      if (attempt === MAX_ATTEMPTS - 1) {
        return jsonResponse({ error: 'Failed to create share link. Please try again.' }, 500);
      }
    }
  }

  const origin = new URL(request.url).origin;
  return jsonResponse({
    success: true,
    shareId,
    url: `${origin}/#share/${shareId}`,
  });
}
