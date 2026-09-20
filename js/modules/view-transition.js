/**
 * Runs a DOM update inside a View Transition when the browser supports it.
 *
 * `direction` picks the animation (see the ::view-transition rules in
 * css/layout.css): 'forward' / 'back' are directional slides used for phone-width
 * navigation (drilling into a drink, returning to the list); anything else — and
 * every non-phone width — is the plain cross-fade. Without View Transitions
 * support, or with reduced motion / "fun animations" off, `update` just runs.
 *
 * Nested calls (e.g. renderCurrentView() invoked from inside an outer
 * transition's update) run their update directly, so one navigation is one
 * transition.
 */

import { state } from '../state.js';

let insideUpdate = false;

export function runViewTransition(update, direction = 'fade') {
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || !state.funAnimations;
  if (insideUpdate || reducedMotion || !document.startViewTransition) {
    update();
    return;
  }

  window._activeViewTransition?.skipTransition?.();

  const root = document.documentElement;
  const isPhone = window.innerWidth <= 768;
  root.dataset.viewNav = isPhone && (direction === 'forward' || direction === 'back') ? direction : 'fade';

  const transition = document.startViewTransition(() => {
    insideUpdate = true;
    try {
      update();
    } finally {
      insideUpdate = false;
    }
  });
  window._activeViewTransition = transition;
  transition.ready.catch(() => {});
  transition.finished.catch(() => {}).finally(() => {
    if (window._activeViewTransition === transition) {
      window._activeViewTransition = null;
      delete root.dataset.viewNav;
    }
  });
}
