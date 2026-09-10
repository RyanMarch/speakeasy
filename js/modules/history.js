/**
 * Speakeasy Drink Tracking History Module
 * Dual-mode persistence (Guest localStorage & Authenticated Cloudflare D1),
 * event notifications, and cloud sync upon login.
 */

import { getToken, isAuthenticated, AUTH_EVENT_NAME } from './auth.js';

export const HISTORY_STORAGE_KEY = 'speakeasy_drink_history';
export const HISTORY_UPDATED_EVENT = 'speakeasy:history-updated';
export const MAX_LOCAL_HISTORY = 100;

function dispatchHistoryUpdated(detail = {}) {
  try {
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new CustomEvent(HISTORY_UPDATED_EVENT, { detail }));
    }
  } catch (err) {
    console.warn('Failed to dispatch history update event:', err);
  }
}

/**
 * Retrieves raw entries from localStorage.
 * Format: Array<{ id?: string, recipeId: string, madeAt: string }>
 */
function getLocalHistoryEntries() {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Saves entries directly to localStorage.
 */
function setLocalHistoryEntries(entries) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_LOCAL_HISTORY)));
  } catch (err) {
    console.warn('Failed to save drink history to localStorage:', err);
  }
}

/**
 * Log a drink as made.
 * In Guest Mode: persists to localStorage.
 * In Authenticated Mode: calls /api/history/log and caches locally.
 * Triggers `speakeasy:history-updated` CustomEvent.
 *
 * @param {string} recipeId
 * @param {string} [madeAt]
 * @returns {Promise<{ id?: string, recipeId: string, madeAt: string }>}
 */
export async function logDrinkMade(recipeId, madeAt = new Date().toISOString()) {
  if (!recipeId) {
    throw new Error('recipeId is required to log drink history.');
  }

  let entry = {
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `hist-${Date.now()}`,
    recipeId,
    madeAt,
  };

  if (isAuthenticated()) {
    const token = getToken();
    try {
      const response = await fetch('/api/history/log', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ recipeId, madeAt }),
      });

      const data = await response.json();
      if (response.ok && data.success && data.entry) {
        entry = data.entry;
      }
    } catch (err) {
      console.warn('Failed to log drink history to cloud, falling back to local:', err);
    }
  }

  // Prepend entry to local cache (ensuring most recent is first)
  const local = getLocalHistoryEntries().filter(e => e.id !== entry.id);
  const updated = [entry, ...local];
  setLocalHistoryEntries(updated);

  dispatchHistoryUpdated({ entry, history: updated });
  return entry;
}

/**
 * Returns array of history entries: { id, recipeId, madeAt }, sorted descending by madeAt.
 * In Authenticated Mode, attempts to fetch from /api/history/list and refresh local cache.
 *
 * @param {number} [limit=15]
 * @returns {Promise<Array<{ id: string, recipeId: string, madeAt: string }>> | Array<{ id: string, recipeId: string, madeAt: string }>}
 */
export function getDrinkHistory(limit = 15) {
  const local = getLocalHistoryEntries();

  // Sort descending by madeAt
  const sorted = [...local].sort((a, b) => new Date(b.madeAt).getTime() - new Date(a.madeAt).getTime());

  // If authenticated and in browser, asynchronously refresh local cache in background
  if (isAuthenticated() && typeof fetch === 'function') {
    const token = getToken();
    fetch(`/api/history/list?limit=${encodeURIComponent(Math.max(limit, 25))}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    })
      .then(res => res.json())
      .then(data => {
        if (data && Array.isArray(data.history)) {
          // Merge remote history with any local entries
          const remoteIds = new Set(data.history.map(h => h.id));
          const localOnly = local.filter(h => !remoteIds.has(h.id));
          const merged = [...data.history, ...localOnly].sort(
            (a, b) => new Date(b.madeAt).getTime() - new Date(a.madeAt).getTime()
          );
          setLocalHistoryEntries(merged);
          dispatchHistoryUpdated({ history: merged });
        }
      })
      .catch(err => {
        console.warn('Failed to sync history from cloud:', err);
      });
  }

  return sorted.slice(0, limit);
}

/**
 * Synchronously or asynchronously pushes any local guest entries to /api/history/log upon login.
 *
 * @returns {Promise<{ syncedCount: number }>}
 */
export async function syncLocalHistoryToCloud() {
  if (!isAuthenticated()) {
    return { syncedCount: 0 };
  }

  const token = getToken();
  const localEntries = getLocalHistoryEntries();
  if (localEntries.length === 0) {
    return { syncedCount: 0 };
  }

  let syncedCount = 0;

  // First fetch remote history to avoid duplicate posts if already logged
  let existingRemoteIds = new Set();
  try {
    const listRes = await fetch('/api/history/list?limit=100', {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (listRes.ok) {
      const listData = await listRes.json();
      if (Array.isArray(listData.history)) {
        existingRemoteIds = new Set(listData.history.map(h => h.id));
      }
    }
  } catch (err) {
    console.warn('Could not fetch existing remote history before sync:', err);
  }

  for (const entry of localEntries) {
    // If entry was generated locally or not yet on server
    if (entry.id && existingRemoteIds.has(entry.id)) {
      continue;
    }

    try {
      const response = await fetch('/api/history/log', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          recipeId: entry.recipeId,
          madeAt: entry.madeAt,
        }),
      });

      if (response.ok) {
        syncedCount++;
      }
    } catch (err) {
      console.warn('Failed to sync local history entry to cloud:', entry, err);
    }
  }

  return { syncedCount };
}

// Automatically listen for auth changes to trigger sync upon login
if (typeof window !== 'undefined') {
  window.addEventListener(AUTH_EVENT_NAME, (event) => {
    if (event.detail && event.detail.authenticated) {
      syncLocalHistoryToCloud().catch(err => {
        console.warn('Automatic history cloud sync error:', err);
      });
    }
  });
}
