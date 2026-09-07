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
  getUnitPreference,
  saveUnitPreference,
  getGlassViewPreference,
  saveGlassViewPreference,
  getBarName,
  saveBarName,
  SEED_RECIPES,
  normalizeTagName,
  getPinnedTags,
  savePinnedTags,
  getSortPreference,
  saveSortPreference,
  getRecentlyViewed,
  recordRecentlyViewed,
  getHiddenRecipeIds,
  hideRecipe,
  unhideRecipe,
  unhideAllRecipes,
  isRecipeHidden,
} from './js/modules/storage.js';

const SEED_RECIPE_IDS = new Set(SEED_RECIPES.map(r => r.id));

import {
  parseSpecsBlock,
  formatFraction,
  parseMethodContent,
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
  REFRIGERATED_INGREDIENT_IDS,
  getIngredientMetadata,
} from './js/modules/taxonomy.js';

// Application State
const state = {
  recipes: [],
  activeRecipeId: null,
  activeRiffs: {}, // { [specIndex]: substituteTaxonomyId }
  riffModeActive: false,
  searchQuery: '',
  viewMode: 'counter', // 'home' | 'counter' | 'edit'
  pinnedTags: getPinnedTags(),
  unitSystem: getUnitPreference(), // 'oz' | 'ml'
  glassViewMode: getGlassViewPreference(), // 'layered' | 'blended'
  servings: 1, // Serving multiplier (default 1, increments by 0.5)
  editorSpecs: [],
  editorTags: [],
  glassViewMain: null,
  glassViewEditor: null,
  inventory: new Set(getInventory()),
  inventoryFilter: 'all', // 'all' | 'can_make' | 'one_missing'
  sortPreference: getSortPreference(), // 'curated' | 'name-asc' | 'name-desc' | 'ready' | 'specs-asc'
  packFilter: 'all', // 'all' | 'classic' | 'modern-craft' | 'tropical-tiki' | 'prohibition-era' | 'aperitivo-amaro' | 'nightcaps'
  backbarSearchQuery: '',
  backbarCategoryFilter: 'all', // 'all' | categoryKey | 'fridge'
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
  btnPopoverNewDrink: document.getElementById('btn-popover-new-drink'),
  btnExportJson: document.getElementById('btn-export-json'),
  btnImportTrigger: document.getElementById('btn-import-trigger'),
  importFileInput: document.getElementById('import-file-input'),
  btnVaultMenu: document.getElementById('btn-vault-menu'),
  vaultPopover: document.getElementById('vault-popover'),
  vaultBarNameInput: document.getElementById('vault-bar-name-input'),
  vaultStatsLine: document.getElementById('vault-stats-line'),
  popoverUnitOz: document.getElementById('popover-unit-oz'),
  popoverUnitMl: document.getElementById('popover-unit-ml'),
  popoverGlassLayered: document.getElementById('popover-glass-layered'),
  popoverGlassBlended: document.getElementById('popover-glass-blended'),
  btnResetDefaults: document.getElementById('btn-reset-defaults'),
  counterViewContainer: document.getElementById('counter-view-container'),
  editorViewContainer: document.getElementById('editor-view-container'),
  homeViewContainer: document.getElementById('home-view-container'),
  btnGoHome: document.getElementById('btn-go-home'),
  btnFooterHome: document.getElementById('btn-footer-home'),
  desktopStickyTitle: document.getElementById('desktop-sticky-title'),
  desktopStickyName: document.getElementById('desktop-sticky-name'),
  toastContainer: document.getElementById('toast-container'),
  btnMyBar: document.getElementById('btn-my-bar'),
  myBarBadge: document.getElementById('my-bar-badge'),
  sidebarPackFilter: document.getElementById('sidebar-pack-filter'),
  sidebarInventoryFilter: document.getElementById('sidebar-inventory-filter'),
  sidebarSortSelect: document.getElementById('sidebar-sort-select'),
  countAll: document.getElementById('count-all'),
  countCanMake: document.getElementById('count-can-make'),
  countOneMissing: document.getElementById('count-one-missing'),
  backbarModal: document.getElementById('backbar-modal'),
  backbarSearchInput: document.getElementById('backbar-search-input'),
  backbarNavTabs: document.getElementById('backbar-nav-tabs'),
  backbarCategoriesContainer: document.getElementById('backbar-categories-container'),
  backbarSummaryText: document.getElementById('backbar-summary-text'),
  btnStarterBar: document.getElementById('btn-starter-bar'),
  btnClearBar: document.getElementById('btn-clear-bar'),
  btnCloseBackbar: document.getElementById('btn-close-backbar'),
  btnDoneBackbar: document.getElementById('btn-done-backbar'),
  btnManageHidden: document.getElementById('btn-manage-hidden'),
  vaultHiddenSub: document.getElementById('vault-hidden-sub'),
  hiddenRecipesModal: document.getElementById('hidden-recipes-modal'),
  hiddenRecipesContainer: document.getElementById('hidden-recipes-container'),
  btnCloseHiddenModal: document.getElementById('btn-close-hidden-modal'),
  btnDoneHiddenModal: document.getElementById('btn-done-hidden-modal'),
  btnUnhideAll: document.getElementById('btn-unhide-all'),
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

  // A hash that resolves to a real recipe is a deep link: land straight on that recipe.
  // Otherwise, land on Home rather than always defaulting to the top of the library.
  const deepLinkedToRecipe = Boolean(urlHash && state.recipes.some(r => r.id === urlHash));

  if (!initialId && state.recipes.length > 0) {
    initialId = state.recipes[0].id;
  }

  state.activeRecipeId = initialId;
  state.viewMode = deepLinkedToRecipe ? 'counter' : 'home';
  // If a specific recipe was requested via hash, keep it in sync; otherwise do not force a hash onto a clean URL
  if (urlHash && initialId && deepLinkedToRecipe) {
    history.replaceState(null, '', `#${initialId}`);
  }

  // On mobile screens, Home and the recipe stage both live in the main-stage pane,
  // so either way start there; the drink list is reached from within Home/back-nav.
  const isMobile = window.innerWidth <= 768;
  if (isMobile) {
    elements.sidebar.classList.add('mobile-hidden');
    elements.mainStage.classList.remove('mobile-hidden');
  }

  setupGlobalEventListeners();
  setupBackbarEventListeners();
  setupHiddenModalEventListeners();
  updateMyBarBadge();
  renderRecipeList();
  renderCurrentView();

  // Initialize Vault Settings Popover values
  if (elements.popoverUnitOz && elements.popoverUnitMl) {
    elements.popoverUnitOz.classList.toggle('active', state.unitSystem === 'oz');
    elements.popoverUnitMl.classList.toggle('active', state.unitSystem === 'ml');
  }
  if (elements.popoverGlassLayered && elements.popoverGlassBlended) {
    elements.popoverGlassLayered.classList.toggle('active', state.glassViewMode === 'layered');
    elements.popoverGlassBlended.classList.toggle('active', state.glassViewMode === 'blended');
  }
  if (elements.vaultBarNameInput) {
    elements.vaultBarNameInput.value = getBarName();
  }
  updateVaultStats();

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

  // Header & Footer Home Actions
  elements.btnGoHome?.addEventListener('click', () => {
    goHome();
  });

  elements.btnFooterHome?.addEventListener('click', () => {
    goHome();
  });

  elements.btnNewDrink.addEventListener('click', () => {
    openEditor(null);
  });

  elements.btnPopoverNewDrink?.addEventListener('click', () => {
    if (elements.vaultPopover?.hidePopover) {
      try {
        elements.vaultPopover.hidePopover();
      } catch (err) {
        // Ignore if already hidden
      }
    }
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

  // Sidebar Sort Select
  if (elements.sidebarSortSelect) {
    elements.sidebarSortSelect.value = state.sortPreference;
    elements.sidebarSortSelect.addEventListener('change', (e) => {
      setLibrarySort(e.target.value);
    });
  }

  // Vault Menu Popover Controls
  elements.popoverUnitOz?.addEventListener('click', () => {
    setUnitSystem('oz');
  });

  elements.popoverUnitMl?.addEventListener('click', () => {
    setUnitSystem('ml');
  });

  elements.popoverGlassLayered?.addEventListener('click', () => {
    setGlassViewMode('layered');
  });

  elements.popoverGlassBlended?.addEventListener('click', () => {
    setGlassViewMode('blended');
  });

  elements.vaultBarNameInput?.addEventListener('change', (e) => {
    const newName = saveBarName(e.target.value);
    e.target.value = newName;
    if (state.viewMode === 'home') {
      renderHomeView();
    }
    showToast('Bar name updated');
  });

  elements.vaultBarNameInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      elements.vaultBarNameInput.blur();
    }
  });

  elements.btnResetDefaults?.addEventListener('click', () => {
    if (confirm('Reset all cocktails to the default library? Custom recipe modifications will be replaced.')) {
      state.recipes = resetToDefaults();
      renderRecipeList();
      if (state.recipes.length > 0) {
        selectRecipe(state.recipes[0].id, false);
      }
      updateVaultStats();
      updateMyBarBadge();
      elements.vaultPopover?.hidePopover?.();
      showToast('Vault reset to default cocktail library');
    }
  });

  // URL Hash routing: handle browser Back / Forward buttons and manual hash edits
  window.addEventListener('hashchange', () => {
    const rawHash = window.location.hash.replace(/^#+/, '').trim();
    if (!rawHash) {
      // User navigated back past the last recipe (or cleared the hash manually): land on Home
      if (state.viewMode !== 'home') {
        state.viewMode = 'home';
        renderRecipeList();
        renderCurrentView();
      }
      elements.sidebar.classList.add('mobile-hidden');
      elements.mainStage.classList.remove('mobile-hidden');
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
  { key: 'fortified_wine', title: 'Vermouth & Wines' },
  { key: 'liqueurs', title: 'Liqueurs & Amari' },
  { key: 'bitters', title: 'Bitters & Tinctures' },
  { key: 'sweeteners', title: 'Syrups & Sweeteners' },
  { key: 'produce', title: 'Fresh Produce & Juices' },
  { key: 'mixers', title: 'Mixers & Sodas' },
];

/**
 * Update vault stats line in Settings popover
 */
function updateVaultStats() {
  const hiddenCount = getHiddenRecipeIds().length;
  if (elements.btnManageHidden) {
    elements.btnManageHidden.style.display = hiddenCount > 0 ? '' : 'none';
  }
  if (elements.vaultHiddenSub) {
    elements.vaultHiddenSub.textContent = hiddenCount === 1 ? '1 drink hidden' : `${hiddenCount} drinks hidden`;
  }
  if (!elements.vaultStatsLine) return;
  const customCount = state.recipes.filter(r => !SEED_RECIPE_IDS.has(r.id)).length;
  const cocktailText = customCount === 1 ? '1 custom cocktail' : `${customCount} custom cocktails`;
  const bottleCount = state.inventory.size;
  const bottleText = bottleCount === 1 ? '1 ingredient' : `${bottleCount} ingredients`;
  elements.vaultStatsLine.textContent = `${cocktailText} · ${bottleText}`;
}

/**
 * Set volumetric unit system across app and persist choice
 */
function setUnitSystem(unit) {
  if (unit !== 'oz' && unit !== 'ml') return;
  state.unitSystem = unit;
  saveUnitPreference(unit);

  if (elements.popoverUnitOz && elements.popoverUnitMl) {
    elements.popoverUnitOz.classList.toggle('active', unit === 'oz');
    elements.popoverUnitMl.classList.toggle('active', unit === 'ml');
  }

  if (state.viewMode === 'counter' && state.activeRecipeId) {
    renderCounterView();
  }

  showToast(`Units switched to ${unit === 'oz' ? 'Ounces (oz)' : 'Milliliters (ml)'}`);
}

/**
 * Set default glass view mode (layered vs blended) and persist choice
 */
function setGlassViewMode(mode) {
  if (mode !== 'layered' && mode !== 'blended') return;
  if (state.glassViewMode === mode) return; // Already in requested mode
  state.glassViewMode = mode;
  saveGlassViewPreference(mode);

  if (elements.popoverGlassLayered && elements.popoverGlassBlended) {
    elements.popoverGlassLayered.classList.toggle('active', mode === 'layered');
    elements.popoverGlassBlended.classList.toggle('active', mode === 'blended');
  }

  if (state.glassViewMain) {
    state.glassViewMain.setMode(mode);
  }

  const toggleBtns = elements.counterViewContainer?.querySelectorAll('.glass-view-btn');
  toggleBtns?.forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-mode') === mode);
  });

  showToast(`Glass view switched to ${mode === 'blended' ? 'Mixed Color' : 'Layered Specs'}`);
}

/**
 * Set library list sort preference, persist to storage, and re-render sidebar
 */
function setLibrarySort(sortOption) {
  if (state.sortPreference === sortOption) return;
  state.sortPreference = sortOption;
  saveSortPreference(sortOption);

  if (elements.sidebarSortSelect && elements.sidebarSortSelect.value !== sortOption) {
    elements.sidebarSortSelect.value = sortOption;
  }

  renderRecipeList();

  const labels = {
    'curated': 'Curated',
    'ready': 'Ready to Make',
    'specs-asc': 'Fewest Ingredients',
    'name-asc': 'Alphabetical (A–Z)',
  };
  const label = labels[sortOption] || 'Selected';
  showToast(`Sorted by ${label}`);
}

/**
 * Update header badge and modal inventory summary, and sync action button states
 */
function updateMyBarBadge() {
  const count = state.inventory.size;
  if (elements.myBarBadge) {
    elements.myBarBadge.textContent = count;
  }
  if (elements.backbarSummaryText) {
    elements.backbarSummaryText.textContent = `${count} ${count === 1 ? 'bottle' : 'bottles'} in your backbar`;
  }
  updateBackbarActionButtons();
  updateVaultStats();
}

/**
 * Dynamically manage disabled state and helpful tooltips for Starter Bar and Clear All buttons
 */
function updateBackbarActionButtons() {
  const count = state.inventory.size;

  if (elements.btnClearBar) {
    const hasBottles = count > 0;
    elements.btnClearBar.disabled = !hasBottles;
    elements.btnClearBar.setAttribute('aria-disabled', !hasBottles ? 'true' : 'false');
    elements.btnClearBar.title = hasBottles
      ? 'Clear all bottles from your backbar'
      : 'No bottles in backbar to clear';
  }

  if (elements.btnStarterBar) {
    const hasAllStarter = DEFAULT_STARTER_BAR.every(id => state.inventory.has(id));
    elements.btnStarterBar.disabled = hasAllStarter;
    elements.btnStarterBar.setAttribute('aria-disabled', hasAllStarter ? 'true' : 'false');
    elements.btnStarterBar.title = hasAllStarter
      ? 'All starter essentials already in your backbar'
      : 'Add essential bar staples';
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

  // Category & Fridge Navigation Tabs inside Backbar Modal
  elements.backbarNavTabs?.querySelectorAll('.backbar-nav-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const filter = tab.getAttribute('data-cat-filter') || 'all';
      state.backbarCategoryFilter = filter;
      elements.backbarNavTabs.querySelectorAll('.backbar-nav-tab').forEach(t => {
        const isActive = t.getAttribute('data-cat-filter') === filter;
        t.classList.toggle('active', isActive);
        t.setAttribute('aria-selected', isActive ? 'true' : 'false');
      });
      renderBackbarModalContent();
    });
  });

  elements.btnStarterBar?.addEventListener('click', () => {
    const hasAllStarter = DEFAULT_STARTER_BAR.every(id => state.inventory.has(id));
    if (hasAllStarter) return;
    DEFAULT_STARTER_BAR.forEach(id => state.inventory.add(id));
    saveInventory(Array.from(state.inventory));
    updateMyBarBadge();
    renderRecipeList();
    if (state.viewMode === 'counter') {
      renderCounterView();
    } else if (state.viewMode === 'home') {
      renderHomeView();
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
      } else if (state.viewMode === 'home') {
        renderHomeView();
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

  // Sidebar themed pack filter pills
  elements.sidebarPackFilter?.querySelectorAll('.pack-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      const pack = btn.getAttribute('data-pack');
      state.packFilter = pack;
      elements.sidebarPackFilter.querySelectorAll('.pack-pill').forEach(b => {
        const isActive = b.getAttribute('data-pack') === pack;
        b.classList.toggle('active', isActive);
        b.setAttribute('aria-selected', isActive ? 'true' : 'false');
      });
      renderRecipeList();
    });
  });

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
 * Hidden Cocktails Modal Event Listeners & Management
 */
function setupHiddenModalEventListeners() {
  elements.btnManageHidden?.addEventListener('click', () => {
    if (elements.vaultPopover?.hidePopover) {
      try {
        elements.vaultPopover.hidePopover();
      } catch (err) {
        // Ignore if already closed
      }
    }
    openHiddenModal();
  });

  elements.btnCloseHiddenModal?.addEventListener('click', closeHiddenModal);
  elements.btnDoneHiddenModal?.addEventListener('click', closeHiddenModal);

  elements.btnUnhideAll?.addEventListener('click', () => {
    const hiddenCount = getHiddenRecipeIds().length;
    if (hiddenCount === 0) return;

    unhideAllRecipes();
    state.recipes = getRecipes();
    renderRecipeList();
    if (state.viewMode === 'counter') {
      renderCounterView();
    } else if (state.viewMode === 'home') {
      renderHomeView();
    }
    updateVaultStats();
    renderHiddenRecipesModal();
    showToast(`Restored all ${hiddenCount} hidden cocktails`);
  });

  // Light dismiss fallback for browsers without closedby="any"
  if (elements.hiddenRecipesModal && !('closedBy' in HTMLDialogElement.prototype)) {
    elements.hiddenRecipesModal.addEventListener('click', (event) => {
      if (event.target !== elements.hiddenRecipesModal) return;
      const rect = elements.hiddenRecipesModal.getBoundingClientRect();
      const isDialogContent = (
        rect.top <= event.clientY &&
        event.clientY <= rect.top + rect.height &&
        rect.left <= event.clientX &&
        event.clientX <= rect.left + rect.width
      );
      if (!isDialogContent) {
        closeHiddenModal();
      }
    });
  }
}

/**
 * Open Hidden Cocktails Modal
 */
function openHiddenModal() {
  renderHiddenRecipesModal();
  if (typeof elements.hiddenRecipesModal?.showModal === 'function') {
    elements.hiddenRecipesModal.showModal();
  }
}

/**
 * Close Hidden Cocktails Modal
 */
function closeHiddenModal() {
  if (typeof elements.hiddenRecipesModal?.close === 'function') {
    elements.hiddenRecipesModal.close();
  }
}

/**
 * Render contents of the Hidden Cocktails Modal
 */
function renderHiddenRecipesModal() {
  if (!elements.hiddenRecipesContainer) return;

  const hiddenIds = getHiddenRecipeIds();
  if (elements.btnUnhideAll) {
    elements.btnUnhideAll.style.display = hiddenIds.length > 0 ? '' : 'none';
  }

  if (hiddenIds.length === 0) {
    elements.hiddenRecipesContainer.innerHTML = /*html*/`
      <div class="hidden-empty-state">
        <span class="hidden-empty-title">No hidden cocktails</span>
        <p>Default recipes you hide from your library will appear here so you can restore them anytime.</p>
      </div>
    `;
    return;
  }

  // Resolve hidden seed recipe objects
  const hiddenDrinks = hiddenIds.map(id => {
    return SEED_RECIPES.find(s => s.id === id) || { id, name: id, glassware: '', method: '' };
  });

  elements.hiddenRecipesContainer.innerHTML = /*html*/hiddenDrinks.map(drink => {
    const subParts = [drink.glassware, drink.method].filter(Boolean).join(' · ');
    return /*html*/`
      <div class="hidden-recipe-row" data-id="${escapeHtml(drink.id)}">
        <div class="hidden-recipe-meta">
          <span class="hidden-recipe-name">${escapeHtml(drink.name)}</span>
          ${subParts ? `<span class="hidden-recipe-sub">${escapeHtml(subParts)}</span>` : ''}
        </div>
        <button type="button" class="btn btn-secondary btn-sm btn-action-unhide" data-id="${escapeHtml(drink.id)}" aria-label="Unhide ${escapeHtml(drink.name)}">
          Unhide
        </button>
      </div>
    `;
  }).join('');

  // Wire up individual Unhide action buttons
  elements.hiddenRecipesContainer.querySelectorAll('.btn-action-unhide').forEach(btn => {
    btn.addEventListener('click', () => {
      const drinkId = btn.getAttribute('data-id');
      if (!drinkId) return;
      const drinkObj = SEED_RECIPES.find(s => s.id === drinkId) || { id: drinkId, name: drinkId };
      unhideRecipe(drinkId);
      state.recipes = getRecipes();
      renderRecipeList();
      if (state.viewMode === 'counter') {
        renderCounterView();
      } else if (state.viewMode === 'home') {
        renderHomeView();
      }
      updateVaultStats();
      renderHiddenRecipesModal();
      showToast(`Restored "${drinkObj.name}" to library`);
    });
  });
}

/**
 * Open personal backbar modal
 */
function openBackbarModal() {
  state.backbarSearchQuery = '';
  state.backbarCategoryFilter = 'all';
  if (elements.backbarSearchInput) elements.backbarSearchInput.value = '';
  if (elements.backbarNavTabs) {
    elements.backbarNavTabs.querySelectorAll('.backbar-nav-tab').forEach(tab => {
      const isAll = tab.getAttribute('data-cat-filter') === 'all';
      tab.classList.toggle('active', isAll);
      tab.setAttribute('aria-selected', isAll ? 'true' : 'false');
    });
  }
  updateBackbarActionButtons();
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
  } else if (state.viewMode === 'home') {
    renderHomeView();
  }
  renderBackbarModalContent();
}

/**
 * Compute accessible high-contrast text color (#111111 vs #ffffff) for a hex background
 * using standard relative luminance formula (WCAG 2.1)
 */
function getContrastColor(hexColor) {
  if (!hexColor || typeof hexColor !== 'string') return '#111111';
  let hex = hexColor.replace('#', '').trim();
  if (hex.length === 3) {
    hex = hex.split('').map(c => c + c).join('');
  }
  if (hex.length !== 6) return '#111111';

  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;

  const toLinear = (c) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  const L = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);

  // Contrast against black (L=0): (L + 0.05) / 0.05
  // Contrast against white (L=1): 1.05 / (L + 0.05)
  return L > 0.35 ? '#111111' : '#ffffff';
}

/**
 * Render categories and item pills inside backbar modal
 */
function renderBackbarModalContent() {
  if (!elements.backbarCategoriesContainer) return;

  const query = (state.backbarSearchQuery || '').toLowerCase();
  const catFilter = state.backbarCategoryFilter || 'all';
  const allTaxonomyItems = Object.values(TAXONOMY);

  let totalVisibleBottles = 0;

  const sectionsHtml = BACKBAR_CATEGORIES.map(cat => {
    // If a specific category tab is selected (not 'all' and not 'fridge'), only show that category
    if (catFilter !== 'all' && catFilter !== 'fridge' && cat.key !== catFilter) {
      return '';
    }

    const items = allTaxonomyItems.filter(item => {
      if (item.parent !== cat.key) return false;

      // Fridge filter tab
      if (catFilter === 'fridge' && !REFRIGERATED_INGREDIENT_IDS.has(item.id)) {
        return false;
      }

      if (!query) return true;
      if (item.name.toLowerCase().includes(query)) return true;
      if (item.id.toLowerCase().includes(query)) return true;
      if (item.family && item.family.toLowerCase().includes(query)) return true;
      if (['fridge', 'refrigerated', 'refrigerate', 'chilled', 'chill'].includes(query) && REFRIGERATED_INGREDIENT_IDS.has(item.id)) return true;
      if ((item.aliases || []).some(a => a.toLowerCase().includes(query))) return true;
      return (item.brands || []).some(b => b.toLowerCase().includes(query));
    });

    if (items.length === 0) return '';
    totalVisibleBottles += items.length;

    const ownedCount = items.filter(i => state.inventory.has(i.id)).length;

    const pillsHtml = items.map(item => {
      const isOwned = state.inventory.has(item.id);
      const isFridge = REFRIGERATED_INGREDIENT_IDS.has(item.id);
      const bg = item.color || '#c67828';
      const textColor = getContrastColor(bg);
      return `
        <button type="button" class="backbar-pill ${isOwned ? 'active' : ''} ${isFridge ? 'is-fridge-item' : ''}" data-bottle-id="${escapeHtml(item.id)}" aria-pressed="${isOwned}" title="${isFridge ? `${escapeHtml(item.name)} (Keep refrigerated once opened)` : escapeHtml(item.name)}">
          <span class="backbar-pill-dot" style="background-color: ${bg}; color: ${textColor};">${isOwned ? '✓' : ''}</span>
          <span class="backbar-pill-name">${escapeHtml(item.name)}</span>
          ${isFridge ? '<span class="backbar-pill-fridge-tag" aria-label="Refrigerate" title="Keep refrigerated">❄️</span>' : ''}
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
    const matchesPack = state.packFilter === 'all' || (Array.isArray(recipe.tags) && recipe.tags.includes(state.packFilter));
    const invAnalysis = analyzeRecipeInventory(recipe, state.inventory);
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
  updateVaultStats();

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
        openEditor({ name: formattedName });
      });
    }
    return;
  }

  elements.recipeList.innerHTML =  /*html*/filtered.map(({ recipe, invAnalysis }) => {
    const isActive = state.viewMode === 'counter' && recipe.id === state.activeRecipeId;
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
 * Wire a text input to a small, app-styled autocomplete dropdown of tag suggestions.
 * Replaces native <input list> + <datalist>, which on mobile browsers renders as an
 * unstyled dropdown showing the *entire* unfiltered tag list rather than filtering as you type.
 *
 * @param {HTMLInputElement} inputEl - the text input
 * @param {HTMLElement} listEl - an empty <ul> positioned to appear below the input
 * @param {() => string[]} getSuggestions - returns the current pool of candidate tags
 * @param {(tag: string) => void} onPick - called with the chosen/typed tag; input is cleared after
 */
function setupTagAutocomplete(inputEl, listEl, getSuggestions, onPick) {
  if (!inputEl || !listEl) return;

  let matches = [];
  let activeIndex = -1;

  const close = () => {
    listEl.hidden = true;
    listEl.innerHTML = '';
    matches = [];
    activeIndex = -1;
  };

  const renderList = () => {
    const query = inputEl.value.trim().toLowerCase().replace(/^#+/, '');
    const pool = getSuggestions();
    // No result cap: the list scrolls (see .tag-suggest-list max-height), so truncating
    // here would silently hide entries below the fold with no way to reach them.
    matches = query ? pool.filter(t => t.includes(query)) : pool;

    if (!matches.length) {
      if (query) {
        listEl.hidden = false;
        listEl.innerHTML = `<li class="tag-suggest-item-empty">Press Enter to create "#${escapeHtml(query)}"</li>`;
      } else {
        close();
      }
      return;
    }

    listEl.innerHTML = matches.map((tag, i) => `
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
  recordRecentlyViewed(id);

  try {
    localStorage.setItem('speakeasy_last_active_recipe', id);
  } catch {
    // Ignore
  }

  if (updateHistory && window.location.hash !== `#${id}`) {
    history.pushState(null, '', `#${id}`);
  }

  // renderRecipeList() replaces the list's innerHTML, which resets scrollTop to 0 —
  // capture/restore it so a re-render never masquerades as "the user scrolled to
  // the top", which would make the visibility check below think the (possibly
  // still-visible) active item needs to be scrolled into view.
  const preservedScrollTop = elements.recipeList?.scrollTop || 0;
  renderRecipeList();
  if (elements.recipeList) {
    elements.recipeList.scrollTop = preservedScrollTop;
  }
  renderCurrentView();

  // Keep active item visible in sidebar without jarring jumps when clicked directly
  const activeEl = elements.recipeList.querySelector('.recipe-list-item.active');
  if (activeEl && elements.recipeList) {
    const listRect = elements.recipeList.getBoundingClientRect();
    const itemRect = activeEl.getBoundingClientRect();
    // Only scroll if the item is outside the visible bounds of the list
    if (itemRect.top < listRect.top || itemRect.bottom > listRect.bottom) {
      activeEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }

  // Mobile navigation adjustment
  elements.sidebar.classList.add('mobile-hidden');
  elements.mainStage.classList.remove('mobile-hidden');
  if (elements.mainStage) {
    elements.mainStage.scrollTop = 0;
  }
}

/**
 * Render active view based on state.viewMode
 */
function renderCurrentView() {
  if (state.viewMode === 'edit') {
    elements.homeViewContainer.style.display = 'none';
    elements.counterViewContainer.style.display = 'none';
    elements.editorViewContainer.style.display = 'block';
    elements.btnNewDrink.style.display = 'none';
  } else if (state.viewMode === 'home') {
    elements.editorViewContainer.style.display = 'none';
    elements.counterViewContainer.style.display = 'none';
    elements.homeViewContainer.style.display = 'block';
    elements.btnNewDrink.style.display = '';
    renderHomeView();
  } else {
    elements.homeViewContainer.style.display = 'none';
    elements.editorViewContainer.style.display = 'none';
    elements.counterViewContainer.style.display = 'block';
    elements.btnNewDrink.style.display = '';
    renderCounterView();
  }
}

/**
 * Navigate to the Home landing page
 */
function goHome() {
  state.viewMode = 'home';
  if (window.location.hash) {
    history.pushState(null, '', window.location.pathname + window.location.search);
  }
  renderRecipeList();
  renderCurrentView();

  // Mobile navigation: Home lives in the main-stage pane, same as a recipe or the editor
  elements.sidebar.classList.add('mobile-hidden');
  elements.mainStage.classList.remove('mobile-hidden');
  if (elements.mainStage) {
    elements.mainStage.scrollTop = 0;
  }
}

/**
 * Reveal the drink list (sidebar) on mobile, where Home/recipe/editor otherwise
 * occupy the entire screen
 */
function showDrinksListMobile() {
  elements.sidebar.classList.remove('mobile-hidden');
  elements.mainStage.classList.add('mobile-hidden');
}

// Curated Home collections. Each maps to an existing recipe tag; rows with no
// matching recipes are simply skipped, so this list can grow without upkeep.
const HOME_DEFAULT_COLLECTIONS = [
  { key: 'classic', title: 'Classic Cocktails' },
  { key: 'modern-craft', title: 'Modern Craft' },
  { key: 'tropical-tiki', title: 'Tropical & Tiki' },
  { key: 'prohibition-era', title: 'Prohibition Era' },
  { key: 'aperitivo-amaro', title: 'Aperitivo & Amaro' },
  { key: 'nightcaps', title: 'Nightcaps' },
  { key: 'gin-forward', title: 'Gin-Forward' },
  { key: 'whiskey-forward', title: 'Whiskey-Forward' },
  { key: 'rum-forward', title: 'Rum-Forward' },
];

function formatTagTitle(tag) {
  return tag.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

// Populated by renderHomeView() and read by the IntersectionObserver in
// setupHomeViewEvents() to lazily fill in each shelf's cards (see below).
let homeCollectionsCache = [];

/**
 * Render the Home landing page: bar stats + horizontally-scrolling collection shelves.
 * Shelf cards (which each render a full inline SVG glass) are lazy-hydrated on scroll
 * rather than all at once, so the initial paint stays fast regardless of library size.
 */
function renderHomeView() {
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
      <button type="button" id="btn-home-browse-all" class="btn btn-secondary btn-sm home-browse-all-btn">
        Browse All Drinks
      </button>
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

function renderHomeShelf(col, idx) {
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

function renderHomeCard(recipe, collectionKey, idx) {
  const invAnalysis = analyzeRecipeInventory(recipe, state.inventory);
  const specNames = (recipe.specs || []).map(s => s.name).filter(Boolean);
  return  /*html*/`
    <div class="similar-cocktail-card" data-recipe-id="${escapeHtml(recipe.id)}" role="button" tabindex="0">
      <div class="similar-card-glass">
        ${renderGlassSvg(recipe, `home-glass-${collectionKey}-${recipe.id}-${idx}`)}
      </div>
      <div class="similar-card-body">
        ${invAnalysis.canMake ? `<span class="similar-relation-badge badge-ready">Ready</span>` : ''}
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
function setupHomeViewEvents(pinnableTags) {
  const container = elements.homeViewContainer;
  if (!container) return;

  document.getElementById('btn-home-browse-all')?.addEventListener('click', () => {
    showDrinksListMobile();
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

  // Lazily hydrate each shelf's cards (each renders a full inline SVG glass) only once
  // it scrolls near the viewport, so an initial Home render never has to draw all of
  // them at once no matter how many collections/recipes exist.
  const hydrateShelf = (track) => {
    const idx = Number(track.dataset.shelfIdx);
    const col = homeCollectionsCache[idx];
    if (!col) return;

    track.innerHTML = col.recipes.map((recipe, i) => renderHomeCard(recipe, col.key, i)).join('');

    track.querySelectorAll('.similar-cocktail-card').forEach(el => {
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

/**
 * Render Counter View (optimized for high-contrast viewing on bar counter)
 */
function renderCounterView() {
  const recipe = state.recipes.find(r => r.id === state.activeRecipeId)
    || SEED_RECIPES.find(r => r.id === state.activeRecipeId);
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
  const isSeed = SEED_RECIPE_IDS.has(recipe.id);
  const isCurrentlyHidden = isRecipeHidden(recipe.id);

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
      stockControlHtml = '';
    } else if (stockStatus.inStock) {
      stockControlHtml = `<button type="button" class="btn-stock-toggle in-stock" data-bottle-id="${escapeHtml(stockStatus.id)}" title="In backbar inventory. Click to remove." aria-label="Remove ${escapeHtml(stockStatus.name)} from bar"><span class="stock-check-glyph">✓</span> In Bar</button>`;
    } else {
      stockControlHtml = `<button type="button" class="btn-stock-toggle out-of-stock" data-bottle-id="${escapeHtml(stockStatus.id)}" title="Missing from backbar. Click to add." aria-label="Add ${escapeHtml(stockStatus.name)} to bar">+ In Bar</button>`;
    }

    const ingMeta = getIngredientMetadata(currentStockName);
    const isFridgeItem = ingMeta?.isRefrigerated;

    return `
      <div class="spec-row ${isRiff ? 'is-riffed-row' : ''}" data-spec-index="${index}">
        <div class="spec-amount">
          ${amountText ? `${escapeHtml(amountText)}<span class="spec-unit">${escapeHtml(unitText)}</span>` : `<span class="spec-unit">${escapeHtml(unitText || 'to taste')}</span>`}
        </div>
        <div class="spec-ingredient">
          <div class="spec-ingredient-name-row">
            <span class="spec-name">${escapeHtml(spec.name)}</span>
            ${isFridgeItem ? `<span class="spec-fridge-tag" title="Keep refrigerated once opened">❄</span>` : ''}
            ${isRiff ? `<span class="spec-riff-badge" title="Substituted for ${escapeHtml(spec.originalName)}">sub</span>` : ''}
          </div>
          ${isRiff ? `<div class="spec-riff-orig-note">sub for ${escapeHtml(spec.originalName)}</div>` : ''}
          ${subSuggestionHtml}
        </div>
        ${riffControlHtml}
        <div class="spec-actions">
          ${stockControlHtml}
        </div>
      </div>
    `;
  }).join('');

  const garnishRowHtml = recipe.garnish ? `
    <div class="spec-row spec-garnish-row">
      <div class="spec-amount">
        <span class="spec-unit">Garnish</span>
      </div>
      <div class="spec-ingredient">
        <div class="spec-ingredient-name-row">
          <span class="spec-garnish-name">${escapeHtml(recipe.garnish)}</span>
        </div>
      </div>
      <div class="spec-actions"></div>
    </div>
  ` : '';

  elements.counterViewContainer.classList.toggle('riff-mode-active', state.riffModeActive);
  elements.counterViewContainer.innerHTML =  /*html*/`
    <!-- Mobile Back Navigation (hidden on desktop) -->
    <div class="counter-mobile-bar" id="counter-mobile-bar">
      <button id="btn-mobile-back" class="btn btn-secondary btn-sm mobile-back-btn" aria-label="Back to drinks list">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6"></polyline></svg>
        Drinks
      </button>
      <div class="mobile-sticky-title" id="mobile-sticky-title" aria-hidden="true">
        <span class="mobile-sticky-name">${escapeHtml(recipe.name)}</span>
      </div>
    </div>

    <!-- Drink Title & Meta Header -->
    <header class="drink-title-section">
      <div class="drink-title-row">
        <div class="drink-title-header-left">
          <h2 class="drink-name">${escapeHtml(recipe.name)}</h2>
          <!-- Editorial metadata line -->
          <div class="drink-meta-row">
            <span class="drink-meta-item">${escapeHtml(recipe.glassware || 'Glass')}</span>
            <span class="meta-dot-divider">·</span>
            <span class="drink-meta-item">${escapeHtml(recipe.method || 'Standard')}</span>
            <span class="meta-dot-divider">·</span>
            <span class="drink-meta-item" title="Dilution-adjusted estimated alcohol by volume">${escapeHtml(abvDisplay)}</span>
            ${lineage ? `
              <span class="meta-dot-divider">·</span>
              <span class="drink-meta-item drink-meta-riff">Riff on <em>${escapeHtml(lineage.parentName)}</em></span>
            ` : ''}
            ${invAnalysis.canMake ? `
              <span class="meta-dot-divider">·</span>
              <span class="meta-status-ready">Ready to Make</span>
            ` : ''}
          </div>
        </div>

        <!-- Quiet Action Toolbar -->
        <div class="drink-actions-cluster" role="toolbar" aria-label="Recipe actions">
          ${hasActiveRiffs ? `
            <button id="btn-reset-riff" class="btn btn-secondary btn-sm" title="Revert back to original cocktail specs">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="1 4 1 10 7 10"></polyline><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path></svg>
              Reset Riff
            </button>
            <button id="btn-save-riff" class="btn btn-primary btn-sm" title="Save this riff variation as a new cocktail">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
              Save Riff
            </button>
          ` : ''}

          <button id="btn-edit-drink" class="action-icon-btn" title="Edit recipe specs" aria-label="Edit recipe">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
            <span class="action-btn-text">Edit</span>
          </button>

          <button id="btn-duplicate-drink" class="action-icon-btn" title="Duplicate recipe" aria-label="Duplicate recipe">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
            <span class="action-btn-text">Duplicate</span>
          </button>

          ${isSeed ? `
            <button id="btn-hide-drink" class="action-icon-btn ${isCurrentlyHidden ? 'action-icon-btn-hidden' : ''}" title="${isCurrentlyHidden ? 'Hidden from your library (click to unhide)' : 'Hide from library'}" aria-label="${isCurrentlyHidden ? 'Unhide recipe' : 'Hide recipe'}">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                <line x1="1" y1="1" x2="23" y2="23"></line>
              </svg>
              <span class="action-btn-text">${isCurrentlyHidden ? 'Hidden' : 'Hide'}</span>
            </button>
          ` : `
            <button id="btn-delete-drink" class="action-icon-btn action-icon-btn-danger" title="Delete recipe" aria-label="Delete recipe">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
              <span class="action-btn-text">Delete</span>
            </button>
          `}
        </div>
      </div>

      <!-- Story / Description directly under title -->
      ${recipe.description ? `
        <p class="drink-description-prose">${escapeHtml(recipe.description)}</p>
      ` : ''}

      <!-- Prominent in-place status banner when recipe is currently hidden -->
      ${isCurrentlyHidden ? `
        <div class="drink-hidden-banner" role="status">
          <span class="drink-hidden-banner-text">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
              <line x1="1" y1="1" x2="23" y2="23"></line>
            </svg>
            This cocktail is currently <strong>Hidden</strong> from your library list.
          </span>
          <button type="button" class="btn-banner-unhide" id="btn-banner-unhide">Unhide Cocktail ↵</button>
        </div>
      ` : ''}

      <!-- Contextual substitution notice when applicable -->
      ${(invAnalysis.canMakeWithSubs && invAnalysis.missingWithSub && invAnalysis.bestSubstitute) ? `
        <div class="drink-sub-banner">
          <span>Makeable with bar swap: use <strong>${escapeHtml(invAnalysis.bestSubstitute.name)}</strong> for ${escapeHtml(invAnalysis.missingWithSub.name)}</span>
          <button type="button" class="btn-sub-apply-link" id="btn-apply-header-sub" data-missing-name="${escapeHtml(invAnalysis.missingWithSub.name)}" data-sub-id="${escapeHtml(invAnalysis.bestSubstitute.id)}" data-sub-name="${escapeHtml(invAnalysis.bestSubstitute.name)}">Apply Swap ↵</button>
        </div>
      ` : ''}
    </header>

    <!-- Main Counter Grid: Vector Glass on Left, Specs and Details on Right -->
    <div class="counter-grid">
      <!-- Left Column: Glass Illustration -->
      <div class="glass-column">
        <div class="glass-wrapper" id="glass-wrapper">
          <!-- Rendered via GlassView -->
        </div>

        <!-- Glass Presentation Mode Switch: Layers vs Blended -->
        <div class="glass-view-toggle-wrap">
          <div class="glass-view-toggle" role="group" aria-label="Cocktail presentation mode">
            <button type="button" class="glass-view-btn ${state.glassViewMode === 'layered' ? 'active' : ''}" data-mode="layered" title="View ingredient fluid ratio layers">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <line x1="3" y1="12" x2="21" y2="12"></line>
                <line x1="3" y1="18" x2="21" y2="18"></line>
              </svg>
              <span>Layers</span>
            </button>
            <button type="button" class="glass-view-btn ${state.glassViewMode === 'blended' ? 'active' : ''}" data-mode="blended" title="View blended cocktail color">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="9"></circle>
                <path d="M12 3a9 9 0 0 1 9 9 9 9 0 0 1-9 9"></path>
              </svg>
              <span>Mixed</span>
            </button>
          </div>
        </div>

        <div class="glass-meta-card">
          <div class="glass-stats-row">
            <span class="glass-total-volume">${escapeHtml(totalDisplay)}</span>
            <span class="glass-stats-divider">·</span>
            <span class="glass-abv">${escapeHtml(abvDisplay)}</span>
          </div>
        </div>

        <button id="btn-toggle-riff-mode" class="btn ${state.riffModeActive ? 'btn-primary' : 'btn-secondary'} btn-sm riff-toggle-btn" title="Toggle ingredient substitution menus">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
          ${state.riffModeActive ? 'Done Riffing' : 'Make a Riff'}
        </button>
      </div>

      <!-- Right Column: Specs Table, Method & Notes -->
      <div class="specs-column">

        <!-- Ingredients Specs -->
        <div class="recipe-editorial-section">
          <div class="editorial-section-header">
            <h3 class="editorial-section-title">Ingredients</h3>
            <div class="specs-header-controls">
              <div class="servings-stepper" role="group" aria-label="Servings counter">
                <span class="servings-label">Serves</span>
                <div class="servings-stepper-box">
                  <button type="button" id="btn-servings-dec" class="servings-btn" title="Decrease servings (step: 0.5)" aria-label="Decrease servings" ${currentServings <= 0.5 ? 'disabled' : ''}>−</button>
                  <span class="servings-value" id="servings-display">${currentServings}×</span>
                  <button type="button" id="btn-servings-inc" class="servings-btn" title="Increase servings (step: 0.5)" aria-label="Increase servings">+</button>
                </div>
              </div>
            </div>
          </div>

          <div class="specs-list" id="counter-specs-list">
            ${specsListHtml}
            ${garnishRowHtml}
          </div>
        </div>

        <!-- Method Section -->
        ${(() => {
      const rawMethodText = recipe.instructions ||
        (recipe.notes ? `${recipe.method ? `${recipe.method}: ` : ''}${recipe.notes}` : `${recipe.method || 'Standard'}: Standard build and chill.`);
      if (!rawMethodText || !rawMethodText.trim()) return '';

      const parsed = parseMethodContent(rawMethodText);
      let methodBodyHtml = '';

      if (parsed.type === 'ordered') {
        methodBodyHtml = /*html*/ `
              <ol class="card-method-list card-method-ordered">
                ${parsed.items.map(item => `<li><span>${escapeHtml(item)}</span></li>`).join('')}
              </ol>
            `;
      } else if (parsed.type === 'unordered') {
        methodBodyHtml = /*html*/ `
              <ul class="card-method-list card-method-unordered">
                ${parsed.items.map(item => `<li><span>${escapeHtml(item)}</span></li>`).join('')}
              </ul>
            `;
      } else {
        methodBodyHtml = /*html*/ `
              <div class="card-content-text card-instructions">${escapeHtml(rawMethodText)}</div>
            `;
      }

      return /*html*/ `
            <div class="recipe-editorial-section">
              <h3 class="editorial-section-title">Method</h3>
              ${methodBodyHtml}
            </div>
          `;
    })()}

        <!-- Additional Notes (if distinct from instructions) -->
        ${(() => {
      if (!recipe.notes || !recipe.notes.trim()) return '';
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
            <div class="recipe-editorial-section">
              <h3 class="editorial-section-title">Notes</h3>
              <p class="card-content-text">
                ${escapeHtml(notesText)}
              </p>
            </div>
          `;
    })()}

        <!-- Editorial Footer: Source Citation & Tags -->
        <footer class="recipe-editorial-footer">
          ${recipe.source ? `
            <div class="editorial-source">
              <span class="editorial-source-label">Source:</span>
              ${recipe.source.startsWith('http') ? `<a href="${escapeHtml(recipe.source)}" target="_blank" rel="noopener">${escapeHtml(recipe.source)}</a>` : `<span>${escapeHtml(recipe.source)}</span>`}
            </div>
          ` : ''}
          <div class="drink-tags-bar">
            <div class="drink-tags-chips">
              ${(recipe.tags || []).map(tag => `
                <span class="drink-tag-chip" data-tag="${escapeHtml(tag)}">
                  <span class="drink-tag-text" data-action="filter-tag" data-tag="${escapeHtml(tag)}" role="button" tabindex="0">#${escapeHtml(tag)}</span>
                  <button type="button" class="drink-tag-remove" data-tag="${escapeHtml(tag)}" title="Remove tag" aria-label="Remove tag #${escapeHtml(tag)}">×</button>
                </span>
              `).join('')}
              <div class="tag-input-inline-wrapper">
                <input type="text" id="input-inline-tag" class="tag-input-inline" placeholder="+ Add tag..." aria-label="Add tag" autocomplete="off">
                <ul class="tag-suggest-list" id="inline-tag-suggest-list" role="listbox" hidden></ul>
              </div>
            </div>
          </div>
        </footer>

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
      </div> <!-- end .specs-column -->
    </div> <!-- end .counter-grid -->

    <!-- Similar Cocktails Shelf (Horizontal Scrolling Track, spans full width across bottom) -->
    ${similarCocktails.length > 0 ? /*html*/ `
      <div class="similar-cocktails-shelf">
        <div class="counter-card-header shelf-header">
          <div class="shelf-header-left">
            <span class="counter-card-title">Similar Cocktails</span>
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
  `;

  // Render vector SVG glass
  const glassContainer = document.getElementById('glass-wrapper');
  state.glassViewMain = new GlassView(glassContainer, {
    initialMode: state.glassViewMode,
    onLayerHover: (index) => {
      const rows = elements.counterViewContainer.querySelectorAll('.spec-row');
      rows.forEach((row, i) => {
        row.classList.toggle('highlighted', i === index);
      });
    },
  });
  state.glassViewMain.render(effectiveRecipe, state.glassViewMode);

  // Wire Glass View Presentation Switch (Layers vs Blended)
  const glassToggleBtns = elements.counterViewContainer.querySelectorAll('.glass-view-btn');
  glassToggleBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetMode = btn.getAttribute('data-mode');
      if (targetMode) {
        setGlassViewMode(targetMode);
      }
    });
  });

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
    setUnitSystem('oz');
  });

  document.getElementById('btn-unit-ml')?.addEventListener('click', () => {
    setUnitSystem('ml');
  });

  document.getElementById('btn-edit-drink')?.addEventListener('click', () => {
    openEditor(recipe);
  });

  document.getElementById('btn-duplicate-drink')?.addEventListener('click', () => {
    duplicateRecipe(recipe);
  });

  document.getElementById('btn-hide-drink')?.addEventListener('click', () => {
    toggleHideRecipe(recipe);
  });

  document.getElementById('btn-banner-unhide')?.addEventListener('click', () => {
    toggleHideRecipe(recipe);
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
    const cleanTag = normalizeTagName(rawTag);
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

  setupTagAutocomplete(
    inlineTagInput,
    document.getElementById('inline-tag-suggest-list'),
    () => availableTags,
    addTagToCurrentRecipe
  );

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

  // Sticky Header Title Observer (Mobile and Desktop):
  // Shows the drink name inline next to "< Drinks" (mobile) or in the top app header (desktop)
  // once the main drink name scrolls out of view.
  const mobileStickyTitle = document.getElementById('mobile-sticky-title');
  const desktopStickyTitle = elements.desktopStickyTitle;
  if (elements.desktopStickyName) {
    elements.desktopStickyName.textContent = recipe.name;
  }
  const drinkHeading = elements.counterViewContainer.querySelector('.drink-name');
  if (drinkHeading && elements.mainStage) {
    if (window._counterScrollObserver) {
      window._counterScrollObserver.disconnect();
    }
    const stickyBar = document.getElementById('counter-mobile-bar');
    const stickyBarHeight = stickyBar && stickyBar.offsetHeight > 0 ? stickyBar.offsetHeight : 0;

    const isMobile = window.innerWidth <= 768;
    const headerHeight = isMobile ? 52 : 0;
    const topOffset = headerHeight + stickyBarHeight;

    window._counterScrollObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        // When the drink name header is visible, hide the sticky title.
        // When it has scrolled up past the top of the scroll container / header offset, show it.
        const rootTop = entry.rootBounds ? entry.rootBounds.top : topOffset;
        const isPast = !entry.isIntersecting && entry.boundingClientRect.bottom <= (rootTop + 20);
        if (isPast && state.viewMode === 'counter') {
          mobileStickyTitle?.classList.add('visible');
          desktopStickyTitle?.classList.add('visible');
        } else {
          mobileStickyTitle?.classList.remove('visible');
          desktopStickyTitle?.classList.remove('visible');
        }
      });
    }, {
      root: isMobile ? null : elements.mainStage,
      rootMargin: `-${topOffset}px 0px 0px 0px`,
      threshold: 0,
    });

    window._counterScrollObserver.observe(drinkHeading);
  }
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
              <option value="Wine" ${currentData.glassware === 'Wine' ? 'selected' : ''}>Wine Glass</option>
              <option value="Tiki Mug" ${currentData.glassware === 'Tiki Mug' ? 'selected' : ''}>Tiki Mug</option>
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
              <div class="tag-input-autocomplete-wrapper">
                <input
                  type="text"
                  id="editor-tag-input"
                  class="form-input editor-tag-input-field"
                  placeholder="Type a tag name and press Enter..."
                  autocomplete="off"
                />
                <ul class="tag-suggest-list" id="editor-tag-suggest-list" role="listbox" hidden></ul>
              </div>
              <button type="button" id="btn-add-editor-tag" class="btn btn-secondary btn-sm">+ Add Tag</button>
            </div>
          </div>
          <div class="field-hint" style="font-size: 0.75rem; color: var(--color-text-muted); margin-top: 0.35rem;">
            Assign tags to group drinks into menus, moods, or favorites.
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
  setupEditorEvents(currentData.id);
  renderCurrentView();
  updateEditorGlassPreview();

  // Mobile navigation adjustment: reveal main-stage editor and hide sidebar list
  elements.sidebar.classList.add('mobile-hidden');
  elements.mainStage.classList.remove('mobile-hidden');
  if (elements.mainStage) {
    elements.mainStage.scrollTop = 0;
  }
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

    return /*html*/`
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

  // Glassware, method & garnish live preview change
  document.getElementById('edit-glassware')?.addEventListener('change', () => {
    updateEditorGlassPreview();
  });

  document.getElementById('edit-method')?.addEventListener('change', () => {
    updateEditorGlassPreview();
  });

  document.getElementById('edit-garnish')?.addEventListener('input', () => {
    updateEditorGlassPreview();
  });

  // Editor Tags management
  const editorTagInput = document.getElementById('editor-tag-input');
  const addEditorTag = (tagOverride) => {
    const raw = normalizeTagName(tagOverride ?? editorTagInput?.value);
    if (!raw) return;

    if (!state.editorTags.includes(raw)) {
      state.editorTags.push(raw);
      renderEditorTagChips();
    }
    if (editorTagInput) editorTagInput.value = '';
  };

  document.getElementById('btn-add-editor-tag')?.addEventListener('click', () => addEditorTag());

  setupTagAutocomplete(
    editorTagInput,
    document.getElementById('editor-tag-suggest-list'),
    () => getAllUniqueTags(state.recipes).filter(t => !state.editorTags.includes(t)),
    addEditorTag
  );

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
  const garnish = document.getElementById('edit-garnish')?.value || '';

  state.glassViewEditor = new GlassView(container, {
    initialMode: state.glassViewMode,
  });

  state.glassViewEditor.render({
    name,
    glassware,
    garnish,
    specs: state.editorSpecs,
  }, state.glassViewMode);

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

  if (!state.activeRecipeId) {
    elements.sidebar.classList.remove('mobile-hidden');
    elements.mainStage.classList.add('mobile-hidden');
  }
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
 * Toggle hide/unhide status for a seed recipe.
 * Keeps user directly on the recipe view and provides clear, immediate in-place feedback.
 */
function toggleHideRecipe(recipe) {
  if (!recipe || !recipe.id) return;
  const currentlyHidden = isRecipeHidden(recipe.id);

  const listItemEl = elements.recipeList?.querySelector(`.recipe-list-item[data-id="${recipe.id}"]`);

  const executeHideStateUpdate = () => {
    state.recipes = getRecipes();
    renderRecipeList();
    if (state.viewMode === 'counter') {
      renderCounterView();
    } else if (state.viewMode === 'home') {
      renderHomeView();
    }
    updateVaultStats();
  };

  if (!currentlyHidden) {
    hideRecipe(recipe.id);
    showToast(`Hidden "${recipe.name}" from library`);
    if (listItemEl) {
      listItemEl.classList.add('is-exiting');
      setTimeout(executeHideStateUpdate, 240);
      return;
    }
  } else {
    unhideRecipe(recipe.id);
    showToast(`Restored "${recipe.name}" to library`);
  }

  executeHideStateUpdate();
}

/**
 * Confirm and delete a recipe
 */
function confirmDeleteRecipe(recipe) {
  if (confirm(`Delete "${recipe.name}" from your library? This cannot be undone.`)) {
    const listItemEl = elements.recipeList?.querySelector(`.recipe-list-item[data-id="${recipe.id}"]`);

    const executeDelete = () => {
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
    };

    if (listItemEl) {
      listItemEl.classList.add('is-exiting');
      setTimeout(executeDelete, 240);
    } else {
      executeDelete();
    }
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
document.addEventListener('DOMContentLoaded', () => {
  init();

  // Prevent iOS Safari pinch gesture zoom on controls and main app viewport
  document.addEventListener('gesturestart', (e) => {
    e.preventDefault();
  }, { passive: false });

  // Prevent double-tap zoom on buttons and interactive elements
  let lastTouchEnd = 0;
  document.addEventListener('touchend', (e) => {
    const now = Date.now();
    if (now - lastTouchEnd <= 300) {
      if (e.target.closest('button, input, select, textarea, .btn, .recipe-list-item, .vault-action-item, .backbar-pill')) {
        e.preventDefault();
        e.target.click?.();
      }
    }
    lastTouchEnd = now;
  }, { passive: false });
});
