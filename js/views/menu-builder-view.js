/**
 * Speakeasy Menu Builder Page
 * Pick a set of cocktails for an event, see the combined glassware needs and a
 * full ingredient checklist scoped to just that selection, and save it for reuse.
 */

import { state, elements, HOME_DEFAULT_COLLECTIONS, getCachedInventoryAnalysis } from '../state.js';
import { getMenus, saveMenu, deleteMenu, setMenuShare } from '../modules/storage.js';
import {
  publishMenu, pushMenuContents, pushMenuAvailability, pushMenuFeatured, unpublishMenu, guestMenuUrl, qrImageUrl,
} from '../modules/menu-publish.js';
import { REFRIGERATED_INGREDIENT_IDS } from '../modules/taxonomy.js';
import { renderShoppingCard, wireShoppingCardEvents } from '../components/backbar-modal.js';
import { escapeHtml, showToast, CLOSE_ICON_SVG } from '../components/toast.js';
import { closeDialog, enhanceDialog } from '../components/dialog-motion.js';
import { renderGlassSvg } from '../modules/glass-view.js';
import { formatIngredientName } from '../modules/parser.js';
import { openPrintWindow, renderBrandRow, renderCardFooterHtml } from '../components/print-window.js';

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

// Guest-link credentials for the open menu (null until it's been published).
function getActiveShare() {
  const menu = activeMenu.id ? getMenus().find(m => m.id === activeMenu.id) : null;
  return menu && menu.share ? menu.share : null;
}

// Best-effort: the local menu is the source of truth, so a failed unpublish
// (offline, say) must never block deleting it.
function unpublishInBackground(menuId) {
  const menu = getMenus().find(m => m.id === menuId);
  if (menu && menu.share) unpublishMenu(menu.share).catch(() => { });
}

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
        <button type="button" class="btn btn-ghost btn-sm btn-delete-menu" data-menu-id="${escapeHtml(menu.id)}" aria-label="Delete ${escapeHtml(menu.name)}">${CLOSE_ICON_SVG}</button>
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
      unpublishInBackground(id);
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
  const share = getActiveShare();

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
      <button type="button" class="btn btn-secondary btn-sm" data-action="print-menu">Print Guest Menu</button>
      <button type="button" class="btn btn-ghost btn-sm" data-action="delete-menu">Delete Menu</button>
    </div>

    <div class="menu-builder-section" id="menu-builder-guest-link-container"></div>

    <div class="menu-builder-section">
      <div class="menu-builder-section-heading">Cocktails</div>
      <div class="menu-builder-cocktail-list">
        ${selected.map(r => `
          <div class="menu-builder-cocktail-item${share && share.outIds.includes(r.id) ? ' is-out' : ''}">
            <button type="button" class="menu-builder-cocktail-row" data-recipe-id="${escapeHtml(r.id)}">
              <span class="menu-builder-cocktail-name">${escapeHtml(r.name)}</span>
              <span class="menu-builder-cocktail-meta">${escapeHtml(r.glassware || 'Glass')}${r.glassware && r.method ? ' · ' : ''}${escapeHtml(r.method || '')}</span>
            </button>
            ${share ? `
              <button type="button" class="menu-builder-pick-toggle" data-recipe-id="${escapeHtml(r.id)}"
                aria-pressed="${(share.featuredIds || []).includes(r.id)}" aria-label="${escapeHtml(r.name)} is a host's pick"
                title="Star up to ${MAX_HOST_PICKS} drinks as your picks. Guests see them first.">
                <svg width="18" height="18" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><polygon points="12 2.6 14.9 8.9 21.7 9.6 16.6 14.2 18 21 12 17.5 6 21 7.4 14.2 2.3 9.6 9.1 8.9"></polygon></svg>
              </button>
              <button type="button" role="switch" class="menu-builder-out-toggle" data-recipe-id="${escapeHtml(r.id)}"
                aria-checked="${!share.outIds.includes(r.id)}" aria-label="${escapeHtml(r.name)} available to guests"
                title="Turn off when you run out. Guests can't order a drink that's out.">
                <span class="menu-builder-switch-label">${share.outIds.includes(r.id) ? 'Out' : 'Pouring'}</span>
                <span class="menu-builder-switch-track" aria-hidden="true"><span class="menu-builder-switch-knob"></span></span>
              </button>
            ` : ''}
          </div>
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
  container.querySelector('[data-action="print-menu"]')?.addEventListener('click', () => {
    // Measured against the actual print CSS: ~12 cocktails is what reliably
    // fits one page at this icon/text size before the two-column layout
    // spills onto a second page. Only worth flagging past 10, so a menu
    // that's borderline-but-fine doesn't get an unnecessary prompt.
    if (selected.length > PRINT_MENU_RECOMMENDED_MAX_FOR_WARNING) {
      const proceed = confirm(
        `This menu has ${selected.length} cocktails — around 12 is the most that reliably fits on one printed page. It may spill onto a second page. Print anyway?`
      );
      if (!proceed) return;
    }
    const bodyHtml = renderPrintMenuHtml(activeMenu.name, selected);
    const printWin = openPrintWindow(`${activeMenu.name || 'Cocktail Menu'} — Speakeasy`, PRINT_MENU_STYLES, bodyHtml);
    if (!printWin) {
      showToast('Please allow pop-ups to print this menu');
    }
  });
  container.querySelector('[data-action="delete-menu"]')?.addEventListener('click', () => {
    if (!confirm(`Delete "${activeMenu.name}"?`)) return;
    unpublishInBackground(activeMenu.id);
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

  container.querySelectorAll('.menu-builder-out-toggle').forEach(btn => {
    btn.addEventListener('click', () => toggleDrinkOut(btn.getAttribute('data-recipe-id')));
  });
  container.querySelectorAll('.menu-builder-pick-toggle').forEach(btn => {
    btn.addEventListener('click', () => toggleDrinkPick(btn.getAttribute('data-recipe-id')));
  });

  renderGuestLinkSection();
  renderGlasswareTally();
  renderFullIngredientChecklist();
}

/**
 * The "Guest link" card: publish a menu for guests, then show its link, QR
 * code, and copy/share/stop controls.
 */
function renderGuestLinkSection() {
  const section = document.getElementById('menu-builder-guest-link-container');
  if (!section) return;
  const share = getActiveShare();

  if (!share) {
    section.innerHTML = /*html*/`
      <div class="menu-builder-section-heading">Guests</div>
      <div class="menu-builder-guest-link">
        <div class="menu-builder-guest-link-body">
          <span class="menu-builder-guest-link-title">Let guests browse this menu on their own phones</span>
          <p class="card-content-text">They scan a QR code and see these drinks as picture cards. No app or sign-in, and they never see your bar.</p>
          <div class="menu-builder-guest-link-actions">
            <button type="button" class="btn btn-primary btn-sm" data-action="publish-menu">Create guest link</button>
          </div>
        </div>
      </div>
    `;
    section.querySelector('[data-action="publish-menu"]')?.addEventListener('click', handlePublishMenu);
    return;
  }

  const url = guestMenuUrl(share.id);
  section.innerHTML = /*html*/`
    <div class="menu-builder-section-heading">Guests</div>
    <div class="menu-builder-guest-link">
      <button type="button" class="menu-builder-guest-link-qr" data-action="show-qr" aria-label="Show QR code full screen" title="Tap to show full screen">
        <img src="${escapeHtml(qrImageUrl(url))}" alt="QR code for the guest menu" width="140" height="140">
      </button>
      <div class="menu-builder-guest-link-body">
        <span class="menu-builder-guest-link-title">Guest link is live</span>
        <input type="text" class="menu-builder-guest-link-url" readonly value="${escapeHtml(url)}" aria-label="Guest menu link">
        <div class="menu-builder-guest-link-actions">
          <button type="button" class="btn btn-secondary btn-sm" data-action="show-qr">Show QR full screen</button>
          <button type="button" class="btn btn-secondary btn-sm" data-action="copy-guest-link">Copy link</button>
          ${typeof navigator !== 'undefined' && navigator.share ? '<button type="button" class="btn btn-secondary btn-sm" data-action="share-guest-link">Share…</button>' : ''}
          <button type="button" class="btn btn-ghost btn-sm" data-action="stop-sharing">Stop sharing</button>
        </div>
        <p class="card-content-text">Flip a drink to <strong>Out</strong> below when you run out, and star up to three as your <strong>picks</strong>. Guests see changes within a few seconds.</p>
      </div>
    </div>
  `;

  const urlInput = section.querySelector('.menu-builder-guest-link-url');
  urlInput?.addEventListener('focus', () => urlInput.select());
  section.querySelector('[data-action="copy-guest-link"]')?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(url);
      showToast('Guest link copied');
    } catch {
      urlInput?.select();
      showToast('Press copy to grab the link');
    }
  });
  section.querySelector('[data-action="share-guest-link"]')?.addEventListener('click', () => {
    navigator.share({ title: activeMenu.name, url }).catch(() => { });
  });
  section.querySelector('[data-action="stop-sharing"]')?.addEventListener('click', handleStopSharing);
  section.querySelectorAll('[data-action="show-qr"]').forEach(el => {
    el.addEventListener('click', () => openQrFullscreen(url, activeMenu.name, share.id));
  });
}

/**
 * Full-viewport QR for guests to scan from across a room or off a propped-up
 * phone. Also shows the link as a short address to type, for anyone whose
 * camera won't scan.
 * Closes on tap, Escape, or the close button, and keeps the screen awake while
 * it's up (a dimmed phone is a useless QR code).
 */
async function openQrFullscreen(url, menuName, code) {
  const dialog = document.createElement('dialog');
  dialog.className = 'qr-fullscreen';
  dialog.setAttribute('aria-label', 'Guest menu QR code');
  dialog.innerHTML = /*html*/`
    <button type="button" class="qr-fullscreen-close" aria-label="Close">${CLOSE_ICON_SVG}</button>
    <div class="qr-fullscreen-body">
      <div class="qr-fullscreen-eyebrow">Scan for tonight’s menu</div>
      <h2 class="qr-fullscreen-title">${escapeHtml(menuName)}</h2>
      <div class="qr-fullscreen-code-card"><img src="${escapeHtml(qrImageUrl(url, 1024))}" alt="QR code for the guest menu"></div>
      <div class="qr-fullscreen-fallback">Can’t scan? Type this into a browser:<br><strong>${escapeHtml(window.location.host)}/menu/${escapeHtml(code)}</strong></div>
    </div>
  `;
  enhanceDialog(dialog);
  document.body.appendChild(dialog);

  let wakeLock = null;
  try {
    wakeLock = await navigator.wakeLock?.request('screen');
  } catch {
    // Not supported / not allowed: the QR still works, the screen may just dim.
  }
  const cleanup = () => {
    wakeLock?.release().catch(() => { });
    dialog.remove();
  };
  dialog.addEventListener('close', cleanup);
  dialog.addEventListener('click', () => closeDialog(dialog));
  dialog.showModal();
}

async function handlePublishMenu() {
  const btn = document.querySelector('[data-action="publish-menu"]');
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Creating…';
  }
  try {
    const share = await publishMenu(activeMenu.name, getSelectedRecipes());
    setMenuShare(activeMenu.id, share);
    showToast('Guest link created');
  } catch (err) {
    showToast(err.message);
  }
  renderMenuBuilderView();
}

async function handleStopSharing() {
  const share = getActiveShare();
  if (!share) return;
  if (!confirm('Stop sharing? Anyone with the link or QR code will no longer see this menu.')) return;
  try {
    await unpublishMenu(share);
  } catch (err) {
    // Keep the credentials if the server never confirmed, so the host can retry
    // rather than being left with a live link they can no longer revoke.
    showToast(err.message);
    return;
  }
  setMenuShare(activeMenu.id, null);
  showToast('Guest link removed');
  renderMenuBuilderView();
}

// Same cap the server enforces (functions/api/menus/_lib.js).
const MAX_HOST_PICKS = 3;

async function toggleDrinkPick(recipeId) {
  const share = getActiveShare();
  if (!share || !recipeId) return;
  const current = share.featuredIds || [];
  const wasPick = current.includes(recipeId);
  if (!wasPick && current.length >= MAX_HOST_PICKS) {
    showToast(`You can pick up to ${MAX_HOST_PICKS}. Un-star one first.`);
    return;
  }
  const next = wasPick ? current.filter(id => id !== recipeId) : [...current, recipeId];

  // Optimistic, like the Out switch: paint in place, roll back if guests never got it.
  const paint = (ids) => {
    setMenuShare(activeMenu.id, { ...share, featuredIds: ids });
    document.querySelectorAll('.menu-builder-pick-toggle').forEach(btn => {
      btn.setAttribute('aria-pressed', String(ids.includes(btn.getAttribute('data-recipe-id'))));
    });
  };
  paint(next);
  try {
    await pushMenuFeatured(share, next);
    const name = getSelectedRecipes().find(r => r.id === recipeId)?.name || 'Drink';
    showToast(wasPick ? `${name} is no longer a pick` : `${name} is now a host’s pick`);
  } catch (err) {
    if (err.status === 404) {
      forgetDeadGuestLink();
      return;
    }
    paint(current);
    showToast(`Couldn't update guests: ${err.message}`);
  }
}

// The server no longer has this menu (a wiped database, say), so the saved
// link and QR are dead. Drop the stale credentials so "Create guest link"
// comes back instead of leaving a live-looking link that can never update.
function forgetDeadGuestLink() {
  setMenuShare(activeMenu.id, null);
  renderMenuBuilderView();
  showToast('That guest link no longer exists on the server. Create a new one.');
}

async function toggleDrinkOut(recipeId) {
  const share = getActiveShare();
  if (!share || !recipeId) return;
  const wasOut = share.outIds.includes(recipeId);
  const nextOut = wasOut ? share.outIds.filter(id => id !== recipeId) : [...share.outIds, recipeId];

  // Optimistic: the host is mid-pour and shouldn't wait on the network to see
  // the toggle flip, but it must roll back if guests never actually get it.
  // Painted in place rather than via a full re-render, which would throw the
  // host back to the top of a long menu.
  const paint = (outIds) => {
    setMenuShare(activeMenu.id, { ...share, outIds });
    const btn = document.querySelector(`.menu-builder-out-toggle[data-recipe-id="${CSS.escape(recipeId)}"]`);
    const isOut = outIds.includes(recipeId);
    btn?.setAttribute('aria-checked', String(!isOut));
    const label = btn?.querySelector('.menu-builder-switch-label');
    if (label) label.textContent = isOut ? 'Out' : 'Pouring';
    btn?.closest('.menu-builder-cocktail-item')?.classList.toggle('is-out', isOut);
  };
  paint(nextOut);
  try {
    await pushMenuAvailability(share, nextOut);
    const name = getSelectedRecipes().find(r => r.id === recipeId)?.name || 'Drink';
    showToast(wasOut ? `${name} is back on the menu` : `${name} marked out for guests`);
  } catch (err) {
    if (err.status === 404) {
      forgetDeadGuestLink();
      return;
    }
    paint(share.outIds);
    showToast(`Couldn't update guests: ${err.message}`);
  }
}

/**
 * Render the picker + running summary used to add/remove cocktails.
 */
function renderEditMode(container) {
  // An existing saved menu backs out to its summary; a brand-new unsaved one
  // backs out to the menu list (there's nothing yet worth summarizing).
  const backLabel = activeMenu.id ? 'Menu' : 'Menus';
  const selected = getSelectedRecipes();

  container.innerHTML = /*html*/`
    <div class="menu-builder-page-header">
      <div class="menu-builder-header-nav">
        <button type="button" class="menu-builder-back-link" data-action="back">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6"></polyline></svg>
          ${backLabel}
        </button>
        <div class="menu-builder-header-actions">
          <button type="button" class="btn btn-primary btn-sm" data-action="save-menu">Save Menu</button>
        </div>
      </div>
      <div class="menu-builder-hero-title-wrap">
        <input type="text" id="menu-builder-name-input" class="menu-builder-hero-title-input"
          placeholder="Name your menu..." aria-label="Menu name" value="${escapeHtml(activeMenu.name || '')}">
      </div>
      <p class="menu-builder-page-subtitle">Pick cocktails for an event and see what you'll need.</p>
    </div>

    <div class="menu-builder-body">
      <div class="menu-builder-picker-column">
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
          <button type="button" class="btn btn-secondary btn-sm menu-builder-add-ready" data-action="add-all-ready"
            title="Add every cocktail you can make right now with your bar">Add all ready</button>
        </div>
        <div class="menu-builder-picker-container" id="menu-builder-picker-container">
          <!-- Dynamically populated recipe picker pills -->
        </div>
      </div>

      <aside class="menu-builder-summary" aria-label="Selected cocktails">
        <div class="menu-builder-summary-card">
          <div class="menu-builder-summary-header">
            <h2 class="menu-builder-summary-title">Selected Cocktails</h2>
            <span class="menu-builder-summary-badge" id="menu-builder-count-badge">${selected.length}</span>
          </div>
          <div class="menu-builder-selected-container" id="menu-builder-selected-container">
            <!-- Dynamically populated selected-recipe rows -->
          </div>
        </div>
      </aside>
    </div>

    <div class="menu-builder-mobile-bar" id="menu-builder-mobile-bar">
      <span class="menu-builder-mobile-count" id="menu-builder-mobile-count">${selected.length} cocktail${selected.length === 1 ? '' : 's'}</span>
      <button type="button" class="btn btn-primary btn-sm" data-action="save-menu">Save Menu</button>
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
  container.querySelectorAll('[data-action="save-menu"]').forEach(btn => {
    btn.addEventListener('click', handleSaveMenu);
  });
  container.querySelector('[data-action="add-all-ready"]')?.addEventListener('click', addAllReadyDrinks);
  const nameInput = document.getElementById('menu-builder-name-input');
  nameInput?.addEventListener('input', (e) => {
    activeMenu.name = e.target.value;
  });
  nameInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSaveMenu();
    }
  });
  document.getElementById('menu-builder-search-input')?.addEventListener('input', (e) => {
    builderSearchQuery = e.target.value.trim();
    renderPicker();
  });

  renderPicker();
  renderSelectedList();
}

/**
 * Adds every cocktail the bar can make right now (the same `canMake` the
 * sidebar's Ready filter uses) to the menu being built. Drinks already picked
 * stay; nothing is removed, so the host can prune the result afterwards.
 */
function addAllReadyDrinks() {
  const ready = state.recipes.filter(r => getCachedInventoryAnalysis(r).canMake);
  const fresh = ready.filter(r => !activeMenu.recipeIds.includes(r.id));
  if (ready.length === 0) {
    showToast('Nothing is ready to make yet. Add bottles to My Bar first.');
    return;
  }
  activeMenu.recipeIds = [...activeMenu.recipeIds, ...fresh.map(r => r.id)];
  // Open every category that now holds a pick, so the result is visible
  // instead of hiding behind collapsed sections.
  PICKER_CATEGORIES.forEach(cat => {
    if (getRecipesInCategory(cat.key).some(r => activeMenu.recipeIds.includes(r.id))) expandedCategories.add(cat.key);
  });
  renderPicker();
  renderSelectedList();
  showToast(fresh.length === 0
    ? 'All your ready drinks are already on this menu'
    : `Added ${fresh.length} ready drink${fresh.length === 1 ? '' : 's'}`);
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

// Past this many cocktails, the print-menu confirm warns that the layout
// may spill onto a second page — measured empirically against the actual
// print CSS below (64px glass icons, 2-column layout, ~108px per item):
// 12 cocktails fits an 8.5x11 page with margins, 14 does not.
const PRINT_MENU_RECOMMENDED_MAX_FOR_WARNING = 10;

/**
 * Inline styles for the standalone guest-menu print document (see
 * js/components/print-window.js for why this prints in its own window
 * rather than in the live app document) — card-styled like the recipe
 * print, sharing the same navy/gold theme, so the two printouts read as
 * one consistent set rather than two different designs.
 */
const PRINT_MENU_STYLES = /*css*/`
  .menu-card {
    max-width: 7.5in;
    margin: 0 auto;
    background: var(--color-surface-card);
    color: var(--color-text);
    border: 1px solid var(--color-accent);
    border-radius: 12px;
    padding: 28px 32px;
  }
  .menu-title { font-family: var(--font-display); font-size: 28px; font-weight: 600; text-align: center; margin: 0 0 22px; text-transform: uppercase; }
  .menu-items { column-count: 2; column-gap: 0.5in; }
  .menu-item { break-inside: avoid; margin-bottom: 30px; display: flex; gap: 16px; align-items: center; }
  .menu-item svg { width: 64px; height: 64px; flex-shrink: 0; }
  .menu-item-name { font-weight: 700; font-size: 20px; display: block; }
  .menu-item-flavors { font-size: 13px; color: var(--color-text-muted); }
`;

/**
 * Builds the standalone guest-menu print document's <body> HTML —
 * deliberately omits the backbar pantry checklist, glassware tally, and
 * missing-ingredient warnings that the on-screen summary shows, since a
 * guest-facing printout has no business exposing bar-prep internals.
 */
function renderPrintMenuHtml(menuName, selectedRecipes) {
  return /*html*/`
    <div class="menu-card">
      ${renderBrandRow()}
      <h1 class="menu-title">${escapeHtml(menuName || 'Cocktail Menu')}</h1>
      <div class="menu-items">
        ${selectedRecipes.map(r => {
    const flavorSummary = (r.specs || []).map(s => formatIngredientName(s.name)).filter(Boolean).slice(0, 4).join(', ');
    return /*html*/`
            <div class="menu-item">
              ${renderGlassSvg(r, `print-menu-glass-${r.id}`, { mode: 'layered' })}
              <span>
                <span class="menu-item-name">${escapeHtml(r.name)}</span>
                <span class="menu-item-flavors">${escapeHtml(flavorSummary)}</span>
              </span>
            </div>
          `;
  }).join('')}
      </div>
      ${renderCardFooterHtml()}
    </div>
  `;
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

  const countBadge = document.getElementById('menu-builder-count-badge');
  const mobileCount = document.getElementById('menu-builder-mobile-count');
  if (countBadge) countBadge.textContent = selected.length;
  if (mobileCount) mobileCount.textContent = `${selected.length} cocktail${selected.length === 1 ? '' : 's'}`;

  if (selected.length === 0) {
    selectedContainer.innerHTML = /*html*/`
      <div class="menu-builder-empty-state-card">
        <svg class="menu-builder-empty-icon" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M8 22h8m-4-10v10M5 2l7 10 7-10H5z"></path>
        </svg>
        <p class="menu-builder-empty-title">No cocktails added yet</p>
        <p class="menu-builder-empty-hint">Select drinks from the categories on the left or search to add them to this menu.</p>
      </div>
    `;
    return;
  }

  selectedContainer.innerHTML = /*html*/selected.map(r => `
    <div class="hidden-recipe-row" data-id="${escapeHtml(r.id)}">
      <div class="hidden-recipe-meta">
        <span class="hidden-recipe-name">${escapeHtml(r.name)}</span>
        <span class="hidden-recipe-sub">${escapeHtml(r.glassware || 'Glass')}</span>
      </div>
      <button type="button" class="btn btn-ghost btn-sm btn-remove-menu-recipe" data-id="${escapeHtml(r.id)}" aria-label="Remove ${escapeHtml(r.name)}">${CLOSE_ICON_SVG}</button>
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
  const previous = activeMenu.id ? getMenus().find(m => m.id === activeMenu.id) : null;
  // A drink taken off the menu can't stay starred or marked out (the server
  // drops them too; this keeps the local copy in step).
  const stillOnMenu = new Set(activeMenu.recipeIds);
  const share = previous?.share ? {
    ...previous.share,
    outIds: (previous.share.outIds || []).filter(id => stillOnMenu.has(id)),
    featuredIds: (previous.share.featuredIds || []).filter(id => stillOnMenu.has(id)),
  } : undefined;
  const saved = saveMenu({ id: activeMenu.id, name, recipeIds: activeMenu.recipeIds, createdAt: previous?.createdAt, share });
  activeMenu = { id: saved.id, name: saved.name, recipeIds: [...saved.recipeIds] };
  showToast(`Saved "${saved.name}"`);
  if (saved.share) {
    // A published menu keeps its link: push the edit so guests see it too.
    pushMenuContents(saved.share, saved.name, getSelectedRecipes())
      .catch(err => {
        if (err.status === 404) forgetDeadGuestLink();
        else showToast(`Saved here, but the guest link wasn't updated: ${err.message}`);
      });
  }
  // There's now something worth summarizing — land on the read-first view
  // instead of leaving the picker open.
  builderView = 'view';
  setMenuBuilderHash(saved.id);
  renderMenuBuilderView();
}
