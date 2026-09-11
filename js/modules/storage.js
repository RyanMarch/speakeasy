/**
 * Speakeasy Local Storage & Portability Module
 * Handles local persistence, JSON export, and JSON import.
 */

const STORAGE_KEY = 'speakeasy_recipes';

// Canonical renames for tags that have accumulated redundant variants over time
// (e.g. singular/plural drift, or a freeform descriptor superseded by a themed pack tag).
const TAG_RENAMES = {
  'modern-classic': 'modern-craft',
  'modern-classics': 'modern-craft',
  'essential-classic': 'classic',
  'essential-classics': 'classic',
  'nightcap': 'nightcaps',
  'tiki': 'tropical-tiki',
  'tropical': 'tropical-tiki',
  'effervescent': 'sparkling',
};

// Tags dropped outright because they're redundant with another tag/pack and add
// no distinguishing information (e.g. "aperitivo" duplicating the "aperitivo-amaro" pack).
const TAG_REMOVALS = new Set(['aperitivo']);

// Tags kept on their recipes (they carry real editorial meaning) but hidden from the
// "add tag" suggestion list because they're too niche/curatorial for general reuse
// (e.g. "ancestor" marks a specific proto-cocktail, not a reusable descriptor).
const SUGGESTION_EXCLUDED_TAGS = new Set(['ancestor']);

/**
 * Normalize a raw tag string: lowercase, strip leading #, apply canonical renames.
 * Returns '' if the tag is empty or has been retired outright (see TAG_REMOVALS).
 */
export function normalizeTagName(rawTag) {
  const clean = String(rawTag || '').trim().toLowerCase().replace(/^#+/, '');
  if (!clean || TAG_REMOVALS.has(clean)) return '';
  return TAG_RENAMES[clean] || clean;
}

import { SEED_RECIPES } from "../data/seed-recipes.js";
export { SEED_RECIPES };

// ==========================================
// Hidden Recipes Persistence
// ==========================================
const HIDDEN_RECIPES_STORAGE_KEY = 'speakeasy_hidden_recipes';

export function getHiddenRecipeIds() {
  try {
    const raw = localStorage.getItem(HIDDEN_RECIPES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(id => typeof id === 'string') : [];
  } catch (err) {
    console.error('Failed to read hidden recipes from localStorage:', err);
    return [];
  }
}

export function saveHiddenRecipeIds(ids) {
  try {
    const clean = Array.from(new Set((ids || []).filter(id => typeof id === 'string')));
    localStorage.setItem(HIDDEN_RECIPES_STORAGE_KEY, JSON.stringify(clean));
    return clean;
  } catch (err) {
    console.error('Failed to save hidden recipes to localStorage:', err);
    return ids;
  }
}

export function isRecipeHidden(id) {
  if (!id) return false;
  return getHiddenRecipeIds().includes(id);
}

export function hideRecipe(id) {
  if (!id) return getHiddenRecipeIds();
  const current = getHiddenRecipeIds();
  if (!current.includes(id)) {
    current.push(id);
    saveHiddenRecipeIds(current);
  }
  return current;
}

export function unhideRecipe(id) {
  if (!id) return getHiddenRecipeIds();
  const current = getHiddenRecipeIds().filter(hId => hId !== id);
  saveHiddenRecipeIds(current);
  return current;
}

export function unhideAllRecipes() {
  saveHiddenRecipeIds([]);
  return [];
}

export function getRecipes() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_RECIPES));
      return SEED_RECIPES;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      let updatedStorage = false;
      const hiddenIds = new Set(getHiddenRecipeIds());

      // Automatically backfill any canonical seed recipes missing from stored list,
      // UNLESS the user explicitly hid them.
      SEED_RECIPES.forEach(seedRecipe => {
        const exists = parsed.some(r => r.id === seedRecipe.id);
        if (!exists && !hiddenIds.has(seedRecipe.id)) {
          parsed.push({ ...seedRecipe });
          updatedStorage = true;
        }
      });

      parsed.forEach(r => {
        const seed = SEED_RECIPES.find(s => s.id === r.id);
        if (seed) {
          // Clear duplicate notes on recipes that now have dedicated step instructions
          if ((r.id === 'old-fashioned' || r.id === 'negroni') && r.notes) {
            r.notes = '';
            updatedStorage = true;
          }
          // Fix legacy errant specs for Pimm's No. 1 Cup
          if (r.id === 'pimms-cup' && Array.isArray(r.specs)) {
            const redBitter = r.specs.find(s => s.name === 'Red Bitter');
            if (redBitter) {
              redBitter.name = "Pimm's No. 1";
              updatedStorage = true;
            }
          }
          // Update Shoulder Season to Tuxedo No. 2 specs if stored under the earlier draft
          if (r.id === 'shoulder-season' && r.source !== 'Tuxedo No. 2') {
            Object.assign(r, { ...seed });
            updatedStorage = true;
          }
          // Backfill all properties from seed that might be missing in older stored versions
          Object.keys(seed).forEach(key => {
            if (r[key] === undefined || r[key] === null || r[key] === '') {
              r[key] = Array.isArray(seed[key]) ? [...seed[key]] : seed[key];
              updatedStorage = true;
            } else if (Array.isArray(seed[key]) && (!Array.isArray(r[key]) || r[key].length === 0)) {
              r[key] = [...seed[key]];
              updatedStorage = true;
            }
          });
          // Merge pack tags into existing stored tags if missing
          if (Array.isArray(seed.tags) && Array.isArray(r.tags)) {
            seed.tags.forEach(t => {
              if (!r.tags.includes(t)) {
                r.tags.push(t);
                updatedStorage = true;
              }
            });
          }
        } else if (!Array.isArray(r.tags)) {
          r.tags = [];
          updatedStorage = true;
        }

        // Clean up redundant/retired tags so drinks don't accumulate overlapping
        // variants like "modern-classic" vs "modern-craft", or "nightcap" vs "nightcaps".
        if (Array.isArray(r.tags)) {
          const originalTagStr = JSON.stringify(r.tags);
          const normalizedTags = [];
          const seen = new Set();

          r.tags.forEach(rawTag => {
            const canonical = normalizeTagName(rawTag);
            if (!canonical) return;

            if (!seen.has(canonical)) {
              seen.add(canonical);
              normalizedTags.push(canonical);
            }
          });

          if (JSON.stringify(normalizedTags) !== originalTagStr) {
            r.tags = normalizedTags;
            updatedStorage = true;
          }
        }
      });

      // Migrate legacy random IDs (rec_... / recipe-...) to clean, consistent slugs
      const existingIds = new Set(parsed.map(r => r.id));
      parsed.forEach(r => {
        if (r.id && (r.id.startsWith('rec_') || r.id.startsWith('recipe-'))) {
          existingIds.delete(r.id);
          const newSlug = slugifyRecipeName(r.name, existingIds);
          existingIds.add(newSlug);

          if (typeof window !== 'undefined' && window.location && window.location.hash === `#${r.id}`) {
            history.replaceState(null, '', `#${newSlug}`);
          }
          if (typeof localStorage !== 'undefined') {
            try {
              const lastActive = localStorage.getItem('speakeasy_last_active_recipe');
              if (lastActive === r.id) {
                localStorage.setItem('speakeasy_last_active_recipe', newSlug);
              }
            } catch {
              // Ignore
            }
          }
          r.id = newSlug;
          updatedStorage = true;
        }
      });

      if (updatedStorage) {
        saveRecipes(parsed);
      }
      return parsed.filter(r => !hiddenIds.has(r.id));
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_RECIPES));
    const hiddenIds = new Set(getHiddenRecipeIds());
    return SEED_RECIPES.filter(r => !hiddenIds.has(r.id));
  } catch (err) {
    console.error('Failed to read recipes from localStorage:', err);
    const hiddenIds = new Set(getHiddenRecipeIds());
    return SEED_RECIPES.filter(r => !hiddenIds.has(r.id));
  }
}

/**
 * Creates a clean, URL-safe slug from a cocktail name (e.g. "Scotch Old Fashioned" -> "scotch-old-fashioned")
 */
export function slugifyRecipeName(name, existingIds = new Set()) {
  const base = String(name || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    || 'cocktail';

  let slug = base;
  let counter = 2;
  while (existingIds.has(slug)) {
    slug = `${base}-${counter}`;
    counter++;
  }
  return slug;
}

export function saveRecipes(recipes) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(recipes));
  } catch (err) {
    console.error('Failed to save recipes to localStorage:', err);
  }
}

export function saveRecipe(recipe) {
  const recipes = getRecipes();
  const existingIds = new Set(recipes.map(r => r.id));
  if (recipe.id) {
    existingIds.delete(recipe.id);
  }
  const id = recipe.id || slugifyRecipeName(recipe.name, existingIds);
  const tags = Array.isArray(recipe.tags)
    ? Array.from(new Set(recipe.tags.map(t => String(t).trim().toLowerCase()).filter(Boolean)))
    : [];
  const updatedRecipe = { ...recipe, id, tags };

  const existingIndex = recipes.findIndex(r => r.id === id);
  let updatedList;
  if (existingIndex >= 0) {
    updatedList = [...recipes];
    updatedList[existingIndex] = updatedRecipe;
  } else {
    updatedList = [updatedRecipe, ...recipes];
  }

  saveRecipes(updatedList);
  return updatedRecipe;
}

export function deleteRecipe(id) {
  const recipes = getRecipes();
  const filtered = recipes.filter(r => r.id !== id);
  saveRecipes(filtered);
  return filtered;
}

const BACKUP_SCHEMA_VERSION = 1;

// Fields compared to decide whether a stored recipe still matches its canonical
// seed spec (unmodified seeds are excluded from backups since they're already
// available at import time via SEED_RECIPES).
const SEED_COMPARISON_FIELDS = [
  'name', 'glassware', 'method', 'garnish', 'description',
  'instructions', 'source', 'sourceUrl', 'notes', 'tags', 'specs',
];

// getRecipes() normalizes tags on every load (renaming/dropping retired variants
// per TAG_RENAMES/TAG_REMOVALS), so a stored seed recipe's tags can legitimately
// differ from the raw SEED_RECIPES tags without the user having changed anything.
// Canonicalize both sides the same way before comparing.
function canonicalizeTagsForComparison(tags) {
  if (!Array.isArray(tags)) return [];
  const seen = new Set();
  tags.forEach(rawTag => {
    const canonical = normalizeTagName(rawTag);
    if (canonical) seen.add(canonical);
  });
  return Array.from(seen).sort();
}

function recipeDiffersFromSeed(recipe, seed) {
  return SEED_COMPARISON_FIELDS.some(key => {
    if (key === 'tags') {
      return JSON.stringify(canonicalizeTagsForComparison(recipe.tags)) !== JSON.stringify(canonicalizeTagsForComparison(seed.tags));
    }
    return JSON.stringify(recipe[key] ?? null) !== JSON.stringify(seed[key] ?? null);
  });
}

function readRawStoredRecipes() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [...SEED_RECIPES];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [...SEED_RECIPES];
  } catch (err) {
    console.error('Failed to read recipes from localStorage:', err);
    return [...SEED_RECIPES];
  }
}

/**
 * Recipes worth including in a backup: anything with no canonical seed
 * counterpart, or a seed recipe the user has modified in place.
 */
export function getCustomRecipesForBackup() {
  const seedById = new Map(SEED_RECIPES.map(s => [s.id, s]));
  return readRawStoredRecipes().filter(r => {
    const seed = seedById.get(r.id);
    return !seed || recipeDiffersFromSeed(r, seed);
  });
}

/**
 * Build the full v1 backup payload (recipes, inventory, hidden recipes, settings)
 * without touching the DOM, so it can be used for both export and testing.
 */
export function buildBackupPayload() {
  return {
    version: BACKUP_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    inventory: getInventory(),
    hiddenRecipes: getHiddenRecipeIds(),
    settings: {
      unitPref: getUnitPreference(),
      sortPref: getSortPreference(),
      glassViewPref: getGlassViewPreference(),
    },
    customRecipes: getCustomRecipesForBackup(),
  };
}

export function exportData() {
  const payload = buildBackupPayload();
  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(payload, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute('href', dataStr);
  downloadAnchor.setAttribute('download', `speakeasy_backup_${new Date().toISOString().slice(0, 10)}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

function sanitizeImportedRecipes(items) {
  return (items || []).filter(item => {
    return item && typeof item === 'object' && typeof item.name === 'string' && item.name.trim().length > 0;
  }).map(item => ({
    id: item.id || slugifyRecipeName(item.name),
    name: item.name.trim(),
    glassware: item.glassware || 'Rocks',
    method: item.method || 'Stirred',
    garnish: item.garnish || '',
    description: item.description || '',
    instructions: item.instructions || item.notes || '',
    source: item.source || '',
    sourceUrl: item.sourceUrl || '',
    notes: item.notes || '',
    riffOfId: item.riffOfId || null,
    riffOfName: item.riffOfName || '',
    tags: Array.isArray(item.tags)
      ? Array.from(new Set(item.tags.map(t => String(t).trim().toLowerCase()).filter(Boolean)))
      : [],
    specs: Array.isArray(item.specs) ? item.specs.map(s => ({
      amount: s.amount !== null && s.amount !== undefined && !isNaN(Number(s.amount)) ? Number(s.amount) : null,
      unit: s.unit || '',
      name: s.name || '',
      abv: s.abv !== null && s.abv !== undefined && !isNaN(Number(s.abv)) ? Number(s.abv) : undefined,
    })) : [],
  }));
}

/**
 * Drop entries that are just identical copies of a canonical seed recipe
 * (nothing new to import for those; SEED_RECIPES already supplies them).
 */
function excludeUnmodifiedSeeds(recipes) {
  const seedById = new Map(SEED_RECIPES.map(s => [s.id, s]));
  return recipes.filter(r => {
    const seed = seedById.get(r.id);
    return !seed || recipeDiffersFromSeed(r, seed);
  });
}

/**
 * Import a v1 unified backup ({ version, inventory, hiddenRecipes, settings, customRecipes }).
 * Recipes are merged by id; inventory and hidden recipes are merged (union),
 * never overwritten, so the user never loses bottles/recipes they already had.
 * Returns a summary usable for a confirmation toast.
 */
export function importData(jsonString) {
  let parsed;
  try {
    parsed = JSON.parse(jsonString);
  } catch (err) {
    throw new Error('Invalid JSON format');
  }

  if (!parsed || typeof parsed !== 'object' || parsed.version !== BACKUP_SCHEMA_VERSION || !Array.isArray(parsed.customRecipes)) {
    throw new Error('Unrecognized backup format');
  }

  const validRecipes = excludeUnmodifiedSeeds(sanitizeImportedRecipes(parsed.customRecipes));
  const inventoryRaw = Array.isArray(parsed.inventory) ? parsed.inventory : [];
  const hiddenRaw = Array.isArray(parsed.hiddenRecipes) ? parsed.hiddenRecipes : [];
  const settingsRaw = (parsed.settings && typeof parsed.settings === 'object') ? parsed.settings : {};

  const existingRecipes = getRecipes();
  const recipeMap = new Map(existingRecipes.map(r => [r.id, r]));
  validRecipes.forEach(r => recipeMap.set(r.id, r));
  const mergedRecipes = Array.from(recipeMap.values());
  saveRecipes(mergedRecipes);

  const mergedInventory = new Set(getInventory());
  const inventoryBefore = mergedInventory.size;
  inventoryRaw.forEach(id => { if (typeof id === 'string') mergedInventory.add(id); });
  const inventoryAddedCount = mergedInventory.size - inventoryBefore;
  saveInventory(Array.from(mergedInventory));

  const mergedHidden = new Set(getHiddenRecipeIds());
  hiddenRaw.forEach(id => { if (typeof id === 'string') mergedHidden.add(id); });
  saveHiddenRecipeIds(Array.from(mergedHidden));

  if (settingsRaw.unitPref) saveUnitPreference(settingsRaw.unitPref);
  if (settingsRaw.sortPref) saveSortPreference(settingsRaw.sortPref);
  if (settingsRaw.glassViewPref) saveGlassViewPreference(settingsRaw.glassViewPref);

  return {
    recipes: mergedRecipes,
    importedRecipeCount: validRecipes.length,
    inventoryAddedCount,
  };
}

export function getAllUniqueTags(recipes = []) {
  const tagSet = new Set();
  (recipes || []).forEach(recipe => {
    if (Array.isArray(recipe.tags)) {
      recipe.tags.forEach(tag => {
        const clean = normalizeTagName(tag);
        if (clean && !SUGGESTION_EXCLUDED_TAGS.has(clean)) tagSet.add(clean);
      });
    }
  });
  return Array.from(tagSet).sort();
}

export function resetToDefaults() {
  saveHiddenRecipeIds([]);
  saveRecipes(SEED_RECIPES);
  return SEED_RECIPES;
}

/**
 * Completely resets user-specific session data on sign out so private
 * custom recipes, inventory, menus, and history are not left exposed in guest mode.
 */
export function clearUserDataOnSignOut() {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(INVENTORY_STORAGE_KEY);
      localStorage.removeItem(BAR_NAME_STORAGE_KEY);
      localStorage.removeItem(LAST_SYNCED_STORAGE_KEY);
      localStorage.removeItem(LAST_EXPORTED_STORAGE_KEY);
      localStorage.removeItem(AVATAR_RECIPE_STORAGE_KEY);
      localStorage.removeItem(PINNED_TAGS_STORAGE_KEY);
      localStorage.removeItem(RECENTLY_VIEWED_STORAGE_KEY);
      localStorage.removeItem(LOW_STOCK_STORAGE_KEY);
      localStorage.removeItem(MENUS_STORAGE_KEY);
      localStorage.removeItem('speakeasy_drink_history');
      localStorage.removeItem('speakeasy_last_active_recipe');
    }
  } catch (err) {
    console.warn('Failed to clear user data keys on sign out:', err);
  }

  saveHiddenRecipeIds([]);
  saveRecipes(SEED_RECIPES);
  return SEED_RECIPES;
}

// ==========================================
// Backbar Personal Inventory Persistence
// ==========================================
const INVENTORY_STORAGE_KEY = 'speakeasy_inventory';

export const DEFAULT_STARTER_BAR = [
  'bourbon',
  'rye_whiskey',
  'london_dry_gin',
  'light_rum',
  'tequila_blanco',
  'sweet_vermouth',
  'dry_vermouth',
  'campari',
  'triple_sec',
  'simple_syrup',
  'aromatic_bitters',
  'lemon_juice',
  'lime_juice',
];

export function getInventory() {
  try {
    const raw = localStorage.getItem(INVENTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('Failed to read inventory from localStorage:', err);
    return [];
  }
}

export function saveInventory(ids) {
  try {
    const list = Array.from(new Set(ids));
    localStorage.setItem(INVENTORY_STORAGE_KEY, JSON.stringify(list));
    return list;
  } catch (err) {
    console.error('Failed to save inventory to localStorage:', err);
    return ids;
  }
}

export function toggleInventoryItem(id) {
  const current = new Set(getInventory());
  if (current.has(id)) {
    current.delete(id);
  } else {
    current.add(id);
  }
  const updated = Array.from(current);
  saveInventory(updated);
  return updated;
}

export function clearInventory() {
  saveInventory([]);
  return [];
}

// ==========================================
// User Preferences & Bar Profile
// ==========================================
const UNIT_STORAGE_KEY = 'speakeasy_unit_system';
const BAR_NAME_STORAGE_KEY = 'speakeasy_bar_name';

export function getUnitPreference() {
  try {
    const val = localStorage.getItem(UNIT_STORAGE_KEY);
    return val === 'ml' ? 'ml' : 'oz';
  } catch {
    return 'oz';
  }
}

export function saveUnitPreference(unit) {
  try {
    const clean = unit === 'ml' ? 'ml' : 'oz';
    localStorage.setItem(UNIT_STORAGE_KEY, clean);
    return clean;
  } catch (err) {
    console.error('Failed to save unit preference:', err);
    return unit;
  }
}

export function getBarName() {
  try {
    const val = localStorage.getItem(BAR_NAME_STORAGE_KEY);
    return val && val.trim() ? val.trim() : 'Speakeasy Cocktail Library';
  } catch {
    return 'Speakeasy Cocktail Library';
  }
}

export function saveBarName(name) {
  try {
    const clean = (name || '').trim() || 'Speakeasy Cocktail Library';
    localStorage.setItem(BAR_NAME_STORAGE_KEY, clean);
    return clean;
  } catch (err) {
    console.error('Failed to save bar name:', err);
    return name;
  }
}

const LAST_SYNCED_STORAGE_KEY = 'speakeasy_last_synced_at';

export function getLastSyncedAt() {
  try {
    const val = localStorage.getItem(LAST_SYNCED_STORAGE_KEY);
    return val ? Number(val) : null;
  } catch {
    return null;
  }
}

export function saveLastSyncedAt(timestamp = Date.now()) {
  try {
    localStorage.setItem(LAST_SYNCED_STORAGE_KEY, String(timestamp));
  } catch (err) {
    console.error('Failed to save last synced timestamp:', err);
  }
  return timestamp;
}

const LAST_EXPORTED_STORAGE_KEY = 'speakeasy_last_exported_at';

export function getLastExportedAt() {
  try {
    const val = localStorage.getItem(LAST_EXPORTED_STORAGE_KEY);
    return val ? Number(val) : null;
  } catch {
    return null;
  }
}

export function saveLastExportedAt(timestamp = Date.now()) {
  try {
    localStorage.setItem(LAST_EXPORTED_STORAGE_KEY, String(timestamp));
  } catch (err) {
    console.error('Failed to save last exported timestamp:', err);
  }
  return timestamp;
}

const AVATAR_RECIPE_STORAGE_KEY = 'speakeasy_avatar_recipe_id';

export function getAvatarRecipeId() {
  try {
    return localStorage.getItem(AVATAR_RECIPE_STORAGE_KEY) || null;
  } catch {
    return null;
  }
}

export function saveAvatarRecipeId(recipeId) {
  try {
    localStorage.setItem(AVATAR_RECIPE_STORAGE_KEY, recipeId);
  } catch (err) {
    console.error('Failed to save avatar recipe id:', err);
  }
  return recipeId;
}

const GLASS_VIEW_STORAGE_KEY = 'speakeasy_glass_view_mode';

export function getGlassViewPreference() {
  try {
    const val = localStorage.getItem(GLASS_VIEW_STORAGE_KEY);
    return val === 'blended' ? 'blended' : 'layered';
  } catch {
    return 'layered';
  }
}

export function saveGlassViewPreference(mode) {
  try {
    const clean = mode === 'blended' ? 'blended' : 'layered';
    localStorage.setItem(GLASS_VIEW_STORAGE_KEY, clean);
    return clean;
  } catch (err) {
    console.error('Failed to save glass view preference:', err);
    return mode;
  }
}

const WAKE_LOCK_STORAGE_KEY = 'speakeasy_wake_lock_enabled';

export function getWakeLockPreference() {
  try {
    const val = localStorage.getItem(WAKE_LOCK_STORAGE_KEY);
    return val === null ? true : val === 'true';
  } catch {
    return true;
  }
}

export function saveWakeLockPreference(enabled) {
  try {
    const bool = Boolean(enabled);
    localStorage.setItem(WAKE_LOCK_STORAGE_KEY, String(bool));
    return bool;
  } catch (err) {
    console.error('Failed to save wake lock preference:', err);
    return enabled;
  }
}

// Tags a user has "pinned" to appear as their own browsable collection on the Home
// page (e.g. tagging drinks "#house-favorites" and pinning that tag as a shelf).
const PINNED_TAGS_STORAGE_KEY = 'speakeasy_pinned_tags';

export function getPinnedTags() {
  try {
    const raw = localStorage.getItem(PINNED_TAGS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(t => typeof t === 'string') : [];
  } catch {
    return [];
  }
}

export function savePinnedTags(tags) {
  try {
    const clean = Array.isArray(tags) ? tags.filter(t => typeof t === 'string') : [];
    localStorage.setItem(PINNED_TAGS_STORAGE_KEY, JSON.stringify(clean));
    return clean;
  } catch (err) {
    console.error('Failed to save pinned tags:', err);
    return tags;
  }
}

// Recipe view history, most-recent-first, for the Home page's "Recently Viewed" shelf.
const RECENTLY_VIEWED_STORAGE_KEY = 'speakeasy_recently_viewed';
const RECENTLY_VIEWED_MAX = 15;

export function getRecentlyViewed() {
  try {
    const raw = localStorage.getItem(RECENTLY_VIEWED_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(id => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

export function recordRecentlyViewed(recipeId) {
  if (!recipeId) return;
  try {
    const existing = getRecentlyViewed().filter(id => id !== recipeId);
    const updated = [recipeId, ...existing].slice(0, RECENTLY_VIEWED_MAX);
    localStorage.setItem(RECENTLY_VIEWED_STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error('Failed to record recently viewed recipe:', err);
  }
}

const SORT_PREFERENCE_STORAGE_KEY = 'speakeasy_library_sort';
const VALID_SORT_OPTIONS = new Set(['curated', 'name-asc', 'name-desc', 'ready', 'specs-asc']);

export function getSortPreference() {
  try {
    const val = localStorage.getItem(SORT_PREFERENCE_STORAGE_KEY);
    return VALID_SORT_OPTIONS.has(val) ? val : 'curated';
  } catch {
    return 'curated';
  }
}

export function saveSortPreference(sortOption) {
  try {
    const clean = VALID_SORT_OPTIONS.has(sortOption) ? sortOption : 'curated';
    localStorage.setItem(SORT_PREFERENCE_STORAGE_KEY, clean);
    return clean;
  } catch (err) {
    console.error('Failed to save sort preference:', err);
    return sortOption;
  }
}

// ==========================================
// Low-Stock Ingredient Flags
// ==========================================
// Taxonomy ids the user has manually flagged as "running low" — independent of
// ownership itself, so a bottle can be owned-and-low or owned-and-fine. Cleared
// automatically when a bottle is removed from inventory entirely (see
// toggleInventoryBottle in backbar-modal.js), since the flag is meaningless once
// the ingredient isn't owned.
const LOW_STOCK_STORAGE_KEY = 'speakeasy_low_stock';

export function getLowStockIds() {
  try {
    const raw = localStorage.getItem(LOW_STOCK_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(id => typeof id === 'string') : [];
  } catch (err) {
    console.error('Failed to read low-stock ids from localStorage:', err);
    return [];
  }
}

export function saveLowStockIds(ids) {
  try {
    const clean = Array.from(new Set((ids || []).filter(id => typeof id === 'string')));
    localStorage.setItem(LOW_STOCK_STORAGE_KEY, JSON.stringify(clean));
    return clean;
  } catch (err) {
    console.error('Failed to save low-stock ids to localStorage:', err);
    return ids;
  }
}

export function toggleLowStock(id) {
  const current = new Set(getLowStockIds());
  if (current.has(id)) {
    current.delete(id);
  } else {
    current.add(id);
  }
  return saveLowStockIds(Array.from(current));
}

export function clearLowStock(id) {
  return saveLowStockIds(getLowStockIds().filter(x => x !== id));
}

// ==========================================
// Saved Menus (Menu Builder)
// ==========================================
// User-curated event menus: a name plus a list of recipe ids. Unlike a pinned
// tag, a menu isn't a durable property of the recipes themselves — it's a
// disposable, occasion-scoped grouping (e.g. "Sarah's Birthday") that drives
// derived views (glassware tally, a shopping list scoped to just that subset)
// rather than acting as another browsable tag on every recipe in it.
const MENUS_STORAGE_KEY = 'speakeasy_menus';

export function getMenus() {
  try {
    const raw = localStorage.getItem(MENUS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(m => m && typeof m.id === 'string' && typeof m.name === 'string' && Array.isArray(m.recipeIds));
  } catch (err) {
    console.error('Failed to read menus from localStorage:', err);
    return [];
  }
}

export function saveMenus(menus) {
  try {
    localStorage.setItem(MENUS_STORAGE_KEY, JSON.stringify(menus || []));
    return menus;
  } catch (err) {
    console.error('Failed to save menus to localStorage:', err);
    return menus;
  }
}

export function saveMenu(menu) {
  const menus = getMenus();
  const id = menu.id || `menu-${Date.now()}`;
  const recipeIds = Array.isArray(menu.recipeIds) ? Array.from(new Set(menu.recipeIds)) : [];
  const updatedMenu = {
    id,
    name: String(menu.name || '').trim() || 'Untitled Menu',
    recipeIds,
    createdAt: menu.createdAt || Date.now(),
  };

  const existingIndex = menus.findIndex(m => m.id === id);
  let updatedList;
  if (existingIndex >= 0) {
    updatedList = [...menus];
    updatedList[existingIndex] = updatedMenu;
  } else {
    updatedList = [updatedMenu, ...menus];
  }

  saveMenus(updatedList);
  return updatedMenu;
}

export function deleteMenu(id) {
  const filtered = getMenus().filter(m => m.id !== id);
  saveMenus(filtered);
  return filtered;
}

