/**
 * Speakeasy Top Bar & Vault Settings Popover Component
 */

import { state, elements, SEED_RECIPE_IDS, invalidateInventoryCache } from '../state.js';
import {
  saveUnitPreference,
  saveGlassViewPreference,
  saveBarName,
  getHiddenRecipeIds,
  getInventory,
  getUnitPreference,
  getSortPreference,
  getGlassViewPreference,
  exportData,
  importData,
  resetToDefaults,
} from '../modules/storage.js';

import { isAuthenticated, getUser, logout, AUTH_EVENT_NAME } from '../modules/auth.js';
import { showToast } from './toast.js';

let _goHomeFn = null;
let _openEditorFn = null;
let _selectRecipeFn = null;
let _renderCounterViewFn = null;
let _renderHomeViewFn = null;
let _renderRecipeListFn = null;
let _openBackbarModalFn = null;
let _updateBackbarActionButtonsFn = null;
let _openAuthModalFn = null;

export function setTopBarCallbacks(cbs) {
  if (cbs.goHome) _goHomeFn = cbs.goHome;
  if (cbs.openEditor) _openEditorFn = cbs.openEditor;
  if (cbs.selectRecipe) _selectRecipeFn = cbs.selectRecipe;
  if (cbs.renderCounterView) _renderCounterViewFn = cbs.renderCounterView;
  if (cbs.renderHomeView) _renderHomeViewFn = cbs.renderHomeView;
  if (cbs.renderRecipeList) _renderRecipeListFn = cbs.renderRecipeList;
  if (cbs.openBackbarModal) _openBackbarModalFn = cbs.openBackbarModal;
  if (cbs.updateBackbarActionButtons) _updateBackbarActionButtonsFn = cbs.updateBackbarActionButtons;
  if (cbs.openAuthModal) _openAuthModalFn = cbs.openAuthModal;
}

/**
 * Update vault stats line in Settings popover
 */
export function updateVaultStats() {
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
export function setUnitSystem(unit) {
  if (unit !== 'oz' && unit !== 'ml') return;
  state.unitSystem = unit;
  saveUnitPreference(unit);

  if (elements.popoverUnitOz && elements.popoverUnitMl) {
    elements.popoverUnitOz.classList.toggle('active', unit === 'oz');
    elements.popoverUnitMl.classList.toggle('active', unit === 'ml');
  }

  if (state.viewMode === 'counter' && state.activeRecipeId) {
    if (_renderCounterViewFn) _renderCounterViewFn();
  }

  showToast(`Units switched to ${unit === 'oz' ? 'Ounces (oz)' : 'Milliliters (ml)'}`);
}

/**
 * Set default glass view mode (layered vs blended) and persist choice
 */
export function setGlassViewMode(mode) {
  if (mode !== 'layered' && mode !== 'blended') return;
  if (state.glassViewMode === mode) return;
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
}

/**
 * Set library list sort preference, persist to storage, and re-render sidebar
 */
export function setLibrarySort(sortOption) {
  if (state.sortPreference === sortOption) return;
  state.sortPreference = sortOption;
  saveSortPreference(sortOption);

  if (elements.sidebarSortSelect && elements.sidebarSortSelect.value !== sortOption) {
    elements.sidebarSortSelect.value = sortOption;
  }

  if (_renderRecipeListFn) _renderRecipeListFn();

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
export function updateMyBarBadge() {
  const count = state.inventory.size;
  if (elements.myBarBadge) {
    elements.myBarBadge.textContent = count;
  }
  if (elements.backbarSummaryText) {
    elements.backbarSummaryText.textContent = `${count} ${count === 1 ? 'bottle' : 'bottles'} in your backbar`;
  }
  if (_updateBackbarActionButtonsFn) _updateBackbarActionButtonsFn();
  updateVaultStats();
}

/**
 * Handle JSON file upload
 */
export function handleFileImport(e) {
  const file = e.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const content = event.target.result;
      const { recipes, importedRecipeCount, inventoryAddedCount } = importData(content);

      state.recipes = recipes;
      if (!state.recipes.find(r => r.id === state.activeRecipeId)) {
        state.activeRecipeId = state.recipes[0]?.id || null;
      }
      state.inventory = new Set(getInventory());
      state.unitSystem = getUnitPreference();
      state.sortPreference = getSortPreference();
      state.glassViewMode = getGlassViewPreference();
      invalidateInventoryCache();

      if (elements.popoverUnitOz && elements.popoverUnitMl) {
        elements.popoverUnitOz.classList.toggle('active', state.unitSystem === 'oz');
        elements.popoverUnitMl.classList.toggle('active', state.unitSystem === 'ml');
      }
      if (elements.popoverGlassLayered && elements.popoverGlassBlended) {
        elements.popoverGlassLayered.classList.toggle('active', state.glassViewMode === 'layered');
        elements.popoverGlassBlended.classList.toggle('active', state.glassViewMode === 'blended');
      }
      if (elements.sidebarSortSelect) {
        elements.sidebarSortSelect.value = state.sortPreference;
      }

      if (_renderRecipeListFn) _renderRecipeListFn();
      if (_renderCounterViewFn && state.viewMode === 'counter') {
        _renderCounterViewFn();
      } else if (_renderHomeViewFn && state.viewMode === 'home') {
        _renderHomeViewFn();
      }
      updateMyBarBadge();
      updateVaultStats();

      showToast(`Imported ${importedRecipeCount} custom recipe${importedRecipeCount === 1 ? '' : 's'}, ${inventoryAddedCount} inventory item${inventoryAddedCount === 1 ? '' : 's'}`);
    } catch (err) {
      alert(`Import failed: ${err.message}`);
    } finally {
      elements.importFileInput.value = '';
    }
  };
  reader.readAsText(file);
}

/**
 * Set up top bar and vault popover event listeners
 */
export function setupTopBarEventListeners() {
  elements.btnGoHome?.addEventListener('click', () => {
    if (_goHomeFn) _goHomeFn();
  });

  elements.btnFooterHome?.addEventListener('click', () => {
    if (_goHomeFn) _goHomeFn();
  });

  elements.btnNewDrink?.addEventListener('click', () => {
    if (_openEditorFn) _openEditorFn(null);
  });

  elements.btnPopoverNewDrink?.addEventListener('click', () => {
    if (elements.vaultPopover?.hidePopover) {
      try {
        elements.vaultPopover.hidePopover();
      } catch (err) {
        // Ignore if already hidden
      }
    }
    if (_openEditorFn) _openEditorFn(null);
  });

  elements.btnExportJson?.addEventListener('click', () => {
    exportData();
    showToast('Exported bar backup to JSON');
  });

  elements.btnImportTrigger?.addEventListener('click', () => {
    elements.importFileInput?.click();
  });

  elements.importFileInput?.addEventListener('change', handleFileImport);

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
    if (state.viewMode === 'home' && _renderHomeViewFn) {
      _renderHomeViewFn();
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
      if (_renderRecipeListFn) _renderRecipeListFn();
      if (state.recipes.length > 0 && _selectRecipeFn) {
        _selectRecipeFn(state.recipes[0].id, false);
      }
      updateVaultStats();
      updateMyBarBadge();
      elements.vaultPopover?.hidePopover?.();
      showToast('Vault reset to default cocktail library');
    }
  });

  elements.btnMyBar?.addEventListener('click', () => {
    if (_openBackbarModalFn) _openBackbarModalFn();
  });

  elements.btnSignIn?.addEventListener('click', () => {
    if (_openAuthModalFn) _openAuthModalFn();
  });

  elements.btnSignOut?.addEventListener('click', async () => {
    if (elements.userPopover?.hidePopover) {
      try {
        elements.userPopover.hidePopover();
      } catch (err) {
        // Ignore if already hidden
      }
    }
    await logout();
    showToast('Signed out');
  });

  // Listen to speakeasy:auth-changed to update the UI reactively
  if (typeof window !== 'undefined') {
    window.addEventListener(AUTH_EVENT_NAME, () => {
      updateAuthIndicator();
    });
  }

  // Initial indicator sync
  updateAuthIndicator();
}

/**
 * Updates the top bar auth button and avatar pill based on current authentication state
 */
export function updateAuthIndicator() {
  const loggedIn = isAuthenticated();
  const user = getUser();

  if (elements.btnSignIn) {
    elements.btnSignIn.style.display = loggedIn ? 'none' : 'inline-flex';
  }

  if (elements.btnUserPill) {
    elements.btnUserPill.style.display = loggedIn ? 'inline-flex' : 'none';
  }

  if (loggedIn && user) {
    const displayName = user.displayName || user.email || 'User';
    const initial = (displayName.charAt(0) || 'U').toUpperCase();

    if (elements.userPillAvatar) {
      elements.userPillAvatar.textContent = initial;
    }
    if (elements.userPillName) {
      elements.userPillName.textContent = displayName;
    }
    if (elements.userPopoverEmail) {
      elements.userPopoverEmail.textContent = user.email || displayName;
    }
  }
}
