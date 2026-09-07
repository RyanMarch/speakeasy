/**
 * Speakeasy Counter View (Single Recipe Editorial Cocktail Book Spread)
 * High-contrast layout, proportional vector glassware, interactive specs,
 * servings stepper, flavor balance radar, substitutions, and similar cocktails.
 */

import {
  state,
  elements,
  getCachedInventoryAnalysis,
  SEED_RECIPE_IDS,
  inventoryVersion,
} from '../state.js';

import {
  getRecipes,
  saveRecipe,
  deleteRecipe,
  saveInventory,
  getAllUniqueTags,
  normalizeTagName,
  isRecipeHidden,
  hideRecipe,
  unhideRecipe,
  SEED_RECIPES,
} from '../modules/storage.js';

import {
  TAXONOMY,
  getIngredientMetadata,
  getIngredientSubstitutes,
  checkIngredientStock,
  findSimilarCocktails,
  getRecipeRiffLineage,
  analyzeRecipeInventory,
} from '../modules/taxonomy.js';

import { calculateCocktailAbv } from '../modules/abv.js';
import { calculateBalanceProfile, renderFlavorRadarSvg } from '../modules/balance.js';
import { calculateFluidLayers, getIngredientColor } from '../modules/colors.js';
import { formatFraction, parseMethodContent } from '../modules/parser.js';
import { GlassView, renderGlassSvg } from '../modules/glass-view.js';
import { setupTagAutocomplete, filterByTag } from './recipe-list-view.js';
import { escapeHtml, showToast } from '../components/toast.js';

let _selectRecipeFn = null;
let _openEditorFn = null;
let _updateMyBarBadgeFn = null;
let _updateVaultStatsFn = null;
let _setUnitSystemFn = null;
let _setGlassViewModeFn = null;
let _toggleInventoryBottleFn = null;
let _renderRecipeListFn = null;
let _renderHomeViewFn = null;

export function setCounterViewCallbacks(cbs) {
  if (cbs.selectRecipe) _selectRecipeFn = cbs.selectRecipe;
  if (cbs.openEditor) _openEditorFn = cbs.openEditor;
  if (cbs.updateMyBarBadge) _updateMyBarBadgeFn = cbs.updateMyBarBadge;
  if (cbs.updateVaultStats) _updateVaultStatsFn = cbs.updateVaultStats;
  if (cbs.setUnitSystem) _setUnitSystemFn = cbs.setUnitSystem;
  if (cbs.setGlassViewMode) _setGlassViewModeFn = cbs.setGlassViewMode;
  if (cbs.toggleInventoryBottle) _toggleInventoryBottleFn = cbs.toggleInventoryBottle;
  if (cbs.renderRecipeList) _renderRecipeListFn = cbs.renderRecipeList;
  if (cbs.renderHomeView) _renderHomeViewFn = cbs.renderHomeView;
}

/**
 * Screen Wake Lock — keeps display awake while viewing a recipe on the counter.
 */
let wakeLockSentinel = null;

export async function requestWakeLock() {
  if (!('wakeLock' in navigator) || wakeLockSentinel) return;
  try {
    wakeLockSentinel = await navigator.wakeLock.request('screen');
    wakeLockSentinel.addEventListener('release', () => {
      wakeLockSentinel = null;
      updateWakeLockIndicator();
    });
    updateWakeLockIndicator();
  } catch (err) {
    wakeLockSentinel = null;
    updateWakeLockIndicator();
  }
}

export function releaseWakeLock() {
  const sentinel = wakeLockSentinel;
  wakeLockSentinel = null;
  if (sentinel) {
    sentinel.release().catch(() => {});
  }
  updateWakeLockIndicator();
}

export function updateWakeLockIndicator() {
  const btn = document.getElementById('btn-wake-lock');
  if (!btn) return;
  const active = !!wakeLockSentinel;
  btn.classList.toggle('active', active);
  btn.setAttribute('aria-pressed', String(active));
  btn.title = active
    ? 'Screen will stay awake while you view this drink (tap to allow it to sleep)'
    : 'Screen may turn off automatically (tap to keep it awake)';
}

/**
 * Duplicate a recipe
 */
export function duplicateRecipe(recipe) {
  const copy = {
    ...JSON.parse(JSON.stringify(recipe)),
    id: undefined,
    name: `${recipe.name} (Copy)`,
    tags: Array.isArray(recipe.tags) ? [...recipe.tags] : [],
  };

  const saved = saveRecipe(copy);
  state.recipes = getRecipes();
  if (_selectRecipeFn) _selectRecipeFn(saved.id);
  showToast(`Created duplicate: "${saved.name}"`);
}

/**
 * Toggle hide/unhide status for a seed recipe.
 */
export function toggleHideRecipe(recipe) {
  if (!recipe || !recipe.id) return;
  const currentlyHidden = isRecipeHidden(recipe.id);

  const listItemEl = elements.recipeList?.querySelector(`.recipe-list-item[data-id="${recipe.id}"]`);

  const executeHideStateUpdate = () => {
    state.recipes = getRecipes();
    if (_renderRecipeListFn) _renderRecipeListFn();
    if (state.viewMode === 'counter') {
      renderCounterView();
    } else if (state.viewMode === 'home') {
      if (_renderHomeViewFn) _renderHomeViewFn();
    }
    if (_updateVaultStatsFn) _updateVaultStatsFn();
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
export function confirmDeleteRecipe(recipe) {
  if (confirm(`Delete "${recipe.name}" from your library? This cannot be undone.`)) {
    const listItemEl = elements.recipeList?.querySelector(`.recipe-list-item[data-id="${recipe.id}"]`);

    const executeDelete = () => {
      const updated = deleteRecipe(recipe.id);
      state.recipes = updated;
      if (state.recipes.length > 0) {
        if (_selectRecipeFn) _selectRecipeFn(state.recipes[0].id);
      } else {
        state.activeRecipeId = null;
        history.replaceState(null, '', window.location.pathname);
        try {
          localStorage.removeItem('speakeasy_last_active_recipe');
        } catch {
          // Ignore
        }
        if (_renderRecipeListFn) _renderRecipeListFn();
        renderCounterView();
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
 * Render Counter View (optimized for high-contrast viewing on bar counter)
 */
export function renderCounterView() {
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

  const flavorProfile = calculateBalanceProfile(effectiveSpecs);
  const flavorRadarSvg = renderFlavorRadarSvg(flavorProfile);

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

        <!-- Action Toolbar -->
        <div class="drink-actions-cluster" role="toolbar" aria-label="Recipe actions">
          ${'wakeLock' in navigator ? `
            <button id="btn-wake-lock" class="action-icon-btn wake-lock-btn" title="Keep screen awake while mixing" aria-label="Toggle keep-screen-awake" aria-pressed="false">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="4"></circle>
                <line x1="12" y1="2" x2="12" y2="4"></line>
                <line x1="12" y1="20" x2="12" y2="22"></line>
                <line x1="4.93" y1="4.93" x2="6.34" y2="6.34"></line>
                <line x1="17.66" y1="17.66" x2="19.07" y2="19.07"></line>
                <line x1="2" y1="12" x2="4" y2="12"></line>
                <line x1="20" y1="12" x2="22" y2="12"></line>
                <line x1="4.93" y1="19.07" x2="6.34" y2="17.66"></line>
                <line x1="17.66" y1="6.34" x2="19.07" y2="4.93"></line>
              </svg>
              <span class="action-btn-text">Awake</span>
            </button>
          ` : ''}
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

      <!-- Status banner when recipe is hidden -->
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

        <!-- Flavor Radar: Desktop placement, directly below "Make a Riff" -->
        <div class="flavor-radar-card flavor-radar-desktop">
          <span class="flavor-radar-title">Flavor Profile</span>
          ${flavorRadarSvg}
        </div>
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

        <!-- Flavor Radar: Mobile placement, directly above the tag cloud -->
        <div class="flavor-radar-card flavor-radar-mobile">
          <span class="flavor-radar-title">Flavor Profile</span>
          ${flavorRadarSvg}
        </div>

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

    <!-- Similar Cocktails Shelf -->
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
      if (targetMode && _setGlassViewModeFn) {
        _setGlassViewModeFn(targetMode);
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
      if (bottleId && _toggleInventoryBottleFn) {
        _toggleInventoryBottleFn(bottleId);
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
        if (_updateMyBarBadgeFn) _updateMyBarBadgeFn();
        if (_renderRecipeListFn) _renderRecipeListFn();
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
    if (_selectRecipeFn) _selectRecipeFn(saved.id);
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
      if (targetId && _selectRecipeFn) _selectRecipeFn(targetId);
    });
    el.addEventListener('keydown', (e) => {
      if ((e.key === 'Enter' || e.key === ' ') && targetId) {
        e.preventDefault();
        if (_selectRecipeFn) _selectRecipeFn(targetId);
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
    if (_setUnitSystemFn) _setUnitSystemFn('oz');
  });

  document.getElementById('btn-unit-ml')?.addEventListener('click', () => {
    if (_setUnitSystemFn) _setUnitSystemFn('ml');
  });

  document.getElementById('btn-wake-lock')?.addEventListener('click', () => {
    if (wakeLockSentinel) {
      releaseWakeLock();
    } else {
      requestWakeLock();
    }
  });
  updateWakeLockIndicator();

  document.getElementById('btn-edit-drink')?.addEventListener('click', () => {
    if (_openEditorFn) _openEditorFn(recipe);
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
    window.scrollTo({ top: 1 });
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
    if (_renderRecipeListFn) _renderRecipeListFn();
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
      if (_renderRecipeListFn) _renderRecipeListFn();
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

  // Sticky Header Title Observer (Mobile and Desktop)
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
