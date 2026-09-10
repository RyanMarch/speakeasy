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

import { calculateCocktailAbv, calculateCocktailCalories } from '../modules/abv.js';
import { calculateBalanceProfile, renderFlavorRadarSvg, calculatePalateSimilarity } from '../modules/balance.js';
import { calculateFluidLayers, getIngredientColor } from '../modules/colors.js';
import { formatFraction, parseMethodContent, renderInstructionTimers, formatIngredientName } from '../modules/parser.js';
import { GlassView, renderGlassSvg } from '../modules/glass-view.js';
import { setupTagAutocomplete, filterByTag } from './recipe-list-view.js';
import { escapeHtml, showToast } from '../components/toast.js';
import { openTimerModal } from '../components/timer-modal.js';

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
 * Screen Wake Lock — keeps display awake while viewing a recipe on the
 * counter. Ambient: requested automatically whenever the counter view is
 * shown (see router.js) and released on navigating away, with no manual
 * toggle — a button here would need to explain what it does and show what
 * state it's in, and "the screen stays on while you're looking at a drink"
 * doesn't need either.
 */
let wakeLockSentinel = null;

export async function requestWakeLock() {
  if (!('wakeLock' in navigator) || wakeLockSentinel) return;
  try {
    wakeLockSentinel = await navigator.wakeLock.request('screen');
    wakeLockSentinel.addEventListener('release', () => {
      wakeLockSentinel = null;
    });
  } catch (err) {
    wakeLockSentinel = null;
  }
}

export function releaseWakeLock() {
  const sentinel = wakeLockSentinel;
  wakeLockSentinel = null;
  if (sentinel) {
    sentinel.release().catch(() => { });
  }
}

/**
 * Build a draft riff recipe pre-populated from a canonical seed cocktail's specs,
 * for handing to the editor. Seed cocktails are never edited in place (see
 * `SEED_RECIPE_IDS`); this is how a user turns one into a starting point instead.
 */
export function buildRiffDraft(seedRecipe) {
  const tags = Array.isArray(seedRecipe.tags) ? seedRecipe.tags.filter(t => t !== 'riff') : [];
  return {
    id: null,
    name: `My ${seedRecipe.name}`,
    glassware: seedRecipe.glassware,
    method: seedRecipe.method,
    garnish: seedRecipe.garnish || '',
    description: '',
    instructions: seedRecipe.instructions || '',
    source: '',
    sourceUrl: '',
    notes: '',
    riffOfId: seedRecipe.id,
    riffOfName: seedRecipe.name,
    tags: [...tags, 'riff'],
    specs: (seedRecipe.specs || []).map(s => ({ ...s })),
  };
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
 * Formats a numeric palate match percentage into a plain English descriptor and tier styling class.
 * @param {number} percentage
 * @returns {{ label: string, tierClass: string }}
 */
export function formatPalateMatchLabel(percentage) {
  const match = Math.round(percentage);
  if (match >= 91) return { label: 'Close Match', tierClass: 'match-high' };
  if (match >= 80) return { label: 'Similar Vibe', tierClass: 'match-mid' };
  return null;
}

/**
 * Discovers similar and riff-connected cocktails across the vault with palate similarity integration.
 * Guarantees parent/child/sibling recipes as top priority, then ranks remaining candidates
 * by palate match percentage and shared technique/profile.
 */
export function getEnhancedSimilarCocktails(currentRecipe, allRecipes = []) {
  if (!currentRecipe || !Array.isArray(allRecipes)) return [];

  const lineageMatches = findSimilarCocktails(currentRecipe, allRecipes);
  const results = [];
  const addedIds = new Set([currentRecipe.id]);

  // Direct Riff / Lineage: Top priority (parent, child, and sibling riffs remain first)
  for (const item of lineageMatches) {
    if (item.isParent || item.isChild || item.isSibling) {
      const palateMatch = calculatePalateSimilarity(currentRecipe, item.recipe);
      results.push({
        ...item,
        palateMatch,
      });
      addedIds.add(item.recipe.id);
    }
  }

  // Palate & Balance Matches: Rank remaining catalog recipes by palate similarity and shared technique
  const candidates = [];
  for (const candidate of allRecipes) {
    if (addedIds.has(candidate.id)) continue;

    const palateMatch = calculatePalateSimilarity(currentRecipe, candidate);
    let techniqueScore = 0;

    if (candidate.method && currentRecipe.method && candidate.method.toLowerCase() === currentRecipe.method.toLowerCase()) {
      techniqueScore += 10;
    }
    if (candidate.glassware && currentRecipe.glassware && candidate.glassware.toLowerCase() === currentRecipe.glassware.toLowerCase()) {
      techniqueScore += 5;
    }

    const existingStyleMatch = lineageMatches.find(m => m.recipe.id === candidate.id);
    if (existingStyleMatch) {
      techniqueScore += (existingStyleMatch.matchCount || 2) * 5;
    }

    const totalScore = palateMatch * 0.7 + techniqueScore * 0.3;

    candidates.push({
      recipe: candidate,
      relation: existingStyleMatch ? existingStyleMatch.relation : 'Similar Style',
      badgeClass: existingStyleMatch ? existingStyleMatch.badgeClass : 'badge-family',
      palateMatch,
      totalScore,
    });
  }

  candidates.sort((a, b) => b.totalScore - a.totalScore || b.palateMatch - a.palateMatch);

  for (const candidate of candidates) {
    if (results.length >= 6) break;
    results.push(candidate);
    addedIds.add(candidate.recipe.id);
  }

  return results.slice(0, 6);
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

  const hasActiveRiffs = Object.keys(state.activeRiffs).length > 0
    || Object.keys(state.riffAmountOverrides).length > 0
    || state.riffExtraSpecs.length > 0
    || state.riffRemovedSpecs.size > 0;

  const baseEffectiveSpecs = (recipe.specs || [])
    .map((spec, index) => {
      const riffId = state.activeRiffs[index];
      const amountOverride = state.riffAmountOverrides[index];
      const amount = amountOverride !== undefined ? amountOverride : spec.amount;
      const amountChanged = amountOverride !== undefined && amountOverride !== spec.amount;
      if (riffId && TAXONOMY[riffId]) {
        return {
          ...spec,
          amount,
          amountChanged,
          name: TAXONOMY[riffId].name,
          originalName: spec.name,
          isRiff: true,
          riffId,
        };
      }
      return {
        ...spec,
        amount,
        amountChanged,
        originalName: spec.name,
        isRiff: false,
      };
    })
    // Index is captured above (before filtering), so amount overrides / riffs keyed
    // by the *original* recipe.specs position still line up correctly.
    .filter((_, index) => !state.riffRemovedSpecs.has(index));

  // Extra ingredients added while riffing. A row with an empty name is an
  // in-progress draft the user hasn't finished typing yet — keep it out of the
  // glass/ABV/flavor math and out of "Save Riff", but still show/edit it while
  // riff mode is on so it doesn't just vanish before they've named it.
  const extraEffectiveSpecs = state.riffExtraSpecs
    .map((extra, extraIndex) => ({
      amount: extra.amount,
      unit: extra.unit || 'oz',
      name: extra.name || '',
      originalName: extra.name || '',
      isRiff: false,
      isExtra: true,
      extraIndex,
    }))
    .filter(s => state.riffModeActive || (s.name.trim() && s.amount));

  const effectiveSpecs = [...baseEffectiveSpecs, ...extraEffectiveSpecs];

  const effectiveRecipe = {
    ...recipe,
    specs: effectiveSpecs,
  };

  const similarCocktails = getEnhancedSimilarCocktails(recipe, state.recipes);
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

  // Calorie estimate always reflects a single serving, regardless of the servings stepper
  const calorieInfo = calculateCocktailCalories(effectiveSpecs);
  const calorieDisplay = calorieInfo.totalKcal > 0 ? `~${calorieInfo.totalKcal} kcal` : null;

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
    if (state.riffModeActive && substitutes.length > 0 && !spec.isExtra) {
      riffControlHtml = `
        <div class="spec-riff-wrapper" title="Riff on ${escapeHtml(spec.originalName)}">
          <select class="spec-riff-select ${isRiff ? 'active-riff' : ''}" data-spec-index="${index}" aria-label="Riff on ${escapeHtml(spec.originalName)}">
            <option value="" disabled ${!isRiff ? 'selected' : ''}>Swap</option>
            ${isRiff ? `<option value="__orig__">↺ Back to ${escapeHtml(spec.originalName)}</option>` : ''}
            <optgroup label="Substitutes">
              ${substitutes.map(sub => `
                <option value="${sub.id}" ${spec.riffId === sub.id ? 'selected' : ''}>${escapeHtml(sub.name)}</option>
              `).join('')}
            </optgroup>
          </select>
          ${isRiff ? `<span class="spec-riff-active-label" aria-hidden="true">Swap</span>` : ''}
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

    // Amount: editable in riff mode for every row (existing ingredients and
    // extras alike) — the base (1x, native-unit) value, not the servings-scaled
    // or ml-converted display value, so editing never has to fight that math.
    const amountCellHtml = state.riffModeActive
      ? /*html*/`
        <input type="number" class="spec-amount-input" data-spec-index="${index}" data-is-extra="${spec.isExtra ? '1' : '0'}" data-extra-index="${spec.extraIndex ?? ''}" value="${spec.amount ?? ''}" step="0.25" min="0" inputmode="decimal" aria-label="Amount for ${escapeHtml(spec.name || 'ingredient')}">
        <span class="spec-unit">${escapeHtml(spec.unit || 'oz')}</span>
      `
      : (amountText ? `${escapeHtml(amountText)}<span class="spec-unit">${escapeHtml(unitText)}</span>` : `<span class="spec-unit">${escapeHtml(unitText || 'to taste')}</span>`);

    // Name: a free-text field only for rows the user added themselves — existing
    // ingredients still change identity only through the taxonomy-backed Riff
    // select above, so a swap always resolves to a real, substitutable ingredient.
    const nameCellHtml = (state.riffModeActive && spec.isExtra)
      ? /*html*/`<input type="text" class="spec-name-input" data-extra-index="${spec.extraIndex}" value="${escapeHtml(spec.name)}" placeholder="Ingredient name" aria-label="Ingredient name">`
      : /*html*/`
        <span class="spec-name">${escapeHtml(formatIngredientName(spec.name))}</span>
        ${(isFridgeItem && !state.riffModeActive) ? `<span class="spec-fridge-tag" title="Keep refrigerated once opened">❄</span>` : ''}
        ${(isRiff && !state.riffModeActive) ? `<span class="spec-riff-badge" title="Substituted for ${escapeHtml(spec.originalName)}">sub</span>` : ''}
      `;

    // Remove: available on every row in riff mode, not just ones the user added —
    // dropping an original ingredient entirely is as valid a riff as substituting
    // or resizing it. Replaces the "In Bar" toggle (rather than sitting next to
    // it) so the actions cell stays a single compact icon while riffing instead
    // of stacking two buttons into that already-narrow mobile column.
    const removeSpecBtnHtml = state.riffModeActive
      ? /*html*/`<button type="button" class="btn-remove-spec-row" data-spec-index="${index}" data-is-extra="${spec.isExtra ? '1' : '0'}" data-extra-index="${spec.extraIndex ?? ''}" aria-label="Remove ${escapeHtml(spec.name || 'ingredient')}" title="Remove ingredient"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>`
      : '';

    return `
      <div class="spec-row ${isRiff ? 'is-riffed-row' : ''} ${spec.isExtra ? 'is-extra-row' : ''}" data-spec-index="${index}">
        <div class="spec-amount">
          ${amountCellHtml}
        </div>
        <div class="spec-ingredient">
          <div class="spec-ingredient-name-row">
            ${nameCellHtml}
          </div>
          ${(isRiff && !state.riffModeActive) ? `<div class="spec-riff-orig-note">sub for ${escapeHtml(spec.originalName)}</div>` : ''}
          ${subSuggestionHtml}
        </div>
        ${riffControlHtml}
        <div class="spec-actions">
          ${state.riffModeActive ? removeSpecBtnHtml : stockControlHtml}
        </div>
      </div>
    `;
  }).join('');

  const addRiffIngredientRowHtml = state.riffModeActive ? /*html*/`
    <button type="button" id="btn-add-riff-ingredient" class="btn-add-riff-ingredient">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
      Add Ingredient
    </button>
  ` : '';

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
        <span class="mobile-back-text">Drinks</span>
      </button>
      <div class="mobile-sticky-title" id="mobile-sticky-title" aria-hidden="true">
        <span class="mobile-sticky-name">${escapeHtml(recipe.name)}</span>
      </div>

      <!-- On mobile, the "More" trigger lives here (beside the back button)
           instead of under the title — the same popover, just anchored to
           whichever trigger is visible at the current width, so it never
           strands the title/meta block with an orphaned button row below it. -->
      <button type="button" id="btn-counter-more-mobile" class="action-icon-btn mobile-only-more-btn" popovertarget="counter-more-popover" title="More actions" aria-label="More actions" aria-haspopup="menu">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="5" cy="12" r="1.5"></circle>
          <circle cx="12" cy="12" r="1.5"></circle>
          <circle cx="19" cy="12" r="1.5"></circle>
        </svg>
      </button>
    </div>

    <!-- Drink Title & Meta Header -->
    <header class="drink-title-section">
      <div class="drink-title-row">
        <div class="drink-title-header-left">
          <h2 class="drink-name">${escapeHtml(recipe.name)}</h2>
          <!-- Stats meta row: glass, method, ABV, calories (always fits one line) -->
          <div class="drink-meta-row">
            <span class="drink-meta-item">${escapeHtml(recipe.glassware || 'Glass')}</span>
            <span class="meta-dot-divider">·</span>
            <span class="drink-meta-item">${escapeHtml(recipe.method || 'Standard')}</span>
            <span class="meta-dot-divider">·</span>
            <span class="drink-meta-item" title="Dilution-adjusted estimated alcohol by volume">${escapeHtml(abvDisplay)}</span>
            ${calorieDisplay ? `
              <span class="meta-dot-divider">·</span>
              <span class="drink-meta-item drink-meta-calories">
                ${escapeHtml(calorieDisplay)}
                <button type="button" id="btn-calorie-info" class="btn-calorie-info" aria-label="Calorie estimate info">ⓘ</button>
                <span class="calorie-popover" id="calorie-popover" role="tooltip" aria-hidden="true">~${calorieInfo.alcoholKcal} kcal alcohol &nbsp;·&nbsp; ~${calorieInfo.sugarKcal} kcal sugar &nbsp;·&nbsp; estimates vary by brand</span>
              </span>
            ` : ''}
          </div>
          <!-- Secondary row: lineage, canMake (own line, no dots needed) -->
          ${(lineage || invAnalysis.canMake) ? `
            <div class="drink-meta-secondary">
              ${lineage ? `<span class="drink-meta-riff">Riff on <em>${escapeHtml(lineage.parentName)}</em></span>` : ''}
              ${(lineage && invAnalysis.canMake) ? `<span class="meta-dot-divider">·</span>` : ''}
              ${invAnalysis.canMake ? `<span class="meta-status-ready">Ready to Make</span>` : ''}
            </div>
          ` : ''}
        </div>

        <!-- Action Toolbar: one entry point, everything else tucked into the
             menu — Hide/Delete in particular don't need standing icon-row
             prominence on every visit to the drink. -->
        <div class="drink-actions-cluster" role="toolbar" aria-label="Recipe actions">
          <button type="button" id="btn-counter-more" class="action-icon-btn counter-more-btn" popovertarget="counter-more-popover" title="More actions" aria-label="More actions" aria-haspopup="menu">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <circle cx="5" cy="12" r="1.5"></circle>
              <circle cx="12" cy="12" r="1.5"></circle>
              <circle cx="19" cy="12" r="1.5"></circle>
            </svg>
          </button>
        </div>

        <!-- Deliberately a sibling of .drink-actions-cluster, not nested
             inside it: that cluster is display:none on mobile (its trigger
             moves into the sticky bar instead, see #btn-counter-more-mobile
             above), and a display:none ancestor kills a popover's top-layer
             rendering even while :popover-open — it doesn't matter where in
             the DOM a popover lives since the browser paints it in the top
             layer regardless. -->
        <div id="counter-more-popover" popover="auto" class="counter-more-popover" role="menu" aria-label="More recipe actions">
            <div class="vault-actions-list">
              ${isSeed ? /*html*/ `
                <button type="button" id="btn-edit-drink" class="vault-action-item" role="menuitem">
                  <span class="vault-action-icon">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="16 3 21 3 21 8"></polyline><line x1="4" y1="20" x2="21" y2="3"></line><polyline points="21 16 21 21 16 21"></polyline><line x1="15" y1="15" x2="21" y2="21"></line><line x1="4" y1="4" x2="9" y2="9"></line></svg>
                  </span>
                  <span class="vault-action-meta">
                    <span class="vault-action-label">Edit as New Recipe</span>
                    <span class="vault-action-sub">Create a new drink based on this one.</span>
                  </span>
                </button>
              ` : /*html*/ `
                <button type="button" id="btn-edit-drink" class="vault-action-item" role="menuitem">
                  <span class="vault-action-icon">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                  </span>
                  <span class="vault-action-meta">
                    <span class="vault-action-label">Edit Recipe</span>
                    <span class="vault-action-sub">Change name, method, instructions</span>
                  </span>
                </button>
              `}

              ${isSeed ? /*html*/ `
                <button type="button" id="btn-hide-drink" class="vault-action-item" role="menuitem">
                  <span class="vault-action-icon">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                      <line x1="1" y1="1" x2="23" y2="23"></line>
                    </svg>
                  </span>
                  <span class="vault-action-meta">
                    <span class="vault-action-label">${isCurrentlyHidden ? 'Unhide Recipe' : 'Hide from Library'}</span>
                    ${isCurrentlyHidden ? `<span class="vault-action-sub">Currently hidden from your library</span>` : ''}
                  </span>
                </button>
              ` : /*html*/ `
                <button type="button" id="btn-delete-drink" class="vault-action-item vault-action-danger" role="menuitem">
                  <span class="vault-action-icon">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                  </span>
                  <span class="vault-action-meta">
                    <span class="vault-action-label">Delete Recipe</span>
                  </span>
                </button>
              `}
            </div>
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

        <!-- Flavor Radar: Desktop placement, directly below the glass stats -->
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
              ${(!state.riffModeActive && !hasActiveRiffs) ? /*html*/ `
                <button type="button" id="btn-toggle-riff-mode" class="riff-inline-link" title="Swap ingredients based on your backbar, right here in the list">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M16 3h5v5"></path><path d="M4 20L21 3"></path><path d="M21 16v5h-5"></path><path d="M15 15l6 6"></path><path d="M4 4l5 5"></path>
                  </svg>
                  Riff It
                </button>
              ` : ''}
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

          ${(state.riffModeActive || hasActiveRiffs) ? /*html*/ `
            <!-- Riff status: co-located with the ingredient rows it affects, instead
                 of in the page header, so cause (swapping something below) and
                 effect (Save/Reset here) stay in the same glance. -->
            <div class="riff-status-bar">
              <span class="riff-status-text">
                ${state.riffModeActive
        ? 'Tap an ingredient to swap it, or add/remove rows below.'
        : 'You’ve customized this recipe.'}
              </span>
              <div class="riff-status-actions">
                ${state.riffModeActive ? /*html*/ `
                  <button type="button" id="btn-toggle-riff-mode" class="btn btn-secondary btn-sm" title="Stop editing ingredients">Done Riffing</button>
                ` : `
                  <button type="button" id="btn-toggle-riff-mode" class="btn btn-secondary btn-sm" title="Keep swapping ingredients">Continue Riffing</button>
                `}
                ${hasActiveRiffs ? `
                  <button type="button" id="btn-reset-riff" class="btn btn-secondary btn-sm" title="Revert back to original cocktail specs">Reset</button>
                  <button type="button" id="btn-save-riff" class="btn btn-primary btn-sm" title="Save this riff variation as a new cocktail">Save Riff</button>
                ` : ''}
              </div>
            </div>
          ` : ''}

          <div class="specs-list" id="counter-specs-list">
            ${specsListHtml}
            ${addRiffIngredientRowHtml}
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
                ${parsed.items.map(item => `<li><span>${renderInstructionTimers(item, escapeHtml)}</span></li>`).join('')}
              </ol>
            `;
      } else if (parsed.type === 'unordered') {
        methodBodyHtml = /*html*/ `
              <ul class="card-method-list card-method-unordered">
                ${parsed.items.map(item => `<li><span>${renderInstructionTimers(item, escapeHtml)}</span></li>`).join('')}
              </ul>
            `;
      } else {
        methodBodyHtml = /*html*/ `
              <div class="card-content-text card-instructions">${renderInstructionTimers(rawMethodText, escapeHtml)}</div>
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

        <!-- Flavor Radar: Mobile placement, directly above the tag cloud.
             Wrapped in .recipe-editorial-section like Method/Notes above, so
             its heading matches theirs full-width instead of inheriting the
             centered/narrow-card width — and that section (not just the card
             inside it) is what's hidden on desktop, so the heading doesn't
             keep rendering there above nothing once its card is hidden (the
             desktop radar lives in the sidebar instead, labeled inline on its
             own card — see flavor-radar-desktop). -->
        <div class="recipe-editorial-section flavor-radar-section-mobile">
          <h3 class="editorial-section-title">Flavor Profile</h3>
          <div class="flavor-radar-card flavor-radar-mobile">
            ${flavorRadarSvg}
          </div>
        </div>

        <!-- Editorial Footer: Source Citation & Tags -->
        <footer class="recipe-editorial-footer">
          ${recipe.source ? /*html*/`
            <div class="editorial-source">
              <span class="editorial-source-label">Source:</span>
              ${recipe.source.startsWith('http') ? `<a href="${escapeHtml(recipe.source)}" target="_blank" rel="noopener">${escapeHtml(recipe.source)}</a>` : `<span>${escapeHtml(recipe.source)}</span>`}
            </div>
          ` : ''}
          <div class="drink-tags-bar">
            <div class="drink-tags-chips">
              ${(recipe.tags || []).map(tag => /*html*/`
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
        ${(invAnalysis.isBottleNext && invAnalysis.missingItems.length === 1) ? /*html*/`
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
          ${similarCocktails.map((item, idx) => {
      const isGenealogy = item.relation && item.relation !== 'Similar Style';
      const palateInfo = item.palateMatch !== undefined ? formatPalateMatchLabel(item.palateMatch) : null;
      return `
            <div class="similar-cocktail-card" data-recipe-id="${escapeHtml(item.recipe.id)}" role="button" tabindex="0">
              <div class="similar-card-glass">
                ${renderGlassSvg(item.recipe, `sim-glass-${item.recipe.id}-${idx}`)}
              </div>
              <div class="similar-card-body">
                <div class="similar-card-badges">
                  ${isGenealogy ? `<span class="similar-relation-badge ${item.badgeClass || ''}">${escapeHtml(item.relation)}</span>` : ''}
                  ${palateInfo ? `<span class="similar-palate-badge ${palateInfo.tierClass}" title="${item.palateMatch}% palate match">${escapeHtml(palateInfo.label)}</span>` : ''}
                </div>
                <h4 class="similar-card-name" title="${escapeHtml(item.recipe.name)}">${escapeHtml(item.recipe.name)}</h4>
                <div class="similar-card-meta">
                  <span>${escapeHtml(item.recipe.glassware || 'Glass')}</span>
                  <span class="meta-dot">•</span>
                  <span>${escapeHtml(item.recipe.method || 'Build')}</span>
                </div>
                <div class="similar-card-specs" title="${escapeHtml((item.recipe.specs || []).map(s => formatIngredientName(s.name)).join(', '))}">
                  ${(item.recipe.specs || []).map(s => escapeHtml(formatIngredientName(s.name))).filter(Boolean).slice(0, 3).join(', ')}
                </div>
              </div>
            </div>
          `;
    }).join('')}
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

  // Riff Mode: amount edits, on both existing specs and rows the user added
  elements.counterViewContainer.querySelectorAll('.spec-amount-input').forEach(input => {
    input.addEventListener('change', (e) => {
      const raw = parseFloat(e.target.value);
      const amount = Number.isFinite(raw) && raw >= 0 ? raw : 0;
      if (e.target.getAttribute('data-is-extra') === '1') {
        const extraIndex = parseInt(e.target.getAttribute('data-extra-index'), 10);
        if (state.riffExtraSpecs[extraIndex]) {
          state.riffExtraSpecs[extraIndex].amount = amount;
        }
      } else {
        const idx = parseInt(e.target.getAttribute('data-spec-index'), 10);
        state.riffAmountOverrides[idx] = amount;
      }
      renderCounterView();
    });
  });

  // Riff Mode: name edits on rows the user added
  elements.counterViewContainer.querySelectorAll('.spec-name-input').forEach(input => {
    input.addEventListener('change', (e) => {
      const extraIndex = parseInt(e.target.getAttribute('data-extra-index'), 10);
      if (state.riffExtraSpecs[extraIndex]) {
        state.riffExtraSpecs[extraIndex].name = e.target.value.trim();
      }
      renderCounterView();
    });
  });

  // Riff Mode: remove an ingredient — either one the user added (splice out of
  // riffExtraSpecs) or an original recipe spec (mark its index removed; "Reset
  // Riff" is what brings it back, same as every other riff-mode edit).
  elements.counterViewContainer.querySelectorAll('.btn-remove-spec-row').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.getAttribute('data-is-extra') === '1') {
        const extraIndex = parseInt(btn.getAttribute('data-extra-index'), 10);
        state.riffExtraSpecs.splice(extraIndex, 1);
      } else {
        const idx = parseInt(btn.getAttribute('data-spec-index'), 10);
        state.riffRemovedSpecs.add(idx);
      }
      renderCounterView();
    });
  });

  // Riff Mode: add a new ingredient row, then focus its name field once rendered
  document.getElementById('btn-add-riff-ingredient')?.addEventListener('click', () => {
    state.riffExtraSpecs.push({ amount: 0.5, unit: 'oz', name: '' });
    renderCounterView();
    requestAnimationFrame(() => {
      const inputs = elements.counterViewContainer.querySelectorAll('.spec-name-input');
      inputs[inputs.length - 1]?.focus();
    });
  });

  document.getElementById('btn-reset-riff')?.addEventListener('click', () => {
    state.activeRiffs = {};
    state.riffAmountOverrides = {};
    state.riffExtraSpecs = [];
    state.riffRemovedSpecs = new Set();
    renderCounterView();
    showToast('Reverted to original recipe specs');
  });

  document.getElementById('btn-save-riff')?.addEventListener('click', () => {
    // A row added but never named is an abandoned draft, not something to save.
    const savableSpecs = effectiveSpecs.filter(s => !s.isExtra || (s.name && s.name.trim()));

    const swapped = savableSpecs.filter(s => s.isRiff);
    const amountTweaked = savableSpecs.filter(s => !s.isRiff && !s.isExtra && s.amountChanged);
    const added = savableSpecs.filter(s => s.isExtra);
    // Removed specs never make it into effectiveSpecs at all — read them back
    // off the original recipe using the indices tracked in riffRemovedSpecs.
    const removed = (recipe.specs || []).filter((_, idx) => state.riffRemovedSpecs.has(idx));

    const changeDescriptions = [
      ...swapped.map(s => `substituted ${s.originalName} with ${s.name}`),
      ...amountTweaked.map(s => `adjusted ${s.name} to ${formatFraction(s.amount)} ${s.unit || 'oz'}`),
      ...added.map(s => `added ${s.name}`),
      ...removed.map(s => `removed ${s.name}`),
    ];

    // Prefer naming the riff after substitutions (the most "this is a different
    // drink" kind of change); fall back to additions, then removals, then a
    // generic label for amount-only tweaks, which don't really give the riff a
    // new identity.
    const nameSuffix = swapped.length > 0
      ? swapped.map(s => s.name).join(' / ')
      : added.length > 0
        ? added.map(s => s.name).join(' / ')
        : removed.length > 0
          ? `No ${removed.map(s => s.name).join(' / ')}`
          : 'Custom';
    const newName = `${recipe.name} (${nameSuffix} Riff)`;
    const changeSummary = changeDescriptions.length > 0
      ? `Riff on ${recipe.name}: ${changeDescriptions.join(', ')}.`
      : `Riff on ${recipe.name}.`;

    const newRecipe = {
      ...recipe,
      id: undefined,
      name: newName,
      description: recipe.description ? `${recipe.description}\n\n${changeSummary}` : changeSummary,
      riffOfId: recipe.id,
      riffOfName: recipe.name,
      tags: Array.isArray(recipe.tags) ? [...recipe.tags, 'riff'] : ['riff'],
      specs: savableSpecs.map(s => ({
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
    state.riffAmountOverrides = {};
    state.riffExtraSpecs = [];
    state.riffRemovedSpecs = new Set();
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

  // Wire Smart Counter Timer token chips
  elements.counterViewContainer.querySelectorAll('.timer-token').forEach(token => {
    token.addEventListener('click', (e) => {
      e.stopPropagation();
      const seconds = parseInt(token.getAttribute('data-seconds'), 10);
      if (seconds > 0) {
        openTimerModal(seconds);
      }
    });
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

  // Native popover auto-dismisses on an outside click, but not on a click of
  // its own menu items — close it manually once an action's been chosen.
  document.getElementById('counter-more-popover')?.querySelectorAll('.vault-action-item').forEach(item => {
    item.addEventListener('click', () => {
      document.getElementById('counter-more-popover')?.hidePopover();
    });
  });

  document.getElementById('btn-calorie-info')?.addEventListener('click', (e) => {
    e.stopPropagation();
    const popover = document.getElementById('calorie-popover');
    if (!popover) return;
    const isOpen = popover.classList.toggle('is-open');
    popover.setAttribute('aria-hidden', String(!isOpen));
  });

  // Close calorie popover on any outside click
  const closeCaloriePopover = () => document.getElementById('calorie-popover')?.classList.remove('is-open');
  document.addEventListener('click', closeCaloriePopover, { once: true });

  document.getElementById('btn-edit-drink')?.addEventListener('click', () => {
    if (!_openEditorFn) return;
    _openEditorFn(isSeed ? buildRiffDraft(recipe) : recipe);
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
    // Measured, not hardcoded: the header's real height includes
    // env(safe-area-inset-top) on notched devices (see --mobile-header-height in
    // responsive.css), which varies by device and isn't knowable as a constant here.
    const headerEl = document.querySelector('.app-header');
    const headerHeight = isMobile ? (headerEl?.getBoundingClientRect().height || 52) : 0;
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
