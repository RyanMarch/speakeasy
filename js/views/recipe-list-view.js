/**
 * Speakeasy Recipe List & Sidebar View
 */

import { state, elements, getCachedInventoryAnalysis, SEED_RECIPE_IDS } from '../state.js';
import { isAuthenticated } from '../modules/auth.js';
import { recipeMatchesQuery } from '../modules/taxonomy.js';
import { escapeHtml, showToast } from '../components/toast.js';
import { formatIngredientName } from '../modules/parser.js';

let _openEditorFn = null;
let _updateVaultStatsFn = null;
let _showDrinksListMobileFn = null;

export function setRecipeListCallbacks({ openEditor, updateVaultStats, showDrinksListMobile }) {
  if (openEditor) _openEditorFn = openEditor;
  if (updateVaultStats) _updateVaultStatsFn = updateVaultStats;
  if (showDrinksListMobile) _showDrinksListMobileFn = showDrinksListMobile;
}

/**
 * Updates visibility of the Custom pack filter button based on authentication
 * and whether the user has custom cocktails.
 */
export function updateCustomFilterVisibility() {
  const btn = elements.packPillCustom || (typeof document !== 'undefined' ? document.getElementById('pack-pill-custom') : null);
  if (!btn) return;

  const loggedIn = isAuthenticated();
  const customCount = Array.isArray(state.recipes)
    ? state.recipes.filter(r => !SEED_RECIPE_IDS.has(r.id)).length
    : 0;
  const shouldShow = loggedIn && customCount > 0;

  btn.style.display = shouldShow ? 'inline-flex' : 'none';

  if (!shouldShow && state.packFilter === 'custom') {
    state.packFilter = 'all';
    const container = elements.sidebarPackFilter || (typeof document !== 'undefined' ? document.getElementById('sidebar-pack-filter') : null);
    container?.querySelectorAll('.pack-pill').forEach(b => {
      const isAll = b.getAttribute('data-pack') === 'all';
      b.classList.toggle('active', isAll);
      b.setAttribute('aria-selected', isAll ? 'true' : 'false');
    });
  }
}

/**
 * Filter and render recipe list in sidebar with inventory counts and status badges
 */
export function renderRecipeList() {
  updateCustomFilterVisibility();

  const queryMatched = state.recipes.map(recipe => {
    const matchesSearch = !state.searchQuery || recipeMatchesQuery(recipe, state.searchQuery);
    const matchesPack = state.packFilter === 'all'
      || (state.packFilter === 'custom'
        ? !SEED_RECIPE_IDS.has(recipe.id)
        : (Array.isArray(recipe.tags) && recipe.tags.includes(state.packFilter)));
    const invAnalysis = getCachedInventoryAnalysis(recipe);
    return { recipe, matchesSearch, matchesPack, invAnalysis };
  });

  let allCount = 0;
  let canMakeCount = 0;
  let oneMissingCount = 0;

  for (const item of queryMatched) {
    if (!item.matchesSearch || !item.matchesPack) continue;
    allCount++;
    if (item.invAnalysis.canMake) canMakeCount++;
    if (item.invAnalysis.isBottleNext) oneMissingCount++;
  }

  if (elements.countAll) elements.countAll.textContent = allCount;
  if (elements.countCanMake) elements.countCanMake.textContent = canMakeCount;
  if (elements.countOneMissing) elements.countOneMissing.textContent = oneMissingCount;
  if (_updateVaultStatsFn) _updateVaultStatsFn();

  const filtered = queryMatched.filter(item => {
    if (!item.matchesSearch || !item.matchesPack) return false;
    if (state.inventoryFilter === 'can_make') return item.invAnalysis.canMake;
    if (state.inventoryFilter === 'one_missing') return item.invAnalysis.isBottleNext;
    return true;
  });

  // Apply library list sort
  const sortMode = state.sortPreference || 'curated';
  if (sortMode === 'name-asc') {
    filtered.sort((a, b) => a.recipe.name.localeCompare(b.recipe.name, undefined, { sensitivity: 'base' }));
  } else if (sortMode === 'name-desc') {
    filtered.sort((a, b) => b.recipe.name.localeCompare(a.recipe.name, undefined, { sensitivity: 'base' }));
  } else if (sortMode === 'ready') {
    filtered.sort((a, b) => {
      // 1. Ready to make first
      if (a.invAnalysis.canMake !== b.invAnalysis.canMake) {
        return a.invAnalysis.canMake ? -1 : 1;
      }
      // 2. 1 bottle missing next
      if (a.invAnalysis.isBottleNext !== b.invAnalysis.isBottleNext) {
        return a.invAnalysis.isBottleNext ? -1 : 1;
      }
      // 3. Keep original curated order
      return 0;
    });
  } else if (sortMode === 'specs-asc') {
    filtered.sort((a, b) => {
      const lenA = (a.recipe.specs || []).length;
      const lenB = (b.recipe.specs || []).length;
      if (lenA !== lenB) return lenA - lenB;
      return a.recipe.name.localeCompare(b.recipe.name, undefined, { sensitivity: 'base' });
    });
  }

  if (elements.recipeCountBadge) {
    elements.recipeCountBadge.textContent = `${filtered.length} ${filtered.length === 1 ? 'Cocktail' : 'Cocktails'}`;
  }

  if (filtered.length === 0) {
    const rawSearch = (state.searchQuery || '').trim();
    const canCreateFromSearch = rawSearch.length > 0 && !rawSearch.startsWith('#');
    const formattedName = canCreateFromSearch
      ? rawSearch
        .split(/\s+/)
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ')
      : '';

    elements.recipeList.innerHTML =  /*html*/`
      <li class="empty-state">
        <p class="empty-state-title">No matching drinks</p>
        <p class="card-content-text" style="font-size: 0.8rem;">Try adjusting your search or filters</p>
        ${canCreateFromSearch ? /*html*/`
          <div class="empty-state-actions">
            <button type="button" id="btn-create-searched-cocktail" class="btn btn-primary empty-state-create-btn">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              <span>Create This Cocktail</span>
            </button>
          </div>
        ` : ''}
      </li>
    `;

    if (canCreateFromSearch) {
      const btnCreateSearched = document.getElementById('btn-create-searched-cocktail');
      btnCreateSearched?.addEventListener('click', () => {
        if (_openEditorFn) {
          _openEditorFn({ name: formattedName });
        }
      });
    }
    return;
  }

  if (elements.recipeList) {
    elements.recipeList.innerHTML = /*html*/filtered.map(({ recipe, invAnalysis }) => {
      const isActive = state.viewMode === 'counter' && recipe.id === state.activeRecipeId;
      const specsPreview = (recipe.specs || []).map(s => formatIngredientName(s.name)).slice(0, 3).join(', ');

      let inventoryStatusHtml = '';
      if (invAnalysis.canMake) {
        inventoryStatusHtml = `
          <div class="recipe-item-status status-ready" title="All ingredients in your backbar">
            <span class="status-dot"></span>
            <span>Ready to make</span>
          </div>`;
      } else if (invAnalysis.isBottleNext && invAnalysis.missingItems.length > 0) {
        inventoryStatusHtml = `
          <div class="recipe-item-status status-next" title="Missing: ${escapeHtml(invAnalysis.missingItems[0].name)}">
            <span class="status-dot"></span>
            <span>Needs ${escapeHtml(invAnalysis.missingItems[0].name)}</span>
          </div>`;
      }

      return `
        <li class="recipe-list-item ${isActive ? 'active' : ''}" data-id="${recipe.id}">
          <button type="button" class="recipe-card-btn" data-action="select" data-id="${recipe.id}">
            <div class="recipe-item-header">
              <span class="recipe-item-name">${escapeHtml(recipe.name)}</span>
              ${recipe.glassware ? `<span class="recipe-item-glass">${escapeHtml(recipe.glassware)}</span>` : ''}
            </div>
            ${specsPreview ? `<div class="recipe-item-ingredients">${escapeHtml(specsPreview)}</div>` : ''}
            ${inventoryStatusHtml}
          </button>
        </li>
      `;
    }).join('');
  }
}

/**
 * Filter library by tag
 */
export function filterByTag(tag) {
  state.searchQuery = `#${tag}`;
  if (elements.searchInput) {
    elements.searchInput.value = `#${tag}`;
  }
  elements.searchClearBtn?.classList.add('visible');
  renderRecipeList();
  showToast(`Filtered by #${tag}`);
  // On mobile the sidebar/list is hidden while viewing a recipe — a tag tapped
  // from there needs to actually bring the filtered list into view, not just
  // filter it invisibly in the background. No-op on desktop, where the sidebar
  // is already visible (toggling its mobile-only "hidden" classes there does
  // nothing, since responsive.css only acts on them under the mobile breakpoint).
  _showDrinksListMobileFn?.();
}

/**
 * Wire a text input to a small, app-styled autocomplete dropdown of tag suggestions.
 * Replaces native <input list> + <datalist>, which on mobile browsers renders as an
 * unstyled dropdown showing the *entire* unfiltered tag list rather than filtering as you type.
 *
 * @param {HTMLInputElement} inputEl - the text input
 * @param {HTMLElement} listEl - an empty <ul> positioned to appear below the input
 * @param {() => string[]} getSuggestions - returns the current pool of candidate tags
 * @param {(tag: string) => void} onPick - called with the chosen/typed tag; input is cleared after
 */
export function setupTagAutocomplete(inputEl, listEl, getSuggestions, onPick) {
  if (!inputEl || !listEl) return;

  let matches = [];
  let activeIndex = -1;

  const close = () => {
    listEl.hidden = true;
    listEl.innerHTML =  /*html*/'';
    matches = [];
    activeIndex = -1;
  };

  const renderList = () => {
    const query = inputEl.value.trim().toLowerCase().replace(/^#+/, '');
    const pool = getSuggestions();
    // No result cap: the list scrolls, so truncating here would silently hide entries below the fold
    matches = query ? pool.filter(t => t.includes(query)) : pool;

    if (!matches.length) {
      if (query) {
        listEl.hidden = false;
        listEl.innerHTML =  /*html*/`<li class="tag-suggest-item-empty">Press Enter to create "#${escapeHtml(query)}"</li>`;
      } else {
        close();
      }
      return;
    }

    listEl.innerHTML =  /*html*/matches.map((tag, i) => `
      <li class="tag-suggest-item${i === activeIndex ? ' active' : ''}" role="option" data-index="${i}">#${escapeHtml(tag)}</li>
    `).join('');
    listEl.hidden = false;

    if (activeIndex >= 0) {
      listEl.querySelector('.tag-suggest-item.active')?.scrollIntoView({ block: 'nearest' });
    }
  };

  const pick = (tag) => {
    onPick(tag);
    inputEl.value = '';
    close();
  };

  inputEl.addEventListener('input', () => {
    activeIndex = -1;
    renderList();
  });

  inputEl.addEventListener('focus', renderList);

  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' && !listEl.hidden && matches.length) {
      e.preventDefault();
      activeIndex = Math.min(activeIndex + 1, matches.length - 1);
      renderList();
    } else if (e.key === 'ArrowUp' && !listEl.hidden && matches.length) {
      e.preventDefault();
      activeIndex = Math.max(activeIndex - 1, 0);
      renderList();
    } else if (e.key === 'Escape') {
      close();
    } else if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      if (activeIndex >= 0 && matches[activeIndex]) {
        pick(matches[activeIndex]);
      } else if (inputEl.value.trim()) {
        pick(inputEl.value);
      }
    }
  });

  // mousedown (not click) fires before the input's blur handler, so the tap registers
  // before the dropdown gets torn down
  listEl.addEventListener('mousedown', (e) => {
    const item = e.target.closest('.tag-suggest-item');
    if (!item) return;
    e.preventDefault();
    const idx = Number(item.dataset.index);
    if (matches[idx]) pick(matches[idx]);
  });

  inputEl.addEventListener('blur', () => {
    setTimeout(close, 120);
  });
}
