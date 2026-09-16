/**
 * Toast notifications & HTML escaping utility
 */

import { elements } from '../state.js';

export function showToast(message, options = {}) {
  const container = elements.toastContainer || document.getElementById('toast-container');
  if (!container) return;

  const duration = typeof options === 'number' ? options : (options.duration || 2400);
  const className = typeof options === 'object' && options.className ? options.className : '';

  const toast = document.createElement('div');
  toast.className = `toast ${className}`.trim();

  if (typeof options === 'object' && options.icon) {
    const iconSpan = document.createElement('span');
    iconSpan.className = 'toast-icon';
    iconSpan.innerHTML = /*html*/ options.icon;
    toast.appendChild(iconSpan);
    const textSpan = document.createElement('span');
    textSpan.className = 'toast-text';
    textSpan.textContent = message;
    toast.appendChild(textSpan);
  } else {
    toast.textContent = message;
  }

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 200ms ease';
    setTimeout(() => toast.remove(), 220);
  }, duration);
}

/**
 * Wires a <dialog>'s backdrop-click light-dismiss, as a fallback for browsers
 * without native `closedby="any"` support — a click that lands on the
 * backdrop (not the dialog's own content rect) closes it via `closeFn`.
 */
export function setupDialogLightDismiss(dialogEl, closeFn) {
  if (!dialogEl || ('closedBy' in HTMLDialogElement.prototype)) return;
  dialogEl.addEventListener('click', (event) => {
    if (event.target !== dialogEl) return;
    const rect = dialogEl.getBoundingClientRect();
    const isDialogContent = (
      rect.top <= event.clientY &&
      event.clientY <= rect.top + rect.height &&
      rect.left <= event.clientX &&
      event.clientX <= rect.left + rect.width
    );
    if (!isDialogContent) {
      closeFn();
    }
  });
}

/**
 * Positions a native <popover> from its trigger's actual bounding rect on
 * open, as a fallback for CSS anchor positioning (position-anchor/anchor()),
 * which isn't reliably supported across every Chromium build in the wild yet
 * — when it silently fails to resolve, the popover falls back to a hardcoded
 * CSS offset that only happens to line up with the trigger at one specific
 * viewport size. `getTrigger` is called fresh on each open since which
 * element is the "real" visible trigger can change (e.g. a mobile vs.
 * desktop button for the same popover).
 */
export function wirePopoverTriggerPositioning(popoverEl, getTrigger) {
  if (!popoverEl) return;
  popoverEl.addEventListener('toggle', (e) => {
    if (e.newState !== 'open') return;
    const trigger = getTrigger();
    if (!trigger) return;

    const triggerRect = trigger.getBoundingClientRect();
    const popoverRect = popoverEl.getBoundingClientRect();
    const margin = 8;

    let left = triggerRect.right - popoverRect.width;
    left = Math.max(margin, Math.min(left, window.innerWidth - popoverRect.width - margin));
    let top = triggerRect.bottom + margin;
    top = Math.min(top, window.innerHeight - popoverRect.height - margin);

    popoverEl.style.top = `${Math.max(margin, top)}px`;
    popoverEl.style.left = `${left}px`;
    popoverEl.style.right = 'auto';
  });
}

// Ids already wired by wireCalorieInfoPopover — guards against re-registering
// a duplicate document-level listener every time a view re-renders.
const _wiredCaloriePopovers = new Set();

/**
 * Wires a calorie-estimate info button ("ⓘ") to toggle its popover, and any
 * click elsewhere on the page to close it. The trigger/popover elements are
 * looked up fresh by id on every click (rather than captured once), so this
 * survives the view re-creating them across re-renders — call it once per
 * (triggerId, popoverId) pair; later calls for the same pair are no-ops,
 * since a single delegated document listener already covers every render.
 */
export function wireCalorieInfoPopover(triggerId, popoverId) {
  const key = `${triggerId}|${popoverId}`;
  if (_wiredCaloriePopovers.has(key)) return;
  _wiredCaloriePopovers.add(key);

  document.addEventListener('click', (e) => {
    const popover = document.getElementById(popoverId);
    if (!popover) return;
    const trigger = e.target.closest(`#${triggerId}`);
    if (trigger) {
      e.stopPropagation();
      const isOpen = popover.classList.toggle('is-open');
      popover.setAttribute('aria-hidden', String(!isOpen));
      return;
    }
    popover.classList.remove('is-open');
  });
}

export function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Prominent celebratory banner when a user earns a new mixologist rank.
 * Only triggers if More Fun animations are enabled.
 */
export function showLevelUpCelebration(newRankTitle, options = {}) {
  // Check if More Fun animations are disabled
  if (typeof document !== 'undefined' && document.documentElement.classList.contains('animations-disabled')) {
    return;
  }

  const container = elements.toastContainer || document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'toast-level-up';
  toast.setAttribute('role', 'alert');
  toast.setAttribute('aria-live', 'assertive');

  const prevTitle = options.previousRankTitle ? escapeHtml(options.previousRankTitle) : '';
  const metaText = prevTitle ? `Promoted from ${prevTitle}` : 'Mixologist Rank Promoted';

  toast.innerHTML = /*html*/`
    <div class="toast-level-up-badge" aria-hidden="true">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
        stroke-linecap="round" stroke-linejoin="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
      </svg>
    </div>
    <div class="toast-level-up-content">
      <div class="toast-level-up-eyebrow">
        <span>Level Up</span>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2l2.4 7.4H22l-6 4.6 2.3 7-6.3-4.6-6.3 4.6 2.3-7-6-4.6h7.6z"/>
        </svg>
      </div>
      <div class="toast-level-up-title">${escapeHtml(newRankTitle)}</div>
      <div class="toast-level-up-meta">${metaText}</div>
    </div>
  `;

  // Create subtle radiating sparkles
  const sparklesCount = 8;
  for (let i = 0; i < sparklesCount; i++) {
    const sparkle = document.createElement('span');
    sparkle.className = 'toast-level-up-sparkle';
    const angle = (i / sparklesCount) * 2 * Math.PI;
    const distance = 30 + Math.random() * 25;
    const tx = Math.cos(angle) * distance;
    const ty = Math.sin(angle) * distance;
    sparkle.style.setProperty('--tx', `${tx}px`);
    sparkle.style.setProperty('--ty', `${ty}px`);
    sparkle.style.left = '32px';
    sparkle.style.top = '50%';
    sparkle.style.animationDelay = `${Math.random() * 120}ms`;
    toast.appendChild(sparkle);
  }

  // Dismiss on click or after duration
  let dismissed = false;
  const dismiss = () => {
    if (dismissed) return;
    dismissed = true;
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(12px) scale(0.95)';
    toast.style.transition = 'opacity 240ms ease, transform 240ms ease';
    setTimeout(() => toast.remove(), 260);
  };

  toast.addEventListener('click', dismiss);
  container.appendChild(toast);

  const duration = options.duration || 5200;
  setTimeout(dismiss, duration);
}
