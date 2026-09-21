/**
 * Shared helpers for the published guest-menu endpoints (/api/menus and
 * /api/menus/:id). Menu ids reuse the share-link alphabet/length so guest
 * links look and behave like every other Speakeasy link.
 */

import { SHARE_ID_ALPHABET, SHARE_ID_PATTERN, generateShareId, sanitizeSharedRecipe } from '../shares/_lib.js';

export { SHARE_ID_PATTERN as MENU_ID_PATTERN, generateShareId as generateMenuId };

const MAX_MENU_RECIPES = 100;
const MAX_MENU_JSON_BYTES = 300 * 1024;
const MAX_NAME_LENGTH = 80;

export function generateEditToken() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  let token = '';
  for (let i = 0; i < bytes.length; i++) {
    token += SHARE_ID_ALPHABET[bytes[i] % SHARE_ID_ALPHABET.length];
  }
  return token;
}

export async function hashEditToken(token) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(token)));
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Hash comparison on fixed-length hex strings; avoids an early exit on the
// first differing character.
export function hashesMatch(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function extractEditToken(request) {
  const header = request.headers.get('Authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : '';
}

export function sanitizeMenuName(name) {
  return typeof name === 'string' ? name.trim().slice(0, MAX_NAME_LENGTH) : '';
}

/**
 * Sanitizes a menu's recipe snapshots. Each keeps the id the host's library
 * uses (the guest page needs a stable handle for "out" toggles and deep links),
 * but everything else goes through the same allow-list as single-recipe shares.
 * Returns null for a malformed list; recipes that fail sanitizing are dropped.
 */
export function sanitizeMenuRecipes(recipes) {
  if (!Array.isArray(recipes)) return null;
  const seen = new Set();
  const cleaned = [];
  for (const raw of recipes.slice(0, MAX_MENU_RECIPES)) {
    const recipe = sanitizeSharedRecipe(raw);
    const id = raw && (typeof raw.id === 'string' || typeof raw.id === 'number') ? String(raw.id).slice(0, 80) : '';
    if (!recipe || !id || seen.has(id)) continue;
    seen.add(id);
    // Notes are the host's private scratchpad ("too sweet last time") —
    // never part of what a guest sees.
    cleaned.push({ ...recipe, id, notes: '' });
  }
  const json = JSON.stringify(cleaned);
  if (json.length > MAX_MENU_JSON_BYTES) return null;
  return cleaned;
}

export function sanitizeUnavailable(ids, recipes) {
  if (!Array.isArray(ids)) return [];
  const valid = new Set(recipes.map(r => r.id));
  return Array.from(new Set(ids.map(String))).filter(id => valid.has(id));
}
