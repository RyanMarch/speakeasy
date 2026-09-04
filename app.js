/**
 * Speakeasy Application Coordinator
 * State management, counter view, live vector glass synchronization, and quick-paste recipe editor.
 */

import {
  getRecipes,
  saveRecipe,
  deleteRecipe,
  exportRecipesJSON,
  importRecipesJSON,
  resetToDefaults,
  getInventory,
  saveInventory,
  DEFAULT_STARTER_BAR,
} from './js/modules/storage.js';

import {
  parseSpecsBlock,
  formatFraction,
} from './js/modules/parser.js';

import {
  calculateFluidLayers,
  getIngredientColor,
} from './js/modules/colors.js';

import { GlassView, renderGlassSvg } from './js/modules/glass-view.js';
import { calculateCocktailAbv, estimateIngredientAbv } from './js/modules/abv.js';
import {
  recipeMatchesQuery,
  getIngredientSubstitutes,
  findSimilarCocktails,
  getRecipeRiffLineage,
  checkIngredientStock,
  analyzeRecipeInventory,
  TAXONOMY,
} from './js/modules/taxonomy.js';

// Application State
const state = {
  recipes: [],
  activeRecipeId: null,
  activeRiffs: {}, // { [specIndex]: substituteTaxonomyId }
  riffModeActive: false,
  searchQuery: '',
  viewMode: 'counter', // 'counter' | 'edit'
  unitSystem: 'oz', // 'oz' | 'ml'
  editorSpecs: [],
  glassViewMain: null,
  glassViewEditor: null,
  inventory: new Set(getInventory()),
  inventoryFilter: 'all', // 'all' | 'can_make' | 'one_missing'
  backbarSearchQuery: '',
};

// DOM References
const elements = {
  sidebar: document.getElementById('sidebar'),
  mainStage: document.getElementById('main-stage'),
  recipeList: document.getElementById('recipe-list'),
  recipeCountBadge: document.getElementById('recipe-count-badge'),
  searchInput: document.getElementById('search-input'),
  searchClearBtn: document.getElementById('search-clear-btn'),
  btnNewDrink: document.getElementById('btn-new-drink'),
  btnExportJson: document.getElementById('btn-export-json'),
  btnImportTrigger: document.getElementById('btn-import-trigger'),
  importFileInput: document.getElementById('import-file-input'),
  btnResetDefaults: document.getElementById('btn-reset-defaults'),
  counterViewContainer: document.getElementById('counter-view-container'),
  editorViewContainer: document.getElementById('editor-view-container'),
  toastContainer: document.getElementById('toast-container'),
  btnMyBar: document.getElementById('btn-my-bar'),
  myBarBadge: document.getElementById('my-bar-badge'),
  sidebarInventoryFilter: document.getElementById('sidebar-inventory-filter'),
  countAll: document.getElementById('count-all'),
  countCanMake: document.getElementById('count-can-make'),
  countOneMissing: document.getElementById('count-one-missing'),
  backbarModal: document.getElementById('backbar-modal'),
  backbarSearchInput: document.getElementById('backbar-search-input'),
  backbarCategoriesContainer: document.getElementById('backbar-categories-container'),
  backbarSummaryText: document.getElementById('backbar-summary-text'),
  btnStarterBar: document.getElementById('btn-starter-bar'),
  btnClearBar: document.getElementById('btn-clear-bar'),
  btnCloseBackbar: document.getElementById('btn-close-backbar'),
  btnDoneBackbar: document.getElementById('btn-done-backbar'),
};

/**
 * Initialize application
 */
function init() {
  state.recipes = getRecipes();
  if (state.recipes.length > 0) {
    state.activeRecipeId = state.recipes[0].id;
  }

  setupGlobalEventListeners();
  setupBackbarEventListeners();
  updateMyBarBadge();
  renderRecipeList();
  renderCurrentView();
}

/**
 * Global Event Listeners
 */
function setupGlobalEventListeners() {
  // Search
  elements.searchInput.addEventListener('input', (e) => {
    state.searchQuery = e.target.value.trim().toLowerCase();
    elements.searchClearBtn.classList.toggle('visible', state.searchQuery.length > 0);
    renderRecipeList();
  });

  elements.searchClearBtn.addEventListener('click', () => {
    elements.searchInput.value = '';
    state.searchQuery = '';
    elements.searchClearBtn.classList.remove('visible');
    renderRecipeList();
  });

  // Header Actions
  elements.btnNewDrink.addEventListener('click', () => {
    openEditor(null);
  });

  elements.btnExportJson.addEventListener('click', () => {
    exportRecipesJSON();
    showToast('Exported recipes to JSON');
  });

  elements.btnImportTrigger.addEventListener('click', () => {
    elements.importFileInput.click();
  });

  elements.importFileInput.addEventListener('change', handleFileImport);

  elements.btnResetDefaults.addEventListener('click', () => {
    if (confirm('Reset cocktail library to original curated classics? This will preserve defaults.')) {
      state.recipes = resetToDefaults();
      state.activeRecipeId = state.recipes[0]?.id || null;
      renderRecipeList();
      renderCurrentView();
      showToast('Library reset to classic cocktails');
    }
  });

  // Keyboard shortcut: Escape to cancel editor or clear search
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (state.viewMode === 'edit') {
        cancelEditor();
      } else if (state.searchQuery) {
        elements.searchInput.value = '';
        state.searchQuery = '';
        elements.searchClearBtn.classList.remove('visible');
        renderRecipeList();
      }
    }
  });
}

/**
 * Handle JSON file upload
 */
function handleFileImport(e) {
  const file = e.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const content = event.target.result;
      const updated = importRecipesJSON(content, 'merge');
      state.recipes = updated;
      if (!state.recipes.find(r => r.id === state.activeRecipeId)) {
        state.activeRecipeId = state.recipes[0]?.id || null;
      }
      renderRecipeList();
      renderCurrentView();
      showToast(`Successfully imported ${state.recipes.length} recipes`);
    } catch (err) {
      alert(`Import failed: ${err.message}`);
    } finally {
      elements.importFileInput.value = '';
    }
  };
  reader.readAsText(file);
}

// Backbar taxonomy display categories
const BACKBAR_CATEGORIES = [
  { key: 'spirits', title: 'Base Spirits' },
  { key: 'fortified_wine', title: 'Fortified Wines & Vermouths' },
  { key: 'liqueurs', title: 'Liqueurs & Amari' },
  { key: 'bitters', title: 'Bitters & Tinctures' },
  { key: 'sweeteners', title: 'Syrups & Sweeteners' },
  { key: 'produce', title: 'Fresh Produce & Juices' },
  { key: 'mixers', title: 'Mixers, Sodas & Wine' },
];

/**
 * Update header badge and modal inventory summary
 */
function updateMyBarBadge() {
  const count = state.inventory.size;
  if (elements.myBarBadge) {
    elements.myBarBadge.textContent = count;
  }
  if (elements.backbarSummaryText) {
    elements.backbarSummaryText.textContent = `${count} ${count === 1 ? 'bottle' : 'bottles'} in your backbar`;
  }
}

/**
 * Setup backbar modal and inventory filter listeners
 */
function setupBackbarEventListeners() {
  elements.btnMyBar?.addEventListener('click', openBackbarModal);
  elements.btnCloseBackbar?.addEventListener('click', closeBackbarModal);
  elements.btnDoneBackbar?.addEventListener('click', closeBackbarModal);

  elements.backbarSearchInput?.addEventListener('input', (e) => {
    state.backbarSearchQuery = e.target.value.trim().toLowerCase();
    renderBackbarModalContent();
  });

  elements.btnStarterBar?.addEventListener('click', () => {
    DEFAULT_STARTER_BAR.forEach(id => state.inventory.add(id));
    saveInventory(Array.from(state.inventory));
    updateMyBarBadge();
    renderRecipeList();
    if (state.viewMode === 'counter') {
      renderCounterView();
    }
    renderBackbarModalContent();
    showToast('Loaded Starter Bar essentials');
  });

  elements.btnClearBar?.addEventListener('click', () => {
    if (state.inventory.size === 0) return;
    if (confirm('Clear all bottles from your backbar?')) {
      state.inventory.clear();
      saveInventory([]);
      updateMyBarBadge();
      renderRecipeList();
      if (state.viewMode === 'counter') {
        renderCounterView();
      }
      renderBackbarModalContent();
      showToast('Cleared backbar inventory');
    }
  });

  // Light dismiss fallback for browsers without closedby="any"
  if (elements.backbarModal && !('closedBy' in HTMLDialogElement.prototype)) {
    elements.backbarModal.addEventListener('click', (event) => {
      if (event.target !== elements.backbarModal) return;
      const rect = elements.backbarModal.getBoundingClientRect();
      const isDialogContent = (
        rect.top <= event.clientY &&
        event.clientY <= rect.top + rect.height &&
        rect.left <= event.clientX &&
        event.clientX <= rect.left + rect.width
      );
      if (!isDialogContent) {
        closeBackbarModal();
      }
    });
  }

  // Sidebar inventory filter tabs
  elements.sidebarInventoryFilter?.querySelectorAll('.inventory-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const filter = btn.getAttribute('data-filter');
      state.inventoryFilter = filter;
      elements.sidebarInventoryFilter.querySelectorAll('.inventory-filter-btn').forEach(b => {
        const isActive = b.getAttribute('data-filter') === filter;
        b.classList.toggle('active', isActive);
        b.setAttribute('aria-selected', isActive ? 'true' : 'false');
      });
      renderRecipeList();
    });
  });
}

/**
 * Open personal backbar modal
 */
function openBackbarModal() {
  state.backbarSearchQuery = '';
  if (elements.backbarSearchInput) elements.backbarSearchInput.value = '';
  renderBackbarModalContent();
  if (typeof elements.backbarModal?.showModal === 'function') {
    elements.backbarModal.showModal();
  }
}

/**
 * Close personal backbar modal
 */
function closeBackbarModal() {
  if (typeof elements.backbarModal?.close === 'function') {
    elements.backbarModal.close();
  }
}

/**
 * Toggle an item in the user's inventory
 */
function toggleInventoryBottle(bottleId) {
  if (state.inventory.has(bottleId)) {
    state.inventory.delete(bottleId);
  } else {
    state.inventory.add(bottleId);
  }
  saveInventory(Array.from(state.inventory));
  updateMyBarBadge();
  renderRecipeList();
  if (state.viewMode === 'counter') {
    renderCounterView();
  }
  renderBackbarModalContent();
}

/**
 * Render categories and item pills inside backbar modal
 */
function renderBackbarModalContent() {
  if (!elements.backbarCategoriesContainer) return;

  const query = (state.backbarSearchQuery || '').toLowerCase();
  const allTaxonomyItems = Object.values(TAXONOMY);

  let totalVisibleBottles = 0;

  const sectionsHtml = BACKBAR_CATEGORIES.map(cat => {
    const items = allTaxonomyItems.filter(item => {
      if (item.parent !== cat.key) return false;
      if (!query) return true;
      if (item.name.toLowerCase().includes(query)) return true;
      if (item.id.toLowerCase().includes(query)) return true;
      if (item.family && item.family.toLowerCase().includes(query)) return true;
      return (item.aliases || []).some(a => a.toLowerCase().includes(query));
    });

    if (items.length === 0) return '';
    totalVisibleBottles += items.length;

    const ownedCount = items.filter(i => state.inventory.has(i.id)).length;

    const pillsHtml = items.map(item => {
      const isOwned = state.inventory.has(item.id);
      return `
        <button type="button" class="backbar-pill ${isOwned ? 'active' : ''}" data-bottle-id="${escapeHtml(item.id)}" aria-pressed="${isOwned}">
          <span class="backbar-pill-dot" style="background-color: ${item.color || '#c67828'};"></span>
          <span class="backbar-pill-name">${escapeHtml(item.name)}</span>
          ${isOwned ? '<span class="backbar-pill-check">✓</span>' : ''}
        </button>
      `;
    }).join('');

    return `
      <div class="backbar-category-section">
        <div class="backbar-category-header">
          <span class="backbar-category-title">${escapeHtml(cat.title)}</span>
          <span class="backbar-category-count">${ownedCount} / ${items.length}</span>
        </div>
        <div class="backbar-pills-grid">
          ${pillsHtml}
        </div>
      </div>
    `;
  }).filter(Boolean).join('');

  if (totalVisibleBottles === 0) {
    elements.backbarCategoriesContainer.innerHTML =  /*html*/`
      <div class="empty-state" style="padding: 2rem 1rem;">
        <p class="empty-state-title">No bottles found</p>
        <p class="card-content-text" style="font-size: 0.8rem;">Try searching for a different bottle or spirit name.</p>
      </div>
    `;
  } else {
    elements.backbarCategoriesContainer.innerHTML =  /*html*/sectionsHtml;
  }

  // Wire pill clicks
  elements.backbarCategoriesContainer.querySelectorAll('.backbar-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      const bottleId = pill.getAttribute('data-bottle-id');
      if (bottleId) {
        toggleInventoryBottle(bottleId);
      }
    });
  });
}

/**
 * Filter and render recipe list in sidebar with inventory counts and status badges
 */
function renderRecipeList() {
  const queryMatched = state.recipes.map(recipe => {
    const matchesSearch = !state.searchQuery || recipeMatchesQuery(recipe, state.searchQuery);
    const invAnalysis = analyzeRecipeInventory(recipe, state.inventory);
    return { recipe, matchesSearch, invAnalysis };
  });

  let allCount = 0;
  let canMakeCount = 0;
  let oneMissingCount = 0;

  for (const item of queryMatched) {
    if (!item.matchesSearch) continue;
    allCount++;
    if (item.invAnalysis.canMake) canMakeCount++;
    if (item.invAnalysis.isBottleNext) oneMissingCount++;
  }

  if (elements.countAll) elements.countAll.textContent = allCount;
  if (elements.countCanMake) elements.countCanMake.textContent = canMakeCount;
  if (elements.countOneMissing) elements.countOneMissing.textContent = oneMissingCount;

  const filtered = queryMatched.filter(item => {
    if (!item.matchesSearch) return false;
    if (state.inventoryFilter === 'can_make') return item.invAnalysis.canMake;
    if (state.inventoryFilter === 'one_missing') return item.invAnalysis.isBottleNext;
    return true;
  });

  elements.recipeCountBadge.textContent = `${filtered.length} ${filtered.length === 1 ? 'Cocktail' : 'Cocktails'}`;

  if (filtered.length === 0) {
    elements.recipeList.innerHTML =  /*html*/`
      <li class="empty-state">
        <p class="empty-state-title">No matching drinks</p>
        <p class="card-content-text" style="font-size: 0.8rem;">Try adjusting your search or backbar filter</p>
      </li>
    `;
    return;
  }

  elements.recipeList.innerHTML =  /*html*/filtered.map(({ recipe, invAnalysis }) => {
    const isActive = recipe.id === state.activeRecipeId;
    const specsPreview = (recipe.specs || []).map(s => s.name).slice(0, 3).join(', ');

    let inventoryBadgeHtml = '';
    if (invAnalysis.canMake) {
      inventoryBadgeHtml = `<span class="tag-badge tag-badge-ready" title="All ingredients in your backbar">Ready</span>`;
    } else if (invAnalysis.isBottleNext && invAnalysis.missingItems.length > 0) {
      inventoryBadgeHtml = `<span class="tag-badge tag-badge-next" title="Missing: ${escapeHtml(invAnalysis.missingItems[0].name)}">+1: ${escapeHtml(invAnalysis.missingItems[0].name)}</span>`;
    }

    return `
      <li class="recipe-list-item ${isActive ? 'active' : ''}" data-id="${recipe.id}">
        <button type="button" class="recipe-card-btn" data-action="select" data-id="${recipe.id}">
          <div class="recipe-item-header">
            <span class="recipe-item-name">${escapeHtml(recipe.name)}</span>
            <span class="tag-badge tag-badge-accent">${escapeHtml(recipe.glassware || 'Glass')}</span>
          </div>
          <div class="recipe-item-tags">
            ${recipe.method ? `<span class="tag-badge">${escapeHtml(recipe.method)}</span>` : ''}
            ${inventoryBadgeHtml}
          </div>
          ${specsPreview ? `<div class="recipe-item-ingredients">${escapeHtml(specsPreview)}</div>` : ''}
        </button>
      </li>
    `;
  }).join('');

  // Wire selection
  elements.recipeList.querySelectorAll('[data-action="select"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      selectRecipe(id);
    });
  });
}

/**
 * Select a recipe and display counter view
 */
function selectRecipe(id) {
  if (state.activeRecipeId !== id) {
    state.activeRiffs = {};
    state.riffModeActive = false;
  }
  state.activeRecipeId = id;
  state.viewMode = 'counter';
  renderRecipeList();
  renderCurrentView();

  // Mobile navigation adjustment
  elements.sidebar.classList.add('mobile-hidden');
  elements.mainStage.classList.remove('mobile-hidden');
}

/**
 * Render active view based on state.viewMode
 */
function renderCurrentView() {
  if (state.viewMode === 'edit') {
    elements.counterViewContainer.style.display = 'none';
    elements.editorViewContainer.style.display = 'block';
  } else {
    elements.editorViewContainer.style.display = 'none';
    elements.counterViewContainer.style.display = 'block';
    renderCounterView();
  }
}

/**
 * Render Counter View (optimized for high-contrast viewing on bar counter)
 */
function renderCounterView() {
  const recipe = state.recipes.find(r => r.id === state.activeRecipeId);
  if (!recipe) {
    elements.counterViewContainer.innerHTML =  /*html*/`
      <div class="empty-state">
        <h2 class="empty-state-title">No cocktail selected</h2>
        <p>Select a recipe from the sidebar or create a new one.</p>
      </div>
    `;
    return;
  }

  const hasActiveRiffs = Object.keys(state.activeRiffs).length > 0;
  const effectiveSpecs = (recipe.specs || []).map((spec, index) => {
    const riffId = state.activeRiffs[index];
    if (riffId && TAXONOMY[riffId]) {
      return {
        ...spec,
        name: TAXONOMY[riffId].name,
        originalName: spec.name,
        isRiff: true,
        riffId,
      };
    }
    return {
      ...spec,
      originalName: spec.name,
      isRiff: false,
    };
  });

  const effectiveRecipe = {
    ...recipe,
    specs: effectiveSpecs,
  };

  const similarCocktails = findSimilarCocktails(recipe, state.recipes);
  const lineage = getRecipeRiffLineage(recipe, state.recipes);
  const invAnalysis = analyzeRecipeInventory(effectiveRecipe, state.inventory);

  const layers = calculateFluidLayers(effectiveSpecs);
  const totalOz = layers.length > 0 ? layers[0].totalVolOz : 0;
  const totalDisplay = state.unitSystem === 'ml'
    ? `${Math.round(totalOz * 29.5735)} ml`
    : `${totalOz.toFixed(2)} oz`;

  const abvInfo = calculateCocktailAbv(effectiveSpecs, recipe.method);
  const roundedAbv = Math.round(abvInfo.estimatedAbv);
  const abvDisplay = roundedAbv > 0 ? `${roundedAbv}%` : 'Non-Alcoholic';

  const specsListHtml = effectiveSpecs.map((spec, index) => {
    let amountText = '';
    let unitText = spec.unit || '';

    if (spec.amount !== null && spec.amount !== undefined) {
      if (state.unitSystem === 'ml' && (spec.unit === 'oz' || !spec.unit)) {
        amountText = `${Math.round(spec.amount * 29.5735)}`;
        unitText = 'ml';
      } else {
        amountText = formatFraction(spec.amount);
      }
    }

    const colorInfo = getIngredientColor(spec.name);
    const layer = layers[index];
    const ratioPercent = layer ? `${(layer.ratio * 100).toFixed(0)}%` : '';

    const substitutes = getIngredientSubstitutes(spec.originalName || spec.name);
    const isRiff = spec.isRiff;

    let riffControlHtml = '';
    if (state.riffModeActive && substitutes.length > 0) {
      riffControlHtml = `
        <div class="spec-riff-wrapper" title="Riff on ${escapeHtml(spec.originalName)}">
          <select class="spec-riff-select ${isRiff ? 'active-riff' : ''}" data-spec-index="${index}" aria-label="Riff on ${escapeHtml(spec.originalName)}">
            <option value="" ${!isRiff ? 'selected' : ''}>Riff ▾</option>
            ${isRiff ? `<option value="__orig__">↺ ${escapeHtml(spec.originalName)} (Original)</option>` : ''}
            ${substitutes.map(sub => `
              <option value="${sub.id}" ${spec.riffId === sub.id ? 'selected' : ''}>
                ${escapeHtml(sub.name)}
              </option>
            `).join('')}
          </select>
        </div>
      `;
    }

    const stockStatus = checkIngredientStock(spec.originalName || spec.name, state.inventory);
    let stockControlHtml = '';
    if (stockStatus.isStaple) {
      stockControlHtml = `<span class="spec-staple-tag" title="Kitchen staple (always in stock)">Staple</span>`;
    } else if (stockStatus.inStock) {
      stockControlHtml = `<button type="button" class="btn-stock-toggle in-stock" data-bottle-id="${escapeHtml(stockStatus.id)}" title="In your backbar. Click to remove." aria-label="Remove ${escapeHtml(stockStatus.name)} from bar">✓ Bar</button>`;
    } else {
      stockControlHtml = `<button type="button" class="btn-stock-toggle out-of-stock" data-bottle-id="${escapeHtml(stockStatus.id)}" title="Missing from your backbar. Click to add." aria-label="Add ${escapeHtml(stockStatus.name)} to bar">+ Bar</button>`;
    }

    return `
      <div class="spec-row ${isRiff ? 'is-riffed-row' : ''}" data-spec-index="${index}">
        <div class="spec-amount">
          ${amountText ? `${escapeHtml(amountText)}<span class="spec-unit">${escapeHtml(unitText)}</span>` : `<span class="spec-unit">${escapeHtml(unitText || 'to taste')}</span>`}
        </div>
        <div class="spec-ingredient">
          <span class="color-swatch-dot" style="background-color: ${colorInfo.color}; color: ${colorInfo.color};"></span>
          <span class="spec-name">${escapeHtml(spec.name)}</span>
        </div>
        ${riffControlHtml}
        <div class="spec-actions">
          ${stockControlHtml}
          ${ratioPercent ? `<div class="spec-ratio" title="Relative volume ratio">${ratioPercent}</div>` : ''}
        </div>
      </div>
    `;
  }).join('');

  elements.counterViewContainer.innerHTML =  /*html*/`
    <div class="counter-view ${state.riffModeActive ? 'riff-mode-active' : ''}">
    <!-- Top Action Bar -->
    <div class="counter-nav-bar">
      <button id="btn-mobile-back" class="btn btn-secondary btn-sm mobile-back-btn">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6"></polyline></svg>
        Drinks
      </button>

      <div class="counter-actions">
        <div class="unit-switch-group" role="group" aria-label="Measurement units">
          <button id="btn-unit-oz" class="unit-btn ${state.unitSystem === 'oz' ? 'active' : ''}">OZ</button>
          <button id="btn-unit-ml" class="unit-btn ${state.unitSystem === 'ml' ? 'active' : ''}">ML</button>
        </div>

        ${hasActiveRiffs ? `
          <button id="btn-reset-riff" class="btn btn-secondary btn-sm" title="Revert back to original cocktail specs">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="1 4 1 10 7 10"></polyline><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path></svg>
            Reset Riff
          </button>
          <button id="btn-save-riff" class="btn btn-primary btn-sm" title="Save this riff variation as a new cocktail">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
            Save as Riff
          </button>
        ` : ''}

        <button id="btn-edit-drink" class="btn btn-secondary btn-sm" title="Edit recipe specs">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
          Edit
        </button>

        <button id="btn-duplicate-drink" class="btn btn-secondary btn-sm" title="Duplicate recipe">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
          Duplicate
        </button>

        <button id="btn-delete-drink" class="btn btn-danger btn-sm" title="Delete recipe">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          Delete
        </button>
      </div>
    </div>

    <!-- Drink Title & Meta Header -->
    <div class="drink-title-section">
      <h2 class="drink-name">${escapeHtml(recipe.name)}</h2>
      <div class="drink-badges">
        <span class="meta-pill">
          <span>Glass:</span>
          <strong>${escapeHtml(recipe.glassware || 'Glass')}</strong>
        </span>
        <span class="meta-pill">
          <span>Method:</span>
          <strong>${escapeHtml(recipe.method || 'Standard')}</strong>
        </span>
        <span class="meta-pill" title="Dilution-adjusted estimated alcohol by volume">
          <span>ABV:</span>
          <strong>${escapeHtml(abvDisplay)}</strong>
        </span>
        ${invAnalysis.canMake ? `
          <span class="meta-pill bar-ready-pill" title="All liquid ingredients in your backbar">
            <span>Bar:</span>
            <strong>Can Make Now</strong>
          </span>
        ` : (invAnalysis.isBottleNext && invAnalysis.missingItems.length > 0 ? `
          <span class="meta-pill bar-next-pill" title="Needs 1 bottle: ${escapeHtml(invAnalysis.missingItems[0].name)}">
            <span>Bottle Next:</span>
            <strong>Needs ${escapeHtml(invAnalysis.missingItems[0].name)}</strong>
          </span>
        ` : (invAnalysis.missingCount > 1 ? `
          <span class="meta-pill" title="Needs ${invAnalysis.missingCount} bottles">
            <span>Bar:</span>
            <strong>Needs ${invAnalysis.missingCount} Bottles</strong>
          </span>
        ` : ''))}
        ${lineage ? `
          <span class="meta-pill riff-lineage-pill" title="Riff on ${escapeHtml(lineage.parentName)}">
            <span class="riff-tag">Riff:</span>
            <strong>${escapeHtml(lineage.parentName)}</strong>
          </span>
        ` : ''}
        ${hasActiveRiffs ? `
          <span class="meta-pill riff-active-pill" title="Dynamic ingredient swap active">
            <span>Swaps:</span>
            <strong>Active</strong>
          </span>
        ` : ''}
        ${recipe.garnish ? `
          <span class="meta-pill">
            <span>Garnish:</span>
            <strong>${escapeHtml(recipe.garnish)}</strong>
          </span>
        ` : ''}
      </div>
    </div>

    <!-- Main Counter Grid: Vector Glass on Left, Specs and Details on Right -->
    <div class="counter-grid">
      <!-- Left Column: Interactive Vector Fluid Glass -->
      <div class="glass-column">
        <div class="glass-wrapper" id="glass-wrapper">
          <!-- Rendered via GlassView -->
        </div>

        <div class="glass-meta-card">
          <div class="glass-total-volume">
            Total Liquid: <strong>${escapeHtml(totalDisplay)}</strong>
          </div>
          <div class="glass-abv">Estimated ABV: <strong>${escapeHtml(abvDisplay)}</strong></div>
          ${(recipe.source || recipe.sourceUrl) ? `
            <div class="glass-source">
              Source: ${recipe.sourceUrl
        ? `<a href="${escapeHtml(recipe.sourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(recipe.source || 'Original Recipe')} ↗</a>`
        : `<strong>${escapeHtml(recipe.source)}</strong>`}
            </div>
          ` : ''}
          <div class="glass-interaction-tip">
            Hover fluid layers or specs to inspect proportions
          </div>
        </div>

        <button id="btn-toggle-riff-mode" class="btn ${state.riffModeActive ? 'btn-primary' : 'btn-secondary'} btn-sm riff-toggle-btn" title="Toggle ingredient substitution menus">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
          ${state.riffModeActive ? 'Done Riffing' : 'Make a Riff'}
        </button>
      </div>

      <!-- Right Column: Specs Table, Preparation & Notes -->
      <div class="specs-column">

        <!-- Story / Writeup Card (if present) -->
        ${recipe.description ? /*html*/ `
          <div class="counter-card">
            <div class="counter-card-header">
              <span class="counter-card-title">About the Cocktail</span>
            </div>
            <p class="card-content-text card-description">
              ${escapeHtml(recipe.description)}
            </p>
          </div>
        ` : ''}

        <!-- Ingredients Specs Card -->
        <div class="counter-card">
          <div class="counter-card-header">
            <span class="counter-card-title">Ingredients</span>
            <span class="tag-badge">${(recipe.specs || []).length} items</span>
          </div>

          <div class="specs-list" id="counter-specs-list">
            ${specsListHtml}
          </div>
        </div>

        <!-- Preparation Directions -->
        ${(recipe.instructions || recipe.method || recipe.notes) ? /*html*/ `
          <div class="counter-card">
            <div class="counter-card-header">
              <span class="counter-card-title">Preparation Method</span>
            </div>
            <div class="card-content-text card-instructions">${escapeHtml(recipe.instructions || (recipe.method ? `${recipe.method}: ${recipe.notes || 'Standard build and chill.'}` : (recipe.notes || '')))}</div>
          </div>
        ` : ''}

        <!-- Garnish & Serving Note -->
        ${recipe.garnish ? /*html*/ `
          <div class="counter-card">
            <div class="counter-card-header">
              <span class="counter-card-title">Serving & Presentation</span>
            </div>
            <p class="card-content-text">
              Serve in a chilled <strong>${escapeHtml(recipe.glassware || 'glass')}</strong> with <strong>${escapeHtml(recipe.garnish)}</strong>.
            </p>
          </div>
        ` : ''}

        <!-- Additional Notes (if separate from instructions) -->
        ${(recipe.notes && recipe.instructions && recipe.notes.trim() !== recipe.instructions.trim()) ? /*html*/ `
          <div class="counter-card">
            <div class="counter-card-header">
              <span class="counter-card-title">Notes & Variations</span>
            </div>
            <p class="card-content-text">
              ${escapeHtml(recipe.notes)}
            </p>
          </div>
        ` : ''}

      </div>
    </div>

    <!-- Bottle Next Recommendation Card -->
    ${(invAnalysis.isBottleNext && invAnalysis.missingItems.length === 1) ? `
      <div class="counter-card bottle-next-banner">
        <div class="bottle-next-banner-content">
          <div class="bottle-next-icon" style="color: ${invAnalysis.missingItems[0].color || 'var(--color-accent)'};">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 2h8"></path><path d="M9 2v3h6V2"></path><path d="M7 5h10v17H7z"></path></svg>
          </div>
          <div class="bottle-next-text">
            <div class="bottle-next-title">You're 1 bottle away from making this cocktail</div>
            <div class="bottle-next-desc">Add <strong>${escapeHtml(invAnalysis.missingItems[0].name)}</strong> to your backbar inventory to unlock ${escapeHtml(recipe.name)}.</div>
          </div>
          <button type="button" class="btn btn-primary btn-sm btn-quick-add-bottle" data-bottle-id="${escapeHtml(invAnalysis.missingItems[0].id)}" title="Add ${escapeHtml(invAnalysis.missingItems[0].name)} to your bar">
            + Add to Bar
          </button>
        </div>
      </div>
    ` : ''}

    <!-- Similar Cocktails Shelf (Horizontal Scrolling Track) -->
    ${similarCocktails.length > 0 ? `
      <div class="counter-card similar-cocktails-shelf">
        <div class="counter-card-header shelf-header">
          <div class="shelf-header-left">
            <span class="counter-card-title">Similar Cocktails</span>
            <span class="tag-badge">${similarCocktails.length} Available</span>
          </div>
          <div class="shelf-scroll-controls">
            <button id="btn-similar-prev" class="shelf-nav-btn" aria-label="Scroll previous cocktails" title="Scroll left">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6"></polyline></svg>
            </button>
            <button id="btn-similar-next" class="shelf-nav-btn" aria-label="Scroll next cocktails" title="Scroll right">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"></polyline></svg>
            </button>
          </div>
        </div>

        <div class="similar-cocktails-track" id="similar-cocktails-track">
          ${similarCocktails.map((item, idx) => `
            <div class="similar-cocktail-card" data-recipe-id="${escapeHtml(item.recipe.id)}" role="button" tabindex="0">
              <div class="similar-card-glass">
                ${renderGlassSvg(item.recipe, `sim-glass-${item.recipe.id}-${idx}`)}
              </div>
              <div class="similar-card-body">
                <span class="similar-relation-badge ${item.badgeClass || ''}">${escapeHtml(item.relation)}</span>
                <h4 class="similar-card-name" title="${escapeHtml(item.recipe.name)}">${escapeHtml(item.recipe.name)}</h4>
                <div class="similar-card-meta">
                  <span>${escapeHtml(item.recipe.glassware || 'Glass')}</span>
                  <span class="meta-dot">•</span>
                  <span>${escapeHtml(item.recipe.method || 'Build')}</span>
                </div>
                <div class="similar-card-specs" title="${(item.recipe.specs || []).map(s => s.name).join(', ')}">
                  ${(item.recipe.specs || []).map(s => escapeHtml(s.name)).filter(Boolean).slice(0, 3).join(', ')}
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    ` : ''}
  </div>
  `;

  // Render vector SVG glass
  const glassContainer = document.getElementById('glass-wrapper');
  state.glassViewMain = new GlassView(glassContainer, {
    onLayerHover: (index) => {
      const rows = elements.counterViewContainer.querySelectorAll('.spec-row');
      rows.forEach((row, i) => {
        row.classList.toggle('highlighted', i === index);
      });
    },
  });
  state.glassViewMain.render(effectiveRecipe);

  // Synchronize spec row hover to SVG glass highlight
  const specRows = elements.counterViewContainer.querySelectorAll('.spec-row');
  specRows.forEach(row => {
    const idx = parseInt(row.getAttribute('data-spec-index'), 10);
    row.addEventListener('mouseenter', () => {
      row.classList.add('highlighted');
      state.glassViewMain.highlightLayer(idx);
    });
    row.addEventListener('mouseleave', () => {
      row.classList.remove('highlighted');
      state.glassViewMain.clearHighlight();
    });
  });

  // In-spec stock toggle buttons
  elements.counterViewContainer.querySelectorAll('.btn-stock-toggle').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const bottleId = btn.getAttribute('data-bottle-id');
      if (bottleId) {
        toggleInventoryBottle(bottleId);
        const inBar = state.inventory.has(bottleId);
        const name = TAXONOMY[bottleId]?.name || bottleId;
        showToast(inBar ? `Added ${name} to your backbar` : `Removed ${name} from your backbar`);
      }
    });
  });

  // Bottle Next banner quick-add button
  elements.counterViewContainer.querySelectorAll('.btn-quick-add-bottle').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const bottleId = btn.getAttribute('data-bottle-id');
      if (bottleId) {
        state.inventory.add(bottleId);
        saveInventory(Array.from(state.inventory));
        updateMyBarBadge();
        renderRecipeList();
        renderCounterView();
        const name = TAXONOMY[bottleId]?.name || bottleId;
        showToast(`Added ${name} to your backbar`);
      }
    });
  });

  // Toggle Riff Mode
  document.getElementById('btn-toggle-riff-mode')?.addEventListener('click', () => {
    state.riffModeActive = !state.riffModeActive;
    renderCounterView();
  });

  // Smart Ingredient Swapper: Inline Riff Selectors
  elements.counterViewContainer.querySelectorAll('.spec-riff-select').forEach(sel => {
    sel.addEventListener('change', (e) => {
      const idx = parseInt(e.target.getAttribute('data-spec-index'), 10);
      const val = e.target.value;
      if (!val || val === '__orig__') {
        delete state.activeRiffs[idx];
      } else {
        state.activeRiffs[idx] = val;
      }
      renderCounterView();
    });
  });

  document.getElementById('btn-reset-riff')?.addEventListener('click', () => {
    state.activeRiffs = {};
    renderCounterView();
    showToast('Reverted to original recipe specs');
  });

  document.getElementById('btn-save-riff')?.addEventListener('click', () => {
    const swapped = effectiveSpecs.filter(s => s.isRiff);
    const swapNames = swapped.map(s => s.name).join(' / ');
    const newName = `${recipe.name} (${swapNames} Riff)`;
    const newRecipe = {
      ...recipe,
      id: 'rec_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      name: newName,
      description: recipe.description
        ? `${recipe.description}\n\nRiff on ${recipe.name}: substituted ${swapped.map(s => `${s.originalName} with ${s.name}`).join(', ')}.`
        : `Riff on ${recipe.name}: substituted ${swapped.map(s => `${s.originalName} with ${s.name}`).join(', ')}.`,
      riffOfId: recipe.id,
      riffOfName: recipe.name,
      specs: effectiveSpecs.map(s => ({
        amount: s.amount,
        unit: s.unit,
        name: s.name,
        ...(s.abv ? { abv: s.abv } : {}),
      })),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    saveRecipe(newRecipe);
    state.recipes = getRecipes();
    state.activeRiffs = {};
    selectRecipe(newRecipe.id);
    showToast(`Saved new riff: ${newName}`);
  });

  // Similar Cocktails shelf scroll & card navigation
  const simTrack = document.getElementById('similar-cocktails-track');
  document.getElementById('btn-similar-prev')?.addEventListener('click', () => {
    simTrack?.scrollBy({ left: -260, behavior: 'smooth' });
  });
  document.getElementById('btn-similar-next')?.addEventListener('click', () => {
    simTrack?.scrollBy({ left: 260, behavior: 'smooth' });
  });

  elements.counterViewContainer.querySelectorAll('.similar-cocktail-card').forEach(el => {
    const targetId = el.getAttribute('data-recipe-id');
    el.addEventListener('click', () => {
      if (targetId) selectRecipe(targetId);
    });
    el.addEventListener('keydown', (e) => {
      if ((e.key === 'Enter' || e.key === ' ') && targetId) {
        e.preventDefault();
        selectRecipe(targetId);
      }
    });
  });

  // Action listeners
  document.getElementById('btn-unit-oz')?.addEventListener('click', () => {
    state.unitSystem = 'oz';
    renderCounterView();
  });

  document.getElementById('btn-unit-ml')?.addEventListener('click', () => {
    state.unitSystem = 'ml';
    renderCounterView();
  });

  document.getElementById('btn-edit-drink')?.addEventListener('click', () => {
    openEditor(recipe);
  });

  document.getElementById('btn-duplicate-drink')?.addEventListener('click', () => {
    duplicateRecipe(recipe);
  });

  document.getElementById('btn-delete-drink')?.addEventListener('click', () => {
    confirmDeleteRecipe(recipe);
  });

  document.getElementById('btn-mobile-back')?.addEventListener('click', () => {
    elements.sidebar.classList.remove('mobile-hidden');
    elements.mainStage.classList.add('mobile-hidden');
  });
}

/**
 * Open Recipe Editor (Create or Edit)
 */
function openEditor(recipe = null) {
  state.viewMode = 'edit';
  const isNew = !recipe;

  const currentData = recipe ? JSON.parse(JSON.stringify(recipe)) : {
    id: null,
    name: '',
    glassware: 'Coupe',
    method: 'Shaken',
    garnish: '',
    description: '',
    instructions: '',
    source: '',
    sourceUrl: '',
    notes: '',
    specs: [
      { amount: 2, unit: 'oz', name: '' },
      { amount: 0.75, unit: 'oz', name: '' },
    ],
  };

  state.editorSpecs = (currentData.specs || []).map(s => ({ ...s }));

  elements.editorViewContainer.innerHTML =  /*html*/`
    <div class="editor-header">
      <h2 class="editor-title">${isNew ? 'Create New Cocktail' : `Edit ${escapeHtml(currentData.name)}`}</h2>
      <div class="counter-actions">
        <button id="btn-cancel-edit" class="btn btn-secondary">Cancel</button>
        <button id="btn-save-edit" class="btn btn-primary">Save Recipe</button>
      </div>
    </div>

    <div class="editor-grid">
      <!-- Left Column: Form Controls & Quick Paste -->
      <div class="editor-form-col">
        <!-- Quick Paste Box -->
        <div class="quick-paste-box">
          <div class="quick-paste-header">
            <span class="quick-paste-title">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect></svg>
              Quick Paste Ingredients
            </span>
            <span class="quick-paste-hint">Ingredient measurements only</span>
          </div>
          <textarea
            id="quick-paste-input"
            class="quick-paste-textarea"
            placeholder="Paste ingredient lines (e.g.:&#10;1.5 oz Scotch&#10;0.5 oz Mezcal&#10;0.75 oz Lime Juice&#10;0.75 oz Orgeat&#10;2 dashes Celery Bitters)&#10;&#10;Add preparation steps and writeup in the sections below."
          ></textarea>
          <div style="display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 0.5rem;">
            <button type="button" id="btn-clear-paste" class="btn btn-ghost btn-sm">Clear Box</button>
            <button type="button" id="btn-apply-paste" class="btn btn-secondary btn-sm">Apply Pasted Specs</button>
          </div>
        </div>

        <!-- Recipe Core Fields -->
        <div class="form-group">
          <label class="form-label" for="edit-name">Cocktail Name</label>
          <input type="text" id="edit-name" class="form-input" value="${escapeHtml(currentData.name)}" placeholder="e.g. Sea Legs" required>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label" for="edit-glassware">Glassware</label>
            <select id="edit-glassware" class="form-select">
              <option value="Coupe" ${currentData.glassware === 'Coupe' ? 'selected' : ''}>Coupe</option>
              <option value="Rocks" ${currentData.glassware === 'Rocks' ? 'selected' : ''}>Rocks / Old Fashioned</option>
              <option value="Highball" ${currentData.glassware === 'Highball' ? 'selected' : ''}>Highball / Collins</option>
              <option value="Martini" ${currentData.glassware === 'Martini' ? 'selected' : ''}>Martini</option>
              <option value="Nick & Nora" ${currentData.glassware === 'Nick & Nora' ? 'selected' : ''}>Nick & Nora</option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label" for="edit-method">Preparation Technique</label>
            <select id="edit-method" class="form-select">
              <option value="Shaken" ${currentData.method === 'Shaken' ? 'selected' : ''}>Shaken</option>
              <option value="Stirred" ${currentData.method === 'Stirred' ? 'selected' : ''}>Stirred</option>
              <option value="Built" ${currentData.method === 'Built' ? 'selected' : ''}>Built in Glass</option>
              <option value="Blended" ${currentData.method === 'Blended' ? 'selected' : ''}>Blended</option>
              <option value="Rolled" ${currentData.method === 'Rolled' ? 'selected' : ''}>Rolled</option>
            </select>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label" for="edit-garnish">Garnish</label>
          <input type="text" id="edit-garnish" class="form-input" value="${escapeHtml(currentData.garnish)}" placeholder="e.g. Lime wheel">
        </div>

        <!-- Editable Spec Rows -->
        <div class="editor-specs-section">
          <div class="editor-specs-header">
            <label class="form-label" style="margin-bottom: 0;">Ingredient Specifications</label>
            <button type="button" id="btn-add-spec-row" class="btn btn-secondary btn-sm">+ Add Ingredient</button>
          </div>

          <div id="editor-specs-rows">
            <!-- Populated via renderEditorSpecRows() -->
          </div>
        </div>

        <!-- Preparation Directions -->
        <div class="form-group" style="margin-top: 1.5rem;">
          <label class="form-label" for="edit-instructions">Preparation Directions</label>
          <textarea id="edit-instructions" class="form-textarea" rows="4" placeholder="Step-by-step directions (e.g. Combine all ingredients in a shaker with ice. Shake until cold and diluted. Strain over fresh ice into a rocks glass.)">${escapeHtml(currentData.instructions || currentData.notes || '')}</textarea>
        </div>

        <!-- Description & Story -->
        <div class="form-group">
          <label class="form-label" for="edit-description">Description & Story</label>
          <textarea id="edit-description" class="form-textarea" rows="3" placeholder="Background, flavor profile, or creator writeup...">${escapeHtml(currentData.description || '')}</textarea>
        </div>

        <!-- Source & Attribution -->
        <div class="form-row">
          <div class="form-group">
            <label class="form-label" for="edit-source">Source / Creator</label>
            <input type="text" id="edit-source" class="form-input" value="${escapeHtml(currentData.source || '')}" placeholder="e.g. Elevated Craft / Alejandro Olivares">
          </div>
          <div class="form-group">
            <label class="form-label" for="edit-source-url">Source Link / URL</label>
            <input type="url" id="edit-source-url" class="form-input" value="${escapeHtml(currentData.sourceUrl || '')}" placeholder="https://elevatedcraft.com/blogs/cocktail-recipes/sea-legs">
          </div>
        </div>

        <!-- Additional Notes -->
        <div class="form-group">
          <label class="form-label" for="edit-notes">Additional Notes & Tips (Optional)</label>
          <textarea id="edit-notes" class="form-textarea" rows="2" placeholder="Ice, dilution details, or variations...">${escapeHtml(currentData.notes || '')}</textarea>
        </div>
      </div>

      <!-- Right Column: Live Vector Fluid Glass Preview -->
      <div class="editor-preview-col">
        <label class="form-label">Live Ratio Preview</label>
        <div class="glass-wrapper" id="editor-glass-wrapper" style="height: 340px;">
          <!-- Live GlassView -->
        </div>
        <div class="glass-meta-card" style="max-width: 100%;">
          <div id="editor-abv-badge" style="font-size: 0.85rem; font-weight: 600; color: var(--color-accent-light); margin-bottom: 0.25rem;">
            Estimated Strength: ~0% ABV
          </div>
          <div class="glass-interaction-tip">
            Layers and ABV recalculate in real-time as amounts are entered
          </div>
        </div>
      </div>
    </div>
  `;

  renderEditorSpecRows();
  setupEditorEvents(currentData.id);
  renderCurrentView();
  updateEditorGlassPreview();
}

/**
 * Render editable ingredient rows in editor
 */
function renderEditorSpecRows() {
  const container = document.getElementById('editor-specs-rows');
  if (!container) return;

  const units = ['oz', 'ml', 'dash', 'dashes', 'barspoon', 'tsp', 'tbsp', 'drops', 'rinse', 'part'];

  container.innerHTML =  /*html*/state.editorSpecs.map((spec, i) => {
    const defaultAbv = estimateIngredientAbv(spec.name || '');
    const currentAbv = spec.abv !== undefined && spec.abv !== null ? spec.abv : (defaultAbv > 0 ? defaultAbv : '');

    return `
      <div class="editor-spec-row" data-index="${i}">
        <input
          type="text"
          class="form-input spec-input-amount"
          value="${spec.amount !== null && spec.amount !== undefined ? spec.amount : ''}"
          placeholder="Amt"
          aria-label="Amount"
        >
        <select class="form-select spec-input-unit" aria-label="Unit">
          <option value="" ${!spec.unit ? 'selected' : ''}>none</option>
          ${units.map(u => `
            <option value="${u}" ${spec.unit === u ? 'selected' : ''}>${u}</option>
          `).join('')}
        </select>
        <input
          type="text"
          class="form-input spec-input-name"
          value="${escapeHtml(spec.name)}"
          placeholder="Ingredient name (e.g. Bourbon)"
          aria-label="Ingredient name"
          required
        >
        <input
          type="number"
          step="0.1"
          min="0"
          max="100"
          class="form-input spec-input-abv"
          value="${currentAbv}"
          placeholder="ABV%"
          title="Alcohol By Volume percentage"
          aria-label="ABV percentage"
        >
        <button type="button" class="btn-remove-row" data-action="remove-row" data-index="${i}" title="Remove ingredient">✕</button>
      </div>
    `;
  }).join('');

  // Attach input listeners for live updates
  container.querySelectorAll('.editor-spec-row').forEach(row => {
    const idx = parseInt(row.getAttribute('data-index'), 10);
    const amtInput = row.querySelector('.spec-input-amount');
    const unitSelect = row.querySelector('.spec-input-unit');
    const nameInput = row.querySelector('.spec-input-name');
    const abvInput = row.querySelector('.spec-input-abv');

    const updateRowState = () => {
      const rawAmt = amtInput.value.trim();
      let parsedAmt = null;
      if (rawAmt) {
        if (rawAmt.includes('/')) {
          const parts = rawAmt.split(/\s+/).filter(Boolean);
          if (parts.length === 2) {
            const [n, d] = parts[1].split('/');
            parsedAmt = parseFloat(parts[0]) + parseFloat(n) / parseFloat(d);
          } else if (parts.length === 1) {
            const [n, d] = parts[0].split('/');
            parsedAmt = parseFloat(n) / parseFloat(d);
          }
        } else {
          parsedAmt = parseFloat(rawAmt);
        }
      }

      const ingName = nameInput.value.trim();
      const rawAbv = abvInput.value.trim();
      let customAbv = undefined;
      if (rawAbv !== '') {
        const numAbv = parseFloat(rawAbv);
        if (!isNaN(numAbv)) {
          customAbv = numAbv;
        }
      }

      state.editorSpecs[idx] = {
        amount: !isNaN(parsedAmt) ? parsedAmt : null,
        unit: unitSelect.value,
        name: ingName,
        abv: customAbv,
      };

      updateEditorGlassPreview();
    };

    amtInput.addEventListener('input', updateRowState);
    unitSelect.addEventListener('change', updateRowState);
    nameInput.addEventListener('input', () => {
      // If user types a known spirit and abv is empty, auto-suggest default abv
      if (!abvInput.value) {
        const est = estimateIngredientAbv(nameInput.value);
        if (est > 0) {
          abvInput.value = est;
        }
      }
      updateRowState();
    });
    abvInput.addEventListener('input', updateRowState);
  });

  // Remove row
  container.querySelectorAll('[data-action="remove-row"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.getAttribute('data-index'), 10);
      state.editorSpecs.splice(idx, 1);
      renderEditorSpecRows();
      updateEditorGlassPreview();
    });
  });
}

/**
 * Setup event listeners within the editor
 */
function setupEditorEvents(recipeId) {
  // Add row
  document.getElementById('btn-add-spec-row')?.addEventListener('click', () => {
    state.editorSpecs.push({ amount: 1, unit: 'oz', name: '' });
    renderEditorSpecRows();
    updateEditorGlassPreview();
  });

  // Quick Paste Apply
  const quickPasteInput = document.getElementById('quick-paste-input');
  const applyQuickPaste = () => {
    const text = quickPasteInput.value.trim();
    if (!text) return;
    const parsed = parseSpecsBlock(text);
    if (parsed.length > 0) {
      state.editorSpecs = parsed.map(p => ({
        amount: p.amount,
        unit: p.unit,
        name: p.name,
      }));
      renderEditorSpecRows();
      updateEditorGlassPreview();
      showToast(`Parsed ${parsed.length} ingredients into specs below`);
    } else {
      showToast('No ingredient lines recognized in paste box');
    }
  };

  document.getElementById('btn-apply-paste')?.addEventListener('click', applyQuickPaste);

  document.getElementById('btn-clear-paste')?.addEventListener('click', () => {
    if (quickPasteInput) {
      quickPasteInput.value = '';
      showToast('Cleared paste box');
    }
  });

  // Auto-parse on paste event without wiping out text
  quickPasteInput?.addEventListener('paste', () => {
    setTimeout(applyQuickPaste, 50);
  });

  // Glassware & method live preview change
  document.getElementById('edit-glassware')?.addEventListener('change', () => {
    updateEditorGlassPreview();
  });

  document.getElementById('edit-method')?.addEventListener('change', () => {
    updateEditorGlassPreview();
  });

  // Cancel
  document.getElementById('btn-cancel-edit')?.addEventListener('click', cancelEditor);

  // Save
  document.getElementById('btn-save-edit')?.addEventListener('click', () => {
    saveCurrentEditor(recipeId);
  });
}

/**
 * Live vector glass update inside editor
 */
function updateEditorGlassPreview() {
  const container = document.getElementById('editor-glass-wrapper');
  if (!container) return;

  const glassware = document.getElementById('edit-glassware')?.value || 'Coupe';
  const name = document.getElementById('edit-name')?.value || 'Preview';

  state.glassViewEditor = new GlassView(container);

  state.glassViewEditor.render({
    name,
    glassware,
    specs: state.editorSpecs,
  });

  const method = document.getElementById('edit-method')?.value || 'Stirred';
  const abvBadge = document.getElementById('editor-abv-badge');
  if (abvBadge) {
    const abvCalc = calculateCocktailAbv(state.editorSpecs, method);
    const rounded = Math.round(abvCalc.estimatedAbv);
    abvBadge.textContent = rounded > 0
      ? `Estimated ABV: ${rounded}%`
      : 'Non-Alcoholic';
  }
}

/**
 * Cancel editing and return to counter view
 */
function cancelEditor() {
  state.viewMode = 'counter';
  renderCurrentView();
}

/**
 * Save current recipe from editor
 */
function saveCurrentEditor(existingId) {
  const nameInput = document.getElementById('edit-name');
  const name = nameInput.value.trim();

  if (!name) {
    nameInput.focus();
    alert('Please enter a cocktail name');
    return;
  }

  const glassware = document.getElementById('edit-glassware').value;
  const method = document.getElementById('edit-method').value;
  const garnish = document.getElementById('edit-garnish').value.trim();
  const instructions = document.getElementById('edit-instructions')?.value.trim() || '';
  const description = document.getElementById('edit-description')?.value.trim() || '';
  const source = document.getElementById('edit-source')?.value.trim() || '';
  const sourceUrl = document.getElementById('edit-source-url')?.value.trim() || '';
  const notes = document.getElementById('edit-notes')?.value.trim() || '';

  const validSpecs = state.editorSpecs.filter(s => s.name.trim().length > 0);
  const existingRecipe = existingId ? state.recipes.find(r => r.id === existingId) : null;

  const recipeToSave = {
    id: existingId || undefined,
    name,
    glassware,
    method,
    garnish,
    instructions,
    description,
    source,
    sourceUrl,
    notes,
    riffOfId: existingRecipe?.riffOfId || undefined,
    riffOfName: existingRecipe?.riffOfName || undefined,
    specs: validSpecs,
  };

  const saved = saveRecipe(recipeToSave);
  state.recipes = getRecipes();
  state.activeRecipeId = saved.id;
  state.viewMode = 'counter';

  renderRecipeList();
  renderCurrentView();
  showToast(`Saved "${saved.name}"`);
}

/**
 * Duplicate a recipe
 */
function duplicateRecipe(recipe) {
  const copy = {
    ...JSON.parse(JSON.stringify(recipe)),
    id: undefined,
    name: `${recipe.name} (Copy)`,
  };

  const saved = saveRecipe(copy);
  state.recipes = getRecipes();
  state.activeRecipeId = saved.id;
  renderRecipeList();
  renderCurrentView();
  showToast(`Created duplicate: "${saved.name}"`);
}

/**
 * Confirm and delete a recipe
 */
function confirmDeleteRecipe(recipe) {
  if (confirm(`Delete "${recipe.name}" from your vault?`)) {
    const updated = deleteRecipe(recipe.id);
    state.recipes = updated;
    state.activeRecipeId = state.recipes[0]?.id || null;
    renderRecipeList();
    renderCurrentView();
    showToast(`Deleted "${recipe.name}"`);
  }
}

/**
 * Display toast notification
 */
function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  elements.toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 200ms ease';
    setTimeout(() => toast.remove(), 220);
  }, 2400);
}

/**
 * Escape HTML utility
 */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Boot
document.addEventListener('DOMContentLoaded', init);
