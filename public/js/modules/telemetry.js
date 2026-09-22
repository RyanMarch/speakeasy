/**
 * Speakeasy Client Telemetry Module
 *
 * Lightweight, privacy-first event recording (recipe views, searches, feature usage).
 * Batches events and dispatches via navigator.sendBeacon or fetch with keepalive.
 */

let eventQueue = [];
let flushTimeout = null;
const BATCH_INTERVAL_MS = 2500;
const MAX_QUEUE_SIZE = 10;

/**
 * Determine if current device is mobile based on user agent and screen
 */
function getDeviceType() {
  if (typeof navigator === 'undefined') return 'desktop';
  if (/Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) return 'mobile';
  if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(max-width: 768px)').matches) {
    return 'mobile';
  }
  return 'desktop';
}

/**
 * Flushes queued events to the server
 */
export function flushTelemetry() {
  if (eventQueue.length === 0) return;

  const payload = [...eventQueue];
  eventQueue = [];
  if (flushTimeout) {
    clearTimeout(flushTimeout);
    flushTimeout = null;
  }

  const jsonStr = JSON.stringify(payload);

  try {
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const sent = navigator.sendBeacon('/api/telemetry', blob);
      if (sent) return;
    }
  } catch {
    // Fall back to fetch
  }

  fetch('/api/telemetry', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: jsonStr,
    keepalive: true,
  }).catch(() => {
    // Ignore offline telemetry delivery failures silently
  });
}

/**
 * Schedules event dispatch
 */
function scheduleFlush() {
  if (eventQueue.length >= MAX_QUEUE_SIZE) {
    flushTelemetry();
    return;
  }
  if (!flushTimeout) {
    flushTimeout = setTimeout(() => {
      flushTelemetry();
    }, BATCH_INTERVAL_MS);
  }
}

/**
 * Tracks an event
 * @param {'recipe_view' | 'search' | 'feature_use'} type
 * @param {object} [details]
 * @param {string} [details.targetId] - Recipe ID or feature identifier
 * @param {string} [details.query] - Search term
 */
export function trackEvent(type, details = {}) {
  try {
    eventQueue.push({
      type,
      targetId: details.targetId || null,
      query: details.query ? details.query.toLowerCase().trim() : null,
      device: getDeviceType(),
      timestamp: Date.now(),
    });
    scheduleFlush();
  } catch {
    // Non-blocking telemetry
  }
}

// Ensure remaining events flush when user unloads page
if (typeof window !== 'undefined') {
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      flushTelemetry();
    }
  });
  window.addEventListener('pagehide', flushTelemetry);
}
