/**
 * Speakeasy Guest Menu View (Hosting Mode)
 * What a guest sees after scanning the host's QR code: the host's published
 * menu as a phone-first grid of glass cards, a "Surprise me" button, and a
 * tap-through to a full recipe. Read-only and account-free; like
 * shared-recipe-view.js it doesn't touch the visitor's own library state.
 *
 * Routes (hash-based, so browser/swipe back works on a phone):
 *   #menu/<id>            the menu
 *   #menu/<id>/<drinkId>  one drink from it
 */

import { state, elements, SEED_RECIPE_IDS } from '../state.js';
import { runViewTransition } from '../modules/view-transition.js';
import { openSurpriseOverlay, shouldAnimateSurprise } from './surprise-overlay.js';
import { escapeHtml } from '../components/toast.js';
import { renderGlassSvg } from '../modules/glass-view.js';
import { formatIngredientName } from '../modules/parser.js';
import { fetchGuestMenu, parseMenuCode, rememberGuestMenu, recallGuestMenu, forgetGuestMenu } from '../modules/menu-publish.js';
import { summarizeMoods } from '../modules/moods.js';
import { buildTraits, buildQuizQuestions, rankForQuiz } from '../modules/quiz.js';
import { renderRecipe } from './shared-recipe-view.js';

// A guest who leaves the tab open all evening should still see "out" changes
// the next time they look at it, without polling in the background.
const STALE_AFTER_MS = 15 * 1000;

/**
 * Fetches the menu, and remembers the good copy. A definite "not found" means
 * the host took it down (and clears any remembered copy); any other failure
 * (offline, server restarting) falls back to the remembered copy if there is
 * one, flagged `offline`, and only throws when there's nothing to show.
 */
async function loadMenu(menuId) {
  try {
    const menu = await fetchGuestMenu(menuId);
    rememberGuestMenu(menuId, menu);
    return { menu, offline: false };
  } catch (err) {
    if (err.status === 404) {
      forgetGuestMenu(menuId);
      throw err;
    }
    const saved = recallGuestMenu(menuId);
    if (saved) return { menu: saved, offline: true };
    throw err;
  }
}

const DESCRIPTION_PREVIEW_CHARS = 90;

let cached = null; // { menuId, menu, fetchedAt }

function getContainer() {
  return elements.guestMenuViewContainer;
}

// On a phone the page scrolls in the window; on desktop the app scrolls inside
// its main stage (see router.js's resetScroll, which handles both). Anything
// that moves the scroll position has to know which one is doing the scrolling.
function scrollElement() {
  const stage = elements.mainStage;
  return stage && stage.scrollHeight > stage.clientHeight ? stage : window;
}

function scrollByPx(dy) {
  scrollElement().scrollBy({ top: dy, behavior: 'auto' });
}

function scrollToTop() {
  if (elements.mainStage) elements.mainStage.scrollTop = 0;
  window.scrollTo(0, 0);
}

function isOut(menu, recipeId) {
  return Array.isArray(menu.unavailable) && menu.unavailable.includes(recipeId);
}

// Guests mostly don't know the ingredients by sight, so lead with the host's
// own description when there is one, and fall back to the ingredient list.
function cardBlurb(recipe) {
  if (recipe.description) {
    const text = recipe.description.trim();
    return text.length > DESCRIPTION_PREVIEW_CHARS
      ? `${text.slice(0, DESCRIPTION_PREVIEW_CHARS).replace(/\s+\S*$/, '')}…`
      : text;
  }
  return (recipe.specs || []).map(s => formatIngredientName(s.name)).filter(Boolean).slice(0, 4).join(', ');
}

function renderMessage(container, title, detail) {
  container.innerHTML = /*html*/`
    <div class="empty-state guest-menu-message">
      <div class="empty-state-title">${escapeHtml(title)}</div>
      ${detail ? `<p class="card-content-text">${escapeHtml(detail)}</p>` : ''}
    </div>
  `;
}

/**
 * The dead-end screen (menu gone, code mistyped, link truncated): branded, with
 * a way into the app, and a code box so a guest reading a code off a printed
 * card or the host's screen isn't stuck.
 */
function renderUnavailable(container, notice) {
  container.innerHTML = /*html*/`
    <div class="guest-menu-unavailable">
      <img class="guest-menu-unavailable-logo" src="/assets/icon-round.png" width="72" height="72" alt="">
      <div class="guest-menu-unavailable-brand">Speakeasy</div>
      <h1 class="guest-menu-unavailable-title">${escapeHtml(notice || 'This menu isn’t available')}</h1>
      <p class="guest-menu-unavailable-text">The host may have taken it down, or the link may be incomplete. Ask them for a fresh link or code.</p>

      <!-- Deliberately not a <form>, and the field is deliberately named and
           attributed to look nothing like a login: Safari's iCloud Passwords
           (and 1Password/LastPass/Bitwarden/Dashlane) offer to AutoFill any
           lone text field beside a submit button. This is a lookup box, so
           every opt-out below is intentional; see submitMenuCode(). -->
      <div class="guest-menu-code-form" role="group" aria-labelledby="guest-menu-join-label">
        <span class="guest-menu-code-label" id="guest-menu-join-label">Have a menu code?</span>
        <div class="guest-menu-code-row">
          <input id="guest-menu-join" class="guest-menu-code-input" name="guest-menu-join" type="text"
            aria-labelledby="guest-menu-join-label" placeholder="e.g. FiAhadLB8G"
            autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false"
            inputmode="text" enterkeyhint="go"
            data-1p-ignore data-lpignore="true" data-bwignore="true" data-form-type="other">
          <button type="button" class="btn btn-primary" data-action="open-menu-code" disabled>Open menu</button>
        </div>
        <p class="guest-menu-code-error" role="alert" hidden>That doesn’t look like a menu code. Codes are 10 letters and numbers.</p>
        <p class="guest-menu-code-hint">Or point your phone’s camera at the host’s QR code.</p>
      </div>

      <a class="btn btn-secondary guest-menu-unavailable-cta" href="/app">Explore Speakeasy</a>
    </div>
  `;

  const input = container.querySelector('#guest-menu-join');
  const error = container.querySelector('.guest-menu-code-error');
  const openButton = container.querySelector('[data-action="open-menu-code"]');
  // Nothing to open until something has been typed or pasted.
  const syncOpenButton = () => { openButton.disabled = input.value.trim() === ''; };
  input.addEventListener('input', syncOpenButton);
  const submitMenuCode = () => {
    if (openButton.disabled) return;
    const id = parseMenuCode(input.value);
    error.hidden = Boolean(id);
    if (id) window.location.hash = menuHash(id);
  };
  openButton.addEventListener('click', submitMenuCode);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submitMenuCode();
    }
  });
}

/**
 * Parses a `menu/<id>` or `menu/<id>/<drinkId>` hash (no leading '#') into
 * the state.pendingGuestMenu shape, or null when it isn't a guest-menu route.
 */
export function parseGuestMenuHash(rawHash) {
  if (!rawHash || !rawHash.startsWith('menu/')) return null;
  const [menuId, drinkId] = rawHash.slice('menu/'.length).split('/');
  if (!menuId) return null;
  // `~quiz` can't collide with a drink: ids are slugs, which never contain '~'.
  if (drinkId === QUIZ_SEGMENT) return { menuId, drinkId: null, quiz: true };
  let decodedDrink = null;
  if (drinkId) {
    try {
      decodedDrink = decodeURIComponent(drinkId);
    } catch {
      decodedDrink = null;
    }
  }
  return { menuId, drinkId: decodedDrink, quiz: false };
}

const QUIZ_SEGMENT = '~quiz';

// Set by the "Surprise me" reveal so it can stay on screen until the recipe it
// picked has actually rendered underneath (see openDrink in renderMenu).
let afterDrinkRender = null;

function runAfterDrinkRender() {
  const callback = afterDrinkRender;
  afterDrinkRender = null;
  callback?.();
}

// How deep a route is: the menu is the root, the quiz sits one level in, and a
// drink is one more (whether you got to it from the menu or a quiz result).
function routeDepth(route) {
  return route.drinkId ? 2 : route.quiz ? 1 : 0;
}

/**
 * Which way a navigation between two guest routes should animate: 'forward'
 * when going deeper, 'back' when coming out (including the phone's back
 * gesture, which arrives as the same hashchange), and a plain fade otherwise.
 */
export function guestNavDirection(from, to) {
  if (!from || !to || from.menuId !== to.menuId) return 'fade';
  const delta = routeDepth(to) - routeDepth(from);
  return delta > 0 ? 'forward' : delta < 0 ? 'back' : 'fade';
}

// Browsers without View Transitions (iOS before 18) would otherwise swap pages
// with no motion at all, so give them a small fade-up instead. Skipped for the
// first paint (the container already fades in) and for background refreshes.
let hasRendered = false;

function softEnter(el, { quiet = false } = {}) {
  const first = !hasRendered;
  hasRendered = true;
  if (first || quiet || document.startViewTransition) return;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || !state.funAnimations) return;
  el.animate(
    [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }],
    { duration: 260, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' }
  );
}

/**
 * "We couldn't get an answer": a network or server hiccup, which is not the
 * same as the menu being gone, so it gets a retry instead of "unavailable".
 */
function renderUnreachable(container) {
  container.innerHTML = /*html*/`
    <div class="guest-menu-unavailable">
      <img class="guest-menu-unavailable-logo" src="/assets/icon-round.png" width="72" height="72" alt="">
      <div class="guest-menu-unavailable-brand">Speakeasy</div>
      <h1 class="guest-menu-unavailable-title">Can’t reach the menu</h1>
      <p class="guest-menu-unavailable-text">Your connection may be slow or offline. The menu is probably fine.</p>
      <button type="button" class="btn btn-primary guest-menu-unavailable-cta" data-action="retry-menu">Try again</button>
    </div>
  `;
  container.querySelector('[data-action="retry-menu"]').addEventListener('click', () => renderGuestMenuView());
}

function menuHash(menuId, drinkId) {
  return drinkId ? `#menu/${menuId}/${encodeURIComponent(drinkId)}` : `#menu/${menuId}`;
}

function quizHash(menuId) {
  return `#menu/${menuId}/${QUIZ_SEGMENT}`;
}

// Chips only earn their space on a menu big enough to browse: on a five-drink
// menu they'd be more to read than the list itself.
const MIN_DRINKS_FOR_MOOD_CHIPS = 8;

// The chip row scrolls sideways on a phone, and nothing about a row of pills
// says so. Two cues: an edge fade on whichever side has more chips (driven by
// classes updated on scroll), and, once per menu per session, a short
// slide-and-return that shows the row moves. See guest-menu-view.css.
const chipNudgedMenus = new Set();

function setupChipRowAffordances(row, menuId) {
  const update = () => {
    const max = row.scrollWidth - row.clientWidth;
    row.classList.toggle('can-scroll-left', row.scrollLeft > 4);
    row.classList.toggle('can-scroll-right', max > 4 && row.scrollLeft < max - 4);
  };
  row.addEventListener('scroll', update, { passive: true });
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(update).observe(row);
  update();

  const overflow = row.scrollWidth - row.clientWidth;
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (overflow < 24 || reducedMotion) return;

  // Once per menu per session, so a guest who's seen it isn't nudged on every
  // visit back from a drink. sessionStorage can be unavailable (private mode);
  // the in-memory set covers that.
  const key = `speakeasy_chip_nudge_${menuId}`;
  try {
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');
  } catch {
    if (chipNudgedMenus.has(menuId)) return;
  }
  if (chipNudgedMenus.has(menuId)) return;
  chipNudgedMenus.add(menuId);

  // Touching the row at all means they've found it; don't fight them.
  let touched = false;
  const stop = () => { touched = true; };
  row.addEventListener('pointerdown', stop, { once: true, passive: true });
  row.addEventListener('touchstart', stop, { once: true, passive: true });

  setTimeout(() => {
    if (touched || !row.isConnected) return;
    row.classList.add('is-nudging'); // suspends scroll-snap so the slide is smooth
    row.scrollTo({ left: Math.min(80, overflow), behavior: 'smooth' });
    setTimeout(() => {
      if (!touched && row.isConnected) row.scrollTo({ left: 0, behavior: 'smooth' });
      setTimeout(() => row.classList.remove('is-nudging'), 600);
    }, 700);
  }, 900);
}

// A quiz needs enough drinks that "your match" is a real choice.
const MIN_DRINKS_FOR_QUIZ = 6;

// The mood filter is remembered while the guest moves between a drink and the
// menu, but not across different menus.
let activeMood = { menuId: null, key: null };

function renderMenu(container, menuId, menu, { quiet = false } = {}) {
  const { moods, byRecipe } = summarizeMoods(menu.recipes.filter(r => !isOut(menu, r.id)));
  const showChips = menu.recipes.length >= MIN_DRINKS_FOR_MOOD_CHIPS && moods.length >= 2;
  const showQuiz = menu.recipes.filter(r => !isOut(menu, r.id)).length >= MIN_DRINKS_FOR_QUIZ;

  // A remembered filter that no longer applies (different menu, or the host
  // just marked its last drink out) quietly falls back to "All".
  if (activeMood.menuId !== menuId || !showChips || !moods.some(m => m.key === activeMood.key)) {
    activeMood = { menuId, key: null };
  }

  const matchesMood = (recipe) => !activeMood.key || (byRecipe.get(recipe.id) || []).includes(activeMood.key);

  const cardHtml = (recipe, idx) => {
    const unavailable = isOut(menu, recipe.id);
    return /*html*/`
      <button type="button" class="guest-menu-card${unavailable ? ' is-out' : ''}" style="--i:${Math.min(idx, 11)}"
        data-recipe-id="${escapeHtml(recipe.id)}" ${unavailable ? 'disabled aria-disabled="true"' : ''}>
        <span class="guest-menu-card-glass">${renderGlassSvg(recipe, `guest-glass-${idx}`, { mode: state.glassViewMode })}</span>
        <span class="guest-menu-card-name">${escapeHtml(recipe.name)}</span>
        <span class="guest-menu-card-meta">${escapeHtml([recipe.glassware, recipe.method].filter(Boolean).join(' · '))}</span>
        <span class="guest-menu-card-blurb">${escapeHtml(cardBlurb(recipe))}</span>
        ${unavailable ? '<span class="guest-menu-card-out">Out for now</span>' : ''}
      </button>
    `;
  };

  // The list under the current filter: available drinks first, then "out"
  // drinks (kept visible so nothing seems to vanish, but dimmed and last).
  const visibleDrinks = () => {
    const inMood = menu.recipes.filter(matchesMood);
    return {
      available: inMood.filter(r => !isOut(menu, r.id)),
      out: inMood.filter(r => isOut(menu, r.id)),
    };
  };

  const totalAvailable = menu.recipes.filter(r => !isOut(menu, r.id)).length;
  const chipHtml = (key, label) => /*html*/`
    <button type="button" class="guest-menu-chip" data-mood="${escapeHtml(key)}" aria-pressed="${(activeMood.key || '') === key}">${escapeHtml(label)}</button>
  `;

  container.innerHTML = /*html*/`
    ${cached?.offline ? '<div class="guest-menu-offline" role="status">Showing a saved copy of this menu. Reconnecting…</div>' : ''}
    <div class="guest-menu-header">
      <div class="guest-menu-eyebrow"><span>Tonight’s menu</span></div>
      <h1 class="guest-menu-title">${escapeHtml(menu.name)}</h1>
      <p class="guest-menu-subtitle" data-role="subtitle"></p>
      ${totalAvailable > 1 ? /*html*/`
        <div class="guest-menu-actions">
          ${showQuiz ? /*html*/`
            <button type="button" class="btn btn-primary guest-menu-surprise" data-action="quiz">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l1.9 5.6L19.5 10l-4.3 3.5 1.4 5.7L12 16l-4.6 3.2 1.4-5.7L4.5 10l5.6-1.4z"></path></svg>
              Find my drink
            </button>
          ` : ''}
          <button type="button" class="btn ${showQuiz ? 'btn-secondary' : 'btn-primary'} guest-menu-surprise" data-action="surprise">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3"></rect><circle cx="8.5" cy="8.5" r="1"></circle><circle cx="15.5" cy="15.5" r="1"></circle><circle cx="12" cy="12" r="1"></circle></svg>
            <span data-role="surprise-label">Surprise me</span>
          </button>
        </div>
      ` : ''}
    </div>
    ${showChips ? /*html*/`
      <div class="guest-menu-filters">
        <div class="guest-menu-chips" role="group" aria-label="Filter drinks by mood">
          ${chipHtml('', 'All')}
          ${moods.map(m => chipHtml(m.key, m.label)).join('')}
        </div>
        <p class="guest-menu-mood-blurb" data-role="mood-blurb" aria-live="polite"></p>
      </div>
    ` : ''}
    <div class="guest-menu-grid"></div>
    <footer class="guest-menu-footer">
      Made with <a href="/" class="home-footer-link">Speakeasy</a>, the craft cocktail companion.
    </footer>
  `;

  const grid = container.querySelector('.guest-menu-grid');
  const subtitle = container.querySelector('[data-role="subtitle"]');
  const blurb = container.querySelector('[data-role="mood-blurb"]');
  const surpriseLabel = container.querySelector('[data-role="surprise-label"]');
  const activeMoodInfo = () => moods.find(m => m.key === activeMood.key);

  // Repaints only what the filter changes, so the sticky chip bar and the
  // guest's place on the page aren't rebuilt under their thumb.
  const paint = () => {
    const { available, out } = visibleDrinks();
    grid.innerHTML = [...available, ...out].map((r, i) => cardHtml(r, i)).join('');
    const info = activeMoodInfo();
    subtitle.textContent = info
      ? `${available.length} of ${totalAvailable} drinks.`
      : `${totalAvailable} drink${totalAvailable === 1 ? '' : 's'} pouring.`;
    if (blurb) {
      blurb.classList.toggle('is-hint', !info);
      blurb.innerHTML = info
        ? `<strong>${escapeHtml(info.label)}</strong>${escapeHtml(info.blurb)}`
        : 'Pick a mood to narrow the list.';
    }
    if (surpriseLabel) surpriseLabel.textContent = info ? `Surprise me · ${info.label}` : 'Surprise me';
    container.querySelectorAll('.guest-menu-chip').forEach(chip => {
      chip.setAttribute('aria-pressed', String((chip.getAttribute('data-mood') || '') === (activeMood.key || '')));
    });
  };
  // A background refresh (the host changed something) shouldn't replay the
  // cards' entrance animation and make the whole page flash.
  grid.classList.toggle('no-enter', quiet);
  paint();
  softEnter(container, { quiet });

  const chipRow = container.querySelector('.guest-menu-chips');
  if (chipRow) setupChipRowAffordances(chipRow, menuId);

  grid.addEventListener('click', (e) => {
    const card = e.target.closest('.guest-menu-card:not(.is-out)');
    if (card) window.location.hash = menuHash(menuId, card.getAttribute('data-recipe-id'));
  });

  container.querySelectorAll('.guest-menu-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const key = chip.getAttribute('data-mood') || null;
      // Tapping the active chip again clears it, the way most filters do.
      activeMood = { menuId, key: key === activeMood.key ? null : key };
      grid.classList.remove('no-enter');
      paint();
      // A shorter list shouldn't strand the guest below it: bring the top of
      // the grid back into view, just under the sticky chip bar.
      // Measured against the bar's real position, not its height: the bar
      // sticks a little below the top of the scroller on desktop.
      const bar = container.querySelector('.guest-menu-filters');
      const gap = grid.getBoundingClientRect().top - (bar ? bar.getBoundingClientRect().bottom : 0) - 8;
      if (gap < 0) scrollByPx(gap);
    });
  });

  container.querySelector('[data-action="quiz"]')?.addEventListener('click', () => {
    quiz = { menuId, step: 0, answers: {}, results: null, fromMenu: true };
    window.location.hash = quizHash(menuId);
  });

  container.querySelector('[data-action="surprise"]')?.addEventListener('click', (e) => {
    const { available } = visibleDrinks();
    if (available.length === 0) return;
    // `dismiss` (from the reveal overlay) is held until the recipe has rendered,
    // so the overlay keeps covering the menu right up to the handoff.
    const openDrink = (recipe, dismiss) => {
      afterDrinkRender = dismiss || null;
      window.location.hash = menuHash(menuId, recipe.id);
    };

    // With one drink, or reduced motion, there's nothing to shuffle: go straight there.
    if (available.length < 2 || !shouldAnimateSurprise()) {
      openDrink(available[Math.floor(Math.random() * available.length)]);
      return;
    }
    openSurpriseOverlay({
      pool: available,
      glassMode: state.glassViewMode,
      describe: cardBlurb,
      onSeeRecipe: openDrink,
      returnFocusTo: e.currentTarget,
    });
  });
}

// ---- "Find my drink" quiz -------------------------------------------------
// Progress lives here (not in the URL) so a guest can open a result, go back,
// and find their answers and picks still there. Each step is an in-page swap;
// the route (#menu/<id>/~quiz) only marks "the quiz is open", so the phone's
// back gesture leaves the quiz instead of walking back through every question.
let quiz = { menuId: null, step: 0, answers: {}, results: null, fromMenu: false };
const traitsCache = new WeakMap();

function traitsFor(menu) {
  if (!traitsCache.has(menu)) traitsCache.set(menu, buildTraits(menu.recipes));
  return traitsCache.get(menu);
}

function renderQuiz(container, menuId, menu, { quiet = false } = {}) {
  const orderable = menu.recipes.filter(r => !isOut(menu, r.id));
  const traits = traitsFor(menu);
  const questions = buildQuizQuestions(orderable, traits);

  // A deep link to the quiz (or another menu's leftover state) starts fresh.
  if (quiz.menuId !== menuId) quiz = { menuId, step: 0, answers: {}, results: null, fromMenu: false };

  // Back to the menu from anywhere in the quiz. When the guest came from the
  // menu, stepping back through history keeps the back stack tidy (menu, not
  // menu > quiz > menu); a deep link to the quiz has no such history to pop.
  const goToMenu = () => {
    if (quiz.fromMenu && window.history.length > 1) window.history.back();
    else window.location.hash = menuHash(menuId);
  };

  // The quiz's top row: "Back" (previous question, when there is one) on the
  // left and a persistent "Menu" exit on the right, on every screen.
  const topBarHtml = () => /*html*/`
    <div class="guest-quiz-topbar">
      <button type="button" class="menu-builder-back-link" data-action="quiz-back"></button>
      <button type="button" class="guest-quiz-menu-btn" data-action="quiz-menu-top" aria-label="Back to the menu">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1.5"></rect><rect x="14" y="3" width="7" height="7" rx="1.5"></rect><rect x="3" y="14" width="7" height="7" rx="1.5"></rect><rect x="14" y="14" width="7" height="7" rx="1.5"></rect></svg>
        Menu
      </button>
    </div>
  `;
  const wireMenuButton = () => {
    container.querySelector('[data-action="quiz-menu-top"]')?.addEventListener('click', goToMenu);
  };

  if (orderable.length === 0 || questions.length === 0) {
    renderMessage(container, 'Nothing to pick from right now', 'Every drink on this menu is out. Check back soon.');
    return;
  }

  // Question-to-question moves and the results reveal are page changes as far
  // as the guest is concerned, so they animate like one: forward as they go
  // deeper, back as they retreat.
  const go = (direction, mutate) => {
    mutate();
    runViewTransition(() => renderQuiz(container, menuId, menu), direction);
  };

  const backLink = (label, onClick) => {
    const btn = container.querySelector('[data-action="quiz-back"]');
    if (!label) {
      // First question: nothing to go back to, and the Menu button covers leaving.
      btn.remove();
      return;
    }
    btn.textContent = '';
    btn.insertAdjacentHTML('afterbegin', `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6"></polyline></svg>${escapeHtml(label)}`);
    btn.addEventListener('click', onClick);
  };

  const showResults = () => {
    // If the host ran out of a recommended drink while it was on screen, pick
    // again from what's left rather than showing something no one can order.
    if (quiz.results && quiz.results.some(r => !orderable.some(o => o.id === r.recipe.id))) quiz.results = null;
    if (!quiz.results) quiz.results = rankForQuiz(orderable, traits, quiz.answers);
    const [top, ...runnersUp] = quiz.results;
    const reasonsHtml = (reasons) => reasons.length
      ? `<span class="guest-quiz-reasons">${reasons.map(r => `<span class="guest-quiz-reason">${escapeHtml(r)}</span>`).join('')}</span>`
      : '';

    container.innerHTML = /*html*/`
      <div class="guest-quiz">
        ${topBarHtml()}
        <div class="guest-menu-eyebrow"><span>Your match</span></div>
        <button type="button" class="guest-quiz-top" data-recipe-id="${escapeHtml(top.recipe.id)}">
          <span class="guest-quiz-top-glass">${renderGlassSvg(top.recipe, 'quiz-top-glass', { mode: state.glassViewMode })}</span>
          <span class="guest-quiz-top-body">
            <span class="guest-quiz-top-name">${escapeHtml(top.recipe.name)}</span>
            <span class="guest-menu-card-meta">${escapeHtml([top.recipe.glassware, top.recipe.method].filter(Boolean).join(' · '))}</span>
            ${reasonsHtml(top.reasons)}
            <span class="guest-quiz-top-blurb">${escapeHtml(cardBlurb(top.recipe))}</span>
            <span class="guest-quiz-top-cta">See the recipe →</span>
          </span>
        </button>
        ${runnersUp.length ? /*html*/`
          <h2 class="guest-quiz-subhead">Also worth a try</h2>
          <div class="guest-quiz-runners">
            ${runnersUp.map((r, i) => /*html*/`
              <button type="button" class="guest-menu-card" data-recipe-id="${escapeHtml(r.recipe.id)}">
                <span class="guest-menu-card-glass">${renderGlassSvg(r.recipe, `quiz-runner-${i}`, { mode: state.glassViewMode })}</span>
                <span class="guest-menu-card-name">${escapeHtml(r.recipe.name)}</span>
                <span class="guest-menu-card-meta">${escapeHtml([r.recipe.glassware, r.recipe.method].filter(Boolean).join(' · '))}</span>
                ${reasonsHtml(r.reasons)}
              </button>
            `).join('')}
          </div>
        ` : ''}
        <div class="guest-quiz-actions">
          <button type="button" class="btn btn-secondary" data-action="quiz-restart">Start over</button>
          <button type="button" class="btn btn-ghost" data-action="quiz-menu">Back to the menu</button>
        </div>
      </div>
    `;
    backLink('Change answers', () => go('back', () => {
      quiz.results = null;
      quiz.step = questions.length - 1;
    }));
    container.querySelectorAll('[data-recipe-id]').forEach(el => {
      el.addEventListener('click', () => { window.location.hash = menuHash(menuId, el.getAttribute('data-recipe-id')); });
    });
    container.querySelector('[data-action="quiz-restart"]').addEventListener('click', () => go('back', () => {
      quiz = { menuId, step: 0, answers: {}, results: null, fromMenu: quiz.fromMenu };
    }));
    container.querySelector('[data-action="quiz-menu"]').addEventListener('click', goToMenu);
    wireMenuButton();
    if (!quiet) scrollToTop();
    softEnter(container, { quiet });
  };

  if (quiz.results || quiz.step >= questions.length) {
    showResults();
    return;
  }

  const question = questions[quiz.step];
  const chosen = quiz.answers[question.id];
  container.innerHTML = /*html*/`
    <div class="guest-quiz">
      ${topBarHtml()}
      <div class="guest-quiz-progress" role="img" aria-label="Question ${quiz.step + 1} of ${questions.length}">
        ${questions.map((_, i) => `<span class="guest-quiz-dot${i <= quiz.step ? ' is-done' : ''}"></span>`).join('')}
      </div>
      <h1 class="guest-quiz-question">${escapeHtml(question.title)}</h1>
      <div class="guest-quiz-options">
        ${question.options.map(o => /*html*/`
          <button type="button" class="guest-quiz-option${chosen === o.value ? ' is-chosen' : ''}${o.value === 'any' ? ' is-any' : ''}" data-value="${escapeHtml(o.value)}">
            <span class="guest-quiz-option-label">${escapeHtml(o.label)}</span>
            ${o.hint ? `<span class="guest-quiz-option-hint">${escapeHtml(o.hint)}</span>` : ''}
          </button>
        `).join('')}
      </div>
    </div>
  `;
  wireMenuButton();
  backLink(quiz.step === 0 ? null : 'Back', () => go('back', () => { quiz.step -= 1; }));
  container.querySelectorAll('.guest-quiz-option').forEach(option => {
    option.addEventListener('click', () => go('forward', () => {
      quiz.answers[question.id] = option.getAttribute('data-value');
      quiz.step += 1;
      quiz.results = null;
    }));
  });
  // Every question starts at the top (the last option on a phone sits below
  // the fold), but a background refresh must not yank a guest mid-scroll.
  if (!quiet) scrollToTop();
  softEnter(container, { quiet });
}

function renderDrink(container, menuId, menu, drinkId, { quiet = false } = {}) {
  const recipe = menu.recipes.find(r => r.id === drinkId);
  if (!recipe) {
    window.location.hash = menuHash(menuId);
    return;
  }
  // Both this and the shared-recipe page render the same detail card, which
  // looks its glass/popover elements up by id — make sure a stale copy in the
  // other (hidden) container can't be the one that gets found.
  if (elements.sharedRecipeViewContainer) elements.sharedRecipeViewContainer.innerHTML = '';

  renderRecipe(container, recipe, {
    badge: isOut(menu, recipe.id) ? 'Out for now' : `On the menu · ${menu.name}`,
    backLabel: 'Menu',
    // A bundled cocktail is already in every guest's library, so "Add to My
    // Library" would only create a duplicate copy.
    libraryAction: SEED_RECIPE_IDS.has(recipe.id) ? 'open' : 'add',
    onOpenInLibrary: () => { window.location.hash = `#${recipe.id}`; },
    onBack: () => {
      // Real history "back" when we got here from the menu, so the guest's
      // scroll position in the grid is restored; a fresh deep link to a drink
      // has nothing to go back to, so fall back to navigating.
      if (window.history.length > 1) window.history.back();
      else window.location.hash = menuHash(menuId);
    },
  });
  container.scrollIntoView?.({ block: 'start' });
  softEnter(container, { quiet });
  if (!quiet) runAfterDrinkRender();
}

/**
 * Render the guest menu (or one of its drinks) for the current
 * state.pendingGuestMenu route into #guest-menu-view-container.
 */
export async function renderGuestMenuView({ quiet = false } = {}) {
  const container = getContainer();
  if (!container) return;

  const { menuId, drinkId, quiz: quizRoute } = state.pendingGuestMenu || {};
  if (!menuId) {
    renderUnavailable(container, 'This link is missing a menu');
    return;
  }

  const haveCopy = cached && cached.menuId === menuId;
  if (!haveCopy) {
    // Nothing to show yet: this is the one case that has to wait on the network.
    renderMessage(container, 'Loading the menu…');
    try {
      const { menu, offline } = await loadMenu(menuId);
      // An offline copy is never "fresh", so the next navigation tries again.
      cached = { menuId, menu, fetchedAt: offline ? 0 : Date.now(), offline };
    } catch (err) {
      if (err.status === 404) renderUnavailable(container);
      else renderUnreachable(container);
      return;
    }
  } else if (Date.now() - cached.fetchedAt >= STALE_AFTER_MS) {
    // Show what we have right now and refresh behind it. Waiting on the network
    // before responding to a tap would leave the old page sitting there, and
    // there'd be nothing for a page transition to animate to.
    refreshIfChanged();
  }

  // The route may have changed (or the guest navigated away) while fetching.
  const current = state.pendingGuestMenu;
  if (state.viewMode !== 'guest-menu' || !current || current.menuId !== menuId || current.drinkId !== drinkId || Boolean(current.quiz) !== Boolean(quizRoute)) return;

  if (quizRoute) renderQuiz(container, menuId, cached.menu, { quiet });
  else if (drinkId) renderDrink(container, menuId, cached.menu, drinkId, { quiet });
  else renderMenu(container, menuId, cached.menu, { quiet });
}

// There's no push channel: while a guest has the menu open and visible, check
// for host changes ("out" toggles, edited drinks) every few seconds. At the
// party sizes this is built for (a handful of phones) that's negligible load.
const POLL_INTERVAL_MS = 8 * 1000;

async function refreshIfChanged() {
  if (document.hidden || state.viewMode !== 'guest-menu' || !cached) return;
  const { menuId } = state.pendingGuestMenu || {};
  if (menuId !== cached.menuId) return;
  try {
    const { menu, offline } = await loadMenu(menuId);
    // Reconnecting after being offline is a change worth redrawing for, even
    // if the menu itself is identical: it clears the "saved copy" notice.
    const changed = offline !== Boolean(cached.offline) || JSON.stringify(menu) !== JSON.stringify(cached.menu);
    cached = { menuId, menu, fetchedAt: offline ? 0 : Date.now(), offline };
    if (changed) renderGuestMenuView({ quiet: true });
  } catch (err) {
    // A 404 mid-session means the host really did take the menu down. Anything
    // else is transient: keep showing what we have.
    if (err.status === 404 && state.viewMode === 'guest-menu') {
      cached = null;
      renderUnavailable(getContainer());
    }
  }
}

if (typeof document !== 'undefined') {
  setInterval(refreshIfChanged, POLL_INTERVAL_MS);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) refreshIfChanged();
  });
}
