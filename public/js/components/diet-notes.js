/**
 * The dietary line under a recipe's ingredients: "Contains egg, dairy",
 * "May contain tree nuts", and "Can be made egg-free". Shared by the guest's
 * drink page and the bartender's own recipe page so they always agree.
 * Renders nothing when there's nothing to say.
 */

import { escapeHtml } from './toast.js';
import { dietFor, hasEggSwap, usesFoamer, flagList } from '../modules/dietary.js';

export function dietNotesHtml(recipe) {
  const { contains, may } = dietFor(recipe);
  const lines = [];
  if (contains.length) lines.push(`<p><span class="diet-notes-label">Contains</span> ${escapeHtml(flagList(contains))}</p>`);
  if (may.length) lines.push(`<p><span class="diet-notes-label">May contain</span> ${escapeHtml(flagList(may))}</p>`);
  if (usesFoamer(recipe)) lines.push('<p class="diet-notes-swap">Made with cocktail foamer</p>');
  else if (hasEggSwap(recipe)) lines.push('<p class="diet-notes-swap">Can be made egg-free</p>');
  return lines.length ? `<div class="diet-notes">${lines.join('')}</div>` : '';
}
