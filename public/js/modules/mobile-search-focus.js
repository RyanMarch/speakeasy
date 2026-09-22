/**
 * Keeps the mobile drinks list usable while the search keyboard is open.
 *
 * iOS Safari doesn't resize the layout viewport for the on-screen keyboard; it
 * scrolls the page to bring the focused field into view, which drags the sticky
 * header/search box off screen, hides the footer behind the keyboard, and keeps
 * nudging the page as the list scrolls. So while the search field is focused on
 * a phone-width screen we stop page scrolling altogether: the list becomes its
 * own scroller inside a panel pinned to the *visual* viewport (the part of the
 * screen the keyboard leaves visible). See `html.kbd-open` in css/responsive.css.
 */

import { elements } from '../state.js';

// Read lazily: this module is imported by Node-side tests, where `document` doesn't exist.
const getRoot = () => document.documentElement;
let active = false;
let savedScrollY = 0;

const stackHeight = () =>
  (document.querySelector('.app-header')?.offsetHeight || 0)
  + (elements.searchInput?.closest('.sidebar-search-box')?.offsetHeight || 0);

function syncViewport() {
  const vv = window.visualViewport;
  getRoot().style.setProperty('--vv-top', `${vv ? vv.offsetTop : 0}px`);
  getRoot().style.setProperty('--vv-height', `${vv ? vv.height : window.innerHeight}px`);
}

function enter() {
  if (active || window.innerWidth > 768) return;
  const list = elements.recipeList;
  if (!list) return;
  active = true;
  savedScrollY = window.scrollY;
  // How far the list is scrolled behind the sticky header + search box, so the
  // same drinks stay in view once the list scrolls on its own.
  const listDocTop = list.getBoundingClientRect().top + savedScrollY;
  const offset = Math.max(0, savedScrollY + stackHeight() - listDocTop);
  syncViewport();
  getRoot().classList.add('kbd-open');
  list.scrollTop = offset;
}

function leave() {
  if (!active) return;
  active = false;
  const list = elements.recipeList;
  const listScroll = list?.scrollTop || 0;
  getRoot().classList.remove('kbd-open');
  getRoot().style.removeProperty('--vv-top');
  getRoot().style.removeProperty('--vv-height');
  // Navigating away (e.g. tapping a drink) hides the list; that path sets its
  // own scroll, so don't fight it.
  if (!list || elements.sidebar?.classList.contains('mobile-hidden')) return;
  const listDocTop = list.getBoundingClientRect().top + window.scrollY;
  window.scrollTo(0, listScroll > 0 ? listScroll + listDocTop - stackHeight() : savedScrollY);
}

export function initMobileSearchFocus() {
  const input = elements.searchInput;
  if (!input) return;
  input.addEventListener('focus', enter);
  input.addEventListener('blur', leave);
  window.visualViewport?.addEventListener('resize', () => active && syncViewport());
  window.visualViewport?.addEventListener('scroll', () => active && syncViewport());
}
