/**
 * Speakeasy Shared Recipe View
 * Read-only display of a cocktail fetched from a public share link, with an
 * "Add to My Library" action. Deliberately standalone — it does not touch
 * state.recipes/state.inventory/riff-mode state, since a visitor opening a
 * shared link may not even have the app's normal state hydrated yet.
 */

import { state, elements } from '../state.js';
import { getRecipes, saveRecipe, sanitizeImportedRecipes } from '../modules/storage.js';
import { formatIngredientName, formatFraction, renderInstructionTimers } from '../modules/parser.js';
import { escapeHtml, showToast } from '../components/toast.js';
import { GlassView } from '../modules/glass-view.js';
import { calculateFluidLayers } from '../modules/colors.js';
import { calculateCocktailAbv, calculateCocktailCalories } from '../modules/abv.js';
import { calculateBalanceProfile, renderFlavorRadarSvg } from '../modules/balance.js';
import { openTimerModal } from '../components/timer-modal.js';

let _selectRecipeFn = null;
let _goHomeFn = null;
let _refreshRecipeListFn = null;

export function setSharedRecipeViewCallbacks({ selectRecipe, goHome, refreshRecipeList }) {
  if (selectRecipe) _selectRecipeFn = selectRecipe;
  if (goHome) _goHomeFn = goHome;
  if (refreshRecipeList) _refreshRecipeListFn = refreshRecipeList;
}

function formatSpecLine(spec) {
  const amountText = spec.amount !== null && spec.amount !== undefined ? formatFraction(spec.amount) : '';
  const unitText = spec.unit || (amountText ? '' : 'to taste');
  const name = formatIngredientName(spec.name || '');
  const measure = [amountText, unitText].filter(Boolean).join(' ');
  return { measure, name };
}

function renderLoading(container) {
  container.innerHTML = /*html*/`
    <div class="empty-state shared-recipe-loading">
      <div class="empty-state-title">Loading cocktail…</div>
    </div>
  `;
}

function renderError(container, message) {
  container.innerHTML = /*html*/`
    <div class="empty-state">
      <svg class="empty-state-icon" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="8" x2="12" y2="12"></line>
        <line x1="12" y1="16" x2="12.01" y2="16"></line>
      </svg>
      <div class="empty-state-title">${escapeHtml(message)}</div>
      <div class="empty-state-actions">
        <button type="button" class="btn btn-secondary btn-sm" id="btn-shared-recipe-go-home">Back to Speakeasy</button>
      </div>
    </div>
  `;
  document.getElementById('btn-shared-recipe-go-home')?.addEventListener('click', () => {
    if (_goHomeFn) _goHomeFn();
  });
}

function renderRecipe(container, recipe) {
  const specs = Array.isArray(recipe.specs) ? recipe.specs : [];
  const tags = Array.isArray(recipe.tags) ? recipe.tags : [];

  const layers = calculateFluidLayers(specs);
  const totalOz = layers.length > 0 ? layers[0].totalVolOz : 0;
  const totalDisplay = `${totalOz.toFixed(2)} oz`;

  const abvInfo = calculateCocktailAbv(specs, recipe.method);
  const roundedAbv = Math.round(abvInfo.estimatedAbv);
  const abvDisplay = roundedAbv > 0 ? `${roundedAbv}% ABV` : 'Non-Alcoholic';

  const calorieInfo = calculateCocktailCalories(specs);
  const calorieDisplay = calorieInfo.totalKcal > 0 ? `~${calorieInfo.totalKcal} kcal` : null;

  const flavorProfile = calculateBalanceProfile(specs);
  const flavorRadarSvg = renderFlavorRadarSvg(flavorProfile);

  container.innerHTML = /*html*/`
    <div class="shared-recipe-card">
      <div class="shared-recipe-badge">Shared Cocktail</div>
      <h1 class="shared-recipe-name">${escapeHtml(recipe.name)}</h1>
      <div class="shared-recipe-meta">
        <span>${escapeHtml(recipe.glassware || 'Rocks')}</span>
        <span class="meta-dot-divider">·</span>
        <span>${escapeHtml(recipe.method || 'Stirred')}</span>
        <span class="meta-dot-divider">·</span>
        <span title="Dilution-adjusted estimated alcohol by volume">${escapeHtml(abvDisplay)}</span>
        ${calorieDisplay ? /*html*/`
          <span class="meta-dot-divider">·</span>
          <span class="drink-meta-calories">
            ${escapeHtml(calorieDisplay)}
            <button type="button" id="btn-shared-calorie-info" class="btn-calorie-info" aria-label="Calorie estimate info">ⓘ</button>
            <span class="calorie-popover" id="shared-calorie-popover" role="tooltip" aria-hidden="true">~${calorieInfo.alcoholKcal} kcal alcohol &nbsp;·&nbsp; ~${calorieInfo.sugarKcal} kcal sugar &nbsp;·&nbsp; estimates vary by brand</span>
          </span>
        ` : ''}
      </div>
      ${recipe.riffOfName ? `<div class="shared-recipe-riff-note">A riff on <em>${escapeHtml(recipe.riffOfName)}</em></div>` : ''}
      ${recipe.description ? `<p class="shared-recipe-description">${escapeHtml(recipe.description)}</p>` : ''}

      <div class="shared-recipe-body">
        <div class="shared-recipe-glass-col">
          <div class="glass-wrapper shared-recipe-glass-wrapper" id="shared-recipe-glass-wrapper"></div>

          <div class="glass-view-toggle-wrap">
            <div class="glass-view-toggle" role="group" aria-label="Cocktail presentation mode">
              <button type="button" class="glass-view-btn active" data-mode="layered" title="View ingredient fluid ratio layers">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <line x1="3" y1="6" x2="21" y2="6"></line>
                  <line x1="3" y1="12" x2="21" y2="12"></line>
                  <line x1="3" y1="18" x2="21" y2="18"></line>
                </svg>
                <span>Layers</span>
              </button>
              <button type="button" class="glass-view-btn" data-mode="blended" title="View blended cocktail color">
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
          <div class="flavor-radar-card">
            <span class="flavor-radar-title">Flavor Profile</span>
            ${flavorRadarSvg}
          </div>
        </div>

        <div class="shared-recipe-details-col">
          <h2 class="shared-recipe-section-title">Ingredients</h2>
          <ul class="shared-recipe-specs">
            ${specs.map(spec => {
              const { measure, name } = formatSpecLine(spec);
              return /*html*/`<li><span class="spec-amount">${escapeHtml(measure)}</span><span class="spec-name">${escapeHtml(name)}</span></li>`;
            }).join('')}
          </ul>

          ${recipe.instructions ? /*html*/`
            <h2 class="shared-recipe-section-title">Instructions</h2>
            <p class="shared-recipe-instructions">${renderInstructionTimers(recipe.instructions, escapeHtml)}</p>
          ` : ''}

          ${recipe.notes ? /*html*/`
            <h2 class="shared-recipe-section-title">Notes</h2>
            <p class="shared-recipe-instructions">${escapeHtml(recipe.notes)}</p>
          ` : ''}

          ${tags.length > 0 ? /*html*/`
            <div class="drink-tags-chips shared-recipe-tags">
              ${tags.map(tag => `<span class="drink-tag-chip"><span class="drink-tag-text">#${escapeHtml(tag)}</span></span>`).join('')}
            </div>
          ` : ''}
        </div>
      </div>

      <div class="shared-recipe-actions">
        <button type="button" class="btn btn-primary" id="btn-add-shared-to-library">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          <span>Add to My Library</span>
        </button>
      </div>
    </div>
  `;

  const glassContainer = document.getElementById('shared-recipe-glass-wrapper');
  const glassView = new GlassView(glassContainer);
  glassView.render(recipe, 'layered');

  container.querySelectorAll('.glass-view-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetMode = btn.getAttribute('data-mode');
      if (!targetMode) return;
      container.querySelectorAll('.glass-view-btn').forEach(b => b.classList.toggle('active', b === btn));
      glassView.setMode(targetMode);
    });
  });

  document.getElementById('btn-shared-calorie-info')?.addEventListener('click', (e) => {
    e.stopPropagation();
    const popover = document.getElementById('shared-calorie-popover');
    if (!popover) return;
    const isOpen = popover.classList.toggle('is-open');
    popover.setAttribute('aria-hidden', String(!isOpen));
  });
  document.addEventListener('click', () => {
    document.getElementById('shared-calorie-popover')?.classList.remove('is-open');
  }, { once: true });

  container.querySelectorAll('.timer-token').forEach(token => {
    token.addEventListener('click', (e) => {
      e.stopPropagation();
      const seconds = parseInt(token.getAttribute('data-seconds'), 10);
      if (seconds > 0) openTimerModal(seconds);
    });
  });

  document.getElementById('btn-add-shared-to-library')?.addEventListener('click', (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;

    // Normalize the same way an imported backup recipe is normalized, then
    // deliberately drop id/riffOfId — a riff pointer from another user's
    // library has no guaranteed match (or worse, a coincidental false match)
    // in the recipient's own, and a fresh id lets saveRecipe() dedupe
    // against whatever the recipient already has.
    const normalized = sanitizeImportedRecipes([recipe])[0];
    delete normalized.id;
    normalized.riffOfId = null;

    const saved = saveRecipe(normalized);
    state.recipes = getRecipes();
    showToast('Added to your library');

    if (_refreshRecipeListFn) _refreshRecipeListFn();
    if (_selectRecipeFn) _selectRecipeFn(saved.id);
  });
}

/**
 * Fetches and renders the shared recipe for the given share id into
 * #shared-recipe-view-container.
 */
export async function renderSharedRecipeView(shareId) {
  const container = elements.sharedRecipeViewContainer;
  if (!container) return;

  if (!shareId) {
    renderError(container, 'This link is missing a cocktail to show.');
    return;
  }

  renderLoading(container);

  let response;
  try {
    response = await fetch(`/api/shares/${encodeURIComponent(shareId)}`);
  } catch {
    renderError(container, 'Could not reach Speakeasy — check your connection and try again.');
    return;
  }

  if (!response.ok) {
    renderError(container, 'This link is no longer valid or doesn\'t exist.');
    return;
  }

  let data;
  try {
    data = await response.json();
  } catch {
    renderError(container, 'This link is no longer valid or doesn\'t exist.');
    return;
  }

  if (!data || !data.recipe || !data.recipe.name) {
    renderError(container, 'This link is no longer valid or doesn\'t exist.');
    return;
  }

  renderRecipe(container, data.recipe);
}
