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
  getAllUniqueTags,
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
  servings: 1, // Serving multiplier (default 1, increments by 0.5)
  editorSpecs: [],
  editorTags: [],
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

  // Resolve initial active recipe from URL Hash if provided
  const urlHash = window.location.hash.replace(/^#+/, '').trim();
  let initialId = null;

  if (urlHash && state.recipes.some(r => r.id === urlHash)) {
    initialId = urlHash;
  } else if (!window.location.hash) {
    // If no hash was explicitly provided, leave hash empty or use last stored recipe without forcing a hash
    try {
      const storedId = localStorage.getItem('speakeasy_last_active_recipe');
      if (storedId && state.recipes.some(r => r.id === storedId)) {
        initialId = storedId;
      }
    } catch {
      // Ignore localStorage errors
    }
  }

  if (!initialId && state.recipes.length > 0) {
    initialId = state.recipes[0].id;
  }

  state.activeRecipeId = initialId;
  // If a specific recipe was requested via hash, keep it in sync; otherwise do not force a hash onto a clean URL
  if (urlHash && initialId) {
    history.replaceState(null, '', `#${initialId}`);
  }

  // On mobile screens, show the recipe stage if a hash was specified, otherwise start on the cocktail list
  const isMobile = window.innerWidth <= 768;
  if (isMobile) {
    if (urlHash) {
      elements.sidebar.classList.add('mobile-hidden');
      elements.mainStage.classList.remove('mobile-hidden');
    } else {
      elements.sidebar.classList.remove('mobile-hidden');
      elements.mainStage.classList.add('mobile-hidden');
    }
  }

  setupGlobalEventListeners();
  setupBackbarEventListeners();
  updateMyBarBadge();
  renderRecipeList();
  renderCurrentView();

  // Scroll active item into view on initial load
  setTimeout(() => {
    const activeEl = elements.recipeList.querySelector('.recipe-list-item.active');
    activeEl?.scrollIntoView({ block: 'nearest' });
  }, 50);
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

  // URL Hash routing: handle browser Back / Forward buttons and manual hash edits
  window.addEventListener('hashchange', () => {
    const rawHash = window.location.hash.replace(/^#+/, '').trim();
    if (!rawHash) {
      // User removed the hash from URL: return to list view on mobile or preserve view without hash
      if (elements.sidebar && elements.mainStage) {
        elements.sidebar.classList.remove('mobile-hidden');
        elements.mainStage.classList.add('mobile-hidden');
      }
      return;
    }
    if (rawHash !== state.activeRecipeId && state.recipes.some(r => r.id === rawHash)) {
      selectRecipe(rawHash, false);
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

  // Wire selection
  elements.recipeList.querySelectorAll('[data-action="select"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      selectRecipe(id);
    });
  });
}

/**
 * Filter library by tag
 */
function filterByTag(tag) {
  state.searchQuery = `#${tag}`;
  if (elements.searchInput) {
    elements.searchInput.value = `#${tag}`;
  }
  elements.searchClearBtn?.classList.add('visible');
  renderRecipeList();
  showToast(`Filtered by #${tag}`);
}

/**
 * Select a recipe and display counter view
 */
function selectRecipe(id, updateHistory = true) {
  const found = state.recipes.find(r => r.id === id);
  if (!found) return;

  if (state.activeRecipeId !== id) {
    state.activeRiffs = {};
    state.riffModeActive = false;
    state.servings = 1;
  }
  state.activeRecipeId = id;
  state.viewMode = 'counter';

  try {
    localStorage.setItem('speakeasy_last_active_recipe', id);
  } catch {
    // Ignore
  }

  if (updateHistory && window.location.hash !== `#${id}`) {
    history.pushState(null, '', `#${id}`);
  }

  renderRecipeList();
  renderCurrentView();

  // Scroll active item into view in sidebar
  const activeEl = elements.recipeList.querySelector('.recipe-list-item.active');
  activeEl?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });

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

  const allLibraryTags = getAllUniqueTags(state.recipes);
  const availableTags = allLibraryTags.filter(t => !(recipe.tags || []).includes(t));

  const layers = calculateFluidLayers(effectiveSpecs);
  const baseTotalOz = layers.length > 0 ? layers[0].totalVolOz : 0;
  const currentServings = state.servings || 1;
  const scaledTotalOz = baseTotalOz * currentServings;
  const totalDisplay = state.unitSystem === 'ml'
    ? `${Math.round(scaledTotalOz * 29.5735)} ml`
    : `${scaledTotalOz.toFixed(2)} oz`;

  const abvInfo = calculateCocktailAbv(effectiveSpecs, recipe.method);
  const roundedAbv = Math.round(abvInfo.estimatedAbv);
  const abvDisplay = roundedAbv > 0 ? `${roundedAbv}% ABV` : 'Non-Alcoholic';

  const specsListHtml = effectiveSpecs.map((spec, index) => {
    let amountText = '';
    let unitText = spec.unit || '';

    if (spec.amount !== null && spec.amount !== undefined) {
      const scaledAmount = spec.amount * currentServings;
      if (state.unitSystem === 'ml' && (spec.unit === 'oz' || !spec.unit)) {
        amountText = `${Math.round(scaledAmount * 29.5735)}`;
        unitText = 'ml';
      } else {
        amountText = formatFraction(scaledAmount);
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

    const currentStockName = isRiff ? spec.name : (spec.originalName || spec.name);
    const stockStatus = checkIngredientStock(currentStockName, state.inventory);
    const inStockSubs = (!stockStatus.inStock && !isRiff)
      ? substitutes.filter(sub => checkIngredientStock(sub.name, state.inventory).inStock)
      : [];

    let subSuggestionHtml = '';
    if (!stockStatus.inStock && inStockSubs.length > 0 && !isRiff) {
      subSuggestionHtml = `
        <div class="spec-sub-suggestion">
          <button type="button" class="btn-sub-chip" data-action="apply-sub" data-spec-index="${index}" data-sub-id="${escapeHtml(inStockSubs[0].id)}" data-sub-name="${escapeHtml(inStockSubs[0].name)}" title="Substitute ${escapeHtml(spec.name)} with ${escapeHtml(inStockSubs[0].name)} from your bar">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m16 3 4 4-4 4"/><path d="M20 7H4"/><path d="m8 21-4-4 4-4"/><path d="M4 17h16"/></svg>
            <span>Sub: ${escapeHtml(inStockSubs[0].name)}</span>
          </button>
          ${inStockSubs.length > 1 ? `
            <span class="sub-more-badge" title="More subs available in your bar: ${escapeHtml(inStockSubs.slice(1).map(s => s.name).join(', '))}">+${inStockSubs.length - 1} more</span>
          ` : ''}
        </div>
      `;
    }

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
          <div class="spec-ingredient-name-row">
            <span class="color-swatch-dot" style="background-color: ${colorInfo.color}; color: ${colorInfo.color};"></span>
            <span class="spec-name">${escapeHtml(spec.name)}</span>
            ${isRiff ? `<span class="spec-riff-badge" title="Substituted for ${escapeHtml(spec.originalName)}">sub</span>` : ''}
          </div>
          ${isRiff ? `<div class="spec-riff-orig-note">sub for ${escapeHtml(spec.originalName)}</div>` : ''}
          ${subSuggestionHtml}
        </div>
        ${riffControlHtml}
        <div class="spec-actions">
          ${stockControlHtml}
          <div class="spec-ratio" title="${ratioPercent ? 'Relative volume ratio' : ''}">${ratioPercent || ''}</div>
        </div>
      </div>
    `;
  }).join('');

  elements.counterViewContainer.innerHTML =  /*html*/`
    <div class="counter-view ${state.riffModeActive ? 'riff-mode-active' : ''}">
    <!-- Mobile Back Navigation (hidden on desktop) -->
    <div class="counter-mobile-bar">
      <button id="btn-mobile-back" class="btn btn-secondary btn-sm mobile-back-btn">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6"></polyline></svg>
        Drinks
      </button>
    </div>

    <!-- Drink Title & Meta Header -->
    <div class="drink-title-section">
      <div class="drink-title-row">
        <h2 class="drink-name">${escapeHtml(recipe.name)}</h2>

        <!-- Tidy Icon-Button Cluster Pinned to Far Right -->
        <div class="drink-actions-cluster" role="toolbar" aria-label="Recipe actions">
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

          <button id="btn-edit-drink" class="action-icon-btn" title="Edit recipe specs" aria-label="Edit recipe">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
            <span class="action-btn-text">Edit Recipe</span>
          </button>

          <button id="btn-duplicate-drink" class="action-icon-btn" title="Duplicate recipe" aria-label="Duplicate recipe">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
            <span class="action-btn-text">Duplicate</span>
          </button>

          <button id="btn-delete-drink" class="action-icon-btn action-icon-btn-danger" title="Delete recipe" aria-label="Delete recipe">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            <span class="action-btn-text">Delete</span>
          </button>
        </div>
      </div>

      <!-- Inline Metadata Row with subtle dot dividers -->
      <div class="drink-meta-row">
        <span class="drink-meta-item">${escapeHtml(recipe.glassware || 'Glass')}</span>
        <span class="meta-dot-divider">•</span>
        <span class="drink-meta-item">${escapeHtml(recipe.method || 'Standard')}</span>
        <span class="meta-dot-divider">•</span>
        <span class="drink-meta-item" title="Dilution-adjusted estimated alcohol by volume">${escapeHtml(abvDisplay)}</span>
        ${lineage ? `
          <span class="meta-dot-divider">•</span>
          <span class="drink-meta-item drink-meta-riff">Riff on <strong>${escapeHtml(lineage.parentName)}</strong></span>
        ` : ''}
      </div>

      <!-- Actionable Status Row for state items only -->
      ${(invAnalysis.canMake || invAnalysis.canMakeWithSubs || (invAnalysis.isBottleNext && invAnalysis.missingItems.length > 0) || hasActiveRiffs || recipe.garnish) ? `
        <div class="drink-status-badges">
          ${invAnalysis.canMake ? `
            <span class="status-pill status-pill-ready" title="All liquid ingredients in your backbar">
              <span class="status-dot"></span>
              <span>Ready to Make</span>
            </span>
          ` : (invAnalysis.canMakeWithSubs && invAnalysis.missingWithSub && invAnalysis.bestSubstitute ? `
            <button type="button" class="status-pill status-pill-sub" id="btn-apply-header-sub" data-missing-name="${escapeHtml(invAnalysis.missingWithSub.name)}" data-sub-id="${escapeHtml(invAnalysis.bestSubstitute.id)}" data-sub-name="${escapeHtml(invAnalysis.bestSubstitute.name)}" title="Substitute ${escapeHtml(invAnalysis.missingWithSub.name)} with ${escapeHtml(invAnalysis.bestSubstitute.name)} from your bar">
              <span class="status-dot"></span>
              <span>Sub in Bar: Use <strong>${escapeHtml(invAnalysis.bestSubstitute.name)}</strong> for ${escapeHtml(invAnalysis.missingWithSub.name)}</span>
              <span class="sub-pill-action">Apply ↵</span>
            </button>
          ` : (invAnalysis.isBottleNext && invAnalysis.missingItems.length > 0 ? `
            <span class="status-pill status-pill-next" title="Needs 1 bottle: ${escapeHtml(invAnalysis.missingItems[0].name)}">
              <span class="status-dot"></span>
              <span>Bottle Next: Needs ${escapeHtml(invAnalysis.missingItems[0].name)}</span>
            </span>
          ` : ''))}
          ${hasActiveRiffs ? `
            <span class="status-pill status-pill-swaps" title="Dynamic ingredient swap active">
              <span>Swaps Active</span>
            </span>
          ` : ''}
          ${recipe.garnish ? `
            <span class="status-pill status-pill-garnish">
              <span class="pill-label">Garnish:</span>
              <strong>${escapeHtml(recipe.garnish)}</strong>
            </span>
          ` : ''}
        </div>
      ` : ''}

      <!-- Drink Tags -->
      <div class="drink-tags-bar">
        <span class="drink-tags-label">Tags:</span>
        <div class="drink-tags-chips" id="drink-tags-chips">
          ${(recipe.tags || []).map(tag => `
            <span class="drink-tag-chip" data-tag="${escapeHtml(tag)}">
              <span class="drink-tag-text" data-action="filter-tag" data-tag="${escapeHtml(tag)}" title="Filter library by #${escapeHtml(tag)}" tabindex="0">#${escapeHtml(tag)}</span>
              <button type="button" class="drink-tag-remove" data-action="remove-tag" data-tag="${escapeHtml(tag)}" title="Remove tag #${escapeHtml(tag)}" aria-label="Remove tag #${escapeHtml(tag)}">×</button>
            </span>
          `).join('')}
          <div class="tag-input-inline-wrapper">
            <input
              type="text"
              id="input-inline-tag"
              class="tag-input-inline"
              placeholder="+ Add tag"
              list="counter-tag-suggestions"
              autocomplete="off"
              aria-label="Add tag"
            />
            <datalist id="counter-tag-suggestions">
              ${availableTags.map(t => `<option value="${escapeHtml(t)}"></option>`).join('')}
            </datalist>
          </div>
        </div>
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
          <div class="glass-stats-row">
            <span class="glass-total-volume">Total: <strong>${escapeHtml(totalDisplay)}</strong></span>
            <span class="glass-stats-divider">•</span>
            <span class="glass-abv">ABV: <strong>${escapeHtml(abvDisplay)}</strong></span>
          </div>
          ${(recipe.source || recipe.sourceUrl) ? `
            <div class="glass-source">
              Source: ${recipe.sourceUrl
        ? `<a href="${escapeHtml(recipe.sourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(recipe.source || 'Original Recipe')} ↗</a>`
        : `<strong>${escapeHtml(recipe.source)}</strong>`}
            </div>
          ` : ''}
          <div class="glass-interaction-tip">
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
        ${(recipe.description || recipe.source) ? /*html*/ `
          <div class="counter-card">
            <div class="counter-card-header">
              <span class="counter-card-title">About the Cocktail</span>
            </div>
            ${recipe.description ? /*html*/ `
              <p class="card-content-text card-description">
                ${escapeHtml(recipe.description)}
              </p>
            ` : ''}
            ${(recipe.source || recipe.sourceUrl) ? /*html*/ `
              <div class="card-source">
                Source: ${recipe.sourceUrl
          ? /*html*/ `<a href="${escapeHtml(recipe.sourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(recipe.source || 'Original Recipe')} ↗</a>`
          : /*html*/ `<strong>${escapeHtml(recipe.source)}</strong>`}
              </div>
            ` : ''}
          </div>
        ` : ''}

        <!-- Ingredients Specs Card -->
        <div class="counter-card">
          <div class="counter-card-header specs-card-header">
            <div class="specs-header-title-group">
              <span class="counter-card-title">Ingredients</span>
            </div>
            <div class="specs-header-controls">
              <div class="servings-stepper" role="group" aria-label="Servings counter">
                <span class="servings-label">Servings</span>
                <div class="servings-stepper-box">
                  <button type="button" id="btn-servings-dec" class="servings-btn" title="Decrease servings (step: 0.5)" aria-label="Decrease servings" ${currentServings <= 0.5 ? 'disabled' : ''}>−</button>
                  <span class="servings-value" id="servings-display">${currentServings}×</span>
                  <button type="button" id="btn-servings-inc" class="servings-btn" title="Increase servings (step: 0.5)" aria-label="Increase servings">+</button>
                </div>
              </div>
              <div class="unit-switch-group" role="group" aria-label="Measurement units">
                <button id="btn-unit-oz" class="unit-btn ${state.unitSystem === 'oz' ? 'active' : ''}">OZ</button>
                <button id="btn-unit-ml" class="unit-btn ${state.unitSystem === 'ml' ? 'active' : ''}">ML</button>
              </div>
            </div>
          </div>

          <div class="specs-list" id="counter-specs-list">
            ${specsListHtml}
          </div>
        </div>

        <!-- Preparation Directions -->
        ${(recipe.instructions || recipe.notes || recipe.method) ? /*html*/ `
          <div class="counter-card">
            <div class="counter-card-header">
              <span class="counter-card-title">Preparation</span>
            </div>
            <div class="card-content-text card-instructions">${escapeHtml(
            recipe.instructions ||
            (recipe.notes ? `${recipe.method ? `${recipe.method}: ` : ''}${recipe.notes}` : `${recipe.method || 'Standard'}: Standard build and chill.`)
          )}</div>
          </div>
        ` : ''}

        <!-- Additional Notes & Variations (only when unique from both instructions and notes-as-preparation) -->
        ${(() => {
      if (!recipe.notes || !recipe.notes.trim()) return '';
      // If the recipe has no dedicated instructions field, recipe.notes is already shown in the Preparation card above
      if (!recipe.instructions || !recipe.instructions.trim()) return '';
      const notesText = recipe.notes.trim();
      const instrText = recipe.instructions.trim();
      if (notesText.toLowerCase() === instrText.toLowerCase()) return '';
      if (instrText.toLowerCase().includes(notesText.toLowerCase())) return '';
      if (
        (notesText.toLowerCase().includes('build over') && instrText.toLowerCase().includes('large ice cube')) ||
        (notesText.toLowerCase().includes('stir with cracked ice') && instrText.toLowerCase().includes('stir for')) ||
        (notesText.toLowerCase().includes('stir thoroughly') && instrText.toLowerCase().includes('stir'))
      ) {
        return '';
      }
      return /*html*/ `
            <div class="counter-card">
              <div class="counter-card-header">
                <span class="counter-card-title">Notes & Variations</span>
              </div>
              <p class="card-content-text">
                ${escapeHtml(notesText)}
              </p>
            </div>
          `;
    })()}

      </div>
    </div>

    <!-- Bottle Next Recommendation Card -->
    ${(invAnalysis.isBottleNext && invAnalysis.missingItems.length === 1) ? `
      <div class="counter-card bottle-next-banner">
        <div class="bottle-next-banner-content">
          <div class="bottle-next-text">
            <span class="bottle-next-kicker">Missing from Backbar</span>
            <div class="bottle-next-desc">
              Have a bottle of <strong>${escapeHtml(invAnalysis.missingItems[0].name)}</strong>? Add it to mark ${escapeHtml(recipe.name)} ready to make.
            </div>
          </div>
          <button type="button" class="btn btn-secondary btn-sm btn-quick-add-bottle" data-bottle-id="${escapeHtml(invAnalysis.missingItems[0].id)}" title="Add ${escapeHtml(invAnalysis.missingItems[0].name)} to your bar">
            + In Stock
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
      id: undefined,
      name: newName,
      description: recipe.description
        ? `${recipe.description}\n\nRiff on ${recipe.name}: substituted ${swapped.map(s => `${s.originalName} with ${s.name}`).join(', ')}.`
        : `Riff on ${recipe.name}: substituted ${swapped.map(s => `${s.originalName} with ${s.name}`).join(', ')}.`,
      riffOfId: recipe.id,
      riffOfName: recipe.name,
      tags: Array.isArray(recipe.tags) ? [...recipe.tags, 'riff'] : ['riff'],
      specs: effectiveSpecs.map(s => ({
        amount: s.amount,
        unit: s.unit,
        name: s.name,
        ...(s.abv ? { abv: s.abv } : {}),
      })),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const saved = saveRecipe(newRecipe);
    state.recipes = getRecipes();
    state.activeRiffs = {};
    selectRecipe(saved.id);
    showToast(`Saved new riff: ${newName}`);
  });

  // Apply header substitute recommendation
  document.getElementById('btn-apply-header-sub')?.addEventListener('click', (e) => {
    e.stopPropagation();
    const btn = e.currentTarget;
    const missingName = btn.getAttribute('data-missing-name');
    const subId = btn.getAttribute('data-sub-id');
    const subName = btn.getAttribute('data-sub-name');
    if (!subId) return;

    const specIndex = (recipe.specs || []).findIndex(s => {
      const stock = checkIngredientStock(s.name, state.inventory);
      return (stock.name && missingName && stock.name.toLowerCase() === missingName.toLowerCase()) ||
        (s.name && missingName && s.name.toLowerCase() === missingName.toLowerCase());
    });

    if (specIndex >= 0) {
      state.activeRiffs[specIndex] = subId;
      renderCounterView();
      showToast(`Substituted ${missingName} with ${subName}`);
    }
  });

  // Apply ingredient row substitute chip
  elements.counterViewContainer.querySelectorAll('[data-action="apply-sub"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const specIndex = parseInt(btn.getAttribute('data-spec-index'), 10);
      const subId = btn.getAttribute('data-sub-id');
      const subName = btn.getAttribute('data-sub-name');
      const origName = recipe.specs[specIndex]?.name || 'ingredient';
      if (!isNaN(specIndex) && subId) {
        state.activeRiffs[specIndex] = subId;
        renderCounterView();
        showToast(`Substituted ${origName} with ${subName}`);
      }
    });
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
  document.getElementById('btn-servings-dec')?.addEventListener('click', () => {
    const current = state.servings || 1;
    if (current > 0.5) {
      state.servings = Math.round((current - 0.5) * 10) / 10;
      renderCounterView();
    }
  });

  document.getElementById('btn-servings-inc')?.addEventListener('click', () => {
    const current = state.servings || 1;
    if (current < 20) {
      state.servings = Math.round((current + 0.5) * 10) / 10;
      renderCounterView();
    }
  });

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
    if (window.location.hash) {
      history.pushState(null, '', window.location.pathname + window.location.search);
    }
  });

  // Counter View: Inline tag addition
  const inlineTagInput = document.getElementById('input-inline-tag');
  const addTagToCurrentRecipe = (rawTag) => {
    if (!rawTag) return;
    const cleanTag = rawTag.trim().toLowerCase().replace(/^#+/, '');
    if (!cleanTag) return;

    const currentTags = Array.isArray(recipe.tags) ? [...recipe.tags] : [];
    if (currentTags.includes(cleanTag)) {
      if (inlineTagInput) inlineTagInput.value = '';
      return;
    }

    const updatedTags = [...currentTags, cleanTag];
    const updatedRecipe = { ...recipe, tags: updatedTags };
    saveRecipe(updatedRecipe);
    state.recipes = getRecipes();
    renderRecipeList();
    renderCounterView();
    showToast(`Added #${cleanTag} to ${recipe.name}`);
  };

  if (inlineTagInput) {
    inlineTagInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        addTagToCurrentRecipe(inlineTagInput.value);
      }
    });

    inlineTagInput.addEventListener('change', () => {
      addTagToCurrentRecipe(inlineTagInput.value);
    });
  }

  // Remove tag button
  elements.counterViewContainer.querySelectorAll('.drink-tag-remove').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const tagToRemove = btn.getAttribute('data-tag');
      if (!tagToRemove) return;

      const currentTags = Array.isArray(recipe.tags) ? [...recipe.tags] : [];
      const updatedTags = currentTags.filter(t => t !== tagToRemove);
      const updatedRecipe = { ...recipe, tags: updatedTags };
      saveRecipe(updatedRecipe);
      state.recipes = getRecipes();
      renderRecipeList();
      renderCounterView();
      showToast(`Removed #${tagToRemove}`);
    });
  });

  // Click tag text to filter library
  elements.counterViewContainer.querySelectorAll('[data-action="filter-tag"]').forEach(tagEl => {
    const handleFilter = (e) => {
      e.stopPropagation();
      const tag = tagEl.getAttribute('data-tag');
      if (tag) filterByTag(tag);
    };
    tagEl.addEventListener('click', handleFilter);
    tagEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleFilter(e);
      }
    });
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
    tags: [],
    specs: [
      { amount: 2, unit: 'oz', name: '' },
      { amount: 0.75, unit: 'oz', name: '' },
    ],
  };

  state.editorSpecs = (currentData.specs || []).map(s => ({ ...s }));
  state.editorTags = Array.isArray(currentData.tags) ? [...currentData.tags] : [];

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
            placeholder="Paste ingredient lines, such as:&#10;1.5 oz Scotch&#10;0.5 oz Mezcal&#10;0.75 oz Lime Juice&#10;0.75 oz Orgeat&#10;2 dashes Celery Bitters&#10;&#10;Add preparation steps and writeup in the sections below."
          ></textarea>
          <div style="display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 0.5rem;">
            <button type="button" id="btn-clear-paste" class="btn btn-ghost btn-sm">Clear Box</button>
            <button type="button" id="btn-apply-paste" class="btn btn-secondary btn-sm">Apply Pasted Specs</button>
          </div>
        </div>

        <!-- Recipe Core Fields -->
        <div class="form-group">
          <label class="form-label" for="edit-name">Cocktail Name</label>
          <input type="text" id="edit-name" class="form-input" value="${escapeHtml(currentData.name)}" placeholder="Sea Legs" required>
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
          <input type="text" id="edit-garnish" class="form-input" value="${escapeHtml(currentData.garnish)}" placeholder="Lime wheel, orange twist, etc.">
        </div>

        <!-- Tags & Custom Lists -->
        <div class="form-group">
          <label class="form-label" for="editor-tag-input">Tags & Custom Lists</label>
          <div class="editor-tags-box">
            <div id="editor-tags-list" class="editor-tags-list"></div>
            <div class="editor-tag-input-row">
              <input
                type="text"
                id="editor-tag-input"
                class="form-input editor-tag-input-field"
                placeholder="Type a tag name and press Enter..."
                list="editor-tag-suggestions"
                autocomplete="off"
              />
              <button type="button" id="btn-add-editor-tag" class="btn btn-secondary btn-sm">+ Add Tag</button>
              <datalist id="editor-tag-suggestions"></datalist>
            </div>
          </div>
          <div class="field-hint" style="font-size: 0.75rem; color: var(--color-text-muted); margin-top: 0.35rem;">
            Assign arbitrary tags to group drinks into menus, moods, or favorites.
          </div>
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
          <textarea id="edit-instructions" class="form-textarea" rows="4" placeholder="Combine all ingredients in a shaker with ice. Shake until cold and diluted. Strain over fresh ice into a rocks glass.">${escapeHtml(currentData.instructions || currentData.notes || '')}</textarea>
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
            <input type="text" id="edit-source" class="form-input" value="${escapeHtml(currentData.source || '')}" placeholder="Elevated Craft / Alejandro Olivares">
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
  renderEditorTagChips();
  updateEditorTagSuggestions();
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
          placeholder="Ingredient name (Bourbon, Campari, etc.)"
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
 * Render editor tag chips
 */
function renderEditorTagChips() {
  const container = document.getElementById('editor-tags-list');
  if (!container) return;

  if (state.editorTags.length === 0) {
    container.innerHTML =  /*html*/`<span class="editor-tags-empty">No tags added yet</span>`;
    return;
  }

  container.innerHTML =  /*html*/state.editorTags.map(t => `
    <span class="editor-tag-chip" data-tag="${escapeHtml(t)}">
      <span>#${escapeHtml(t)}</span>
      <button type="button" class="btn-remove-tag" data-action="remove-editor-tag" data-tag="${escapeHtml(t)}" title="Remove tag #${escapeHtml(t)}" aria-label="Remove tag #${escapeHtml(t)}">×</button>
    </span>
  `).join('');

  container.querySelectorAll('[data-action="remove-editor-tag"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const tag = btn.getAttribute('data-tag');
      state.editorTags = state.editorTags.filter(t => t !== tag);
      renderEditorTagChips();
      updateEditorTagSuggestions();
    });
  });
}

/**
 * Update editor tag datalist suggestions with unassigned unique tags
 */
function updateEditorTagSuggestions() {
  const datalist = document.getElementById('editor-tag-suggestions');
  if (!datalist) return;

  const allTags = getAllUniqueTags(state.recipes);
  const available = allTags.filter(t => !state.editorTags.includes(t));
  datalist.innerHTML =  /*html*/available.map(t => `<option value="${escapeHtml(t)}"></option>`).join('');
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

  // Editor Tags management
  const editorTagInput = document.getElementById('editor-tag-input');
  const addEditorTag = () => {
    if (!editorTagInput) return;
    const raw = editorTagInput.value.trim().toLowerCase().replace(/^#+/, '');
    if (!raw) return;

    if (!state.editorTags.includes(raw)) {
      state.editorTags.push(raw);
      renderEditorTagChips();
      updateEditorTagSuggestions();
    }
    editorTagInput.value = '';
  };

  document.getElementById('btn-add-editor-tag')?.addEventListener('click', addEditorTag);

  editorTagInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addEditorTag();
    }
  });

  editorTagInput?.addEventListener('change', () => {
    addEditorTag();
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
      ? `ABV: ${rounded}%`
      : 'Non-Alcoholic';
  }
}

/**
 * Cancel editing and return to counter view
 */
function cancelEditor() {
  state.editorTags = [];
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
    tags: state.editorTags,
    riffOfId: existingRecipe?.riffOfId || undefined,
    riffOfName: existingRecipe?.riffOfName || undefined,
    specs: validSpecs,
  };

  const saved = saveRecipe(recipeToSave);
  state.editorTags = [];
  state.recipes = getRecipes();
  selectRecipe(saved.id);
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
    tags: Array.isArray(recipe.tags) ? [...recipe.tags] : [],
  };

  const saved = saveRecipe(copy);
  state.recipes = getRecipes();
  selectRecipe(saved.id);
  showToast(`Created duplicate: "${saved.name}"`);
}

/**
 * Confirm and delete a recipe
 */
function confirmDeleteRecipe(recipe) {
  if (confirm(`Delete "${recipe.name}" from your vault? This cannot be undone.`)) {
    const updated = deleteRecipe(recipe.id);
    state.recipes = updated;
    if (state.recipes.length > 0) {
      selectRecipe(state.recipes[0].id);
    } else {
      state.activeRecipeId = null;
      history.replaceState(null, '', window.location.pathname);
      try {
        localStorage.removeItem('speakeasy_last_active_recipe');
      } catch {
        // Ignore
      }
      renderRecipeList();
      renderCurrentView();
    }
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
