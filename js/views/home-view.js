/**
 * Speakeasy Home Screen View
 * Bar stats, curated shelves, recently viewed carousel, and pinned tag collections.
 */

import {
  state,
  elements,
  getCachedInventoryAnalysis,
  HOME_DEFAULT_COLLECTIONS,
} from '../state.js';

import {
  getBarName,
  getRecentlyViewed,
  getAllUniqueTags,
  savePinnedTags,
  normalizeTagName,
} from '../modules/storage.js';

import { renderGlassSvg } from '../modules/glass-view.js';
import { setupTagAutocomplete } from './recipe-list-view.js';
import { escapeHtml, showToast } from '../components/toast.js';
import { formatIngredientName } from '../modules/parser.js';
import { getDrinkHistory, HISTORY_UPDATED_EVENT } from '../modules/history.js';

let _selectRecipeFn = null;
let _showDrinksListMobileFn = null;
let _openBackbarModalFn = null;
let _openMenuBuilderModalFn = null;

export function setHomeViewCallbacks({ selectRecipe, showDrinksListMobile, openBackbarModal, openMenuBuilderModal }) {
  if (selectRecipe) _selectRecipeFn = selectRecipe;
  if (showDrinksListMobile) _showDrinksListMobileFn = showDrinksListMobile;
  if (openBackbarModal) _openBackbarModalFn = openBackbarModal;
  if (openMenuBuilderModal) _openMenuBuilderModalFn = openMenuBuilderModal;
}

export function formatTagTitle(tag) {
  return tag.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

export function formatRelativeTime(dateInput) {
  if (!dateInput) return '';
  const timestamp = typeof dateInput === 'number' ? dateInput : new Date(dateInput).getTime();
  if (isNaN(timestamp)) return '';
  const elapsedSec = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));

  if (elapsedSec < 60) return 'Just now';
  const minutes = Math.floor(elapsedSec / 60);
  if (minutes < 60) return `Made ${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Made ${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// Populated by renderHomeView() and read by the IntersectionObserver in
// setupHomeViewEvents() to lazily fill in each shelf's cards.
let homeCollectionsCache = [];

// Cap how many cards a shelf hydrates up front. Home is a landing page, not a
// full library browse — anything beyond this defers to "See all" so we're not
// paying render/DOM cost (or presenting a wall of cards) for shelves that can
// match dozens of recipes.
const HOME_SHELF_CARD_LIMIT = 12;

/**
 * Render the Home landing page: bar stats + horizontally-scrolling collection shelves.
 * Shelf cards (which each render a full inline SVG glass) are lazy-hydrated on scroll
 * rather than all at once, so the initial paint stays fast regardless of library size.
 */
export function renderHomeView() {
  const container = elements.homeViewContainer;
  if (!container) return;

  const barName = getBarName();
  const ingredientCount = state.inventory.size;
  const cocktailCount = state.recipes.length;

  const recentlyViewedIds = getRecentlyViewed();
  const recentlyViewedRecipes = recentlyViewedIds
    .map(id => state.recipes.find(r => r.id === id))
    .filter(Boolean);
  const recentlyViewedCollection = recentlyViewedRecipes.length > 0 ? [{
    key: '__recently-viewed__',
    title: 'Recently Viewed',
    pinned: false,
    recipes: recentlyViewedRecipes,
  }] : [];

  const historyEntries = getDrinkHistory(50);
  const seenRecipeIds = new Set();
  const recentlyMadeRecipes = [];
  for (const entry of historyEntries) {
    if (seenRecipeIds.has(entry.recipeId)) continue;
    const recipe = state.recipes.find(r => r.id === entry.recipeId);
    if (recipe) {
      seenRecipeIds.add(entry.recipeId);
      recentlyMadeRecipes.push({ ...recipe, madeAt: entry.madeAt });
    }
  }

  const recentlyMadeCollection = recentlyMadeRecipes.length > 0 ? [{
    key: '__recently-made__',
    title: 'Recently Made',
    pinned: false,
    recipes: recentlyMadeRecipes,
  }] : [];

  const pinnedCollections = state.pinnedTags
    .map(tag => ({
      key: tag,
      title: formatTagTitle(tag),
      pinned: true,
      recipes: state.recipes.filter(r => Array.isArray(r.tags) && r.tags.includes(tag)),
    }))
    .filter(c => c.recipes.length > 0);

  const defaultCollections = HOME_DEFAULT_COLLECTIONS
    .map(c => ({
      ...c,
      pinned: false,
      recipes: state.recipes.filter(r => Array.isArray(r.tags) && r.tags.includes(c.key)),
    }))
    .filter(c => c.recipes.length > 0);

  const allCollections = [
    ...recentlyViewedCollection,
    ...recentlyMadeCollection,
    ...pinnedCollections,
    ...defaultCollections,
  ];
  homeCollectionsCache = allCollections;
  const pinnableTags = getAllUniqueTags(state.recipes).filter(t => !state.pinnedTags.includes(t));

  // The pin prompt is anchored to a landmark row, not a raw index, so it
  // doesn't jump around whenever Recently Viewed/Made appear or disappear:
  // right after the last pinned row once the user has any pins, otherwise
  // right after the first default collection (Classic Cocktails).
  const topRowCount = recentlyViewedCollection.length + recentlyMadeCollection.length + pinnedCollections.length;
  const pinPromptIndex = pinnedCollections.length > 0
    ? topRowCount
    : topRowCount + (defaultCollections.length > 0 ? 1 : 0);

  // "Almost Ready" is a compact banner, not a shelf — a full row of cards here
  // would reintroduce the home-screen bulk this whole page was just decluttered
  // of. Uses the same isBottleNext filter as the sidebar's "Ready" toggle.
  const almostReadyCount = state.recipes.filter(r => getCachedInventoryAnalysis(r).isBottleNext).length;

  container.innerHTML =  /*html*/`
    <div class="home-stats-card">
      <div class="home-stats-name">${escapeHtml(barName)}</div>
      <div class="home-stats-row">
        <div class="home-stat">
          <strong>${cocktailCount}</strong>
          <span>${cocktailCount === 1 ? 'Cocktail' : 'Cocktails'}</span>
        </div>
        <div class="home-stat-divider" aria-hidden="true"></div>
        <div class="home-stat">
          <strong>${ingredientCount}</strong>
          <span>${ingredientCount === 1 ? 'Ingredient' : 'Ingredients'} in Bar</span>
        </div>
        <button type="button" class="btn btn-secondary btn-sm home-menu-builder-btn" data-action="open-menu-builder">
          <span aria-hidden="true">🍸</span> Build a Menu
        </button>
      </div>
      <div class="home-browse-actions">
        <button type="button" id="btn-home-browse-all" class="btn btn-primary btn-sm home-browse-all-btn">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <line x1="8" y1="6" x2="21" y2="6"></line>
            <line x1="8" y1="12" x2="21" y2="12"></line>
            <line x1="8" y1="18" x2="21" y2="18"></line>
            <line x1="3" y1="6" x2="3.01" y2="6"></line>
            <line x1="3" y1="12" x2="3.01" y2="12"></line>
            <line x1="3" y1="18" x2="3.01" y2="18"></line>
          </svg>
          Browse Cocktails
        </button>
        <button type="button" id="btn-home-search" class="btn btn-secondary btn-sm home-search-btn">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          Search Cocktails
        </button>
      </div>
    </div>

    ${almostReadyCount > 0 ? /*html*/`
      <button type="button" class="home-almost-ready-banner" data-action="open-shopping">
        <span class="home-almost-ready-count">${almostReadyCount}</span>
        <span class="home-almost-ready-text">cocktail${almostReadyCount === 1 ? ' is' : 's are'} one bottle away — Shop the list</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"></polyline></svg>
      </button>
    ` : ''}

    ${renderHomeCollectionsWithPinPrompt(allCollections, pinPromptIndex)}
  `;

  setupHomeViewEvents(pinnableTags);
}

function renderHomePinPromptRow() {
  return  /*html*/`
    <div class="home-pin-row">
      <span class="counter-card-title">Pin a tag as a collection</span>
      <div class="tag-input-inline-wrapper home-pin-input-wrapper">
        <input type="text" id="home-pin-tag-input" class="tag-input-inline home-pin-input"
          placeholder="+ Pin tag..." aria-label="Pin a tag as a Home collection" autocomplete="off">
        <ul class="tag-suggest-list" id="home-pin-suggest-list" role="listbox" hidden></ul>
      </div>
    </div>
  `;
}

// Interleaves the "pin a tag" prompt into the shelf list at `pinPromptIndex`
// (see renderHomeView for how that index is chosen) instead of it being a
// fixed banner above every row. Shelf `idx` values stay aligned with
// homeCollectionsCache since the prompt doesn't consume a collection slot.
function renderHomeCollectionsWithPinPrompt(allCollections, pinPromptIndex) {
  if (allCollections.length === 0) {
    return /*html*/`
      <div class="home-empty-state">
        <p>No collections yet — tag a few drinks and they'll show up here as browsable rows.</p>
      </div>
    ` + renderHomePinPromptRow();
  }

  const rows = [];
  allCollections.forEach((col, idx) => {
    if (idx === pinPromptIndex) rows.push(renderHomePinPromptRow());
    rows.push(renderHomeShelf(col, idx));
  });
  if (pinPromptIndex >= allCollections.length) rows.push(renderHomePinPromptRow());
  return rows.join('');
}

export function renderHomeShelf(col, idx) {
  const isNonTaggable = col.key === '__recently-viewed__' || col.key === '__recently-made__';
  return  /*html*/`
    <div class="similar-cocktails-shelf home-shelf">
      <div class="counter-card-header shelf-header">
        <div class="shelf-header-left">
          ${!isNonTaggable ? `
            <button type="button" class="counter-card-title shelf-title-link" data-action="filter-shelf" data-tag="${escapeHtml(col.key)}" title="Search #${escapeHtml(col.key)}">${escapeHtml(col.title)}</button>
          ` : `
            <span class="counter-card-title">${escapeHtml(col.title)}</span>
          `}
          ${col.pinned ? `
            <button type="button" class="home-unpin-btn" data-action="unpin-tag" data-tag="${escapeHtml(col.key)}"
              title="Remove this collection from Home" aria-label="Remove ${escapeHtml(col.title)} collection">×</button>
          ` : ''}
        </div>
        <div class="shelf-scroll-controls">
          <button type="button" class="shelf-nav-btn shelf-nav-prev" aria-label="Scroll ${escapeHtml(col.title)} left" title="Scroll left">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6"></polyline></svg>
          </button>
          <button type="button" class="shelf-nav-btn shelf-nav-next" aria-label="Scroll ${escapeHtml(col.title)} right" title="Scroll right">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"></polyline></svg>
          </button>
        </div>
      </div>
      <!-- Cards are hydrated lazily by an IntersectionObserver in setupHomeViewEvents() -->
      <div class="similar-cocktails-track home-track" data-shelf-idx="${idx}"></div>
    </div>
  `;
}

export function renderHomeSeeAllCard(col) {
  return  /*html*/`
    <button type="button" class="similar-cocktail-card home-see-all-card" data-action="see-all" data-tag="${escapeHtml(col.key)}">
      <span class="home-see-all-count">+${col.recipes.length - HOME_SHELF_CARD_LIMIT}</span>
      <span class="home-see-all-label">See all<br>${escapeHtml(col.title)}</span>
    </button>
  `;
}

export function renderHomeCard(recipe, collectionKey, idx) {
  const invAnalysis = getCachedInventoryAnalysis(recipe);
  const specNames = (recipe.specs || []).map(s => formatIngredientName(s.name)).filter(Boolean);
  const isRecentlyMade = collectionKey === '__recently-made__' && recipe.madeAt;
  const relativeBadgeText = isRecentlyMade ? formatRelativeTime(recipe.madeAt) : '';

  return  /*html*/`
    <div class="similar-cocktail-card" data-recipe-id="${escapeHtml(recipe.id)}" role="button" tabindex="0">
      <div class="similar-card-glass">
        ${renderGlassSvg(recipe, `home-glass-${collectionKey}-${recipe.id}-${idx}`)}
      </div>
      <div class="similar-card-body">
        ${isRecentlyMade ? `
          <span class="similar-relation-badge badge-made">${escapeHtml(relativeBadgeText)}</span>
        ` : `
          <span class="similar-relation-badge badge-ready${invAnalysis.canMake ? '' : ' badge-hidden'}">Ready</span>
        `}
        <h4 class="similar-card-name" title="${escapeHtml(recipe.name)}">${escapeHtml(recipe.name)}</h4>
        <div class="similar-card-meta">
          <span>${escapeHtml(recipe.glassware || 'Glass')}</span>
          <span class="meta-dot">•</span>
          <span>${escapeHtml(recipe.method || 'Build')}</span>
        </div>
        <div class="similar-card-specs" title="${escapeHtml(specNames.join(', '))}">
          ${escapeHtml(specNames.slice(0, 3).join(', '))}
        </div>
      </div>
    </div>
  `;
}

/**
 * Wire up Home page interactions: shelf scroll/nav, card selection, and the
 * "pin a tag" autocomplete used to add/remove user-curated collections
 */
export function setupHomeViewEvents(pinnableTags) {
  const container = elements.homeViewContainer;
  if (!container) return;

  document.getElementById('btn-home-browse-all')?.addEventListener('click', () => {
    if (_showDrinksListMobileFn) _showDrinksListMobileFn();
  });

  document.getElementById('btn-home-search')?.addEventListener('click', () => {
    if (_showDrinksListMobileFn) _showDrinksListMobileFn({ focusSearch: true });
  });

  container.querySelector('[data-action="open-shopping"]')?.addEventListener('click', () => {
    state.backbarTab = 'shopping';
    if (_openBackbarModalFn) _openBackbarModalFn();
  });

  container.querySelector('[data-action="open-menu-builder"]')?.addEventListener('click', () => {
    if (_openMenuBuilderModalFn) _openMenuBuilderModalFn();
  });

  container.querySelectorAll('.home-shelf').forEach(shelf => {
    const track = shelf.querySelector('.home-track');
    shelf.querySelector('.shelf-nav-prev')?.addEventListener('click', () => {
      track?.scrollBy({ left: -600, behavior: 'smooth' });
    });
    shelf.querySelector('.shelf-nav-next')?.addEventListener('click', () => {
      track?.scrollBy({ left: 600, behavior: 'smooth' });
    });
  });

  // Shelf title -> same tag filter the "See all" tile and sidebar tag chips
  // already use (Recently Viewed has no tag behind it, so it never gets the
  // clickable treatment — see the template in renderHomeShelf).
  container.querySelectorAll('[data-action="filter-shelf"]').forEach(titleBtn => {
    titleBtn.addEventListener('click', () => {
      const tag = titleBtn.getAttribute('data-tag');
      if (tag && _showDrinksListMobileFn) _showDrinksListMobileFn({ query: `#${tag}` });
    });
  });

  // Lazily hydrate each shelf's cards only once it scrolls near viewport
  const hydrateShelf = (track) => {
    const idx = Number(track.dataset.shelfIdx);
    const col = homeCollectionsCache[idx];
    if (!col) return;

    // "Recently Viewed" and "Recently Made" are not real tags, so they have nowhere for a "See all" link
    // to go — they are already capped (storage limit or limit 10),
    // so render them in full. Tag-backed shelves (pinned + default collections)
    // can match dozens of recipes and get a hard cap plus a "See all" tile that
    // hands off to the same tag filter the sidebar's tag chips already use.
    const isTaggable = col.key !== '__recently-viewed__' && col.key !== '__recently-made__';
    const overflowing = isTaggable && col.recipes.length > HOME_SHELF_CARD_LIMIT;
    const visibleRecipes = overflowing ? col.recipes.slice(0, HOME_SHELF_CARD_LIMIT) : col.recipes;

    track.innerHTML =  /*html*/visibleRecipes.map((recipe, i) => renderHomeCard(recipe, col.key, i)).join('')
      + (overflowing ? renderHomeSeeAllCard(col) : '');

    track.querySelectorAll('.similar-cocktail-card[data-recipe-id]').forEach(el => {
      const targetId = el.getAttribute('data-recipe-id');
      el.addEventListener('click', () => {
        if (targetId && _selectRecipeFn) _selectRecipeFn(targetId);
      });
      el.addEventListener('keydown', (e) => {
        if ((e.key === 'Enter' || e.key === ' ') && targetId) {
          e.preventDefault();
          if (_selectRecipeFn) _selectRecipeFn(targetId);
        }
      });
    });

    track.querySelector('.home-see-all-card')?.addEventListener('click', (e) => {
      const tag = e.currentTarget.getAttribute('data-tag');
      if (tag && _showDrinksListMobileFn) _showDrinksListMobileFn({ query: `#${tag}` });
    });
  };

  const shelfObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      hydrateShelf(entry.target);
      observer.unobserve(entry.target);
    });
  }, { root: null, rootMargin: '600px 0px', threshold: 0 });

  container.querySelectorAll('.home-track').forEach(track => shelfObserver.observe(track));

  container.querySelectorAll('[data-action="unpin-tag"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const tag = btn.getAttribute('data-tag');
      if (!tag) return;
      state.pinnedTags = state.pinnedTags.filter(t => t !== tag);
      savePinnedTags(state.pinnedTags);
      renderHomeView();
    });
  });

  const pinInput = document.getElementById('home-pin-tag-input');
  const pinTag = (rawTag) => {
    const clean = normalizeTagName(rawTag);
    if (!clean || state.pinnedTags.includes(clean)) return;
    state.pinnedTags = [...state.pinnedTags, clean];
    savePinnedTags(state.pinnedTags);
    renderHomeView();
    showToast(`Pinned #${clean} to Home`);
  };

  setupTagAutocomplete(
    pinInput,
    document.getElementById('home-pin-suggest-list'),
    () => pinnableTags,
    pinTag
  );
}

// Reactively refresh Home view whenever drink history is logged or synced from the cloud
if (typeof window !== 'undefined') {
  window.addEventListener(HISTORY_UPDATED_EVENT, () => {
    if (state.viewMode === 'home') {
      renderHomeView();
    }
  });
}
