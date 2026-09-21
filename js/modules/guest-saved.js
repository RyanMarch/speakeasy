/**
 * Speakeasy guest "Saved" list
 * The drinks a guest has hearted on a menu, remembered on their own device so
 * they can compare a few and come back to them. Kept per menu, in the order
 * they were saved, and only for the last few menus (like the remembered menu
 * copies), so storage can't grow without bound. Nothing leaves the device.
 */

const SAVED_PREFIX = 'speakeasy_guest_saved_';
const SAVED_INDEX = 'speakeasy_guest_saved_index';
const MAX_MENUS = 3;

function readIndex() {
  try {
    const parsed = JSON.parse(localStorage.getItem(SAVED_INDEX) || '[]');
    return Array.isArray(parsed) ? parsed.filter(id => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

function write(menuId, ids) {
  try {
    if (ids.length === 0) {
      localStorage.removeItem(SAVED_PREFIX + menuId);
      localStorage.setItem(SAVED_INDEX, JSON.stringify(readIndex().filter(id => id !== menuId)));
      return;
    }
    localStorage.setItem(SAVED_PREFIX + menuId, JSON.stringify(ids));
    const index = [menuId, ...readIndex().filter(id => id !== menuId)];
    index.slice(MAX_MENUS).forEach(old => localStorage.removeItem(SAVED_PREFIX + old));
    localStorage.setItem(SAVED_INDEX, JSON.stringify(index.slice(0, MAX_MENUS)));
  } catch {
    // Storage full or unavailable (private mode): saving just won't stick.
  }
}

/** The ids saved on this menu, oldest first. */
export function getSaved(menuId) {
  try {
    const parsed = JSON.parse(localStorage.getItem(SAVED_PREFIX + menuId) || '[]');
    return Array.isArray(parsed) ? parsed.filter(id => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

/** Flips a drink's saved state. Returns the new list and whether it's now saved. */
export function toggleSaved(menuId, recipeId) {
  const current = getSaved(menuId);
  const saved = !current.includes(recipeId);
  const next = saved ? [...current, recipeId] : current.filter(id => id !== recipeId);
  write(menuId, next);
  return { saved, ids: next };
}

/**
 * Drops saved drinks that are no longer on the menu (the host edited it), so a
 * removed drink can't linger in someone's list. Returns what's left.
 */
export function pruneSaved(menuId, validIds) {
  const valid = new Set(validIds);
  const current = getSaved(menuId);
  const kept = current.filter(id => valid.has(id));
  if (kept.length !== current.length) write(menuId, kept);
  return kept;
}
