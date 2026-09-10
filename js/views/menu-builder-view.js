/**
 * Speakeasy Menu Builder Page
 * Pick a set of cocktails for an event, see the combined glassware needs and a
 * full ingredient checklist scoped to just that selection, and save it for reuse.
 */

import { state, elements, HOME_DEFAULT_COLLECTIONS, getCachedInventoryAnalysis } from '../state.js';
import { getMenus, saveMenu, deleteMenu } from '../modules/storage.js';
import { REFRIGERATED_INGREDIENT_IDS } from '../modules/taxonomy.js';
import { renderShoppingCard, wireShoppingCardEvents } from '../components/backbar-modal.js';
import { escapeHtml, showToast } from '../components/toast.js';

let _selectRecipeFn = null;
let _goHomeFn = null;

export function setMenuBuilderCallbacks(cbs) {
  if (cbs.selectRecipe) _selectRecipeFn = cbs.selectRecipe;
  if (cbs.goHome) _goHomeFn = cbs.goHome;
}

// The menu currently open. Edits to recipeIds only commit to storage when
// "Save" is pressed in edit mode.
let activeMenu = { id: null, name: '', recipeIds: [] };
let builderView = 'list'; // 'list' | 'view' | 'edit'
let builderSearchQuery = '';

// Picker categories mirror the sidebar's own pack filter (see state.js's
// `packFilter` and HOME_DEFAULT_COLLECTIONS) so "browse by category" here
// means the same categories as everywhere else in the app, not a new taxonomy.
// "Other" catches recipes that don't carry any of these pack tags.
const PICKER_CATEGORIES = [...HOME_DEFAULT_COLLECTIONS, { key: 'other', title: 'Other' }];

// Collapsed by default; toggled open per-category as the user browses.
let expandedCategories = new Set();

// Ingredients checklist: filter toggle and storage-location grouping. Bucketed
// by where you'd actually go to grab it — bottles at the bar, perishables in
// the fridge, everything else (bitters, syrups, mixers) in the pantry —
// rather than the taxonomy's finer spirit-family coloring, which wasn't
// pulling its weight as a way to scan the list.
let ingredientFilter = 'all'; // 'all' | 'need'

const INGREDIENT_SECTIONS = [
  { key: 'bar', title: 'Bar' },
  { key: 'fridge', title: 'Fridge' },
  { key: 'pantry', title: 'Pantry' },
];

function getIngredientSection(entry) {
  if (REFRIGERATED_INGREDIENT_IDS.has(entry.id)) return 'fridge';
  if (['spirits', 'fortified_wine', 'liqueurs'].includes(entry.parent)) return 'bar';
  return 'pantry';
}

/**
 * Push (or replace) the URL hash to reflect the current menu-builder state,
 * so the browser back/forward buttons and page refresh work correctly:
 * `#menus` for the list, `#menus/<id>` for a specific menu's summary. Edit
 * mode deliberately doesn't get its own hash entry — it's a transient
 * sub-state reached by a direct button click, not a place worth landing on
 * via back/forward (mirrors how e.g. "Search Cocktails" doesn't push history).
 */
function setMenuBuilderHash(menuId) {
  const hash = menuId ? `#menus/${menuId}` : '#menus';
  if (window.location.hash !== hash) {
    history.pushState(null, '', hash);
  }
}

/**
 * Render the Menu Builder page: the saved-menus list, or the active builder,
 * depending on `builderView`. Called by the router whenever this page becomes
 * the active view, and re-called internally on every interaction (same
 * whole-container-re-render pattern as renderHomeView).
 */
export function renderMenuBuilderView() {
  const container = elements.menuBuilderViewContainer;
  if (!container) return;

  if (builderView === 'list') {
    renderListView(container);
  } else if (builderView === 'view') {
    renderViewMode(container);
  } else {
    renderEditMode(container);
  }
}

/**
 * Reset to the saved-menus list without touching the URL — used when the
 * Menu Builder page is (re)entered fresh from Home, so a stale in-progress
 * view/edit from earlier in the session doesn't leak back in.
 */
export function resetMenuBuilderToList() {
  builderView = 'list';
}

/**
 * Apply a `#menus` or `#menus/<id>` hash to the menu-builder state and
 * re-render, WITHOUT pushing a new history entry. Used both by the
 * hashchange listener (browser back/forward) and by the initial page-load
 * routing (deep link / refresh) in app.js.
 */
export function applyMenuBuilderHash(menuId) {
  if (menuId) {
    const menu = getMenus().find(m => m.id === menuId);
    if (menu) {
      activeMenu = { id: menu.id, name: menu.name, recipeIds: [...menu.recipeIds] };
      builderView = 'view';
    } else {
      builderView = 'list';
    }
  } else {
    builderView = 'list';
  }
  renderMenuBuilderView();
}

function startNewMenu() {
  // Nothing to summarize yet on a brand-new menu — go straight to picking.
  // No hash change: an unsaved draft isn't worth its own history entry.
  activeMenu = { id: null, name: '', recipeIds: [] };
  builderSearchQuery = '';
  expandedCategories = new Set();
  builderView = 'edit';
  renderMenuBuilderView();
}

function loadMenu(id) {
  const menu = getMenus().find(m => m.id === id);
  if (!menu) return;
  activeMenu = { id: menu.id, name: menu.name, recipeIds: [...menu.recipeIds] };
  // Loading a saved menu is a "what do I need for this party" moment, not an
  // invitation to keep adding drinks — land on the read-first summary.
  builderView = 'view';
  setMenuBuilderHash(id);
  renderMenuBuilderView();
}

function beginEditingActiveMenu() {
  builderSearchQuery = '';
  // Opening the picker on a menu that already has picks is exactly when a
  // wall of 182 pills is most disorienting — open only the categories that
  // already contain a selected recipe, so what's picked is immediately visible.
  expandedCategories = new Set(
    PICKER_CATEGORIES
      .filter(cat => getRecipesInCategory(cat.key).some(r => activeMenu.recipeIds.includes(r.id)))
      .map(cat => cat.key)
  );
  builderView = 'edit';
  renderMenuBuilderView();
}

/**
 * Render the "your saved menus" list page.
 */
function renderListView(container) {
  const menus = getMenus();

  const listHtml = menus.length === 0 ? /*html*/`
    <div class="menu-builder-empty-state">
      <p class="empty-state-title">No menus yet</p>
      <p class="card-content-text">Build a menu for an upcoming event — pick a few cocktails and get a combined ingredient checklist and glassware count.</p>
    </div>
  ` : /*html*/menus.map(menu => `
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

  container.innerHTML = /*html*/`
    <div class="menu-builder-page-header">
      <button type="button" class="menu-builder-back-link" data-action="go-home">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6"></polyline></svg>
        Home
      </button>
      <h1 class="menu-builder-page-title">Menu Builder</h1>
      <p class="menu-builder-page-subtitle">Pick cocktails for an event and see what you'll need.</p>
    </div>

    <div class="menu-builder-list-container">${listHtml}</div>

    <div class="menu-builder-page-actions">
      <button type="button" class="btn btn-primary btn-sm" data-action="new-menu">+ New Menu</button>
    </div>
  `;

  container.querySelector('[data-action="go-home"]')?.addEventListener('click', () => _goHomeFn?.());
  container.querySelector('[data-action="new-menu"]')?.addEventListener('click', startNewMenu);

  container.querySelectorAll('.btn-load-menu').forEach(btn => {
    btn.addEventListener('click', () => loadMenu(btn.getAttribute('data-menu-id')));
  });

  container.querySelectorAll('.btn-delete-menu').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-menu-id');
      const menu = getMenus().find(m => m.id === id);
      if (!id || !confirm(`Delete "${menu ? menu.name : 'this menu'}"?`)) return;
      deleteMenu(id);
      renderMenuBuilderView();
      showToast('Menu deleted');
    });
  });
}

/**
 * Render the read-first summary of a saved menu: the cocktail list, glassware
 * tally, and ingredient checklist, full-width — the actual "what do I need
 * for this party" deliverable. Editing the drink list is a deliberate
 * side-trip from here, not the default landing state.
 */
function renderViewMode(container) {
  const selected = getSelectedRecipes();

  container.innerHTML = /*html*/`
    <div class="menu-builder-page-header">
      <button type="button" class="menu-builder-back-link" data-action="back-to-list">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6"></polyline></svg>
        Menus
      </button>
      <h1 class="menu-builder-page-title">${escapeHtml(activeMenu.name)}</h1>
      <p class="menu-builder-page-subtitle">${selected.length} cocktail${selected.length === 1 ? '' : 's'}</p>
    </div>

    <div class="menu-builder-view-actions">
      <button type="button" class="btn btn-secondary btn-sm" data-action="edit-cocktails">Edit Cocktails</button>
      <button type="button" class="btn btn-ghost btn-sm" data-action="delete-menu">Delete Menu</button>
    </div>

    <div class="menu-builder-section">
      <div class="menu-builder-section-heading">Cocktails</div>
      <div class="menu-builder-cocktail-list">
        ${selected.map(r => `
          <button type="button" class="menu-builder-cocktail-row" data-recipe-id="${escapeHtml(r.id)}">
            <span class="menu-builder-cocktail-name">${escapeHtml(r.name)}</span>
            <span class="menu-builder-cocktail-meta">${escapeHtml(r.glassware || 'Glass')}${r.glassware && r.method ? ' · ' : ''}${escapeHtml(r.method || '')}</span>
          </button>
        `).join('')}
      </div>
    </div>

    <div class="menu-builder-section" id="menu-builder-glassware-container"></div>
    <div class="menu-builder-section" id="menu-builder-shopping-container"></div>
  `;

  container.querySelector('[data-action="back-to-list"]')?.addEventListener('click', () => {
    builderView = 'list';
    setMenuBuilderHash(null);
    renderMenuBuilderView();
  });
  container.querySelector('[data-action="edit-cocktails"]')?.addEventListener('click', beginEditingActiveMenu);
  container.querySelector('[data-action="delete-menu"]')?.addEventListener('click', () => {
    if (!confirm(`Delete "${activeMenu.name}"?`)) return;
    deleteMenu(activeMenu.id);
    builderView = 'list';
    setMenuBuilderHash(null);
    renderMenuBuilderView();
    showToast('Menu deleted');
  });

  container.querySelectorAll('.menu-builder-cocktail-row').forEach(row => {
    row.addEventListener('click', () => {
      const id = row.getAttribute('data-recipe-id');
      if (id && _selectRecipeFn) _selectRecipeFn(id);
    });
  });

  renderGlasswareTally();
  renderFullIngredientChecklist();
}

/**
 * Render the picker + running summary used to add/remove cocktails.
 */
function renderEditMode(container) {
  // An existing saved menu backs out to its summary; a brand-new unsaved one
  // backs out to the menu list (there's nothing yet worth summarizing).
  const backLabel = activeMenu.id ? 'Menu' : 'Menus';

  container.innerHTML = /*html*/`
    <div class="menu-builder-page-header">
      <button type="button" class="menu-builder-back-link" data-action="back">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6"></polyline></svg>
        ${backLabel}
      </button>
      <h1 class="menu-builder-page-title">${escapeHtml(activeMenu.name) || 'New Menu'}</h1>
      <p class="menu-builder-page-subtitle">Pick cocktails for an event and see what you'll need.</p>
    </div>

    <div class="backbar-toolbar menu-builder-toolbar">
      <div class="search-input-wrapper backbar-search-wrapper">
        <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
          stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <input type="search" id="menu-builder-search-input" class="search-input"
          placeholder="Search cocktails..." aria-label="Search cocktails to add" value="${escapeHtml(builderSearchQuery)}">
      </div>
    </div>

    <div class="menu-builder-body">
      <div class="menu-builder-picker-container" id="menu-builder-picker-container">
        <!-- Dynamically populated recipe picker pills -->
      </div>
      <div class="menu-builder-summary">
        <div class="menu-builder-selected-container" id="menu-builder-selected-container">
          <!-- Dynamically populated selected-recipe rows -->
        </div>
      </div>
    </div>

    <div class="menu-builder-page-footer">
      <input type="text" id="menu-builder-name-input" class="menu-builder-name-input"
        placeholder="Menu name..." aria-label="Menu name" value="${escapeHtml(activeMenu.name || '')}">
      <button type="button" class="btn btn-primary btn-sm" data-action="save-menu">Save</button>
    </div>
  `;

  container.querySelector('[data-action="back"]')?.addEventListener('click', () => {
    if (activeMenu.id) {
      builderView = 'view';
    } else {
      builderView = 'list';
    }
    renderMenuBuilderView();
  });
  container.querySelector('[data-action="save-menu"]')?.addEventListener('click', handleSaveMenu);
  document.getElementById('menu-builder-search-input')?.addEventListener('input', (e) => {
    builderSearchQuery = e.target.value.trim();
    renderPicker();
  });

  renderPicker();
  renderSelectedList();
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
  const pickerContainer = document.getElementById('menu-builder-picker-container');
  if (!pickerContainer) return;

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
    pickerContainer.innerHTML = /*html*/`
      <div class="empty-state" style="padding: 1.5rem 1rem;">
        <p class="card-content-text">No cocktails match your search.</p>
      </div>
    `;
    return;
  }

  pickerContainer.innerHTML = sectionsHtml;

  pickerContainer.querySelectorAll('.menu-builder-category-header').forEach(header => {
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

  pickerContainer.querySelectorAll('.backbar-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      const id = pill.getAttribute('data-recipe-id');
      if (!id) return;
      if (activeMenu.recipeIds.includes(id)) {
        activeMenu.recipeIds = activeMenu.recipeIds.filter(rId => rId !== id);
      } else {
        activeMenu.recipeIds = [...activeMenu.recipeIds, id];
      }
      renderPicker();
      renderSelectedList();
    });
  });
}

function getSelectedRecipes() {
  return activeMenu.recipeIds
    .map(id => state.recipes.find(r => r.id === id))
    .filter(Boolean);
}

function renderSelectedList() {
  const selectedContainer = document.getElementById('menu-builder-selected-container');
  if (!selectedContainer) return;

  const selected = getSelectedRecipes();

  if (selected.length === 0) {
    selectedContainer.innerHTML = /*html*/`
      <p class="card-content-text menu-builder-empty-hint">Add cocktails from the list to build your menu.</p>
    `;
    return;
  }

  selectedContainer.innerHTML = /*html*/selected.map(r => `
    <div class="hidden-recipe-row" data-id="${escapeHtml(r.id)}">
      <div class="hidden-recipe-meta">
        <span class="hidden-recipe-name">${escapeHtml(r.name)}</span>
        <span class="hidden-recipe-sub">${escapeHtml(r.glassware || 'Glass')}</span>
      </div>
      <button type="button" class="btn btn-ghost btn-sm btn-remove-menu-recipe" data-id="${escapeHtml(r.id)}" aria-label="Remove ${escapeHtml(r.name)}">✕</button>
    </div>
  `).join('');

  selectedContainer.querySelectorAll('.btn-remove-menu-recipe').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      activeMenu.recipeIds = activeMenu.recipeIds.filter(rId => rId !== id);
      renderPicker();
      renderSelectedList();
    });
  });
}

function renderGlasswareTally() {
  const glasswareContainer = document.getElementById('menu-builder-glassware-container');
  if (!glasswareContainer) return;

  const selected = getSelectedRecipes();
  if (selected.length === 0) {
    glasswareContainer.innerHTML = '';
    return;
  }

  const tally = new Map();
  selected.forEach(r => {
    const glass = r.glassware || 'Glass';
    tally.set(glass, (tally.get(glass) || 0) + 1);
  });

  const rows = Array.from(tally.entries()).sort((a, b) => b[1] - a[1]);

  glasswareContainer.innerHTML = /*html*/`
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
  const shoppingContainer = document.getElementById('menu-builder-shopping-container');
  if (!shoppingContainer) return;

  const selected = getSelectedRecipes();
  if (selected.length === 0) {
    shoppingContainer.innerHTML = '';
    return;
  }

  const ingredientMap = new Map();
  selected.forEach(recipe => {
    const analysis = getCachedInventoryAnalysis(recipe);
    [...analysis.matchedItems, ...analysis.missingItems].forEach(stockStatus => {
      const key = stockStatus.id || stockStatus.name.toLowerCase();
      const displayName = stockStatus.name || (stockStatus.item ? stockStatus.item.name : key);
      if (!ingredientMap.has(key)) {
        ingredientMap.set(key, {
          id: stockStatus.id || key,
          // Different recipes can call for different specific products that
          // share one taxonomy bucket (e.g. Falernum vs. Allspice Dram) —
          // track every distinct name seen so the card's expandable detail
          // can list them (see renderShoppingCard's `altNames`), without
          // joining them into the header, which reads as broken UI.
          names: [displayName],
          name: displayName,
          family: stockStatus.family || (stockStatus.item ? stockStatus.item.family : 'other'),
          parent: stockStatus.item ? stockStatus.item.parent : null,
          color: stockStatus.color || (stockStatus.item ? stockStatus.item.color : '#c67828'),
          owned: stockStatus.inStock,
          recipes: [],
        });
      } else {
        const entry = ingredientMap.get(key);
        if (!entry.names.includes(displayName)) {
          entry.names.push(displayName);
        }
      }
      ingredientMap.get(key).recipes.push(recipe);
    });
  });

  const allIngredients = Array.from(ingredientMap.values());
  if (allIngredients.length === 0) {
    shoppingContainer.innerHTML = /*html*/`
      <div class="menu-builder-section-heading">Ingredients Needed</div>
      <p class="card-content-text">No ingredients to list for this menu yet.</p>
    `;
    return;
  }

  const visibleIngredients = ingredientFilter === 'need'
    ? allIngredients.filter(i => !i.owned)
    : allIngredients;

  const sectionsHtml = INGREDIENT_SECTIONS.map(section => {
    // Needs-to-buy first (the actionable part), then what's already on hand;
    // alphabetical within each group.
    const items = visibleIngredients
      .filter(i => getIngredientSection(i) === section.key)
      .sort((a, b) => {
        if (a.owned !== b.owned) return a.owned ? 1 : -1;
        return a.name.localeCompare(b.name);
      });
    if (items.length === 0) return '';

    const cardsHtml = items.map(item => {
      const count = item.recipes.length;
      return renderShoppingCard({ ...item, unlockCount: count, unlockedCocktails: item.recipes }, {
        badgeText: item.owned ? 'Have on Hand' : 'Needed',
        badgeClass: item.owned ? 'badge-have' : 'badge-need',
        detailsTitle: `Used in ${count} drink${count === 1 ? '' : 's'}:`,
        hideDot: true,
        hideFamily: true,
      });
    }).join('');

    return /*html*/`
      <div class="menu-builder-ingredient-section">
        <div class="menu-builder-ingredient-section-header">
          <span class="menu-builder-ingredient-section-title">${escapeHtml(section.title)}</span>
          <span class="menu-builder-ingredient-section-count">${items.length}</span>
        </div>
        <div class="shopping-list-grid">${cardsHtml}</div>
      </div>
    `;
  }).filter(Boolean).join('');

  shoppingContainer.innerHTML = /*html*/`
    <div class="menu-builder-shopping-header">
      <div class="menu-builder-section-heading">Ingredients Needed</div>
      <div class="menu-builder-filter-toggle" role="group" aria-label="Filter ingredients">
        <button type="button" class="menu-builder-filter-btn ${ingredientFilter === 'all' ? 'active' : ''}" data-filter="all">All</button>
        <button type="button" class="menu-builder-filter-btn ${ingredientFilter === 'need' ? 'active' : ''}" data-filter="need">Need to Buy</button>
      </div>
    </div>
    ${sectionsHtml || '<p class="card-content-text">You already have everything for this menu.</p>'}
  `;

  shoppingContainer.querySelectorAll('.menu-builder-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      ingredientFilter = btn.getAttribute('data-filter');
      renderFullIngredientChecklist();
    });
  });

  wireShoppingCardEvents(shoppingContainer, {
    onSelectRecipe: (recipeId) => {
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
  const name = document.getElementById('menu-builder-name-input')?.value || '';
  const saved = saveMenu({ id: activeMenu.id, name, recipeIds: activeMenu.recipeIds });
  activeMenu = { id: saved.id, name: saved.name, recipeIds: [...saved.recipeIds] };
  showToast(`Saved "${saved.name}"`);
  // There's now something worth summarizing — land on the read-first view
  // instead of leaving the picker open.
  builderView = 'view';
  setMenuBuilderHash(saved.id);
  renderMenuBuilderView();
}
