/**
 * Client-side authentication and session management module.
 *
 * Coordinates authentication state, token persistence in localStorage,
 * OTP verification, session termination, and guest data cloud migration.
 */

import { buildBackupPayload, importData } from './storage.js';

export const AUTH_TOKEN_KEY = 'speakeasy_auth_token';
export const AUTH_USER_KEY = 'speakeasy_user';
export const AUTH_EVENT_NAME = 'speakeasy:auth-changed';

function dispatchAuthChange(detail = {}) {
  try {
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new CustomEvent(AUTH_EVENT_NAME, { detail }));
    }
  } catch (err) {
    console.warn('Failed to dispatch auth change event:', err);
  }
}

/**
 * Returns true if an active auth token exists in localStorage.
 */
export function isAuthenticated() {
  return Boolean(getToken());
}

/**
 * Retrieves the stored auth token, or null.
 */
export function getToken() {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(AUTH_TOKEN_KEY) || null;
  } catch {
    return null;
  }
}

/**
 * Retrieves the stored user object, or null.
 */
export function getUser() {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(AUTH_USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Requests a 6-digit numeric OTP code sent to the given email address.
 */
export async function requestOtp(email) {
  const response = await fetch('/api/auth/request-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });

  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Failed to request verification code.');
  }

  return data;
}

/**
 * Verifies the OTP code, persists the session token and user profile,
 * and notifies the application of the auth state change.
 */
export async function verifyOtp(email, code) {
  const response = await fetch('/api/auth/verify-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, code }),
  });

  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Failed to verify code.');
  }

  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(AUTH_TOKEN_KEY, data.token);
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(data.user));
    }
  } catch (err) {
    console.warn('Failed to store auth credentials in localStorage:', err);
  }

  dispatchAuthChange({ authenticated: true, user: data.user });
  return data;
}

/**
 * Logs the user out by invalidating the session on the server,
 * clearing local credentials, and dispatching an auth event.
 */
export async function logout() {
  const token = getToken();
  if (token) {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
    } catch (err) {
      console.warn('Logout network request failed:', err);
    }
  }

  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(AUTH_TOKEN_KEY);
      localStorage.removeItem(AUTH_USER_KEY);
    }
  } catch (err) {
    console.warn('Failed to clear credentials from localStorage:', err);
  }

  dispatchAuthChange({ authenticated: false, user: null });
}

/**
 * Permanently deletes the authenticated user's account and all associated cloud data,
 * clearing local credentials and notifying the application.
 */
export async function deleteAccount() {
  const token = getToken();
  if (!token) {
    throw new Error('No active account to delete.');
  }

  const response = await fetch('/api/auth/delete-account', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Failed to delete cloud account.');
  }

  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(AUTH_TOKEN_KEY);
      localStorage.removeItem(AUTH_USER_KEY);
    }
  } catch (err) {
    console.warn('Failed to clear credentials from localStorage:', err);
  }

  dispatchAuthChange({ authenticated: false, user: null });
  return data;
}

/**
 * Checks with the server (/api/auth/me) to ensure the local token remains valid.
 * Clears local state if expired or invalid.
 */
export async function checkSession() {
  const token = getToken();
  if (!token) {
    return { authenticated: false, user: null };
  }

  try {
    const response = await fetch('/api/auth/me', {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    const data = await response.json();
    if (response.ok && data.authenticated && data.user) {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(AUTH_USER_KEY, JSON.stringify(data.user));
      }
      return { authenticated: true, user: data.user };
    }
  } catch (err) {
    console.warn('Failed to verify session status with server:', err);
    return { authenticated: true, user: getUser() };
  }

  // If unauthorized or invalid session
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(AUTH_TOKEN_KEY);
      localStorage.removeItem(AUTH_USER_KEY);
    }
  } catch (err) {
    console.warn('Failed to remove invalid token:', err);
  }
  dispatchAuthChange({ authenticated: false, user: null });
  return { authenticated: false, user: null };
}

/**
 * Migrates local guest data (inventory, custom recipes, settings) to the Cloudflare D1 backend
 * by building the standard unified v1 backup payload and posting to /api/sync.
 */
export async function migrateGuestData() {
  const token = getToken();
  if (!token) {
    throw new Error('Cannot migrate data without active authentication.');
  }

  const payload = buildBackupPayload();

  const response = await fetch('/api/sync', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Failed to migrate guest data to cloud.');
  }

  return data;
}

/**
 * Pulls remote user data (inventory, custom recipes, settings) from Cloudflare D1
 * via GET /api/sync and hydrates local storage seamlessly.
 */
export async function pullRemoteData() {
  const token = getToken();
  if (!token) {
    throw new Error('Cannot pull remote data without active authentication.');
  }

  const response = await fetch('/api/sync', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  const data = await response.json();
  if (!response.ok || !data.success || !data.backup) {
    throw new Error(data.error || 'Failed to retrieve cloud data.');
  }

  // Import and merge cloud backup into local storage
  const summary = importData(JSON.stringify(data.backup));

  // Dispatch auth event so UI components refresh reactive views (the
  // speakeasy:auth-changed listener in top-bar.js resyncs state.bars/
  // activeBarId/inventory from storage before any UI reads them)
  dispatchAuthChange({ authenticated: true, user: getUser(), cloudSync: true });

  return {
    ...summary,
    backup: data.backup,
  };
}

/**
 * Updates the user's display name locally and in Cloudflare D1.
 */
export async function updateDisplayName(displayName) {
  const token = getToken();
  const trimmed = (displayName || '').trim();
  if (!trimmed) {
    throw new Error('Name cannot be empty.');
  }

  // Update local storage user profile first
  const currentUser = getUser() || {};
  currentUser.displayName = trimmed;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(currentUser));
    }
  } catch (err) {
    console.warn('Failed to update user in localStorage:', err);
  }

  // Sync to remote server if authenticated
  if (token) {
    try {
      const res = await fetch('/api/auth/me', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ displayName: trimmed }),
      });
      const data = await res.json();
      if (res.ok && data.user) {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(AUTH_USER_KEY, JSON.stringify(data.user));
        }
        dispatchAuthChange({ authenticated: true, user: data.user });
        return data.user;
      }
    } catch (err) {
      console.warn('Failed to patch display name on server:', err);
    }
  }

  dispatchAuthChange({ authenticated: Boolean(token), user: currentUser });
  return currentUser;
}
