/**
 * Debounced auto-sync: pushes local changes (inventory, bars, recipes,
 * preferences, menus, etc.) to the cloud without a manual "Sync Now" tap.
 *
 * Every mutating storage.js setter calls scheduleCloudSync() on write. Bursts
 * of rapid changes — someone repeatedly toggling a bottle on/off, or a flaky
 * connection causing storage writes to retry — are coalesced into a single
 * network request rather than firing one per change.
 */

import { isAuthenticated, migrateGuestData } from './auth.js';

// Wait this long after the last change before pushing, so a burst of edits
// (toggling a bottle a dozen times in a row) collapses into one request.
const DEBOUNCE_MS = 2500;
// ...but never let continuous activity delay the push indefinitely.
const MAX_WAIT_MS = 12000;
const RETRY_BASE_MS = 5000;
const RETRY_MAX_MS = 60000;

let debounceTimer = null;
let maxWaitTimer = null;
let retryTimer = null;
let inFlight = false;
let dirtyDuringFlight = false;
let retryDelay = RETRY_BASE_MS;
let suppressDepth = 0;

function clearPendingTimers() {
  if (debounceTimer) { clearTimeout(debounceTimer); debounceTimer = null; }
  if (maxWaitTimer) { clearTimeout(maxWaitTimer); maxWaitTimer = null; }
}

async function runSync() {
  if (!isAuthenticated()) return;
  if (inFlight) {
    // A push is already in progress — remember to run once more when it
    // settles rather than starting a second overlapping request.
    dirtyDuringFlight = true;
    return;
  }

  inFlight = true;
  try {
    await migrateGuestData();
    retryDelay = RETRY_BASE_MS;
  } catch (err) {
    console.warn('Auto-sync failed, will retry:', err?.message || err);
    scheduleRetry();
  } finally {
    inFlight = false;
    if (dirtyDuringFlight) {
      dirtyDuringFlight = false;
      scheduleCloudSync();
    }
  }
}

function scheduleRetry() {
  if (retryTimer) return;
  const delay = retryDelay;
  retryDelay = Math.min(retryDelay * 2, RETRY_MAX_MS);
  retryTimer = setTimeout(() => {
    retryTimer = null;
    if (isAuthenticated()) runSync();
  }, delay);
}

function fire() {
  clearPendingTimers();
  runSync();
}

/**
 * Call after any local mutation that should end up in the cloud. Safe to
 * call as often as you like — repeated calls just push the debounce window
 * out, and MAX_WAIT_MS guarantees a push still happens under sustained
 * activity instead of only once things go quiet.
 */
export function scheduleCloudSync() {
  if (suppressDepth > 0) return;
  if (!isAuthenticated()) return;

  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(fire, DEBOUNCE_MS);

  if (!maxWaitTimer) {
    maxWaitTimer = setTimeout(fire, MAX_WAIT_MS);
  }
}

/**
 * Runs fn() with auto-sync scheduling suppressed — used while applying data
 * that just came FROM the cloud (e.g. pullRemoteData's importData call), so
 * hydrating local storage doesn't immediately schedule pushing the same data
 * straight back up.
 */
export function withSyncSuppressed(fn) {
  suppressDepth++;
  try {
    return fn();
  } finally {
    suppressDepth--;
  }
}

/**
 * Best-effort immediate push, bypassing the debounce window. Used when the
 * page is about to be hidden/unloaded with unsynced changes still pending.
 */
export function flushCloudSyncNow() {
  if (suppressDepth > 0) return;
  if (!debounceTimer && !maxWaitTimer) return;
  fire();
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    // Connectivity just came back — stop backing off and try right away if
    // there's a retry pending.
    retryDelay = RETRY_BASE_MS;
    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = null;
      if (isAuthenticated()) runSync();
    }
  });

  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushCloudSyncNow();
  });
  window.addEventListener('pagehide', flushCloudSyncNow);
}
