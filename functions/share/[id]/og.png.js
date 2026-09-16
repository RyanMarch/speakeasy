/**
 * Cloudflare Pages Function: GET /share/:id/og.png
 *
 * Serves the link-preview image for a shared cocktail. The image itself is
 * rendered client-side at share-creation time (see counter-view.js
 * shareCustomRecipe()) and stored as a PNG blob alongside the share snapshot
 * — rendering it here, server-side, would mean WASM-based SVG rasterization
 * per request, which reliably exceeds the Workers Free plan's 10ms/request
 * CPU budget. So this route's only job is to serve stored bytes (or, for a
 * share with no stored image — an API-created share, or a client that
 * failed to render one — the static generic fallback card).
 */
const SHARE_ID_PATTERN = /^[23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]{1,32}$/;

// D1's BLOB column comes back as an ArrayBuffer in production, but as a
// plain array of byte values under the local Miniflare simulation —
// Response() silently stringifies a plain array instead of sending raw
// bytes, so this normalizes either shape into an actual Uint8Array first.
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

  if (!env || !env.speakeasy_db || !env.ASSETS) {
    return fallbackImage(context);
  }

  const shareId = typeof params.id === 'string' ? params.id.trim() : '';
  if (!shareId || !SHARE_ID_PATTERN.test(shareId)) {
    return fallbackImage(context);
  }

  let row;
  try {
    row = await env.speakeasy_db.prepare(
      `SELECT og_image FROM shares WHERE share_id = ?`
    ).bind(shareId).first();
  } catch {
    row = null;
  }

  if (!row || !row.og_image) {
    return fallbackImage(context);
  }

  return pngBytesResponse(row.og_image);
}
