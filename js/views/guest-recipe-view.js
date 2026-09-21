/**
 * Speakeasy Guest Recipe Page
 * What a guest sees when they open a drink from a published menu. It is not the
 * bartender's recipe page with pieces hidden: it leads with the drink and why
 * it might suit them (mood tags, the description), then what's in it, and keeps
 * the method (which is the bartender's job) tucked into a collapsed section.
 * A sticky bar keeps the two things a guest actually does within reach: save
 * the drink, or ask for it.
 *
 * Pure presentation: everything that touches storage or navigation comes in
 * through `ctx`, so guest-menu-view.js stays the one place that owns state.
 */

import { GlassView } from '../modules/glass-view.js';
import { calculateCocktailAbv } from '../modules/abv.js';
import { calculateBalanceProfile, renderFlavorRadarSvg } from '../modules/balance.js';
import { formatIngredientName, formatFraction, parseMethodContent } from '../modules/parser.js';
import { MOODS, getRecipeMoods } from '../modules/moods.js';
import { glassLabel } from '../modules/glassware.js';
import { escapeHtml } from '../components/toast.js';
import { renderSiteFooterHtml } from '../components/site-footer.js';
import { dietNotesHtml } from '../components/diet-notes.js';

/** The heart used for "Save" on cards and on the recipe page. */
export function heartSvg(size = 18) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>`;
}

// The method, formatted like the recipe card (numbered steps, not one run-on
// paragraph). Guests get plain text: the shake/stir timers are the bartender's.
function methodStepsHtml(instructions) {
  const parsed = parseMethodContent(instructions);
  if (parsed.type === 'ordered') {
    return `<ol class="guest-recipe-steps">${parsed.items.map(item => `<li><span>${escapeHtml(item)}</span></li>`).join('')}</ol>`;
  }
  if (parsed.type === 'unordered') {
    return `<ul class="guest-recipe-steps is-bulleted">${parsed.items.map(item => `<li><span>${escapeHtml(item)}</span></li>`).join('')}</ul>`;
  }
  return `<p class="guest-recipe-steps-prose">${escapeHtml(instructions)}</p>`;
}

// "Rocks glass · Stirred": what a guest wants to know before deciding to read the method.
function methodHint(recipe) {
  return [glassLabel(recipe.glassware), recipe.method].filter(Boolean).join(' · ');
}

function specLine(spec) {
  const amount = spec.amount !== null && spec.amount !== undefined ? formatFraction(spec.amount) : '';
  const measure = [amount, spec.unit || (amount ? '' : 'to taste')].filter(Boolean).join(' ');
  return { measure, name: formatIngredientName(spec.name || '') };
}

/**
 * @param {HTMLElement} container
 * @param {object} recipe
 * @param {object} ctx
 * @param {string} ctx.menuName
 * @param {boolean} ctx.isPick     the host starred it
 * @param {boolean} ctx.isOut      the host is out of it
 * @param {boolean} ctx.saved      the guest has saved it
 * @param {'add'|'open'|'none'} ctx.libraryAction  what to offer for the guest's own library
 * @param {() => void} ctx.onBack
 * @param {() => boolean} ctx.onToggleSave   returns the new saved state
 * @param {() => void} ctx.onOrder
 * @param {() => (string|null)} ctx.onAddToLibrary  saves a copy; returns its id, or null if it couldn't
 * @param {(id?: string) => void} ctx.onOpenInLibrary
 */
export function renderGuestRecipe(container, recipe, ctx) {
  const specs = Array.isArray(recipe.specs) ? recipe.specs : [];
  const abv = Math.round(calculateCocktailAbv(specs, recipe.method).estimatedAbv);
  const abvText = abv > 0 ? `${abv}% ABV` : 'Non-alcoholic';
  const profile = calculateBalanceProfile(specs);
  const moodKeys = new Set(getRecipeMoods(recipe));
  const moods = MOODS.filter(m => moodKeys.has(m.key)).slice(0, 3);
  const badge = ctx.isOut ? 'Out for now' : ctx.isPick ? '★ Host pick' : '';

  container.innerHTML =  /*html*/`
    <div class="guest-recipe">
      <div class="guest-recipe-topbar" id="guest-recipe-topbar">
        <button type="button" class="menu-builder-back-link" id="guest-recipe-back" aria-label="Back to menu">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6"></polyline></svg>
          <span class="guest-recipe-back-text">Menu</span>
        </button>
        <div class="guest-recipe-sticky-title" id="guest-recipe-sticky-title" aria-hidden="true">
          <span class="guest-recipe-sticky-name">${escapeHtml(recipe.name)}</span>
        </div>
        <div class="guest-recipe-topbar-spacer" aria-hidden="true"></div>
      </div>

      <article class="guest-recipe-card">
        ${badge ? `<span class="guest-recipe-badge${ctx.isOut ? ' is-out' : ''}">${escapeHtml(badge)}</span>` : ''}
        <h1 class="guest-recipe-name">${escapeHtml(recipe.name)}</h1>
        ${moods.length ? `<div class="guest-recipe-moods">${moods.map(m => `<span class="guest-recipe-mood">${escapeHtml(m.label)}</span>`).join('')}</div>` : ''}
        ${recipe.description ? `<p class="guest-recipe-desc">${escapeHtml(recipe.description)}</p>` : ''}

        <div class="guest-recipe-glass">
          <div class="glass-wrapper" id="guest-recipe-glass"></div>
          <div class="glass-view-toggle-wrap">
            <div class="glass-view-toggle" role="group" aria-label="Cocktail presentation mode">
              <button type="button" class="glass-view-btn active" data-mode="layered" title="See the layers">
                <span>Layers</span>
              </button>
              <button type="button" class="glass-view-btn" data-mode="blended" title="See the drink mixed">
                <span>Mixed</span>
              </button>
            </div>
          </div>
        </div>

        <div class="guest-recipe-facts">
          ${[recipe.glassware, abvText].filter(Boolean).map(f => `<span>${escapeHtml(f)}</span>`).join('<span class="guest-recipe-dot" aria-hidden="true">·</span>')}
        </div>

        <h2 class="guest-recipe-heading">What’s in it</h2>
        <ul class="guest-recipe-specs">
          ${specs.map(spec => {
    const { measure, name } = specLine(spec);
    return `<li><span class="guest-recipe-amount">${escapeHtml(measure)}</span><span class="guest-recipe-ingredient">${escapeHtml(name)}</span></li>`;
  }).join('')}
          ${recipe.garnish ? `<li class="is-garnish"><span class="guest-recipe-amount">Garnish</span><span class="guest-recipe-ingredient">${escapeHtml(recipe.garnish)}</span></li>` : ''}
        </ul>

        ${dietNotesHtml(recipe)}

        <div class="flavor-radar-card">
          <span class="flavor-radar-title">Flavor Profile</span>
          ${renderFlavorRadarSvg(profile)}
        </div>

        ${recipe.instructions && recipe.instructions.trim() ? /*html*/`
          <details class="guest-recipe-method">
            <summary>
              <span class="guest-recipe-method-text">
                <span class="guest-recipe-method-title">How it’s made</span>
                <span class="guest-recipe-method-hint">${escapeHtml(methodHint(recipe))}</span>
              </span>
              <svg class="guest-recipe-method-chevron" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"></polyline></svg>
            </summary>
            ${methodStepsHtml(recipe.instructions)}
          </details>
        ` : ''}

        ${recipe.source && recipe.source.trim() ? /*html*/`
          <p class="guest-recipe-source"><span class="guest-recipe-source-label">Source</span> ${escapeHtml(recipe.source.trim())}</p>
        ` : ''}

        ${ctx.libraryAction !== 'none' ? /*html*/`
          <div class="guest-recipe-library">
            <button type="button" class="btn btn-ghost btn-sm" id="guest-recipe-library" data-mode="${ctx.libraryAction}">
              ${ctx.libraryAction === 'open' ? 'Open in Speakeasy' : 'Add to my Speakeasy library'}
            </button>
          </div>
        ` : ''}
      </article>

      ${renderSiteFooterHtml()}

      <div class="guest-recipe-actionbar">
        <button type="button" class="guest-recipe-save${ctx.saved ? ' is-saved' : ''}" id="guest-recipe-save" aria-pressed="${ctx.saved}">
          ${heartSvg(18)}<span>${ctx.saved ? 'Saved' : 'Save'}</span>
        </button>
        <button type="button" class="btn btn-primary guest-recipe-order" id="guest-recipe-order" ${ctx.isOut ? 'disabled' : ''}>
          ${ctx.isOut ? 'Out for now' : 'I’d like this →'}
        </button>
      </div>
    </div>
  `;

  const glassView = new GlassView(container.querySelector('#guest-recipe-glass'));
  glassView.render(recipe, 'layered');
  container.querySelectorAll('.glass-view-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.getAttribute('data-mode');
      container.querySelectorAll('.glass-view-btn').forEach(b => b.classList.toggle('active', b === btn));
      glassView.setMode(mode);
    });
  });

  container.querySelector('#guest-recipe-back').addEventListener('click', () => {
    teardownGuestRecipeStickyHeader();
    ctx.onBack();
  });

  const saveButton = container.querySelector('#guest-recipe-save');
  saveButton.addEventListener('click', () => {
    const nowSaved = ctx.onToggleSave();
    saveButton.classList.toggle('is-saved', nowSaved);
    saveButton.setAttribute('aria-pressed', String(nowSaved));
    saveButton.querySelector('span').textContent = nowSaved ? 'Saved' : 'Save';
    // A small pop so the tap registers as something that happened.
    if (nowSaved) {
      saveButton.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.12)' }, { transform: 'scale(1)' }], { duration: 260, easing: 'ease-out' });
    }
  });

  container.querySelector('#guest-recipe-order').addEventListener('click', () => ctx.onOrder());

  const libraryButton = container.querySelector('#guest-recipe-library');
  libraryButton?.addEventListener('click', () => {
    if (libraryButton.getAttribute('data-mode') === 'open') {
      ctx.onOpenInLibrary(libraryButton.getAttribute('data-id') || undefined);
      return;
    }
    const addedId = ctx.onAddToLibrary();
    if (!addedId) return;
    // Once it's in their library the same button opens it there.
    libraryButton.setAttribute('data-mode', 'open');
    libraryButton.setAttribute('data-id', addedId);
    libraryButton.textContent = 'Added. Open in Speakeasy';
  });

  // Sticky Header Title Observer
  teardownGuestRecipeStickyHeader();

  const topbar = container.querySelector('#guest-recipe-topbar');
  const stickyTitle = container.querySelector('#guest-recipe-sticky-title');
  const recipeHeading = container.querySelector('.guest-recipe-name');

  if (topbar && stickyTitle && recipeHeading) {
    const getScrollParent = (node) => {
      let el = node?.parentElement;
      while (el && el !== document.body && el !== document.documentElement) {
        const overflowY = window.getComputedStyle(el).overflowY;
        if (overflowY === 'auto' || overflowY === 'scroll') return el;
        el = el.parentElement;
      }
      return null;
    };

    const scrollRoot = getScrollParent(container);
    const topbarHeight = topbar.offsetHeight || 44;
    const topOffset = topbarHeight + (parseFloat(window.getComputedStyle(topbar).top) || 0);

    window._guestRecipeScrollObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const rootTop = entry.rootBounds ? entry.rootBounds.top : topOffset;
        const isPast = !entry.isIntersecting && entry.boundingClientRect.bottom <= (rootTop + 10);
        if (isPast) {
          stickyTitle.classList.add('visible');
          topbar.classList.add('is-scrolled');
        } else {
          stickyTitle.classList.remove('visible');
          topbar.classList.remove('is-scrolled');
        }
      });
    }, {
      root: scrollRoot,
      rootMargin: `-${topOffset}px 0px 0px 0px`,
      threshold: 0,
    });

    window._guestRecipeScrollObserver.observe(recipeHeading);
  }
}

export function teardownGuestRecipeStickyHeader() {
  if (window._guestRecipeScrollObserver) {
    window._guestRecipeScrollObserver.disconnect();
    window._guestRecipeScrollObserver = null;
  }
}
