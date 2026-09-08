/**
 * Speakeasy ABV Calculation Module
 * Provides default alcohol content heuristics and dilution-adjusted cocktail ABV math.
 * Also provides calorie estimation based on alcohol and sugar content.
 */

import { normalizeVolumeToOz } from './colors.js';
import { getIngredientMetadata } from './taxonomy.js';

// Default ABV percentages by ingredient regex patterns
const INGREDIENT_ABV_MAP = [
  // High proof specialty liqueurs
  { pattern: /\b(absinthe|pastis)\b/i, abv: 60 },
  { pattern: /\b(green chartreuse)\b/i, abv: 55 },
  { pattern: /\b(yellow chartreuse)\b/i, abv: 43 },

  // Standard base spirits (bourbon, gin, tequila, rum, vodka, etc.)
  { pattern: /\b(bourbon|rye|whiskey|whisky|scotch|cognac|brandy|calvados)\b/i, abv: 40 },
  { pattern: /\b(gin|london dry|plymouth)\b/i, abv: 40 },
  { pattern: /\b(tequila|mezcal|pisco|aquavit)\b/i, abv: 40 },
  { pattern: /\b(vodka)\b/i, abv: 40 },
  { pattern: /\b(white rum|light rum|dark rum|aged rum|gold rum|demerara rum)\b/i, abv: 40 },

  // Bitters
  { pattern: /\b(angostura|peychaud|bitters?)\b/i, abv: 44.7 },

  // Triple Sec & Orange Liqueurs
  { pattern: /\b(cointreau|grand marnier)\b/i, abv: 40 },
  { pattern: /\b(triple sec|blue cura[cç]ao|cura[cç]ao)\b/i, abv: 25 },

  // Maraschino & botanical liqueurs
  { pattern: /\b(maraschino)\b/i, abv: 32 },
  { pattern: /\b(benedictine|strega)\b/i, abv: 40 },
  { pattern: /\b(drambuie)\b/i, abv: 40 },

  // Amari & Aperitivi
  { pattern: /\b(campari)\b/i, abv: 24 },
  { pattern: /\b(aperol)\b/i, abv: 11 },
  { pattern: /\b(cynar)\b/i, abv: 16.5 },
  { pattern: /\b(averna|nonino|amaro)\b/i, abv: 29 },
  { pattern: /\b(fernet)\b/i, abv: 39 },

  // Fortified wines & Vermouths
  { pattern: /\b(sweet vermouth|rosso|dry vermouth|blanc vermouth|lillet|cocchi|punt e mes)\b/i, abv: 16 },
  { pattern: /\b(sherry|port)\b/i, abv: 18 },

  // Coffee & sweet liqueurs
  { pattern: /\b(kahl[uú]a|coffee liqueur|tia maria)\b/i, abv: 20 },
  { pattern: /\b(baileys|irish cream)\b/i, abv: 17 },
  { pattern: /\b(amaretto|frangelico)\b/i, abv: 24 },

  // Sparkling wines & beers
  { pattern: /\b(champagne|prosecco|cava|sparkling wine)\b/i, abv: 12 },
  { pattern: /\b(beer|cider)\b/i, abv: 5 },

  // Non-alcoholic mixers, juices, and syrups
  { pattern: /\b(juice|lime|lemon|grapefruit|orange|pineapple)\b/i, abv: 0 },
  { pattern: /\b(syrup|sugar|agave|honey|demerara|orgeat|grenadine|molasses)\b/i, abv: 0 },
  { pattern: /\b(tonic|soda|water|seltzer|ginger beer|ginger ale|cola)\b/i, abv: 0 },
  { pattern: /\b(egg white|cream|milk|saline)\b/i, abv: 0 },
];

/**
 * Approximate sugar-derived calories per fluid ounce for common cocktail ingredients.
 * Base spirits have near-zero sugar; sweeteners and liqueurs carry the bulk.
 * Values derived from USDA FoodData Central and standard bartending references.
 */
const INGREDIENT_SUGAR_KCAL_MAP = [
  // Pure sweeteners & syrups — highest sugar density
  { pattern: /\b(orgeat)\b/i, kcalPerOz: 95 },
  { pattern: /\b(honey|maple syrup|maple)\b/i, kcalPerOz: 90 },
  { pattern: /\b(rich demerara|rich simple|demerara syrup|brown sugar syrup)\b/i, kcalPerOz: 88 },
  { pattern: /\b(simple syrup|sugar syrup|cane syrup|gomme|2:1 syrup)\b/i, kcalPerOz: 80 },
  { pattern: /\b(agave|agave nectar)\b/i, kcalPerOz: 82 },
  { pattern: /\b(grenadine|pomegranate syrup)\b/i, kcalPerOz: 70 },
  { pattern: /\b(raspberry syrup|strawberry syrup|passion fruit syrup)\b/i, kcalPerOz: 72 },

  // Sweet liqueurs
  { pattern: /\b(amaretto|frangelico|disaronno)\b/i, kcalPerOz: 88 },
  { pattern: /\b(kahl[uú]a|coffee liqueur|tia maria)\b/i, kcalPerOz: 85 },
  { pattern: /\b(baileys|irish cream)\b/i, kcalPerOz: 80 },
  { pattern: /\b(cointreau|grand marnier|triple sec|orange cura[cç]ao)\b/i, kcalPerOz: 78 },
  { pattern: /\b(cura[cç]ao)\b/i, kcalPerOz: 72 },
  { pattern: /\b(maraschino)\b/i, kcalPerOz: 72 },
  { pattern: /\b(benedictine|strega|drambuie|yellow chartreuse)\b/i, kcalPerOz: 80 },
  { pattern: /\b(green chartreuse)\b/i, kcalPerOz: 55 },
  { pattern: /\b(st[\. -]germain|elderflower liqueur)\b/i, kcalPerOz: 85 },

  // Amari & aperitivi (lower sugar than liqueurs)
  { pattern: /\b(campari)\b/i, kcalPerOz: 65 },
  { pattern: /\b(aperol)\b/i, kcalPerOz: 50 },
  { pattern: /\b(cynar|averna|amaro|nonino)\b/i, kcalPerOz: 60 },
  { pattern: /\b(fernet)\b/i, kcalPerOz: 40 },

  // Fortified wines & vermouths
  { pattern: /\b(sweet vermouth|rosso|punt e mes|carpano)\b/i, kcalPerOz: 42 },
  { pattern: /\b(cocchi americano|cocchi)\b/i, kcalPerOz: 35 },
  { pattern: /\b(lillet)\b/i, kcalPerOz: 30 },
  { pattern: /\b(dry vermouth|blanc vermouth)\b/i, kcalPerOz: 18 },
  { pattern: /\b(sherry)\b/i, kcalPerOz: 35 },
  { pattern: /\b(port)\b/i, kcalPerOz: 45 },

  // Sparkling wines
  { pattern: /\b(champagne|prosecco|cava|sparkling wine)\b/i, kcalPerOz: 22 },

  // Juices (natural sugar)
  { pattern: /\b(pineapple juice|pineapple)\b/i, kcalPerOz: 16 },
  { pattern: /\b(orange juice|fresh orange)\b/i, kcalPerOz: 14 },
  { pattern: /\b(passion fruit)\b/i, kcalPerOz: 17 },
  { pattern: /\b(grapefruit juice|grapefruit)\b/i, kcalPerOz: 12 },
  { pattern: /\b(lime juice|fresh lime|lime)\b/i, kcalPerOz: 8 },
  { pattern: /\b(lemon juice|fresh lemon|lemon)\b/i, kcalPerOz: 8 },
  { pattern: /\b(cranberry juice|cranberry)\b/i, kcalPerOz: 14 },
  { pattern: /\b(apple juice|apple cider)\b/i, kcalPerOz: 15 },

  // Mixers with sugar
  { pattern: /\b(tonic water|tonic)\b/i, kcalPerOz: 11 },
  { pattern: /\b(ginger beer)\b/i, kcalPerOz: 13 },
  { pattern: /\b(ginger ale)\b/i, kcalPerOz: 11 },
  { pattern: /\b(cola)\b/i, kcalPerOz: 12 },
  { pattern: /\b(coconut cream|coco lopez)\b/i, kcalPerOz: 70 },
  { pattern: /\b(cream of coconut)\b/i, kcalPerOz: 65 },

  // Zero or near-zero sugar
  { pattern: /\b(club soda|soda water|seltzer|sparkling water)\b/i, kcalPerOz: 0 },
  { pattern: /\b(water)\b/i, kcalPerOz: 0 },
  { pattern: /\b(saline|saline solution)\b/i, kcalPerOz: 0 },
  { pattern: /\b(egg white|aquafaba)\b/i, kcalPerOz: 4 },
  { pattern: /\b(heavy cream|cream)\b/i, kcalPerOz: 30 },
  { pattern: /\b(milk)\b/i, kcalPerOz: 8 },
  { pattern: /\b(bitters?|angostura|peychaud|mole bitters|orange bitters)\b/i, kcalPerOz: 0 },

  // Base spirits — alcohol calories are handled separately; sugar content is negligible
  { pattern: /\b(bourbon|rye|whiskey|whisky|scotch|cognac|brandy|calvados|gin|vodka|tequila|mezcal|rum|pisco|aquavit|absinthe|pastis)\b/i, kcalPerOz: 0 },
];

// Dilution factor added to liquid volume from melting ice
const METHOD_DILUTION = {
  shaken: 0.32,   // ~30-35% dilution from hard shaking
  stirred: 0.22,  // ~20-25% dilution from stirring
  built: 0.05,    // minor dilution
  blended: 0.45,  // high dilution from crushed ice
  rolled: 0.18,
};

export function estimateIngredientAbv(name = '') {
  const trimmed = name.trim();
  if (!trimmed) return 0;

  // 1. Check hierarchical taxonomy
  const meta = getIngredientMetadata(trimmed);
  if (meta && typeof meta.defaultAbv === 'number') {
    return meta.defaultAbv;
  }

  // 2. Legacy pattern match fallback
  for (const entry of INGREDIENT_ABV_MAP) {
    if (entry.pattern.test(trimmed)) {
      return entry.abv;
    }
  }
  return 0;
}

/**
 * Estimates sugar-derived calories per fluid ounce for a given ingredient name.
 * @param {string} name
 * @returns {number} kcal per oz from carbohydrates/sugar (not alcohol)
 */
function estimateIngredientSugarKcalPerOz(name = '') {
  const trimmed = name.trim();
  if (!trimmed) return 0;
  for (const entry of INGREDIENT_SUGAR_KCAL_MAP) {
    if (entry.pattern.test(trimmed)) {
      return entry.kcalPerOz;
    }
  }
  return 0;
}

/**
 * Calculates pre-dilution and dilution-adjusted ABV for a recipe.
 */
export function calculateCocktailAbv(specs = [], method = 'Stirred') {
  if (!specs || specs.length === 0) {
    return { estimatedAbv: 0, rawAbv: 0, pureAlcoholOz: 0, totalLiquidOz: 0 };
  }

  let totalLiquidOz = 0;
  let totalPureAlcoholOz = 0;

  for (const spec of specs) {
    if (!spec || !spec.name) continue;
    const volOz = normalizeVolumeToOz(spec.amount, spec.unit);
    const abvPercent = spec.abv !== undefined && spec.abv !== null && !isNaN(Number(spec.abv))
      ? Number(spec.abv)
      : estimateIngredientAbv(spec.name);

    totalLiquidOz += volOz;
    totalPureAlcoholOz += volOz * (abvPercent / 100);
  }

  if (totalLiquidOz === 0) {
    return { estimatedAbv: 0, rawAbv: 0, pureAlcoholOz: 0, totalLiquidOz: 0 };
  }

  const cleanMethod = (method || '').toLowerCase().trim();
  const dilution = METHOD_DILUTION[cleanMethod] ?? 0.20;

  const rawAbv = (totalPureAlcoholOz / totalLiquidOz) * 100;
  const estimatedAbv = (totalPureAlcoholOz / (totalLiquidOz * (1 + dilution))) * 100;

  return {
    rawAbv: Math.round(rawAbv * 10) / 10,
    estimatedAbv: Math.round(estimatedAbv * 10) / 10,
    pureAlcoholOz: Math.round(totalPureAlcoholOz * 100) / 100,
    totalLiquidOz: Math.round(totalLiquidOz * 100) / 100,
  };
}

/**
 * Estimates total calories for a cocktail recipe (one serving).
 *
 * Alcohol calories: volume_mL × ABV% × 0.789 (ethanol density g/mL) × 7 kcal/g
 * Sugar calories:   volume_oz × sugar_kcal_per_oz (from lookup table)
 *
 * @param {Array} specs - Recipe spec objects with amount, unit, name, and optional abv
 * @returns {{ totalKcal: number, alcoholKcal: number, sugarKcal: number }}
 */
export function calculateCocktailCalories(specs = []) {
  if (!specs || specs.length === 0) {
    return { totalKcal: 0, alcoholKcal: 0, sugarKcal: 0 };
  }

  let alcoholKcal = 0;
  let sugarKcal = 0;

  for (const spec of specs) {
    if (!spec || !spec.name) continue;
    const volOz = normalizeVolumeToOz(spec.amount, spec.unit);
    if (volOz <= 0) continue;

    const abvPercent = spec.abv !== undefined && spec.abv !== null && !isNaN(Number(spec.abv))
      ? Number(spec.abv)
      : estimateIngredientAbv(spec.name);

    // Alcohol calories: convert oz to mL, then apply Atwater factor
    const volMl = volOz * 29.5735;
    const ethanolGrams = volMl * (abvPercent / 100) * 0.789;
    alcoholKcal += ethanolGrams * 7;

    // Sugar calories from lookup table
    const sugarKcalPerOz = estimateIngredientSugarKcalPerOz(spec.name);
    sugarKcal += volOz * sugarKcalPerOz;
  }

  const totalKcal = Math.round(alcoholKcal + sugarKcal);

  return {
    totalKcal,
    alcoholKcal: Math.round(alcoholKcal),
    sugarKcal: Math.round(sugarKcal),
  };
}
