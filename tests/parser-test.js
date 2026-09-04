import { parseIngredientLine, parseSpecsBlock, formatFraction } from '../js/modules/parser.js';
import { calculateFluidLayers, normalizeVolumeToOz } from '../js/modules/colors.js';
import { resolveGlassware } from '../js/modules/glassware.js';
import { calculateCocktailAbv, estimateIngredientAbv } from '../js/modules/abv.js';

console.log('--- Testing Parser ---');
const testCases = [
  '0.75 oz Bourbon',
  '1 1/2 oz Gin',
  '2 dashes Angostura',
  'Rinse Absinthe',
  '3/4 oz Fresh Lime Juice',
  '¾ oz Fresh Lime Juice',
  '1 ½ oz Rye Whiskey',
  '½ oz Demerara Syrup',
  '1 barspoon Demerara Gum Syrup',
  '2 drops Saline Solution',
  '1 oz Campari',
];

for (const line of testCases) {
  const parsed = parseIngredientLine(line);
  console.log(`Input: "${line}" =>`, parsed);
}

console.log('--- Testing Fractions Formatting ---');
console.log('0.75 =>', formatFraction(0.75));
console.log('1.5 =>', formatFraction(1.5));
console.log('0.333 =>', formatFraction(0.333));
console.log('2 =>', formatFraction(2));

console.log('--- Testing Multi-line Block ---');
const block = `
  2 oz Bourbon
  0.75 oz Lemon Juice
  0.75 oz Simple Syrup
  1 dash Angostura
`;
const specs = parseSpecsBlock(block);
console.log('Parsed block count:', specs.length);

console.log('--- Testing Fluid Calculation ---');
const layers = calculateFluidLayers(specs);
console.log('Layers count:', layers.length);
layers.forEach(l => {
  console.log(`- ${l.spec.name}: ${l.volOz.toFixed(3)} oz (${(l.ratio * 100).toFixed(1)}%) start=${l.startRatio.toFixed(2)} end=${l.endRatio.toFixed(2)} color=${l.color}`);
});

console.log('--- Testing Glassware Resolution ---');
console.log('Coupe:', resolveGlassware('Coupe').id);
console.log('Rocks:', resolveGlassware('Old Fashioned').id);
console.log('Highball:', resolveGlassware('Collins').id);
console.log('Martini:', resolveGlassware('Martini').id);

console.log('--- Testing ABV Module ---');
console.log('Bourbon estimate:', estimateIngredientAbv('Bourbon'), '%');
console.log('Campari estimate:', estimateIngredientAbv('Campari'), '%');
console.log('Lime Juice estimate:', estimateIngredientAbv('Lime Juice'), '%');

const negroniSpecs = [
  { amount: 1, unit: 'oz', name: 'Gin' },
  { amount: 1, unit: 'oz', name: 'Campari' },
  { amount: 1, unit: 'oz', name: 'Sweet Vermouth' },
];
const negroniAbv = calculateCocktailAbv(negroniSpecs, 'Stirred');
console.log('Negroni ABV (Stirred):', negroniAbv.estimatedAbv, '% (Raw:', negroniAbv.rawAbv, '%)');

const daiquiriSpecs = [
  { amount: 2, unit: 'oz', name: 'White Rum' },
  { amount: 0.75, unit: 'oz', name: 'Fresh Lime Juice' },
  { amount: 0.75, unit: 'oz', name: 'Simple Syrup' },
];
const daiquiriAbv = calculateCocktailAbv(daiquiriSpecs, 'Shaken');
const seaLegsBlock = `
  1.5 oz Scotch
  0.5 oz Mezcal
  0.75 oz Lime Juice
  0.75 oz Orgeat
  2 dashes Celery Bitters
`;
const seaLegsSpecs = parseSpecsBlock(seaLegsBlock);
console.log('--- Testing Sea Legs Recipe ---');
console.log('Parsed specs count:', seaLegsSpecs.length);
const seaLegsLayers = calculateFluidLayers(seaLegsSpecs);
console.log('Fluid layers count:', seaLegsLayers.length);
const seaLegsAbv = calculateCocktailAbv(seaLegsSpecs, 'Shaken');
console.log('Sea Legs ABV (Shaken):', seaLegsAbv.estimatedAbv, '% (Rounded:', Math.round(seaLegsAbv.estimatedAbv), '%)');

import { findIngredient, getIngredientMetadata, ingredientMatchesQuery, recipeMatchesQuery } from '../js/modules/taxonomy.js';
import { getIngredientColor } from '../js/modules/colors.js';

console.log('--- Testing Taxonomy & Alias Resolution ---');
const orgeatMatch = findIngredient('Almond Orgeat Syrup');
console.log('Almond Orgeat Syrup =>', orgeatMatch?.name, `(Family: ${orgeatMatch?.family}, Parent: ${orgeatMatch?.parent})`);
if (!orgeatMatch || orgeatMatch.id !== 'orgeat') throw new Error('Orgeat alias resolution failed');

const bourbonMatch = findIngredient('Kentucky Straight Bourbon');
console.log('Kentucky Straight Bourbon =>', bourbonMatch?.name, `(Family: ${bourbonMatch?.family})`);
if (!bourbonMatch || bourbonMatch.id !== 'bourbon') throw new Error('Bourbon alias resolution failed');

const scotchMatch = findIngredient('Single Malt Scotch');
console.log('Single Malt Scotch =>', scotchMatch?.name, `(Family: ${scotchMatch?.family})`);
if (!scotchMatch || scotchMatch.id !== 'scotch') throw new Error('Scotch alias resolution failed');

const goslingsMatch = findIngredient('Goslings');
console.log('Goslings =>', goslingsMatch?.name, `(Family: ${goslingsMatch?.family})`);
if (!goslingsMatch || goslingsMatch.id !== 'blackstrap_rum') throw new Error('Goslings alias resolution failed');

console.log('--- Testing Family-Aware Search Matching ---');
const match1 = ingredientMatchesQuery('Single Malt Scotch', 'whiskey');
console.log('Single Malt Scotch matches "whiskey":', match1);
if (!match1) throw new Error('Scotch should match whiskey query');

const match2 = ingredientMatchesQuery('Kentucky Straight Bourbon', 'whiskey');
console.log('Kentucky Straight Bourbon matches "whiskey":', match2);
if (!match2) throw new Error('Bourbon should match whiskey query');

const match3 = ingredientMatchesQuery('Smith & Cross', 'rum');
console.log('Smith & Cross matches "rum":', match3);
if (!match3) throw new Error('Smith & Cross should match rum query');

const match4 = ingredientMatchesQuery('Almond Orgeat Syrup', 'syrup');
console.log('Almond Orgeat Syrup matches "syrup":', match4);
if (!match4) throw new Error('Orgeat should match syrup query');

const testRecipe = {
  name: 'Penicillin',
  specs: [
    { amount: 2, unit: 'oz', name: 'Blended Scotch' },
    { amount: 0.75, unit: 'oz', name: 'Lemon Juice' },
    { amount: 0.75, unit: 'oz', name: 'Honey-Ginger Syrup' },
  ],
};
const recipeSearchWhiskey = recipeMatchesQuery(testRecipe, 'whiskey');
console.log('Penicillin recipe matches "whiskey":', recipeSearchWhiskey);
if (!recipeSearchWhiskey) throw new Error('Penicillin should match whiskey search');

console.log('--- Testing Taxonomy Color & ABV Integration ---');
const orgeatColor = getIngredientColor('Almond Orgeat Syrup');
console.log('Orgeat Color:', orgeatColor.color, orgeatColor.label);
if (orgeatColor.color !== '#f4ede2') throw new Error('Expected Orgeat color from taxonomy');

const bourbonAbv = estimateIngredientAbv('High-Rye Bourbon');
console.log('High-Rye Bourbon ABV:', bourbonAbv);
if (bourbonAbv !== 45) throw new Error('Expected 45% ABV for Bourbon');

console.log('All tests completed successfully!');
