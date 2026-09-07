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

/**
 * Select a recipe and display counter view
 */
export function selectRecipe(id, updateHistory = true) {
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
}

/**
 * Render active view based on state.viewMode
 * Wrapped in the View Transitions API when available
 */
export function renderCurrentView() {
  const applyView = () => {
    if (state.viewMode === 'edit') {
      if (window._counterScrollObserver) {
        window._counterScrollObserver.disconnect();
      }
      if (elements.homeViewContainer) elements.homeViewContainer.style.display = 'none';
      if (elements.counterViewContainer) elements.counterViewContainer.style.display = 'none';
      if (elements.editorViewContainer) elements.editorViewContainer.style.display = 'block';
      if (elements.btnNewDrink) elements.btnNewDrink.style.display = 'none';
      elements.desktopStickyTitle?.classList.remove('visible');
      document.getElementById('mobile-sticky-title')?.classList.remove('visible');
      releaseWakeLock();
    } else if (state.viewMode === 'home') {
      if (window._counterScrollObserver) {
        window._counterScrollObserver.disconnect();
      }
      if (elements.editorViewContainer) elements.editorViewContainer.style.display = 'none';
      if (elements.counterViewContainer) elements.counterViewContainer.style.display = 'none';
      if (elements.homeViewContainer) elements.homeViewContainer.style.display = 'block';
      if (elements.btnNewDrink) elements.btnNewDrink.style.display = '';
      elements.desktopStickyTitle?.classList.remove('visible');
      document.getElementById('mobile-sticky-title')?.classList.remove('visible');
      renderHomeView();
      releaseWakeLock();
    } else {
      if (elements.homeViewContainer) elements.homeViewContainer.style.display = 'none';
      if (elements.editorViewContainer) elements.editorViewContainer.style.display = 'none';
      if (elements.counterViewContainer) elements.counterViewContainer.style.display = 'block';
      if (elements.btnNewDrink) elements.btnNewDrink.style.display = '';
      renderCounterView();
      requestWakeLock();
    }
  };

  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (!reducedMotion && document.startViewTransition) {
    window._activeViewTransition?.skipTransition?.();
    const transition = document.startViewTransition(applyView);
    window._activeViewTransition = transition;
    transition.ready.catch(() => {});
    transition.finished.catch(() => {}).finally(() => {
      if (window._activeViewTransition === transition) {
        window._activeViewTransition = null;
      }
    });
  } else {
    applyView();
  }
}

/**
 * Navigate to the Home landing page
 */
export function goHome() {
  state.viewMode = 'home';
  if (window.location.hash) {
    history.pushState(null, '', window.location.pathname + window.location.search);
  }
  renderRecipeList();
  renderCurrentView();

  elements.sidebar?.classList.add('mobile-hidden');
  elements.mainStage?.classList.remove('mobile-hidden');
  if (elements.mainStage) {
    elements.mainStage.scrollTop = 0;
  }
  window.scrollTo({ top: 1 });
}

/**
 * Reveal the drink list (sidebar) on mobile
 */
export function showDrinksListMobile() {
  elements.sidebar?.classList.remove('mobile-hidden');
  elements.mainStage?.classList.add('mobile-hidden');
}
