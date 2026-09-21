/**
 * Subtle motion for the app's full-screen <dialog>s (the order card and the
 * fullscreen QR): a short fade-and-rise on the way in, and the same in reverse
 * on the way out, including for Escape. Both are skipped for anyone who has
 * asked for reduced motion or turned off the app's fun animations.
 *
 * Styled by `.dialog-motion` in css/shared-animations.css.
 */

import { state } from '../state.js';

function motionAllowed() {
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  return !reduced && state.funAnimations !== false;
}

/** Closes a dialog with its exit animation (or immediately when motion is off). */
export function closeDialog(dialog) {
  if (!dialog.open) return;
  if (!motionAllowed()) {
    dialog.close();
    return;
  }
  if (dialog.classList.contains('is-closing')) return;
  dialog.classList.add('is-closing');
  const finish = () => {
    if (dialog.open) dialog.close();
  };
  dialog.addEventListener('animationend', finish, { once: true });
  // If the animation never reports back (a backgrounded tab), still close.
  setTimeout(finish, 320);
}

/** Opts a dialog into the shared motion, and routes Escape through the animated close. */
export function enhanceDialog(dialog) {
  dialog.classList.add('dialog-motion');
  dialog.addEventListener('cancel', (e) => {
    if (!motionAllowed()) return;
    e.preventDefault();
    closeDialog(dialog);
  });
}
