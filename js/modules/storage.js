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

export function exportRecipesJSON() {
  const recipes = getRecipes();
  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(recipes, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute('href', dataStr);
  downloadAnchor.setAttribute('download', `speakeasy_recipes_${new Date().toISOString().slice(0, 10)}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

export function importRecipesJSON(jsonString, mode = 'merge') {
  let imported;
  try {
    imported = JSON.parse(jsonString);
  } catch (err) {
    throw new Error('Invalid JSON format');
  }

  if (!Array.isArray(imported)) {
    throw new Error('Imported JSON must be an array of recipe objects');
  }

  // Sanitize and validate recipes
  const validRecipes = imported.filter(item => {
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

  if (validRecipes.length === 0) {
    throw new Error('No valid recipes found in imported file');
  }

  const existing = getRecipes();
  let merged;
  if (mode === 'replace') {
    merged = validRecipes;
  } else {
    // Merge: update existing by ID or add new
    const map = new Map(existing.map(r => [r.id, r]));
    validRecipes.forEach(r => map.set(r.id, r));
    merged = Array.from(map.values());
  }

  saveRecipes(merged);
  return merged;
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
  'red_bitter',
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

