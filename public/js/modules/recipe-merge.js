/**
 * Speakeasy custom-recipe delete sync
 * Mirrors menu-merge.js's tombstone idea for recipe deletion. Unlike saved
 * menus, recipes don't carry a reliable per-recipe edit timestamp, so this
 * only merges the *tombstones* — a deleted id stays gone across devices/sync
 * until it's explicitly recreated (saved again under the same id), which
 * clears its tombstone. Pure functions with no browser or server dependencies:
 * the app merges with what it pulled, and /api/sync merges with what it
 * already holds.
 *
 * A copy is `{ deleted: { [recipeId]: deletedAtMs } }`.
 *
 * Known limitation: because there's no per-recipe timestamp, restoring a very
 * old backup file that predates a recreate can reintroduce a stale tombstone
 * for that id. Deleting a recipe and refreshing/syncing normally is unaffected.
 */

const MAX_TOMBSTONES = 500;
const num = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0);

function normalizeTombstones(raw) {
  const clean = {};
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    for (const [id, at] of Object.entries(raw)) {
      if (typeof id === 'string' && num(at) > 0) clean[id] = num(at);
    }
  }
  return clean;
}

/**
 * @param {{ deleted?: object }} a  e.g. this device
 * @param {{ deleted?: object }} b  e.g. the cloud
 * @returns {object} merged tombstones — newest deletion timestamp per id wins
 */
export function mergeRecipeDeletions(a, b) {
  const deleted = { ...normalizeTombstones(a?.deleted) };
  for (const [id, at] of Object.entries(normalizeTombstones(b?.deleted))) {
    deleted[id] = Math.max(deleted[id] || 0, at);
  }
  const newest = Object.entries(deleted).sort((x, y) => y[1] - x[1]).slice(0, MAX_TOMBSTONES);
  return Object.fromEntries(newest);
}
