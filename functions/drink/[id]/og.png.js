/**
 * Cloudflare Pages Function: GET /drink/:id/og.png
 *
 * Seed cocktails have no client-render-at-share-time step the way custom
 * recipes do (see functions/share/[id]/og.png.js, which stores/serves a
 * real per-recipe image a user's browser generated) — there's no "share
 * creation" moment to render one at. Instead, every seed cocktail's card
 * (including its glassware art) is pre-rendered once, offline, by
 * scripts/generate-seed-og-images.js and bulk-loaded into the
 * seed_drink_images table (migrations/0010_add_seed_drink_images.sql) —
 * same zero-runtime-cost idea as the static fallback this route used to
 * serve unconditionally, just keyed by recipe id instead of a single file.
 */
function toUint8Array(value) {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (Array.isArray(value)) return new Uint8Array(value);
  return null;
}

function pngBytesResponse(rawBytes) {
  const bytes = toUint8Array(rawBytes);
  return new Response(bytes, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}

function fallbackImage(context) {
  return context.env.ASSETS.fetch(new URL('/assets/og-fallback.png', context.request.url));
}

export async function onRequestGet(context) {
  const { params, env } = context;

  const recipeId = typeof params.id === 'string' ? params.id.trim() : '';
  if (!recipeId || !env || !env.speakeasy_db || !env.ASSETS) {
    return fallbackImage(context);
  }

  let row;
  try {
    row = await env.speakeasy_db.prepare(
      `SELECT og_image FROM seed_drink_images WHERE recipe_id = ?`
    ).bind(recipeId).first();
  } catch {
    row = null;
  }

  if (!row || !row.og_image) {
    return fallbackImage(context);
  }

  return pngBytesResponse(row.og_image);
}
