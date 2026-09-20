/**
 * Speakeasy "Bar Basics" views: how to make a house-made ingredient (a syrup,
 * for now).
 *
 *  - openBarBasicsSheet(id): a sheet opened from a recipe's ingredient row. A
 *    centered card on desktop and a bottom sheet on phones. Builds its own
 *    <dialog> lazily (same self-creating pattern as calculator-modal.js), so it
 *    needs no markup in app.html.
 *  - renderBarBasicBody(entry): the shared recipe body (ingredients, method,
 *    shelf life...), also used by the Bar Basics tab in the Bar Tools dialog.
 *
 * Measurements follow the user's unit choice (state.unitSystem).
 */

import { state } from '../state.js';
import { getBarBasic, pickUnit } from '../data/bar-basics.js';
import {
  BATCH_SCALES,
  BATCH_SCALE_LABELS,
  formatAmount,
  formatYield,
  scaledBrixInputs,
} from '../modules/bar-basics-format.js';
import { calculateBrix } from '../modules/calculators.js';
import { escapeHtml, setupDialogLightDismiss, CLOSE_ICON_SVG } from './toast.js';

let dialogEl = null;
// Batch size shared by the sheet and the Bar Basics tab (1 = the recipe as written).
let batchScale = 1;

export function resetBatchScale() {
  batchScale = 1;
}

function getDialogElement() {
  if (dialogEl && document.body.contains(dialogEl)) return dialogEl;

  dialogEl = document.createElement('dialog');
  dialogEl.id = 'bar-basics-sheet';
  dialogEl.className = 'basics-sheet';
  dialogEl.setAttribute('aria-labelledby', 'bar-basics-title');
  // Native tap-outside / Esc dismissal where supported; setupDialogLightDismiss
  // covers browsers without `closedby`.
  dialogEl.setAttribute('closedby', 'any');
  document.body.appendChild(dialogEl);
  setupDialogLightDismiss(dialogEl, closeBarBasicsSheet);
  return dialogEl;
}

/** The recipe itself: tagline through allergen note. Shared by the sheet and the tab. */
export function renderBarBasicBody(entry) {
  const unit = state.unitSystem;
  const yieldText = formatYield(entry.yield, unit, batchScale);

  const meta = [
    entry.ratio && `<span class="basics-chip basics-chip-ratio">${escapeHtml(entry.ratio)}</span>`,
    yieldText && `<span class="basics-chip">Makes ${escapeHtml(yieldText)}</span>`,
    entry.time && `<span class="basics-chip">${escapeHtml(entry.time)}</span>`,
  ].filter(Boolean).join('');

  const scalePills = BATCH_SCALES.map(scale => /*html*/`
    <button type="button" class="basics-scale-pill${scale === batchScale ? ' active' : ''}" data-scale="${scale}" aria-pressed="${scale === batchScale}">${BATCH_SCALE_LABELS[scale]}</button>
  `).join('');

  const ingredients = entry.ingredients.map(ing => /*html*/`
    <li class="basics-ingredient">
      <span class="basics-ingredient-amount">${escapeHtml(formatAmount(ing.amount, unit, batchScale))}</span>
      <span class="basics-ingredient-item">${escapeHtml(ing.item)}</span>
    </li>
  `).join('');

  const steps = entry.steps.map(step => `<li>${escapeHtml(pickUnit(step, unit))}</li>`).join('');
  const tips = (entry.tips || []).map(tip => `<li>${escapeHtml(pickUnit(tip, unit))}</li>`).join('');

  const brixInputs = scaledBrixInputs(entry, batchScale);
  const brixLink = brixInputs ? /*html*/`
    <button type="button" class="basics-tool-link" data-open-brix>
      <span>
        <span class="basics-tool-link-title">Check it in the Brix Blender</span>
        <span class="basics-tool-link-sub">About ${escapeHtml(String(Math.round(calculateBrix(brixInputs.sugarG, brixInputs.waterMl).brix)))}° Brix as written</span>
      </span>
      <span class="basics-tool-link-arrow" aria-hidden="true">›</span>
    </button>
  ` : '';

  return /*html*/`
    <p class="basics-tagline">${escapeHtml(entry.tagline)}</p>
    <div class="basics-chips">${meta}</div>

    <div class="basics-scale" role="group" aria-label="Batch size">
      <span class="basics-scale-label">Batch size</span>
      ${scalePills}
    </div>

    <h3 class="basics-section-title">Ingredients</h3>
    <ul class="basics-ingredients">${ingredients}</ul>

    <h3 class="basics-section-title">Method</h3>
    <ol class="basics-steps">${steps}</ol>

    <div class="basics-keeps">
      <span class="basics-keeps-label">Keeps</span>
      <span>${escapeHtml(entry.keeps)}, refrigerated</span>
    </div>

    ${brixLink}

    ${tips ? /*html*/`
      <h3 class="basics-section-title">Tips</h3>
      <ul class="basics-tips">${tips}</ul>
    ` : ''}

    ${entry.note ? `<p class="basics-note">${escapeHtml(entry.note)}</p>` : ''}
    ${entry.credit ? `<p class="basics-credit">${escapeHtml(entry.credit)}</p>` : ''}
  `;
}

/**
 * Hooks up the controls inside a rendered body. `rerender` redraws the body after
 * a batch-size change; `openBrix({ sugarG, waterMl })` handles the Brix link, since
 * where that goes differs between the sheet and the Bar Tools tab.
 */
export function wireBarBasicBody(container, entry, { rerender, openBrix }) {
  container.querySelectorAll('.basics-scale-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      batchScale = Number(pill.getAttribute('data-scale')) || 1;
      rerender();
    });
  });
  container.querySelector('[data-open-brix]')?.addEventListener('click', () => {
    const inputs = scaledBrixInputs(entry, batchScale);
    if (inputs) openBrix({ sugarG: Math.round(inputs.sugarG * 10) / 10, waterMl: Math.round(inputs.waterMl * 10) / 10 });
  });
}

function renderSheet(entry) {
  return /*html*/`
    <div class="basics-sheet-container">
      <div class="basics-sheet-grabber" aria-hidden="true"></div>
      <div class="basics-sheet-header">
        <div>
          <div class="basics-sheet-eyebrow">How to make</div>
          <h2 id="bar-basics-title" class="basics-sheet-title">${escapeHtml(entry.name)}</h2>
        </div>
        <button type="button" class="btn btn-ghost btn-sm close-modal-btn basics-sheet-close" aria-label="Close">${CLOSE_ICON_SVG}</button>
      </div>
      <div class="basics-sheet-body"></div>
    </div>
  `;
}

function renderSheetBody(dialog, entry) {
  const body = dialog.querySelector('.basics-sheet-body');
  const scrollTop = body.scrollTop;
  body.innerHTML = renderBarBasicBody(entry);
  body.scrollTop = scrollTop;
  wireBarBasicBody(body, entry, {
    rerender: () => renderSheetBody(dialog, entry),
    openBrix: (inputs) => {
      closeBarBasicsSheet();
      // Dynamic import: calculator-modal imports this file, so a static import would be a cycle.
      import('./calculator-modal.js').then(m => m.openCalculatorModal({ tab: 'brix', brix: inputs }));
    },
  });
}

/** Opens the sheet for a taxonomy ingredient id. Does nothing if it has no entry. */
export function openBarBasicsSheet(taxonomyId) {
  const entry = getBarBasic(taxonomyId);
  if (!entry) return;

  const dialog = getDialogElement();
  resetBatchScale();
  dialog.innerHTML = renderSheet(entry);
  dialog.querySelector('.basics-sheet-close')?.addEventListener('click', closeBarBasicsSheet);
  renderSheetBody(dialog, entry);
  dialog.querySelector('.basics-sheet-body')?.scrollTo(0, 0);
  if (!dialog.open) dialog.showModal();
}

export function closeBarBasicsSheet() {
  if (dialogEl?.open) dialogEl.close();
}
