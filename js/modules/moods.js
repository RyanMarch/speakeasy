/**
 * Speakeasy Moods
 * A small guest-facing vocabulary ("Bright & refreshing", "Bittersweet"…)
 * layered over the tags and computed flavor data recipes already carry, so
 * mood chips and the pick-a-drink quiz need no new per-recipe tags.
 *
 * A recipe belongs to a mood when it carries one of the mood's tags or clears
 * one of its computed-data thresholds. The thresholds matter for custom
 * recipes, which only get auto-detected tags (see auto-detect.js) and none of
 * the curated ones like `refreshing`. Every rule was measured against the
 * bundled library; tests/moods-test.js keeps that coverage from drifting.
 */

import { calculateBalanceProfile } from './balance.js';
import { calculateCocktailAbv } from './abv.js';

/**
 * `tags`: any one is enough. `matches(profile, abv, tagSet)`: an extra
 * data-driven path. `blurb` is the plain-language line shown to guests.
 */
export const MOODS = [
  {
    key: 'refreshing',
    label: 'Bright & refreshing',
    blurb: 'Crisp, cooling, easy to sip on a warm night.',
    tags: ['refreshing', 'crisp', 'highball', 'summer'],
    matches: (p, abv) => p.sour >= 75 && abv <= 17 && p.bitter < 25,
  },
  {
    key: 'tart',
    label: 'Tart & citrusy',
    blurb: 'Lemon, lime, and a little pucker.',
    tags: ['sour', 'citrus-forward'],
  },
  {
    key: 'fruity',
    label: 'Fruity & tropical',
    blurb: 'Juicy, colorful, vacation-in-a-glass.',
    tags: ['fruity', 'tropical-tiki'],
  },
  {
    key: 'rich',
    label: 'Rich & cozy',
    blurb: 'Sweet, smooth, and a bit indulgent.',
    tags: ['creamy', 'dessert', 'coffee', 'silky', 'nutty', 'hot', 'comforting', 'autumn', 'winter'],
    matches: (p, abv, tags) => tags.has('sweet') && p.sweet >= 70,
  },
  {
    key: 'bittersweet',
    label: 'Bittersweet',
    blurb: 'Amaro and aperitivo character: bitter, orangey, grown-up.',
    tags: ['bittersweet', 'bitter', 'aperitivo-amaro', 'amaro-forward'],
    matches: (p) => p.bitter >= 50,
  },
  {
    key: 'herbal',
    label: 'Herbal & botanical',
    blurb: 'Gin, vermouth, chartreuse: garden-y and layered.',
    tags: ['herbal', 'floral', 'savory'],
    matches: (p) => p.herbal >= 70,
  },
  {
    key: 'smoky',
    label: 'Smoky & spicy',
    blurb: 'Mezcal, peat, ginger, and heat.',
    tags: ['smoky', 'spicy', 'spiced'],
  },
  {
    key: 'strong',
    label: 'Strong & spirit-forward',
    blurb: 'Mostly liquor, stirred cold. For sipping.',
    tags: ['spirit-forward', 'potent', 'slow-sipper'],
    matches: (p, abv) => abv >= 27,
  },
  {
    key: 'light',
    label: 'Light & low-alcohol',
    blurb: 'Gentle on the head. Good for a long evening.',
    tags: ['low-abv', 'easy', 'sparkling', 'brunch'],
    matches: (p, abv) => abv <= 12,
  },
];

/**
 * The mood keys a recipe belongs to, in MOODS order. Uses the recipe's own
 * tags plus the computed flavor profile and ABV, so it works for custom
 * recipes as well as bundled ones.
 */
export function getRecipeMoods(recipe) {
  const traits = computeRecipeTraits(recipe);
  return traits ? moodsFromTraits(traits) : [];
}

/**
 * The computed facts about a recipe that moods (and the quiz) are decided
 * from: its tags, flavor profile, and estimated ABV. Null for a recipe with no
 * ingredients: without that guard an empty draft reads as 0% ABV and would
 * land in "Light & low-alcohol".
 */
export function computeRecipeTraits(recipe) {
  const specs = recipe?.specs || [];
  if (specs.length === 0) return null;
  return {
    tags: new Set(recipe?.tags || []),
    profile: calculateBalanceProfile(specs),
    abv: Math.round(calculateCocktailAbv(specs, recipe?.method).estimatedAbv),
  };
}

export function moodsFromTraits({ tags, profile, abv }) {
  return MOODS
    .filter(mood => mood.tags.some(t => tags.has(t)) || (mood.matches && mood.matches(profile, abv, tags)))
    .map(mood => mood.key);
}

/**
 * For a menu (or any recipe list): the moods that have at least one recipe,
 * in MOODS order, each with its recipe count, plus a recipe-id -> mood-keys
 * map. Empty moods are left out so a guest never taps a chip that shows nothing.
 */
export function summarizeMoods(recipes) {
  const byRecipe = new Map();
  const counts = new Map();
  for (const recipe of recipes || []) {
    const keys = getRecipeMoods(recipe);
    byRecipe.set(recipe.id, keys);
    keys.forEach(key => counts.set(key, (counts.get(key) || 0) + 1));
  }
  const moods = MOODS
    .filter(mood => counts.has(mood.key))
    .map(mood => ({ key: mood.key, label: mood.label, blurb: mood.blurb, count: counts.get(mood.key) }));
  return { moods, byRecipe };
}
