/**
 * Speakeasy Local Storage & Portability Module
 * Handles local persistence, JSON export, and JSON import.
 */

const STORAGE_KEY = 'speakeasy_recipes';

export const SEED_RECIPES = [
  {
    id: 'old-fashioned',
    name: 'Old Fashioned',
    glassware: 'Rocks',
    method: 'Stirred',
    garnish: 'Orange twist & cocktail cherry',
    description: 'A classic template highlighting fine whiskey accented by aromatic bitters and rich demerara sweetness.',
    instructions: '1. Add bourbon, demerara syrup, and bitters to a mixing glass filled with ice.\n2. Stir thoroughly for 25-30 seconds until well-chilled and properly diluted.\n3. Strain into a rocks glass over a single large ice cube.\n4. Express orange peel oils over the rim and garnish.',
    source: 'Classic',
    sourceUrl: '',
    notes: 'Build over a single large ice cube. Express orange peel oils over the glass rim.',
    specs: [
      { amount: 2, unit: 'oz', name: 'Bourbon' },
      { amount: 0.25, unit: 'oz', name: 'Demerara Syrup' },
      { amount: 2, unit: 'dashes', name: 'Angostura Bitters' },
      { amount: 1, unit: 'dash', name: 'Orange Bitters' },
    ],
  },
  {
    id: 'negroni',
    name: 'Negroni',
    glassware: 'Rocks',
    method: 'Stirred',
    garnish: 'Orange peel',
    description: 'An iconic Italian aperitivo balancing crisp botanical gin, bitter gentian and orange from Campari, and rich sweet vermouth.',
    instructions: '1. Combine gin, Campari, and sweet vermouth in a mixing glass with cracked ice.\n2. Stir for 20-30 seconds until cold.\n3. Strain into a chilled rocks glass over a large ice sphere or cube.\n4. Garnish with a freshly expressed orange peel.',
    source: 'Count Camillo Negroni, Florence (1919)',
    sourceUrl: '',
    notes: 'Equal parts classic. Stir with cracked ice and strain over a fresh ice sphere.',
    specs: [
      { amount: 1, unit: 'oz', name: 'London Dry Gin' },
      { amount: 1, unit: 'oz', name: 'Campari' },
      { amount: 1, unit: 'oz', name: 'Sweet Vermouth' },
    ],
  },
  {
    id: 'boulevardier',
    name: 'Boulevardier',
    glassware: 'Rocks',
    method: 'Stirred',
    garnish: 'Orange twist',
    description: 'A whiskey riff on the classic Negroni, created by Erskine Gwynne in 1920s Paris.',
    instructions: '1. Combine bourbon, Campari, and sweet vermouth in a mixing glass filled with ice.\n2. Stir for 25-30 seconds until well-chilled and integrated.\n3. Strain into a rocks glass over a large ice cube or into a chilled coupe.\n4. Express orange peel oils over the drink and garnish.',
    source: 'Erskine Gwynne, Paris (1927)',
    sourceUrl: '',
    notes: 'Whiskey riff on the Negroni. The rich vanilla and oak tones of bourbon soften the bitter Campari.',
    riffOfId: 'negroni',
    riffOfName: 'Negroni',
    specs: [
      { amount: 1.5, unit: 'oz', name: 'Bourbon' },
      { amount: 1, unit: 'oz', name: 'Campari' },
      { amount: 1, unit: 'oz', name: 'Sweet Vermouth' },
    ],
  },
  {
    id: 'daiquiri',
    name: 'Daiquiri',
    glassware: 'Coupe',
    method: 'Shaken',
    garnish: 'Lime wheel',
    notes: 'Shake hard with plenty of ice and fine-strain into a chilled coupe.',
    specs: [
      { amount: 2, unit: 'oz', name: 'White Rum' },
      { amount: 0.75, unit: 'oz', name: 'Fresh Lime Juice' },
      { amount: 0.75, unit: 'oz', name: 'Cane Sugar Syrup' },
    ],
  },
  {
    id: 'manhattan',
    name: 'Manhattan',
    glassware: 'Coupe',
    method: 'Stirred',
    garnish: 'Brandied cherry',
    notes: 'Stir thoroughly with ice for 30 seconds to achieve silky dilution and chill.',
    specs: [
      { amount: 2, unit: 'oz', name: 'Rye Whiskey' },
      { amount: 1, unit: 'oz', name: 'Sweet Vermouth' },
      { amount: 2, unit: 'dashes', name: 'Angostura Bitters' },
    ],
  },
  {
    id: 'margarita',
    name: 'Margarita',
    glassware: 'Coupe',
    method: 'Shaken',
    garnish: 'Half salt rim & lime wedge',
    notes: 'Shake with clean ice and fine-strain into a chilled coupe.',
    specs: [
      { amount: 2, unit: 'oz', name: 'Blanco Tequila' },
      { amount: 1, unit: 'oz', name: 'Cointreau' },
      { amount: 0.75, unit: 'oz', name: 'Fresh Lime Juice' },
      { amount: 0.25, unit: 'oz', name: 'Agave Nectar' },
    ],
  },
  {
    id: 'sazerac',
    name: 'Sazerac',
    glassware: 'Rocks',
    method: 'Stirred',
    garnish: 'Lemon peel (expressed & discarded)',
    notes: 'Chill a rocks glass with ice. Coat with absinthe rinse. Stir remaining spirits with ice and strain neat.',
    specs: [
      { amount: 2, unit: 'oz', name: 'Rye Whiskey' },
      { amount: 0.25, unit: 'oz', name: 'Rich Simple Syrup' },
      { amount: 3, unit: 'dashes', name: 'Peychaud\'s Bitters' },
      { amount: 1, unit: 'dash', name: 'Angostura Bitters' },
      { amount: null, unit: 'rinse', name: 'Absinthe' },
    ],
  },
  {
    id: 'last-word',
    name: 'Last Word',
    glassware: 'Coupe',
    method: 'Shaken',
    garnish: 'Brandied cherry',
    notes: 'Equal parts pre-prohibition standard from the Detroit Athletic Club.',
    specs: [
      { amount: 0.75, unit: 'oz', name: 'London Dry Gin' },
      { amount: 0.75, unit: 'oz', name: 'Green Chartreuse' },
      { amount: 0.75, unit: 'oz', name: 'Maraschino Liqueur' },
      { amount: 0.75, unit: 'oz', name: 'Fresh Lime Juice' },
    ],
  },
  {
    id: 'whiskey-sour',
    name: 'Whiskey Sour',
    glassware: 'Coupe',
    method: 'Shaken',
    garnish: 'Angostura drops & lemon wheel',
    notes: 'Shake with ice and double strain. Optional dry shake with egg white or aquafaba for texture.',
    specs: [
      { amount: 2, unit: 'oz', name: 'Bourbon' },
      { amount: 0.75, unit: 'oz', name: 'Fresh Lemon Juice' },
      { amount: 0.75, unit: 'oz', name: 'Simple Syrup' },
      { amount: 1, unit: 'dash', name: 'Angostura Bitters' },
    ],
  },
  {
    id: 'gin-and-tonic',
    name: 'Gin & Tonic',
    glassware: 'Highball',
    method: 'Built',
    garnish: 'Lime wedge',
    notes: 'Pour gin over clean ice spears, top with cold tonic water, stir once gently to preserve carbonation.',
    specs: [
      { amount: 2, unit: 'oz', name: 'London Dry Gin' },
      { amount: 4, unit: 'oz', name: 'Tonic Water' },
    ],
  },
];

export function getRecipes() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_RECIPES));
      return SEED_RECIPES;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      // Ensure seed riff relationship exists for users with previously cached storage
      const hasBoulevardier = parsed.some(r => r.id === 'boulevardier');
      if (!hasBoulevardier) {
        const bRecipe = SEED_RECIPES.find(r => r.id === 'boulevardier');
        if (bRecipe) {
          parsed.push(bRecipe);
          saveRecipes(parsed);
        }
      }
      return parsed;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_RECIPES));
    return SEED_RECIPES;
  } catch (err) {
    console.error('Failed to read recipes from localStorage:', err);
    return SEED_RECIPES;
  }
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
  const id = recipe.id || `recipe-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const updatedRecipe = { ...recipe, id };

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
    id: item.id || `recipe-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
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

export function resetToDefaults() {
  saveRecipes(SEED_RECIPES);
  return SEED_RECIPES;
}
