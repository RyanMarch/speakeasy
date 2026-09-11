/**
 * Speakeasy Top Bar & Vault Settings Popover Component
 */

import { state, elements, SEED_RECIPE_IDS, resyncBarState, switchActiveBar } from '../state.js';
import {
  saveUnitPreference,
  saveGlassViewPreference,
  getBarName,
  getBars,
  getActiveBarId,
  createBar,
  renameBar,
  deleteBar,
  getHiddenRecipeIds,
  getRecipes,
  getInventoryForBar,
  getUnitPreference,
  getSortPreference,
  getGlassViewPreference,
  getWakeLockPreference,
  saveWakeLockPreference,
  getMenus,
  exportData,
  importData,
  resetToDefaults,
  clearUserDataOnSignOut,
  getLastSyncedAt,
  saveLastSyncedAt,
  getLastExportedAt,
  saveLastExportedAt,
  getAvatarRecipeId,
  saveAvatarRecipeId,
  getAllUniqueTags,
  savePinnedTags,
  normalizeTagName,
} from '../modules/storage.js';
import { renderGlassSvg } from '../modules/glass-view.js';
import { formatTagTitle } from '../views/home-view.js';
import { setupTagAutocomplete } from '../views/recipe-list-view.js';

import {
  isAuthenticated,
  getUser,
  logout,
  deleteAccount,
  migrateGuestData,
  pullRemoteData,
  checkSession,
  updateDisplayName,
  AUTH_EVENT_NAME,
} from '../modules/auth.js';
import { getDrinkHistory } from '../modules/history.js';
import { openHiddenModal, closeHiddenModal } from './hidden-modal.js';
import { closeBackbarModal } from './backbar-modal.js';
import { closeAuthModal } from './auth-modal.js';
import { showToast, escapeHtml } from './toast.js';

/**
 * Calculates mixologist rank based on drinks poured and custom riffs created.
 */
function getMixologistRank() {
  const historyEntries = Array.isArray(getDrinkHistory()) ? getDrinkHistory() : [];
  const drinksPoured = historyEntries.length;
  const customRiffs = state.recipes.filter(r => !SEED_RECIPE_IDS.has(r.id)).length;
  const totalScore = drinksPoured + (customRiffs * 2);

  if (totalScore >= 50) return 'Master Distiller';
  if (totalScore >= 20) return 'Head Mixologist';
  if (totalScore >= 8) return 'Bartender';
  if (totalScore >= 3) return 'Barback';
  return 'Apprentice';
}

let _goHomeFn = null;
let _openEditorFn = null;
let _selectRecipeFn = null;
let _renderCounterViewFn = null;
let _renderHomeViewFn = null;
let _renderRecipeListFn = null;
let _openBackbarModalFn = null;
let _updateBackbarActionButtonsFn = null;
let _openAuthModalFn = null;
let _goToAccountFn = null;

function autoResizeNameInput(input) {
  if (!input) return;
  const text = input.value || input.placeholder || '';
  // Accurate width calculation using a single shared canvas context
  const canvas = autoResizeNameInput._canvas || (autoResizeNameInput._canvas = document.createElement('canvas'));
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const style = window.getComputedStyle(input);
    ctx.font = `${style.fontWeight || '700'} ${style.fontSize || '1.25rem'} ${style.fontFamily || 'serif'}`;
    const textWidth = ctx.measureText(text).width;
    // text width + 1rem padding
    input.style.width = `${Math.ceil(textWidth + 18)}px`;
  } else {
    input.style.width = `${Math.max(text.length + 2, 8)}ch`;
  }
}

function timeAgo(timestamp) {
  if (!timestamp) return '';
  const seconds = Math.round((Date.now() - timestamp) / 1000);
  if (seconds < 45) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

function formatRelativeSyncTime(timestamp) {
  return timestamp ? `last synced ${timeAgo(timestamp)}` : '';
}

function formatRelativeExportTime(timestamp) {
  return timestamp ? `last exported ${timeAgo(timestamp)}` : 'never exported';
}

/**
 * Picks a recipe to represent the account avatar as a mini fluid-glass
 * illustration for accounts without a Gravatar. Sticks with the stored
 * choice until the user shuffles, so the avatar stays stable across visits.
 */
function pickAvatarRecipe(excludeId = null) {
  const pool = state.recipes.filter(r => Array.isArray(r.specs) && r.specs.length > 0);
  if (pool.length === 0) return null;
  const candidates = excludeId ? pool.filter(r => r.id !== excludeId) : pool;
  const list = candidates.length > 0 ? candidates : pool;
  return list[Math.floor(Math.random() * list.length)];
}

function getStoredOrRandomAvatarRecipe() {
  const storedId = getAvatarRecipeId();
  const stored = storedId ? state.recipes.find(r => r.id === storedId) : null;
  if (stored) return stored;
  const picked = pickAvatarRecipe();
  if (picked) saveAvatarRecipeId(picked.id);
  return picked;
}

function renderAvatarGlass(avatarEl, recipe) {
  if (!avatarEl || !recipe) return;
  avatarEl.innerHTML = /*html*/`
    <div class="vault-avatar-glass">${renderGlassSvg(recipe, `account-avatar-glass-${recipe.id}`, { mode: 'blended' })}</div>
  `;
}

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
  if (cbs.goToAccount) _goToAccountFn = cbs.goToAccount;
}

/**
 * Opens the unified User Account & Vault Settings page
 */
export function openVaultSettingsModal() {
  if (_goToAccountFn) {
    _goToAccountFn();
  } else {
    window.location.hash = '#account';
  }
}

/**
 * Closes or exits the unified User Account & Vault Settings page
 */
export function closeVaultSettingsModal() {
  if (_goHomeFn) {
    _goHomeFn();
  } else {
    window.location.hash = '';
  }
}

/**
 * Populates and refreshes all 6 sections of the User Account & Vault Settings modal
 */
/**
 * Renders the "Pinned Home Collections" list in the Account & Vault Settings
 * modal: one row per pinned tag with up/down reorder and remove controls,
 * matching state.pinnedTags order (the same order Home renders its shelves in).
 */
function renderPinnedTagsList() {
  const listEl = document.getElementById('vault-pinned-tags-list');
  if (!listEl) return;

  if (state.pinnedTags.length === 0) {
    listEl.innerHTML = /*html*/`<li class="vault-pinned-tags-empty">No pinned collections yet — pin a tag below to add one.</li>`;
    return;
  }

  listEl.innerHTML = state.pinnedTags.map((tag, idx) => {
    const title = formatTagTitle(tag);
    return /*html*/`
    <li class="vault-pinned-tag-row" data-tag="${escapeHtml(tag)}">
      <span class="vault-pinned-tag-name">${escapeHtml(title)}</span>
      <div class="vault-pinned-tag-actions">
        <button type="button" class="vault-reorder-btn" data-action="pin-move-up" data-tag="${escapeHtml(tag)}"
          aria-label="Move ${escapeHtml(title)} up" ${idx === 0 ? 'disabled' : ''}>&uarr;</button>
        <button type="button" class="vault-reorder-btn" data-action="pin-move-down" data-tag="${escapeHtml(tag)}"
          aria-label="Move ${escapeHtml(title)} down" ${idx === state.pinnedTags.length - 1 ? 'disabled' : ''}>&darr;</button>
        <button type="button" class="vault-pinned-tag-remove" data-action="pin-remove" data-tag="${escapeHtml(tag)}"
          aria-label="Unpin ${escapeHtml(title)}">&times;</button>
      </div>
    </li>
  `;
  }).join('');
}

export function renderVaultSettingsModal() {
  const loggedIn = isAuthenticated();
  const user = getUser();

  // 1. User Identity & Cloud Sync
  const nameInput = elements.accountUserNameInput || document.getElementById('account-display-name-input');
  const emailDisplay = elements.accountEmailDisplay || document.getElementById('account-email-display');
  const createdDisplay = elements.accountCreatedDisplay || document.getElementById('account-created-display');
  const btnSync = elements.btnSyncNow || document.getElementById('btn-sync-now');
  const btnGuestSign = elements.btnGuestSignIn || document.getElementById('btn-guest-sign-in');
  const btnSignOut = elements.btnAccountSignOut || document.getElementById('btn-account-sign-out');
  const btnDangerSignOut = document.getElementById('btn-danger-sign-out');
  const deleteCloudRow = document.getElementById('danger-row-delete-cloud');

  const rankDisplay = elements.accountRankDisplay || document.getElementById('account-rank-display');
  const modalAvatar = document.getElementById('account-avatar-icon');
  const btnAvatarShuffle = document.getElementById('btn-avatar-shuffle');
  const rank = getMixologistRank();
  if (rankDisplay) {
    rankDisplay.textContent = rank;
  }

  const useGlassAvatarFallback = () => {
    const recipe = getStoredOrRandomAvatarRecipe();
    if (recipe) {
      renderAvatarGlass(modalAvatar, recipe);
      if (btnAvatarShuffle) btnAvatarShuffle.style.display = 'flex';
    } else if (modalAvatar) {
      modalAvatar.innerHTML = /*html*/`
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
          stroke-linecap="round" stroke-linejoin="round">
          <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path>
          <circle cx="12" cy="7" r="4"></circle>
        </svg>`;
      if (btnAvatarShuffle) btnAvatarShuffle.style.display = 'none';
    }
  };

  if (loggedIn && user) {
    if (nameInput) {
      nameInput.value = user.displayName || '';
      nameInput.placeholder = 'Mixologist Name';
      autoResizeNameInput(nameInput);
    }
    if (emailDisplay) {
      emailDisplay.textContent = user.email || 'Cloud Member';
    }
    if (createdDisplay) {
      if (user.createdAt) {
        try {
          const d = new Date(user.createdAt);
          const dateStr = d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
          createdDisplay.textContent = `Mixing since ${dateStr}`;
        } catch {
          createdDisplay.textContent = 'Cloud Member';
        }
      } else {
        createdDisplay.textContent = 'Cloud Synced Account';
      }
    }
    if (btnSync) btnSync.style.display = 'inline-flex';
    if (btnGuestSign) btnGuestSign.style.display = 'none';
    if (btnSignOut) btnSignOut.style.display = 'inline-flex';
    if (btnDangerSignOut) btnDangerSignOut.style.display = 'inline-flex';
    const confirmRowOpen = elements.dangerDeleteConfirmRow?.style.display === 'flex';
    if (deleteCloudRow) deleteCloudRow.style.display = confirmRowOpen ? 'none' : 'flex';
    if (elements.accountSyncTime) {
      elements.accountSyncTime.textContent = formatRelativeSyncTime(getLastSyncedAt());
    }

    // Use the shuffleable mini cocktail-glass illustration as the avatar.
    // Purely local, instant, zero network dependencies, and keeps the browser console 100% clean.
    useGlassAvatarFallback();
  } else {
    useGlassAvatarFallback();
    if (nameInput) {
      nameInput.value = '';
      nameInput.placeholder = 'Guest Bartender';
      autoResizeNameInput(nameInput);
    }
    if (emailDisplay) {
      emailDisplay.textContent = 'Guest Mode (Not signed in)';
    }
    if (createdDisplay) {
      createdDisplay.textContent = 'Offline Local Bar Library';
    }
    if (btnSync) btnSync.style.display = 'none';
    if (btnGuestSign) btnGuestSign.style.display = 'inline-flex';
    if (btnSignOut) btnSignOut.style.display = 'none';
    if (btnDangerSignOut) btnDangerSignOut.style.display = 'none';
    if (deleteCloudRow) deleteCloudRow.style.display = 'none';
    if (elements.dangerDeleteConfirmRow) elements.dangerDeleteConfirmRow.style.display = 'none';
    if (elements.accountSyncTime) {
      elements.accountSyncTime.textContent = '';
    }
  }

  // 2. Active Bar Profile & Inventory summary
  renderVaultBarsList();

  // 3. Library & Custom Recipe Summary Shortcuts
  const customCount = state.recipes.filter(r => !SEED_RECIPE_IDS.has(r.id)).length;
  const hiddenCount = getHiddenRecipeIds().length;
  const menusCount = getMenus().length;

  if (elements.countCustomRiffs) {
    elements.countCustomRiffs.textContent = customCount === 1 ? '1 custom recipe' : `${customCount} custom recipes`;
  }
  if (elements.countHiddenCocktails) {
    elements.countHiddenCocktails.textContent = hiddenCount === 1 ? '1 hidden' : `${hiddenCount} hidden`;
  }
  if (elements.countSavedMenus) {
    elements.countSavedMenus.textContent = menusCount === 1 ? '1 saved menu' : `${menusCount} saved menus`;
  }

  // 4. Pinned Home Collections
  renderPinnedTagsList();

  // 5. Mixing Preferences
  const unit = getUnitPreference();
  if (elements.popoverUnitOz && elements.popoverUnitMl) {
    elements.popoverUnitOz.classList.toggle('active', unit === 'oz');
    elements.popoverUnitMl.classList.toggle('active', unit === 'ml');
  }

  const glassMode = getGlassViewPreference();
  if (elements.popoverGlassLayered && elements.popoverGlassBlended) {
    elements.popoverGlassLayered.classList.toggle('active', glassMode === 'layered');
    elements.popoverGlassBlended.classList.toggle('active', glassMode === 'blended');
  }

  if (elements.btnWakeLockToggle) {
    elements.btnWakeLockToggle.checked = getWakeLockPreference();
  }

  // "Your Bar at a Glance" stat strip
  const historyEntries = Array.isArray(getDrinkHistory()) ? getDrinkHistory() : [];
  if (elements.accountStatDrinks) {
    elements.accountStatDrinks.textContent = String(historyEntries.length);
  }
  if (elements.accountStatIngredients) {
    elements.accountStatIngredients.textContent = String(state.inventory.size);
  }
  if (elements.accountStatFavorite) {
    if (historyEntries.length === 0) {
      elements.accountStatFavorite.textContent = '—';
    } else {
      const tally = new Map();
      for (const entry of historyEntries) {
        tally.set(entry.recipeId, (tally.get(entry.recipeId) || 0) + 1);
      }
      let topId = null;
      let topCount = 0;
      for (const [id, count] of tally) {
        if (count > topCount) {
          topId = id;
          topCount = count;
        }
      }
      const topRecipe = topId ? state.recipes.find(r => r.id === topId) : null;
      elements.accountStatFavorite.textContent = topRecipe ? topRecipe.name : '—';
    }
  }

  // Export reminder
  if (elements.accountExportReminder) {
    elements.accountExportReminder.textContent = formatRelativeExportTime(getLastExportedAt());
  }

  updateVaultStats();
}

/**
 * Update vault stats line in Settings modal
 */
export function updateVaultStats() {
  const hiddenCount = getHiddenRecipeIds().length;
  if (elements.btnManageHidden) {
    elements.btnManageHidden.style.display = hiddenCount > 0 ? '' : 'none';
  }
  if (elements.vaultHiddenSub) {
    elements.vaultHiddenSub.textContent = hiddenCount === 1 ? '1 drink hidden' : `${hiddenCount} drinks hidden`;
  }
  if (elements.countHiddenCocktails) {
    elements.countHiddenCocktails.textContent = hiddenCount === 1 ? '1 hidden' : `${hiddenCount} hidden`;
  }

  const customCount = state.recipes.filter(r => !SEED_RECIPE_IDS.has(r.id)).length;
  if (elements.countCustomRiffs) {
    elements.countCustomRiffs.textContent = customCount === 1 ? '1 custom recipe' : `${customCount} custom recipes`;
  }

  const bottleCount = state.inventory.size;

  const footerStatus = document.getElementById('vault-footer-status-text');
  if (footerStatus) {
    const activeName = getBarName();
    footerStatus.textContent = `${activeName} (${bottleCount} ${bottleCount === 1 ? 'bottle' : 'bottles'})`;
  }
}

/**
 * Renders the list of saved bars in the vault modal's Active Bar Selection
 * section, one card per bar with switch/rename/delete controls.
 */
export function renderVaultBarsList() {
  const container = document.getElementById('vault-bars-list');
  if (!container) return;

  const bars = getBars();
  const activeId = getActiveBarId();
  const customCount = state.recipes.filter(r => !SEED_RECIPE_IDS.has(r.id)).length;
  const cocktailText = customCount === 1 ? '1 custom cocktail' : `${customCount} custom cocktails`;
  const canDelete = bars.length > 1;

  container.innerHTML = bars.map(bar => {
    const isActive = bar.id === activeId;
    const bottleCount = isActive ? state.inventory.size : getInventoryForBar(bar.id).length;
    const bottleText = bottleCount === 1 ? '1 ingredient' : `${bottleCount} ingredients`;

    return /*html*/`
      <div class="vault-bar-card ${isActive ? 'active' : ''}" data-bar-id="${escapeHtml(bar.id)}">
        <input type="radio" name="active_bar_profile" value="${escapeHtml(bar.id)}" ${isActive ? 'checked' : ''}
          class="vault-bar-radio" aria-label="Make ${escapeHtml(bar.name)} the active bar" />
        <div class="vault-bar-card-info">
          <div class="vault-input-icon-row vault-bar-name-row">
            <input type="text" class="vault-bar-name-input" data-bar-id="${escapeHtml(bar.id)}"
              value="${escapeHtml(bar.name)}" maxlength="32" title="Click to rename this bar" aria-label="Bar name">
            <svg class="vault-edit-icon" width="12" height="12" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"></path>
            </svg>
          </div>
          <div class="vault-bar-card-bottles">${cocktailText} · ${bottleText}</div>
        </div>
        ${isActive ? '<span class="vault-badge-pill">Active</span>' : ''}
        <button type="button" class="vault-bar-delete-btn" data-bar-id="${escapeHtml(bar.id)}"
          ${canDelete ? '' : 'disabled'} title="${canDelete ? `Delete ${escapeHtml(bar.name)}` : 'At least one bar is required'}"
          aria-label="Delete ${escapeHtml(bar.name)}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
      </div>
    `;
  }).join('');
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
      resyncBarState();
      state.unitSystem = getUnitPreference();
      state.sortPreference = getSortPreference();
      state.glassViewMode = getGlassViewPreference();

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
      renderVaultSettingsModal();

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
 * Set up top bar and vault settings modal event listeners
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

  // Open the unified Account & Vault Settings modal
  elements.btnVaultMenu?.addEventListener('click', () => {
    openVaultSettingsModal();
  });

  elements.btnUserPill?.addEventListener('click', () => {
    openVaultSettingsModal();
  });

  elements.btnAccountBack?.addEventListener('click', () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      closeVaultSettingsModal();
    }
  });

  elements.btnCloseVaultSettings?.addEventListener('click', () => {
    closeVaultSettingsModal();
  });

  elements.btnDoneVaultSettings?.addEventListener('click', () => {
    closeVaultSettingsModal();
  });

  // Light dismiss on backdrop click for <dialog>
  elements.vaultSettingsModal?.addEventListener('click', (event) => {
    if (event.target !== elements.vaultSettingsModal) return;
    const rect = elements.vaultSettingsModal.getBoundingClientRect();
    const isInsideDialog = (
      rect.top <= event.clientY &&
      event.clientY <= rect.top + rect.height &&
      rect.left <= event.clientX &&
      event.clientX <= rect.left + rect.width
    );
    if (!isInsideDialog) {
      closeVaultSettingsModal();
    }
  });

  // Manual Sync Button
  elements.btnSyncNow?.addEventListener('click', async () => {
    if (!isAuthenticated()) {
      closeVaultSettingsModal();
      if (_openAuthModalFn) _openAuthModalFn();
      return;
    }

    if (elements.accountSyncBadge) {
      elements.accountSyncBadge.className = 'sync-status-dot syncing';
    }
    if (elements.accountSyncLabel) {
      elements.accountSyncLabel.textContent = 'Syncing...';
    }
    if (elements.btnSyncNow) {
      elements.btnSyncNow.disabled = true;
    }

    try {
      // 1. Pull down remote cloud data first to sync remote changes
      await pullRemoteData();

      // 2. Push current local backup data to ensure cloud is up to date
      const res = await migrateGuestData();

      // 3. Update reactive application state
      state.recipes = getRecipes();
      resyncBarState();

      if (_renderRecipeListFn) _renderRecipeListFn();
      if (_renderHomeViewFn && state.viewMode === 'home') _renderHomeViewFn();
      if (_renderCounterViewFn && state.viewMode === 'counter') _renderCounterViewFn();
      renderVaultBarsList();
      updateMyBarBadge();

      if (elements.accountSyncBadge) {
        elements.accountSyncBadge.className = 'sync-status-dot';
      }
      if (elements.accountSyncLabel) {
        elements.accountSyncLabel.textContent = 'Synced';
      }
      if (elements.accountSyncTime) {
        elements.accountSyncTime.textContent = formatRelativeSyncTime(saveLastSyncedAt());
      }
      showToast(`Cloud synced: ${state.recipes.length} recipes, ${state.inventory.size} bottles`);
    } catch (err) {
      if (elements.accountSyncBadge) {
        elements.accountSyncBadge.className = 'sync-status-dot offline';
      }
      if (elements.accountSyncLabel) {
        elements.accountSyncLabel.textContent = 'Offline';
      }
      showToast(`Sync error: ${err.message}`);
    } finally {
      if (elements.btnSyncNow) {
        elements.btnSyncNow.disabled = false;
      }
    }
  });

  // Bartender Name Edit
  elements.accountUserNameInput?.addEventListener('input', (e) => {
    autoResizeNameInput(e.target);
  });

  elements.accountUserNameInput?.addEventListener('change', async (e) => {
    const val = e.target.value.trim();
    if (!val) {
      renderVaultSettingsModal();
      return;
    }
    try {
      await updateDisplayName(val);
      updateAuthIndicator();
      showToast('Bartender name updated');
    } catch (err) {
      showToast(err.message || 'Failed to update name');
    }
  });

  elements.accountUserNameInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      elements.accountUserNameInput.blur();
    }
  });

  elements.btnGuestSignIn?.addEventListener('click', () => {
    closeVaultSettingsModal();
    if (_openAuthModalFn) _openAuthModalFn();
  });

  // Library & Custom Recipe Shortcuts
  elements.customRiffsShortcut?.addEventListener('click', () => {
    closeVaultSettingsModal();
    state.packFilter = 'riff';
    if (elements.sidebarPackFilter) elements.sidebarPackFilter.value = 'riff';
    if (_renderRecipeListFn) _renderRecipeListFn();
    showToast('Filtered library by #riff');
  });

  elements.hiddenCocktailsShortcut?.addEventListener('click', () => {
    closeVaultSettingsModal();
    openHiddenModal();
  });

  elements.menusShortcut?.addEventListener('click', () => {
    closeVaultSettingsModal();
    window.location.hash = '#menus';
  });

  // Preferences: Units
  elements.popoverUnitOz?.addEventListener('click', () => {
    setUnitSystem('oz');
  });

  elements.popoverUnitMl?.addEventListener('click', () => {
    setUnitSystem('ml');
  });

  // Preferences: Glass presentation
  elements.popoverGlassLayered?.addEventListener('click', () => {
    setGlassViewMode('layered');
  });

  elements.popoverGlassBlended?.addEventListener('click', () => {
    setGlassViewMode('blended');
  });

  // Preferences: Wake-Lock Toggle
  elements.btnWakeLockToggle?.addEventListener('change', (e) => {
    const enabled = saveWakeLockPreference(e.target.checked);
    showToast(enabled ? 'Screen wake-lock enabled' : 'Screen wake-lock disabled');
  });

  // Data Portability
  elements.btnExportJson?.addEventListener('click', () => {
    exportData();
    saveLastExportedAt();
    if (elements.accountExportReminder) {
      elements.accountExportReminder.textContent = formatRelativeExportTime(getLastExportedAt());
    }
    showToast('Exported bar backup to JSON');
  });

  // Avatar Shuffle: pick a different recipe's glass for accounts without a Gravatar
  elements.btnAvatarShuffle?.addEventListener('click', () => {
    const modalAvatar = document.getElementById('account-avatar-icon');
    const currentId = getAvatarRecipeId();
    const next = pickAvatarRecipe(currentId);
    if (!next) return;
    saveAvatarRecipeId(next.id);
    renderAvatarGlass(modalAvatar, next);
  });

  elements.btnImportTrigger?.addEventListener('click', () => {
    elements.importFileInput?.click();
  });

  elements.importFileInput?.addEventListener('change', handleFileImport);

  // Active Bar Selection: switch / rename / delete — delegated since cards
  // are re-rendered dynamically by renderVaultBarsList().
  const vaultBarsList = document.getElementById('vault-bars-list');

  vaultBarsList?.addEventListener('click', (e) => {
    const radio = e.target.closest('.vault-bar-radio');
    const deleteBtn = e.target.closest('.vault-bar-delete-btn');
    const card = e.target.closest('.vault-bar-card');
    if (!card) return;
    const barId = card.dataset.barId;

    if (radio && barId !== state.activeBarId) {
      const bar = getBars().find(b => b.id === barId);
      switchActiveBar(barId);
      renderVaultBarsList();
      updateVaultStats();
      updateMyBarBadge();
      if (state.viewMode === 'home' && _renderHomeViewFn) _renderHomeViewFn();
      if (state.viewMode === 'counter' && _renderCounterViewFn) _renderCounterViewFn();
      showToast(`Switched to ${bar ? bar.name : 'bar'}`);
      return;
    }

    if (deleteBtn && !deleteBtn.disabled) {
      const bar = getBars().find(b => b.id === barId);
      if (!confirm(`Delete "${bar?.name || 'this bar'}"? Its ingredient inventory will be lost. Recipes and drink history are unaffected.`)) return;
      const newActiveId = deleteBar(barId);
      if (newActiveId) {
        switchActiveBar(newActiveId);
      } else {
        resyncBarState();
      }
      renderVaultBarsList();
      updateVaultStats();
      updateMyBarBadge();
      if (state.viewMode === 'home' && _renderHomeViewFn) _renderHomeViewFn();
      if (state.viewMode === 'counter' && _renderCounterViewFn) _renderCounterViewFn();
      showToast('Bar deleted');
    }
  });

  vaultBarsList?.addEventListener('input', (e) => {
    const nameInput = e.target.closest('.vault-bar-name-input');
    if (!nameInput) return;
    autoResizeNameInput(nameInput);
  });

  vaultBarsList?.addEventListener('change', (e) => {
    const nameInput = e.target.closest('.vault-bar-name-input');
    if (!nameInput) return;
    const barId = nameInput.dataset.barId;
    const newName = renameBar(barId, nameInput.value);
    nameInput.value = newName;
    state.bars = getBars();
    if (barId === state.activeBarId && state.viewMode === 'home' && _renderHomeViewFn) {
      _renderHomeViewFn();
    }
    updateVaultStats();
    showToast('Bar renamed');
  });

  vaultBarsList?.addEventListener('keydown', (e) => {
    const nameInput = e.target.closest('.vault-bar-name-input');
    if (nameInput && e.key === 'Enter') {
      e.preventDefault();
      nameInput.blur();
    }
  });

  document.getElementById('btn-add-bar')?.addEventListener('click', () => {
    const bar = createBar('New Bar');
    state.bars = getBars();
    renderVaultBarsList();
    showToast(`Created "${bar.name}" — rename it below`);
    // Focus the new card's name field so the user can rename it inline,
    // matching the existing per-bar rename UX rather than a native prompt.
    const newNameInput = document.querySelector(`.vault-bar-name-input[data-bar-id="${bar.id}"]`);
    if (newNameInput) {
      newNameInput.focus();
      newNameInput.select();
    }
  });

  // Session Sign Out
  const handleSignOut = async () => {
    // 1. Close any open dialogs or popovers
    closeVaultSettingsModal();
    closeBackbarModal();
    closeAuthModal();
    closeHiddenModal();

    // 2. Perform remote logout and credential cleanup
    await logout();

    // 3. Completely clear user custom data, inventory, menus, history, and restore seed library
    state.recipes = clearUserDataOnSignOut();
    resyncBarState();

    // 4. Reset router/view to a safe landing state (Home page)
    if (_goHomeFn) {
      _goHomeFn();
    } else if (state.recipes.length > 0 && _selectRecipeFn) {
      _selectRecipeFn(state.recipes[0].id, true);
    }

    // 5. Refresh all reactive UI elements
    if (_renderRecipeListFn) _renderRecipeListFn();
    if (_renderHomeViewFn && state.viewMode === 'home') _renderHomeViewFn();
    updateMyBarBadge();
    renderVaultSettingsModal();

    showToast('Successfully signed out', {
      className: 'toast-prominent',
      duration: 3200,
      icon: /*html*/`<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"></polyline></svg>`,
    });
  };

  elements.btnSignOut?.addEventListener('click', handleSignOut);
  elements.btnAccountSignOut?.addEventListener('click', handleSignOut);
  document.getElementById('btn-danger-sign-out')?.addEventListener('click', handleSignOut);

  // Danger Zone: Reset Local Data
  elements.btnDangerResetLocal?.addEventListener('click', () => {
    if (confirm('Reset all cocktails and backbar to the default library? Custom recipe modifications will be replaced.')) {
      state.recipes = resetToDefaults();
      resyncBarState();
      if (_renderRecipeListFn) _renderRecipeListFn();
      if (state.recipes.length > 0 && _selectRecipeFn) {
        _selectRecipeFn(state.recipes[0].id, false);
      }
      updateMyBarBadge();
      renderVaultSettingsModal();
      showToast('Vault reset to default cocktail library');
    }
  });

  // Danger Zone: Delete Cloud Account — requires typing the bar profile name
  // to confirm, rather than a pair of browser confirm() dialogs people learn
  // to click through on reflex for an action this destructive.
  const resetDeleteConfirmRow = () => {
    if (elements.dangerDeleteConfirmRow) elements.dangerDeleteConfirmRow.style.display = 'none';
    if (elements.dangerRowDeleteCloud) elements.dangerRowDeleteCloud.style.display = 'flex';
    if (elements.dangerConfirmInput) elements.dangerConfirmInput.value = '';
    if (elements.btnDangerDeleteConfirm) elements.btnDangerDeleteConfirm.disabled = true;
  };

  elements.btnDangerDeleteAccount?.addEventListener('click', () => {
    if (!isAuthenticated()) return;
    if (elements.dangerConfirmBarName) elements.dangerConfirmBarName.textContent = getBarName();
    if (elements.dangerRowDeleteCloud) elements.dangerRowDeleteCloud.style.display = 'none';
    if (elements.dangerDeleteConfirmRow) elements.dangerDeleteConfirmRow.style.display = 'flex';
    if (elements.dangerConfirmInput) {
      elements.dangerConfirmInput.value = '';
      elements.dangerConfirmInput.focus();
    }
    if (elements.btnDangerDeleteConfirm) elements.btnDangerDeleteConfirm.disabled = true;
  });

  elements.dangerConfirmInput?.addEventListener('input', (e) => {
    if (elements.btnDangerDeleteConfirm) {
      elements.btnDangerDeleteConfirm.disabled = e.target.value !== getBarName();
    }
  });

  elements.btnDangerDeleteCancel?.addEventListener('click', resetDeleteConfirmRow);

  elements.btnDangerDeleteConfirm?.addEventListener('click', async () => {
    if (!isAuthenticated()) return;
    if (elements.dangerConfirmInput?.value !== getBarName()) return;

    try {
      await deleteAccount();
      closeVaultSettingsModal();
      closeBackbarModal();
      closeAuthModal();
      closeHiddenModal();

      state.recipes = clearUserDataOnSignOut();
      resyncBarState();

      if (_goHomeFn) {
        _goHomeFn();
      } else if (state.recipes.length > 0 && _selectRecipeFn) {
        _selectRecipeFn(state.recipes[0].id, true);
      }

      if (_renderRecipeListFn) _renderRecipeListFn();
      if (_renderHomeViewFn && state.viewMode === 'home') _renderHomeViewFn();
      updateMyBarBadge();
      renderVaultSettingsModal();

      showToast('Account permanently deleted');
    } catch (err) {
      alert(`Account deletion failed: ${err.message}`);
    }
  });

  // Pinned Home Collections: reorder / remove. Delegated on the list container
  // since renderPinnedTagsList() replaces its rows' innerHTML on every render.
  document.getElementById('vault-pinned-tags-list')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const tag = btn.getAttribute('data-tag');
    const action = btn.getAttribute('data-action');
    const idx = state.pinnedTags.indexOf(tag);
    if (idx === -1) return;

    if (action === 'pin-remove') {
      state.pinnedTags = state.pinnedTags.filter(t => t !== tag);
    } else if (action === 'pin-move-up' && idx > 0) {
      const reordered = [...state.pinnedTags];
      [reordered[idx - 1], reordered[idx]] = [reordered[idx], reordered[idx - 1]];
      state.pinnedTags = reordered;
    } else if (action === 'pin-move-down' && idx < state.pinnedTags.length - 1) {
      const reordered = [...state.pinnedTags];
      [reordered[idx + 1], reordered[idx]] = [reordered[idx], reordered[idx + 1]];
      state.pinnedTags = reordered;
    } else {
      return;
    }

    savePinnedTags(state.pinnedTags);
    renderPinnedTagsList();
    if (_renderHomeViewFn && state.viewMode === 'home') _renderHomeViewFn();
  });

  // Pinned Home Collections: add a new pin via the same tag autocomplete used on Home
  setupTagAutocomplete(
    document.getElementById('vault-pin-tag-input'),
    document.getElementById('vault-pin-suggest-list'),
    () => getAllUniqueTags(state.recipes).filter(t => !state.pinnedTags.includes(t)),
    (rawTag) => {
      const clean = normalizeTagName(rawTag);
      if (!clean || state.pinnedTags.includes(clean)) return;
      state.pinnedTags = [...state.pinnedTags, clean];
      savePinnedTags(state.pinnedTags);
      renderPinnedTagsList();
      if (_renderHomeViewFn && state.viewMode === 'home') _renderHomeViewFn();
      showToast(`Pinned #${clean} to Home`);
    }
  );

  // Header My Bar button
  elements.btnMyBar?.addEventListener('click', () => {
    if (_openBackbarModalFn) _openBackbarModalFn();
  });

  // Header Sign In button
  elements.btnSignIn?.addEventListener('click', () => {
    if (_openAuthModalFn) _openAuthModalFn();
  });

  // Listen to speakeasy:auth-changed to update UI
  if (typeof window !== 'undefined') {
    window.addEventListener(AUTH_EVENT_NAME, (event) => {
      // Re-hydrate state from local storage (which was just merged or cleared)
      state.recipes = getRecipes();
      resyncBarState();
      state.unitSystem = getUnitPreference();
      state.sortPreference = getSortPreference();
      state.glassViewMode = getGlassViewPreference();

      updateAuthIndicator();
      renderVaultSettingsModal();
      updateMyBarBadge();
      if (_renderRecipeListFn) _renderRecipeListFn();
      if (_renderHomeViewFn && state.viewMode === 'home') _renderHomeViewFn();
      if (_renderCounterViewFn && state.viewMode === 'counter') _renderCounterViewFn();
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

    const pillName = elements.userPillName || document.getElementById('user-pill-name');
    if (pillName) {
      pillName.textContent = displayName;
    }
    const popoverEmail = elements.userPopoverEmail || document.getElementById('user-popover-email');
    if (popoverEmail) {
      popoverEmail.textContent = user.email || displayName;
    }
  } else {
    const pillName = elements.userPillName || document.getElementById('user-pill-name');
    if (pillName) {
      pillName.textContent = 'Profile';
    }
  }
}
