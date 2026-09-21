/**
 * Cloudflare Pages Function: POST /api/shares
 *
 * Creates a public, read-only, point-in-time snapshot of a custom cocktail
 * recipe and returns a short shareable link. No authentication required —
 * guests can share too, since the snapshot is independent of any account.
 */

import { jsonResponse } from '../_lib/http.js';
import { generateShareId, sanitizeSharedRecipe } from './_lib.js';

const MAX_RECIPE_JSON_BYTES = 50 * 1024;
// The link-preview image is rendered client-side (see counter-view.js
// shareCustomRecipe()) — a 1200x630 PNG of this card design typically lands
// well under 200KB; this is a generous ceiling against a malformed/oversized
// upload, not a tuned budget.
const MAX_OG_IMAGE_BYTES = 500 * 1024;

/**
 * Decodes the client's `data:image/png;base64,...` (or bare base64) upload
 * into raw bytes for the D1 BLOB column. Returns null for anything missing,
 * malformed, oversized, or not actually a PNG — a bad/oversized image should
 * never fail the whole share, it should just leave og_image empty so
 * /share/:id/og.png falls back to the static generic card.
 */
function decodeOgImage(ogImageBase64) {
  if (typeof ogImageBase64 !== 'string' || !ogImageBase64) return null;
  const base64 = ogImageBase64.replace(/^data:image\/png;base64,/, '');
  // Rough pre-check before the (more expensive) decode: base64 is ~4/3 the
  // size of the decoded bytes.
  if (base64.length > MAX_OG_IMAGE_BYTES * 1.4) return null;

  let binary;
  try {
    binary = atob(base64);
  } catch {
    return null;
  }
  if (binary.length > MAX_OG_IMAGE_BYTES) return null;

  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

  // PNG signature check — cheap guard against storing garbage.
  const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  const isPng = PNG_SIGNATURE.every((byte, i) => bytes[i] === byte);
  return isPng ? bytes : null;
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

  const ogImage = decodeOgImage(body.ogImageBase64);

  let shareId = null;
  const MAX_ATTEMPTS = 5;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const candidate = generateShareId();
    try {
      await env.speakeasy_db.prepare(
        `INSERT INTO shares (share_id, recipe, og_image) VALUES (?, ?, ?)`
      ).bind(candidate, recipeJson, ogImage).run();
      shareId = candidate;
      break;
    } catch (err) {
      console.error('shares INSERT failed:', err && err.stack || err);
      // Primary key collision — vanishingly unlikely at this id space, but
      // retry rather than fail outright. Any other DB error should surface.
      if (attempt === MAX_ATTEMPTS - 1) {
        return jsonResponse({ error: 'Failed to create share link. Please try again.' }, 500);
      }
    }
  }

  // The link handed to the user must be the crawler-visible /share/:id shell
  // (functions/share/[id].js), not the /app#share/:id hash route — a link
  // unfurler never sees anything after "#", so the hash route would always
  // show the generic site preview regardless of how much work went into the
  // OG image. /share/:id itself redirects a real visitor straight into
  // /app#share/:id, so this doesn't change the in-app experience at all.
  const origin = new URL(request.url).origin;
  return jsonResponse({
    success: true,
    shareId,
    url: `${origin}/share/${shareId}`,
  });
}
