/**
 * Speakeasy Hidden Cocktails Management Modal Component
 */

import { state, elements } from '../state.js';
import {
  getRecipes,
  getHiddenRecipeIds,
  unhideRecipe,
  unhideAllRecipes,
  SEED_RECIPES,
} from '../modules/storage.js';

import { escapeHtml, showToast } from './toast.js';

let _updateVaultStatsFn = null;
let _renderRecipeListFn = null;
let _renderCounterViewFn = null;
let _renderHomeViewFn = null;

export function setHiddenModalCallbacks(cbs) {
  if (cbs.updateVaultStats) _updateVaultStatsFn = cbs.updateVaultStats;
  if (cbs.renderRecipeList) _renderRecipeListFn = cbs.renderRecipeList;
  if (cbs.renderCounterView) _renderCounterViewFn = cbs.renderCounterView;
  if (cbs.renderHomeView) _renderHomeViewFn = cbs.renderHomeView;
}

/**
 * Open Hidden Cocktails Modal
 */
export function openHiddenModal() {
  renderHiddenRecipesModal();
  if (typeof elements.hiddenRecipesModal?.showModal === 'function') {
    elements.hiddenRecipesModal.showModal();
  }
}

/**
 * Close Hidden Cocktails Modal
 */
export function closeHiddenModal() {
  if (typeof elements.hiddenRecipesModal?.close === 'function') {
    elements.hiddenRecipesModal.close();
  }
}

/**
 * Render contents of the Hidden Cocktails Modal
 */
export function renderHiddenRecipesModal() {
  if (!elements.hiddenRecipesContainer) return;

  const hiddenIds = getHiddenRecipeIds();
  if (elements.btnUnhideAll) {
    elements.btnUnhideAll.style.display = hiddenIds.length > 0 ? '' : 'none';
  }

  if (hiddenIds.length === 0) {
    elements.hiddenRecipesContainer.innerHTML =  /*html*/`
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

  elements.hiddenRecipesContainer.innerHTML =  /*html*/hiddenDrinks.map(drink => {
    const subParts = [drink.glassware, drink.method].filter(Boolean).join(' · ');
    return `
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
      if (_renderRecipeListFn) _renderRecipeListFn();
      if (state.viewMode === 'counter' && _renderCounterViewFn) {
        _renderCounterViewFn();
      } else if (state.viewMode === 'home' && _renderHomeViewFn) {
        _renderHomeViewFn();
      }
      if (_updateVaultStatsFn) _updateVaultStatsFn();
      renderHiddenRecipesModal();
      showToast(`Restored "${drinkObj.name}" to library`);
    });
  });
}

/**
 * Setup Hidden Cocktails Modal Event Listeners
 */
export function setupHiddenModalEventListeners() {
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
    if (_renderRecipeListFn) _renderRecipeListFn();
    if (state.viewMode === 'counter' && _renderCounterViewFn) {
      _renderCounterViewFn();
    } else if (state.viewMode === 'home' && _renderHomeViewFn) {
      _renderHomeViewFn();
    }
    if (_updateVaultStatsFn) _updateVaultStatsFn();
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
