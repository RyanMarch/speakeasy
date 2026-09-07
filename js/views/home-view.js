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

let _selectRecipeFn = null;
let _showDrinksListMobileFn = null;

export function setHomeViewCallbacks({ selectRecipe, showDrinksListMobile }) {
  if (selectRecipe) _selectRecipeFn = selectRecipe;
  if (showDrinksListMobile) _showDrinksListMobileFn = showDrinksListMobile;
}

export function formatTagTitle(tag) {
  return tag.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

// Populated by renderHomeView() and read by the IntersectionObserver in
// setupHomeViewEvents() to lazily fill in each shelf's cards.
let homeCollectionsCache = [];

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

  const allCollections = [...recentlyViewedCollection, ...pinnedCollections, ...defaultCollections];
  homeCollectionsCache = allCollections;
  const pinnableTags = getAllUniqueTags(state.recipes).filter(t => !state.pinnedTags.includes(t));

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
      </div>
      <div class="home-browse-actions">
        <button type="button" id="btn-home-browse-all" class="btn btn-secondary btn-sm home-browse-all-btn">
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

    <div class="home-pin-row">
      <span class="home-pin-label">Pin a tag as a collection</span>
      <div class="tag-input-inline-wrapper home-pin-input-wrapper">
        <input type="text" id="home-pin-tag-input" class="tag-input-inline home-pin-input"
          placeholder="+ Pin tag..." aria-label="Pin a tag as a Home collection" autocomplete="off">
        <ul class="tag-suggest-list" id="home-pin-suggest-list" role="listbox" hidden></ul>
      </div>
    </div>

    ${allCollections.length > 0 ? allCollections.map(renderHomeShelf).join('') : /*html*/`
      <div class="home-empty-state">
        <p>No collections yet — tag a few drinks and they'll show up here as browsable rows.</p>
      </div>
    `}
  `;

  setupHomeViewEvents(pinnableTags);
}

export function renderHomeShelf(col, idx) {
  return  /*html*/`
    <div class="similar-cocktails-shelf home-shelf">
      <div class="counter-card-header shelf-header">
        <div class="shelf-header-left">
          <span class="counter-card-title">${escapeHtml(col.title)}</span>
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

export function renderHomeCard(recipe, collectionKey, idx) {
  const invAnalysis = getCachedInventoryAnalysis(recipe);
  const specNames = (recipe.specs || []).map(s => s.name).filter(Boolean);
  return  /*html*/`
    <div class="similar-cocktail-card" data-recipe-id="${escapeHtml(recipe.id)}" role="button" tabindex="0">
      <div class="similar-card-glass">
        ${renderGlassSvg(recipe, `home-glass-${collectionKey}-${recipe.id}-${idx}`)}
      </div>
      <div class="similar-card-body">
        <span class="similar-relation-badge badge-ready${invAnalysis.canMake ? '' : ' badge-hidden'}">Ready</span>
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

  container.querySelectorAll('.home-shelf').forEach(shelf => {
    const track = shelf.querySelector('.home-track');
    shelf.querySelector('.shelf-nav-prev')?.addEventListener('click', () => {
      track?.scrollBy({ left: -600, behavior: 'smooth' });
    });
    shelf.querySelector('.shelf-nav-next')?.addEventListener('click', () => {
      track?.scrollBy({ left: 600, behavior: 'smooth' });
    });
  });

  // Lazily hydrate each shelf's cards only once it scrolls near viewport
  const hydrateShelf = (track) => {
    const idx = Number(track.dataset.shelfIdx);
    const col = homeCollectionsCache[idx];
    if (!col) return;

    track.innerHTML =  /*html*/col.recipes.map((recipe, i) => renderHomeCard(recipe, col.key, i)).join('');

    track.querySelectorAll('.similar-cocktail-card').forEach(el => {
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
