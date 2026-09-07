/**
 * Speakeasy Backbar Inventory Drawer / Modal Component
 */

import {
  state,
  elements,
  BACKBAR_CATEGORIES,
  invalidateInventoryCache,
} from '../state.js';

import {
  DEFAULT_STARTER_BAR,
  saveInventory,
} from '../modules/storage.js';

import {
  TAXONOMY,
  REFRIGERATED_INGREDIENT_IDS,
  getRankedShoppingList,
} from '../modules/taxonomy.js';

import { escapeHtml, showToast } from './toast.js';

let _updateMyBarBadgeFn = null;
let _renderRecipeListFn = null;
let _renderCounterViewFn = null;
let _renderHomeViewFn = null;
let _selectRecipeFn = null;

export function setBackbarModalCallbacks(cbs) {
  if (cbs.updateMyBarBadge) _updateMyBarBadgeFn = cbs.updateMyBarBadge;
  if (cbs.renderRecipeList) _renderRecipeListFn = cbs.renderRecipeList;
  if (cbs.renderCounterView) _renderCounterViewFn = cbs.renderCounterView;
  if (cbs.renderHomeView) _renderHomeViewFn = cbs.renderHomeView;
  if (cbs.selectRecipe) _selectRecipeFn = cbs.selectRecipe;
}

/**
 * Dynamically manage disabled state and helpful tooltips for Starter Bar and Clear All buttons
 */
export function updateBackbarActionButtons() {
  const count = state.inventory.size;

  if (elements.btnClearBar) {
    const hasBottles = count > 0;
    elements.btnClearBar.disabled = !hasBottles;
    elements.btnClearBar.setAttribute('aria-disabled', !hasBottles ? 'true' : 'false');
    elements.btnClearBar.title = hasBottles
      ? 'Clear all bottles from your backbar'
      : 'No bottles in backbar to clear';
  }

  if (elements.btnStarterBar) {
    const hasAllStarter = DEFAULT_STARTER_BAR.every(id => state.inventory.has(id));
    elements.btnStarterBar.disabled = hasAllStarter;
    elements.btnStarterBar.setAttribute('aria-disabled', hasAllStarter ? 'true' : 'false');
    elements.btnStarterBar.title = hasAllStarter
      ? 'All starter essentials already in your backbar'
      : 'Add essential bar staples';
  }
}

/**
 * Open personal backbar modal
 */
export function openBackbarModal() {
  state.backbarSearchQuery = '';
  state.backbarCategoryFilter = 'all';
  if (elements.backbarSearchInput) elements.backbarSearchInput.value = '';
  if (elements.backbarNavTabs) {
    elements.backbarNavTabs.querySelectorAll('.backbar-nav-tab').forEach(tab => {
      const isAll = tab.getAttribute('data-cat-filter') === 'all';
      tab.classList.toggle('active', isAll);
      tab.setAttribute('aria-selected', isAll ? 'true' : 'false');
    });
  }
  if (elements.backbarViewSwitcher) {
    elements.backbarViewSwitcher.querySelectorAll('.backbar-view-tab').forEach(tab => {
      const isCurrent = tab.getAttribute('data-view') === (state.backbarTab || 'inventory');
      tab.classList.toggle('active', isCurrent);
      tab.setAttribute('aria-selected', isCurrent ? 'true' : 'false');
    });
  }
  updateBackbarActionButtons();
  renderBackbarModalContent();
  if (typeof elements.backbarModal?.showModal === 'function') {
    elements.backbarModal.showModal();
  }
}

/**
 * Close personal backbar modal
 */
export function closeBackbarModal() {
  if (typeof elements.backbarModal?.close === 'function') {
    elements.backbarModal.close();
  }
}

/**
 * Toggle an item in the user's inventory
 */
export function toggleInventoryBottle(bottleId) {
  if (state.inventory.has(bottleId)) {
    state.inventory.delete(bottleId);
  } else {
    state.inventory.add(bottleId);
  }
  saveInventory(Array.from(state.inventory));
  invalidateInventoryCache();
  if (_updateMyBarBadgeFn) _updateMyBarBadgeFn();
  if (_renderRecipeListFn) _renderRecipeListFn();
  if (state.viewMode === 'counter' && _renderCounterViewFn) {
    _renderCounterViewFn();
  } else if (state.viewMode === 'home' && _renderHomeViewFn) {
    _renderHomeViewFn();
  }
  renderBackbarModalContent();
}

/**
 * Compute accessible high-contrast text color (#111111 vs #ffffff) for a hex background
 * using standard relative luminance formula (WCAG 2.1)
 */
export function getContrastColor(hexColor) {
  if (!hexColor || typeof hexColor !== 'string') return '#111111';
  let hex = hexColor.replace('#', '').trim();
  if (hex.length === 3) {
    hex = hex.split('').map(c => c + c).join('');
  }
  if (hex.length !== 6) return '#111111';

  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;

  const toLinear = (c) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  const L = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);

  return L > 0.35 ? '#111111' : '#ffffff';
}

/**
 * Render categories and item pills inside the My Bar inventory view
 */
export function renderInventoryPillsContent() {
  if (!elements.backbarCategoriesContainer) return;

  const query = (state.backbarSearchQuery || '').toLowerCase();
  const catFilter = state.backbarCategoryFilter || 'all';
  const allTaxonomyItems = Object.values(TAXONOMY);

  let totalVisibleBottles = 0;

  const sectionsHtml = BACKBAR_CATEGORIES.map(cat => {
    if (catFilter !== 'all' && catFilter !== 'fridge' && cat.key !== catFilter) {
      return '';
    }

    const items = allTaxonomyItems.filter(item => {
      if (item.parent !== cat.key) return false;

      if (catFilter === 'fridge' && !REFRIGERATED_INGREDIENT_IDS.has(item.id)) {
        return false;
      }

      if (!query) return true;
      if (item.name.toLowerCase().includes(query)) return true;
      if (item.id.toLowerCase().includes(query)) return true;
      if (item.family && item.family.toLowerCase().includes(query)) return true;
      if (['fridge', 'refrigerated', 'refrigerate', 'chilled', 'chill'].includes(query) && REFRIGERATED_INGREDIENT_IDS.has(item.id)) return true;
      if ((item.aliases || []).some(a => a.toLowerCase().includes(query))) return true;
      return (item.brands || []).some(b => b.toLowerCase().includes(query));
    });

    if (items.length === 0) return '';
    totalVisibleBottles += items.length;

    const ownedCount = items.filter(i => state.inventory.has(i.id)).length;

    const pillsHtml = items.map(item => {
      const isOwned = state.inventory.has(item.id);
      const isFridge = REFRIGERATED_INGREDIENT_IDS.has(item.id);
      const bg = item.color || '#c67828';
      const textColor = getContrastColor(bg);
      return `
        <button type="button" class="backbar-pill ${isOwned ? 'active' : ''} ${isFridge ? 'is-fridge-item' : ''}" data-bottle-id="${escapeHtml(item.id)}" aria-pressed="${isOwned}" title="${isFridge ? `${escapeHtml(item.name)} (Keep refrigerated once opened)` : escapeHtml(item.name)}">
          <span class="backbar-pill-dot" style="background-color: ${bg}; color: ${textColor};">${isOwned ? '✓' : ''}</span>
          <span class="backbar-pill-name">${escapeHtml(item.name)}</span>
          ${isFridge ? '<span class="backbar-pill-fridge-tag" aria-label="Refrigerate" title="Keep refrigerated">❄️</span>' : ''}
        </button>
      `;
    }).join('');

    return `
      <div class="backbar-category-section">
        <div class="backbar-category-header">
          <span class="backbar-category-title">${escapeHtml(cat.title)}</span>
          <span class="backbar-category-count">${ownedCount} / ${items.length}</span>
        </div>
        <div class="backbar-pills-grid">
          ${pillsHtml}
        </div>
      </div>
    `;
  }).filter(Boolean).join('');

  if (totalVisibleBottles === 0) {
    elements.backbarCategoriesContainer.innerHTML =  /*html*/`
      <div class="empty-state" style="padding: 2rem 1rem;">
        <p class="empty-state-title">No bottles found</p>
        <p class="card-content-text" style="font-size: 0.8rem;">Try searching for a different bottle or spirit name.</p>
      </div>
    `;
  } else {
    elements.backbarCategoriesContainer.innerHTML =  /*html*/sectionsHtml;
  }

  // Wire pill clicks
  elements.backbarCategoriesContainer.querySelectorAll('.backbar-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      const bottleId = pill.getAttribute('data-bottle-id');
      if (bottleId) {
        toggleInventoryBottle(bottleId);
      }
    });
  });
}

/**
 * Render Ranked Bar Unlock Shopping List
 */
export function renderShoppingListContent() {
  if (!elements.backbarShoppingContainer) return;

  const rankedList = getRankedShoppingList(state.recipes, state.inventory);
  const unlockableItems = rankedList.filter(item => item.unlockCount > 0);

  if (unlockableItems.length === 0) {
    elements.backbarShoppingContainer.innerHTML =  /*html*/`
      <div class="empty-state shopping-empty-state">
        <p class="empty-state-title">No unlocked opportunities</p>
        <p class="card-content-text">
          ${state.inventory.size === 0
        ? 'Add bottles to your backbar to discover which single bottle unlocks the most cocktails.'
        : 'You own ingredients for all reachable cocktails, or no single bottle unlocks new drinks right now.'}
        </p>
      </div>
    `;
    return;
  }

  const formatFamily = (familyKey) => {
    if (!familyKey) return 'Ingredient';
    const foundCat = BACKBAR_CATEGORIES.find(c => c.key === familyKey);
    if (foundCat) return foundCat.title;
    return familyKey.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  const cardsHtml = unlockableItems.map(item => {
    const bg = item.color || '#c67828';
    const textColor = getContrastColor(bg);
    const count = item.unlockCount;
    const badgeText = `+${count} cocktail${count === 1 ? '' : 's'} unlocked`;
    const secondaryNote = item.secondaryCount > 0 ? ` · +${item.secondaryCount} nearly ready` : '';

    const drinksListHtml = (item.unlockedCocktails || []).map(r => `
      <button type="button" class="shopping-drink-pill" data-recipe-id="${escapeHtml(r.id)}" title="View ${escapeHtml(r.name)}">
        <span class="shopping-drink-name">${escapeHtml(r.name)}</span>
        <span class="shopping-drink-meta">${escapeHtml(r.glassware || 'Glass')}${r.glassware && r.method ? ' · ' : ''}${escapeHtml(r.method || '')}</span>
      </button>
    `).join('');

    return /*html*/`
      <div class="shopping-card" data-bottle-id="${escapeHtml(item.id)}">
        <div class="shopping-card-header">
          <div class="shopping-card-left" role="button" tabindex="0" aria-label="Expand ${escapeHtml(item.name)} unlocked cocktails">
            <span class="shopping-pill-dot" style="background-color: ${bg}; color: ${textColor};"></span>
            <div class="shopping-card-info">
              <div class="shopping-card-title-row">
                <h4 class="shopping-card-name">${escapeHtml(item.name)}</h4>
                <span class="shopping-unlock-badge">${escapeHtml(badgeText)}</span>
              </div>
              <span class="shopping-card-family">${escapeHtml(formatFamily(item.family))}${secondaryNote}</span>
            </div>
          </div>
          <div class="shopping-card-actions">
            <button type="button" class="btn btn-secondary btn-sm btn-quick-add-shopping" data-bottle-id="${escapeHtml(item.id)}" title="Add ${escapeHtml(item.name)} to your bar">
              + Add to Bar
            </button>
            <button type="button" class="btn btn-ghost btn-sm btn-toggle-shopping-details" aria-label="Toggle unlocked cocktails" aria-expanded="false" title="Show unlocked cocktails">
              <svg class="chevron-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"></polyline></svg>
            </button>
          </div>
        </div>

        <div class="shopping-card-details" style="display: none;">
          <div class="shopping-details-title">Unlocks ${count} cocktail${count === 1 ? '' : 's'}:</div>
          <div class="shopping-drinks-grid">
            ${drinksListHtml}
          </div>
        </div>
      </div>
    `;
  }).join('');

  elements.backbarShoppingContainer.innerHTML =  /*html*/`
    <div class="shopping-list-grid">
      ${cardsHtml}
    </div>
  `;

  // Wire card events
  elements.backbarShoppingContainer.querySelectorAll('.shopping-card').forEach(card => {
    const toggleBtn = card.querySelector('.btn-toggle-shopping-details');
    const details = card.querySelector('.shopping-card-details');

    const toggleAccordion = () => {
      const isExpanded = details.style.display !== 'none';
      details.style.display = isExpanded ? 'none' : 'block';
      toggleBtn?.setAttribute('aria-expanded', isExpanded ? 'false' : 'true');
      card.classList.toggle('is-expanded', !isExpanded);
    };

    toggleBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleAccordion();
    });

    card.querySelector('.shopping-card-left')?.addEventListener('click', () => {
      toggleAccordion();
    });

    const addBtn = card.querySelector('.btn-quick-add-shopping');
    addBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      const bottleId = addBtn.getAttribute('data-bottle-id');
      if (bottleId) {
        toggleInventoryBottle(bottleId);
        showToast('Added to backbar');
      }
    });

    card.querySelectorAll('.shopping-drink-pill').forEach(pill => {
      pill.addEventListener('click', (e) => {
        e.stopPropagation();
        const recipeId = pill.getAttribute('data-recipe-id');
        if (recipeId) {
          closeBackbarModal();
          if (_selectRecipeFn) {
            _selectRecipeFn(recipeId);
          }
        }
      });
    });
  });
}

/**
 * Render categories and item pills inside backbar modal, or shopping list based on active tab
 */
export function renderBackbarModalContent() {
  const isShopping = state.backbarTab === 'shopping';

  if (elements.backbarInventoryToolbar) {
    elements.backbarInventoryToolbar.style.display = isShopping ? 'none' : 'flex';
  }
  if (elements.backbarNavTabs) {
    elements.backbarNavTabs.style.display = isShopping ? 'none' : 'flex';
  }
  if (elements.backbarCategoriesContainer) {
    elements.backbarCategoriesContainer.style.display = isShopping ? 'none' : 'flex';
  }
  if (elements.backbarShoppingContainer) {
    elements.backbarShoppingContainer.style.display = isShopping ? 'block' : 'none';
  }
  if (elements.backbarDialogSubtitle) {
    elements.backbarDialogSubtitle.textContent = isShopping
      ? 'Cocktails unlocked by adding a single bottle to your bar.'
      : 'Select the bottles and bar staples you keep in stock.';
  }

  if (isShopping) {
    renderShoppingListContent();
  } else {
    renderInventoryPillsContent();
  }
}

/**
 * Setup backbar modal and inventory filter listeners
 */
export function setupBackbarEventListeners() {
  elements.btnMyBar?.addEventListener('click', openBackbarModal);
  elements.btnCloseBackbar?.addEventListener('click', closeBackbarModal);
  elements.btnDoneBackbar?.addEventListener('click', closeBackbarModal);

  // Segmented view switcher: My Bar vs Shopping List
  elements.backbarViewSwitcher?.querySelectorAll('.backbar-view-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const view = tab.getAttribute('data-view') || 'inventory';
      state.backbarTab = view;
      elements.backbarViewSwitcher.querySelectorAll('.backbar-view-tab').forEach(t => {
        const isActive = t.getAttribute('data-view') === view;
        t.classList.toggle('active', isActive);
        t.setAttribute('aria-selected', isActive ? 'true' : 'false');
      });
      renderBackbarModalContent();
    });
  });

  elements.backbarSearchInput?.addEventListener('input', (e) => {
    state.backbarSearchQuery = e.target.value.trim().toLowerCase();
    renderBackbarModalContent();
  });

  elements.backbarNavTabs?.querySelectorAll('.backbar-nav-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const filter = tab.getAttribute('data-cat-filter') || 'all';
      state.backbarCategoryFilter = filter;
      elements.backbarNavTabs.querySelectorAll('.backbar-nav-tab').forEach(t => {
        const isActive = t.getAttribute('data-cat-filter') === filter;
        t.classList.toggle('active', isActive);
        t.setAttribute('aria-selected', isActive ? 'true' : 'false');
      });
      renderBackbarModalContent();
    });
  });

  elements.btnStarterBar?.addEventListener('click', () => {
    const hasAllStarter = DEFAULT_STARTER_BAR.every(id => state.inventory.has(id));
    if (hasAllStarter) return;
    DEFAULT_STARTER_BAR.forEach(id => state.inventory.add(id));
    saveInventory(Array.from(state.inventory));
    invalidateInventoryCache();
    if (_updateMyBarBadgeFn) _updateMyBarBadgeFn();
    if (_renderRecipeListFn) _renderRecipeListFn();
    if (state.viewMode === 'counter' && _renderCounterViewFn) {
      _renderCounterViewFn();
    } else if (state.viewMode === 'home' && _renderHomeViewFn) {
      _renderHomeViewFn();
    }
    renderBackbarModalContent();
    showToast('Loaded Starter Bar essentials');
  });

  elements.btnClearBar?.addEventListener('click', () => {
    if (state.inventory.size === 0) return;
    if (confirm('Clear all bottles from your backbar?')) {
      state.inventory.clear();
      saveInventory([]);
      invalidateInventoryCache();
      if (_updateMyBarBadgeFn) _updateMyBarBadgeFn();
      if (_renderRecipeListFn) _renderRecipeListFn();
      if (state.viewMode === 'counter' && _renderCounterViewFn) {
        _renderCounterViewFn();
      } else if (state.viewMode === 'home' && _renderHomeViewFn) {
        _renderHomeViewFn();
      }
      renderBackbarModalContent();
      showToast('Cleared backbar inventory');
    }
  });

  // Light dismiss fallback for browsers without closedby="any"
  if (elements.backbarModal && !('closedBy' in HTMLDialogElement.prototype)) {
    elements.backbarModal.addEventListener('click', (event) => {
      if (event.target !== elements.backbarModal) return;
      const rect = elements.backbarModal.getBoundingClientRect();
      const isDialogContent = (
        rect.top <= event.clientY &&
        event.clientY <= rect.top + rect.height &&
        rect.left <= event.clientX &&
        event.clientX <= rect.left + rect.width
      );
      if (!isDialogContent) {
        closeBackbarModal();
      }
    });
  }

  // Sidebar themed pack filter pills
  elements.sidebarPackFilter?.querySelectorAll('.pack-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      const pack = btn.getAttribute('data-pack');
      state.packFilter = pack;
      elements.sidebarPackFilter.querySelectorAll('.pack-pill').forEach(b => {
        const isActive = b.getAttribute('data-pack') === pack;
        b.classList.toggle('active', isActive);
        b.setAttribute('aria-selected', isActive ? 'true' : 'false');
      });
      if (_renderRecipeListFn) _renderRecipeListFn();
    });
  });

  // Sidebar inventory filter tabs
  elements.sidebarInventoryFilter?.querySelectorAll('.inventory-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const filter = btn.getAttribute('data-filter');
      state.inventoryFilter = filter;
      elements.sidebarInventoryFilter.querySelectorAll('.inventory-filter-btn').forEach(b => {
        const isActive = b.getAttribute('data-filter') === filter;
        b.classList.toggle('active', isActive);
        b.setAttribute('aria-selected', isActive ? 'true' : 'false');
      });
      if (_renderRecipeListFn) _renderRecipeListFn();
    });
  });
}
