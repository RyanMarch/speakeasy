/**
 * Speakeasy Recipe Editor Auto-Detection
 *
 * Two kinds of light-touch detection, both easy to override:
 *
 * 1. Method/glassware/garnish: plain pattern-matches over the directions text
 *    the user already typed — never inferred from ingredient chemistry, so a
 *    detection is always traceable back to something they actually wrote.
 *
 * 2. Tags: the opposite direction — inferred FROM ingredient composition and
 *    the recipe's own computed flavor/ABV profile (dominant spirit, citrus,
 *    effervescence, sweet/sour/bitter/herbal balance, strength), reusing the
 *    same taxonomy and balance-engine data the rest of the app already
 *    computes. These are genuine guesses, not extractions, so they're capped
 *    to a small number and always additive — never removing a tag the user
 *    added or already had.
 */

import { findIngredient } from './taxonomy.js';
import { normalizeVolumeToOz } from './colors.js';
import { calculateBalanceProfile } from './balance.js';
import { calculateCocktailAbv } from './abv.js';

const METHOD_PATTERNS = [
  [/\bstir(?:red|ring)?\b/i, 'Stirred'],
  [/\bshak(?:e|en|ing)\b/i, 'Shaken'],
  [/\bblend(?:ed|ing)?\b/i, 'Blended'],
  [/\broll(?:ed|ing)?\b/i, 'Rolled'],
  [/\bbuild(?:ing)?\b|\bdirectly (?:in|into) the glass\b/i, 'Built'],
];

/**
 * Returns a technique guessed from the verbs in the directions text, or null
 * if nothing recognizable is mentioned yet.
 */
export function detectMethodFromText(text) {
  if (!text) return null;
  for (const [pattern, method] of METHOD_PATTERNS) {
    if (pattern.test(text)) return method;
  }
  return null;
}

const GLASSWARE_PATTERNS = [
  [/coupe/i, 'Coupe'],
  [/nick\s*(?:&|and)?\s*nora/i, 'Nick & Nora'],
  [/\b(?:rocks|old[- ]fashioned|lowball|tumbler)\s*glass\b/i, 'Rocks'],
  [/\b(?:highball|collins)\s*glass\b/i, 'Highball'],
  [/martini glass/i, 'Martini'],
  [/wine glass/i, 'Wine'],
  [/tiki mug/i, 'Tiki Mug'],
];

/**
 * Returns a glassware type explicitly named in the directions text, or null.
 */
export function detectGlasswareFromText(text) {
  if (!text) return null;
  for (const [pattern, glass] of GLASSWARE_PATTERNS) {
    if (pattern.test(text)) return glass;
  }
  return null;
}

const GARNISH_PATTERNS = [
  /\bgarnish(?:ed)?\s+with\s+(?:an?\s+|the\s+)?([^.\n;]+)/i,
  /\btop(?:ped)?\s+with\s+(?:an?\s+|the\s+)?([^.\n;]+)/i,
  /\bfinish(?:ed)?\s+with\s+(?:an?\s+|the\s+)?([^.\n;]+)/i,
];

/**
 * Pulls a garnish mention (e.g. "garnish with a cherry") out of the directions
 * text, so it doesn't have to be typed twice or left ambiguous which field it
 * belongs in. Returns null if no such phrase is present.
 */
export function detectGarnishFromText(text) {
  if (!text) return null;
  for (const pattern of GARNISH_PATTERNS) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1].trim().replace(/[.,;]+$/, '');
    }
  }
  return null;
}

// ==========================================
// Tag Detection (ingredient- and profile-based)
// ==========================================

// The single largest-volume ingredient whose family appears here names the
// drink's "-forward" tag — matches the naming convention already used across
// the seed recipe library (whiskey-forward, gin-forward, etc.).
const BASE_SPIRIT_FAMILY_TAGS = {
  whiskey: 'whiskey-forward',
  gin: 'gin-forward',
  rum: 'rum-forward',
  tequila: 'tequila-forward',
  neutral_spirits: 'vodka-forward',
  brandy: 'brandy-forward',
  cane_spirits: 'rum-forward',
  agave_spirits: 'agave-forward',
  sherry: 'sherry-forward',
  wine: 'wine-forward',
  amaro: 'amaro-forward',
};

// A few specific ingredients get their own, more precise "-forward" tag
// instead of their family's generic one.
const SPIRIT_ID_OVERRIDES = {
  cognac: 'cognac-forward',
  cachaca: 'cachaca-forward',
  mezcal: 'mezcal-forward',
};

// A "-forward" tag should mean one spirit actually leads the drink, not just
// whichever ingredient happens to be listed first. An equal-parts Negroni
// (gin/Campari/vermouth) is balanced, not "gin-forward" — so this only fires
// when one candidate holds a clear majority of the combined spirit volume,
// which a tie (or a 3-way even split) never reaches.
const DOMINANT_SHARE_THRESHOLD = 0.5;

function detectDominantSpiritTag(specs) {
  const candidates = [];
  let totalOz = 0;
  for (const spec of specs || []) {
    if (!spec?.name?.trim()) continue;
    const item = findIngredient(spec.name);
    if (!item || !BASE_SPIRIT_FAMILY_TAGS[item.family]) continue;
    const oz = normalizeVolumeToOz(spec.amount, spec.unit);
    if (oz <= 0) continue;
    candidates.push({ item, oz });
    totalOz += oz;
  }
  if (candidates.length === 0 || totalOz <= 0) return null;

  const best = candidates.reduce((a, b) => (b.oz > a.oz ? b : a));
  if (best.oz / totalOz <= DOMINANT_SHARE_THRESHOLD) return null;

  return SPIRIT_ID_OVERRIDES[best.item.id] || BASE_SPIRIT_FAMILY_TAGS[best.item.family];
}

// Ingredient families whose mere presence (any amount) is a reliable signal
// for a descriptive tag — these aren't about which one dominates the drink,
// just whether the character is there at all.
const FAMILY_PRESENCE_TAGS = [
  ['citrus_juice', 'citrus-forward'],
  ['floral_liqueur', 'floral'],
  ['fruit_juice', 'fruity'],
  ['fruit_liqueur', 'fruity'],
  ['soda', 'sparkling'],
  ['sparkling_wine', 'sparkling'],
  ['savory', 'savory'],
  ['brine', 'savory'],
];

function detectIngredientPresenceTags(specs) {
  const found = new Set();
  for (const spec of specs || []) {
    if (!spec?.name?.trim()) continue;
    const item = findIngredient(spec.name);
    if (!item) continue;
    for (const [family, tag] of FAMILY_PRESENCE_TAGS) {
      if (item.family === family) found.add(tag);
    }
    if (item.family === 'dairy') found.add('creamy');
  }
  return Array.from(found);
}

// calculateBalanceProfile's scores are already rescaled against the seed
// corpus so that ~55+ reliably reads as "this axis is a real part of the
// drink's character," not just present in trace amounts.
const FLAVOR_TAG_THRESHOLD = 55;

function detectFlavorTags(specs) {
  const profile = calculateBalanceProfile(specs);
  return [
    ['herbal', 'herbal'],
    ['sweet', 'sweet'],
    ['sour', 'sour'],
    ['bitter', 'bitter'],
  ]
    .filter(([axis]) => (profile[axis] || 0) >= FLAVOR_TAG_THRESHOLD)
    .sort((a, b) => profile[b[0]] - profile[a[0]])
    .map(([, tag]) => tag);
}

function detectAbvTag(specs, method) {
  const { estimatedAbv } = calculateCocktailAbv(specs, method);
  if (estimatedAbv <= 0) return null;
  if (estimatedAbv < 10) return 'low-abv';
  // High-proof and built/stirred (not shaken with juice) matches how
  // "slow-sipper" is already used across the seed library: strong,
  // all-spirits drinks meant to be nursed, not gulped.
  if (estimatedAbv >= 28 && (method === 'Stirred' || method === 'Built')) return 'slow-sipper';
  return null;
}

/**
 * Suggests a small, capped set of tags from a recipe's ingredients, computed
 * flavor balance, and ABV. Always additive (the caller should only use this to
 * add tags, never remove existing ones) and ordered most-defining-first:
 * dominant spirit, then flavor character, then other ingredient signals, then
 * strength — so if the cap trims the list, what's cut is the least specific.
 */
export function detectTagsFromRecipe(specs, method) {
  const tags = [];
  const spiritTag = detectDominantSpiritTag(specs);
  if (spiritTag) tags.push(spiritTag);
  tags.push(...detectFlavorTags(specs));
  tags.push(...detectIngredientPresenceTags(specs));
  const abvTag = detectAbvTag(specs, method);
  if (abvTag) tags.push(abvTag);
  return Array.from(new Set(tags)).slice(0, 5);
}
