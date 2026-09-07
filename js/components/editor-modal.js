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
import { setupTagAutocomplete } from '../views/recipe-list-view.js';
import { escapeHtml, showToast } from './toast.js';

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
  const isNew = !recipe;

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

  elements.editorViewContainer.innerHTML =  /*html*/`
    <div class="editor-header">
      <h2 class="editor-title">${isNew ? 'Create New Cocktail' : `Edit ${escapeHtml(currentData.name)}`}</h2>
      <div class="counter-actions">
        <button id="btn-cancel-edit" class="btn btn-secondary">Cancel</button>
        <button id="btn-save-edit" class="btn btn-primary">Save Recipe</button>
      </div>
    </div>

    <div class="editor-grid">
      <!-- Left Column: Form Controls & Quick Paste -->
      <div class="editor-form-col">
        <!-- Quick Paste Box -->
        <div class="quick-paste-box">
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
        <div class="form-group">
          <label class="form-label" for="edit-name">Cocktail Name</label>
          <input type="text" id="edit-name" class="form-input" value="${escapeHtml(currentData.name)}" placeholder="Sea Legs" required>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label" for="edit-glassware">Glassware</label>
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
            <label class="form-label" for="edit-method">Preparation Technique</label>
            <select id="edit-method" class="form-select">
              <option value="Shaken" ${currentData.method === 'Shaken' ? 'selected' : ''}>Shaken</option>
              <option value="Stirred" ${currentData.method === 'Stirred' ? 'selected' : ''}>Stirred</option>
              <option value="Built" ${currentData.method === 'Built' ? 'selected' : ''}>Built in Glass</option>
              <option value="Blended" ${currentData.method === 'Blended' ? 'selected' : ''}>Blended</option>
              <option value="Rolled" ${currentData.method === 'Rolled' ? 'selected' : ''}>Rolled</option>
            </select>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label" for="edit-garnish">Garnish</label>
          <input type="text" id="edit-garnish" class="form-input" value="${escapeHtml(currentData.garnish)}" placeholder="Lime wheel, orange twist, etc.">
        </div>

        <!-- Tags & Custom Lists -->
        <div class="form-group">
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

        <!-- Editable Spec Rows -->
        <div class="editor-specs-section">
          <div class="editor-specs-header">
            <label class="form-label" style="margin-bottom: 0;">Ingredient Specifications</label>
            <button type="button" id="btn-add-spec-row" class="btn btn-secondary btn-sm">+ Add Ingredient</button>
          </div>

          <div id="editor-specs-rows">
            <!-- Populated via renderEditorSpecRows() -->
          </div>
        </div>

        <!-- Preparation Directions -->
        <div class="form-group" style="margin-top: 1.5rem;">
          <label class="form-label" for="edit-instructions">Preparation Directions</label>
          <textarea id="edit-instructions" class="form-textarea" rows="4" placeholder="Combine all ingredients in a shaker with ice. Shake until cold and diluted. Strain over fresh ice into a rocks glass.">${escapeHtml(currentData.instructions || currentData.notes || '')}</textarea>
        </div>

        <!-- Description & Story -->
        <div class="form-group">
          <label class="form-label" for="edit-description">Description & Story</label>
          <textarea id="edit-description" class="form-textarea" rows="3" placeholder="Background, flavor profile, or creator writeup...">${escapeHtml(currentData.description || '')}</textarea>
        </div>

        <!-- Source & Attribution -->
        <div class="form-row">
          <div class="form-group">
            <label class="form-label" for="edit-source">Source / Creator</label>
            <input type="text" id="edit-source" class="form-input" value="${escapeHtml(currentData.source || '')}" placeholder="Elevated Craft / Alejandro Olivares">
          </div>
          <div class="form-group">
            <label class="form-label" for="edit-source-url">Source Link / URL</label>
            <input type="url" id="edit-source-url" class="form-input" value="${escapeHtml(currentData.sourceUrl || '')}" placeholder="https://elevatedcraft.com/blogs/cocktail-recipes/sea-legs">
          </div>
        </div>

        <!-- Additional Notes -->
        <div class="form-group">
          <label class="form-label" for="edit-notes">Additional Notes & Tips (Optional)</label>
          <textarea id="edit-notes" class="form-textarea" rows="2" placeholder="Ice, dilution details, or variations...">${escapeHtml(currentData.notes || '')}</textarea>
        </div>
      </div>

      <!-- Right Column: Live Vector Fluid Glass Preview -->
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

  const units = ['oz', 'ml', 'dash', 'dashes', 'barspoon', 'tsp', 'tbsp', 'drops', 'rinse', 'part'];

  container.innerHTML =  /*html*/state.editorSpecs.map((spec, i) => {
    const defaultAbv = estimateIngredientAbv(spec.name || '');
    const currentAbv = spec.abv !== undefined && spec.abv !== null ? spec.abv : (defaultAbv > 0 ? defaultAbv : '');

    return `
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
        <input
          type="text"
          class="form-input spec-input-name"
          value="${escapeHtml(spec.name)}"
          placeholder="Ingredient name (Bourbon, Campari, etc.)"
          aria-label="Ingredient name"
          required
        >
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
 * Render editor tag chips
 */
export function renderEditorTagChips() {
  const container = document.getElementById('editor-tags-list');
  if (!container) return;

  if (state.editorTags.length === 0) {
    container.innerHTML =  /*html*/`<span class="editor-tags-empty">No tags added yet</span>`;
    return;
  }

  container.innerHTML =  /*html*/state.editorTags.map(t => `
    <span class="editor-tag-chip" data-tag="${escapeHtml(t)}">
      <span>#${escapeHtml(t)}</span>
      <button type="button" class="btn-remove-tag" data-action="remove-editor-tag" data-tag="${escapeHtml(t)}" title="Remove tag #${escapeHtml(t)}" aria-label="Remove tag #${escapeHtml(t)}">×</button>
    </span>
  `).join('');

  container.querySelectorAll('[data-action="remove-editor-tag"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const tag = btn.getAttribute('data-tag');
      state.editorTags = state.editorTags.filter(t => t !== tag);
      renderEditorTagChips();
    });
  });
}

/**
 * Setup event listeners within the editor
 */
export function setupEditorEvents(recipeId) {
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

  document.getElementById('edit-glassware')?.addEventListener('change', () => {
    updateEditorGlassPreview();
  });

  document.getElementById('edit-method')?.addEventListener('change', () => {
    updateEditorGlassPreview();
  });

  document.getElementById('edit-garnish')?.addEventListener('input', () => {
    updateEditorGlassPreview();
  });

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
}

/**
 * Cancel editing and return to counter view
 */
export function cancelEditor() {
  state.editorTags = [];
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
  const existingRecipe = existingId ? state.recipes.find(r => r.id === existingId) : null;

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
    riffOfId: existingRecipe?.riffOfId || undefined,
    riffOfName: existingRecipe?.riffOfName || undefined,
    specs: validSpecs,
  };

  const saved = saveRecipe(recipeToSave);
  state.editorTags = [];
  state.recipes = getRecipes();
  if (_selectRecipeFn) _selectRecipeFn(saved.id);
  showToast(`Saved "${saved.name}"`);
}
