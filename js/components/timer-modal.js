/**
 * Speakeasy Smart Counter Timer Component
 * Compact non-modal floating toast widget with 3-phase countdown, native vibration alerts, and zero audio.
 * Allows user to freely scroll and view recipe while timer runs.
 */

let timerElement = null;
let currentInterval = null;
let autoDismissTimeout = null;
let activePhase = 'idle'; // 'ready' | 'counting' | 'done' | 'idle'
let totalDuration = 0;
let remainingSeconds = 0;

const RING_RADIUS = 18;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS; // ~113.097

function triggerHaptic(pattern) {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(pattern);
    }
  } catch {
    // Ignore unsupported environments
  }
}

function getTimerElement() {
  if (timerElement && document.body.contains(timerElement)) {
    return timerElement;
  }
  let el = document.getElementById('timer-modal');
  if (!el) {
    el = document.createElement('div');
    el.id = 'timer-modal';
    el.className = 'timer-toast';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    el.style.display = 'none';
    document.body.appendChild(el);
  }
  timerElement = el;
  return timerElement;
}

function clearAllTimers() {
  if (currentInterval) {
    clearInterval(currentInterval);
    currentInterval = null;
  }
  if (autoDismissTimeout) {
    clearTimeout(autoDismissTimeout);
    autoDismissTimeout = null;
  }
}

export function closeTimerModal() {
  clearAllTimers();
  activePhase = 'idle';
  const el = getTimerElement();
  if (el) {
    el.style.display = 'none';
    el.innerHTML =  /*html*/'';
  }
}

function updateProgressRing(fraction) {
  const el = getTimerElement();
  const ringEl = el.querySelector('.timer-toast-progress');
  if (!ringEl) return;
  const offset = RING_CIRCUMFERENCE * (1 - Math.max(0, Math.min(1, fraction)));
  ringEl.style.strokeDashoffset = `${offset}`;
}

function renderToastContent(stateObj) {
  const el = getTimerElement();
  const { phase, numberDisplay, title, subtext, showCancel, showDismiss, isFlashing } = stateObj;

  el.style.display = 'block';
  el.innerHTML =  /*html*/`
    <div class="timer-toast-inner ${isFlashing ? 'timer-flash-active' : ''}">
      <div class="timer-toast-ring-wrap">
        <svg class="timer-toast-svg" viewBox="0 0 44 44" aria-hidden="true">
          <circle
            cx="22"
            cy="22"
            r="${RING_RADIUS}"
            class="timer-toast-track"
          />
          <circle
            cx="22"
            cy="22"
            r="${RING_RADIUS}"
            class="timer-toast-progress ${phase === 'done' ? 'is-complete' : ''}"
            style="stroke-dasharray: ${RING_CIRCUMFERENCE.toFixed(1)}; stroke-dashoffset: 0;"
          />
        </svg>
        <div class="timer-toast-ring-num" id="timer-number">${numberDisplay}</div>
      </div>

      <div class="timer-toast-text">
        <span class="timer-toast-title">${title}</span>
        <span class="timer-toast-sub">${subtext}</span>
      </div>

      <div class="timer-toast-actions">
        ${showCancel ? /*html*/`
          <button type="button" id="btn-timer-cancel" class="timer-toast-btn-stop" title="Stop timer" aria-label="Stop timer">
            Stop
          </button>
        ` : ''}
        ${showDismiss ? /*html*/`
          <button type="button" id="btn-timer-dismiss" class="timer-toast-btn-dismiss" title="Dismiss" aria-label="Dismiss timer">
            ✕
          </button>
        ` : ''}
      </div>
    </div>
  `;

  const cancelBtn = el.querySelector('#btn-timer-cancel');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      closeTimerModal();
    });
  }

  const dismissBtn = el.querySelector('#btn-timer-dismiss');
  if (dismissBtn) {
    dismissBtn.addEventListener('click', () => {
      closeTimerModal();
    });
  }
}

function startPhase3Completion() {
  clearAllTimers();
  activePhase = 'done';

  // Haptic alert: [200, 100, 200, 100, 400]
  triggerHaptic([200, 100, 200, 100, 400]);

  renderToastContent({
    phase: 'done',
    numberDisplay: '✓',
    title: 'Done!',
    subtext: `${totalDuration}s timer completed`,
    showCancel: false,
    showDismiss: true,
    isFlashing: true,
  });

  updateProgressRing(1);

  // Auto-dismiss after 2 seconds
  autoDismissTimeout = setTimeout(() => {
    closeTimerModal();
  }, 2000);
}

function startPhase2Countdown() {
  clearAllTimers();
  activePhase = 'counting';
  remainingSeconds = totalDuration;

  renderToastContent({
    phase: 'counting',
    numberDisplay: `${remainingSeconds}`,
    title: `${remainingSeconds}s remaining`,
    subtext: `${totalDuration}s duration`,
    showCancel: true,
    showDismiss: false,
    isFlashing: false,
  });

  updateProgressRing(1);

  const startTime = Date.now();
  const totalMs = totalDuration * 1000;

  currentInterval = setInterval(() => {
    const elapsedMs = Date.now() - startTime;
    const remainingMs = Math.max(0, totalMs - elapsedMs);
    const secsLeft = Math.ceil(remainingMs / 1000);

    const el = getTimerElement();
    const numEl = el.querySelector('#timer-number');
    const titleEl = el.querySelector('.timer-toast-title');
    if (numEl) {
      numEl.textContent = `${secsLeft}`;
    }
    if (titleEl) {
      titleEl.textContent = `${secsLeft}s remaining`;
    }

    const fraction = remainingMs / totalMs;
    updateProgressRing(fraction);

    if (remainingMs <= 0) {
      startPhase3Completion();
    }
  }, 100);
}

function startPhase1GetReady() {
  clearAllTimers();
  activePhase = 'ready';
  let readyCount = 3;

  renderToastContent({
    phase: 'ready',
    numberDisplay: `${readyCount}`,
    title: 'Get Ready...',
    subtext: `${totalDuration}s countdown starting`,
    showCancel: true,
    showDismiss: false,
    isFlashing: false,
  });

  updateProgressRing(1);
  triggerHaptic(40);

  currentInterval = setInterval(() => {
    readyCount--;
    if (readyCount > 0) {
      triggerHaptic(40);
      const el = getTimerElement();
      const numEl = el.querySelector('#timer-number');
      if (numEl) {
        numEl.textContent = `${readyCount}`;
      }
    } else {
      clearInterval(currentInterval);
      currentInterval = null;
      startPhase2Countdown();
    }
  }, 1000);
}

/**
 * Open timer toast and initiate 3-phase countdown.
 *
 * @param {number} seconds
 */
export function openTimerModal(seconds) {
  const duration = parseInt(seconds, 10);
  if (isNaN(duration) || duration <= 0) return;

  totalDuration = duration;
  startPhase1GetReady();
}

/**
 * Set up global dismissal listeners.
 */
export function setupTimerModalEventListeners() {
  // Global Esc key dismissal
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && activePhase !== 'idle') {
      closeTimerModal();
    }
  });
}
