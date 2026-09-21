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
  [/\b(?:mug|hot toddy(?: glass)?|irish coffee(?: glass)?)\b/i, 'Mug'],
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
// corpus, so each axis needs its own bar for "a real part of the drink's
// character." These were tuned against the curated tags on the bundled library
// (see tests/auto-detect-test.js): a tag that fires on most drinks tells a user
// nothing, so `sweet` (fired on ~60% of recipes) and the old plain `bitter`
// (~22%, against 4% curated) were retired. `bittersweet` at a high bar is the
// bitter signal that actually tracks how the library uses the word.
const FLAVOR_TAG_RULES = [
  { axis: 'herbal', tag: 'herbal', min: 55 },
  { axis: 'sour', tag: 'sour', min: 55 },
  { axis: 'bitter', tag: 'bittersweet', min: 60 },
];

function detectFlavorTags(specs) {
  const profile = calculateBalanceProfile(specs);
  return FLAVOR_TAG_RULES
    .filter(({ axis, min }) => (profile[axis] || 0) >= min)
    .sort((a, b) => profile[b.axis] - profile[a.axis])
    .map(({ tag }) => tag);
}

// Citrus is in most sours, so mere presence says nothing; "citrus-forward"
// should mean citrus is a large part of what's in the glass.
const CITRUS_FORWARD_MIN_SHARE = 0.3;

function detectCitrusForwardTag(specs) {
  let citrusOz = 0;
  let totalOz = 0;
  for (const spec of specs || []) {
    if (!spec?.name?.trim()) continue;
    const oz = normalizeVolumeToOz(spec.amount, spec.unit);
    if (oz <= 0) continue;
    totalOz += oz;
    if (findIngredient(spec.name)?.family === 'citrus_juice') citrusOz += oz;
  }
  return totalOz > 0 && citrusOz / totalOz >= CITRUS_FORWARD_MIN_SHARE ? 'citrus-forward' : null;
}

function detectAbvTag(specs, method) {
  const { estimatedAbv } = calculateCocktailAbv(specs, method);
  if (estimatedAbv <= 0) return null;
  if (estimatedAbv < 10) return 'low-abv';
  // High-proof and built/stirred (not shaken with juice) matches how
  // "slow-sipper" is already used across the seed library: strong,
  // all-spirits drinks meant to be nursed, not gulped.
  if (estimatedAbv >= 26 && (method === 'Stirred' || method === 'Built')) return 'slow-sipper';
  return null;
}

const HOT_INGREDIENT_PATTERN = /\b(boiling water|hot water|hot coffee|hot tea|hot cider|steaming water)\b/i;

// Ingredient IDs that reliably signal smokiness regardless of their broader
// family classification. Peated scotch is still family:whiskey (correct), but
// that family tag doesn't tell us it's smoky — so we check IDs explicitly.
const SMOKY_INGREDIENT_IDS = new Set(['peated_scotch', 'mezcal']);

/**
 * Returns 'smoky' if any ingredient resolves to a known smoky spirit (peated
 * scotch or mezcal). Smoke is a defining character cue, not a flavor-axis
 * score, so ingredient identity is the right signal.
 */
function detectSmokyTag(specs) {
  for (const spec of specs || []) {
    if (!spec?.name?.trim()) continue;
    const item = findIngredient(spec.name);
    if (item && SMOKY_INGREDIENT_IDS.has(item.id)) return 'smoky';
  }
  return null;
}

// Ingredient IDs that signal heat/spice regardless of volume. These are
// typically minor additions that still define the drink's character.
const SPICY_INGREDIENT_IDS = new Set(['hot_sauce', 'jalapeno']);

/**
 * Returns 'spicy' if any spice-forward ingredient is present. Using ID-level
 * matching so this fires for jalapeño slices, hot sauce, etc. regardless of
 * how the name was typed (aliases resolve to the canonical ID).
 */
function detectSpicyTag(specs) {
  for (const spec of specs || []) {
    if (!spec?.name?.trim()) continue;
    const item = findIngredient(spec.name);
    if (item && SPICY_INGREDIENT_IDS.has(item.id)) return 'spicy';
  }
  return null;
}

// A recipe qualifies as split-base when two or more distinct spirit families
// each contribute at least this share of the total base-spirit volume.
const SPLIT_BASE_MIN_SHARE = 0.35;

// Only true base spirits count. Vermouth, sherry, wine, and amaro are
// modifiers even at equal volume: a Negroni is not a "split base."
const SPLIT_BASE_FAMILIES = new Set([
  'whiskey', 'gin', 'rum', 'tequila', 'neutral_spirits', 'brandy', 'cane_spirits', 'agave_spirits',
]);

/**
 * Returns 'split-base' when two or more distinct spirit families each hold at
 * least 25% of the combined spirit volume. A float of 0.5 oz Islay on a 2 oz
 * scotch base does NOT qualify — only recipes where two bases genuinely share
 * the load (e.g. mezcal + rye, rum + rye, gin + apple brandy) will fire.
 */
function detectSplitBaseTag(specs) {
  const familyVolumes = {};
  let totalOz = 0;

  for (const spec of specs || []) {
    if (!spec?.name?.trim()) continue;
    const item = findIngredient(spec.name);
    if (!item || !SPLIT_BASE_FAMILIES.has(item.family)) continue;
    const oz = normalizeVolumeToOz(spec.amount, spec.unit);
    if (oz <= 0) continue;
    familyVolumes[item.family] = (familyVolumes[item.family] || 0) + oz;
    totalOz += oz;
  }

  if (totalOz <= 0) return null;

  const qualifyingFamilies = Object.values(familyVolumes).filter(
    vol => vol / totalOz >= SPLIT_BASE_MIN_SHARE
  );
  return qualifyingFamilies.length >= 2 ? 'split-base' : null;
}

// Ingredient-name signals for tags with no dedicated taxonomy family. Matching
// on the typed name (not a resolved id) is deliberate: "orgeat", "falernum",
// and "espresso" are exactly how these drinks get written, and each pattern was
// measured for precision against the curated tags on the bundled library.
const TROPICAL_PATTERN = /pineapple|coconut|passion|orgeat|falernum|guava|mango|banana|papaya|allspice dram/i;
const COFFEE_PATTERN = /espresso|coffee|kahl[uú]a|mr\.? black/i;
const EGG_PATTERN = /egg white|aquafaba|whole egg|\begg\b/i;
const SPICE_PATTERN = /allspice|cinnamon|clove|cardamom|nutmeg|spiced rum|pimento|falernum|\bdram\b/i;
const BUBBLY_PATTERN = /soda water|club soda|tonic|ginger beer|ginger ale|prosecco|champagne|sparkling|cava|\bcola\b/i;
const CREAMY_PATTERN = /cream|milk|half.?and.?half/i;

// A drink is "refreshing" when it's long and/or bubbly and not rich or very
// strong. Deliberately generous on classics like a French 75 or Aperol Spritz,
// which the curated library under-tags.
const REFRESHING_MAX_ABV = 22;

function specNamesMatch(specs, pattern) {
  return (specs || []).some(spec => spec?.name && pattern.test(spec.name));
}

function detectNameSignalTags(specs, { glassware } = {}) {
  const tags = [];
  const isLongGlass = /highball|collins/i.test(glassware || '');
  const isMug = /mug/i.test(glassware || '');

  if (isLongGlass) tags.push('highball');
  if (isMug || specNamesMatch(specs, TROPICAL_PATTERN)) {
    // A mug alone is only tropical if it isn't a hot drink (those get 'hot').
    if (specNamesMatch(specs, TROPICAL_PATTERN) || /tiki/i.test(glassware || '')) tags.push('tropical-tiki');
  }
  if (specNamesMatch(specs, COFFEE_PATTERN)) tags.push('coffee');
  if (specNamesMatch(specs, EGG_PATTERN)) tags.push('silky');
  if (specNamesMatch(specs, SPICE_PATTERN)) tags.push('spiced');
  return tags;
}

function detectRefreshingTag(specs, method, { glassware } = {}) {
  if (/mug/i.test(glassware || '')) return null;
  const isLongOrBubbly = /highball|collins/i.test(glassware || '') || specNamesMatch(specs, BUBBLY_PATTERN);
  if (!isLongOrBubbly || specNamesMatch(specs, CREAMY_PATTERN)) return null;
  const { estimatedAbv } = calculateCocktailAbv(specs, method);
  return estimatedAbv <= REFRESHING_MAX_ABV ? 'refreshing' : null;
}

// Tags are capped because "more tags" is not "a better experience": each one
// is a thing a user has to read and a filter that has to mean something.
const MAX_AUTO_TAGS = 6;

/**
 * Suggests a small, capped set of tags from a recipe's ingredients, computed
 * flavor balance, and ABV. Always additive (the caller should only use this to
 * add tags, never remove existing ones) and ordered most-defining-first so
 * that if the cap trims the list, what's cut is the least specific:
 *
 *   1. dominant spirit          (what it's made of)
 *   2. structure                (highball, tropical, hot)
 *   3. character                (refreshing, bittersweet, herbal, sour, …)
 *   4. strength and structure   (slow-sipper, low-abv, split-base)
 *
 * Rules are tuned against the curated tags on the bundled library; see
 * tests/auto-detect-test.js for the measured precision/recall floors.
 */
export function detectTagsFromRecipe(specs, method, extraContext = {}) {
  const tags = [];
  const spiritTag = detectDominantSpiritTag(specs);
  if (spiritTag) tags.push(spiritTag);

  const nameSignals = detectNameSignalTags(specs, extraContext);
  const structural = nameSignals.filter(t => t === 'highball' || t === 'tropical-tiki');
  tags.push(...structural);

  // Detect hot beverage tag from ingredients or context
  const hasHotIngredient = (specs || []).some(s => HOT_INGREDIENT_PATTERN.test(s?.name || ''));
  const isMugGlassware = extraContext.glassware === 'Mug';
  const hasHotNameOrDirections = /\b(hot toddy|hot buttered|boiling water|steaming water)\b/i.test(`${extraContext.name || ''} ${extraContext.instructions || ''}`);
  if (hasHotIngredient || isMugGlassware || hasHotNameOrDirections) {
    tags.push('hot');
  }

  const refreshingTag = detectRefreshingTag(specs, method, extraContext);
  if (refreshingTag) tags.push(refreshingTag);

  tags.push(...detectFlavorTags(specs));
  const citrusTag = detectCitrusForwardTag(specs);
  if (citrusTag) tags.push(citrusTag);
  tags.push(...detectIngredientPresenceTags(specs));
  tags.push(...nameSignals.filter(t => !structural.includes(t)));

  const smokyTag = detectSmokyTag(specs);
  if (smokyTag) tags.push(smokyTag);

  const spicyTag = detectSpicyTag(specs);
  if (spicyTag) tags.push(spicyTag);

  const abvTag = detectAbvTag(specs, method);
  if (abvTag) tags.push(abvTag);

  const splitBaseTag = detectSplitBaseTag(specs);
  if (splitBaseTag) tags.push(splitBaseTag);

  return Array.from(new Set(tags)).slice(0, MAX_AUTO_TAGS);
}
