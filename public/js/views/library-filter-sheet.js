/**
 * Speakeasy Library Filter & Sort Popover
 * A popover anchored under the sidebar filter button for selecting
 * recipe sort order and dietary ingredient exclusions.
 */

import { escapeHtml } from '../components/toast.js';
import { closeDialog, enhanceDialog } from '../components/dialog-motion.js';
import { DIET_FLAGS } from '../modules/dietary.js';

export const SORT_OPTIONS = [
  { key: 'curated', label: 'Default' },
  { key: 'name-asc', label: 'Alphabetical (A–Z)' },
  { key: 'abv-asc', label: 'Lowest Proof' },
  { key: 'specs-asc', label: 'Fewest Ingredients' },
  { key: 'calories-asc', label: 'Fewest Calories' },
];

/**
 * @param {object} opts
 * @param {string[]} opts.flags
 * @param {Set<string>} opts.avoid
 * @param {string} opts.currentSort
 * @param {(sort: string) => void} opts.onSortChange
 * @param {(avoid: Set<string>) => void} opts.onAvoidChange
 * @param {HTMLElement} [opts.returnFocusTo]
 */
export function openLibraryFilterSheet({
  flags,
  avoid,
  currentSort = 'curated',
  onSortChange,
  onAvoidChange,
  returnFocusTo,
}) {
  const offered = DIET_FLAGS.filter(f => flags.includes(f.key));
  let activeSort = currentSort || 'curated';

  const dialog = document.createElement('dialog');
  dialog.className = 'guest-diet-sheet library-filter-sheet';
  dialog.setAttribute('aria-label', 'Filter and sort');
  dialog.innerHTML =  /*html*/`
    <div class="filter-sheet-section">
      <h2 class="filter-sheet-title">Sort</h2>
      <div class="filter-sheet-sort-options" role="radiogroup" aria-label="Sort options">
        ${SORT_OPTIONS.map(opt => `
          <button type="button" class="filter-sheet-chip filter-sort-chip" role="radio" data-sort="${opt.key}" aria-checked="${String(activeSort === opt.key)}">
            ${escapeHtml(opt.label)}
          </button>
        `).join('')}
      </div>
    </div>
    <div class="filter-sheet-section">
      <h2 class="filter-sheet-title">Avoid</h2>
      <div class="guest-diet-chips" role="group" aria-label="Leave out drinks with">
        ${offered.map(f => `
          <button type="button" class="guest-diet-chip" data-flag="${f.key}" aria-pressed="${String(avoid.has(f.key))}">
            ${escapeHtml(f.label)}
          </button>
        `).join('')}
      </div>
    </div>
    <div class="guest-diet-actions">
      <button type="button" class="btn btn-ghost btn-sm" data-action="filter-reset">Reset</button>
      <button type="button" class="btn btn-primary btn-sm" data-action="filter-done">Done</button>
    </div>
  `;
  enhanceDialog(dialog);
  document.body.appendChild(dialog);

  const sync = () => {
    dialog.querySelectorAll('.filter-sort-chip').forEach(chip => {
      chip.setAttribute('aria-checked', String(activeSort === chip.getAttribute('data-sort')));
    });
    dialog.querySelectorAll('.guest-diet-chip').forEach(chip => {
      chip.setAttribute('aria-pressed', String(avoid.has(chip.getAttribute('data-flag'))));
    });
  };

  dialog.addEventListener('click', (e) => {
    if (e.target === dialog || e.target.closest('[data-action="filter-done"]')) {
      closeDialog(dialog);
      return;
    }

    const sortChip = e.target.closest('.filter-sort-chip');
    if (sortChip) {
      const nextSort = sortChip.getAttribute('data-sort');
      if (nextSort && nextSort !== activeSort) {
        activeSort = nextSort;
        sync();
        if (onSortChange) onSortChange(activeSort);
      }
      return;
    }

    const dietChip = e.target.closest('.guest-diet-chip');
    if (dietChip) {
      const key = dietChip.getAttribute('data-flag');
      if (avoid.has(key)) avoid.delete(key);
      else avoid.add(key);
      sync();
      if (onAvoidChange) onAvoidChange(avoid);
      return;
    }

    if (e.target.closest('[data-action="filter-reset"]')) {
      activeSort = 'curated';
      avoid.clear();
      sync();
      if (onSortChange) onSortChange(activeSort);
      if (onAvoidChange) onAvoidChange(avoid);
    }
  });

  dialog.addEventListener('close', () => {
    dialog.remove();
    returnFocusTo?.focus?.({ preventScroll: true });
  });

  dialog.showModal();
  if (returnFocusTo?.isConnected) anchorTo(dialog, returnFocusTo);
}

const EDGE = 12;
const GAP = 8;

/**
 * Positions dialog relative to anchor element.
 */
function anchorTo(dialog, anchor) {
  const a = anchor.getBoundingClientRect();
  const width = Math.min(dialog.offsetWidth, window.innerWidth - EDGE * 2);
  const left = Math.max(EDGE, Math.min(a.right - width, window.innerWidth - width - EDGE));
  const top = Math.min(a.bottom + GAP, window.innerHeight - dialog.offsetHeight - EDGE);
  dialog.classList.add('is-anchored');
  dialog.style.left = `${left}px`;
  dialog.style.top = `${Math.max(EDGE, top)}px`;
  dialog.style.setProperty('--diet-origin-x', `${a.left + a.width / 2 - left}px`);
  dialog.style.setProperty('--diet-origin-y', `${a.top + a.height / 2 - Math.max(EDGE, top)}px`);
}
