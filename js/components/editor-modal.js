/**
 * Speakeasy Recipe Editor Component (Create / Edit modal)
 * Quick-paste natural language spec parsing, dynamic rows, tag chips, and live vector glass preview.
 */

import { state, elements } from '../state.js';
import {
  getRecipes,
  saveRecipe,
  getAllUniqueTags,
  normalizeTagName,
} from '../modules/storage.js';

import { parseSpecsBlock } from '../modules/parser.js';
import { GlassView } from '../modules/glass-view.js';
import { calculateCocktailAbv, estimateIngredientAbv } from '../modules/abv.js';
import { getIngredientSuggestions } from '../modules/taxonomy.js';
import { setupTagAutocomplete } from '../views/recipe-list-view.js';
import { detectMethodFromText, detectGlasswareFromText, detectGarnishFromText, detectTagsFromRecipe } from '../modules/auto-detect.js';
import { escapeHtml, showToast } from './toast.js';

// Sensible starting directions per technique, so a new recipe doesn't open with
// an empty field the user has to fill from scratch — they're a real (editable,
// deletable) starting value here, not just placeholder text to retype around.
const DEFAULT_INSTRUCTIONS_BY_METHOD = {
  Shaken: 'Combine all ingredients in a shaker with ice. Shake until cold and diluted. Strain into a chilled glass.',
  Stirred: 'Combine all ingredients in a mixing glass with ice. Stir for 20-30 seconds until well-chilled. Strain into a chilled glass.',
  Built: 'Build directly in the glass over ice, then stir briefly to combine.',
  Blended: 'Add all ingredients to a blender with ice. Blend until smooth, then pour into a chilled glass.',
  Rolled: 'Roll the ingredients gently between two mixing tins to combine without over-diluting. Strain into a chilled glass.',
};

function getDefaultInstructions(method) {
  return DEFAULT_INSTRUCTIONS_BY_METHOD[method] || DEFAULT_INSTRUCTIONS_BY_METHOD.Shaken;
}

let _selectRecipeFn = null;
let _renderCurrentViewFn = null;

export function setEditorModalCallbacks(cbs) {
  if (cbs.selectRecipe) _selectRecipeFn = cbs.selectRecipe;
  if (cbs.renderCurrentView) _renderCurrentViewFn = cbs.renderCurrentView;
}

/**
 * Open Recipe Editor (Create or Edit)
 */
export function openEditor(recipe = null) {
  state.viewMode = 'edit';
  const isNew = !recipe || !recipe.id;

  const currentData = recipe ? JSON.parse(JSON.stringify(recipe)) : {
    id: null,
    name: '',
    glassware: 'Coupe',
    method: 'Shaken',
    garnish: '',
    description: '',
    instructions: '',
    source: '',
    sourceUrl: '',
    notes: '',
    tags: [],
    specs: [
      { amount: 2, unit: 'oz', name: '' },
      { amount: 0.75, unit: 'oz', name: '' },
    ],
  };

  state.editorSpecs = (currentData.specs || []).map(s => ({ ...s }));
  state.editorTags = Array.isArray(currentData.tags) ? [...currentData.tags] : [];
  state.editorRiffOfId = currentData.riffOfId || null;
  state.editorRiffOfName = currentData.riffOfName || '';

  state.editorInstructionsAutoFilled = !(currentData.instructions || currentData.notes || '').trim();
  if (state.editorInstructionsAutoFilled) {
    currentData.instructions = getDefaultInstructions(currentData.method);
  }

  // Auto-detection only kicks in for a brand-new recipe with nothing typed into
  // these fields yet — editing an existing recipe never has its saved choices
  // silently overwritten by a guess.
  state.editorMethodAutoFilled = isNew;
  state.editorGlasswareAutoFilled = isNew;
  state.editorGarnishAutoFilled = isNew && !currentData.garnish.trim();
  state.editorTagsAutoDetectEnabled = isNew;
  state.editorAutoRemovedTags = [];
  state.editorAutoAddedTagNames = [];

  // Fallback shown whenever the name field is empty; once the user types a name,
  // the title (main header, and both sticky bars) live-updates to match it.
  const titleFallback = isNew
    ? (state.editorRiffOfName ? `New Riff on ${state.editorRiffOfName}` : 'New Cocktail')
    : 'Edit Recipe';
  const initialTitle = currentData.name.trim() || titleFallback;

  elements.editorViewContainer.innerHTML =  /*html*/`
    <div class="editor-mobile-bar" id="editor-mobile-bar">
      <button type="button" id="btn-cancel-edit-mobile" class="btn btn-secondary btn-sm mobile-back-btn">Cancel</button>
      <div class="mobile-sticky-title" id="editor-mobile-sticky-title" aria-hidden="true">
        <span class="mobile-sticky-name" id="editor-mobile-sticky-name">${escapeHtml(initialTitle)}</span>
      </div>
      <button type="button" id="btn-save-edit-mobile" class="btn btn-primary btn-sm">Save</button>
    </div>

    <div class="editor-header">
      <h2 class="editor-title" id="editor-title" data-fallback="${escapeHtml(titleFallback)}">${escapeHtml(initialTitle)}</h2>
      <div class="counter-actions">
        <button id="btn-cancel-edit" class="btn btn-secondary">Cancel</button>
        <button id="btn-save-edit" class="btn btn-primary">Save Recipe</button>
      </div>
    </div>

    <div class="editor-grid">
      <!-- Quick Paste Box -->
      <div class="editor-section quick-paste-box">
        <div class="quick-paste-header">
          <span class="quick-paste-title">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect></svg>
            Quick Paste Ingredients
          </span>
          <span class="quick-paste-hint">Ingredient measurements only</span>
        </div>
        <textarea
          id="quick-paste-input"
          class="quick-paste-textarea"
          placeholder="Paste ingredient lines, such as:&#10;1.5 oz Scotch&#10;0.5 oz Mezcal&#10;0.75 oz Lime Juice&#10;0.75 oz Orgeat&#10;2 dashes Celery Bitters&#10;&#10;Add preparation steps and writeup in the sections below."
        ></textarea>
        <div style="display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 0.5rem;">
          <button type="button" id="btn-clear-paste" class="btn btn-ghost btn-sm">Clear Box</button>
          <button type="button" id="btn-apply-paste" class="btn btn-secondary btn-sm">Apply Pasted Specs</button>
        </div>
      </div>

      <!-- Recipe Core Fields -->
      <div class="editor-section editor-field-name form-group">
        <label class="form-label" for="edit-name">Cocktail Name</label>
        <input type="text" id="edit-name" class="form-input" value="${escapeHtml(currentData.name)}" placeholder="Golden Hour Fizz" required>
      </div>

      <!-- Editable Spec Rows -->
      <div class="editor-section editor-specs-section">
        <div class="editor-specs-header">
          <label class="form-label" style="margin-bottom: 0;">Ingredient Specifications</label>
          <button type="button" id="btn-add-spec-row" class="btn btn-secondary btn-sm">+ Add Ingredient</button>
        </div>

        <div id="editor-specs-rows">
          <!-- Populated via renderEditorSpecRows() -->
        </div>
      </div>

      <!-- Preparation Directions -->
      <div class="editor-section editor-field-instructions form-group" style="margin-top: 1.5rem;">
        <label class="form-label" for="edit-instructions">Preparation Directions</label>
        <textarea id="edit-instructions" class="form-textarea" rows="4" placeholder="Step-by-step preparation directions...">${escapeHtml(currentData.instructions || currentData.notes || '')}</textarea>
        <div class="field-hint" style="font-size: 0.75rem; color: var(--color-text-muted); margin-top: 0.35rem;">
          Mention a technique, glass, or garnish here ("garnish with a cherry") and we'll suggest it below.
        </div>
      </div>

      <div class="editor-section editor-field-glass-method form-row">
        <div class="form-group">
          <label class="form-label" for="edit-glassware">Glassware <span class="field-detected-badge" id="glassware-detected-badge" hidden>detected</span></label>
          <select id="edit-glassware" class="form-select">
            <option value="Coupe" ${currentData.glassware === 'Coupe' ? 'selected' : ''}>Coupe</option>
            <option value="Rocks" ${currentData.glassware === 'Rocks' ? 'selected' : ''}>Rocks / Old Fashioned</option>
            <option value="Highball" ${currentData.glassware === 'Highball' ? 'selected' : ''}>Highball / Collins</option>
            <option value="Martini" ${currentData.glassware === 'Martini' ? 'selected' : ''}>Martini</option>
            <option value="Nick & Nora" ${currentData.glassware === 'Nick & Nora' ? 'selected' : ''}>Nick & Nora</option>
            <option value="Wine" ${currentData.glassware === 'Wine' ? 'selected' : ''}>Wine Glass</option>
            <option value="Tiki Mug" ${currentData.glassware === 'Tiki Mug' ? 'selected' : ''}>Tiki Mug</option>
          </select>
        </div>

        <div class="form-group">
          <label class="form-label" for="edit-method">Preparation Technique <span class="field-detected-badge" id="method-detected-badge" hidden>detected</span></label>
          <select id="edit-method" class="form-select">
            <option value="Shaken" ${currentData.method === 'Shaken' ? 'selected' : ''}>Shaken</option>
            <option value="Stirred" ${currentData.method === 'Stirred' ? 'selected' : ''}>Stirred</option>
            <option value="Built" ${currentData.method === 'Built' ? 'selected' : ''}>Built in Glass</option>
            <option value="Blended" ${currentData.method === 'Blended' ? 'selected' : ''}>Blended</option>
            <option value="Rolled" ${currentData.method === 'Rolled' ? 'selected' : ''}>Rolled</option>
          </select>
        </div>
      </div>

      <div class="editor-section editor-field-garnish form-group">
        <label class="form-label" for="edit-garnish">Garnish <span class="field-detected-badge" id="garnish-detected-badge" hidden>detected</span></label>
        <input type="text" id="edit-garnish" class="form-input" value="${escapeHtml(currentData.garnish)}" placeholder="Lime wheel, orange twist, etc.">
      </div>

      <!-- Tags & Custom Lists -->
      <div class="editor-section editor-field-tags form-group">
        <label class="form-label" for="editor-tag-input">Tags & Custom Lists</label>
        <div class="editor-tags-box">
          <div id="editor-tags-list" class="editor-tags-list"></div>
          <div class="editor-tag-input-row">
            <div class="tag-input-autocomplete-wrapper">
              <input
                type="text"
                id="editor-tag-input"
                class="form-input editor-tag-input-field"
                placeholder="Type a tag name and press Enter..."
                autocomplete="off"
              />
              <ul class="tag-suggest-list" id="editor-tag-suggest-list" role="listbox" hidden></ul>
            </div>
            <button type="button" id="btn-add-editor-tag" class="btn btn-secondary btn-sm">+ Add Tag</button>
          </div>
        </div>
        <div class="field-hint" style="font-size: 0.75rem; color: var(--color-text-muted); margin-top: 0.35rem;">
          Assign tags to group drinks into menus, moods, or favorites.
        </div>
      </div>

      <!-- Description & Story -->
      <div class="editor-section editor-field-description form-group">
        <label class="form-label" for="edit-description">Description & Story</label>
        <textarea id="edit-description" class="form-textarea" rows="3" placeholder="Background, flavor profile, or creator writeup...">${escapeHtml(currentData.description || '')}</textarea>
      </div>

      <!-- Source & Attribution -->
      <div class="editor-section editor-field-source form-row">
        <div class="form-group">
          <label class="form-label" for="edit-source">Source / Creator</label>
          <input type="text" id="edit-source" class="form-input" value="${escapeHtml(currentData.source || '')}" placeholder="Your name, bar, or book">
        </div>
        <div class="form-group">
          <label class="form-label" for="edit-source-url">Source Link / URL</label>
          <input type="url" id="edit-source-url" class="form-input" value="${escapeHtml(currentData.sourceUrl || '')}" placeholder="https://example.com/my-recipe">
        </div>
      </div>

      <!-- Additional Notes -->
      <div class="editor-section editor-field-notes form-group">
        <label class="form-label" for="edit-notes">Additional Notes & Tips (Optional)</label>
        <textarea id="edit-notes" class="form-textarea" rows="2" placeholder="Ice, dilution details, or variations...">${escapeHtml(currentData.notes || '')}</textarea>
      </div>

      <!-- Live Vector Fluid Glass Preview -->
      <div class="editor-preview-col">
        <label class="form-label">Live Ratio Preview</label>
        <div class="glass-wrapper" id="editor-glass-wrapper" style="height: 340px;">
          <!-- Live GlassView -->
        </div>
        <div class="glass-meta-card" style="max-width: 100%;">
          <div id="editor-abv-badge" style="font-size: 0.85rem; font-weight: 600; color: var(--color-accent-light); margin-bottom: 0.25rem;">
            Estimated Strength: ~0% ABV
          </div>
          <div class="glass-interaction-tip">
            Layers and ABV recalculate in real-time as amounts are entered
          </div>
        </div>
      </div>
    </div>
  `;

  renderEditorSpecRows();
  renderEditorTagChips();
  setupEditorEvents(currentData.id);
  if (_renderCurrentViewFn) _renderCurrentViewFn();
  updateEditorGlassPreview();

  // Mobile navigation adjustment: reveal main-stage editor and hide sidebar list
  elements.sidebar.classList.add('mobile-hidden');
  elements.mainStage.classList.remove('mobile-hidden');
  if (elements.mainStage) {
    elements.mainStage.scrollTop = 0;
  }
  window.scrollTo({ top: 1 });
}

/**
 * Render editable ingredient rows in editor
 */
export function renderEditorSpecRows() {
  const container = document.getElementById('editor-specs-rows');
  if (!container) return;

  const units = ['oz', 'ml', 'dash', 'dashes', 'barspoon', 'tsp', 'tbsp', 'drops', 'rinse', 'part', 'leaves'];

  container.innerHTML = state.editorSpecs.map((spec, i) => {
    const defaultAbv = estimateIngredientAbv(spec.name || '');
    const currentAbv = spec.abv !== undefined && spec.abv !== null ? spec.abv : (defaultAbv > 0 ? defaultAbv : '');

    return /*html*/`
      <div class="editor-spec-row" data-index="${i}">
        <input
          type="text"
          class="form-input spec-input-amount"
          value="${spec.amount !== null && spec.amount !== undefined ? spec.amount : ''}"
          placeholder="Amt"
          aria-label="Amount"
        >
        <select class="form-select spec-input-unit" aria-label="Unit">
          <option value="" ${!spec.unit ? 'selected' : ''}>none</option>
          ${units.map(u => `
            <option value="${u}" ${spec.unit === u ? 'selected' : ''}>${u}</option>
          `).join('')}
        </select>
        <div class="spec-name-wrapper">
          <input
            type="text"
            class="form-input spec-input-name"
            value="${escapeHtml(spec.name)}"
            placeholder="Ingredient name (Bourbon, Campari, etc.)"
            aria-label="Ingredient name"
            autocomplete="off"
            required
          >
          <ul class="tag-suggest-list ingredient-suggest-list" role="listbox" hidden></ul>
        </div>
        <input
          type="number"
          step="0.1"
          min="0"
          max="100"
          class="form-input spec-input-abv"
          value="${currentAbv}"
          placeholder="ABV%"
          title="Alcohol By Volume percentage"
          aria-label="ABV percentage"
        >
        <button type="button" class="btn-remove-row" data-action="remove-row" data-index="${i}" title="Remove ingredient">✕</button>
      </div>
    `;
  }).join('');

  // Attach input listeners for live updates
  container.querySelectorAll('.editor-spec-row').forEach(row => {
    const idx = parseInt(row.getAttribute('data-index'), 10);
    const amtInput = row.querySelector('.spec-input-amount');
    const unitSelect = row.querySelector('.spec-input-unit');
    const nameInput = row.querySelector('.spec-input-name');
    const abvInput = row.querySelector('.spec-input-abv');

    const updateRowState = () => {
      const rawAmt = amtInput.value.trim();
      let parsedAmt = null;
      if (rawAmt) {
        if (rawAmt.includes('/')) {
          const parts = rawAmt.split(/\s+/).filter(Boolean);
          if (parts.length === 2) {
            const [n, d] = parts[1].split('/');
            parsedAmt = parseFloat(parts[0]) + parseFloat(n) / parseFloat(d);
          } else if (parts.length === 1) {
            const [n, d] = parts[0].split('/');
            parsedAmt = parseFloat(n) / parseFloat(d);
          }
        } else {
          parsedAmt = parseFloat(rawAmt);
        }
      }

      const ingName = nameInput.value.trim();
      const rawAbv = abvInput.value.trim();
      let customAbv = undefined;
      if (rawAbv !== '') {
        const numAbv = parseFloat(rawAbv);
        if (!isNaN(numAbv)) {
          customAbv = numAbv;
        }
      }

      state.editorSpecs[idx] = {
        amount: !isNaN(parsedAmt) ? parsedAmt : null,
        unit: unitSelect.value,
        name: ingName,
        abv: customAbv,
      };

      updateEditorGlassPreview();
    };

    amtInput.addEventListener('input', updateRowState);
    unitSelect.addEventListener('change', updateRowState);
    nameInput.addEventListener('input', () => {
      if (!abvInput.value) {
        const est = estimateIngredientAbv(nameInput.value);
        if (est > 0) {
          abvInput.value = est;
        }
      }
      updateRowState();
    });
    abvInput.addEventListener('input', updateRowState);

    const suggestList = row.querySelector('.ingredient-suggest-list');
    setupIngredientNameAutocomplete(nameInput, suggestList);
  });

  // Remove row
  container.querySelectorAll('[data-action="remove-row"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.getAttribute('data-index'), 10);
      state.editorSpecs.splice(idx, 1);
      renderEditorSpecRows();
      updateEditorGlassPreview();
    });
  });
}

/**
 * Wires an ingredient-name suggestion dropdown to one spec row's name input,
 * matching against the app's known ingredient taxonomy (canonical names,
 * aliases, and brand names). Needs 3+ typed characters before it suggests
 * anything — shorter than that matches too much of the taxonomy to be useful.
 * Picking a suggestion fills the input and fires its normal 'input' handling
 * (ABV estimate, glass preview, etc.) exactly as if it had been typed.
 */
function setupIngredientNameAutocomplete(inputEl, listEl) {
  if (!inputEl || !listEl) return;

  let matches = [];
  let activeIndex = -1;

  const close = () => {
    listEl.hidden = true;
    listEl.innerHTML = /*html*/'';
    matches = [];
    activeIndex = -1;
  };

  const renderList = () => {
    const query = inputEl.value.trim();
    matches = getIngredientSuggestions(query);

    if (matches.length === 0) {
      close();
      return;
    }

    listEl.innerHTML = /*html*/matches.map((name, i) => `
      <li class="tag-suggest-item${i === activeIndex ? ' active' : ''}" role="option" data-index="${i}">${escapeHtml(name)}</li>
    `).join('');
    listEl.hidden = false;

    if (activeIndex >= 0) {
      listEl.querySelector('.tag-suggest-item.active')?.scrollIntoView({ block: 'nearest' });
    }
  };

  const pick = (name) => {
    inputEl.value = name;
    inputEl.dispatchEvent(new Event('input', { bubbles: true }));
    close();
    inputEl.focus();
  };

  inputEl.addEventListener('input', () => {
    activeIndex = -1;
    renderList();
  });

  inputEl.addEventListener('focus', renderList);

  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' && !listEl.hidden && matches.length) {
      e.preventDefault();
      activeIndex = Math.min(activeIndex + 1, matches.length - 1);
      renderList();
    } else if (e.key === 'ArrowUp' && !listEl.hidden && matches.length) {
      e.preventDefault();
      activeIndex = Math.max(activeIndex - 1, 0);
      renderList();
    } else if (e.key === 'Escape') {
      close();
    } else if (e.key === 'Enter' && activeIndex >= 0 && matches[activeIndex]) {
      e.preventDefault();
      pick(matches[activeIndex]);
    }
  });

  // mousedown (not click) fires before the input's blur handler, so the tap
  // registers before the dropdown gets torn down.
  listEl.addEventListener('mousedown', (e) => {
    const item = e.target.closest('.tag-suggest-item');
    if (!item) return;
    e.preventDefault();
    const idx = Number(item.dataset.index);
    if (matches[idx]) pick(matches[idx]);
  });

  inputEl.addEventListener('blur', () => {
    setTimeout(close, 120);
  });
}

/**
 * Render editor tag chips
 */
export function renderEditorTagChips() {
  const container = document.getElementById('editor-tags-list');
  if (!container) return;

  if (state.editorTags.length === 0) {
    container.innerHTML =  /*html*/`<span class="editor-tags-empty">No tags added yet</span>`;
    return;
  }

  container.innerHTML =  /*html*/state.editorTags.map(t => {
    const isDetected = state.editorAutoAddedTagNames.includes(t);
    return `
    <span class="editor-tag-chip${isDetected ? ' is-detected' : ''}" data-tag="${escapeHtml(t)}" ${isDetected ? `title="Suggested from your ingredients/directions — remove if it doesn't fit"` : ''}>
      <span>#${escapeHtml(t)}</span>
      <button type="button" class="btn-remove-tag" data-action="remove-editor-tag" data-tag="${escapeHtml(t)}" title="Remove tag #${escapeHtml(t)}" aria-label="Remove tag #${escapeHtml(t)}">×</button>
    </span>
  `;
  }).join('');

  container.querySelectorAll('[data-action="remove-editor-tag"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const tag = btn.getAttribute('data-tag');
      state.editorTags = state.editorTags.filter(t => t !== tag);
      state.editorAutoAddedTagNames = state.editorAutoAddedTagNames.filter(t => t !== tag);
      // Don't immediately re-suggest a tag the user just chose to remove.
      if (!state.editorAutoRemovedTags.includes(tag)) {
        state.editorAutoRemovedTags = [...state.editorAutoRemovedTags, tag];
      }
      renderEditorTagChips();
    });
  });
}

/**
 * Setup event listeners within the editor
 */
export function setupEditorEvents(recipeId) {
  // Live-update the title (main header + both sticky bars) as the user types
  // the cocktail name, falling back to a placeholder label when it's empty.
  const editorTitleEl = document.getElementById('editor-title');
  const mobileStickyNameEl = document.getElementById('editor-mobile-sticky-name');
  const titleFallback = editorTitleEl?.getAttribute('data-fallback') || '';
  document.getElementById('edit-name')?.addEventListener('input', (e) => {
    const displayName = e.target.value.trim() || titleFallback;
    if (editorTitleEl) editorTitleEl.textContent = displayName;
    if (mobileStickyNameEl) mobileStickyNameEl.textContent = displayName;
    if (elements.desktopStickyName) elements.desktopStickyName.textContent = displayName;
  });

  document.getElementById('btn-cancel-edit-mobile')?.addEventListener('click', cancelEditor);
  document.getElementById('btn-save-edit-mobile')?.addEventListener('click', () => saveCurrentEditor(recipeId));
  // desktopStickySave lives in the persistent app header (not re-created per
  // openEditor call like the rest of this markup), so use .onclick rather than
  // addEventListener — otherwise every editor session stacks another listener
  // bound to a stale recipeId, and one click would fire all of them.
  if (elements.desktopStickySave) {
    elements.desktopStickySave.onclick = () => saveCurrentEditor(recipeId);
  }

  setupEditorStickyHeader();

  // Add row
  document.getElementById('btn-add-spec-row')?.addEventListener('click', () => {
    state.editorSpecs.push({ amount: 1, unit: 'oz', name: '' });
    renderEditorSpecRows();
    updateEditorGlassPreview();
  });

  // Quick Paste Apply
  const quickPasteInput = document.getElementById('quick-paste-input');
  const applyQuickPaste = () => {
    const text = quickPasteInput.value.trim();
    if (!text) return;
    const parsed = parseSpecsBlock(text);
    if (parsed.length > 0) {
      state.editorSpecs = parsed.map(p => ({
        amount: p.amount,
        unit: p.unit,
        name: p.name,
      }));
      renderEditorSpecRows();
      updateEditorGlassPreview();
      showToast(`Parsed ${parsed.length} ingredients into specs below`);
    } else {
      showToast('No ingredient lines recognized in paste box');
    }
  };

  document.getElementById('btn-apply-paste')?.addEventListener('click', applyQuickPaste);

  document.getElementById('btn-clear-paste')?.addEventListener('click', () => {
    if (quickPasteInput) {
      quickPasteInput.value = '';
      showToast('Cleared paste box');
    }
  });

  quickPasteInput?.addEventListener('paste', () => {
    setTimeout(applyQuickPaste, 50);
  });

  const glasswareSelect = document.getElementById('edit-glassware');
  const methodSelect = document.getElementById('edit-method');
  const garnishInput = document.getElementById('edit-garnish');
  const glasswareBadge = document.getElementById('glassware-detected-badge');
  const methodBadge = document.getElementById('method-detected-badge');
  const garnishBadge = document.getElementById('garnish-detected-badge');

  const setDetectedBadge = (badge, isDetected) => {
    if (badge) badge.hidden = !isDetected;
  };

  glasswareSelect?.addEventListener('change', () => {
    // A manual choice always wins — stop treating this field as detectable.
    state.editorGlasswareAutoFilled = false;
    setDetectedBadge(glasswareBadge, false);
    updateEditorGlassPreview();
  });

  const instructionsInput = document.getElementById('edit-instructions');
  instructionsInput?.addEventListener('input', () => {
    state.editorInstructionsAutoFilled = false;
    runDirectionsAutoDetection();
  });

  methodSelect?.addEventListener('change', (e) => {
    state.editorMethodAutoFilled = false;
    setDetectedBadge(methodBadge, false);
    // Only swap the boilerplate directions if the user hasn't started editing
    // them — once they've typed anything of their own, leave it alone.
    if (state.editorInstructionsAutoFilled && instructionsInput) {
      instructionsInput.value = getDefaultInstructions(e.target.value);
    }
    updateEditorGlassPreview();
  });

  garnishInput?.addEventListener('input', () => {
    state.editorGarnishAutoFilled = false;
    setDetectedBadge(garnishBadge, false);
    updateEditorGlassPreview();
  });

  /**
   * Extracts method/glassware/garnish mentions straight out of what's typed
   * into Preparation Directions, and mirrors them into their own fields —
   * only for fields the user hasn't touched yet (see the *AutoFilled flags).
   * This is the fix for not knowing whether "garnish with a cherry" belongs
   * in the directions or the Garnish field: write it once, either place.
   */
  function runDirectionsAutoDetection() {
    const text = instructionsInput?.value || '';

    if (state.editorMethodAutoFilled && methodSelect) {
      const detected = detectMethodFromText(text);
      if (detected && methodSelect.value !== detected) {
        methodSelect.value = detected;
        setDetectedBadge(methodBadge, true);
        updateEditorGlassPreview();
      }
    }

    if (state.editorGlasswareAutoFilled && glasswareSelect) {
      const detected = detectGlasswareFromText(text);
      if (detected && glasswareSelect.value !== detected) {
        glasswareSelect.value = detected;
        setDetectedBadge(glasswareBadge, true);
        updateEditorGlassPreview();
      }
    }

    if (state.editorGarnishAutoFilled && garnishInput && !garnishInput.value.trim()) {
      const detected = detectGarnishFromText(text);
      if (detected) {
        garnishInput.value = detected;
        setDetectedBadge(garnishBadge, true);
        updateEditorGlassPreview();
      }
    }
  }

  // Editor Tags management
  const editorTagInput = document.getElementById('editor-tag-input');
  const addEditorTag = (tagOverride) => {
    const raw = normalizeTagName(tagOverride ?? editorTagInput?.value);
    if (!raw) return;

    if (!state.editorTags.includes(raw)) {
      state.editorTags.push(raw);
      renderEditorTagChips();
    }
    if (editorTagInput) editorTagInput.value = '';
  };

  document.getElementById('btn-add-editor-tag')?.addEventListener('click', () => addEditorTag());

  setupTagAutocomplete(
    editorTagInput,
    document.getElementById('editor-tag-suggest-list'),
    () => getAllUniqueTags(state.recipes).filter(t => !state.editorTags.includes(t)),
    addEditorTag
  );

  document.getElementById('btn-cancel-edit')?.addEventListener('click', cancelEditor);

  document.getElementById('btn-save-edit')?.addEventListener('click', () => {
    saveCurrentEditor(recipeId);
  });
}

/**
 * Live vector glass update inside editor
 */
export function updateEditorGlassPreview() {
  const container = document.getElementById('editor-glass-wrapper');
  if (!container) return;

  const glassware = document.getElementById('edit-glassware')?.value || 'Coupe';
  const name = document.getElementById('edit-name')?.value || 'Preview';
  const garnish = document.getElementById('edit-garnish')?.value || '';

  state.glassViewEditor = new GlassView(container, {
    initialMode: state.glassViewMode,
  });

  state.glassViewEditor.render({
    name,
    glassware,
    garnish,
    specs: state.editorSpecs,
  }, state.glassViewMode);

  const method = document.getElementById('edit-method')?.value || 'Stirred';
  const abvBadge = document.getElementById('editor-abv-badge');
  if (abvBadge) {
    const abvCalc = calculateCocktailAbv(state.editorSpecs, method);
    const rounded = Math.round(abvCalc.estimatedAbv);
    abvBadge.textContent = rounded > 0
      ? `ABV: ${rounded}%`
      : 'Non-Alcoholic';
  }

  runTagAutoDetection(method);
}

/**
 * Suggests tags from the recipe's ingredients and computed flavor/ABV profile
 * (see detectTagsFromRecipe) and adds any new ones straight to the tag list.
 * Only for a brand-new recipe, only ever additive, and never re-adds a tag the
 * user has explicitly removed this session.
 */
function runTagAutoDetection(method) {
  if (!state.editorTagsAutoDetectEnabled) return;
  const namedSpecs = state.editorSpecs.filter(s => s.name && s.name.trim());

  const currentlySuggested = new Set(
    namedSpecs.length > 0
      ? detectTagsFromRecipe(namedSpecs, method).filter(tag => !state.editorAutoRemovedTags.includes(tag))
      : []
  );

  // Auto-added tags track the ingredients live: one that's no longer justified
  // (e.g. the ingredient it came from got replaced) quietly drops off, same as
  // it quietly appeared. A tag the user typed themselves is never touched here.
  const stillJustified = state.editorAutoAddedTagNames.filter(tag => currentlySuggested.has(tag));
  const newlySuggested = [...currentlySuggested].filter(tag => !state.editorTags.includes(tag));

  const changed = stillJustified.length !== state.editorAutoAddedTagNames.length || newlySuggested.length > 0;
  if (!changed) return;

  const dropped = new Set(state.editorAutoAddedTagNames.filter(tag => !stillJustified.includes(tag)));
  state.editorTags = state.editorTags.filter(tag => !dropped.has(tag)).concat(newlySuggested);
  state.editorAutoAddedTagNames = [...stillJustified, ...newlySuggested];
  renderEditorTagChips();
}

/**
 * Watch the main editor title for scrolling out of view, and mirror its
 * live text into the mobile sticky bar and the shared desktop sticky-title
 * slot in the app header (same mechanism the single-recipe page uses).
 */
function setupEditorStickyHeader() {
  const titleEl = document.getElementById('editor-title');
  if (!titleEl) return;

  if (window._editorScrollObserver) {
    window._editorScrollObserver.disconnect();
  }

  elements.desktopStickyTitle?.classList.add('editor-mode');
  if (elements.desktopStickyName) {
    elements.desktopStickyName.textContent = titleEl.textContent;
  }

  const mobileStickyTitle = document.getElementById('editor-mobile-sticky-title');
  const isMobile = window.innerWidth <= 768;
  const headerEl = document.querySelector('.app-header');
  const headerHeight = isMobile ? (headerEl?.getBoundingClientRect().height || 52) : 0;
  const stickyBar = document.getElementById('editor-mobile-bar');
  const stickyBarHeight = stickyBar && stickyBar.offsetHeight > 0 ? stickyBar.offsetHeight : 0;
  const topOffset = headerHeight + stickyBarHeight;

  window._editorScrollObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      const rootTop = entry.rootBounds ? entry.rootBounds.top : topOffset;
      const isPast = !entry.isIntersecting && entry.boundingClientRect.bottom <= (rootTop + 20);
      if (isPast && state.viewMode === 'edit') {
        mobileStickyTitle?.classList.add('visible');
        elements.desktopStickyTitle?.classList.add('visible');
      } else {
        mobileStickyTitle?.classList.remove('visible');
        elements.desktopStickyTitle?.classList.remove('visible');
      }
    });
  }, {
    root: isMobile ? null : elements.mainStage,
    rootMargin: `-${topOffset}px 0px 0px 0px`,
    threshold: 0,
  });

  window._editorScrollObserver.observe(titleEl);
}

/**
 * Undo setupEditorStickyHeader()'s use of the shared desktop sticky-title slot,
 * so the single-recipe page doesn't inherit a stray Save button or stale name.
 */
function teardownEditorStickyHeader() {
  if (window._editorScrollObserver) {
    window._editorScrollObserver.disconnect();
    window._editorScrollObserver = null;
  }
  elements.desktopStickyTitle?.classList.remove('editor-mode', 'visible');
}

/**
 * Cancel editing and return to counter view
 */
export function cancelEditor() {
  teardownEditorStickyHeader();
  state.editorTags = [];
  state.editorRiffOfId = null;
  state.editorRiffOfName = '';
  state.viewMode = 'counter';
  if (_renderCurrentViewFn) _renderCurrentViewFn();

  if (!state.activeRecipeId) {
    elements.sidebar.classList.remove('mobile-hidden');
    elements.mainStage.classList.add('mobile-hidden');
  }
}

/**
 * Save current recipe from editor
 */
export function saveCurrentEditor(existingId) {
  const nameInput = document.getElementById('edit-name');
  const name = nameInput.value.trim();

  if (!name) {
    nameInput.focus();
    alert('Please enter a cocktail name');
    return;
  }

  const glassware = document.getElementById('edit-glassware').value;
  const method = document.getElementById('edit-method').value;
  const garnish = document.getElementById('edit-garnish').value.trim();
  const instructions = document.getElementById('edit-instructions')?.value.trim() || '';
  const description = document.getElementById('edit-description')?.value.trim() || '';
  const source = document.getElementById('edit-source')?.value.trim() || '';
  const sourceUrl = document.getElementById('edit-source-url')?.value.trim() || '';
  const notes = document.getElementById('edit-notes')?.value.trim() || '';

  const validSpecs = state.editorSpecs.filter(s => s.name.trim().length > 0);

  const recipeToSave = {
    id: existingId || undefined,
    name,
    glassware,
    method,
    garnish,
    instructions,
    description,
    source,
    sourceUrl,
    notes,
    tags: state.editorTags,
    riffOfId: state.editorRiffOfId || undefined,
    riffOfName: state.editorRiffOfName || undefined,
    specs: validSpecs,
  };

  const saved = saveRecipe(recipeToSave);
  teardownEditorStickyHeader();
  state.editorTags = [];
  state.editorRiffOfId = null;
  state.editorRiffOfName = '';
  state.recipes = getRecipes();
  if (_selectRecipeFn) _selectRecipeFn(saved.id);
  showToast(`Saved "${saved.name}"`);
}
