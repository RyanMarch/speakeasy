/**
 * Speakeasy "Avoid" popover
 * A small card, anchored under the button that opened it and growing out of that
 * button, for picking what to leave out (egg, dairy, tree nuts,
 * honey). Used by the guest menu and by the bartender's own library search.
 * Choices apply to the list behind it as they're made, so it's already narrowed
 * by the time the sheet closes. The caller remembers the choice on the device
 * (see dietary.js); nothing is sent anywhere.
 */

import { escapeHtml } from '../components/toast.js';
import { closeDialog, enhanceDialog } from '../components/dialog-motion.js';
import { DIET_FLAGS } from '../modules/dietary.js';

/**
 * @param {object} opts
 * @param {string[]} opts.flags        the flags worth offering (those on this menu)
 * @param {Set<string>} opts.avoid     what's avoided now
 * @param {(avoid: Set<string>) => void} opts.onChange  called after every change
 * @param {HTMLElement} [opts.returnFocusTo]  the button that opened it: the card is anchored to it and focus returns to it
 */
export function openDietSheet({ flags, avoid, onChange, returnFocusTo }) {
  const offered = DIET_FLAGS.filter(f => flags.includes(f.key));
  const dialog = document.createElement('dialog');
  dialog.className = 'guest-diet-sheet';
  dialog.setAttribute('aria-label', 'Avoid');
  dialog.innerHTML = /*html*/`
    <h2 class="guest-diet-title">Avoid</h2>
    <div class="guest-diet-chips" role="group" aria-label="Leave out drinks with">
      ${offered.map(f => `<button type="button" class="guest-diet-chip" data-flag="${f.key}" aria-pressed="${avoid.has(f.key)}">${escapeHtml(f.label)}</button>`).join('')}
    </div>
    <div class="guest-diet-actions">
      <button type="button" class="btn btn-ghost btn-sm" data-action="diet-clear">Clear</button>
      <button type="button" class="btn btn-primary btn-sm" data-action="diet-done">Done</button>
    </div>
  `;
  enhanceDialog(dialog);
  document.body.appendChild(dialog);

  const sync = () => {
    dialog.querySelectorAll('.guest-diet-chip').forEach(chip => {
      chip.setAttribute('aria-pressed', String(avoid.has(chip.getAttribute('data-flag'))));
    });
  };

  dialog.addEventListener('click', (e) => {
    if (e.target === dialog || e.target.closest('[data-action="diet-done"]')) {
      closeDialog(dialog);
      return;
    }
    const chip = e.target.closest('.guest-diet-chip');
    if (chip) {
      const key = chip.getAttribute('data-flag');
      if (avoid.has(key)) avoid.delete(key);
      else avoid.add(key);
      sync();
      onChange(avoid);
    } else if (e.target.closest('[data-action="diet-clear"]')) {
      avoid.clear();
      sync();
      onChange(avoid);
    }
  });
  dialog.addEventListener('close', () => {
    dialog.remove();
    returnFocusTo?.focus?.({ preventScroll: true });
  });
  dialog.showModal();
  if (returnFocusTo?.isConnected) anchorTo(dialog, returnFocusTo);
}

const EDGE = 12; // px kept clear of the screen edge
const GAP = 8; // px between the button and the card

/**
 * Places the card just under `anchor`, right-aligned to it where there's room,
 * and points its transform origin at the button's center so it opens from the
 * button and closes back into it. Without an anchor it stays centered.
 */
function anchorTo(dialog, anchor) {
  const a = anchor.getBoundingClientRect();
  const width = Math.min(dialog.offsetWidth, window.innerWidth - EDGE * 2);
  const left = Math.max(EDGE, Math.min(a.right - width, window.innerWidth - width - EDGE));
  const top = Math.min(a.bottom + GAP, window.innerHeight - dialog.offsetHeight - EDGE);
  dialog.classList.add('is-anchored');
  dialog.style.left = `${left}px`;
  dialog.style.top = `${Math.max(EDGE, top)}px`;
  dialog.style.setProperty('--diet-origin-x', `${a.left + a.width / 2 - left}px`);
  dialog.style.setProperty('--diet-origin-y', `${a.top + a.height / 2 - Math.max(EDGE, top)}px`);
}
