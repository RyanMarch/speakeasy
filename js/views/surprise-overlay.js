/**
 * Speakeasy "Surprise me" reveal
 * A full-screen, deliberately over-the-top moment for a guest who tapped
 * "Surprise me": glasses flash past like a slot machine, slow down, and land
 * on the pick with a bounce and a burst of confetti. The pick is chosen up
 * front (see modules/shuffle-schedule.js); this is the theatre around it.
 *
 * Tap anywhere while it spins to skip to the reveal. Escape or the close
 * button dismisses it. With reduced motion (or the app's "fun animations"
 * off) callers skip it entirely; see shouldAnimateSurprise().
 */

import { state } from '../state.js';
import { escapeHtml } from '../components/toast.js';
import { renderGlassSvg } from '../modules/glass-view.js';
import { buildShuffleSchedule, captionForFrame } from '../modules/shuffle-schedule.js';

const CONFETTI_COLORS = ['#e8c47f', '#d4a359', '#c7625e', '#f5f2ea', '#7cb894', '#c48b59'];
const CONFETTI_COUNT = 34;
const SPARKLE_COUNT = 8;

// How long the winning drink sits on screen before the celebration fires.
const LAND_BEAT_MS = 200;

export function shouldAnimateSurprise() {
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  return !reduced && state.funAnimations !== false;
}

function pickRandom(pool, excludeId) {
  const options = pool.filter(r => r.id !== excludeId);
  const source = options.length > 0 ? options : pool;
  return source[Math.floor(Math.random() * source.length)];
}

function burstConfetti(layer) {
  for (let i = 0; i < CONFETTI_COUNT; i++) {
    const piece = document.createElement('span');
    piece.className = 'guest-shuffle-piece';
    const size = 6 + Math.random() * 6;
    piece.style.width = `${size}px`;
    piece.style.height = `${Math.random() < 0.5 ? size : size * 0.45}px`;
    piece.style.borderRadius = Math.random() < 0.35 ? '50%' : '2px';
    piece.style.background = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
    layer.appendChild(piece);

    const angle = Math.random() * Math.PI * 2;
    const power = 90 + Math.random() * 190;
    const dx = Math.cos(angle) * power;
    const dy = Math.sin(angle) * power - 60; // bias upward, then gravity pulls it down
    const spin = (Math.random() - 0.5) * 900;
    const animation = piece.animate([
      { transform: 'translate(0, 0) rotate(0deg) scale(1)', opacity: 1 },
      { transform: `translate(${dx}px, ${dy}px) rotate(${spin * 0.6}deg) scale(1)`, opacity: 1, offset: 0.55 },
      { transform: `translate(${dx * 1.08}px, ${dy + 170}px) rotate(${spin}deg) scale(0.8)`, opacity: 0 },
    ], { duration: 1000 + Math.random() * 600, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)', fill: 'forwards' });
    animation.onfinish = () => piece.remove();
  }
}

/**
 * Opens the reveal.
 * @param {object} opts
 * @param {Array}  opts.pool          drinks that can be picked (and flash past)
 * @param {string} opts.glassMode     'layered' | 'blended', as elsewhere
 * @param {(recipe) => string} opts.describe  one-line description for the reveal
 * @param {(recipe, dismiss: () => void) => void} opts.onSeeRecipe called with the
 *        pick when the guest wants the recipe. The overlay stays up until the
 *        caller invokes `dismiss` (after the recipe has rendered underneath), so
 *        the menu behind it is never exposed in between.
 * @param {HTMLElement} [opts.returnFocusTo] focus goes back here on close
 */
export function openSurpriseOverlay({ pool, glassMode, describe, onSeeRecipe, returnFocusTo }) {
  const overlay = document.createElement('div');
  overlay.className = 'guest-shuffle';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'guest-shuffle-caption');
  // Its own transition layer: when the page underneath transitions to the
  // recipe, the overlay fades away on top of it instead of being flattened into
  // the page snapshot and sliding along with it.
  overlay.style.viewTransitionName = 'guest-shuffle';
  overlay.innerHTML = /*html*/`
    <button type="button" class="guest-shuffle-close" data-action="shuffle-close" aria-label="Close">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><line x1="6" y1="6" x2="18" y2="18"></line><line x1="18" y1="6" x2="6" y2="18"></line></svg>
    </button>
    <div class="guest-shuffle-stage is-spinning">
      <div class="guest-shuffle-caption" id="guest-shuffle-caption" aria-live="polite"></div>
      <div class="guest-shuffle-arena" aria-hidden="true">
        <span class="guest-shuffle-ring"></span>
        <span class="guest-shuffle-ring"></span>
        <span class="guest-shuffle-ring"></span>
        <span class="guest-shuffle-sparkles">${Array.from({ length: SPARKLE_COUNT }, (_, i) => `<i style="--a:${(360 / SPARKLE_COUNT) * i}deg; --d:${(i % 4) * 0.25}s">✦</i>`).join('')}</span>
        <div class="guest-shuffle-glass"></div>
      </div>
      <div class="guest-shuffle-name" aria-hidden="true"></div>
      <div class="guest-shuffle-reveal" hidden>
        <span class="guest-shuffle-meta"></span>
        <p class="guest-shuffle-blurb"></p>
        <div class="guest-shuffle-actions">
          <button type="button" class="btn btn-primary" data-action="shuffle-open">See the recipe →</button>
          <button type="button" class="btn btn-secondary" data-action="shuffle-again">Spin again</button>
        </div>
      </div>
      <div class="guest-shuffle-skip">Tap to skip</div>
    </div>
    <div class="guest-shuffle-confetti" aria-hidden="true"></div>
  `;
  document.body.appendChild(overlay);
  document.documentElement.classList.add('guest-shuffle-open');

  const stage = overlay.querySelector('.guest-shuffle-stage');
  const caption = overlay.querySelector('.guest-shuffle-caption');
  const glass = overlay.querySelector('.guest-shuffle-glass');
  const nameEl = overlay.querySelector('.guest-shuffle-name');
  const reveal = overlay.querySelector('.guest-shuffle-reveal');
  const confetti = overlay.querySelector('.guest-shuffle-confetti');

  let timers = [];
  let pick = null;
  let frames = [];
  let landed = false;

  const clearTimers = () => {
    timers.forEach(clearTimeout);
    timers = [];
  };

  const showFrame = (index) => {
    const frame = frames[index];
    glass.innerHTML = renderGlassSvg(frame.recipe, `shuffle-${index % 2}`, { mode: glassMode });
    nameEl.textContent = frame.recipe.name;
    caption.textContent = captionForFrame(index, frames.length);
    // A quick drop-in on each tick sells the "reel" without needing a real one.
    glass.animate(
      [{ transform: 'translateY(-14px) scale(0.96)', opacity: 0.55 }, { transform: 'none', opacity: 1 }],
      { duration: Math.max(60, Math.min(frame.delay, 150)), easing: 'ease-out' }
    );
  };

  const land = () => {
    if (landed) return;
    landed = true;
    clearTimers();
    stage.classList.remove('is-spinning');
    stage.classList.add('is-landed');
    caption.textContent = 'Tonight, you’re having…';
    nameEl.classList.add('is-final');
    overlay.querySelector('.guest-shuffle-meta').textContent = [pick.glassware, pick.method].filter(Boolean).join(' · ');
    overlay.querySelector('.guest-shuffle-blurb').textContent = describe(pick);

    glass.animate([
      { transform: 'scale(0.72) rotate(-7deg)' },
      { transform: 'scale(1.2) rotate(3deg)', offset: 0.55 },
      { transform: 'scale(1) rotate(0deg)' },
    ], { duration: 650, easing: 'cubic-bezier(0.2, 1.3, 0.4, 1)' });
    nameEl.animate([{ transform: 'scale(0.85)', opacity: 0.4 }, { transform: 'scale(1)', opacity: 1 }], { duration: 450, easing: 'cubic-bezier(0.2, 1.3, 0.4, 1)' });

    reveal.hidden = false;
    reveal.animate([{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }], { duration: 420, delay: 250, easing: 'ease-out', fill: 'backwards' });
    burstConfetti(confetti);
    navigator.vibrate?.([18, 40, 30]); // a little thunk on phones that support it
    overlay.querySelector('[data-action="shuffle-open"]').focus({ preventScroll: true });
  };

  const run = (nextPick) => {
    clearTimers();
    landed = false;
    pick = nextPick;
    frames = buildShuffleSchedule(pool, pick);
    stage.classList.add('is-spinning');
    stage.classList.remove('is-landed');
    nameEl.classList.remove('is-final');
    reveal.hidden = true;

    let elapsed = 0;
    frames.forEach((frame, index) => {
      timers.push(setTimeout(() => showFrame(index), elapsed));
      elapsed += frame.delay;
    });
    // The pick is the last frame; the reveal fires a short beat after it appears.
    timers.push(setTimeout(land, elapsed - frames[frames.length - 1].delay + LAND_BEAT_MS));
  };

  const skip = () => {
    if (landed) return;
    clearTimers();
    showFrame(frames.length - 1);
    land();
  };

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    clearTimers();
    document.removeEventListener('keydown', onKeydown);
    document.documentElement.classList.remove('guest-shuffle-open');
    overlay.remove();
    returnFocusTo?.focus?.({ preventScroll: true });
  };

  const onKeydown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    } else if (e.key === 'Tab') {
      // Keep keyboard focus inside the dialog while it's open.
      const focusable = [...overlay.querySelectorAll('button')].filter(b => !b.closest('[hidden]'));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };
  document.addEventListener('keydown', onKeydown);

  overlay.addEventListener('click', (e) => {
    const action = e.target.closest('[data-action]')?.getAttribute('data-action');
    if (action === 'shuffle-close') close();
    else if (action === 'shuffle-open') {
      // Navigate first and keep the overlay up: closing it now would expose the
      // menu for the few frames before the recipe page takes over. The caller
      // dismisses it once the recipe is on screen; the timeout is a safety net
      // so a navigation that never renders can't strand the guest behind it.
      overlay.classList.add('is-leaving');
      clearTimers();
      onSeeRecipe(pick, close);
      setTimeout(close, 2000);
    } else if (action === 'shuffle-again') run(pickRandom(pool, pick.id));
    else if (!landed) skip();
  });

  overlay.querySelector('[data-action="shuffle-close"]').focus({ preventScroll: true });
  run(pickRandom(pool, null));
  return { close };
}
