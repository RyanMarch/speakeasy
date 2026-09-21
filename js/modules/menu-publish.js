/**
 * Speakeasy Guest Menu Publishing (Hosting Mode)
 * Client for /api/menus: publish a saved menu as a public guest link, keep it
 * in sync as the host edits it or marks drinks "out", and unpublish it.
 *
 * The edit token returned at publish time is the host's only credential. It
 * lives on the saved menu (menu.share) and is never shown to guests.
 */

// Public QR renderer (a separate Ryan March project). Encodes only the guest
// URL, which is already public by design. If the service is unreachable the
// link itself still works, so the UI treats the image as a nice-to-have.
const QR_ENDPOINT = 'https://qrmaker.ryanmarch.me/api/qr';

export function guestMenuUrl(menuId) {
  return `${window.location.origin}/menu/${menuId}`;
}

export function qrImageUrl(content, size = 480) {
  const params = new URLSearchParams({
    content,
    format: 'svg',
    size: String(size),
    margin: '2',
    ecl: 'M',
    fgColor: '020f20',
    bgColor: 'ffffff',
    cornerStyle: 'rounded',
  });
  return `${QR_ENDPOINT}?${params.toString()}`;
}

// Same alphabet/length as the server's menu ids (functions/api/shares/_lib.js).
const MENU_CODE_PATTERN = /^[23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]{10}$/;

/**
 * Pulls a menu id out of whatever a guest typed or pasted: the bare code, a
 * /menu/<id> link, or an /app#menu/<id> link. Returns null if it isn't one.
 * Ids are case-sensitive, so the case is preserved.
 */
export function parseMenuCode(input) {
  const text = String(input || '').trim();
  if (MENU_CODE_PATTERN.test(text)) return text;
  const match = text.match(/(?:\/menu\/|#menu\/)([^/?#\s]+)/);
  return match && MENU_CODE_PATTERN.test(match[1]) ? match[1] : null;
}

function toSnapshot(recipe) {
  return {
    id: recipe.id,
    name: recipe.name,
    glassware: recipe.glassware,
    method: recipe.method,
    garnish: recipe.garnish,
    instructions: recipe.instructions,
    description: recipe.description,
    source: recipe.source,
    sourceUrl: recipe.sourceUrl,
    riffOfName: recipe.riffOfName,
    tags: recipe.tags,
    specs: recipe.specs,
  };
}

async function requestJson(url, options) {
  let response;
  try {
    response = await fetch(url, options);
  } catch {
    throw new Error('Could not reach Speakeasy — check your connection and try again.');
  }
  let data = null;
  try {
    data = await response.json();
  } catch {
    // Non-JSON error body; fall through to the generic message.
  }
  if (!response.ok || !data || data.success === false) {
    throw new Error((data && data.error) || 'Something went wrong. Please try again.');
  }
  return data;
}

function authHeaders(share) {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${share.token}` };
}

/** Publish `recipes` under `name`. Resolves to the `share` record to store on the menu. */
export async function publishMenu(name, recipes) {
  const data = await requestJson('/api/menus', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, recipes: recipes.map(toSnapshot) }),
  });
  return { id: data.menuId, token: data.editToken, outIds: [] };
}

/** Push a menu's current name + drinks to its guest link. */
export function pushMenuContents(share, name, recipes) {
  return requestJson(`/api/menus/${encodeURIComponent(share.id)}`, {
    method: 'PUT',
    headers: authHeaders(share),
    body: JSON.stringify({ name, recipes: recipes.map(toSnapshot), unavailable: share.outIds || [] }),
  });
}

/** Push just the "out" list — the fast path for a mid-party toggle. */
export function pushMenuAvailability(share, outIds) {
  return requestJson(`/api/menus/${encodeURIComponent(share.id)}`, {
    method: 'PUT',
    headers: authHeaders(share),
    body: JSON.stringify({ unavailable: outIds }),
  });
}

export function unpublishMenu(share) {
  return requestJson(`/api/menus/${encodeURIComponent(share.id)}`, {
    method: 'DELETE',
    headers: authHeaders(share),
  });
}

/** Public fetch used by the guest menu page. */
export async function fetchGuestMenu(menuId) {
  const data = await requestJson(`/api/menus/${encodeURIComponent(menuId)}`, { cache: 'no-store' });
  return data.menu;
}
