/**
 * Speakeasy menu sections
 * Groups a menu's drinks under base-spirit headings (Whiskey, Gin, Rum…) so a
 * long menu has landmarks to scroll by. Base spirit is what guests already
 * know how to scan for; grouping by mood wouldn't work as headings because a
 * drink belongs to several moods, while it has one base.
 *
 * Pure logic, no DOM.
 */

import { SPIRITS } from './quiz.js';
import { detectDominantSpiritTag } from './auto-detect.js';

export const OTHER_SECTION = { key: 'other', heading: 'Liqueurs & more' };

// Below this, a menu is short enough to scan whole and headings are just clutter.
export const MIN_DRINKS_FOR_SECTIONS = 24;

// Sections are shown in this fixed order so the layout is predictable menu to
// menu; empty sections are left out.
const SECTION_ORDER = [...SPIRITS.map(s => ({ key: s.value, heading: s.heading, tags: s.tags })), OTHER_SECTION];

/**
 * The section a recipe belongs to: the first spirit tag it carries, in the
 * recipe's own tag order (curated tags list the dominant spirit first), so a
 * split-base drink lands in one place instead of appearing twice.
 */
export function sectionKeyFor(recipe) {
  const dominant = detectDominantSpiritTag(recipe?.specs);
  if (dominant === 'scotch-forward') return 'scotch';
  for (const tag of recipe.tags || []) {
    const spirit = SPIRITS.find(s => s.tags.includes(tag));
    if (spirit) return spirit.value;
  }
  return OTHER_SECTION.key;
}

/**
 * @returns {Array<{key: string, heading: string, recipes: object[]}>} non-empty
 *   sections in display order; each recipe appears exactly once and keeps its
 *   original relative order within its section.
 */
export function groupBySpirit(recipes) {
  const buckets = new Map(SECTION_ORDER.map(s => [s.key, []]));
  for (const recipe of recipes || []) buckets.get(sectionKeyFor(recipe)).push(recipe);
  return SECTION_ORDER
    .filter(s => buckets.get(s.key).length > 0)
    .map(s => ({ key: s.key, heading: s.heading, recipes: buckets.get(s.key) }));
}

/**
 * Whether headings help on this menu: it has to be long enough to need
 * landmarks, and spread over more than one section (headings over a single
 * group would just be a title).
 */
export function shouldUseSections(recipes, sections = groupBySpirit(recipes)) {
  return (recipes || []).length >= MIN_DRINKS_FOR_SECTIONS && sections.length >= 2;
}
