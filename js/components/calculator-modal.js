/**
 * Speakeasy Bartender Calculator Suite Modal
 * Tabbed "Bar Tools" dialog: Freezer Batcher, Acid Adjuster, Brix Blender, Bar Basics. Builds its own
 * <dialog> lazily (same self-creating pattern as timer-modal.js / rating-modal.js)
 * rather than requiring markup in app.html.
 */

import { state } from '../state.js';
import {
  calculateBatch,
  calculateAcidAdjustment,
  calculateBrix,
} from '../modules/calculators.js';
import { recipeMatchesQuery, calculateRecipeSearchScore } from '../modules/taxonomy.js';
import { escapeHtml, setupDialogLightDismiss, CLOSE_ICON_SVG } from './toast.js';
import { BAR_BASICS, BAR_BASICS_GROUPS, getBarBasic } from '../data/bar-basics.js';
import { renderBarBasicBody, wireBarBasicBody, resetBatchScale } from './bar-basics-sheet.js';

const BOTTLE_SIZES_ML = [375, 750, 1000];
const BATCH_SEARCH_RESULT_CAP = 40;
const JUICE_TYPES = [
  { value: 'orange', label: 'Orange Juice' },
  { value: 'grapefruit', label: 'Grapefruit Juice' },
  { value: 'pineapple', label: 'Pineapple Juice' },
];

let dialogEl = null;
let activeTab = 'basics';
let selectedRecipeId = null;
let batchSearchQuery = '';
let batchSuggestOpen = false;
let selectedBottleMl = 750;
let acidJuice = 'orange';
let acidVolumeMl = 250;
let acidTarget = 'lemon';
let brixSugarGrams = 100;
let brixWaterMl = 100;
let basicsSelectedId = null; // null = the list of Bar Basics

function getDialogElement() {
  if (dialogEl && document.body.contains(dialogEl)) return dialogEl;

  dialogEl = document.createElement('dialog');
  dialogEl.id = 'calculator-modal';
  dialogEl.className = 'calculator-dialog';
  dialogEl.setAttribute('aria-labelledby', 'calculator-modal-title');
  dialogEl.innerHTML = /*html*/`
    <div class="calculator-dialog-container">
      <div class="calculator-dialog-header">
        <h2 id="calculator-modal-title" class="calculator-dialog-title">Bar Tools</h2>
        <button type="button" id="btn-close-calculator" class="btn btn-ghost btn-sm close-modal-btn" aria-label="Close modal">${CLOSE_ICON_SVG}</button>
      </div>
      <div class="calculator-tabs" role="tablist" aria-label="Bar tools">
        <button type="button" class="calculator-tab" data-tab="basics" role="tab" aria-label="Bar Basics"><span class="tab-full">Bar Basics</span><span class="tab-short" aria-hidden="true">Basics</span></button>
        <button type="button" class="calculator-tab" data-tab="batch" role="tab" aria-label="Freezer Batcher"><span class="tab-full">Freezer Batcher</span><span class="tab-short" aria-hidden="true">Batcher</span></button>
        <button type="button" class="calculator-tab" data-tab="acid" role="tab" aria-label="Acid Adjuster"><span class="tab-full">Acid Adjuster</span><span class="tab-short" aria-hidden="true">Acid</span></button>
        <button type="button" class="calculator-tab" data-tab="brix" role="tab" aria-label="Brix Blender"><span class="tab-full">Brix Blender</span><span class="tab-short" aria-hidden="true">Brix</span></button>
      </div>
      <div class="calculator-tab-panel" id="calculator-tab-panel"></div>
    </div>
  `;
  document.body.appendChild(dialogEl);

  dialogEl.querySelector('#btn-close-calculator').addEventListener('click', () => closeCalculatorModal());
  dialogEl.querySelectorAll('.calculator-tab').forEach(tabBtn => {
    tabBtn.addEventListener('click', () => {
      activeTab = tabBtn.getAttribute('data-tab');
      renderTabs();
      renderPanel();
    });
  });

  setupDialogLightDismiss(dialogEl, closeCalculatorModal);
  dialogEl.addEventListener('cancel', () => closeCalculatorModal());

  return dialogEl;
}

function renderTabs() {
  const dialog = getDialogElement();
  dialog.querySelectorAll('.calculator-tab').forEach(tabBtn => {
    const isActive = tabBtn.getAttribute('data-tab') === activeTab;
    tabBtn.classList.toggle('active', isActive);
    tabBtn.setAttribute('aria-selected', String(isActive));
  });
}

function renderPanel() {
  if (activeTab === 'batch') renderBatchPanel();
  else if (activeTab === 'acid') renderAcidPanel();
  else if (activeTab === 'basics') renderBasicsPanel();
  else renderBrixPanel();
}

// --- Tab 4: Bar Basics (how to make syrups and other house-made ingredients) ---

function renderBasicsPanel({ keepScroll = false } = {}) {
  const panel = document.getElementById('calculator-tab-panel');
  if (!panel) return;

  const entry = basicsSelectedId ? getBarBasic(basicsSelectedId) : null;

  if (entry) {
    const scrollTop = panel.scrollTop;
    panel.innerHTML = /*html*/`
      <button type="button" class="basics-back-btn" id="basics-back">
        <span aria-hidden="true">‹</span> All Bar Basics
      </button>
      <h3 class="basics-detail-title">${escapeHtml(entry.name)}</h3>
      ${renderBarBasicBody(entry)}
    `;
    panel.querySelector('#basics-back').addEventListener('click', () => {
      basicsSelectedId = null;
      renderBasicsPanel();
    });
    wireBarBasicBody(panel, entry, {
      rerender: () => renderBasicsPanel({ keepScroll: true }),
      openBrix: (inputs) => {
        activeTab = 'brix';
        brixSugarGrams = inputs.sugarG;
        brixWaterMl = inputs.waterMl;
        renderTabs();
        renderPanel();
      },
    });
    panel.scrollTop = keepScroll ? scrollTop : 0;
    return;
  }

  panel.innerHTML = /*html*/`
    <p class="basics-intro">Make your own syrups and mixers. Tap one for the recipe.</p>
    ${BAR_BASICS_GROUPS.map(group => {
      const entries = BAR_BASICS.filter(basic => basic.group === group.id);
      if (entries.length === 0) return '';
      return /*html*/`
        <section class="basics-group" aria-labelledby="basics-group-${escapeHtml(group.id)}">
          <h3 class="basics-group-title" id="basics-group-${escapeHtml(group.id)}">${escapeHtml(group.label)}</h3>
          <ul class="basics-list">
            ${entries.map(basic => /*html*/`
              <li>
                <button type="button" class="basics-list-item" data-basic-id="${escapeHtml(basic.id)}">
                  <span class="basics-list-text">
                    <span class="basics-list-name">${escapeHtml(basic.name)}</span>
                    <span class="basics-list-ratio">${escapeHtml(basic.ratio)}</span>
                  </span>
                  <span class="basics-list-arrow" aria-hidden="true">›</span>
                </button>
              </li>
            `).join('')}
          </ul>
        </section>
      `;
    }).join('')}
  `;
  panel.querySelectorAll('.basics-list-item').forEach(btn => {
    btn.addEventListener('click', () => {
      basicsSelectedId = btn.getAttribute('data-basic-id');
      renderBasicsPanel();
    });
  });
  panel.scrollTop = 0;
}

// --- Tab 1: Freezer Batcher ---

function renderBatchPanel() {
  const panel = document.getElementById('calculator-tab-panel');
  if (!panel) return;

  const recipes = state.recipes || [];
  if (!selectedRecipeId || !recipes.some(r => r.id === selectedRecipeId)) {
    selectedRecipeId = recipes[0]?.id || null;
  }
  const recipe = recipes.find(r => r.id === selectedRecipeId) || null;
  const result = recipe ? calculateBatch(recipe, selectedBottleMl) : null;

  // The search input shows the selected cocktail's name at rest (like a
  // combobox), and whatever the user is actively typing once they focus it —
  // batchSearchQuery only tracks the latter, so it starts out following the
  // selection until the user types something themselves.
  const inputValue = batchSuggestOpen ? batchSearchQuery : (recipe?.name || '');

  panel.innerHTML = /*html*/`
    <div class="calc-field-row">
      <label class="calc-field-label" for="calc-batch-recipe-search">Cocktail</label>
      <div class="calc-search-wrapper">
        <input type="text" id="calc-batch-recipe-search" class="calc-select" autocomplete="off"
          placeholder="Search cocktails..." value="${escapeHtml(inputValue)}">
        <ul class="tag-suggest-list" id="calc-batch-suggest-list" role="listbox" ${batchSuggestOpen ? '' : 'hidden'}></ul>
      </div>
    </div>
    <div class="calc-field-row">
      <label class="calc-field-label">Bottle Size</label>
      <div class="calc-pill-group" role="group" aria-label="Bottle size">
        ${BOTTLE_SIZES_ML.map(ml => `
          <button type="button" class="calc-pill ${ml === selectedBottleMl ? 'active' : ''}" data-bottle-ml="${ml}">${ml >= 1000 ? '1 L' : `${ml} ml`}</button>
        `).join('')}
      </div>
    </div>
    ${result ? /*html*/`
      <div class="calc-result-block">
        <table class="calc-result-table">
          ${result.ingredients.map(ing => `
            <tr>
              <td>${escapeHtml(ing.name)}</td>
              <td class="calc-result-amount">${ing.scaledOz} oz <span class="calc-result-amount-sub">(${ing.scaledMl} ml)</span></td>
            </tr>
          `).join('')}
          <tr class="calc-result-dilution-row">
            <td>Filtered Water (dilution)</td>
            <td class="calc-result-amount">${(result.dilutionWaterOz).toFixed(2)} oz <span class="calc-result-amount-sub">(${result.dilutionWaterMl} ml)</span></td>
          </tr>
        </table>
        <p class="calc-result-footnote">Scales to ~${result.servings} servings at ${Math.round(result.dilutionRate * 100)}% dilution (${(recipe.method || 'stirred').toLowerCase()}).</p>
      </div>
    ` : '<p class="calc-empty-hint">Add a cocktail with specs to batch it.</p>'}
  `;

  const searchInput = panel.querySelector('#calc-batch-recipe-search');
  const suggestList = panel.querySelector('#calc-batch-suggest-list');

  const renderSuggestions = () => {
    const query = batchSearchQuery.trim();
    const matches = (query
      ? recipes
          .filter(r => recipeMatchesQuery(r, query))
          .sort((a, b) => calculateRecipeSearchScore(b, query) - calculateRecipeSearchScore(a, query))
      : recipes
    ).slice(0, BATCH_SEARCH_RESULT_CAP);

    if (matches.length === 0) {
      suggestList.innerHTML = /*html*/`<li class="tag-suggest-item-empty">No cocktails match "${escapeHtml(query)}"</li>`;
    } else {
      suggestList.innerHTML = matches.map(r => /*html*/`
        <li class="tag-suggest-item" role="option" data-recipe-id="${escapeHtml(r.id)}">${escapeHtml(r.name)}</li>
      `).join('');
    }
    suggestList.hidden = false;
  };

  const closeSuggestions = () => {
    batchSuggestOpen = false;
    suggestList.hidden = true;
  };

  searchInput?.addEventListener('focus', () => {
    batchSuggestOpen = true;
    batchSearchQuery = '';
    searchInput.value = '';
    renderSuggestions();
  });

  searchInput?.addEventListener('input', (e) => {
    batchSearchQuery = e.target.value;
    renderSuggestions();
  });

  searchInput?.addEventListener('blur', () => {
    // Deferred so a click on a suggestion (which fires before blur settles)
    // still registers before the list disappears.
    setTimeout(() => {
      closeSuggestions();
      renderBatchPanel();
    }, 150);
  });

  suggestList?.addEventListener('mousedown', (e) => {
    const item = e.target.closest('[data-recipe-id]');
    if (!item) return;
    e.preventDefault();
    selectedRecipeId = item.getAttribute('data-recipe-id');
    closeSuggestions();
    renderBatchPanel();
  });

  if (batchSuggestOpen) renderSuggestions();

  panel.querySelectorAll('[data-bottle-ml]').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedBottleMl = parseInt(btn.getAttribute('data-bottle-ml'), 10);
      renderBatchPanel();
    });
  });
}

// --- Tab 2: Acid Adjuster ---

function renderAcidPanel() {
  const panel = document.getElementById('calculator-tab-panel');
  if (!panel) return;

  const result = calculateAcidAdjustment(acidJuice, acidVolumeMl, acidTarget);

  panel.innerHTML = /*html*/`
    <div class="calc-field-row">
      <label class="calc-field-label" for="calc-acid-juice">Juice</label>
      <select id="calc-acid-juice" class="calc-select">
        ${JUICE_TYPES.map(j => `<option value="${j.value}" ${j.value === acidJuice ? 'selected' : ''}>${escapeHtml(j.label)}</option>`).join('')}
      </select>
    </div>
    <div class="calc-field-row">
      <label class="calc-field-label" for="calc-acid-volume">Volume (ml)</label>
      <input type="number" id="calc-acid-volume" class="calc-number-input" min="0" step="5" value="${acidVolumeMl}">
    </div>
    <div class="calc-field-row">
      <label class="calc-field-label">Target Equivalence</label>
      <div class="calc-pill-group" role="group" aria-label="Target citrus strength">
        <button type="button" class="calc-pill ${acidTarget === 'lemon' ? 'active' : ''}" data-target="lemon">Lemon</button>
        <button type="button" class="calc-pill ${acidTarget === 'lime' ? 'active' : ''}" data-target="lime">Lime</button>
      </div>
    </div>
    <div class="calc-result-block">
      <table class="calc-result-table">
        <tr><td>Citric Acid</td><td class="calc-result-amount">${result.citricAcidGrams} g</td></tr>
        <tr><td>Malic Acid</td><td class="calc-result-amount">${result.malicAcidGrams} g</td></tr>
      </table>
      <p class="calc-result-footnote">Brings ${escapeHtml(acidVolumeMl)}ml of ${escapeHtml(acidJuice)} juice up to ${escapeHtml(acidTarget)}-equivalent acidity.</p>
    </div>
  `;

  panel.querySelector('#calc-acid-juice')?.addEventListener('change', (e) => {
    acidJuice = e.target.value;
    renderAcidPanel();
  });
  panel.querySelector('#calc-acid-volume')?.addEventListener('input', (e) => {
    const parsed = parseFloat(e.target.value);
    acidVolumeMl = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
    renderAcidPanel();
  });
  panel.querySelectorAll('[data-target]').forEach(btn => {
    btn.addEventListener('click', () => {
      acidTarget = btn.getAttribute('data-target');
      renderAcidPanel();
    });
  });
}

// --- Tab 3: Brix Blender ---

function renderBrixPanel() {
  const panel = document.getElementById('calculator-tab-panel');
  if (!panel) return;

  const result = calculateBrix(brixSugarGrams, brixWaterMl);

  panel.innerHTML = /*html*/`
    <div class="calc-field-row">
      <label class="calc-field-label" for="calc-brix-sugar">Sugar (g)</label>
      <input type="number" id="calc-brix-sugar" class="calc-number-input" min="0" step="5" value="${brixSugarGrams}">
    </div>
    <div class="calc-field-row">
      <label class="calc-field-label" for="calc-brix-water">Water (ml)</label>
      <input type="number" id="calc-brix-water" class="calc-number-input" min="0" step="5" value="${brixWaterMl}">
    </div>
    <div class="calc-field-row">
      <label class="calc-field-label">Quick Ratios</label>
      <div class="calc-pill-group" role="group" aria-label="Common syrup ratios">
        <button type="button" class="calc-pill" data-ratio="simple">Simple (1:1)</button>
        <button type="button" class="calc-pill" data-ratio="rich">Rich (2:1)</button>
      </div>
    </div>
    <div class="calc-result-block">
      <table class="calc-result-table">
        <tr><td>Brix</td><td class="calc-result-amount">${result.brix}&deg;Bx</td></tr>
        <tr><td>Final Yield</td><td class="calc-result-amount">${result.finalVolumeOz} oz <span class="calc-result-amount-sub">(${result.finalVolumeMl} ml)</span></td></tr>
      </table>
    </div>
  `;

  panel.querySelector('#calc-brix-sugar')?.addEventListener('input', (e) => {
    const parsed = parseFloat(e.target.value);
    brixSugarGrams = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
    renderBrixPanel();
  });
  panel.querySelector('#calc-brix-water')?.addEventListener('input', (e) => {
    const parsed = parseFloat(e.target.value);
    brixWaterMl = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
    renderBrixPanel();
  });
  panel.querySelectorAll('[data-ratio]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.getAttribute('data-ratio') === 'simple') {
        brixSugarGrams = 100;
        brixWaterMl = 100;
      } else {
        brixSugarGrams = 200;
        brixWaterMl = 100;
      }
      renderBrixPanel();
    });
  });
}

/**
 * Opens the Calculator modal, optionally jumping to a specific tab and
 * pre-selecting a cocktail (used by "Batch for Freezer" on the Counter View).
 * @param {{ tab?: 'batch'|'acid'|'brix', recipeId?: string }} [options]
 */
export function openCalculatorModal(options = {}) {
  const dialog = getDialogElement();
  // Opens on Bar Basics unless a caller asks for a specific tab (the recipe page's
  // batch button asks for 'batch'). Always starts at the list unless a basic is named.
  activeTab = options.tab || 'basics';
  if (options.recipeId) selectedRecipeId = options.recipeId;
  basicsSelectedId = null;
  resetBatchScale();
  if (options.brix) {
    activeTab = 'brix';
    brixSugarGrams = options.brix.sugarG;
    brixWaterMl = options.brix.waterMl;
  }
  if (options.basicId) {
    activeTab = 'basics';
    basicsSelectedId = getBarBasic(options.basicId) ? options.basicId : null;
  }
  batchSuggestOpen = false;
  batchSearchQuery = '';

  renderTabs();
  renderPanel();

  if (typeof dialog.showModal === 'function') {
    dialog.showModal();
  }
}

export function closeCalculatorModal() {
  if (dialogEl && dialogEl.open) {
    dialogEl.close();
  }
}
