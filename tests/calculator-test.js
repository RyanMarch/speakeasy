import assert from 'node:assert/strict';
import { calculateBatch, calculateAcidAdjustment, calculateBrix, getMethodDilutionRate } from '../js/modules/calculators.js';

console.log('--- Testing js/modules/calculators.js ---');

// 1. Batch math: dilution rate lookup
{
  assert.equal(getMethodDilutionRate('Stirred'), 0.22);
  assert.equal(getMethodDilutionRate('Shaken'), 0.32);
  assert.equal(getMethodDilutionRate('unknown-method'), 0.20);
  console.log('PASS: getMethodDilutionRate resolves known and default methods');
}

// 2. Batch math: shaken drinks batch in more dilution water than stirred, for the same recipe/bottle
{
  const baseSpecs = [
    { name: 'Rye Whiskey', amount: 2, unit: 'oz' },
    { name: 'Sweet Vermouth', amount: 1, unit: 'oz' },
    { name: 'Angostura Bitters', amount: 0.125, unit: 'oz' },
  ];
  const stirredRecipe = { method: 'Stirred', specs: baseSpecs };
  const shakenRecipe = { method: 'Shaken', specs: baseSpecs };

  const stirredBatch = calculateBatch(stirredRecipe, 750);
  const shakenBatch = calculateBatch(shakenRecipe, 750);

  assert.ok(stirredBatch.dilutionWaterMl > 0, 'Stirred batch has positive dilution water');
  assert.ok(shakenBatch.dilutionWaterMl > 0, 'Shaken batch has positive dilution water');
  assert.ok(shakenBatch.dilutionWaterMl > stirredBatch.dilutionWaterMl, 'Shaken batches in more dilution water than stirred for the same bottle');

  // Total ingredient + water volume should reconstruct the target bottle size
  const stirredIngredientMl = stirredBatch.ingredients.reduce((sum, i) => sum + i.scaledMl, 0);
  assert.ok(Math.abs((stirredIngredientMl + stirredBatch.dilutionWaterMl) - 750) < 1, 'Stirred batch ingredients + water reconstruct the target bottle volume');

  const shakenIngredientMl = shakenBatch.ingredients.reduce((sum, i) => sum + i.scaledMl, 0);
  assert.ok(Math.abs((shakenIngredientMl + shakenBatch.dilutionWaterMl) - 750) < 1, 'Shaken batch ingredients + water reconstruct the target bottle volume');

  console.log('PASS: calculateBatch scales ingredients and dilution water correctly for stirred vs shaken');
}

// 3. Batch math: scales proportionally to target bottle size
{
  const recipe = { method: 'Stirred', specs: [{ name: 'Gin', amount: 2, unit: 'oz' }, { name: 'Dry Vermouth', amount: 0.5, unit: 'oz' }] };
  const batch375 = calculateBatch(recipe, 375);
  const batch750 = calculateBatch(recipe, 750);
  assert.ok(Math.abs(batch750.servings - batch375.servings * 2) < 0.01, 'Doubling target bottle size doubles servings');
  console.log('PASS: calculateBatch scales proportionally with target bottle size');
}

// 4. Acid adjustment: lemon target uses pure citric acid (no malic)
{
  const result = calculateAcidAdjustment('orange', 500, 'lemon');
  assert.equal(result.malicAcidGrams, 0, 'Lemon-strength adjustment uses zero malic acid');
  assert.ok(result.citricAcidGrams > 0, 'Lemon-strength adjustment uses positive citric acid');
  console.log('PASS: calculateAcidAdjustment (lemon target) uses pure citric acid');
}

// 5. Acid adjustment: lime target uses a 2:1 citric:malic ratio
{
  const result = calculateAcidAdjustment('grapefruit', 500, 'lime');
  assert.ok(result.citricAcidGrams > 0, 'Lime-strength adjustment uses positive citric acid');
  assert.ok(result.malicAcidGrams > 0, 'Lime-strength adjustment uses positive malic acid');
  const ratio = result.citricAcidGrams / result.malicAcidGrams;
  assert.ok(Math.abs(ratio - 2) < 0.01, `Lime-strength adjustment keeps a 2:1 citric:malic ratio (found ${ratio})`);
  console.log('PASS: calculateAcidAdjustment (lime target) keeps a 2:1 citric:malic ratio');
}

// 6. Acid adjustment: higher-acid juices need less powder than lower-acid juices
{
  const orangeResult = calculateAcidAdjustment('orange', 500, 'lemon');
  const pineappleResult = calculateAcidAdjustment('pineapple', 500, 'lemon');
  assert.ok(pineappleResult.totalAcidGrams > orangeResult.totalAcidGrams, 'Lower-acid pineapple juice needs more acid powder than orange juice');
  console.log('PASS: calculateAcidAdjustment scales inversely with the juice\'s native acidity');
}

// 7. Brix: simple syrup (1:1 by weight) lands near 50 Brix
{
  const simple = calculateBrix(100, 100);
  assert.ok(Math.abs(simple.brix - 50) < 0.5, `Simple syrup Brix near 50 (found ${simple.brix})`);
  console.log('PASS: calculateBrix computes ~50 Brix for a 1:1 simple syrup');
}

// 8. Brix: rich syrup (2:1 by weight) is higher Brix than simple syrup, with less water yielding less final volume
{
  const rich = calculateBrix(200, 100);
  const simple = calculateBrix(100, 100);
  assert.ok(rich.brix > simple.brix, 'Rich syrup has a higher Brix than simple syrup');
  assert.ok(Math.abs(rich.brix - 66.67) < 0.5, `Rich syrup Brix near 66.67 (found ${rich.brix})`);
  console.log('PASS: calculateBrix computes ~66.67 Brix for a 2:1 rich syrup');
}

// 9. Brix: zero sugar yields zero Brix
{
  const zero = calculateBrix(0, 200);
  assert.equal(zero.brix, 0);
  console.log('PASS: calculateBrix returns 0 Brix for plain water');
}

console.log('All Calculator tests passed successfully!');
