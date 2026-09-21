/**
 * Speakeasy "I'd like this" order card
 * A full-screen card a guest shows their bartender (or sends them) for one drink
 * or several. There is deliberately no ordering backend: the host is a person
 * standing right there, so the job is to make the request unmistakable from
 * across a counter, and easy to send if the host is across the room.
 *
 * Like the fullscreen QR: a <dialog> that keeps the screen awake while it's up.
 */

import { escapeHtml, showToast } from '../components/toast.js';
import { renderGlassSvg } from '../modules/glass-view.js';
import { buildOrderMessage, getGuestName, setGuestName, MAX_NAME_LENGTH } from '../modules/guest-order.js';
import { closeDialog, enhanceDialog } from '../components/dialog-motion.js';

/**
 * @param {object} opts
 * @param {Array<object>} opts.drinks    the drinks being asked for (full recipes)
 * @param {string} opts.menuName
 * @param {string} opts.glassMode        'layered' | 'blended'
 * @param {HTMLElement} [opts.returnFocusTo]
 */
export async function openOrderCard({ drinks, menuName, glassMode, returnFocusTo }) {
  if (!drinks || drinks.length === 0) return;
  const single = drinks.length === 1;

  const dialog = document.createElement('dialog');
  dialog.className = 'guest-order';
  dialog.setAttribute('aria-label', 'Your order to show the bartender');
  dialog.innerHTML = /*html*/`
    <button type="button" class="guest-order-close" data-action="order-close" aria-label="Close">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><line x1="6" y1="6" x2="18" y2="18"></line><line x1="18" y1="6" x2="6" y2="18"></line></svg>
    </button>
    <div class="guest-order-body">
      <div class="guest-order-eyebrow">Show your bartender</div>
      <div class="guest-order-for" data-role="for" hidden></div>
      ${single ? /*html*/`
        <div class="guest-order-glass">${renderGlassSvg(drinks[0], 'order-glass', { mode: glassMode })}</div>
        <div class="guest-order-name">${escapeHtml(drinks[0].name)}</div>
      ` : /*html*/`
        <ol class="guest-order-list">
          ${drinks.map(d => `<li>${escapeHtml(d.name)}</li>`).join('')}
        </ol>
      `}
      <label class="guest-order-namefield">
        <span>Add your name (optional)</span>
        <input type="text" class="guest-order-nameinput" name="order-for" maxlength="${MAX_NAME_LENGTH}"
          value="${escapeHtml(getGuestName())}" placeholder="e.g. Alex"
          autocomplete="off" autocapitalize="words" autocorrect="off" spellcheck="false" enterkeyhint="done"
          data-1p-ignore data-lpignore="true" data-bwignore="true" data-form-type="other">
      </label>
      <div class="guest-order-actions">
        <button type="button" class="btn btn-primary" data-action="order-send">Send to the host…</button>
        <button type="button" class="btn btn-secondary" data-action="order-copy">Copy message</button>
      </div>
    </div>
  `;
  enhanceDialog(dialog);
  document.body.appendChild(dialog);

  const nameInput = dialog.querySelector('.guest-order-nameinput');
  const forEl = dialog.querySelector('[data-role="for"]');
  const message = () => buildOrderMessage({ name: nameInput.value, drinkNames: drinks.map(d => d.name) });

  const syncFor = () => {
    const name = nameInput.value.trim();
    forEl.hidden = name === '';
    forEl.textContent = name ? `For ${name}` : '';
  };
  syncFor();
  nameInput.addEventListener('input', () => {
    setGuestName(nameInput.value);
    syncFor();
  });
  nameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      nameInput.blur();
    }
  });

  let wakeLock = null;
  try {
    wakeLock = await navigator.wakeLock?.request('screen');
  } catch {
    // Not supported / not allowed: the card still works, the screen may just dim.
  }
  const cleanup = () => {
    wakeLock?.release().catch(() => {});
    dialog.remove();
    returnFocusTo?.focus?.({ preventScroll: true });
  };
  dialog.addEventListener('close', cleanup);

  dialog.addEventListener('click', async (e) => {
    const action = e.target.closest('[data-action]')?.getAttribute('data-action');
    if (e.target === dialog || action === 'order-close') {
      closeDialog(dialog);
    } else if (action === 'order-send') {
      const text = message();
      if (navigator.share) {
        try {
          await navigator.share({ title: menuName, text });
        } catch {
          // Cancelled: nothing to do.
        }
      } else {
        await copyMessage(text);
      }
    } else if (action === 'order-copy') {
      await copyMessage(message());
    }
  });

  dialog.showModal();
}

async function copyMessage(text) {
  try {
    await navigator.clipboard.writeText(text);
    showToast('Message copied');
  } catch {
    showToast('Couldn’t copy. Long-press to select the text instead');
  }
}
