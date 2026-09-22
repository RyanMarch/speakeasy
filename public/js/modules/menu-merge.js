/**
 * Speakeasy saved-menu sync
 * Merges two copies of a user's saved menus (this device's and the cloud's) so a
 * menu built on one device shows up on the others, and a deleted one stays
 * deleted. Pure functions with no browser or server dependencies: the app merges
 * with what it pulled, and /api/sync merges with what it already holds.
 *
 * A copy is `{ menus: Menu[], deleted: { [menuId]: deletedAtMs } }`.
 *   - Menus are matched by id; whichever was saved last wins (`updatedAt`, falling
 *     back to `createdAt` for menus saved before that field existed).
 *   - A deletion is remembered as a tombstone, and beats any copy of that menu
 *     saved before it, so a stale device can't bring a deleted menu back. Saving
 *     the menu again afterward does bring it back.
 * Nothing here ever removes a menu that has no tombstone, so merging can't lose one.
 */

import { sanitizeDietOverrides } from './dietary.js';

const MAX_MENUS = 100;
const MAX_TOMBSTONES = 200;
const MAX_TEXT = 80;

const num = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0);
const ids = (list) => (Array.isArray(list) ? list.map(String) : []);

/** The time a menu was last saved. */
export function menuStamp(menu) {
  return num(menu?.updatedAt) || num(menu?.createdAt);
}

/** A well-formed copy of a menu (guest-link credentials included), or null if it isn't one. */
export function normalizeMenu(raw) {
  if (!raw || typeof raw !== 'object') return null;
  if (typeof raw.id !== 'string' || !raw.id.trim() || typeof raw.name !== 'string' || !Array.isArray(raw.recipeIds)) return null;
  const menu = {
    id: raw.id.slice(0, MAX_TEXT),
    name: raw.name.trim().slice(0, MAX_TEXT) || 'Untitled Menu',
    recipeIds: Array.from(new Set(ids(raw.recipeIds))).slice(0, MAX_MENUS),
    createdAt: num(raw.createdAt),
    updatedAt: num(raw.updatedAt),
  };
  // An "Always Ready" menu (see modules/ready-menu.js): pinned to one bar, whose
  // id is shared across devices the same way any other bar id is.
  if (raw.dynamic === 'ready' && typeof raw.readyBarId === 'string' && raw.readyBarId.trim()) {
    menu.dynamic = 'ready';
    menu.readyBarId = raw.readyBarId.trim().slice(0, MAX_TEXT);
  }
  const share = raw.share;
  if (share && typeof share.id === 'string' && typeof share.token === 'string') {
    const dietOverrides = sanitizeDietOverrides(share.dietOverrides);
    menu.share = {
      id: share.id,
      token: share.token,
      outIds: ids(share.outIds),
      featuredIds: ids(share.featuredIds),
      ...(Object.keys(dietOverrides).length > 0 ? { dietOverrides } : {}),
    };
  }
  return menu;
}

function normalizeTombstones(raw) {
  const clean = {};
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    for (const [id, at] of Object.entries(raw)) {
      if (num(at) > 0) clean[String(id).slice(0, MAX_TEXT)] = num(at);
    }
  }
  return clean;
}

/**
 * @param {{ menus?: object[], deleted?: object }} a  e.g. this device
 * @param {{ menus?: object[], deleted?: object }} b  e.g. the cloud
 * @returns {{ menus: object[], deleted: object }}
 */
export function mergeMenuSets(a, b) {
  const deleted = { ...normalizeTombstones(a?.deleted) };
  for (const [id, at] of Object.entries(normalizeTombstones(b?.deleted))) {
    deleted[id] = Math.max(deleted[id] || 0, at);
  }

  // Keeps `a`'s order (then `b`'s new menus after it), and on a tie prefers `a`.
  const byId = new Map();
  for (const raw of [...(a?.menus || []), ...(b?.menus || [])]) {
    const menu = normalizeMenu(raw);
    if (!menu) continue;
    const current = byId.get(menu.id);
    if (!current || menuStamp(menu) > menuStamp(current)) {
      // Replace in place so the list doesn't reshuffle when a copy is updated.
      byId.set(menu.id, menu);
    }
  }

  const menus = [...byId.values()].filter(menu => !(deleted[menu.id] >= menuStamp(menu) && deleted[menu.id] > 0));
  const keep = new Set(menus.map(m => m.id));
  // A tombstone whose menu was saved again afterward has done its job.
  for (const id of Object.keys(deleted)) {
    if (keep.has(id)) delete deleted[id];
  }

  const newestTombstones = Object.entries(deleted).sort((x, y) => y[1] - x[1]).slice(0, MAX_TOMBSTONES);
  return { menus: menus.slice(0, MAX_MENUS), deleted: Object.fromEntries(newestTombstones) };
}
