/**
 * Speakeasy ABV Calculation Module
 * Provides default alcohol content heuristics and dilution-adjusted cocktail ABV math.
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
