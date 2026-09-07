/**
 * Speakeasy Shared Application State & DOM Cache
 */

import {
  getPinnedTags,
  getUnitPreference,
  getGlassViewPreference,
  getInventory,
  getSortPreference,
  SEED_RECIPES,
} from './modules/storage.js';

import { analyzeRecipeInventory } from './modules/taxonomy.js';

export const SEED_RECIPE_IDS = new Set(SEED_RECIPES.map(r => r.id));

export const BACKBAR_CATEGORIES = [
  { key: 'spirits', title: 'Base Spirits' },
  { key: 'fortified_wine', title: 'Vermouth & Wines' },
  { key: 'liqueurs', title: 'Liqueurs & Amari' },
  { key: 'bitters', title: 'Bitters & Tinctures' },
  { key: 'sweeteners', title: 'Syrups & Sweeteners' },
  { key: 'produce', title: 'Fresh Produce & Juices' },
  { key: 'mixers', title: 'Mixers & Sodas' },
];

export const HOME_DEFAULT_COLLECTIONS = [
  { key: 'classic', title: 'Classic Cocktails' },
  { key: 'modern-craft', title: 'Modern Craft' },
  { key: 'tropical-tiki', title: 'Tropical & Tiki' },
  { key: 'prohibition-era', title: 'Prohibition Era' },
  { key: 'aperitivo-amaro', title: 'Aperitivo & Amaro' },
  { key: 'nightcaps', title: 'Nightcaps' },
];

export const state = {
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

const inventoryAnalysisCache = new WeakMap();
export let inventoryVersion = 0;

export function invalidateInventoryCache() {
  inventoryVersion++;
}

export function getCachedInventoryAnalysis(recipe) {
  const cached = inventoryAnalysisCache.get(recipe);
  if (cached && cached.version === inventoryVersion) {
    return cached.result;
  }
  const result = analyzeRecipeInventory(recipe, state.inventory);
  inventoryAnalysisCache.set(recipe, { version: inventoryVersion, result });
  return result;
}

export const elements = {};

export function initElements() {
  if (typeof document === 'undefined') return;
  elements.sidebar = document.getElementById('sidebar');
  elements.mainStage = document.getElementById('main-stage');
  elements.recipeList = document.getElementById('recipe-list');
  elements.recipeCountBadge = document.getElementById('recipe-count-badge');
  elements.searchInput = document.getElementById('search-input');
  elements.searchClearBtn = document.getElementById('search-clear-btn');
  elements.btnNewDrink = document.getElementById('btn-new-drink');
  elements.btnPopoverNewDrink = document.getElementById('btn-popover-new-drink');
  elements.btnExportJson = document.getElementById('btn-export-json');
  elements.btnImportTrigger = document.getElementById('btn-import-trigger');
  elements.importFileInput = document.getElementById('import-file-input');
  elements.btnVaultMenu = document.getElementById('btn-vault-menu');
  elements.vaultPopover = document.getElementById('vault-popover');
  elements.vaultBarNameInput = document.getElementById('vault-bar-name-input');
  elements.vaultStatsLine = document.getElementById('vault-stats-line');
  elements.popoverUnitOz = document.getElementById('popover-unit-oz');
  elements.popoverUnitMl = document.getElementById('popover-unit-ml');
  elements.popoverGlassLayered = document.getElementById('popover-glass-layered');
  elements.popoverGlassBlended = document.getElementById('popover-glass-blended');
  elements.btnResetDefaults = document.getElementById('btn-reset-defaults');
  elements.counterViewContainer = document.getElementById('counter-view-container');
  elements.editorViewContainer = document.getElementById('editor-view-container');
  elements.homeViewContainer = document.getElementById('home-view-container');
  elements.btnGoHome = document.getElementById('btn-go-home');
  elements.btnFooterHome = document.getElementById('btn-footer-home');
  elements.desktopStickyTitle = document.getElementById('desktop-sticky-title');
  elements.desktopStickyName = document.getElementById('desktop-sticky-name');
  elements.toastContainer = document.getElementById('toast-container');
  elements.btnMyBar = document.getElementById('btn-my-bar');
  elements.myBarBadge = document.getElementById('my-bar-badge');
  elements.sidebarPackFilter = document.getElementById('sidebar-pack-filter');
  elements.sidebarInventoryFilter = document.getElementById('sidebar-inventory-filter');
  elements.sidebarSortSelect = document.getElementById('sidebar-sort-select');
  elements.countAll = document.getElementById('count-all');
  elements.countCanMake = document.getElementById('count-can-make');
  elements.countOneMissing = document.getElementById('count-one-missing');
  elements.backbarModal = document.getElementById('backbar-modal');
  elements.backbarSearchInput = document.getElementById('backbar-search-input');
  elements.backbarNavTabs = document.getElementById('backbar-nav-tabs');
  elements.backbarCategoriesContainer = document.getElementById('backbar-categories-container');
  elements.backbarSummaryText = document.getElementById('backbar-summary-text');
  elements.btnStarterBar = document.getElementById('btn-starter-bar');
  elements.btnClearBar = document.getElementById('btn-clear-bar');
  elements.btnCloseBackbar = document.getElementById('btn-close-backbar');
  elements.btnDoneBackbar = document.getElementById('btn-done-backbar');
  elements.btnManageHidden = document.getElementById('btn-manage-hidden');
  elements.vaultHiddenSub = document.getElementById('vault-hidden-sub');
  elements.hiddenRecipesModal = document.getElementById('hidden-recipes-modal');
  elements.hiddenRecipesContainer = document.getElementById('hidden-recipes-container');
  elements.btnCloseHiddenModal = document.getElementById('btn-close-hidden-modal');
  elements.btnDoneHiddenModal = document.getElementById('btn-done-hidden-modal');
  elements.btnUnhideAll = document.getElementById('btn-unhide-all');
}

// Automatically populate elements if document is defined
if (typeof document !== 'undefined') {
  initElements();
}
