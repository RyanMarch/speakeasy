/**
 * Speakeasy "Always Ready" menu
 * A menu whose drink list isn't picked by hand: it's every cocktail that's
 * currently makeable from one specific bar (exact matches only, same rule as
 * the picker's "Add all ready" button), recomputed as that bar's inventory
 * changes. At most one per bar — see findReadyMenuForBar.
 *
 * A menu is one of these once `menu.dynamic === 'ready'`; `menu.readyBarId` is
 * the bar it's pinned to for good, set once at creation and never moved by
 * switching the active bar or adding more bars later.
 *
 * This module owns *what's ready and when to recompute it*. It deliberately
 * doesn't hook into every inventory write in storage.js — it's called from the
 * few UI actions that actually change a bar's bottles (see backbar-modal.js and
 * counter-view.js), plus once whenever a Ready menu's own page is opened. A
 * missed call site just means the next one of those catches up; nothing here
 * needs to be real-time; see the design note where this shipped.
 */

import { state } from '../state.js';
import { getMenus, saveMenu, saveMenus, getInventoryForBar, getActiveBarId } from './storage.js';
import { pushMenuContents } from './menu-publish.js';
import { applyBarDiet } from './dietary.js';
import { analyzeRecipeInventory } from './taxonomy.js';

export const READY_DYNAMIC_KIND = 'ready';

/** The bar's currently makeable drinks — exact matches only, no substitutions. */
export function computeReadyRecipeIds(barId) {
  if (!barId) return [];
  const inventory = new Set(getInventoryForBar(barId));
  return state.recipes.filter(r => analyzeRecipeInventory(r, inventory).canMake).map(r => r.id);
}

export function isReadyMenu(menu) {
  return Boolean(menu && menu.dynamic === READY_DYNAMIC_KIND && menu.readyBarId);
}

/** The one Always Ready menu tracking this bar, if it has one. */
export function findReadyMenuForBar(barId) {
  return getMenus().find(m => isReadyMenu(m) && m.readyBarId === barId) || null;
}

/**
 * Names a new Ready menu. Plain "Always Ready" for the common single-bar case;
 * once there's more than one bar, the bar's name goes on the front so two
 * Ready menus in the list don't read identically.
 */
export function defaultReadyMenuName(barName, barCount) {
  return barCount > 1 && barName ? `${barName} — Always Ready` : 'Always Ready';
}

/**
 * Creates this bar's Always Ready menu with whatever's ready right now.
 * Never call this when the bar already has one — check findReadyMenuForBar first.
 */
export function createReadyMenu(barId, barName, barCount) {
  return saveMenu({
    name: defaultReadyMenuName(barName, barCount),
    recipeIds: computeReadyRecipeIds(barId),
    dynamic: READY_DYNAMIC_KIND,
    readyBarId: barId,
  });
}

// Debounced per menu id: a burst of bottle toggles collapses into one push,
// without the retry/backoff machinery cloud-sync.js needs for the account's
// whole state — if this push fails, the next inventory change or menu view
// tries again, which is enough for something that was never meant to be
// instant.
export const PUSH_DEBOUNCE_MS = 2500;
const pendingPushes = new Map();

function schedulePush(menu) {
  clearTimeout(pendingPushes.get(menu.id));
  pendingPushes.set(menu.id, setTimeout(() => {
    pendingPushes.delete(menu.id);
    const drinks = menu.recipeIds.map(id => state.recipes.find(r => r.id === id)).filter(Boolean)
      .map(recipe => applyBarDiet(recipe, state.foamerForEgg));
    pushMenuContents(menu.share, menu.name, drinks).catch(() => {
      // Swallowed on purpose: the next recompute (another bottle change, or
      // opening the menu) will try again with whatever's true by then.
    });
  }, PUSH_DEBOUNCE_MS));
}

/**
 * Brings a Ready menu's stored drink list in line with what's actually ready
 * right now, prunes its picks/out list/dietary notes to match, and — if it's
 * live and the *publishable* set actually changed — pushes the update.
 *
 * The stored `recipeIds` only ever holds the last non-empty ready set: the
 * server refuses an empty menu, so a bar that's momentarily out of everything
 * just keeps showing guests its last update rather than erroring. Call
 * `computeReadyRecipeIds` directly for what's true this instant (used for the
 * page you're looking at); this is for what's durable and publishable.
 *
 * @returns the menu as stored after this call (unchanged if nothing moved)
 */
export function refreshReadyMenu(menu) {
  if (!isReadyMenu(menu)) return menu;
  const live = computeReadyRecipeIds(menu.readyBarId);
  const nextIds = live.length > 0 ? live : menu.recipeIds;
  const changed = nextIds.length !== menu.recipeIds.length || nextIds.some(id => !menu.recipeIds.includes(id));
  if (!changed) return menu;

  const stillOnMenu = new Set(nextIds);
  const share = menu.share ? {
    ...menu.share,
    outIds: (menu.share.outIds || []).filter(id => stillOnMenu.has(id)),
    featuredIds: (menu.share.featuredIds || []).filter(id => stillOnMenu.has(id)),
    dietOverrides: Object.fromEntries(Object.entries(menu.share.dietOverrides || {}).filter(([id]) => stillOnMenu.has(id))),
  } : undefined;
  const saved = saveMenu({ ...menu, recipeIds: nextIds, share });
  if (saved.share) schedulePush(saved);
  return saved;
}

/** Refreshes every local Always Ready menu tracking `barId` (defaults to the active bar). */
export function refreshReadyMenusForBar(barId = getActiveBarId()) {
  if (!barId) return;
  getMenus().filter(m => isReadyMenu(m) && m.readyBarId === barId).forEach(refreshReadyMenu);
}

/**
 * Drops the local record of any Always Ready menu(s) tracking a bar that's
 * being deleted — one with no bar behind it isn't meaningful. Returns the
 * removed menus (with their share credentials, if any) so the caller can
 * unpublish their guest links; this function only touches local storage.
 */
export function deleteReadyMenusForBar(barId) {
  const menus = getMenus();
  const removed = menus.filter(m => isReadyMenu(m) && m.readyBarId === barId);
  if (removed.length === 0) return [];
  saveMenus(menus.filter(m => !removed.includes(m)));
  return removed;
}
