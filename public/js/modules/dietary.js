/**
 * Speakeasy dietary flags
 * What a recipe contains that some guests avoid: egg, dairy, tree nuts, honey.
 * Flags are read from the ingredient (and garnish) text rather than the
 * taxonomy on purpose. The taxonomy resolves names loosely so it can suggest
 * substitutes ("oat milk" lands on whole milk, "almond milk" too), and a
 * dietary flag can't afford that: it has to know oat milk is not dairy and
 * almond milk is a nut.
 *
 * The wording is deliberately one-sided: a drink is shown as containing (or
 * possibly containing) something, never as "free of" it.
 *
 * A host can correct any flag for a drink on their own menu (their falernum has
 * no almond, their orgeat is nut-free). That correction travels with the
 * published drink as `recipe.diet`:
 *   { egg?: 'contains'|'may'|'none', dairy?: …, nuts?: …, honey?: …, swap?: true, foamer?: true }
 * where `swap` means the host will make the drink egg-free on request, and
 * `foamer` means the drink is made with cocktail foamer instead of egg white (so
 * it isn't an egg drink at all). A bartender who never uses egg white sets that
 * once for the whole bar (see applyBarDiet) rather than drink by drink.
 */

export const DIET_FLAGS = [
  { key: 'egg', label: 'Egg' },
  { key: 'dairy', label: 'Dairy' },
  { key: 'nuts', label: 'Tree nuts' },
  { key: 'honey', label: 'Honey' },
];

export const DIET_KEYS = DIET_FLAGS.map(f => f.key);
export const DIET_LEVELS = ['contains', 'may', 'none'];

// A plant "milk" or "cream" is neither dairy nor safe to lump in with it:
// almond, cashew and macadamia are tree nuts.
const PLANT_MILK = /\b(oat|almond|coconut|soy|soya|rice|cashew|hemp|pea|macadamia|hazelnut|pistachio)\s+(milk|cream|creamer)\b|\bcream of coconut\b|\bcoconut cream\b/;
// Flavored bitters ("orange cream citrate") carry cream in the name, not in the bottle.
const NOT_DAIRY = /\bbitters\b|\bcream (soda|sherry|of tartar)\b|\b(peanut|almond|cashew|cocoa|shea|apple) butter\b|\bcocoa butter\b|\bbutterfly\b|\bbutterscotch\b/;

const DAIRY = /\b(cream|milk|buttermilk|butter|half (and|&) half|yogh?urt|kefir|ghee|whey|creme fraiche|ice cream|baileys)\b|\bhalf-and-half\b|\beggnog\b/;
const EGG = /\beggs?\b|\beggnog\b|\byolks?\b|\balbumen\b|\bmeringue\b/;
const NUTS = /\b(almonds?|orgeat|amaretto|disaronno|hazelnuts?|frangelico|walnuts?|nocino|pecans?|pistachios?|cashews?|macadamias?|pralines?|marzipan|brazil nuts?)\b/;
const NUTS_MAYBE = /\bfalernum\b/;
const HONEY = /\bhoney\b|\bdrambuie\b|\bmead\b|\bbarenjager\b|\bbärenjäger\b/;

function textOf(spec) {
  return String(typeof spec === 'string' ? spec : spec?.name || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * The flags read straight from a recipe's ingredients and garnish.
 * @returns {{ contains: string[], may: string[] }} keys from DIET_KEYS, in DIET_KEYS order
 */
export function detectDiet(recipe) {
  const names = (Array.isArray(recipe?.specs) ? recipe.specs : []).map(textOf);
  if (recipe?.garnish) names.push(textOf(recipe.garnish));

  const found = { egg: false, dairy: false, nuts: false, honey: false };
  const maybe = { nuts: false };
  for (const name of names) {
    if (!name) continue;
    const plant = PLANT_MILK.test(name);
    if (EGG.test(name)) found.egg = true;
    if (!plant && !NOT_DAIRY.test(name) && DAIRY.test(name)) found.dairy = true;
    // "Eggnog" is both an egg and a dairy product; the DAIRY pattern covers it too.
    if (NUTS.test(name) || (plant && /almond|cashew|macadamia|hazelnut|pistachio/.test(name))) found.nuts = true;
    if (NUTS_MAYBE.test(name)) maybe.nuts = true;
    if (HONEY.test(name)) found.honey = true;
  }
  return {
    contains: DIET_KEYS.filter(k => found[k]),
    may: DIET_KEYS.filter(k => !found[k] && maybe[k]),
  };
}

/** Detected flags with the host's corrections for this drink applied. */
export function dietFor(recipe) {
  const auto = detectDiet(recipe);
  const override = recipe?.diet && typeof recipe.diet === 'object' ? recipe.diet : {};
  const contains = [];
  const may = [];
  for (const key of DIET_KEYS) {
    const level = DIET_LEVELS.includes(override[key])
      ? override[key]
      : key === 'egg' && usesFoamer(recipe) ? 'none'
        : auto.contains.includes(key) ? 'contains' : auto.may.includes(key) ? 'may' : 'none';
    if (level === 'contains') contains.push(key);
    else if (level === 'may') may.push(key);
  }
  return { contains, may };
}

// Cocktail foamer stands in for egg *white*. A whole egg, a yolk, or eggnog has no
// such stand-in, so those drinks stay egg drinks whatever the bar's habit.
const EGG_WHITE = /\begg whites?\b|\balbumen\b/;

function eggIsWhiteOnly(recipe) {
  const eggNames = (Array.isArray(recipe?.specs) ? recipe.specs : []).map(textOf).filter(name => EGG.test(name));
  return eggNames.length > 0 && eggNames.every(name => EGG_WHITE.test(name));
}

/** True when this drink is made with cocktail foamer in place of its egg white. */
export function usesFoamer(recipe) {
  return recipe?.diet?.foamer === true
    && !DIET_LEVELS.includes(recipe.diet.egg)
    && eggIsWhiteOnly(recipe);
}

/**
 * The bar-wide habit: a bartender who makes egg-white drinks with cocktail
 * foamer never serves egg, so those drinks are marked as made with foamer. A
 * drink the host has explicitly corrected for egg keeps their answer.
 */
export function applyBarDiet(recipe, foamerForEgg) {
  if (!foamerForEgg || recipe?.diet?.foamer || DIET_LEVELS.includes(recipe?.diet?.egg) || !eggIsWhiteOnly(recipe)) return recipe;
  return { ...recipe, diet: { ...(recipe.diet || {}), foamer: true } };
}

/** True when the host will make this drink without egg on request. */
export function hasEggSwap(recipe) {
  return Boolean(recipe?.diet?.swap) && dietFor(recipe).contains.includes('egg');
}

export function flagLabel(key) {
  return DIET_FLAGS.find(f => f.key === key)?.label || key;
}

/** "egg, dairy" / "tree nuts": lowercase, for running text. */
export function flagList(keys) {
  return keys.map(k => flagLabel(k).toLowerCase()).join(', ');
}

/** Which flags appear anywhere on a menu (contains or may), so the filter only offers what matters. */
export function flagsOnMenu(recipes) {
  const present = new Set();
  for (const recipe of recipes || []) {
    const { contains, may } = dietFor(recipe);
    contains.forEach(k => present.add(k));
    may.forEach(k => present.add(k));
  }
  return DIET_KEYS.filter(k => present.has(k));
}

/**
 * Does this drink clash with what the guest avoids? "May contain" counts, so
 * someone avoiding nuts doesn't get a maybe. The one exception is an egg drink
 * the host will make egg-free: it stays on the list.
 */
export function clashesWith(recipe, avoid) {
  if (!avoid || avoid.size === 0) return false;
  const { contains, may } = dietFor(recipe);
  const swap = hasEggSwap(recipe);
  return [...contains, ...may].some(key => avoid.has(key) && !(key === 'egg' && swap));
}

/** A drink that is on the menu for an egg-avoiding guest only because of the swap. */
export function needsEggSwap(recipe, avoid) {
  return Boolean(avoid?.has('egg')) && hasEggSwap(recipe);
}

/**
 * What to hand the bartender: the same drink, named the way it should be made.
 * An egg-avoiding guest ordering an egg drink asks for it egg-free.
 */
export function orderedAs(recipe, avoid) {
  return needsEggSwap(recipe, avoid) ? { ...recipe, name: `${recipe.name} (egg-free)` } : recipe;
}

// ---- The guest's own "avoid" choice -----------------------------------------
// One list for every menu on this device: an allergy doesn't change by party.
const AVOID_KEY = 'speakeasy_guest_avoid';
// The bartender's own library filter is kept apart from the guest one: the same
// phone can be both, and hiding drinks from your own library shouldn't follow you
// into a guest's menu (or the other way around).
export const LIBRARY_AVOID_KEY = 'speakeasy_library_avoid';

export function loadAvoid(key = AVOID_KEY) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || '[]');
    return new Set(Array.isArray(parsed) ? parsed.filter(k => DIET_KEYS.includes(k)) : []);
  } catch {
    return new Set();
  }
}

export function saveAvoid(avoid, key = AVOID_KEY) {
  try {
    if (avoid.size === 0) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(DIET_KEYS.filter(k => avoid.has(k))));
  } catch {
    // Not remembered in private mode; the filter still works for this visit.
  }
}

/**
 * Cleans a host correction to the allowed shape. Returns null when there's
 * nothing to keep, so an empty override is never stored or sent.
 */
export function sanitizeDietOverride(value) {
  if (!value || typeof value !== 'object') return null;
  const clean = {};
  for (const key of DIET_KEYS) {
    if (DIET_LEVELS.includes(value[key])) clean[key] = value[key];
  }
  if (value.swap === true) clean.swap = true;
  if (value.foamer === true) clean.foamer = true;
  return Object.keys(clean).length > 0 ? clean : null;
}

/** Overrides for many drinks at once: { drinkId: override }, dropping empty ones. */
export function sanitizeDietOverrides(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const clean = {};
  for (const [id, override] of Object.entries(value)) {
    const cleaned = sanitizeDietOverride(override);
    if (cleaned) clean[String(id)] = cleaned;
  }
  return clean;
}
