/**
 * Speakeasy Application Coordinator
 * Application lifecycle, routing, global event wiring, and view transition orchestration.
 */

import { state, elements, initElements } from './js/state.js';
import { getRecipes } from './js/modules/storage.js';
import {
  selectRecipe,
  goHome,
  goToMenuBuilder,
  goToAccount,
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
  setFunAnimations,
  setLibrarySort,
  openVaultSettingsModal,
  renderVaultSettingsModal,
  updateAuthIndicator,
} from './js/components/top-bar.js';
import { trackEvent } from './js/modules/telemetry.js';

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
  setMenuBuilderCallbacks,
  applyMenuBuilderHash,
} from './js/views/menu-builder-view.js';

import {
  openEditor,
  cancelEditor,
  setEditorModalCallbacks,
} from './js/components/editor-modal.js';

import { setupTimerModalEventListeners } from './js/components/timer-modal.js';

import {
  setupAuthModalEventListeners,
  openAuthModal,
  closeAuthModal,
} from './js/components/auth-modal.js';

import { checkSession, pullRemoteData } from './js/modules/auth.js';

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

  const deepLinkedToShare = urlHash === 'share' || urlHash.startsWith('share/');
  const deepLinkedToRecipe = !deepLinkedToShare && Boolean(urlHash && state.recipes.some(r => r.id === urlHash));
  const deepLinkedToMenuBuilder = !deepLinkedToShare && (urlHash === 'menus' || urlHash.startsWith('menus/'));
  const deepLinkedToAccount = !deepLinkedToShare && (urlHash === 'account' || urlHash === 'vault');
  const deepLinkedToNew = !deepLinkedToShare && urlHash === 'new';
  const deepLinkedToEdit = !deepLinkedToShare && urlHash.startsWith('edit/');

  if (!initialId && state.recipes.length > 0) {
    initialId = state.recipes[0].id;
  }

  state.activeRecipeId = initialId;
  state.viewMode = deepLinkedToShare
    ? 'shared-recipe'
    : (deepLinkedToNew || deepLinkedToEdit)
      ? 'edit'
      : (deepLinkedToRecipe
        ? 'counter'
        : (deepLinkedToMenuBuilder ? 'menu-builder' : (deepLinkedToAccount ? 'account' : 'home')));
  if (deepLinkedToShare) {
    state.pendingShareId = urlHash === 'share' ? null : urlHash.slice('share/'.length);
  }
  if (urlHash && initialId && deepLinkedToRecipe) {
    history.replaceState(null, '', `#${initialId}`);
  }
  if (deepLinkedToMenuBuilder) {
    // Same "restore this state, don't push new history" entry point the
    // hashchange listener below uses for browser back/forward.
    applyMenuBuilderHash(urlHash === 'menus' ? null : urlHash.slice('menus/'.length));
  }
  let pendingInitialEditor = null;
  if (deepLinkedToNew) {
    pendingInitialEditor = { recipe: null };
  } else if (deepLinkedToEdit) {
    const editTargetId = urlHash.slice('edit/'.length);
    const targetRecipe = state.recipes.find(r => r.id === editTargetId);
    pendingInitialEditor = { recipe: targetRecipe || null };
  }

  const isMobile = window.innerWidth <= 768;
  if (isMobile) {
    elements.sidebar?.classList.add('mobile-hidden');
    elements.mainStage?.classList.remove('mobile-hidden');
  }

  // Connect callbacks across components
  setRecipeListCallbacks({ openEditor, updateVaultStats, showDrinksListMobile });
  setHomeViewCallbacks({ selectRecipe, showDrinksListMobile, openBackbarModal, openMenuBuilderModal: goToMenuBuilder });
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
    openAuthModal,
    goToAccount,
  });
  setBackbarModalCallbacks({
    updateMyBarBadge,
    renderRecipeList,
    renderCounterView,
    renderHomeView,
    selectRecipe,
  });
  setHiddenModalCallbacks({
    updateVaultStats,
    renderRecipeList,
    renderCounterView,
    renderHomeView,
  });
  setMenuBuilderCallbacks({ selectRecipe, goHome });
  setEditorModalCallbacks({
    selectRecipe,
    renderCurrentView,
  });

  setupGlobalEventListeners();
  setupTopBarEventListeners();
  setupBackbarEventListeners();
  setupHiddenModalEventListeners();
  setupTimerModalEventListeners();
  setupAuthModalEventListeners();
  updateMyBarBadge();
  renderRecipeList();
  renderCurrentView();

  if (pendingInitialEditor) {
    openEditor(pendingInitialEditor.recipe, false);
  }

  // Validate stored session token against backend and sync state
  checkSession().then(async result => {
    updateAuthIndicator();
    if (result && result.authenticated) {
      try {
        await pullRemoteData();
        renderRecipeList();
      } catch (err) {
        console.warn('Initial session pull error:', err);
      }
    }
    if (state.viewMode === 'account') {
      renderVaultSettingsModal();
    }
  }).catch(err => {
    console.warn('Initial session check error:', err);
    updateAuthIndicator();
    if (state.viewMode === 'account') {
      renderVaultSettingsModal();
    }
  });

  // Initialize Vault Settings Popover values
  if (elements.popoverUnitOz && elements.popoverUnitMl) {
    elements.popoverUnitOz.classList.toggle('active', state.unitSystem === 'oz');
    elements.popoverUnitMl.classList.toggle('active', state.unitSystem === 'ml');
  }
  if (elements.popoverGlassLayered && elements.popoverGlassBlended) {
    elements.popoverGlassLayered.classList.toggle('active', state.glassViewMode === 'layered');
    elements.popoverGlassBlended.classList.toggle('active', state.glassViewMode === 'blended');
  }
  if (elements.btnFunToggle) {
    elements.btnFunToggle.checked = Boolean(state.funAnimations);
  }
  if (typeof document !== 'undefined') {
    document.documentElement.classList.toggle('animations-disabled', !state.funAnimations);
  }
  updateVaultStats();

  // Scroll active item into view on initial load
  setTimeout(() => {
    const activeEl = elements.recipeList?.querySelector('.recipe-list-item.active');
    activeEl?.scrollIntoView({ block: 'nearest' });
  }, 50);
}

/**
 * Reads the amount+unit out of a spec row's `.spec-amount` cell as two
 * separate values (an editable riff-mode input, or plain text with a nested
 * `.spec-unit` span) so a copy handler can lay them out with a space between
 * ("2 oz", not the display's unspaced "2oz") — unambiguous for our own
 * Quick Paste parser without it having to guess where the number ends.
 */
function readSpecAmountText(row) {
  const amountEl = row.querySelector('.spec-amount');
  if (!amountEl) return '';

  const amountInput = amountEl.querySelector('.spec-amount-input');
  const unitText = amountEl.querySelector('.spec-unit')?.textContent.trim() || '';

  let amountText;
  if (amountInput) {
    amountText = amountInput.value.trim();
  } else {
    const clone = amountEl.cloneNode(true);
    clone.querySelector('.spec-unit')?.remove();
    amountText = clone.textContent.trim();
  }

  return [amountText, unitText].filter(Boolean).join(' ');
}

/**
 * Builds a clean, Quick-Paste-friendly plain-text version of whichever
 * ingredient rows the current selection touches — one "amount unit name"
 * line per ingredient, a "Garnish: ..." line for the garnish row — with none
 * of the surrounding UI chrome (the "✓ In Bar" toggle, the fridge/riff/sub
 * badges, substitution suggestions). Returns null when the selection doesn't
 * touch any ingredient rows, so the native copy is left alone for everything
 * else on the page.
 */
function buildCleanSpecsClipboardText(selection) {
  const rows = document.querySelectorAll('.specs-list .spec-row');
  const lines = [];

  rows.forEach((row) => {
    if (!selection.containsNode(row, true)) return;

    if (row.classList.contains('spec-garnish-row')) {
      const garnishText = row.querySelector('.spec-garnish-name')?.textContent.trim();
      if (garnishText) lines.push(`Garnish: ${garnishText}`);
      return;
    }

    const nameEl = row.querySelector('.spec-name-input, .spec-name');
    const name = (nameEl?.value ?? nameEl?.textContent ?? '').trim();
    if (!name) return;

    const amountText = readSpecAmountText(row);
    lines.push(amountText ? `${amountText} ${name}` : name);
  });

  return lines.length > 0 ? lines.join('\n') : null;
}

/**
 * Overrides the system copy for a selection that touches the ingredient
 * list, replacing it with buildCleanSpecsClipboardText's output. Selection-
 * to-plain-text serialization (what a native copy would otherwise produce)
 * doesn't reliably honor `user-select: none` on nested badges/controls the
 * same way across browsers, so — rather than depend on that — this builds
 * the clipboard text itself from the underlying amount/unit/name/garnish
 * values, guaranteeing the "✓ In Bar" toggle, fridge/riff/sub badges, and
 * substitution suggestions never end up in a pasted ingredient list.
 */
function setupIngredientListCopyHandler() {
  document.addEventListener('copy', (event) => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) return;

    const cleanText = buildCleanSpecsClipboardText(selection);
    if (cleanText === null) return;

    event.clipboardData.setData('text/plain', cleanText);
    event.preventDefault();
  });
}

/**
 * Global Event Listeners
 */
function setupGlobalEventListeners() {
  setupIngredientListCopyHandler();

  // Search with debounced telemetry
  let searchDebounceTimer = null;
  elements.searchInput?.addEventListener('input', (e) => {
    state.searchQuery = e.target.value.trim().toLowerCase();
    elements.searchClearBtn?.classList.toggle('visible', state.searchQuery.length > 0);
    renderRecipeList();

    if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
    if (state.searchQuery.length >= 2) {
      searchDebounceTimer = setTimeout(() => {
        trackEvent('search', { query: state.searchQuery });
      }, 1500);
    }
  });

  elements.searchClearBtn?.addEventListener('click', () => {
    if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
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
    if (rawHash === 'vault' || rawHash === 'account') {
      if (state.viewMode !== 'account') {
        state.viewMode = 'account';
        renderCurrentView();
      }
      elements.sidebar?.classList.add('mobile-hidden');
      elements.mainStage?.classList.remove('mobile-hidden');
      return;
    }
    if (rawHash === 'share' || rawHash.startsWith('share/')) {
      state.pendingShareId = rawHash === 'share' ? null : rawHash.slice('share/'.length);
      state.viewMode = 'shared-recipe';
      renderCurrentView();
      elements.sidebar?.classList.add('mobile-hidden');
      elements.mainStage?.classList.remove('mobile-hidden');
      return;
    }
    if (state.recipes.some(r => r.id === rawHash)) {
      if (state.viewMode !== 'counter' || rawHash !== state.activeRecipeId) {
        selectRecipe(rawHash, false);
      }
      return;
    }
    if (rawHash === 'menus' || rawHash.startsWith('menus/')) {
      const menuId = rawHash === 'menus' ? null : rawHash.slice('menus/'.length);
      applyMenuBuilderHash(menuId);
      if (state.viewMode !== 'menu-builder') {
        state.viewMode = 'menu-builder';
        renderCurrentView();
      }
      elements.sidebar?.classList.add('mobile-hidden');
      elements.mainStage?.classList.remove('mobile-hidden');
      return;
    }
    if (rawHash === 'new') {
      openEditor(null, false);
      return;
    }
    if (rawHash.startsWith('edit/')) {
      const editTargetId = rawHash.slice('edit/'.length);
      const targetRecipe = state.recipes.find(r => r.id === editTargetId);
      openEditor(targetRecipe || null, false);
      return;
    }
    // Stale/malformed hash (typo'd link, old bookmark, etc.) — matches none of
    // the routes above, so fall back to Home rather than leaving the UI stuck
    // on whatever view was showing before the hash changed.
    if (state.viewMode !== 'home') {
      state.viewMode = 'home';
      renderRecipeList();
      renderCurrentView();
    }
    elements.sidebar?.classList.add('mobile-hidden');
    elements.mainStage?.classList.remove('mobile-hidden');
  });

  // Re-sync wake lock on tab visibility change
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      releaseWakeLock();
    } else if (state.viewMode === 'counter') {
      requestWakeLock();
    }
  });

  // Keyboard shortcuts:
  // - Escape: cancel editor or clear search
  // - Cmd/Ctrl + K or /: focus search input (when visible)
  // - ArrowUp / ArrowDown: navigate between recipes when viewing recipe detail
  window.addEventListener('keydown', (e) => {
    const isEditingText = e.target && (
      e.target.tagName === 'INPUT' ||
      e.target.tagName === 'TEXTAREA' ||
      e.target.tagName === 'SELECT' ||
      e.target.isContentEditable
    );

    // Search focus shortcuts: '/' (without modifiers/inputs) or Cmd+K / Ctrl+K
    const isSearchFocusKey = (e.key === '/' && !e.metaKey && !e.ctrlKey && !e.altKey && !isEditingText)
      || ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K'));

    if (isSearchFocusKey) {
      const searchInput = elements.searchInput;
      if (searchInput && searchInput.offsetParent !== null && !searchInput.disabled) {
        e.preventDefault();
        searchInput.focus();
        searchInput.select();
        return;
      }
    }

    if (e.key === 'Escape') {
      if (state.viewMode === 'edit') {
        cancelEditor();
      } else if (state.searchQuery) {
        if (elements.searchInput) elements.searchInput.value = '';
        state.searchQuery = '';
        elements.searchClearBtn?.classList.remove('visible');
        renderRecipeList();
      }
      return;
    }

    // Up / Down arrow navigation between recipes:
    // Only active when viewing a recipe ('counter'), no open modal, and not focused in an input
    if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && !isEditingText) {
      if (state.viewMode !== 'counter') return;
      if (document.querySelector('.modal:not(.hidden)')) return;

      const items = Array.from(elements.recipeList?.querySelectorAll('.recipe-list-item[data-id]') || []);
      if (items.length === 0) return;

      const currentIndex = items.findIndex(item => item.getAttribute('data-id') === state.activeRecipeId);
      let targetIndex = -1;

      if (e.key === 'ArrowDown') {
        if (currentIndex === -1) {
          targetIndex = 0;
        } else if (currentIndex < items.length - 1) {
          targetIndex = currentIndex + 1;
        }
      } else if (e.key === 'ArrowUp') {
        if (currentIndex > 0) {
          targetIndex = currentIndex - 1;
        }
      }

      if (targetIndex >= 0 && targetIndex < items.length) {
        e.preventDefault();
        const nextId = items[targetIndex].getAttribute('data-id');
        if (nextId) {
          selectRecipe(nextId);
        }
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
