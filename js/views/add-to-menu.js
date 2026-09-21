/**
 * Speakeasy "Add to Menu"
 * Puts the drink you're looking at onto one of your saved menus without opening
 * the Menu Builder. One menu: it goes straight there. Several: a small chooser.
 * None (or not signed in, since menus belong to an account): the action isn't
 * offered at all, see canAddToMenu().
 *
 * A menu with a live guest link is republished, so guests see the new drink.
 */

import { state } from '../state.js';
import { isAuthenticated } from '../modules/auth.js';
import { getMenus, saveMenu, setMenuShare } from '../modules/storage.js';
import { pushMenuContents } from '../modules/menu-publish.js';
import { applyBarDiet } from '../modules/dietary.js';
import { escapeHtml, showToast } from '../components/toast.js';
import { closeDialog, enhanceDialog } from '../components/dialog-motion.js';

// Same cap the server enforces (functions/api/menus/_lib.js).
const MAX_MENU_DRINKS = 100;

/** Whether "Add to Menu" should be offered: signed in, with at least one menu. */
export function canAddToMenu() {
  return isAuthenticated() && getMenus().length > 0;
}

/**
 * Adds a drink to a menu and, if the menu is live, updates the guest link.
 * @returns {Promise<{ status: 'added'|'exists'|'full'|'missing', link?: 'none'|'updated'|'dead'|'failed', error?: string }>}
 *   `link` says what happened to the guest link of a menu that was added to.
 */
export async function addRecipeToMenu(recipe, menuId) {
  const menu = getMenus().find(m => m.id === menuId);
  if (!menu) return { status: 'missing' };
  if (menu.recipeIds.includes(recipe.id)) return { status: 'exists' };
  if (menu.recipeIds.length >= MAX_MENU_DRINKS) return { status: 'full' };

  const saved = saveMenu({ ...menu, recipeIds: [...menu.recipeIds, recipe.id] });
  if (!saved.share) return { status: 'added', link: 'none' };
  return { status: 'added', ...(await republish(saved)) };
}

async function republish(menu) {
  const byId = new Map(state.recipes.map(r => [r.id, r]));
  const drinks = menu.recipeIds.map(id => byId.get(id)).filter(Boolean).map(r => applyBarDiet(r, state.foamerForEgg));
  try {
    await pushMenuContents(menu.share, menu.name, drinks);
    return { link: 'updated' };
  } catch (err) {
    if (err.status === 404) {
      // The server no longer has this menu; drop its dead link (see the Menu Builder).
      setMenuShare(menu.id, null);
      return { link: 'dead' };
    }
    return { link: 'failed', error: err.message };
  }
}

async function addAndReport(recipe, menu) {
  const result = await addRecipeToMenu(recipe, menu.id);
  if (result.status === 'exists') showToast(`${recipe.name} is already on “${menu.name}”`);
  else if (result.status === 'full') showToast(`“${menu.name}” is full (${MAX_MENU_DRINKS} drinks)`);
  else if (result.status !== 'added') return;
  else if (result.link === 'dead') showToast(`Added ${recipe.name}, but that menu’s guest link no longer exists. Create a new one in Menus.`);
  else if (result.link === 'failed') showToast(`Added ${recipe.name} here, but the guest link wasn’t updated: ${result.error}`);
  else showToast(`Added ${recipe.name} to “${menu.name}”`);
}

/**
 * The action itself. `returnFocusTo` is where focus goes back to after the chooser.
 */
export function startAddToMenu(recipe, { returnFocusTo } = {}) {
  const menus = getMenus();
  if (menus.length === 0) return;
  if (menus.length === 1) {
    addAndReport(recipe, menus[0]);
    return;
  }

  const dialog = document.createElement('dialog');
  dialog.className = 'add-to-menu-dialog';
  dialog.setAttribute('aria-label', `Add ${recipe.name} to a menu`);
  dialog.innerHTML = /*html*/`
    <h2 class="add-to-menu-title">Add to which menu?</h2>
    <p class="add-to-menu-lede">${escapeHtml(recipe.name)}</p>
    <div class="add-to-menu-list">
      ${menus.map(menu => {
    const has = menu.recipeIds.includes(recipe.id);
    return `
          <button type="button" class="add-to-menu-choice" data-menu-id="${escapeHtml(menu.id)}"${has ? ' disabled' : ''}>
            <span class="add-to-menu-name">${escapeHtml(menu.name)}</span>
            <span class="add-to-menu-sub">${has ? 'Already on it' : `${menu.recipeIds.length} cocktail${menu.recipeIds.length === 1 ? '' : 's'}`}</span>
          </button>`;
  }).join('')}
    </div>
    <div class="add-to-menu-actions">
      <button type="button" class="btn btn-ghost btn-sm" data-action="cancel">Cancel</button>
    </div>
  `;
  enhanceDialog(dialog);
  document.body.appendChild(dialog);

  dialog.addEventListener('click', (e) => {
    if (e.target === dialog || e.target.closest('[data-action="cancel"]')) {
      closeDialog(dialog);
      return;
    }
    const choice = e.target.closest('.add-to-menu-choice');
    if (!choice || choice.disabled) return;
    const menu = menus.find(m => m.id === choice.getAttribute('data-menu-id'));
    closeDialog(dialog);
    if (menu) addAndReport(recipe, menu);
  });
  dialog.addEventListener('close', () => {
    dialog.remove();
    returnFocusTo?.focus?.({ preventScroll: true });
  });
  dialog.showModal();
}
