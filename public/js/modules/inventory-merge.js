/**
 * Speakeasy bar-inventory sync
 * Merges two copies of one bar's bottles (this device's and the cloud's) so that
 * removing a bottle on one device removes it on the others, instead of the other
 * devices quietly putting it back. Pure functions with no browser or server
 * dependencies: the app merges with what it pulled, and /api/sync merges with
 * what it already holds.
 *
 * A copy is `{ items: string[], added: { [id]: ms }, removed: { [id]: ms } }`.
 * `added` / `removed` record when a bottle was last put on the shelf or taken off
 * *on purpose*, so a device that simply hasn't heard about a removal yet (it
 * still lists the bottle, with no newer "added") can't undo it. Bottles with no
 * record at all (everything from before this existed) are simply present.
 *
 * A bottle ends up on the shelf if either side lists it, unless it was removed
 * more recently than it was last added. Nothing without a removal record is ever
 * dropped, so merging can't lose a bottle by accident.
 */

const DAY = 24 * 60 * 60 * 1000;
// Records this old have long since reached every device that's still in use.
const KEEP_MS = 180 * DAY;
const MAX_RECORDS = 600;
const MAX_ID_LENGTH = 80;

const num = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0);

function normalizeStamps(raw) {
  const clean = {};
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    for (const [id, at] of Object.entries(raw)) {
      if (id && id.length <= MAX_ID_LENGTH && num(at) > 0) clean[id] = num(at);
    }
  }
  return clean;
}

function newest(limit, stamps) {
  return Object.fromEntries(Object.entries(stamps).sort((x, y) => y[1] - x[1]).slice(0, limit));
}

/**
 * @param {{ items?: string[], added?: object, removed?: object }} a
 * @param {{ items?: string[], added?: object, removed?: object }} b
 * @param {number} [now]
 * @returns {{ items: string[], added: object, removed: object }}
 */
export function mergeInventory(a, b, now = Date.now()) {
  const onShelf = new Set();
  for (const side of [a, b]) {
    for (const id of Array.isArray(side?.items) ? side.items : []) {
      if (typeof id === 'string' && id && id.length <= MAX_ID_LENGTH) onShelf.add(id);
    }
  }

  // Records this old have reached every device still in use; forget them first, so
  // a removal from long ago can't keep a bottle off the shelf forever.
  const fresh = (stamps) => Object.fromEntries(Object.entries(stamps).filter(([, at]) => now - at < KEEP_MS));
  const added = { ...fresh(normalizeStamps(a?.added)) };
  for (const [id, at] of Object.entries(fresh(normalizeStamps(b?.added)))) added[id] = Math.max(added[id] || 0, at);
  const removed = { ...fresh(normalizeStamps(a?.removed)) };
  for (const [id, at] of Object.entries(fresh(normalizeStamps(b?.removed)))) removed[id] = Math.max(removed[id] || 0, at);

  const items = [...onShelf].filter(id => !(removed[id] > 0 && (added[id] || 0) <= removed[id]));

  // A removal that a later add has superseded has done its job.
  for (const id of Object.keys(removed)) {
    if ((added[id] || 0) > removed[id]) delete removed[id];
  }
  return {
    items,
    added: newest(MAX_RECORDS, added),
    removed: newest(MAX_RECORDS, removed),
  };
}

/**
 * The records to keep after this device changes its shelf from `before` to `after`
 * (arrays of ids): newly added bottles get an `added` time, bottles taken off get a
 * `removed` time, and each supersedes the opposite record for that bottle.
 */
export function recordInventoryChange(records, before, after, now = Date.now()) {
  const was = new Set(before || []);
  const is = new Set(after || []);
  const added = { ...normalizeStamps(records?.added) };
  const removed = { ...normalizeStamps(records?.removed) };
  for (const id of is) {
    if (!was.has(id)) {
      added[id] = now;
      delete removed[id];
    }
  }
  for (const id of was) {
    if (!is.has(id)) {
      removed[id] = now;
      delete added[id];
    }
  }
  return { added, removed };
}
