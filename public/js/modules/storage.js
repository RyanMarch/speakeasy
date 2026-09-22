/**
 * Speakeasy Local Storage & Portability Module
 * Handles local persistence, JSON export, and JSON import.
 */

const STORAGE_KEY = 'speakeasy_recipes';

// Canonical renames for tags that have accumulated redundant variants over time
// (e.g. singular/plural drift, or a freeform descriptor superseded by a themed pack tag).
//
// Tag conventions, so new tags don't drift again:
//   - lowercase kebab-case
//   - singular descriptors ("refreshing", "highball"), except pack names that
//     read as a collection ("nightcaps"). Pack keys are also stored in pinned
//     tags, Home order, and hidden-collection settings, so they don't get renamed.
//   - one canonical spelling per idea; near-synonyms are folded together below
//   - spirit tags are "<spirit>-forward"
const TAG_RENAMES = {
  'modern-classic': 'modern-craft',
  'modern-classics': 'modern-craft',
  'essential-classic': 'classic',
  'essential-classics': 'classic',
  'nightcap': 'nightcaps',
  'tiki': 'tropical-tiki',
  'tropical': 'tropical-tiki',
  'effervescent': 'sparkling',
  // Near-synonyms folded into the tag the library uses most.
  'low-proof': 'low-abv',
  'tequila': 'tequila-forward',
  'rhum-agricole': 'rum-forward',
  'berry': 'fruity',
  'anise': 'herbal',
  'crowd-pleaser': 'party',
  'celebratory': 'party',
  'historic': 'classic',
  'legendary': 'classic',
  'adventurous': 'complex',
};

// Tags dropped outright because they're redundant with another tag/pack and add
// no distinguishing information (e.g. "aperitivo" duplicating the "aperitivo-amaro" pack).
const TAG_REMOVALS = new Set([
  'aperitivo',
  // One-off editorial flourishes and single-drink descriptors that no one would
  // browse by; each was on exactly one bundled recipe.
  'visually-stunning', 'elegant', 'minimalist', 'new-orleans', 'evening', 'dry', 'beer', 'digestif',
]);

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
import { normalizeUnit } from "./parser.js";
import { scheduleCloudSync } from "./cloud-sync.js";
import { sanitizeDietOverrides } from "./dietary.js";
import { mergeMenuSets } from "./menu-merge.js";
import { mergeRecipeDeletions } from "./recipe-merge.js";
import { mergeInventory, recordInventoryChange } from "./inventory-merge.js";
import { detectDominantSpiritTag } from "./auto-detect.js";
export { SEED_RECIPES };

// ==========================================
// Hidden & Global Recipes Persistence
// ==========================================
const HIDDEN_RECIPES_STORAGE_KEY = 'speakeasy_hidden_recipes';
const GLOBALLY_HIDDEN_RECIPES_STORAGE_KEY = 'speakeasy_globally_hidden_recipes';
const DYNAMIC_GLOBAL_RECIPES_STORAGE_KEY = 'speakeasy_dynamic_global_recipes';

export function getGloballyHiddenRecipeIds() {
  try {
    const raw = localStorage.getItem(GLOBALLY_HIDDEN_RECIPES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(id => typeof id === 'string') : [];
  } catch (err) {
    return [];
  }
}

export function saveGloballyHiddenRecipeIds(ids) {
  try {
    const clean = Array.from(new Set((ids || []).filter(id => typeof id === 'string')));
    localStorage.setItem(GLOBALLY_HIDDEN_RECIPES_STORAGE_KEY, JSON.stringify(clean));
    return clean;
  } catch (err) {
    return ids;
  }
}

export function getDynamicGlobalRecipes() {
  try {
    const raw = localStorage.getItem(DYNAMIC_GLOBAL_RECIPES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    return [];
  }
}

export function saveDynamicGlobalRecipes(recipes) {
  try {
    const clean = Array.isArray(recipes) ? recipes : [];
    localStorage.setItem(DYNAMIC_GLOBAL_RECIPES_STORAGE_KEY, JSON.stringify(clean));
    return clean;
  } catch (err) {
    return recipes;
  }
}

export function getHiddenRecipeIds() {
  try {
    const raw = localStorage.getItem(HIDDEN_RECIPES_STORAGE_KEY);
    const localHidden = raw ? JSON.parse(raw) : [];
    const cleanLocal = Array.isArray(localHidden) ? localHidden.filter(id => typeof id === 'string') : [];
    const globallyHidden = getGloballyHiddenRecipeIds();
    return Array.from(new Set([...cleanLocal, ...globallyHidden]));
  } catch (err) {
    console.error('Failed to read hidden recipes from localStorage:', err);
    return getGloballyHiddenRecipeIds();
  }
}

export function saveHiddenRecipeIds(ids) {
  try {
    const clean = Array.from(new Set((ids || []).filter(id => typeof id === 'string')));
    localStorage.setItem(HIDDEN_RECIPES_STORAGE_KEY, JSON.stringify(clean));
    scheduleCloudSync();
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

      // Automatically backfill canonical seed recipes and dynamic global recipes missing from stored list,
      // UNLESS the user explicitly hid them.
      const dynamicGlobals = getDynamicGlobalRecipes();
      const allGlobalSources = [...SEED_RECIPES, ...dynamicGlobals];

      allGlobalSources.forEach(globalRecipe => {
        const exists = parsed.some(r => r.id === globalRecipe.id);
        if (!exists && !hiddenIds.has(globalRecipe.id)) {
          parsed.push({ ...globalRecipe });
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
          // Penicillin's syrup is honey-ginger syrup, not plain honey syrup. Only the
          // exact old row and step wording is rewritten, so an edited copy is left alone.
          if (r.id === 'penicillin') {
            const plainHoney = Array.isArray(r.specs) ? r.specs.find(s => s.name === 'Honey Syrup') : null;
            if (plainHoney) {
              plainHoney.name = 'Honey-Ginger Syrup';
              updatedStorage = true;
            }
            if (typeof r.instructions === 'string' && r.instructions.includes('and honey syrup to a shaker')) {
              r.instructions = r.instructions.replace('and honey syrup to a shaker', 'and honey-ginger syrup to a shaker');
              updatedStorage = true;
            }
          }
          // Update Shoulder Season to Tuxedo No. 2 specs if stored under the earlier draft
          if (r.id === 'shoulder-season' && r.source !== 'Tuxedo No. 2') {
            Object.assign(r, { ...seed });
            updatedStorage = true;
          }
          // Backfill properties from seed that are genuinely missing in older stored
          // versions (the key was never stored at all, or is null/undefined) — but
          // NOT when it's present as an explicit '' or [], since that's how a user's
          // deliberate clear of a field is persisted, and re-backfilling it here would
          // silently revert their edit on the very next load.
          Object.keys(seed).forEach(key => {
            if (!(key in r) || r[key] === undefined || r[key] === null) {
              r[key] = Array.isArray(seed[key]) ? [...seed[key]] : seed[key];
              updatedStorage = true;
            } else if (Array.isArray(seed[key]) && !Array.isArray(r[key])) {
              r[key] = [...seed[key]];
              updatedStorage = true;
            }
          });
          // Merge pack tags into existing stored tags if missing
          if (Array.isArray(seed.tags) && Array.isArray(r.tags)) {
            if (seed.tags.includes('scotch-forward') && r.tags.includes('whiskey-forward')) {
              r.tags = r.tags.filter(t => t !== 'whiskey-forward');
              updatedStorage = true;
            }
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

        // Custom recipes: if specs indicate scotch is the dominant spirit, upgrade whiskey-forward to scotch-forward
        if (Array.isArray(r.tags) && Array.isArray(r.specs)) {
          if (detectDominantSpiritTag(r.specs) === 'scotch-forward') {
            if (r.tags.includes('whiskey-forward')) {
              r.tags = r.tags.filter(t => t !== 'whiskey-forward');
              updatedStorage = true;
            }
            if (!r.tags.includes('scotch-forward')) {
              r.tags.push('scotch-forward');
              updatedStorage = true;
            }
          }
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
    scheduleCloudSync();
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

  // Saving under a previously-deleted id is a deliberate recreate — the
  // tombstone has done its job and shouldn't keep deleting it on future syncs.
  const deletedIds = getDeletedRecipeIds();
  if (deletedIds[id]) {
    const { [id]: _removed, ...rest } = deletedIds;
    saveDeletedRecipeIds(rest);
  }

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

// Recipes deleted on this device, remembered so a sync doesn't bring them back
// from another device or the cloud: { [recipeId]: deletedAtMs }. Cleared for a
// given id once that id is saved (recreated) again. See recipe-merge.js.
const DELETED_RECIPES_STORAGE_KEY = 'speakeasy_deleted_recipes';

export function getDeletedRecipeIds() {
  try {
    const parsed = JSON.parse(localStorage.getItem(DELETED_RECIPES_STORAGE_KEY) || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function saveDeletedRecipeIds(deleted) {
  try {
    localStorage.setItem(DELETED_RECIPES_STORAGE_KEY, JSON.stringify(deleted || {}));
  } catch (err) {
    console.error('Failed to save deleted recipes to localStorage:', err);
  }
}

export function deleteRecipe(id) {
  const recipes = getRecipes();
  const filtered = recipes.filter(r => r.id !== id);
  saveDeletedRecipeIds({ ...getDeletedRecipeIds(), [id]: Date.now() });
  saveRecipes(filtered);
  return filtered;
}

const BACKUP_SCHEMA_VERSION = 2;

// Fields compared to decide whether a stored recipe still matches its canonical
// seed spec (unmodified seeds are excluded from backups since they're already
// available at import time via SEED_RECIPES).
const SEED_COMPARISON_FIELDS = [
  'name', 'glassware', 'method', 'garnish', 'description',
  'instructions', 'source', 'sourceUrl', 'notes', 'tags', 'specs', 'yield',
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
 * Build the full v2 backup payload (recipes, bars+inventory, hidden recipes, settings)
 * without touching the DOM, so it can be used for both export and testing.
 */
export function buildBackupPayload() {
  const bars = getBars().map(b => ({
    id: b.id,
    name: b.name,
    isDefault: Boolean(b.isDefault),
    inventory: readInventoryForBar(b.id),
  }));
  return {
    version: BACKUP_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    bars,
    hiddenRecipes: getHiddenRecipeIds(),
    settings: {
      unitPref: getUnitPreference(),
      sortPref: getSortPreference(),
      glassViewMode: getGlassViewPreference(),
      glassViewPref: getGlassViewPreference(),
      wakeLockPref: getWakeLockPreference(),
      funPref: getFunPreference(),
      avatarRecipeId: getAvatarRecipeId(),
      foamerForEgg: getFoamerPreference(),
    },
    pinnedTags: getPinnedTags(),
    homeCollectionsOrder: getHomeCollectionsOrder(),
    hiddenHomeCollections: getHiddenHomeCollections(),
    lowStock: getLowStockIds(),
    menus: getMenus(),
    deletedMenus: getDeletedMenus(),
    deletedRecipes: getDeletedRecipeIds(),
    inventoryChanges: getInventoryChanges(),
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

export function sanitizeImportedRecipes(items) {
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
    yield: item.yield !== null && item.yield !== undefined && !isNaN(Number(item.yield)) && Number(item.yield) >= 1 ? Math.round(Number(item.yield)) : 1,
    tags: Array.isArray(item.tags)
      ? Array.from(new Set(item.tags.map(t => String(t).trim().toLowerCase()).filter(Boolean)))
      : [],
    specs: Array.isArray(item.specs) ? item.specs.map(s => ({
      amount: s.amount !== null && s.amount !== undefined && !isNaN(Number(s.amount)) ? Number(s.amount) : null,
      unit: normalizeUnit(s.unit),
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
 * Import a unified backup, either v1 ({ version: 1, inventory: string[], ... })
 * or v2 ({ version: 2, bars: [{id, name, isDefault, inventory}], ... }).
 * Recipes are merged by id; inventory and hidden recipes are merged (union),
 * never overwritten, so the user never loses bottles/recipes they already had.
 * v2 bars are merged by id: a matching local bar gets its inventory unioned in
 * place, an unmatched remote bar is appended as a new local bar.
 * Returns a summary usable for a confirmation toast.
 */
export function importData(jsonString) {
  let parsed;
  try {
    parsed = JSON.parse(jsonString);
  } catch (err) {
    throw new Error('Invalid JSON format');
  }

  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.customRecipes) ||
      (parsed.version !== 1 && parsed.version !== 2)) {
    throw new Error('Unrecognized backup format');
  }

  const validRecipes = excludeUnmodifiedSeeds(sanitizeImportedRecipes(parsed.customRecipes));
  const hiddenRaw = Array.isArray(parsed.hiddenRecipes) ? parsed.hiddenRecipes : [];
  const settingsRaw = (parsed.settings && typeof parsed.settings === 'object') ? parsed.settings : {};

  // A recipe deleted on this device or another synced one stays deleted:
  // merge tombstones first, then drop any incoming/local copy they cover
  // (unless this device has since recreated that id — see recipe-merge.js).
  const incomingDeletedRecipes = (parsed.deletedRecipes && typeof parsed.deletedRecipes === 'object' && !Array.isArray(parsed.deletedRecipes))
    ? parsed.deletedRecipes
    : {};
  const mergedDeletedRecipes = mergeRecipeDeletions({ deleted: getDeletedRecipeIds() }, { deleted: incomingDeletedRecipes });

  const existingRecipes = getRecipes();
  const recipeMap = new Map(existingRecipes.map(r => [r.id, r]));
  validRecipes.forEach(r => recipeMap.set(r.id, r));
  Object.keys(mergedDeletedRecipes).forEach(id => recipeMap.delete(id));
  const mergedRecipes = Array.from(recipeMap.values());
  saveRecipes(mergedRecipes);
  saveDeletedRecipeIds(mergedDeletedRecipes);

  let inventoryAddedCount = 0;
  if (parsed.version === 2 && Array.isArray(parsed.bars)) {
    const localBars = getBars();
    const localBarIds = new Set(localBars.map(b => b.id));
    const localDefaultBar = localBars.find(b => b.isDefault);
    const newBars = [];

    parsed.bars.forEach(remoteBar => {
      if (!remoteBar || typeof remoteBar.id !== 'string') return;
      const incomingInventory = Array.isArray(remoteBar.inventory) ? remoteBar.inventory : [];

      // There is exactly one "default"/Home Bar per user on each side. For an
      // account that synced under the old single-bar model, the local bar
      // freshly created by migration and the pre-existing remote default bar
      // are the SAME conceptual bar under two unrelated generated ids — match
      // them by role rather than id so they merge instead of appearing as a
      // bogus duplicate. Any other (deliberately created) bar still matches by id.
      // Bottles merge rather than overwrite, but a bottle either side removed on
      // purpose stays removed (see inventory-merge.js). Nothing here counts as the
      // user's own change, so none of it is recorded as one.
      const mergeIntoLocalBar = (localBarId) => {
        const local = { items: readInventoryForBar(localBarId), ...getInventoryChanges()[localBarId] };
        // A backup that carries no add/remove records (a file exported before they
        // existed) is a person restoring bottles on purpose: they count as added
        // now, so it behaves as the plain merge it always was.
        const remote = parsed.inventoryChanges && typeof parsed.inventoryChanges === 'object'
          ? { items: incomingInventory, ...parsed.inventoryChanges[remoteBar.id] }
          : { items: incomingInventory, added: Object.fromEntries(incomingInventory.filter(id => typeof id === 'string').map(id => [id, Date.now()])) };
        const merged = mergeInventory(local, remote);
        inventoryAddedCount += Math.max(0, merged.items.filter(id => !local.items.includes(id)).length);
        writeInventoryForBar(localBarId, merged.items);
        setInventoryChangesForBar(localBarId, merged);
      };

      if (remoteBar.isDefault && localDefaultBar && !localBarIds.has(remoteBar.id)) {
        mergeIntoLocalBar(localDefaultBar.id);
        return;
      }

      if (localBarIds.has(remoteBar.id)) {
        mergeIntoLocalBar(remoteBar.id);
      } else {
        newBars.push({
          id: remoteBar.id,
          name: (remoteBar.name && String(remoteBar.name).trim()) || 'New Bar',
          isDefault: false,
          createdAt: Date.now(),
        });
        writeInventoryForBar(remoteBar.id, incomingInventory.filter(id => typeof id === 'string'));
        setInventoryChangesForBar(remoteBar.id, (parsed.inventoryChanges || {})[remoteBar.id]);
        inventoryAddedCount += incomingInventory.length;
      }
    });

    if (newBars.length > 0) {
      saveBars([...localBars, ...newBars]);
    }
  } else {
    // v1 legacy shape: flat inventory merges into the currently active bar.
    const inventoryRaw = Array.isArray(parsed.inventory) ? parsed.inventory : [];
    const mergedInventory = new Set(getInventory());
    const before = mergedInventory.size;
    inventoryRaw.forEach(id => { if (typeof id === 'string') mergedInventory.add(id); });
    inventoryAddedCount = mergedInventory.size - before;
    saveInventory(Array.from(mergedInventory));
  }

  const mergedHidden = new Set(getHiddenRecipeIds());
  hiddenRaw.forEach(id => { if (typeof id === 'string') mergedHidden.add(id); });
  saveHiddenRecipeIds(Array.from(mergedHidden));

  // Sync down dynamic global recipes and globally hidden IDs from cloud if present
  if (Array.isArray(parsed.globallyHiddenIds)) {
    saveGloballyHiddenRecipeIds(parsed.globallyHiddenIds);
  }
  if (Array.isArray(parsed.globalRecipes)) {
    saveDynamicGlobalRecipes(parsed.globalRecipes);
    // Merge global recipes into local list if missing
    parsed.globalRecipes.forEach(g => {
      if (!recipeMap.has(g.id)) {
        recipeMap.set(g.id, g);
      }
    });
    saveRecipes(Array.from(recipeMap.values()));
  }

  if (settingsRaw.unitPref) saveUnitPreference(settingsRaw.unitPref);
  if (settingsRaw.sortPref) saveSortPreference(settingsRaw.sortPref);
  const incomingGlassMode = settingsRaw.glassViewMode || settingsRaw.glassViewPref;
  if (incomingGlassMode) saveGlassViewPreference(incomingGlassMode);
  if (typeof settingsRaw.wakeLockPref === 'boolean') saveWakeLockPreference(settingsRaw.wakeLockPref);
  if (typeof settingsRaw.funPref === 'boolean') saveFunPreference(settingsRaw.funPref);
  if (typeof settingsRaw.foamerForEgg === 'boolean') saveFoamerPreference(settingsRaw.foamerForEgg);
  if (typeof settingsRaw.avatarRecipeId === 'string' && settingsRaw.avatarRecipeId) {
    saveAvatarRecipeId(settingsRaw.avatarRecipeId);
  }

  // Pinned tags / Home layout: merge (union) rather than overwrite, same
  // rationale as inventory/hidden recipes above — never lose a local pin.
  if (Array.isArray(parsed.pinnedTags)) {
    const mergedPins = new Set(getPinnedTags());
    parsed.pinnedTags.forEach(t => { if (typeof t === 'string') mergedPins.add(t); });
    savePinnedTags(Array.from(mergedPins));
  }
  if (Array.isArray(parsed.homeCollectionsOrder) && parsed.homeCollectionsOrder.length > 0
      && (!Array.isArray(getHomeCollectionsOrder()) || getHomeCollectionsOrder().length === 0)) {
    saveHomeCollectionsOrder(parsed.homeCollectionsOrder.filter(k => typeof k === 'string'));
  }
  if (Array.isArray(parsed.hiddenHomeCollections)) {
    const mergedHiddenCollections = new Set(getHiddenHomeCollections());
    parsed.hiddenHomeCollections.forEach(k => { if (typeof k === 'string') mergedHiddenCollections.add(k); });
    saveHiddenHomeCollections(Array.from(mergedHiddenCollections));
  }
  if (Array.isArray(parsed.lowStock)) {
    const mergedLowStock = new Set(getLowStockIds());
    parsed.lowStock.forEach(id => { if (typeof id === 'string') mergedLowStock.add(id); });
    saveLowStockIds(Array.from(mergedLowStock));
  }
  if (Array.isArray(parsed.menus) || (parsed.deletedMenus && typeof parsed.deletedMenus === 'object')) {
    // The newest copy of each menu wins, and a deletion (on either side) sticks.
    const merged = mergeMenuSets(
      { menus: getMenus(), deleted: getDeletedMenus() },
      { menus: Array.isArray(parsed.menus) ? parsed.menus : [], deleted: parsed.deletedMenus },
    );
    saveDeletedMenus(merged.deleted);
    saveMenus(merged.menus);
  }

  return {
    recipes: Array.from(recipeMap.values()),
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
      Object.keys(localStorage)
        .filter(key => key.startsWith(INVENTORY_KEY_PREFIX))
        .forEach(key => localStorage.removeItem(key));
      localStorage.removeItem(BARS_STORAGE_KEY);
      localStorage.removeItem(ACTIVE_BAR_ID_STORAGE_KEY);
      localStorage.removeItem(LAST_SYNCED_STORAGE_KEY);
      localStorage.removeItem(LAST_EXPORTED_STORAGE_KEY);
      localStorage.removeItem(AVATAR_RECIPE_STORAGE_KEY);
      localStorage.removeItem(PINNED_TAGS_STORAGE_KEY);
      localStorage.removeItem(HOME_COLLECTIONS_ORDER_STORAGE_KEY);
      localStorage.removeItem(HIDDEN_HOME_COLLECTIONS_STORAGE_KEY);
      localStorage.removeItem(RECENTLY_VIEWED_STORAGE_KEY);
      localStorage.removeItem(LOW_STOCK_STORAGE_KEY);
      localStorage.removeItem(MENUS_STORAGE_KEY);
      localStorage.removeItem(DELETED_MENUS_STORAGE_KEY);
      localStorage.removeItem(INVENTORY_CHANGES_STORAGE_KEY);
      localStorage.removeItem('speakeasy_drink_history');
      localStorage.removeItem('speakeasy_last_active_recipe');
      localStorage.removeItem(SETTINGS_STORAGE_KEY);
      localStorage.removeItem(UNIT_STORAGE_KEY);
      localStorage.removeItem(GLASS_VIEW_STORAGE_KEY);
      localStorage.removeItem(WAKE_LOCK_STORAGE_KEY);
      localStorage.removeItem(FUN_STORAGE_KEY);
      localStorage.removeItem(SORT_PREFERENCE_STORAGE_KEY);
      localStorage.removeItem(LEGACY_INVENTORY_STORAGE_KEY);
      localStorage.removeItem(LEGACY_BAR_NAME_STORAGE_KEY);
    }
  } catch (err) {
    console.warn('Failed to clear user data keys on sign out:', err);
  }

  saveHiddenRecipeIds([]);
  saveRecipes(SEED_RECIPES);
  return SEED_RECIPES;
}

// ==========================================
// Multiple Saved Bars & Per-Bar Inventory Persistence
// ==========================================

// Legacy single-bar keys, kept only for one-time migration on first load.
const LEGACY_INVENTORY_STORAGE_KEY = 'speakeasy_inventory';
const LEGACY_BAR_NAME_STORAGE_KEY = 'speakeasy_bar_name';

const BARS_STORAGE_KEY = 'speakeasy_bars';
const ACTIVE_BAR_ID_STORAGE_KEY = 'speakeasy_active_bar_id';
const INVENTORY_KEY_PREFIX = 'speakeasy_inventory__';
const DEFAULT_BAR_NAME = 'Speakeasy Cocktail Library';

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

function generateBarId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `bar-${crypto.randomUUID()}`;
  }
  return `bar-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function readInventoryForBar(barId) {
  try {
    const raw = localStorage.getItem(`${INVENTORY_KEY_PREFIX}${barId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('Failed to read bar inventory from localStorage:', err);
    return [];
  }
}

// When each bottle was last deliberately added to or removed from each bar, so a
// removal syncs to other devices instead of being undone by them. See
// inventory-merge.js. { [barId]: { added: {id: ms}, removed: {id: ms} } }
const INVENTORY_CHANGES_STORAGE_KEY = 'speakeasy_inventory_changes';

export function getInventoryChanges() {
  try {
    const parsed = JSON.parse(localStorage.getItem(INVENTORY_CHANGES_STORAGE_KEY) || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function saveInventoryChanges(changes) {
  try {
    localStorage.setItem(INVENTORY_CHANGES_STORAGE_KEY, JSON.stringify(changes || {}));
  } catch (err) {
    console.error('Failed to save inventory change records to localStorage:', err);
  }
}

/** Replaces one bar's change records (used when merging in what the cloud knows). */
function setInventoryChangesForBar(barId, records) {
  const all = getInventoryChanges();
  if (records && (Object.keys(records.added || {}).length || Object.keys(records.removed || {}).length)) {
    all[barId] = { added: records.added || {}, removed: records.removed || {} };
  } else {
    delete all[barId];
  }
  saveInventoryChanges(all);
}

/**
 * Writes a bar's bottle list. Pass `{ track: true }` only for a change the user
 * made: it records what was added and removed so the change syncs. Anything that
 * merely reconciles with stored or cloud data must not, or it would look like the
 * user removing (or re-adding) bottles.
 */
function writeInventoryForBar(barId, ids, { track = false } = {}) {
  try {
    if (track) {
      const all = getInventoryChanges();
      all[barId] = recordInventoryChange(all[barId], readInventoryForBar(barId), ids);
      saveInventoryChanges(all);
    }
    const list = Array.from(new Set((ids || []).filter(id => typeof id === 'string')));
    localStorage.setItem(`${INVENTORY_KEY_PREFIX}${barId}`, JSON.stringify(list));
    scheduleCloudSync();
    return list;
  } catch (err) {
    console.error('Failed to save bar inventory to localStorage:', err);
    return ids;
  }
}

/**
 * Safely cleans up the pre-multi-bar legacy inventory keys (speakeasy_inventory,
 * speakeasy_bar_name) and prunes any orphaned per-bar inventory keys.
 *
 * IMPORTANT: If a legacy speakeasy_inventory array exists alongside an already-initialized
 * bars registry, we heuristic-merge into the user's default bar (or first bar) by exact bottle ID
 * using Set deduplication so no owned bottles are lost. After merging, the legacy keys are removed.
 */
function cleanupAndPruneInventoryStorage() {
  try {
    if (typeof localStorage === 'undefined') return;

    // 1. Check for lingering pre-multi-bar legacy inventory
    const legacyInventoryRaw = localStorage.getItem(LEGACY_INVENTORY_STORAGE_KEY);
    if (legacyInventoryRaw) {
      let legacyBottles = [];
      try {
        const parsed = JSON.parse(legacyInventoryRaw);
        if (Array.isArray(parsed)) {
          legacyBottles = parsed.filter(id => typeof id === 'string');
        }
      } catch (e) {
        console.error('Failed to parse legacy inventory during cleanup:', e);
      }

      if (legacyBottles.length > 0) {
        let bars = [];
        try {
          const rawBars = localStorage.getItem(BARS_STORAGE_KEY);
          bars = rawBars ? JSON.parse(rawBars) : [];
        } catch {
          bars = [];
        }

        if (Array.isArray(bars) && bars.length > 0) {
          // Heuristic: merge into default bar (or oldest/first bar)
          const targetBar = bars.find(b => b.isDefault) || bars[0];
          const existingTargetInventory = readInventoryForBar(targetBar.id);
          const merged = Array.from(new Set([...existingTargetInventory, ...legacyBottles]));
          writeInventoryForBar(targetBar.id, merged);
        }
      }

      // Safe to purge legacy keys once merged
      localStorage.removeItem(LEGACY_INVENTORY_STORAGE_KEY);
      localStorage.removeItem(LEGACY_BAR_NAME_STORAGE_KEY);
    }

    // 2. Prune any orphaned speakeasy_inventory__<barId> keys
    try {
      const rawBars = localStorage.getItem(BARS_STORAGE_KEY);
      const bars = rawBars ? JSON.parse(rawBars) : [];
      if (Array.isArray(bars) && bars.length > 0) {
        const validBarIds = new Set(bars.map(b => b && b.id).filter(Boolean));
        Object.keys(localStorage)
          .filter(key => key.startsWith(INVENTORY_KEY_PREFIX))
          .forEach(key => {
            const barId = key.slice(INVENTORY_KEY_PREFIX.length);
            if (!validBarIds.has(barId)) {
              localStorage.removeItem(key);
            }
          });
      }
    } catch (e) {
      console.error('Failed to prune orphaned bar inventory keys:', e);
    }
  } catch (err) {
    console.error('Error in cleanupAndPruneInventoryStorage:', err);
  }
}

/**
 * One-time, idempotent migration from the legacy single-bar storage shape
 * (one flat inventory array + one bar name) into the multi-bar registry.
 * Guarded by presence of BARS_STORAGE_KEY so it only ever runs once per browser.
 */
function ensureBarsInitialized() {
  let existing;
  try {
    existing = localStorage.getItem(BARS_STORAGE_KEY);
  } catch (err) {
    console.error('Failed to read bars registry from localStorage:', err);
    return;
  }

  if (existing) {
    // If bars already exist, clean up any lingering legacy single-bar keys or orphaned bar inventories
    cleanupAndPruneInventoryStorage();
    return;
  }

  const legacyName = (() => {
    try {
      return localStorage.getItem(LEGACY_BAR_NAME_STORAGE_KEY);
    } catch {
      return null;
    }
  })();
  const legacyInventory = (() => {
    try {
      const raw = localStorage.getItem(LEGACY_INVENTORY_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  })();

  const barId = generateBarId();
  const bar = {
    id: barId,
    name: (legacyName && legacyName.trim()) || 'Home Bar',
    isDefault: true,
    createdAt: Date.now(),
  };

  try {
    localStorage.setItem(BARS_STORAGE_KEY, JSON.stringify([bar]));
    localStorage.setItem(ACTIVE_BAR_ID_STORAGE_KEY, JSON.stringify(barId));
  } catch (err) {
    console.error('Failed to initialize bars registry:', err);
  }
  writeInventoryForBar(barId, legacyInventory);

  // Clean up legacy keys now that multi-bar is initialized
  try {
    localStorage.removeItem(LEGACY_INVENTORY_STORAGE_KEY);
    localStorage.removeItem(LEGACY_BAR_NAME_STORAGE_KEY);
  } catch {
    // ignore
  }
}

/**
 * Repairs an early-rollout data issue: a pre-existing single-bar account
 * could end up with two locally-stored bars both literally named "Home Bar"
 * (one from local migration, one appended from a cloud pull that didn't yet
 * reconcile bar identity by role — see importData()). Merges any such
 * duplicates into the earliest-created one, union-ing their inventories,
 * and repoints the active bar pointer if it referenced a merged-away id.
 */
function dedupeHomeBarDuplicates(bars) {
  const homeBarDupes = bars.filter(b => b.name === 'Home Bar');
  if (homeBarDupes.length <= 1) return bars;

  const sorted = homeBarDupes.slice().sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  const canonical = sorted[0];
  const duplicateIds = new Set(sorted.slice(1).map(b => b.id));

  const merged = new Set(readInventoryForBar(canonical.id));
  duplicateIds.forEach(dupId => {
    readInventoryForBar(dupId).forEach(id => merged.add(id));
    try {
      localStorage.removeItem(`${INVENTORY_KEY_PREFIX}${dupId}`);
    } catch (err) {
      console.error('Failed to remove duplicate bar inventory during dedupe:', err);
    }
  });
  writeInventoryForBar(canonical.id, Array.from(merged));

  const wasDefault = sorted.some(b => b.isDefault);
  const deduped = bars
    .filter(b => !duplicateIds.has(b.id))
    .map(b => (b.id === canonical.id ? { ...b, isDefault: wasDefault || b.isDefault } : b));
  saveBars(deduped);

  let activeId;
  try {
    const raw = localStorage.getItem(ACTIVE_BAR_ID_STORAGE_KEY);
    activeId = raw ? JSON.parse(raw) : null;
  } catch {
    activeId = null;
  }
  if (duplicateIds.has(activeId)) {
    setActiveBarId(canonical.id);
  }

  return deduped;
}

export function getBars() {
  ensureBarsInitialized();
  try {
    const raw = localStorage.getItem(BARS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    const bars = Array.isArray(parsed) ? parsed : [];
    return dedupeHomeBarDuplicates(bars);
  } catch (err) {
    console.error('Failed to read bars registry from localStorage:', err);
    return [];
  }
}

export function saveBars(bars) {
  try {
    localStorage.setItem(BARS_STORAGE_KEY, JSON.stringify(bars));
    scheduleCloudSync();
    return bars;
  } catch (err) {
    console.error('Failed to save bars registry to localStorage:', err);
    return bars;
  }
}

export function getBarById(barId) {
  return getBars().find(b => b.id === barId) || null;
}

/**
 * Returns the active bar id, self-healing if the stored pointer is missing
 * or refers to a bar that no longer exists (falls back to the default bar,
 * else the first bar, and persists that as the new pointer).
 */
export function getActiveBarId() {
  const bars = getBars();
  if (bars.length === 0) return null;

  let stored;
  try {
    const raw = localStorage.getItem(ACTIVE_BAR_ID_STORAGE_KEY);
    stored = raw ? JSON.parse(raw) : null;
  } catch {
    stored = null;
  }

  if (stored && bars.some(b => b.id === stored)) return stored;

  const fallback = bars.find(b => b.isDefault) || bars[0];
  try {
    localStorage.setItem(ACTIVE_BAR_ID_STORAGE_KEY, JSON.stringify(fallback.id));
  } catch (err) {
    console.error('Failed to persist active bar id:', err);
  }
  return fallback.id;
}

export function setActiveBarId(barId) {
  try {
    localStorage.setItem(ACTIVE_BAR_ID_STORAGE_KEY, JSON.stringify(barId));
  } catch (err) {
    console.error('Failed to set active bar id:', err);
  }
  return barId;
}

export function createBar(name) {
  const bars = getBars();
  const clean = (name || '').trim() || 'New Bar';
  const bar = { id: generateBarId(), name: clean, isDefault: bars.length === 0, createdAt: Date.now() };
  saveBars([...bars, bar]);
  writeInventoryForBar(bar.id, []);
  return bar;
}

export function renameBar(barId, name) {
  const bars = getBars();
  const clean = (name || '').trim() || 'New Bar';
  const updated = bars.map(b => (b.id === barId ? { ...b, name: clean } : b));
  saveBars(updated);
  return clean;
}

/**
 * Deletes a bar and its inventory. Refuses when it's the last remaining bar.
 * If the deleted bar was active, picks a fallback (default, else oldest
 * remaining) and updates the active pointer before returning.
 * Returns the new active bar id if it changed, otherwise null.
 */
export function deleteBar(barId) {
  const bars = getBars();
  if (bars.length <= 1) return null;

  const remaining = bars.filter(b => b.id !== barId);
  if (remaining.length === bars.length) return null; // barId not found

  const wasDefault = bars.find(b => b.id === barId)?.isDefault;
  if (wasDefault && !remaining.some(b => b.isDefault)) {
    remaining[0] = { ...remaining[0], isDefault: true };
  }
  saveBars(remaining);

  setInventoryChangesForBar(barId, null);
  try {
    localStorage.removeItem(`${INVENTORY_KEY_PREFIX}${barId}`);
  } catch (err) {
    console.error('Failed to remove deleted bar inventory:', err);
  }

  const activeId = getActiveBarId();
  if (activeId === barId || !remaining.some(b => b.id === activeId)) {
    const fallback = remaining.find(b => b.isDefault) || remaining[0];
    setActiveBarId(fallback.id);
    return fallback.id;
  }
  return null;
}

export function getInventory() {
  return readInventoryForBar(getActiveBarId());
}

/** Reads a specific bar's inventory without changing the active bar. */
export function getInventoryForBar(barId) {
  return readInventoryForBar(barId);
}

export function saveInventory(ids) {
  return writeInventoryForBar(getActiveBarId(), ids, { track: true });
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
export const SETTINGS_STORAGE_KEY = 'speakeasy_settings';
const UNIT_STORAGE_KEY = 'speakeasy_unit_system';

/**
 * Returns the consolidated app settings object, migrating any legacy standalone keys on read.
 */
export function getAppSettings() {
  let settings = {};
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        settings = parsed;
      }
    }
  } catch {
    settings = {};
  }

  // Migrate legacy individual preference keys on read if not already in speakeasy_settings
  let dirty = false;

  try {
    if (typeof localStorage !== 'undefined') {
      // 1. Unit preference
      if (settings.unitSystem === undefined) {
        const legacyUnit = localStorage.getItem(UNIT_STORAGE_KEY);
        if (legacyUnit !== null) {
          settings.unitSystem = legacyUnit === 'ml' ? 'ml' : 'oz';
          dirty = true;
          localStorage.removeItem(UNIT_STORAGE_KEY);
        }
      }

      // 2. Glass view mode
      if (settings.glassViewMode === undefined) {
        const legacyGlass = localStorage.getItem(GLASS_VIEW_STORAGE_KEY);
        if (legacyGlass !== null) {
          settings.glassViewMode = legacyGlass === 'blended' ? 'blended' : 'layered';
          dirty = true;
          localStorage.removeItem(GLASS_VIEW_STORAGE_KEY);
        }
      }

      // 3. Wake lock enabled (strictly coerced boolean)
      if (settings.wakeLockEnabled === undefined) {
        const legacyWake = localStorage.getItem(WAKE_LOCK_STORAGE_KEY);
        if (legacyWake !== null) {
          settings.wakeLockEnabled = legacyWake === 'true';
          dirty = true;
          localStorage.removeItem(WAKE_LOCK_STORAGE_KEY);
        }
      }

      // 4. Fun animations enabled (strictly coerced boolean)
      if (settings.funAnimationsEnabled === undefined) {
        const legacyFun = localStorage.getItem(FUN_STORAGE_KEY);
        if (legacyFun !== null) {
          settings.funAnimationsEnabled = legacyFun === 'true';
          dirty = true;
          localStorage.removeItem(FUN_STORAGE_KEY);
        }
      }

      // 5. Library sort preference
      if (settings.librarySort === undefined) {
        const legacySort = localStorage.getItem(SORT_PREFERENCE_STORAGE_KEY);
        if (legacySort !== null) {
          settings.librarySort = VALID_SORT_OPTIONS.has(legacySort) ? legacySort : 'curated';
          dirty = true;
          localStorage.removeItem(SORT_PREFERENCE_STORAGE_KEY);
        }
      }

      if (dirty) {
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
      }
    }
  } catch (err) {
    console.error('Failed to migrate legacy settings to speakeasy_settings:', err);
  }

  return settings;
}

export function saveAppSettings(updates) {
  try {
    const current = getAppSettings();
    const updated = { ...current, ...updates };
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(updated));
    scheduleCloudSync();
    return updated;
  } catch (err) {
    console.error('Failed to save app settings:', err);
    return updates;
  }
}

export function getUnitPreference() {
  const settings = getAppSettings();
  return settings.unitSystem === 'ml' ? 'ml' : 'oz';
}

export function saveUnitPreference(unit) {
  const clean = unit === 'ml' ? 'ml' : 'oz';
  saveAppSettings({ unitSystem: clean });
  try {
    // Also remove legacy key if still present
    localStorage.removeItem(UNIT_STORAGE_KEY);
  } catch {
    // ignore
  }
  return clean;
}

export function getBarName() {
  const bar = getBarById(getActiveBarId());
  return bar ? bar.name : DEFAULT_BAR_NAME;
}

export function saveBarName(name) {
  const activeId = getActiveBarId();
  if (!activeId) return (name || '').trim() || DEFAULT_BAR_NAME;
  return renameBar(activeId, name);
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
    scheduleCloudSync();
  } catch (err) {
    console.error('Failed to save avatar recipe id:', err);
  }
  return recipeId;
}

const GLASS_VIEW_STORAGE_KEY = 'speakeasy_glass_view_mode';

export function getGlassViewPreference() {
  const settings = getAppSettings();
  return settings.glassViewMode === 'blended' ? 'blended' : 'layered';
}

export function saveGlassViewPreference(mode) {
  const clean = mode === 'blended' ? 'blended' : 'layered';
  saveAppSettings({ glassViewMode: clean });
  try {
    localStorage.removeItem(GLASS_VIEW_STORAGE_KEY);
  } catch {
    // ignore
  }
  return clean;
}

const WAKE_LOCK_STORAGE_KEY = 'speakeasy_wake_lock_enabled';

export function getWakeLockPreference() {
  const settings = getAppSettings();
  return settings.wakeLockEnabled !== undefined ? Boolean(settings.wakeLockEnabled) : true;
}

export function saveWakeLockPreference(enabled) {
  const bool = Boolean(enabled);
  saveAppSettings({ wakeLockEnabled: bool });
  try {
    localStorage.removeItem(WAKE_LOCK_STORAGE_KEY);
  } catch {
    // ignore
  }
  return bool;
}

/**
 * "I make egg-white drinks with cocktail foamer" — a habit of the whole bar, not of
 * one menu. Egg drinks are then shown as made with foamer (guests and the library
 * alike) instead of as containing egg. Off unless the bartender turns it on.
 */
export function getFoamerPreference() {
  return getAppSettings().foamerForEgg === true;
}

export function saveFoamerPreference(enabled) {
  const bool = Boolean(enabled);
  saveAppSettings({ foamerForEgg: bool });
  return bool;
}

const FUN_STORAGE_KEY = 'speakeasy_fun_animations_enabled';

export function getFunPreference() {
  const settings = getAppSettings();
  return settings.funAnimationsEnabled !== undefined ? Boolean(settings.funAnimationsEnabled) : true;
}

export function saveFunPreference(enabled) {
  const bool = Boolean(enabled);
  saveAppSettings({ funAnimationsEnabled: bool });
  try {
    localStorage.removeItem(FUN_STORAGE_KEY);
  } catch {
    // ignore
  }
  return bool;
}

// Tags a user has "pinned" to appear as their own browsable collection on the Home
// page (e.g. tagging drinks "#house-favorites" and pinning that tag as a shelf).
const PINNED_TAGS_STORAGE_KEY = 'speakeasy_pinned_tags';

export function getPinnedTags() {
  try {
    const raw = localStorage.getItem(PINNED_TAGS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    // Pinned tags follow renames too, or a pin on a retired spelling
    // (say "historic") would quietly become an empty shelf on Home.
    const seen = new Set();
    return parsed
      .filter(t => typeof t === 'string')
      .map(normalizeTagName)
      .filter(t => t && !seen.has(t) && seen.add(t));
  } catch {
    return [];
  }
}

export function savePinnedTags(tags) {
  try {
    const clean = Array.isArray(tags) ? tags.filter(t => typeof t === 'string') : [];
    localStorage.setItem(PINNED_TAGS_STORAGE_KEY, JSON.stringify(clean));
    scheduleCloudSync();
    return clean;
  } catch (err) {
    console.error('Failed to save pinned tags:', err);
    return tags;
  }
}

const HOME_COLLECTIONS_ORDER_STORAGE_KEY = 'speakeasy_home_collections_order';

export function getHomeCollectionsOrder() {
  try {
    const raw = localStorage.getItem(HOME_COLLECTIONS_ORDER_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) ? parsed.filter(k => typeof k === 'string') : null;
  } catch {
    return null;
  }
}

export function saveHomeCollectionsOrder(order) {
  try {
    const clean = Array.isArray(order) ? order.filter(k => typeof k === 'string') : [];
    localStorage.setItem(HOME_COLLECTIONS_ORDER_STORAGE_KEY, JSON.stringify(clean));
    scheduleCloudSync();
    return clean;
  } catch (err) {
    console.error('Failed to save home collections order:', err);
    return order;
  }
}

const HIDDEN_HOME_COLLECTIONS_STORAGE_KEY = 'speakeasy_hidden_home_collections';

export function getHiddenHomeCollections() {
  try {
    const raw = localStorage.getItem(HIDDEN_HOME_COLLECTIONS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(k => typeof k === 'string') : [];
  } catch {
    return [];
  }
}

export function saveHiddenHomeCollections(hiddenKeys) {
  try {
    const clean = Array.isArray(hiddenKeys) ? hiddenKeys.filter(k => typeof k === 'string') : [];
    localStorage.setItem(HIDDEN_HOME_COLLECTIONS_STORAGE_KEY, JSON.stringify(clean));
    scheduleCloudSync();
    return clean;
  } catch (err) {
    console.error('Failed to save hidden home collections:', err);
    return hiddenKeys;
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
const VALID_SORT_OPTIONS = new Set(['curated', 'name-asc', 'name-desc', 'ready', 'specs-asc', 'abv-asc', 'calories-asc']);

export function getSortPreference() {
  const settings = getAppSettings();
  return VALID_SORT_OPTIONS.has(settings.librarySort) ? settings.librarySort : 'curated';
}

export function saveSortPreference(sortOption) {
  const clean = VALID_SORT_OPTIONS.has(sortOption) ? sortOption : 'curated';
  saveAppSettings({ librarySort: clean });
  try {
    localStorage.removeItem(SORT_PREFERENCE_STORAGE_KEY);
  } catch {
    // ignore
  }
  return clean;
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
    scheduleCloudSync();
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
// Menus deleted on this device, remembered so a sync doesn't bring them back from
// another device: { [menuId]: deletedAtMs }. See menu-merge.js.
const DELETED_MENUS_STORAGE_KEY = 'speakeasy_deleted_menus';

export function getDeletedMenus() {
  try {
    const parsed = JSON.parse(localStorage.getItem(DELETED_MENUS_STORAGE_KEY) || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function saveDeletedMenus(deleted) {
  try {
    localStorage.setItem(DELETED_MENUS_STORAGE_KEY, JSON.stringify(deleted || {}));
  } catch (err) {
    console.error('Failed to save deleted menus to localStorage:', err);
  }
}

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
    scheduleCloudSync();
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
    // When it was last saved: how another device decides which copy is newer.
    updatedAt: Date.now(),
  };
  // An "Always Ready" menu (see modules/ready-menu.js): its drink list is
  // computed from a bar's inventory, not picked by hand. `readyBarId` is
  // permanent — it's never moved by switching bars or adding more of them.
  if (menu.dynamic === 'ready' && typeof menu.readyBarId === 'string' && menu.readyBarId) {
    updatedMenu.dynamic = 'ready';
    updatedMenu.readyBarId = menu.readyBarId;
  }
  // Guest-link credentials for a published menu (see menu-publish.js).
  // Optional: most menus are never published.
  if (menu.share && typeof menu.share.id === 'string' && typeof menu.share.token === 'string') {
    const dietOverrides = sanitizeDietOverrides(menu.share.dietOverrides);
    updatedMenu.share = {
      id: menu.share.id,
      token: menu.share.token,
      outIds: Array.isArray(menu.share.outIds) ? menu.share.outIds.map(String) : [],
      featuredIds: Array.isArray(menu.share.featuredIds) ? menu.share.featuredIds.map(String) : [],
      // The host's dietary corrections; absent until they make one.
      ...(Object.keys(dietOverrides).length > 0 ? { dietOverrides } : {}),
    };
  }

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

/**
 * Attach (or, with `share = null`, remove) the published guest-link
 * credentials on a saved menu without touching its name or drinks.
 */
export function setMenuShare(id, share) {
  const menu = getMenus().find(m => m.id === id);
  if (!menu) return null;
  const { share: _previous, ...rest } = menu;
  return saveMenu(share ? { ...rest, share } : rest);
}

export function deleteMenu(id) {
  const filtered = getMenus().filter(m => m.id !== id);
  saveDeletedMenus({ ...getDeletedMenus(), [id]: Date.now() });
  saveMenus(filtered);
  return filtered;
}

