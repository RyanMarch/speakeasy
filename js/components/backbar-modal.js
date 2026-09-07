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
} from '../modules/taxonomy.js';

import { escapeHtml, showToast } from './toast.js';

let _updateMyBarBadgeFn = null;
let _renderRecipeListFn = null;
let _renderCounterViewFn = null;
let _renderHomeViewFn = null;

export function setBackbarModalCallbacks(cbs) {
  if (cbs.updateMyBarBadge) _updateMyBarBadgeFn = cbs.updateMyBarBadge;
  if (cbs.renderRecipeList) _renderRecipeListFn = cbs.renderRecipeList;
  if (cbs.renderCounterView) _renderCounterViewFn = cbs.renderCounterView;
  if (cbs.renderHomeView) _renderHomeViewFn = cbs.renderHomeView;
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
 * Render categories and item pills inside backbar modal
 */
export function renderBackbarModalContent() {
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
 * Setup backbar modal and inventory filter listeners
 */
export function setupBackbarEventListeners() {
  elements.btnMyBar?.addEventListener('click', openBackbarModal);
  elements.btnCloseBackbar?.addEventListener('click', closeBackbarModal);
  elements.btnDoneBackbar?.addEventListener('click', closeBackbarModal);

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
