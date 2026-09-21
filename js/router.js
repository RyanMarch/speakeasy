/**
 * Speakeasy Application Router & View Transitions Coordinator
 */

import { state, elements } from './state.js';
import { recordRecentlyViewed } from './modules/storage.js';
import { renderRecipeList } from './views/recipe-list-view.js';
import { renderHomeView } from './views/home-view.js';
import {
  renderCounterView,
  requestWakeLock,
  releaseWakeLock,
} from './views/counter-view.js';
import { renderMenuBuilderView, resetMenuBuilderToList } from './views/menu-builder-view.js';
import { renderVaultSettingsModal } from './components/top-bar.js';
import { renderSharedRecipeView, setSharedRecipeViewCallbacks } from './views/shared-recipe-view.js';
import { renderGuestMenuView } from './views/guest-menu-view.js';
import { trackEvent } from './modules/telemetry.js';
import { runViewTransition } from './modules/view-transition.js';

setSharedRecipeViewCallbacks({
  selectRecipe,
  goHome,
  refreshRecipeList: renderRecipeList,
});

/**
 * Select a recipe and display counter view
 */
export function selectRecipe(id, updateHistory = true) {
  const found = state.recipes.find(r => r.id === id);
  if (!found) return;

  if (state.activeRecipeId !== id) {
    state.activeRiffs = {};
    state.riffAmountOverrides = {};
    state.riffExtraSpecs = [];
    state.riffRemovedSpecs = new Set();
    state.riffModeActive = false;
    state.servings = 1;
  }
  // Opened from the mobile drinks list: remember the scroll position so Back
  // can restore it (the list is hidden, and the page scroll reset, below).
  if (window.innerWidth <= 768 && !elements.sidebar?.classList.contains('mobile-hidden')) {
    state.listScrollY = window.scrollY;
    state.returnToMobileList = true;
  }

  state.activeRecipeId = id;
  state.viewMode = 'counter';
  recordRecentlyViewed(id);
  trackEvent('recipe_view', { targetId: id });

  try {
    localStorage.setItem('speakeasy_last_active_recipe', id);
  } catch {
    // Ignore
  }

  if (updateHistory && window.location.hash !== `#${id}`) {
    history.pushState(null, '', `#${id}`);
  }

  runViewTransition(() => {
    const preservedScrollTop = elements.recipeList?.scrollTop || 0;
    renderRecipeList();
    if (elements.recipeList) {
      elements.recipeList.scrollTop = preservedScrollTop;
    }
    renderCurrentView();

    // Keep active item visible in sidebar without jarring jumps when clicked directly
    const activeEl = elements.recipeList?.querySelector('.recipe-list-item.active');
    if (activeEl && elements.recipeList) {
      const listRect = elements.recipeList.getBoundingClientRect();
      const itemRect = activeEl.getBoundingClientRect();
      if (itemRect.top < listRect.top || itemRect.bottom > listRect.bottom) {
        activeEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }

    // Mobile navigation adjustment
    elements.sidebar?.classList.add('mobile-hidden');
    elements.mainStage?.classList.remove('mobile-hidden');
    if (elements.mainStage) {
      elements.mainStage.scrollTop = 0;
    }
    window.scrollTo({ top: 1 });
  }, 'forward');
}

/**
 * Render active view based on state.viewMode
 * Wrapped in the View Transitions API when available
 */
// One entry per state.viewMode ('counter' also covers the fallback/default
// case previously handled by the trailing `else`). Each entry fully
// describes what renderCurrentView's shared applyView() below does for that
// mode — which single container to show (every other container is hidden),
// and the handful of view-specific side effects that used to be five
// near-identical copy-pasted branches.
const VIEW_CONFIG = {
  edit: {
    container: 'editorViewContainer',
    hideSidebar: false,
    btnNewDrinkVisible: false,
    disconnectScrollObserver: true,
    resetScroll: false,
    stickyClassesToRemove: ['visible'],
    clearMobileSticky: true,
    render: null,
    wakeLock: 'release',
  },
  home: {
    container: 'homeViewContainer',
    hideSidebar: false,
    btnNewDrinkVisible: true,
    disconnectScrollObserver: true,
    resetScroll: false,
    stickyClassesToRemove: ['visible', 'editor-mode'],
    clearMobileSticky: true,
    render: () => renderHomeView(),
    wakeLock: 'release',
  },
  'menu-builder': {
    container: 'menuBuilderViewContainer',
    // The library sidebar navigates away on every interaction (search,
    // click) — a poor fit next to a focused builder flow that already has
    // its own recipe picker, so this page claims the full width instead.
    hideSidebar: true,
    btnNewDrinkVisible: false,
    disconnectScrollObserver: true,
    resetScroll: false,
    stickyClassesToRemove: ['visible', 'editor-mode'],
    clearMobileSticky: true,
    render: () => renderMenuBuilderView(),
    wakeLock: 'release',
  },
  account: {
    container: 'accountViewContainer',
    hideSidebar: true,
    btnNewDrinkVisible: false,
    disconnectScrollObserver: true,
    resetScroll: true,
    stickyClassesToRemove: ['visible', 'editor-mode'],
    clearMobileSticky: true,
    render: () => renderVaultSettingsModal(),
    wakeLock: 'release',
  },
  'shared-recipe': {
    container: 'sharedRecipeViewContainer',
    hideSidebar: true,
    btnNewDrinkVisible: false,
    disconnectScrollObserver: true,
    resetScroll: true,
    stickyClassesToRemove: ['visible', 'editor-mode'],
    clearMobileSticky: true,
    render: () => renderSharedRecipeView(state.pendingShareId),
    wakeLock: 'release',
  },
  'guest-menu': {
    container: 'guestMenuViewContainer',
    hideSidebar: true,
    btnNewDrinkVisible: false,
    disconnectScrollObserver: true,
    resetScroll: true,
    stickyClassesToRemove: ['visible', 'editor-mode'],
    clearMobileSticky: true,
    render: () => renderGuestMenuView(),
    wakeLock: 'release',
  },
  counter: {
    container: 'counterViewContainer',
    hideSidebar: false,
    btnNewDrinkVisible: true,
    // Counter view owns and recreates window._counterScrollObserver itself
    // inside renderCounterView() below — nothing to tear down beforehand.
    disconnectScrollObserver: false,
    resetScroll: false,
    // Leaving the editor any way other than Cancel/Save (e.g. jumping straight
    // to another recipe from the sidebar) skips editor-modal.js's own cleanup,
    // which is what was leaving a ghost "Save Recipe" button stuck in the
    // shared sticky header on recipe pages that were never being edited.
    stickyClassesToRemove: ['editor-mode'],
    clearMobileSticky: false,
    render: () => renderCounterView(),
    wakeLock: 'request',
  },
};

const ALL_VIEW_CONTAINER_KEYS = [
  'homeViewContainer', 'counterViewContainer', 'menuBuilderViewContainer',
  'accountViewContainer', 'editorViewContainer', 'sharedRecipeViewContainer', 'guestMenuViewContainer',
];

export function renderCurrentView() {
  const applyView = () => {
    const config = VIEW_CONFIG[state.viewMode] || VIEW_CONFIG.counter;

    if (config.disconnectScrollObserver && window._counterScrollObserver) {
      window._counterScrollObserver.disconnect();
    }
    ALL_VIEW_CONTAINER_KEYS.forEach(key => {
      if (elements[key]) elements[key].style.display = key === config.container ? 'block' : 'none';
    });
    if (elements.btnNewDrink) elements.btnNewDrink.style.display = config.btnNewDrinkVisible ? '' : 'none';
    // A display:none sidebar forgets its scroll position, so stash it on the
    // way out and put it back when the sidebar returns.
    const sidebarWasHidden = elements.appMain?.classList.contains('hide-sidebar');
    if (config.hideSidebar && !sidebarWasHidden && elements.recipeList) {
      state.listScrollTop = elements.recipeList.scrollTop;
    }
    // A guest scanning a QR code has no use for the host-app chrome (My Bar,
    // account); see guest-menu-view.css.
    document.documentElement.classList.toggle('guest-menu-mode', state.viewMode === 'guest-menu');
    elements.appMain?.classList.toggle('hide-sidebar', config.hideSidebar);
    if (!config.hideSidebar && sidebarWasHidden && elements.recipeList) {
      elements.recipeList.scrollTop = state.listScrollTop;
    }
    elements.desktopStickyTitle?.classList.remove(...config.stickyClassesToRemove);
    if (config.clearMobileSticky) {
      document.getElementById('mobile-sticky-title')?.classList.remove('visible');
    }
    if (config.resetScroll) {
      if (elements.mainStage) elements.mainStage.scrollTop = 0;
      window.scrollTo(0, 0);
    }
    if (config.render) config.render();
    if (config.wakeLock === 'release') {
      releaseWakeLock();
    } else {
      requestWakeLock();
    }
  };

  runViewTransition(applyView);
}

/**
 * Navigate to the Home landing page
 */
export function goHome() {
  state.viewMode = 'home';
  state.returnToMobileList = false;
  if (window.location.hash) {
    history.pushState(null, '', window.location.pathname + window.location.search);
  }
  runViewTransition(() => {
    renderRecipeList();
    renderCurrentView();

    elements.sidebar?.classList.add('mobile-hidden');
    elements.mainStage?.classList.remove('mobile-hidden');
    if (elements.mainStage) {
      elements.mainStage.scrollTop = 0;
    }
    window.scrollTo({ top: 1 });
  }, 'back');
}

/**
 * Navigate to the Menu Builder page
 */
export function goToMenuBuilder() {
  state.viewMode = 'menu-builder';
  trackEvent('feature_use', { targetId: 'menu_builder' });
  resetMenuBuilderToList();
  if (window.location.hash !== '#menus') {
    history.pushState(null, '', '#menus');
  }
  runViewTransition(() => {
    renderCurrentView();

    elements.sidebar?.classList.add('mobile-hidden');
    elements.mainStage?.classList.remove('mobile-hidden');
    if (elements.mainStage) {
      elements.mainStage.scrollTop = 0;
    }
    window.scrollTo({ top: 1 });
  }, 'forward');
}

/**
 * Navigate to the User Account & Vault Settings page
 */
export function goToAccount() {
  state.viewMode = 'account';
  trackEvent('feature_use', { targetId: 'account_vault' });
  if (window.location.hash !== '#account') {
    history.pushState(null, '', '#account');
  }
  runViewTransition(() => {
    renderCurrentView();

    elements.sidebar?.classList.add('mobile-hidden');
    elements.mainStage?.classList.remove('mobile-hidden');
    if (elements.mainStage) {
      elements.mainStage.scrollTop = 0;
    }
    window.scrollTo({ top: 1 });
  }, 'forward');
}

/**
 * Reveal the drink list (sidebar) on mobile.
 * @param {Object} [options]
 * @param {boolean} [options.focusSearch] - Focus (and open the keyboard for) the
 *   search input once the list is visible — used by the "Search Cocktails" entry
 *   point so it actually drops the user into typing, not just a list they'd still
 *   have to tap into themselves.
 * @param {string} [options.query] - Prefill the search input with this text (e.g.
 *   a tag tapped from a recipe) and re-render the list filtered to match.
 */
export function showDrinksListMobile({ focusSearch = false, query } = {}) {
  const reveal = () => {
    elements.sidebar?.classList.remove('mobile-hidden');
    elements.mainStage?.classList.add('mobile-hidden');

    if (typeof query === 'string' && elements.searchInput) {
      elements.searchInput.value = query;
      state.searchQuery = query.trim().toLowerCase();
      elements.searchClearBtn?.classList.toggle('visible', state.searchQuery.length > 0);
      renderRecipeList();
    }
  };
  // Focusing the search field has to happen synchronously (see below) and needs
  // the list visible first, so that entry point skips the animated transition.
  if (focusSearch) reveal();
  else runViewTransition(reveal, 'forward');

  if (focusSearch && elements.searchInput) {
    // Must be synchronous, not deferred via setTimeout/rAF: iOS Safari only
    // raises the virtual keyboard for a .focus() called directly within the
    // click handler's own call stack. A deferred focus still sets
    // document.activeElement, but the keyboard never appears — which is exactly
    // what made this look like "nothing happened" when tapping Search.
    elements.searchInput.focus();
    if (typeof query === 'string') {
      const len = elements.searchInput.value.length;
      elements.searchInput.setSelectionRange(len, len);
    }
  }
}
