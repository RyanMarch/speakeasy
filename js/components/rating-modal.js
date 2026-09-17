/**
 * Speakeasy Rating & Tasting Notes Popover
 * Unobtrusive sheet offered right after "I Made This" — 5 gold stars, an
 * optional one-line tasting note, "Save Note" and a prominent "Skip". Slides
 * up from the bottom (mindful of mobile safe areas) as a plain floating
 * element — NOT a native <dialog>/showModal(), so there's no backdrop and no
 * focus trap: the rest of the page stays fully visible and interactive while
 * it's up, same as the Smart Counter Timer toast (see timer-modal.js).
 */

import { updateDrinkEntry } from '../modules/history.js';
import { showToast } from './toast.js';

let sheetEl = null;
let currentEntryId = null;
let currentRating = 0;
let onSavedCallback = null;
let isOpen = false;

/**
 * Renders `size`px gold stars for a 1-5 rating (rounded to the nearest whole
 * star). Shared by the Counter View's rating summary and the Home View's
 * Recently Made shelf cards.
 */
export function renderStarsHtml(rating, { size = 12 } = {}) {
  const filled = Math.round(Math.max(0, Math.min(5, rating || 0)));
  let stars = '';
  for (let i = 1; i <= 5; i++) {
    stars += `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${i <= filled ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`;
  }
  return `<span class="rating-stars-display" aria-label="${filled} out of 5 stars">${stars}</span>`;
}

function getSheetElement() {
  if (sheetEl && document.body.contains(sheetEl)) return sheetEl;

  sheetEl = document.createElement('div');
  sheetEl.id = 'rating-modal';
  sheetEl.className = 'rating-sheet';
  sheetEl.setAttribute('role', 'dialog');
  sheetEl.setAttribute('aria-labelledby', 'rating-modal-title');
  sheetEl.style.display = 'none';
  sheetEl.innerHTML = /*html*/`
    <div class="rating-sheet-inner">
      <button type="button" id="btn-rating-close" class="rating-sheet-close" aria-label="Close">&times;</button>
      <h2 id="rating-modal-title" class="rating-sheet-title">How was it?</h2>
      <p class="rating-sheet-subtitle" id="rating-modal-subtitle"></p>
      <div class="rating-star-picker" id="rating-star-picker" role="radiogroup" aria-label="Rate this drink, 1 to 5 stars">
        ${[1, 2, 3, 4, 5].map(n => /*html*/`
          <button type="button" class="rating-star-btn" data-star="${n}" role="radio" aria-checked="false" aria-label="${n} star${n === 1 ? '' : 's'}">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
            </svg>
          </button>
        `).join('')}
      </div>
      <input type="text" id="rating-notes-input" class="rating-notes-input" maxlength="140"
        placeholder="e.g., Used Carpano Antica; came out rich" aria-label="Tasting notes">
      <div class="rating-sheet-actions">
        <button type="button" id="btn-rating-skip" class="btn btn-ghost btn-sm rating-skip-btn">Skip</button>
        <button type="button" id="btn-rating-save" class="btn btn-primary btn-sm rating-save-btn">Save Note</button>
      </div>
    </div>
  `;
  document.body.appendChild(sheetEl);

  const starPicker = sheetEl.querySelector('#rating-star-picker');
  starPicker.addEventListener('click', (e) => {
    const btn = e.target.closest('.rating-star-btn');
    if (!btn) return;
    currentRating = parseInt(btn.getAttribute('data-star'), 10);
    renderStarSelection();
  });

  sheetEl.querySelector('#btn-rating-close').addEventListener('click', () => closeRatingModal());
  sheetEl.querySelector('#btn-rating-skip').addEventListener('click', () => closeRatingModal());

  sheetEl.querySelector('#btn-rating-save').addEventListener('click', async () => {
    const notesInput = sheetEl.querySelector('#rating-notes-input');
    const notes = notesInput.value.trim() || null;
    if (currentEntryId) {
      await updateDrinkEntry(currentEntryId, { rating: currentRating || null, notes });
      showToast(currentRating ? 'Rating saved' : 'Note saved');
      if (onSavedCallback) onSavedCallback();
    }
    closeRatingModal();
  });

  return sheetEl;
}

function renderStarSelection() {
  const sheet = getSheetElement();
  sheet.querySelectorAll('.rating-star-btn').forEach(btn => {
    const starValue = parseInt(btn.getAttribute('data-star'), 10);
    const isFilled = starValue <= currentRating;
    btn.classList.toggle('filled', isFilled);
    btn.setAttribute('aria-checked', String(starValue === currentRating));
    btn.querySelector('svg').setAttribute('fill', isFilled ? 'currentColor' : 'none');
  });
}

function handleEscapeKey(e) {
  if (e.key === 'Escape') closeRatingModal();
}

/**
 * Opens the rating sheet for a given drink_history entry id. Non-blocking —
 * slides up over the bottom of the screen without a backdrop, so the rest of
 * the page stays interactive while it's showing.
 * @param {string} entryId
 * @param {string} recipeName
 * @param {{ onSaved?: () => void }} [options]
 */
export function openRatingModal(entryId, recipeName = 'this drink', options = {}) {
  const sheet = getSheetElement();
  currentEntryId = entryId;
  currentRating = 0;
  onSavedCallback = options.onSaved || null;

  sheet.querySelector('#rating-modal-subtitle').textContent = `Rate ${recipeName}`;
  sheet.querySelector('#rating-notes-input').value = '';
  renderStarSelection();

  sheet.style.display = 'flex';
  // Force layout so the slide-in transition (from the .open class) actually
  // animates instead of the sheet just appearing already in its open state.
  void sheet.offsetHeight;
  sheet.classList.add('open');
  isOpen = true;

  document.addEventListener('keydown', handleEscapeKey);
}

export function closeRatingModal() {
  if (!isOpen || !sheetEl) return;
  isOpen = false;
  sheetEl.classList.remove('open');
  document.removeEventListener('keydown', handleEscapeKey);
  setTimeout(() => {
    if (sheetEl && !isOpen) sheetEl.style.display = 'none';
  }, 260);
}
