/**
 * Speakeasy guest search
 * Search tuned for someone browsing a menu on their phone, not for the host
 * digging through a recipe library. It differs from the library's own
 * recipeMatchesQuery on purpose:
 *
 *   - It matches whole words, not substrings, so "gin" finds gin drinks rather
 *     than everything with ginger in it. While a guest is still typing a word
 *     ("ging", "man") it falls back to prefix matching so results appear as
 *     they type.
 *   - It searches what a guest would think to search for: the drink's name,
 *     its ingredients (including families and aliases, so "whiskey" finds
 *     bourbon and "aperitivo" finds Campari), tags, mood words, and glass.
 *     It does NOT search instructions or source, which would make "shake" or a
 *     bartender's name match half the menu.
 *   - Descriptions count for free words but not for ingredient words. "cuban"
 *     or "philadelphia" find the drinks whose blurbs say so, while "gin",
 *     "lime" or "smoky" (a real ingredient, tag, or mood on this menu) answer
 *     only from the drink's actual makeup, so a passing mention of gin in a
 *     whiskey drink's blurb doesn't pollute "gin".
 *
 * Pure logic, no DOM. Build the index once per menu, then search per keystroke.
 */

import { findIngredient, normalizeSearchText } from './taxonomy.js';
import { MOODS, getRecipeMoods } from './moods.js';

// Fewer characters than this is too broad to filter on ("g" matches half the menu).
export const MIN_QUERY_LENGTH = 2;

const STOP_WORDS = new Set(['and', 'the', 'of', 'with', 'a', 'an', 'in', 'on', 'to', 'for', 'forward', 'riff']);

// Families whose common name isn't the family's own name.
const FAMILY_ALIASES = {
  whiskey: ['whisky'],
  agave_spirits: ['agave'],
  cane_spirits: ['rum', 'cane'],
  neutral_spirits: ['vodka'],
};

// Generic families that add nothing a guest would type.
const SKIPPED_FAMILIES = new Set(['texture']);

function wordsOf(text) {
  const words = new Set();
  for (const raw of normalizeSearchText(String(text || '')).split(/[^a-z0-9]+/)) {
    if (!raw || STOP_WORDS.has(raw)) continue;
    words.add(raw);
    // "limes" / "liqueurs" should meet "lime" / "liqueur".
    if (raw.length > 3 && raw.endsWith('s') && !raw.endsWith('ss')) words.add(raw.slice(0, -1));
  }
  return words;
}

function addAll(target, words) {
  words.forEach(w => target.add(w));
}

function ingredientWords(specName) {
  const words = wordsOf(specName);
  const item = findIngredient(specName);
  if (!item) return words;
  addAll(words, wordsOf(item.name));
  (item.aliases || []).forEach(alias => addAll(words, wordsOf(alias)));
  if (!SKIPPED_FAMILIES.has(item.family)) addAll(words, wordsOf(String(item.family || '').replace(/_/g, ' ')));
  (FAMILY_ALIASES[item.family] || []).forEach(alias => words.add(alias));
  return words;
}

/**
 * Builds a searchable index of `recipes` (a menu's drinks).
 * @returns {{entries: Array<{id: string, primary: Set<string>, secondary: Set<string>}>,
 *            primaryVocab: Set<string>, secondaryVocab: Set<string>}}
 */
export function buildSearchIndex(recipes) {
  const primaryVocab = new Set();
  const secondaryVocab = new Set();
  const ingredientVocab = new Set(); // ingredient, tag, and mood words (not names or glassware)

  const entries = (recipes || []).map(recipe => {
    // What the drink is made of and how it's described: words a guest uses to
    // ask for a *kind* of drink.
    const makeup = new Set();
    (recipe.specs || []).forEach(spec => addAll(makeup, ingredientWords(spec.name)));
    (recipe.tags || []).forEach(tag => addAll(makeup, wordsOf(String(tag).replace(/-/g, ' '))));
    // Mood words ("refreshing", "bittersweet", "cozy"): what the chips call things.
    const moodKeys = new Set(getRecipeMoods(recipe));
    MOODS.filter(m => moodKeys.has(m.key)).forEach(m => {
      makeup.add(m.key);
      addAll(makeup, wordsOf(m.label));
    });

    const primary = new Set([...wordsOf(recipe.name), ...wordsOf(recipe.glassware), ...makeup]);
    const secondary = wordsOf(recipe.description);
    primary.forEach(w => secondary.delete(w));

    addAll(primaryVocab, primary);
    addAll(secondaryVocab, secondary);
    addAll(ingredientVocab, makeup);
    return { id: recipe.id, primary, secondary };
  });

  return { entries, primaryVocab, secondaryVocab, ingredientVocab };
}

// A term matches a word list either exactly (when the guest typed a complete
// word that exists on this menu) or by prefix (when they're still typing it).
function matchesTerm(words, vocab, term) {
  if (vocab.has(term)) return words.has(term);
  for (const word of words) {
    if (word.startsWith(term)) return true;
  }
  return false;
}

function idsMatching(index, term) {
  const primary = index.entries.filter(e => matchesTerm(e.primary, index.primaryVocab, term)).map(e => e.id);
  const fromDescriptions = () => index.entries
    .filter(e => matchesTerm(e.secondary, index.secondaryVocab, term)).map(e => e.id);

  // A complete ingredient/tag/mood word answers from the drinks' makeup alone;
  // descriptions only step in if that finds nothing at all.
  if (index.ingredientVocab.has(term)) {
    return new Set(primary.length > 0 ? primary : fromDescriptions());
  }
  // Any other word ("cuban", "philadelphia") also counts where blurbs mention it.
  return new Set([...primary, ...fromDescriptions()]);
}

/**
 * @returns {Set<string>|null} the ids of matching drinks, or null when the query
 *   is too short to filter on (callers treat null as "show everything").
 */
export function searchRecipes(index, query) {
  const normalized = normalizeSearchText(String(query || '')).trim();
  if (normalized.length < MIN_QUERY_LENGTH) return null;

  const terms = normalized.split(/[^a-z0-9]+/).filter(t => t && !STOP_WORDS.has(t));
  if (terms.length === 0) return null;
  // A lone leftover letter in a longer query is mid-typing noise, not a term.
  const usable = terms.length > 1 ? terms.filter(t => t.length >= 2) : terms;
  if (usable.length === 0) return null;

  let result = null;
  for (const term of usable) {
    const ids = idsMatching(index, term);
    result = result ? new Set([...result].filter(id => ids.has(id))) : ids;
    if (result.size === 0) break;
  }
  return result;
}
