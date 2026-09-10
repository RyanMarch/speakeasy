/**
 * Speakeasy Menu Builder Modal Component
 * Pick a set of cocktails for an event, see the combined glassware needs and a
 * shopping list scoped to just that selection, and save it for reuse.
 */

import { state, elements, HOME_DEFAULT_COLLECTIONS, getCachedInventoryAnalysis } from '../state.js';
import { getMenus, saveMenu, deleteMenu } from '../modules/storage.js';
import { renderShoppingCard, wireShoppingCardEvents } from './backbar-modal.js';
import { escapeHtml, showToast } from './toast.js';

let _selectRecipeFn = null;

export function setMenuBuilderCallbacks(cbs) {
  if (cbs.selectRecipe) _selectRecipeFn = cbs.selectRecipe;
}

// The menu currently being edited in the builder pane. Not committed to
// storage until "Save Menu" is pressed.
let activeMenu = { id: null, name: '', recipeIds: [] };
let builderView = 'list'; // 'list' | 'builder'
let builderSearchQuery = '';

// Picker categories mirror the sidebar's own pack filter (see state.js's
// `packFilter` and HOME_DEFAULT_COLLECTIONS) so "browse by category" here
// means the same categories as everywhere else in the app, not a new taxonomy.
// "Other" catches recipes that don't carry any of these pack tags.
const PICKER_CATEGORIES = [...HOME_DEFAULT_COLLECTIONS, { key: 'other', title: 'Other' }];

// Collapsed by default; toggled open per-category as the user browses.
let expandedCategories = new Set();

/**
 * Open the Menu Builder modal, always starting on the saved-menus list.
 */
export function openMenuBuilderModal() {
  builderView = 'list';
  renderMenuListPane();
  showPane('list');
  if (typeof elements.menuBuilderModal?.showModal === 'function') {
    elements.menuBuilderModal.showModal();
  }
}

export function closeMenuBuilderModal() {
  if (typeof elements.menuBuilderModal?.close === 'function') {
    elements.menuBuilderModal.close();
  }
}

function showPane(view) {
  builderView = view;
  if (elements.menuBuilderListPane) {
    elements.menuBuilderListPane.style.display = view === 'list' ? '' : 'none';
  }
  if (elements.menuBuilderBuilderPane) {
    elements.menuBuilderBuilderPane.style.display = view === 'builder' ? '' : 'none';
  }
}

function startNewMenu() {
  activeMenu = { id: null, name: '', recipeIds: [] };
  builderSearchQuery = '';
  expandedCategories = new Set();
  if (elements.menuBuilderSearchInput) elements.menuBuilderSearchInput.value = '';
  showPane('builder');
  renderBuilderPane();
}

function loadMenu(id) {
  const menu = getMenus().find(m => m.id === id);
  if (!menu) return;
  activeMenu = { id: menu.id, name: menu.name, recipeIds: [...menu.recipeIds] };
  builderSearchQuery = '';
  // Loading a menu with picks already in it is exactly when a wall of 182
  // pills is most disorienting — open only the categories that already
  // contain a selected recipe, so what you picked is immediately visible.
  expandedCategories = new Set(
    PICKER_CATEGORIES
      .filter(cat => getRecipesInCategory(cat.key).some(r => activeMenu.recipeIds.includes(r.id)))
      .map(cat => cat.key)
  );
  if (elements.menuBuilderSearchInput) elements.menuBuilderSearchInput.value = '';
  showPane('builder');
  renderBuilderPane();
}

/**
 * Render the "your saved menus" list pane.
 */
export function renderMenuListPane() {
  if (!elements.menuBuilderListContainer) return;

  const menus = getMenus();

  if (menus.length === 0) {
    elements.menuBuilderListContainer.innerHTML = /*html*/`
      <div class="menu-builder-empty-state">
        <p class="empty-state-title">No menus yet</p>
        <p class="card-content-text">Build a menu for an upcoming event — pick a few cocktails and get a combined shopping list and glassware count.</p>
      </div>
    `;
    return;
  }

  elements.menuBuilderListContainer.innerHTML = /*html*/menus.map(menu => `
    <div class="menu-builder-list-row" data-menu-id="${escapeHtml(menu.id)}">
      <div class="menu-builder-list-meta">
        <span class="menu-builder-list-name">${escapeHtml(menu.name)}</span>
        <span class="menu-builder-list-sub">${menu.recipeIds.length} cocktail${menu.recipeIds.length === 1 ? '' : 's'}</span>
      </div>
      <div class="menu-builder-list-actions">
        <button type="button" class="btn btn-secondary btn-sm btn-load-menu" data-menu-id="${escapeHtml(menu.id)}">Load</button>
        <button type="button" class="btn btn-ghost btn-sm btn-delete-menu" data-menu-id="${escapeHtml(menu.id)}" aria-label="Delete ${escapeHtml(menu.name)}">✕</button>
      </div>
    </div>
  `).join('');

  elements.menuBuilderListContainer.querySelectorAll('.btn-load-menu').forEach(btn => {
    btn.addEventListener('click', () => loadMenu(btn.getAttribute('data-menu-id')));
  });

  elements.menuBuilderListContainer.querySelectorAll('.btn-delete-menu').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-menu-id');
      const menu = getMenus().find(m => m.id === id);
      if (!id || !confirm(`Delete "${menu ? menu.name : 'this menu'}"?`)) return;
      deleteMenu(id);
      renderMenuListPane();
      showToast('Menu deleted');
    });
  });
}

/**
 * Render the recipe picker (left) and running menu summary (right) inside the
 * builder pane, based on the current activeMenu / builderSearchQuery state.
 */
export function renderBuilderPane() {
  if (elements.menuBuilderNameInput) {
    elements.menuBuilderNameInput.value = activeMenu.name || '';
  }
  renderPicker();
  renderSelectedList();
  renderGlasswareTally();
  renderFullIngredientChecklist();
}

// Recipes not tagged with any picker category fall into "other" so nothing
// in the library becomes unreachable from the picker.
function getRecipesInCategory(categoryKey) {
  if (categoryKey === 'other') {
    const knownKeys = new Set(HOME_DEFAULT_COLLECTIONS.map(c => c.key));
    return state.recipes.filter(r => !(Array.isArray(r.tags) && r.tags.some(t => knownKeys.has(t))));
  }
  return state.recipes.filter(r => Array.isArray(r.tags) && r.tags.includes(categoryKey));
}

function renderPicker() {
  if (!elements.menuBuilderPickerContainer) return;

  const query = builderSearchQuery.toLowerCase();
  const isSearching = query.length > 0;

  const sectionsHtml = PICKER_CATEGORIES.map(cat => {
    const categoryRecipes = getRecipesInCategory(cat.key);
    const matches = categoryRecipes.filter(r => !query || r.name.toLowerCase().includes(query));
    if (matches.length === 0) return '';

    // While searching, every category with a match opens automatically so
    // results are never hidden behind a collapsed section — but the user's
    // own manual expand/collapse choices are left untouched underneath, so
    // clearing the search returns to how they'd left it.
    const isOpen = isSearching || expandedCategories.has(cat.key);

    const pillsHtml = matches.map(r => {
      const isSelected = activeMenu.recipeIds.includes(r.id);
      return `
        <button type="button" class="backbar-pill ${isSelected ? 'active' : ''}" data-recipe-id="${escapeHtml(r.id)}" aria-pressed="${isSelected}" title="${escapeHtml(r.name)}">
          <span class="backbar-pill-name">${escapeHtml(r.name)}</span>
        </button>
      `;
    }).join('');

    return `
      <div class="menu-builder-category-section">
        <button type="button" class="menu-builder-category-header" data-cat="${escapeHtml(cat.key)}" aria-expanded="${isOpen}">
          <svg class="chevron-icon ${isOpen ? 'is-open' : ''}" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"></polyline></svg>
          <span class="menu-builder-category-title">${escapeHtml(cat.title)}</span>
          <span class="menu-builder-category-count">${matches.length}</span>
        </button>
        <div class="backbar-pills-grid" style="${isOpen ? '' : 'display: none;'}">
          ${pillsHtml}
        </div>
      </div>
    `;
  }).filter(Boolean).join('');

  if (!sectionsHtml) {
    elements.menuBuilderPickerContainer.innerHTML = /*html*/`
      <div class="empty-state" style="padding: 1.5rem 1rem;">
        <p class="card-content-text">No cocktails match your search.</p>
      </div>
    `;
    return;
  }

  elements.menuBuilderPickerContainer.innerHTML = sectionsHtml;

  elements.menuBuilderPickerContainer.querySelectorAll('.menu-builder-category-header').forEach(header => {
    header.addEventListener('click', () => {
      const key = header.getAttribute('data-cat');
      if (!key) return;
      if (expandedCategories.has(key)) {
        expandedCategories.delete(key);
      } else {
        expandedCategories.add(key);
      }
      renderPicker();
    });
  });

  elements.menuBuilderPickerContainer.querySelectorAll('.backbar-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      const id = pill.getAttribute('data-recipe-id');
      if (!id) return;
      if (activeMenu.recipeIds.includes(id)) {
        activeMenu.recipeIds = activeMenu.recipeIds.filter(rId => rId !== id);
      } else {
        activeMenu.recipeIds = [...activeMenu.recipeIds, id];
      }
      renderBuilderPane();
    });
  });
}

function getSelectedRecipes() {
  return activeMenu.recipeIds
    .map(id => state.recipes.find(r => r.id === id))
    .filter(Boolean);
}

function renderSelectedList() {
  if (!elements.menuBuilderSelectedContainer) return;

  const selected = getSelectedRecipes();

  if (selected.length === 0) {
    elements.menuBuilderSelectedContainer.innerHTML = /*html*/`
      <p class="card-content-text menu-builder-empty-hint">Add cocktails from the list to build your menu.</p>
    `;
    return;
  }

  elements.menuBuilderSelectedContainer.innerHTML = /*html*/selected.map(r => `
    <div class="hidden-recipe-row" data-id="${escapeHtml(r.id)}">
      <div class="hidden-recipe-meta">
        <span class="hidden-recipe-name">${escapeHtml(r.name)}</span>
        <span class="hidden-recipe-sub">${escapeHtml(r.glassware || 'Glass')}</span>
      </div>
      <button type="button" class="btn btn-ghost btn-sm btn-remove-menu-recipe" data-id="${escapeHtml(r.id)}" aria-label="Remove ${escapeHtml(r.name)}">✕</button>
    </div>
  `).join('');

  elements.menuBuilderSelectedContainer.querySelectorAll('.btn-remove-menu-recipe').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      activeMenu.recipeIds = activeMenu.recipeIds.filter(rId => rId !== id);
      renderBuilderPane();
    });
  });
}

function renderGlasswareTally() {
  if (!elements.menuBuilderGlasswareContainer) return;

  const selected = getSelectedRecipes();
  if (selected.length === 0) {
    elements.menuBuilderGlasswareContainer.innerHTML = '';
    return;
  }

  const tally = new Map();
  selected.forEach(r => {
    const glass = r.glassware || 'Glass';
    tally.set(glass, (tally.get(glass) || 0) + 1);
  });

  const rows = Array.from(tally.entries()).sort((a, b) => b[1] - a[1]);

  elements.menuBuilderGlasswareContainer.innerHTML = /*html*/`
    <div class="menu-builder-section-heading">Glassware Needed</div>
    <div class="menu-builder-glassware-list">
      ${rows.map(([glass, count]) => `
        <span class="menu-builder-glassware-tag">${count}× ${escapeHtml(glass)}</span>
      `).join('')}
    </div>
  `;
}

/**
 * The actual "supplies" deliverable of a menu: every non-staple ingredient
 * used across the selected recipes, marked as owned or needed — a full prep
 * checklist, not just the gaps. Reuses each recipe's already-computed
 * matchedItems + missingItems (the same non-staple ingredient set the rest of
 * the app treats as "everything this recipe calls for").
 */
function renderFullIngredientChecklist() {
  if (!elements.menuBuilderShoppingContainer) return;

  const selected = getSelectedRecipes();
  if (selected.length === 0) {
    elements.menuBuilderShoppingContainer.innerHTML = '';
    return;
  }

  const ingredientMap = new Map();
  selected.forEach(recipe => {
    const analysis = getCachedInventoryAnalysis(recipe);
    [...analysis.matchedItems, ...analysis.missingItems].forEach(stockStatus => {
      const key = stockStatus.id || stockStatus.name.toLowerCase();
      if (!ingredientMap.has(key)) {
        ingredientMap.set(key, {
          id: stockStatus.id || key,
          name: stockStatus.name || (stockStatus.item ? stockStatus.item.name : key),
          family: stockStatus.family || (stockStatus.item ? stockStatus.item.family : 'other'),
          color: stockStatus.color || (stockStatus.item ? stockStatus.item.color : '#c67828'),
          owned: stockStatus.inStock,
          recipes: [],
        });
      }
      ingredientMap.get(key).recipes.push(recipe);
    });
  });

  const allIngredients = Array.from(ingredientMap.values());
  if (allIngredients.length === 0) {
    elements.menuBuilderShoppingContainer.innerHTML = /*html*/`
      <div class="menu-builder-section-heading">Ingredients Needed</div>
      <p class="card-content-text">No ingredients to list for this menu yet.</p>
    `;
    return;
  }

  // Needs-to-buy first (the actionable part), then what's already on hand;
  // alphabetical within each group.
  allIngredients.sort((a, b) => {
    if (a.owned !== b.owned) return a.owned ? 1 : -1;
    return a.name.localeCompare(b.name);
  });

  const cardsHtml = allIngredients.map(item => {
    const count = item.recipes.length;
    return renderShoppingCard({ ...item, unlockCount: count, unlockedCocktails: item.recipes }, {
      badgeText: item.owned ? 'Have' : 'Need to Buy',
      badgeClass: item.owned ? 'badge-have' : 'badge-need',
      detailsTitle: `Used in ${count} drink${count === 1 ? '' : 's'}:`,
    });
  }).join('');

  elements.menuBuilderShoppingContainer.innerHTML = /*html*/`
    <div class="menu-builder-section-heading">Ingredients Needed</div>
    <div class="shopping-list-grid">${cardsHtml}</div>
  `;

  wireShoppingCardEvents(elements.menuBuilderShoppingContainer, {
    onSelectRecipe: (recipeId) => {
      closeMenuBuilderModal();
      if (_selectRecipeFn) _selectRecipeFn(recipeId);
    },
    onInventoryChange: () => renderFullIngredientChecklist(),
  });
}

function handleSaveMenu() {
  if (activeMenu.recipeIds.length === 0) {
    showToast('Add at least one cocktail before saving');
    return;
  }
  const name = elements.menuBuilderNameInput?.value || '';
  const saved = saveMenu({ id: activeMenu.id, name, recipeIds: activeMenu.recipeIds });
  activeMenu = { id: saved.id, name: saved.name, recipeIds: [...saved.recipeIds] };
  showToast(`Saved "${saved.name}"`);
}

/**
 * Wire Menu Builder modal event listeners (called once at app init).
 */
export function setupMenuBuilderEventListeners() {
  elements.btnCloseMenuBuilder?.addEventListener('click', closeMenuBuilderModal);
  elements.btnNewMenu?.addEventListener('click', startNewMenu);
  elements.btnBackToMenuList?.addEventListener('click', () => {
    showPane('list');
    renderMenuListPane();
  });
  elements.btnSaveMenu?.addEventListener('click', handleSaveMenu);

  elements.menuBuilderSearchInput?.addEventListener('input', (e) => {
    builderSearchQuery = e.target.value.trim();
    renderPicker();
  });

  // Light dismiss fallback for browsers without closedby="any"
  if (elements.menuBuilderModal && !('closedBy' in HTMLDialogElement.prototype)) {
    elements.menuBuilderModal.addEventListener('click', (event) => {
      if (event.target !== elements.menuBuilderModal) return;
      const rect = elements.menuBuilderModal.getBoundingClientRect();
      const isDialogContent = (
        rect.top <= event.clientY &&
        event.clientY <= rect.top + rect.height &&
        rect.left <= event.clientX &&
        event.clientX <= rect.left + rect.width
      );
      if (!isDialogContent) {
        closeMenuBuilderModal();
      }
    });
  }
}
