/**
 * Speakeasy Application Coordinator
 * Application lifecycle, routing, global event wiring, and view transition orchestration.
 */

import { state, elements, initElements } from './js/state.js';
import { getRecipes, getBarName } from './js/modules/storage.js';
import {
  selectRecipe,
  goHome,
  renderCurrentView,
  showDrinksListMobile,
} from './js/router.js';

import {
  renderRecipeList,
  setRecipeListCallbacks,
} from './js/views/recipe-list-view.js';

import {
  renderHomeView,
  setHomeViewCallbacks,
} from './js/views/home-view.js';

import {
  renderCounterView,
  setCounterViewCallbacks,
  requestWakeLock,
  releaseWakeLock,
} from './js/views/counter-view.js';

import {
  setupTopBarEventListeners,
  setTopBarCallbacks,
  updateMyBarBadge,
  updateVaultStats,
  setUnitSystem,
  setGlassViewMode,
  setLibrarySort,
} from './js/components/top-bar.js';

import {
  setupBackbarEventListeners,
  setBackbarModalCallbacks,
  openBackbarModal,
  toggleInventoryBottle,
  updateBackbarActionButtons,
} from './js/components/backbar-modal.js';

import {
  setupHiddenModalEventListeners,
  setHiddenModalCallbacks,
} from './js/components/hidden-modal.js';

import {
  openEditor,
  cancelEditor,
  setEditorModalCallbacks,
} from './js/components/editor-modal.js';

/**
 * Initialize application
 */
function init() {
  initElements();
  state.recipes = getRecipes();

  // Resolve initial active recipe from URL Hash if provided
  const urlHash = window.location.hash.replace(/^#+/, '').trim();
  let initialId = null;

  if (urlHash && state.recipes.some(r => r.id === urlHash)) {
    initialId = urlHash;
  } else if (!window.location.hash) {
    try {
      const storedId = localStorage.getItem('speakeasy_last_active_recipe');
      if (storedId && state.recipes.some(r => r.id === storedId)) {
        initialId = storedId;
      }
    } catch {
      // Ignore localStorage errors
    }
  }

  const deepLinkedToRecipe = Boolean(urlHash && state.recipes.some(r => r.id === urlHash));

  if (!initialId && state.recipes.length > 0) {
    initialId = state.recipes[0].id;
  }

  state.activeRecipeId = initialId;
  state.viewMode = deepLinkedToRecipe ? 'counter' : 'home';
  if (urlHash && initialId && deepLinkedToRecipe) {
    history.replaceState(null, '', `#${initialId}`);
  }

  const isMobile = window.innerWidth <= 768;
  if (isMobile) {
    elements.sidebar?.classList.add('mobile-hidden');
    elements.mainStage?.classList.remove('mobile-hidden');
  }

  // Connect callbacks across components
  setRecipeListCallbacks({ openEditor, updateVaultStats });
  setHomeViewCallbacks({ selectRecipe, showDrinksListMobile });
  setCounterViewCallbacks({
    selectRecipe,
    openEditor,
    updateMyBarBadge,
    updateVaultStats,
    setUnitSystem,
    setGlassViewMode,
    toggleInventoryBottle,
    renderRecipeList,
    renderHomeView,
  });
  setTopBarCallbacks({
    goHome,
    openEditor,
    selectRecipe,
    renderCounterView,
    renderHomeView,
    renderRecipeList,
    openBackbarModal,
    updateBackbarActionButtons,
  });
  setBackbarModalCallbacks({
    updateMyBarBadge,
    renderRecipeList,
    renderCounterView,
    renderHomeView,
  });
  setHiddenModalCallbacks({
    updateVaultStats,
    renderRecipeList,
    renderCounterView,
    renderHomeView,
  });
  setEditorModalCallbacks({
    selectRecipe,
    renderCurrentView,
  });

  setupGlobalEventListeners();
  setupTopBarEventListeners();
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
    const activeEl = elements.recipeList?.querySelector('.recipe-list-item.active');
    activeEl?.scrollIntoView({ block: 'nearest' });
  }, 50);
}

/**
 * Global Event Listeners
 */
function setupGlobalEventListeners() {
  // Search
  elements.searchInput?.addEventListener('input', (e) => {
    state.searchQuery = e.target.value.trim().toLowerCase();
    elements.searchClearBtn?.classList.toggle('visible', state.searchQuery.length > 0);
    renderRecipeList();
  });

  elements.searchClearBtn?.addEventListener('click', () => {
    if (elements.searchInput) elements.searchInput.value = '';
    state.searchQuery = '';
    elements.searchClearBtn?.classList.remove('visible');
    renderRecipeList();
  });

  // Delegated click handler for the recipe list
  elements.recipeList?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action="select"]');
    if (!btn) return;
    const id = btn.getAttribute('data-id');
    selectRecipe(id);
  });

  // Sidebar Sort Select
  if (elements.sidebarSortSelect) {
    elements.sidebarSortSelect.value = state.sortPreference;
    elements.sidebarSortSelect.addEventListener('change', (e) => {
      setLibrarySort(e.target.value);
    });
  }

  // URL Hash routing: handle browser Back / Forward buttons and manual hash edits
  window.addEventListener('hashchange', () => {
    const rawHash = window.location.hash.replace(/^#+/, '').trim();
    if (!rawHash) {
      if (state.viewMode !== 'home') {
        state.viewMode = 'home';
        renderRecipeList();
        renderCurrentView();
      }
      elements.sidebar?.classList.add('mobile-hidden');
      elements.mainStage?.classList.remove('mobile-hidden');
      return;
    }
    if (state.recipes.some(r => r.id === rawHash)) {
      if (state.viewMode !== 'counter' || rawHash !== state.activeRecipeId) {
        selectRecipe(rawHash, false);
      }
    }
  });

  // Re-sync wake lock on tab visibility change
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      releaseWakeLock();
    } else if (state.viewMode === 'counter') {
      requestWakeLock();
    }
  });

  // Keyboard shortcut: Escape to cancel editor or clear search
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (state.viewMode === 'edit') {
        cancelEditor();
      } else if (state.searchQuery) {
        if (elements.searchInput) elements.searchInput.value = '';
        state.searchQuery = '';
        elements.searchClearBtn?.classList.remove('visible');
        renderRecipeList();
      }
    }
  });
}

// Boot
if (typeof document !== 'undefined') {
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
}

// Register service worker after load
if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator && typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('Service worker registration failed:', err);
    });
  });
}
