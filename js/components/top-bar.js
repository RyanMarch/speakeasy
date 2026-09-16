/**
 * Speakeasy Top Bar & Vault Settings Popover Component
 */

import { state, elements, SEED_RECIPE_IDS, HOME_DEFAULT_COLLECTIONS, resyncBarState, switchActiveBar } from '../state.js';
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
  getFunPreference,
  saveFunPreference,
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
  saveHomeCollectionsOrder,
  saveHiddenHomeCollections,
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
import { getDrinkHistory, HISTORY_UPDATED_EVENT } from '../modules/history.js';
import { openHiddenModal, closeHiddenModal } from './hidden-modal.js';
import { closeBackbarModal } from './backbar-modal.js';
import { closeAuthModal } from './auth-modal.js';
import { showToast, showLevelUpCelebration, escapeHtml } from './toast.js';

export const MIXOLOGIST_RANKS = [
  { threshold: 1000, title: 'Living Legend' },
  { threshold: 890, title: 'Grand Conservator' },
  { threshold: 780, title: 'Blind-Tasting Savant' },
  { threshold: 680, title: 'Copper & Oak' },
  { threshold: 590, title: 'Cellar Master' },
  { threshold: 510, title: 'Speakeasy Proprietor' },
  { threshold: 440, title: 'The Maestro' },
  { threshold: 380, title: 'Master Distiller' },
  { threshold: 325, title: 'Liquid Architect' },
  { threshold: 275, title: 'The Alchemist' },
  { threshold: 230, title: 'Spirits Connoisseur' },
  { threshold: 190, title: 'Head Mixologist' },
  { threshold: 155, title: 'Palate Detective' },
  { threshold: 125, title: 'The House Host' },
  { threshold: 100, title: 'Tin Shaker' },
  { threshold: 78, title: 'Bartender' },
  { threshold: 60, title: 'Day-Shift Pourer' },
  { threshold: 45, title: 'Rum Runner' },
  { threshold: 32, title: 'Bootlegger' },
  { threshold: 20, title: 'Barback' },
  { threshold: 12, title: 'Apprentice' },
  { threshold: 5, title: 'Soda Jerk' },
  { threshold: 0, title: 'Cocktail Curious' }
];

const LAST_SEEN_RANK_KEY = 'speakeasy_last_seen_rank_score';
const LIFETIME_MAX_SCORE_KEY = 'speakeasy_mixologist_lifetime_score';

/**
 * Returns detailed mixologist rank metrics including score and next threshold.
 * Uses high-water mark so users never lose earned rank when inventory/recipes change.
 */
export function getMixologistRankDetails() {
  const historyEntries = Array.isArray(getDrinkHistory()) ? getDrinkHistory() : [];
  const drinksPoured = historyEntries.length;
  const uniquePoured = new Set(historyEntries.map(h => h.recipeId || h.id).filter(Boolean)).size;

  const customRecipes = (state.recipes || []).filter(r => !SEED_RECIPE_IDS.has(r.id));
  const customRiffs = customRecipes.filter(r => Boolean(r.riffOfId || r.riffOfName)).length;
  const customScratch = customRecipes.length - customRiffs;

  const pinnedTagsCount = Array.isArray(state.pinnedTags) ? state.pinnedTags.length : 0;
  const inventoryCount = state.inventory ? state.inventory.size : 0;

  // Activity Hierarchy scoring:
  // 1. Stock the bar (0.5 pt each, capped at 15)
  // 2. Pin collection / tag (1 pt each, capped at 5)
  // 3. Create a riff (3 pts each, capped at 24)
  // 4. Add custom non-riff scratch recipe (8 pts each, capped at 40)
  // 5. Pour a cocktail (2 pts each)
  // 6. Pour a new unique cocktail (4 bonus pts each = 6 pts total for first pour)
  const calculatedScore = Math.floor(Math.min(inventoryCount * 0.5, 15))
    + Math.min(pinnedTagsCount, 5)
    + Math.min(customRiffs * 3, 24)
    + Math.min(customScratch * 8, 40)
    + (drinksPoured * 2)
    + (uniquePoured * 4);

  // High-water mark: rank score never decrements
  let lifetimeMax = calculatedScore;
  try {
    const rawMax = localStorage.getItem(LIFETIME_MAX_SCORE_KEY);
    if (rawMax !== null) {
      const parsedMax = Number(rawMax);
      if (!isNaN(parsedMax) && parsedMax > lifetimeMax) {
        lifetimeMax = parsedMax;
      }
    }
    localStorage.setItem(LIFETIME_MAX_SCORE_KEY, String(lifetimeMax));
  } catch {
    // localStorage unavailable
  }

  const effectiveScore = lifetimeMax;
  const currentIndex = MIXOLOGIST_RANKS.findIndex(r => effectiveScore >= r.threshold);
  const currentRank = MIXOLOGIST_RANKS[currentIndex] || MIXOLOGIST_RANKS[MIXOLOGIST_RANKS.length - 1];
  const nextRank = currentIndex > 0 ? MIXOLOGIST_RANKS[currentIndex - 1] : null;

  return {
    title: currentRank.title,
    threshold: currentRank.threshold,
    score: effectiveScore,
    rawScore: calculatedScore,
    nextRank: nextRank ? nextRank.title : null,
    pointsToNext: nextRank ? nextRank.threshold - effectiveScore : 0,
  };
}

/**
 * Checks whether user has leveled up since last recorded rank threshold.
 * Shows celebration toast if level increased.
 * @param {Object} [options]
 * @param {boolean} [options.deferIfModalOpen=false] - If true, defers celebration until modal closes
 */
export function checkMixologistRankPromotion(options = {}) {
  // If the backbar modal is currently open and deferral is requested, do not interrupt
  if (options.deferIfModalOpen && elements.backbarModal?.open) {
    return;
  }

  const details = getMixologistRankDetails();
  try {
    const rawPrev = localStorage.getItem(LAST_SEEN_RANK_KEY);
    if (rawPrev !== null) {
      const prevThreshold = Number(rawPrev);
      if (!isNaN(prevThreshold) && details.threshold > prevThreshold) {
        const prevRank = MIXOLOGIST_RANKS.find(r => r.threshold === prevThreshold);
        showLevelUpCelebration(details.title, {
          previousRankTitle: prevRank ? prevRank.title : null,
        });
      }
    }
    localStorage.setItem(LAST_SEEN_RANK_KEY, String(details.threshold));
  } catch {
    // localStorage unavailable
  }
}

/**
 * Calculates mixologist rank title based on drinks poured, variety, and custom riffs created.
 */
export function getMixologistRank() {
  return getMixologistRankDetails().title;
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
export function getUnifiedHomeCollectionsList() {
  const pinnedSet = new Set(state.pinnedTags);
  const defaultKeys = new Set(HOME_DEFAULT_COLLECTIONS.map(c => c.key));

  let order = state.homeCollectionsOrder;
  if (!Array.isArray(order) || order.length === 0) {
    order = [
      '__recently-viewed__',
      '__recently-made__',
      ...state.pinnedTags,
      ...HOME_DEFAULT_COLLECTIONS.map(c => c.key),
    ];
  } else {
    // Ensure all known items exist in order array
    const existing = new Set(order);
    const missing = [];
    if (!existing.has('__recently-viewed__')) missing.push('__recently-viewed__');
    if (!existing.has('__recently-made__')) missing.push('__recently-made__');
    for (const t of state.pinnedTags) {
      if (!existing.has(t)) missing.push(t);
    }
    for (const c of HOME_DEFAULT_COLLECTIONS) {
      if (!existing.has(c.key)) missing.push(c.key);
    }
    if (missing.length > 0) {
      order = [...order, ...missing];
    }
  }

  const items = [];
  const processed = new Set();

  for (const key of order) {
    if (processed.has(key)) continue;
    processed.add(key);

    if (key === '__recently-viewed__') {
      items.push({
        key,
        title: 'Recently Viewed',
        type: 'history',
        badge: 'History',
        canRemove: false,
        canToggle: true,
        canReorder: false,
        isHidden: state.hiddenHomeCollections.has(key),
      });
    } else if (key === '__recently-made__') {
      items.push({
        key,
        title: 'Recently Made',
        type: 'history',
        badge: 'History',
        canRemove: false,
        canToggle: true,
        canReorder: false,
        isHidden: state.hiddenHomeCollections.has(key),
      });
    } else if (defaultKeys.has(key)) {
      const def = HOME_DEFAULT_COLLECTIONS.find(c => c.key === key);
      items.push({
        key,
        title: def ? def.title : formatTagTitle(key),
        type: 'default',
        badge: 'Default',
        canRemove: false,
        canToggle: true,
        canReorder: true,
        isHidden: state.hiddenHomeCollections.has(key),
      });
    } else if (pinnedSet.has(key)) {
      items.push({
        key,
        title: formatTagTitle(key),
        type: 'pinned',
        badge: 'Tag',
        canRemove: true,
        canToggle: false,
        canReorder: true,
        isHidden: false,
      });
    }
  }

  return items;
}

/**
 * Renders the "Pinned Home Collections" list in the Account & Vault Settings modal
 */
function renderPinnedTagsList() {
  const listEl = document.getElementById('vault-pinned-tags-list');
  if (!listEl) return;

  const items = getUnifiedHomeCollectionsList();
  if (items.length === 0) {
    listEl.innerHTML = /*html*/`<li class="vault-pinned-tags-empty">No collections available.</li>`;
    return;
  }

  const reorderableItems = items.filter(it => it.canReorder);

  listEl.innerHTML = items.map((item) => {
    const title = item.title;
    const reorderIdx = reorderableItems.findIndex(it => it.key === item.key);
    const isFirstReorderable = reorderIdx === 0;
    const isLastReorderable = reorderIdx === reorderableItems.length - 1;

    return /*html*/`
    <li class="vault-pinned-tag-row ${item.isHidden ? 'is-hidden' : ''}" data-key="${escapeHtml(item.key)}" data-type="${escapeHtml(item.type)}">
      <div class="vault-pinned-tag-meta">
        <span class="vault-pinned-tag-name" title="${escapeHtml(title)}">${escapeHtml(title)}</span>
        <span class="vault-pinned-tag-badge ${item.type === 'default' ? 'badge-default' : ''}">${escapeHtml(item.badge)}</span>
      </div>
      <div class="vault-pinned-tag-actions">
        ${item.canReorder ? `
          <button type="button" class="vault-reorder-btn" data-action="collection-move-up" data-key="${escapeHtml(item.key)}"
            aria-label="Move ${escapeHtml(title)} up" ${isFirstReorderable ? 'disabled' : ''}>&uarr;</button>
          <button type="button" class="vault-reorder-btn" data-action="collection-move-down" data-key="${escapeHtml(item.key)}"
            aria-label="Move ${escapeHtml(title)} down" ${isLastReorderable ? 'disabled' : ''}>&darr;</button>
        ` : ''}
        ${item.canToggle ? `
          <button type="button" class="vault-pinned-tag-toggle" data-action="collection-toggle-hide" data-key="${escapeHtml(item.key)}"
            aria-label="${item.isHidden ? 'Show' : 'Hide'} ${escapeHtml(title)}" title="${item.isHidden ? 'Show on Home' : 'Hide from Home'}">
            ${item.isHidden ? `
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                <line x1="1" y1="1" x2="23" y2="23"></line>
              </svg>
            ` : `
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
              </svg>
            `}
          </button>
        ` : ''}
        ${item.canRemove ? `
          <button type="button" class="vault-pinned-tag-remove" data-action="collection-remove" data-key="${escapeHtml(item.key)}"
            aria-label="Unpin ${escapeHtml(title)}">&times;</button>
        ` : ''}
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

  if (elements.btnFunToggle) {
    elements.btnFunToggle.checked = getFunPreference();
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
 * Set More Fun animation preference, update DOM classes, and persist choice
 */
export function setFunAnimations(enabled) {
  const bool = Boolean(enabled);
  state.funAnimations = bool;
  saveFunPreference(bool);

  if (elements.btnFunToggle) {
    elements.btnFunToggle.checked = bool;
  }

  if (typeof document !== 'undefined') {
    document.documentElement.classList.toggle('animations-disabled', !bool);
  }

  showToast(bool ? 'Animations enabled' : 'Animations disabled');
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
  checkMixologistRankPromotion({ deferIfModalOpen: true });
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
 * True when the header is in its mobile layout — i.e. Sign In / the profile
 * pill are the only way left to reach the header's actions, since there's no
 * room for #btn-new-drink there too. Can't test #btn-new-drink's own
 * computed display for this: several view modes (account, edit, menu-builder,
 * shared-recipe) hide it with an inline style for reasons that have nothing
 * to do with viewport width, which would make this true at any width while
 * one of those views is open. .brand-subtitle is a plain CSS-only, JS-untouched
 * responsive rule (see responsive.css), so its computed display reflects
 * viewport width alone — reading it here instead of duplicating responsive.css's
 * breakpoint as a number keeps the two from drifting out of sync.
 */
function isMobileHeaderLayout() {
  const brandSubtitle = document.querySelector('.brand-subtitle');
  return !!brandSubtitle && getComputedStyle(brandSubtitle).display === 'none';
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

  // On mobile, the profile pill opens the same quick-actions popover as Sign
  // In above rather than jumping straight into the full Settings page — see
  // isMobileHeaderLayout(). Desktop keeps going straight to Settings, since
  // New Drink already has its own always-visible button there.
  elements.btnUserPill?.addEventListener('click', () => {
    if (isMobileHeaderLayout()) {
      elements.headerQuickPopover?.togglePopover();
      return;
    }
    openVaultSettingsModal();
  });

  // Mobile Header Quick Actions Popover
  elements.quickPopoverNewDrink?.addEventListener('click', () => {
    elements.headerQuickPopover?.hidePopover();
    if (_openEditorFn) _openEditorFn(null);
  });

  elements.quickPopoverMenus?.addEventListener('click', () => {
    elements.headerQuickPopover?.hidePopover();
    window.location.hash = '#menus';
  });

  elements.quickPopoverSignIn?.addEventListener('click', () => {
    elements.headerQuickPopover?.hidePopover();
    if (_openAuthModalFn) _openAuthModalFn();
  });

  elements.quickPopoverAccount?.addEventListener('click', () => {
    elements.headerQuickPopover?.hidePopover();
    openVaultSettingsModal();
  });

  // CSS anchor positioning isn't reliably supported everywhere yet (see the
  // identical comment on #counter-more-popover) — position from whichever
  // trigger is actually visible (Sign In for a guest, the profile pill once
  // signed in) instead.
  elements.headerQuickPopover?.addEventListener('toggle', (e) => {
    if (e.newState !== 'open') return;
    const trigger = elements.btnUserPill?.offsetParent ? elements.btnUserPill : elements.btnSignIn;
    if (!trigger) return;

    const triggerRect = trigger.getBoundingClientRect();
    const popoverRect = elements.headerQuickPopover.getBoundingClientRect();
    const margin = 8;

    let left = triggerRect.right - popoverRect.width;
    left = Math.max(margin, Math.min(left, window.innerWidth - popoverRect.width - margin));
    const top = Math.min(triggerRect.bottom + margin, window.innerHeight - popoverRect.height - margin);

    elements.headerQuickPopover.style.top = `${Math.max(margin, top)}px`;
    elements.headerQuickPopover.style.left = `${left}px`;
    elements.headerQuickPopover.style.right = 'auto';
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
  elements.newDrinkShortcut?.addEventListener('click', () => {
    closeVaultSettingsModal();
    if (_openEditorFn) _openEditorFn(null);
  });

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

  // Preferences: More Fun Animation Toggle
  elements.btnFunToggle?.addEventListener('change', (e) => {
    setFunAnimations(e.target.checked);
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

  // Pinned & Default Home Collections: reorder / toggle / remove. Delegated on the list container
  // since renderPinnedTagsList() replaces its rows' innerHTML on every render.
  document.getElementById('vault-pinned-tags-list')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const key = btn.getAttribute('data-key') || btn.getAttribute('data-tag');
    const action = btn.getAttribute('data-action');
    if (!key || !action) return;

    if (action === 'collection-toggle-hide') {
      if (state.hiddenHomeCollections.has(key)) {
        state.hiddenHomeCollections.delete(key);
      } else {
        state.hiddenHomeCollections.add(key);
      }
      saveHiddenHomeCollections([...state.hiddenHomeCollections]);
      renderPinnedTagsList();
      if (_renderHomeViewFn && state.viewMode === 'home') _renderHomeViewFn();
      return;
    }

    if (action === 'collection-remove' || action === 'pin-remove') {
      state.pinnedTags = state.pinnedTags.filter(t => t !== key);
      savePinnedTags(state.pinnedTags);

      if (Array.isArray(state.homeCollectionsOrder)) {
        state.homeCollectionsOrder = state.homeCollectionsOrder.filter(k => k !== key);
        saveHomeCollectionsOrder(state.homeCollectionsOrder);
      }

      renderPinnedTagsList();
      if (_renderHomeViewFn && state.viewMode === 'home') _renderHomeViewFn();
      return;
    }

    if (action === 'collection-move-up' || action === 'collection-move-down' || action === 'pin-move-up' || action === 'pin-move-down') {
      const items = getUnifiedHomeCollectionsList();
      const reorderable = items.filter(it => it.canReorder).map(it => it.key);
      const currIdx = reorderable.indexOf(key);
      if (currIdx === -1) return;

      const isUp = action === 'collection-move-up' || action === 'pin-move-up';
      const targetIdx = isUp ? currIdx - 1 : currIdx + 1;
      if (targetIdx < 0 || targetIdx >= reorderable.length) return;

      // Swap in reorderable array
      const targetKey = reorderable[targetIdx];
      reorderable[currIdx] = targetKey;
      reorderable[targetIdx] = key;

      // Maintain history items at top of overall order
      state.homeCollectionsOrder = ['__recently-viewed__', '__recently-made__', ...reorderable];
      saveHomeCollectionsOrder(state.homeCollectionsOrder);

      // Keep state.pinnedTags in synced relative order
      const newPinnedOrder = reorderable.filter(k => state.pinnedTags.includes(k));
      state.pinnedTags = newPinnedOrder;
      savePinnedTags(state.pinnedTags);

      renderPinnedTagsList();
      if (_renderHomeViewFn && state.viewMode === 'home') _renderHomeViewFn();
      return;
    }
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

      const currentOrder = state.homeCollectionsOrder || [
        '__recently-viewed__',
        '__recently-made__',
        ...HOME_DEFAULT_COLLECTIONS.map(c => c.key),
      ];
      if (!currentOrder.includes(clean)) {
        state.homeCollectionsOrder = [...currentOrder, clean];
        saveHomeCollectionsOrder(state.homeCollectionsOrder);
      }

      renderPinnedTagsList();
      if (_renderHomeViewFn && state.viewMode === 'home') _renderHomeViewFn();
      showToast(`Pinned #${clean} to Home`);
    }
  );

  // Header My Bar button
  elements.btnMyBar?.addEventListener('click', () => {
    if (_openBackbarModalFn) _openBackbarModalFn();
  });

  // Header Sign In button — on mobile (where #btn-new-drink is hidden and
  // there's otherwise no way to reach "New Drink" without first landing in
  // the Sign In flow), open the quick-actions popover instead of jumping
  // straight into auth.
  elements.btnSignIn?.addEventListener('click', () => {
    if (isMobileHeaderLayout()) {
      elements.headerQuickPopover?.togglePopover();
      return;
    }
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
      checkMixologistRankPromotion();
      if (_renderRecipeListFn) _renderRecipeListFn();
      if (_renderHomeViewFn && state.viewMode === 'home') _renderHomeViewFn();
      if (_renderCounterViewFn && state.viewMode === 'counter') _renderCounterViewFn();
    });

    window.addEventListener(HISTORY_UPDATED_EVENT, () => {
      checkMixologistRankPromotion();
    });

    // When backbar modal closes, fire any deferred promotions earned while stocking
    elements.backbarModal?.addEventListener('close', () => {
      checkMixologistRankPromotion();
    });

    // Expose testing helpers to developer console
    window.speakeasyLevelUp = (rankTitle = 'The Alchemist', prevTitle = 'Spirits Connoisseur') => {
      showLevelUpCelebration(rankTitle, { previousRankTitle: prevTitle });
    };
    window.checkMixologistRankPromotion = checkMixologistRankPromotion;
  }

  // Initial indicator sync and last seen rank threshold record
  updateAuthIndicator();
  try {
    if (localStorage.getItem(LAST_SEEN_RANK_KEY) === null) {
      localStorage.setItem(LAST_SEEN_RANK_KEY, String(getMixologistRankDetails().threshold));
    }
  } catch {
    // Ignore storage errors
  }
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

  if (elements.quickPopoverSignIn) {
    elements.quickPopoverSignIn.style.display = loggedIn ? 'none' : 'flex';
  }

  if (elements.quickPopoverAccount) {
    elements.quickPopoverAccount.style.display = loggedIn ? 'flex' : 'none';
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
