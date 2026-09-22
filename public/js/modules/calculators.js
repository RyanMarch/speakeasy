/**
 * Speakeasy Bartender Calculator Suite
 * Pure math for freezer-door batching, acid adjustment of citrus substitutes,
 * and simple/rich syrup Brix calculations. No DOM, no storage — safe to unit test directly.
 */

import { normalizeVolumeToOz } from './colors.js';

export const OZ_TO_ML = 29.5735;
export const ML_TO_OZ = 1 / OZ_TO_ML;

// Dilution added by melting ice at serving time, by build method — mirrors
// js/modules/abv.js's METHOD_DILUTION (kept as its own copy here since abv.js
// scopes its table to ABV math, and importing it back would be a needless
// cross-module coupling for one shared constant).
const METHOD_DILUTION = {
  shaken: 0.32,
  stirred: 0.22,
  built: 0.05,
  blended: 0.45,
  rolled: 0.18,
};

function round2(n) {
  return Math.round(n * 100) / 100;
}

/**
 * The dilution rate (fraction of final volume that is melted ice) for a
 * given build method, defaulting to a middle-of-the-road 20% for unknown methods.
 */
export function getMethodDilutionRate(method = '') {
  const clean = (method || '').toLowerCase().trim();
  return METHOD_DILUTION[clean] ?? 0.20;
}

/**
 * Scales a recipe's ingredient specs to fill a target bottle volume for
 * freezer-door batching, adding the pre-dilution filtered water a shaken or
 * stirred drink would otherwise pick up from melting ice at serving time
 * (since a frozen batch is poured neat, straight from the freezer).
 *
 * @param {{ specs?: Array<{name:string, amount:number, unit?:string}>, method?: string }} recipe
 * @param {number} targetBottleMl - target bottle size in mL (e.g. 375, 750, 1000)
 * @returns {{ servings: number, dilutionRate: number, ingredients: Array, dilutionWaterOz: number, dilutionWaterMl: number, totalVolumeOz: number, totalVolumeMl: number }}
 */
export function calculateBatch(recipe, targetBottleMl) {
  const specs = (recipe?.specs || []).filter(s => s && s.name && s.amount);
  const dilutionRate = getMethodDilutionRate(recipe?.method);
  const targetMl = Number(targetBottleMl) || 0;
  const targetVolumeOz = targetMl * ML_TO_OZ;

  const baseSpecOz = specs.reduce((sum, s) => sum + normalizeVolumeToOz(s.amount, s.unit), 0);

  if (baseSpecOz <= 0 || targetMl <= 0) {
    return {
      servings: 0,
      dilutionRate,
      ingredients: [],
      dilutionWaterOz: 0,
      dilutionWaterMl: 0,
      totalVolumeOz: round2(targetVolumeOz),
      totalVolumeMl: round2(targetMl),
    };
  }

  // Each serving's effective volume once diluted is baseSpecOz * (1 + dilutionRate);
  // servings is however many of those fit in the target bottle.
  const baseServingVolumeOz = baseSpecOz * (1 + dilutionRate);
  const servings = targetVolumeOz / baseServingVolumeOz;

  const ingredients = specs.map(s => {
    const baseOz = normalizeVolumeToOz(s.amount, s.unit);
    const scaledOz = baseOz * servings;
    return {
      name: s.name,
      baseAmount: s.amount,
      baseUnit: s.unit || 'oz',
      scaledOz: round2(scaledOz),
      scaledMl: round2(scaledOz * OZ_TO_ML),
    };
  });

  const dilutionWaterOz = baseSpecOz * dilutionRate * servings;

  return {
    servings: round2(servings),
    dilutionRate,
    ingredients,
    dilutionWaterOz: round2(dilutionWaterOz),
    dilutionWaterMl: round2(dilutionWaterOz * OZ_TO_ML),
    totalVolumeOz: round2(targetVolumeOz),
    totalVolumeMl: round2(targetMl),
  };
}

// Approximate total titratable acid as a fraction of juice weight/volume —
// citrus references (lemon/lime, ~6%) are the target strengths callers
// adjust *to*; these are what lower-acid juices need topping up *from*.
export const JUICE_ACID_PROFILES = {
  orange: 0.010,
  grapefruit: 0.016,
  pineapple: 0.008,
};

export const ACID_TARGET_PROFILES = {
  lemon: { totalAcidFraction: 0.06, citricParts: 1, malicParts: 0 },
  lime: { totalAcidFraction: 0.06, citricParts: 2, malicParts: 1 },
};

/**
 * Determines citric acid + malic acid powder (in grams) needed to bring a
 * non-citrus juice up to lemon- or lime-equivalent acidity.
 *
 * @param {'orange'|'grapefruit'|'pineapple'} juiceType
 * @param {number} volumeMl
 * @param {'lemon'|'lime'} [targetStrength='lemon']
 */
export function calculateAcidAdjustment(juiceType, volumeMl, targetStrength = 'lemon') {
  const juiceKey = (juiceType || '').toLowerCase().trim();
  const targetKey = (targetStrength || '').toLowerCase().trim();
  const juiceAcidFraction = JUICE_ACID_PROFILES[juiceKey] ?? 0;
  const target = ACID_TARGET_PROFILES[targetKey] || ACID_TARGET_PROFILES.lemon;
  const vol = Number(volumeMl) || 0;

  const acidDeficitFraction = Math.max(0, target.totalAcidFraction - juiceAcidFraction);
  const totalAcidGrams = vol * acidDeficitFraction;

  const totalParts = target.citricParts + target.malicParts || 1;
  const citricAcidGrams = totalAcidGrams * (target.citricParts / totalParts);
  const malicAcidGrams = totalAcidGrams * (target.malicParts / totalParts);

  return {
    juiceType: juiceKey,
    targetStrength: targetKey,
    volumeMl: round2(vol),
    citricAcidGrams: round2(citricAcidGrams),
    malicAcidGrams: round2(malicAcidGrams),
    totalAcidGrams: round2(totalAcidGrams),
  };
}

/**
 * Calculates Brix (°Bx, sugar % by weight) and finished yield for a syrup,
 * treating water as 1g/mL. Works the same for simple (1:1), rich (2:1), or
 * any custom sugar:water ratio — the ratio is just whatever the caller passes.
 *
 * @param {number} sugarGrams
 * @param {number} waterMl
 */
export function calculateBrix(sugarGrams, waterMl) {
  const sugar = Number(sugarGrams) || 0;
  const water = Number(waterMl) || 0;
  const totalWeightGrams = sugar + water;
  const brix = totalWeightGrams > 0 ? (sugar / totalWeightGrams) * 100 : 0;

  // Approximate specific gravity from Brix (~0.004 SG per degree Brix),
  // close enough to convert dissolved-sugar mass back into a poured volume.
  const density = 1 + (brix * 0.00387);
  const finalVolumeMl = density > 0 ? totalWeightGrams / density : 0;

  return {
    sugarGrams: round2(sugar),
    waterMl: round2(water),
    brix: round2(brix),
    density: Math.round(density * 1000) / 1000,
    finalVolumeMl: round2(finalVolumeMl),
    finalVolumeOz: round2(finalVolumeMl * ML_TO_OZ),
  };
}
