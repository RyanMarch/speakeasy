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
import { escapeHtml } from '../components/toast.js';
import { renderGlassSvg } from '../modules/glass-view.js';
import { formatIngredientName } from '../modules/parser.js';
import { fetchGuestMenu, parseMenuCode } from '../modules/menu-publish.js';
import { renderRecipe } from './shared-recipe-view.js';

// A guest who leaves the tab open all evening should still see "out" changes
// the next time they look at it, without polling in the background.
const STALE_AFTER_MS = 15 * 1000;

const DESCRIPTION_PREVIEW_CHARS = 90;

let cached = null; // { menuId, menu, fetchedAt }

function getContainer() {
  return elements.guestMenuViewContainer;
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
  let decodedDrink = null;
  if (drinkId) {
    try {
      decodedDrink = decodeURIComponent(drinkId);
    } catch {
      decodedDrink = null;
    }
  }
  return { menuId, drinkId: decodedDrink };
}

function menuHash(menuId, drinkId) {
  return drinkId ? `#menu/${menuId}/${encodeURIComponent(drinkId)}` : `#menu/${menuId}`;
}

function renderMenu(container, menuId, menu) {
  // Available drinks first; "out" drinks stay visible (so a guest isn't
  // confused by a drink vanishing) but sink to the bottom, dimmed.
  const available = menu.recipes.filter(r => !isOut(menu, r.id));
  const out = menu.recipes.filter(r => isOut(menu, r.id));

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

  container.innerHTML = /*html*/`
    <div class="guest-menu-header">
      <div class="guest-menu-eyebrow"><span>Tonight’s menu</span></div>
      <h1 class="guest-menu-title">${escapeHtml(menu.name)}</h1>
      <p class="guest-menu-subtitle">${available.length} drink${available.length === 1 ? '' : 's'} pouring. Tap one to see what’s in it.</p>
      ${available.length > 1 ? /*html*/`
        <button type="button" class="btn btn-primary guest-menu-surprise" data-action="surprise">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3"></rect><circle cx="8.5" cy="8.5" r="1"></circle><circle cx="15.5" cy="15.5" r="1"></circle><circle cx="12" cy="12" r="1"></circle></svg>
          Surprise me
        </button>
      ` : ''}
    </div>
    <div class="guest-menu-grid">
      ${[...available, ...out].map((r, i) => cardHtml(r, i)).join('')}
    </div>
    <footer class="guest-menu-footer">
      Made with <a href="/" class="home-footer-link">Speakeasy</a>, the craft cocktail companion.
    </footer>
  `;

  container.querySelectorAll('.guest-menu-card:not(.is-out)').forEach(card => {
    card.addEventListener('click', () => {
      window.location.hash = menuHash(menuId, card.getAttribute('data-recipe-id'));
    });
  });

  container.querySelector('[data-action="surprise"]')?.addEventListener('click', () => {
    const pick = available[Math.floor(Math.random() * available.length)];
    if (pick) window.location.hash = menuHash(menuId, pick.id);
  });
}

function renderDrink(container, menuId, menu, drinkId) {
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
}

/**
 * Render the guest menu (or one of its drinks) for the current
 * state.pendingGuestMenu route into #guest-menu-view-container.
 */
export async function renderGuestMenuView() {
  const container = getContainer();
  if (!container) return;

  const { menuId, drinkId } = state.pendingGuestMenu || {};
  if (!menuId) {
    renderUnavailable(container, 'This link is missing a menu');
    return;
  }

  const fresh = cached && cached.menuId === menuId && Date.now() - cached.fetchedAt < STALE_AFTER_MS;
  if (!fresh) {
    if (!cached || cached.menuId !== menuId) renderMessage(container, 'Loading the menu…');
    try {
      const menu = await fetchGuestMenu(menuId);
      cached = { menuId, menu, fetchedAt: Date.now() };
    } catch (err) {
      // Keep showing a stale copy rather than an error if the network blips
      // mid-party; only a first load with nothing cached is a hard failure.
      if (!cached || cached.menuId !== menuId) {
        renderUnavailable(container);
        return;
      }
    }
  }

  // The route may have changed (or the guest navigated away) while fetching.
  const current = state.pendingGuestMenu;
  if (state.viewMode !== 'guest-menu' || !current || current.menuId !== menuId || current.drinkId !== drinkId) return;

  if (drinkId) renderDrink(container, menuId, cached.menu, drinkId);
  else renderMenu(container, menuId, cached.menu);
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
    const menu = await fetchGuestMenu(menuId);
    const changed = JSON.stringify(menu) !== JSON.stringify(cached.menu);
    cached = { menuId, menu, fetchedAt: Date.now() };
    if (changed) renderGuestMenuView();
  } catch {
    // Transient network trouble: keep showing what we have.
  }
}

if (typeof document !== 'undefined') {
  setInterval(refreshIfChanged, POLL_INTERVAL_MS);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) refreshIfChanged();
  });
}
