import { parseIngredientLine, parseSpecsBlock, formatFraction, parseMethodContent } from '../js/modules/parser.js';
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
if (!scotchMatch || scotchMatch.id !== 'single_malt_scotch') throw new Error('Single Malt Scotch alias resolution failed');

const genericScotchMatch = findIngredient('Scotch Whisky');
console.log('Scotch Whisky =>', genericScotchMatch?.name, `(Family: ${genericScotchMatch?.family})`);
if (!genericScotchMatch || genericScotchMatch.id !== 'scotch') throw new Error('Scotch Whisky alias resolution failed');

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

import { getIngredientSubstitutes } from '../js/modules/taxonomy.js';

console.log('--- Testing Smart Ingredient Swapper (Riff Substitutes) ---');
const bourbonSubs = getIngredientSubstitutes('Bourbon');
console.log('Bourbon substitutes count:', bourbonSubs.length, bourbonSubs.map(s => s.name));
if (!bourbonSubs.some(s => s.id === 'rye_whiskey')) throw new Error('Bourbon should offer Rye Whiskey as substitute');
if (!bourbonSubs.some(s => s.id === 'scotch')) throw new Error('Bourbon should offer Scotch as substitute');
if (bourbonSubs.some(s => s.id === 'bourbon')) throw new Error('Bourbon should not offer itself as substitute');

const mezcalSubs = getIngredientSubstitutes('Mezcal');
console.log('Mezcal substitutes count:', mezcalSubs.length, mezcalSubs.map(s => s.name));
if (!mezcalSubs.some(s => s.id === 'tequila_blanco')) throw new Error('Mezcal should offer Blanco Tequila as substitute');

const vermouthSubs = getIngredientSubstitutes('Sweet Vermouth');
console.log('Sweet Vermouth substitutes count:', vermouthSubs.length, vermouthSubs.map(s => s.name));
if (!vermouthSubs.some(s => s.id === 'dry_vermouth')) throw new Error('Sweet Vermouth should offer Dry Vermouth as substitute');

console.log('--- Testing New Taxonomy Additions ---');
const mapleMatch = findIngredient('Grade A Maple Syrup');
console.log('Grade A Maple Syrup =>', mapleMatch?.name);
if (!mapleMatch || mapleMatch.id !== 'maple_syrup') throw new Error('Maple syrup match failed');

const oliveMatch = findIngredient('Olive Juice');
console.log('Olive Juice =>', oliveMatch?.name, `(Family: ${oliveMatch?.family})`);
if (!oliveMatch || oliveMatch.id !== 'olive_brine') throw new Error('Olive juice match failed');

const pickleMatch = findIngredient('Dill Pickle Juice');
console.log('Dill Pickle Juice =>', pickleMatch?.name, `(Family: ${pickleMatch?.family})`);
if (!pickleMatch || pickleMatch.id !== 'pickle_brine') throw new Error('Pickle juice match failed');

const oliveSubs = getIngredientSubstitutes('Olive Juice');
console.log('Olive Juice substitutes:', oliveSubs.map(s => s.name));
if (!oliveSubs.some(s => s.id === 'pickle_brine')) throw new Error('Olive juice should offer Pickle Brine as substitute');

const espressoMatch = findIngredient('Fresh Espresso');
console.log('Fresh Espresso =>', espressoMatch?.name);
if (!espressoMatch || espressoMatch.id !== 'espresso') throw new Error('Espresso match failed');

const nixtaMatch = findIngredient('Nixta Licor de Elote');
console.log('Nixta Licor de Elote =>', nixtaMatch?.name, `(Family: ${nixtaMatch?.family})`);
if (!nixtaMatch || nixtaMatch.id !== 'corn_liqueur') throw new Error('Nixta match failed');

const falernumMatch = findIngredient('Velvet Falernum');
console.log('Velvet Falernum =>', falernumMatch?.name, `(Family: ${falernumMatch?.family})`);
if (!falernumMatch || falernumMatch.id !== 'spiced_liqueur') throw new Error('Spiced liqueur match failed');

const stGermainMatch = findIngredient('St-Germain');
console.log('St-Germain =>', stGermainMatch?.name, `(Family: ${stGermainMatch?.family})`);
if (!stGermainMatch || stGermainMatch.id !== 'floral_liqueur') throw new Error('Floral liqueur match failed');

const maraschinoMatch = findIngredient('Luxardo Maraschino');
console.log('Luxardo Maraschino =>', maraschinoMatch?.name, `(ID: ${maraschinoMatch?.id})`);
if (!maraschinoMatch || maraschinoMatch.id !== 'maraschino') throw new Error('Maraschino match failed');

const heeringMatch = findIngredient('Cherry Heering');
console.log('Cherry Heering =>', heeringMatch?.name, `(ID: ${heeringMatch?.id})`);
if (!heeringMatch || heeringMatch.id !== 'cherry_liqueur') throw new Error('Cherry liqueur match failed');

const cassisMatch = findIngredient('Crème de Cassis');
console.log('Crème de Cassis =>', cassisMatch?.name, `(ID: ${cassisMatch?.id})`);
if (!cassisMatch || cassisMatch.id !== 'berry_liqueur') throw new Error('Berry liqueur match failed');

const apricotMatch = findIngredient('Apricot Liqueur');
console.log('Apricot Liqueur =>', apricotMatch?.name, `(ID: ${apricotMatch?.id})`);
if (!apricotMatch || apricotMatch.id !== 'stone_fruit_liqueur') throw new Error('Stone fruit liqueur match failed');

const bananaMatch = findIngredient('Crème de Banane');
console.log('Crème de Banane =>', bananaMatch?.name, `(ID: ${bananaMatch?.id})`);
if (!bananaMatch || bananaMatch.id !== 'tropical_fruit_liqueur') throw new Error('Tropical/banana liqueur match failed');

const blendedScotchMatch = findIngredient('Monkey Shoulder');
console.log('Monkey Shoulder =>', blendedScotchMatch?.name, `(ID: ${blendedScotchMatch?.id})`);
if (!blendedScotchMatch || blendedScotchMatch.id !== 'blended_scotch') throw new Error('Blended Scotch match failed');

const peatedScotchMatch = findIngredient('Laphroaig 10');
console.log('Laphroaig 10 =>', peatedScotchMatch?.name, `(ID: ${peatedScotchMatch?.id})`);
if (!peatedScotchMatch || peatedScotchMatch.id !== 'peated_scotch') throw new Error('Peated Scotch match failed');

const jovenMatch = findIngredient('Tequila Joven');
console.log('Tequila Joven =>', jovenMatch?.name, `(ID: ${jovenMatch?.id})`);
if (!jovenMatch || jovenMatch.id !== 'tequila_joven') throw new Error('Tequila Joven match failed');

const extraAnejoMatch = findIngredient('Extra Añejo Tequila');
console.log('Extra Añejo Tequila =>', extraAnejoMatch?.name, `(ID: ${extraAnejoMatch?.id})`);
if (!extraAnejoMatch || extraAnejoMatch.id !== 'tequila_extra_anejo') throw new Error('Extra Añejo Tequila match failed');

const redWineMatch = findIngredient('Cabernet Sauvignon');
console.log('Cabernet Sauvignon =>', redWineMatch?.name, `(ID: ${redWineMatch?.id})`);
if (!redWineMatch || redWineMatch.id !== 'red_wine') throw new Error('Red wine match failed');

const whiteWineMatch = findIngredient('Sauvignon Blanc');
console.log('Sauvignon Blanc =>', whiteWineMatch?.name, `(ID: ${whiteWineMatch?.id})`);
if (!whiteWineMatch || whiteWineMatch.id !== 'white_wine') throw new Error('White wine match failed');

const roseWineMatch = findIngredient('Rosé Wine');
console.log('Rosé Wine =>', roseWineMatch?.name, `(ID: ${roseWineMatch?.id})`);
if (!roseWineMatch || roseWineMatch.id !== 'rose_wine') throw new Error('Rosé wine match failed');

const champagneMatch = findIngredient('Champagne');
console.log('Champagne =>', champagneMatch?.name, `(Parent: ${champagneMatch?.parent})`);
if (!champagneMatch || champagneMatch.id !== 'sparkling_wine' || champagneMatch.parent !== 'fortified_wine') {
  throw new Error('Champagne should resolve to sparkling_wine under fortified_wine');
}

const hendricksMatch = findIngredient("Hendrick's Gin");
console.log("Hendrick's Gin =>", hendricksMatch?.name, `(ID: ${hendricksMatch?.id})`);
if (!hendricksMatch || hendricksMatch.id !== 'modern_gin') throw new Error("Hendrick's resolution failed");

const aviationMatch = findIngredient('Aviation Gin');
console.log('Aviation Gin =>', aviationMatch?.name, `(ID: ${aviationMatch?.id})`);
if (!aviationMatch || aviationMatch.id !== 'modern_gin') throw new Error('Aviation Gin resolution failed');

const tanquerayMatch = findIngredient('Tanqueray');
console.log('Tanqueray =>', tanquerayMatch?.name, `(ID: ${tanquerayMatch?.id})`);
if (!tanquerayMatch || tanquerayMatch.id !== 'london_dry_gin') throw new Error('Tanqueray resolution failed');

const buffaloTraceMatch = findIngredient('Buffalo Trace');
console.log('Buffalo Trace =>', buffaloTraceMatch?.name, `(ID: ${buffaloTraceMatch?.id})`);
if (!buffaloTraceMatch || buffaloTraceMatch.id !== 'bourbon') throw new Error('Buffalo Trace resolution failed');

const makersMarkMatch = findIngredient("Maker's Mark");
console.log("Maker's Mark =>", makersMarkMatch?.name, `(ID: ${makersMarkMatch?.id})`);
if (!makersMarkMatch || makersMarkMatch.id !== 'bourbon') throw new Error("Maker's Mark resolution failed");

const rittenhouseMatch = findIngredient('Rittenhouse Rye');
console.log('Rittenhouse Rye =>', rittenhouseMatch?.name, `(ID: ${rittenhouseMatch?.id})`);
if (!rittenhouseMatch || rittenhouseMatch.id !== 'rye_whiskey') throw new Error('Rittenhouse resolution failed');

const titosMatch = findIngredient("Tito's");
console.log("Tito's =>", titosMatch?.name, `(ID: ${titosMatch?.id})`);
if (!titosMatch || titosMatch.id !== 'vodka') throw new Error("Tito's resolution failed");

const fortalezaMatch = findIngredient('Fortaleza Blanco');
console.log('Fortaleza Blanco =>', fortalezaMatch?.name, `(ID: ${fortalezaMatch?.id})`);
if (!fortalezaMatch || fortalezaMatch.id !== 'tequila_blanco') throw new Error('Fortaleza resolution failed');

const bourbonBrandMeta = getIngredientMetadata('Bourbon');
if (!bourbonBrandMeta || !Array.isArray(bourbonBrandMeta.brands) || !bourbonBrandMeta.brands.includes('Buffalo Trace')) {
  throw new Error('Bourbon metadata should include Buffalo Trace in brands array');
}

const foamerMatch = findIngredient('Fee Foam');
console.log('Fee Foam =>', foamerMatch?.name, `(ID: ${foamerMatch?.id})`);
if (!foamerMatch || foamerMatch.id !== 'cocktail_foamer') throw new Error('Fee Foam resolution failed');

const foamerMeta = getIngredientMetadata('Cocktail Foamer');
if (!foamerMeta || foamerMeta.storage !== 'shelf' || foamerMeta.isRefrigerated) {
  throw new Error('Cocktail foamer should be shelf-stable');
}

console.log('--- Testing Refrigeration & Storage Metadata ---');
const vermouthMeta = getIngredientMetadata('Sweet Vermouth');
console.log('Sweet Vermouth storage:', vermouthMeta?.storage, '(isRefrigerated:', vermouthMeta?.isRefrigerated, ')');
if (!vermouthMeta || !vermouthMeta.isRefrigerated || vermouthMeta.storage !== 'fridge') {
  throw new Error('Sweet Vermouth should be marked as refrigerated');
}

const whiteWineMeta = getIngredientMetadata('Dry White Wine');
console.log('Dry White Wine storage:', whiteWineMeta?.storage, '(isRefrigerated:', whiteWineMeta?.isRefrigerated, ')');
if (!whiteWineMeta || !whiteWineMeta.isRefrigerated || whiteWineMeta.storage !== 'fridge') {
  throw new Error('Dry White Wine should be marked as refrigerated');
}

const redWineMeta = getIngredientMetadata('Dry Red Wine');
console.log('Dry Red Wine storage:', redWineMeta?.storage, '(isRefrigerated:', redWineMeta?.isRefrigerated, ')');
if (!redWineMeta || redWineMeta.isRefrigerated || redWineMeta.storage !== 'shelf') {
  throw new Error('Dry Red Wine should be marked as shelf storage');
}

const bourbonMeta = getIngredientMetadata('Bourbon');
console.log('Bourbon storage:', bourbonMeta?.storage, '(isRefrigerated:', bourbonMeta?.isRefrigerated, ')');
if (!bourbonMeta || bourbonMeta.isRefrigerated || bourbonMeta.storage !== 'shelf') {
  throw new Error('Bourbon should not be marked as refrigerated');
}

const simpleSyrupMeta = getIngredientMetadata('Simple Syrup');
if (!simpleSyrupMeta || !simpleSyrupMeta.isRefrigerated) {
  throw new Error('Simple Syrup should be marked as refrigerated');
}

const fridgeQueryMatch = ingredientMatchesQuery('Sweet Vermouth', 'fridge');
console.log('Sweet Vermouth matches "fridge" query:', fridgeQueryMatch);
if (!fridgeQueryMatch) throw new Error('Sweet Vermouth should match "fridge" search');

const whiteWineFridgeMatch = ingredientMatchesQuery('Sauvignon Blanc', 'fridge');
if (!whiteWineFridgeMatch) throw new Error('Sauvignon Blanc should match "fridge" search');

console.log('--- Testing Bidirectional Cocktail Riffs & Similar Cocktails ---');
import { findSimilarCocktails } from '../js/modules/taxonomy.js';
import { SEED_RECIPES } from '../js/modules/storage.js';

const negroni = SEED_RECIPES.find(r => r.id === 'negroni');
const boulevardier = SEED_RECIPES.find(r => r.id === 'boulevardier');

if (!negroni || !boulevardier) throw new Error('Negroni or Boulevardier seed recipe missing');

// Test Negroni (parent/riffed-on cocktail)
const negroniSimilar = findSimilarCocktails(negroni, SEED_RECIPES);
console.log('Negroni similar cocktails count:', negroniSimilar.length, negroniSimilar.map(s => `${s.recipe.name} (${s.relation})`));
const bMatchOnNegroni = negroniSimilar.find(s => s.recipe.id === 'boulevardier');
if (!bMatchOnNegroni) throw new Error('Boulevardier should appear in Negroni similar cocktails');
if (bMatchOnNegroni.relation !== 'Riff') throw new Error(`Expected 'Riff', got ${bMatchOnNegroni.relation}`);
if (bMatchOnNegroni.badgeClass !== 'badge-riff') throw new Error(`Expected 'badge-riff', got ${bMatchOnNegroni.badgeClass}`);

// Test Boulevardier (child/riff cocktail)
const boulevardierSimilar = findSimilarCocktails(boulevardier, SEED_RECIPES);
console.log('Boulevardier similar cocktails count:', boulevardierSimilar.length, boulevardierSimilar.map(s => `${s.recipe.name} (${s.relation})`));
const nMatchOnBoulevardier = boulevardierSimilar.find(s => s.recipe.id === 'negroni');
if (!nMatchOnBoulevardier) throw new Error('Negroni should appear in Boulevardier similar cocktails');
if (nMatchOnBoulevardier.relation !== 'Original') throw new Error(`Expected 'Original', got ${nMatchOnBoulevardier.relation}`);
if (nMatchOnBoulevardier.badgeClass !== 'badge-orig') throw new Error(`Expected 'badge-orig', got ${nMatchOnBoulevardier.badgeClass}`);

// Test Sibling Riffs
const whiteNegroni = {
  id: 'white-negroni',
  name: 'White Negroni',
  riffOfId: 'negroni',
  riffOfName: 'Negroni',
  specs: [
    { amount: 1.5, unit: 'oz', name: 'London Dry Gin' },
    { amount: 1, unit: 'oz', name: 'Lillet Blanc' },
    { amount: 0.75, unit: 'oz', name: 'Suze' },
  ],
};
const mockVault = [...SEED_RECIPES, whiteNegroni];
const whiteNegroniSimilar = findSimilarCocktails(whiteNegroni, mockVault);
console.log('White Negroni similar count:', whiteNegroniSimilar.length, whiteNegroniSimilar.map(s => `${s.recipe.name} (${s.relation})`));
const parentMatch = whiteNegroniSimilar.find(s => s.recipe.id === 'negroni');
const siblingMatch = whiteNegroniSimilar.find(s => s.recipe.id === 'boulevardier');
if (!parentMatch || parentMatch.relation !== 'Original') throw new Error('White Negroni should have Negroni as Original');
if (!siblingMatch || siblingMatch.relation !== 'Riff') throw new Error('White Negroni should have Boulevardier as Riff');

// Test Lineage Detection on Named Riffs without explicit riffOfId (e.g. user screenshot)
import { getRecipeRiffLineage } from '../js/modules/taxonomy.js';
const userRiff = {
  id: 'rec_user_saved',
  name: 'Old Fashioned (Scotch Whisky / Maple Syrup Riff)',
  description: 'Riff on Old Fashioned: substituted Bourbon with Scotch Whisky.',
  specs: [
    { amount: 2, unit: 'oz', name: 'Scotch Whisky' },
    { amount: 0.25, unit: 'oz', name: 'Maple Syrup' },
    { amount: 2, unit: 'dashes', name: 'Angostura Bitters' },
  ],
};
const detectedLineage = getRecipeRiffLineage(userRiff, SEED_RECIPES);
console.log('Detected lineage for user riff:', detectedLineage);
if (!detectedLineage || detectedLineage.parentName !== 'Old Fashioned') {
  throw new Error('Failed to infer lineage for named riff');
}

const ofRecipe = SEED_RECIPES.find(r => r.id === 'old-fashioned');
const ofSimilarWithUserRiff = findSimilarCocktails(ofRecipe, [...SEED_RECIPES, userRiff]);
console.log('Old Fashioned similar with user riff:', ofSimilarWithUserRiff.map(s => `${s.recipe.name} [${s.relation}]`));
const userRiffMatch = ofSimilarWithUserRiff.find(s => s.recipe.id === userRiff.id);
if (!userRiffMatch) throw new Error('User riff should appear in Old Fashioned similar list');
if (userRiffMatch.relation !== 'Riff') throw new Error(`User riff should have relation 'Riff', got ${userRiffMatch.relation}`);
if (userRiffMatch.badgeClass !== 'badge-riff') throw new Error(`User riff should have badgeClass 'badge-riff', got ${userRiffMatch.badgeClass}`);

import { checkIngredientStock, analyzeRecipeInventory } from '../js/modules/taxonomy.js';
import { DEFAULT_STARTER_BAR } from '../js/modules/storage.js';

console.log('--- Testing Backbar Inventory & Bottle Next Engine ---');

// 1. Pantry Staples never trigger missing bottle status
const waterStock = checkIngredientStock('Cold Water', new Set());
const iceStock = checkIngredientStock('Ice', new Set());
const sugarStock = checkIngredientStock('Granulated Sugar', new Set());
const salineStock = checkIngredientStock('Saline Solution (20%)', new Set());
if (!waterStock.isStaple || !waterStock.inStock) throw new Error('Water should be in stock as pantry staple');
if (!iceStock.isStaple || !iceStock.inStock) throw new Error('Ice should be in stock as pantry staple');
if (!sugarStock.isStaple || !sugarStock.inStock) throw new Error('Sugar should be in stock as pantry staple');
if (!salineStock.isStaple || !salineStock.inStock) throw new Error('Saline should be in stock as pantry staple');
console.log('Pantry staples correctly recognized as in-stock.');

// 2. Child-to-Parent hierarchical matching
const genericWhiskeyRecipe = {
  name: 'Whiskey Template',
  specs: [
    { amount: 2, unit: 'oz', name: 'Whiskey' },
    { amount: 1, unit: 'oz', name: 'Sweet Vermouth' },
  ],
};
const ownedBourbonInventory = new Set(['bourbon', 'sweet_vermouth']);
const genericAnalysis = analyzeRecipeInventory(genericWhiskeyRecipe, ownedBourbonInventory);
if (!genericAnalysis.canMake) {
  throw new Error('Owning Bourbon should satisfy generic Whiskey spec (child-to-parent hierarchy)');
}
console.log('Child-to-parent matching passed: owning bourbon satisfies generic whiskey spec.');

// 3. Reverse check: Owning generic Whiskey does NOT satisfy specific Scotch spec
const specificScotchRecipe = {
  name: 'Rob Roy Spec',
  specs: [
    { amount: 2, unit: 'oz', name: 'Scotch Whisky' },
    { amount: 1, unit: 'oz', name: 'Sweet Vermouth' },
  ],
};
const ownedGenericInventory = new Set(['whiskey', 'sweet_vermouth']);
const specificAnalysis = analyzeRecipeInventory(specificScotchRecipe, ownedGenericInventory);
if (specificAnalysis.canMake) {
  throw new Error('Owning generic Whiskey must not automatically satisfy specific Scotch Whisky spec');
}
if (!specificAnalysis.isBottleNext || specificAnalysis.missingItems[0].name !== 'Scotch Whisky') {
  throw new Error('Expected 1 missing bottle: Scotch Whisky');
}
console.log('Directionality verified: generic whiskey does not satisfy specific single malt scotch spec.');

// 4. Negroni exact inventory matching & Bottle Next detection
const negroniRecipe = SEED_RECIPES.find(r => r.id === 'negroni');
const fullNegroniBar = new Set(['london_dry_gin', 'red_bitter', 'sweet_vermouth']);
const fullNegroniAnalysis = analyzeRecipeInventory(negroniRecipe, fullNegroniBar);
if (!fullNegroniAnalysis.canMake || fullNegroniAnalysis.missingCount !== 0) {
  throw new Error('Negroni with full ingredients should have canMake === true');
}

const missingCampariBar = new Set(['london_dry_gin', 'sweet_vermouth']);
const missingCampariAnalysis = analyzeRecipeInventory(negroniRecipe, missingCampariBar);
if (missingCampariAnalysis.canMake) {
  throw new Error('Negroni missing Campari should not be makeable');
}
if (!missingCampariAnalysis.isBottleNext || missingCampariAnalysis.missingCount !== 1) {
  throw new Error('Negroni missing Campari should be flagged as isBottleNext with 1 missing');
}
if (missingCampariAnalysis.missingItems[0].id !== 'red_bitter') {
  throw new Error(`Expected missing item ID 'red_bitter', got ${missingCampariAnalysis.missingItems[0].id}`);
}
console.log('Negroni complete bar and Bottle Next 1-missing detection passed.');

// 5. Garnish Soft-Dependency: Garnishes do not block Can Make
const daiquiriRecipe = SEED_RECIPES.find(r => r.id === 'daiquiri');
const daiquiriBar = new Set(['light_rum', 'lime_juice', 'simple_syrup']);
const daiquiriAnalysis = analyzeRecipeInventory(daiquiriRecipe, daiquiriBar);
if (!daiquiriAnalysis.canMake) {
  throw new Error('Daiquiri should be makeable even without tagging lime wheel garnish');
}
console.log('Garnish soft-dependency verified: liquid specs determine canMake status.');

// 6. Starter Bar preset evaluation
const starterBarSet = new Set(DEFAULT_STARTER_BAR);
const starterCanMakeCount = SEED_RECIPES.filter(r => analyzeRecipeInventory(r, starterBarSet).canMake).length;
const starterBottleNextCount = SEED_RECIPES.filter(r => analyzeRecipeInventory(r, starterBarSet).isBottleNext).length;
console.log(`Starter Bar yields ${starterCanMakeCount} makeable drinks and ${starterBottleNextCount} bottle-next drinks.`);

// 7. In-Stock Substitute Recommendation Engine
const oldFashionedMissingDemerara = {
  id: 'of-test',
  name: 'Old Fashioned',
  specs: [
    { amount: 2, unit: 'oz', name: 'Bourbon' },
    { amount: 0.25, unit: 'oz', name: 'Demerara Syrup' },
    { amount: 2, unit: 'dashes', name: 'Angostura Bitters' },
  ],
};
const userBarWithMaple = new Set(['bourbon', 'aromatic_bitters', 'maple_syrup']);
const ofSubAnalysis = analyzeRecipeInventory(oldFashionedMissingDemerara, userBarWithMaple);
if (!ofSubAnalysis.canMakeWithSubs) {
  throw new Error('Old Fashioned should be makeable with substitutes when user has Maple Syrup');
}
if (ofSubAnalysis.bestSubstitute?.id !== 'maple_syrup') {
  throw new Error(`Expected best substitute to be maple_syrup, got ${ofSubAnalysis.bestSubstitute?.id}`);
}
console.log('In-Stock Substitute Recommendation verified:', ofSubAnalysis.bestSubstitute.name, 'for', ofSubAnalysis.missingWithSub.name);

console.log('--- Testing Arbitrary Tags & Lists Engine ---');
import { getAllUniqueTags, saveRecipe as testSaveRecipe } from '../js/modules/storage.js';

// 1. getAllUniqueTags extraction, normalization and sorting
const mockRecipesWithTags = [
  { id: '1', name: 'Drink 1', tags: ['summer', 'party', 'sour'] },
  { id: '2', name: 'Drink 2', tags: ['party', 'whiskey', 'evening'] },
  { id: '3', name: 'Drink 3', tags: ['SUMMER', 'favorites'] },
  { id: '4', name: 'Drink 4' }, // No tags
];
const extractedTags = getAllUniqueTags(mockRecipesWithTags);
console.log('Extracted unique tags:', extractedTags);
if (!extractedTags.includes('summer') || !extractedTags.includes('party') || !extractedTags.includes('favorites')) {
  throw new Error('getAllUniqueTags failed to extract expected tags');
}
if (extractedTags.filter(t => t === 'summer').length !== 1) {
  throw new Error('getAllUniqueTags should deduplicate case-insensitively');
}
// Check alphabetical order
const isSorted = extractedTags.slice(1).every((item, i) => extractedTags[i].localeCompare(item) <= 0);
if (!isSorted) throw new Error('Unique tags must be sorted alphabetically');

// Verify classic tag consolidation
const messyTagsRecipe = [
  { id: '1', name: 'Messy Drink', tags: ['modern-classic', 'essential-classics', 'classic', 'sour'] },
];
const cleanedTags = getAllUniqueTags(messyTagsRecipe);
if (cleanedTags.includes('modern-classic') || cleanedTags.includes('essential-classics')) {
  throw new Error('getAllUniqueTags should normalize classic variants');
}
if (!cleanedTags.includes('classic') || !cleanedTags.includes('modern-craft')) {
  throw new Error('getAllUniqueTags should map to canonical classic and modern-craft tags');
}

// 2. Tag query search matching
const summerDrink = {
  name: 'Mojito',
  tags: ['summer', 'poolside', 'rum-drinks'],
  specs: [{ amount: 2, unit: 'oz', name: 'White Rum' }],
};
if (!recipeMatchesQuery(summerDrink, '#summer')) {
  throw new Error('recipeMatchesQuery should match hashtag query "#summer"');
}
if (!recipeMatchesQuery(summerDrink, '#poolside')) {
  throw new Error('recipeMatchesQuery should match hashtag query "#poolside"');
}
if (!recipeMatchesQuery(summerDrink, 'poolside')) {
  throw new Error('recipeMatchesQuery should match plain text query "poolside" against tags');
}
if (recipeMatchesQuery(summerDrink, '#winter')) {
  throw new Error('recipeMatchesQuery should not match unrelated tag query');
}
console.log('Tag hashtag matching and plain text tag matching verified.');

console.log('--- Testing URL-Safe Slug Generation ---');
import { slugifyRecipeName } from '../js/modules/storage.js';

const slug1 = slugifyRecipeName('Scotch Old Fashioned');
if (slug1 !== 'scotch-old-fashioned') {
  throw new Error(`Expected "scotch-old-fashioned", got "${slug1}"`);
}

const slug2 = slugifyRecipeName('Old Fashioned (Scotch Whisky / Maple Syrup Riff)');
if (slug2 !== 'old-fashioned-scotch-whisky-maple-syrup-riff') {
  throw new Error(`Expected "old-fashioned-scotch-whisky-maple-syrup-riff", got "${slug2}"`);
}

// Deduplication
const existingIds = new Set(['scotch-old-fashioned', 'scotch-old-fashioned-2']);
const slug3 = slugifyRecipeName('Scotch Old Fashioned', existingIds);
if (slug3 !== 'scotch-old-fashioned-3') {
  throw new Error(`Expected "scotch-old-fashioned-3", got "${slug3}"`);
}
console.log('Clean URL slug generation verified.');

console.log(`--- Testing Canonical Seed Recipes (${SEED_RECIPES.length}) ---`);
if (SEED_RECIPES.length < 150) {
  throw new Error(`Expected at least 150 seed recipes, got ${SEED_RECIPES.length}`);
}

const cranberryItem = findIngredient('Cranberry Juice');
if (!cranberryItem || cranberryItem.id !== 'cranberry_juice') {
  throw new Error('Cranberry Juice failed to resolve to cranberry_juice');
}

const grapefruitSodaItem = findIngredient('Grapefruit Soda');
if (!grapefruitSodaItem || grapefruitSodaItem.id !== 'grapefruit_soda') {
  throw new Error('Grapefruit Soda failed to resolve to grapefruit_soda');
}

SEED_RECIPES.forEach(recipe => {
  if (!recipe.id || !recipe.name || !recipe.glassware || !recipe.method || !Array.isArray(recipe.specs) || recipe.specs.length === 0) {
    throw new Error(`Recipe ${recipe.name || recipe.id} has invalid structure`);
  }
  const abvResult = calculateCocktailAbv(recipe.specs, recipe.method);
  if (!abvResult || abvResult.estimatedAbv <= 0) {
    throw new Error(`Cocktail ${recipe.name} calculated invalid ABV: ${JSON.stringify(abvResult)}`);
  }
});
console.log(`All ${SEED_RECIPES.length} canonical recipes verified: proper metadata, valid fluid layers, and realistic ABV calculations.`);

console.log('--- Testing Method Content Parser (Ordered, Unordered, Prose) ---');
const orderedTest = `1. Add bourbon, demerara syrup, and bitters to a mixing glass.
2. Stir thoroughly for 25-30 seconds until well-chilled.
3. Strain into a rocks glass over a single large ice cube.
4. Express orange peel oils over the rim.`;
const parsedOrdered = parseMethodContent(orderedTest);
if (parsedOrdered.type !== 'ordered' || parsedOrdered.items.length !== 4) {
  throw new Error(`Expected ordered method with 4 items, got: ${JSON.stringify(parsedOrdered)}`);
}
if (parsedOrdered.items[0] !== 'Add bourbon, demerara syrup, and bitters to a mixing glass.') {
  throw new Error(`Expected item text without number prefix, got: "${parsedOrdered.items[0]}"`);
}

const unorderedBulletTest = `* Add vodka and lime juice
* Shake with ice
* Strain into coupe`;
const parsedUnordered = parseMethodContent(unorderedBulletTest);
if (parsedUnordered.type !== 'unordered' || parsedUnordered.items.length !== 3) {
  throw new Error(`Expected unordered method with 3 items, got: ${JSON.stringify(parsedUnordered)}`);
}

const proseTest = 'Stirred: Standard build and chill.';
const parsedProse = parseMethodContent(proseTest);
if (parsedProse.type !== 'prose' || parsedProse.items.length !== 1 || parsedProse.items[0] !== proseTest) {
  throw new Error(`Expected prose method, got: ${JSON.stringify(parsedProse)}`);
}
console.log('Method list detection tests passed.');

console.log('--- Testing Garnish Resolution & Vector Rendering ---');
const { resolveGarnishTypes, renderGarnishesSvg } = await import('../js/modules/garnishes.js');
const { GLASS_TYPES } = await import('../js/modules/glassware.js');

const garnishCases = [
  { input: 'Lime wheel', expected: ['limeWheel'] },
  { input: 'Lemon wheel & cocktail cherry', expected: ['cherry', 'lemonWheel'] },
  { input: 'Lemon peel twist', expected: ['lemonTwist'] },
  { input: 'Orange peel', expected: ['orangeTwist'] },
  { input: 'Brandied cherry', expected: ['cherry'] },
  { input: 'Castelvetrano olive', expected: ['olive'] },
  { input: 'Half salt rim & lime wedge', expected: ['saltRim', 'limeWedge'] },
  { input: '3 coffee beans', expected: ['coffeeBeans'] },
  { input: 'Fresh mint bouquet', expected: ['mintSprig'] },
  { input: 'Pineapple wedge & maraschino cherry', expected: ['cherry', 'pineappleWedge'] },
];

for (const tc of garnishCases) {
  const res = resolveGarnishTypes(tc.input);
  if (JSON.stringify(res) !== JSON.stringify(tc.expected)) {
    throw new Error(`Garnish resolution mismatch for "${tc.input}": expected ${JSON.stringify(tc.expected)}, got ${JSON.stringify(res)}`);
  }
}

const renderedSvg = renderGarnishesSvg({ garnish: 'Orange twist & cocktail cherry' }, GLASS_TYPES.rocks, 120);
if (!renderedSvg.includes('garnish-cherry') || !renderedSvg.includes('garnish-orange-twist')) {
  throw new Error(`Expected rendered SVG to contain cherry and twist garnishes: ${renderedSvg}`);
}
console.log('Garnish resolution and vector SVG rendering tests passed.');

console.log('--- Testing Blue Curaçao Taxonomy & Blended Color Calculation ---');
const blueCuracaoMeta = getIngredientMetadata('Blue Curaçao');
if (!blueCuracaoMeta || blueCuracaoMeta.id !== 'blue_curacao' || blueCuracaoMeta.color !== '#0096c7') {
  throw new Error(`Expected blue_curacao to resolve to #0096c7, got: ${JSON.stringify(blueCuracaoMeta)}`);
}
console.log('Blue Curaçao taxonomy resolution verified:', blueCuracaoMeta.id, blueCuracaoMeta.color);

const { calculateBlendedColor } = await import('../js/modules/colors.js');
const { renderGlassSvg } = await import('../js/modules/glass-view.js');

const blueHawaiiSpecs = [
  { amount: 1, unit: 'oz', name: 'Light Rum' },
  { amount: 1, unit: 'oz', name: 'Vodka' },
  { amount: 0.75, unit: 'oz', name: 'Blue Curaçao' },
  { amount: 3, unit: 'oz', name: 'Pineapple Juice' },
  { amount: 0.5, unit: 'oz', name: 'Fresh Lemon Juice' },
];
const blendedBlueHawaii = calculateBlendedColor(blueHawaiiSpecs);
console.log('Blue Hawaii blended color result:', blendedBlueHawaii);
if (!blendedBlueHawaii.color || !blendedBlueHawaii.light || !blendedBlueHawaii.dark) {
  throw new Error('Blended color calculation returned incomplete color shades');
}

const blueHawaiiSvg = renderGlassSvg({
  name: 'Blue Hawaii',
  glassware: 'Highball',
  specs: blueHawaiiSpecs,
}, 'test-glass', { mode: 'blended' });

if (!blueHawaiiSvg.includes('blended-fluid-body') || !blueHawaiiSvg.includes('data-mode="blended"')) {
  throw new Error('Expected rendered SVG to contain blended-fluid-body and data-mode="blended"');
}
console.log('Blended cocktail color calculation and SVG generation tests passed.');

console.log('--- Testing Hidden Recipe Storage & Toggles ---');
const {
  getHiddenRecipeIds,
  saveHiddenRecipeIds,
  isRecipeHidden,
  hideRecipe,
  unhideRecipe,
  unhideAllRecipes,
} = await import('../js/modules/storage.js');

// Mock localStorage if in node environment
if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (key) => store.get(key) || null,
    setItem: (key, val) => store.set(key, String(val)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear(),
  };
}

unhideAllRecipes();
if (getHiddenRecipeIds().length !== 0) throw new Error('Expected hidden recipes list to be empty initially');

hideRecipe('negroni');
if (!isRecipeHidden('negroni')) throw new Error('Expected negroni to be hidden');
if (getHiddenRecipeIds().length !== 1) throw new Error('Expected 1 hidden recipe');

hideRecipe('old-fashioned');
if (getHiddenRecipeIds().length !== 2) throw new Error('Expected 2 hidden recipes');

unhideRecipe('negroni');
if (isRecipeHidden('negroni')) throw new Error('Expected negroni to no longer be hidden');
if (getHiddenRecipeIds().length !== 1) throw new Error('Expected 1 hidden recipe remaining');

unhideAllRecipes();
if (getHiddenRecipeIds().length !== 0) throw new Error('Expected 0 hidden recipes after unhideAll');

const { getRecipes } = await import('../js/modules/storage.js');
const baseRecipesCount = getRecipes().length;
hideRecipe('negroni');
const recipesAfterHide = getRecipes();
if (recipesAfterHide.length !== baseRecipesCount - 1) {
  throw new Error(`Expected recipe count ${baseRecipesCount - 1}, but got ${recipesAfterHide.length}`);
}
if (recipesAfterHide.some(r => r.id === 'negroni')) {
  throw new Error('Expected negroni to be excluded from getRecipes()');
}
unhideAllRecipes();
if (getRecipes().length !== baseRecipesCount) {
  throw new Error('Expected full recipe count after unhideAll');
}
console.log('Hidden recipe storage and toggle tests passed.');

console.log('--- Testing Flavor Balance Engine ---');
const { calculateBalanceProfile, getDominantAxes, FLAVOR_AXES } = await import('../js/modules/balance.js');

// Every axis should always be a 0-100 integer, for any recipe's specs.
const negroniSeed = SEED_RECIPES.find(r => r.id === 'negroni');
const daiquiriSeed = SEED_RECIPES.find(r => r.id === 'daiquiri');
if (!negroniSeed || !daiquiriSeed) {
  throw new Error('Expected seed recipes "negroni" and "daiquiri" to exist for balance tests');
}

const negroniProfile = calculateBalanceProfile(negroniSeed.specs);
const daiquiriProfile = calculateBalanceProfile(daiquiriSeed.specs);

for (const profile of [negroniProfile, daiquiriProfile]) {
  for (const axis of FLAVOR_AXES) {
    const value = profile[axis.key];
    if (typeof value !== 'number' || Number.isNaN(value) || value < 0 || value > 100) {
      throw new Error(`Expected ${axis.key} to be a 0-100 number, got ${value}`);
    }
  }
}

// Negroni (equal parts gin, Campari, sweet vermouth): a bitter, boozy, sweet aperitif —
// and essentially no sourness, since none of its three ingredients bring any acid.
if (!(negroniProfile.bitter > negroniProfile.sour)) {
  throw new Error(`Expected Negroni bitter (${negroniProfile.bitter}) > sour (${negroniProfile.sour})`);
}
if (!(negroniProfile.bitter >= 30)) {
  throw new Error(`Expected Negroni bitter to be prominently high, got ${negroniProfile.bitter}`);
}
if (!(negroniProfile.sweet >= 15 && negroniProfile.boozy >= 15)) {
  throw new Error(`Expected Negroni sweet (${negroniProfile.sweet}) and boozy (${negroniProfile.boozy}) to both be meaningfully present`);
}
if (negroniProfile.sour > 10) {
  throw new Error(`Expected Negroni sour to be near-zero, got ${negroniProfile.sour}`);
}
const negroniDominant = getDominantAxes(negroniProfile);
if (!negroniDominant.includes('Bitter')) {
  throw new Error(`Expected Bitter among Negroni's dominant axes, got [${negroniDominant.join(', ')}]`);
}

// Daiquiri (rum, fresh lime juice, sugar syrup): a sweet-sour sour with no bitterness
// or herbal character at all, since none of its ingredients carry either.
if (!(daiquiriProfile.sweet >= 15 && daiquiriProfile.sour >= 10 && daiquiriProfile.boozy >= 15)) {
  throw new Error(`Expected Daiquiri sweet (${daiquiriProfile.sweet}), sour (${daiquiriProfile.sour}), and boozy (${daiquiriProfile.boozy}) to all be meaningfully present`);
}
if (daiquiriProfile.bitter > 5 || daiquiriProfile.herbal > 5) {
  throw new Error(`Expected Daiquiri bitter (${daiquiriProfile.bitter}) and herbal (${daiquiriProfile.herbal}) to be near-zero`);
}
const daiquiriDominant = getDominantAxes(daiquiriProfile);
if (!daiquiriDominant.includes('Sweet') || !daiquiriDominant.includes('Sour')) {
  throw new Error(`Expected Sweet and Sour among Daiquiri's dominant axes, got [${daiquiriDominant.join(', ')}]`);
}

// Empty/garnish-only specs shouldn't throw or produce NaN — everything stays at 0.
const emptyProfile = calculateBalanceProfile([]);
for (const axis of FLAVOR_AXES) {
  if (emptyProfile[axis.key] !== 0) {
    throw new Error(`Expected empty specs to produce an all-zero profile, got ${axis.key}=${emptyProfile[axis.key]}`);
  }
}

console.log('Flavor balance engine tests passed.');

console.log('--- Testing Smart Counter Timer Instruction Parser ---');
const { detectTimers, renderInstructionTimers } = await import('../js/modules/parser.js');

// Test single durations
const timer30 = detectTimers('Stir thoroughly for 30 seconds until well-chilled.');
if (timer30.length !== 1 || timer30[0].seconds !== 30 || timer30[0].text !== '30 seconds') {
  throw new Error(`Expected '30 seconds' (30s), got ${JSON.stringify(timer30)}`);
}

// Test ranges (hyphen, en-dash, em-dash)
const timerRange1 = detectTimers('Shake vigorously for 10-12 seconds until frosty.');
if (timerRange1.length !== 1 || timerRange1[0].seconds !== 12 || timerRange1[0].text !== '10-12 seconds') {
  throw new Error(`Expected '10-12 seconds' (12s), got ${JSON.stringify(timerRange1)}`);
}

const timerRange2 = detectTimers('Stir for 25–30 secs until cold.');
if (timerRange2.length !== 1 || timerRange2[0].seconds !== 30 || timerRange2[0].text !== '25–30 secs') {
  throw new Error(`Expected '25–30 secs' (30s), got ${JSON.stringify(timerRange2)}`);
}

const timerRange3 = detectTimers('Blend on high speed for 20—25 seconds.');
if (timerRange3.length !== 1 || timerRange3[0].seconds !== 25) {
  throw new Error(`Expected em-dash range to detect 25s, got ${JSON.stringify(timerRange3)}`);
}

// Test abbreviations and singular forms
const timerSingular = detectTimers('Rest for 1 second, then serve.');
if (timerSingular.length !== 1 || timerSingular[0].seconds !== 1 || timerSingular[0].text !== '1 second') {
  throw new Error(`Expected '1 second' (1s), got ${JSON.stringify(timerSingular)}`);
}

const timerSec = detectTimers('Shake hard for 15 sec.');
if (timerSec.length !== 1 || timerSec[0].seconds !== 15) {
  throw new Error(`Expected '15 sec' (15s), got ${JSON.stringify(timerSec)}`);
}

// Test multiple durations in one text
const multiTimers = detectTimers('Dry shake for 10 seconds to emulsify, then add ice and shake for 15 seconds.');
if (multiTimers.length !== 2 || multiTimers[0].seconds !== 10 || multiTimers[1].seconds !== 15) {
  throw new Error(`Expected 2 timers (10s and 15s), got ${JSON.stringify(multiTimers)}`);
}

// Test negative / empty cases
if (detectTimers('Build over fresh ice and stir gently.').length !== 0) {
  throw new Error('Expected 0 timers for text without seconds');
}
if (detectTimers('').length !== 0 || detectTimers(null).length !== 0) {
  throw new Error('Expected empty array for empty/null text');
}

// Test renderInstructionTimers token HTML generation
const renderedTokenHtml = renderInstructionTimers('Shake for 12 seconds until cold.', (s) => s);
if (!renderedTokenHtml.includes('<button type="button" class="timer-token" data-seconds="12"') || !renderedTokenHtml.includes('12 seconds</button>')) {
  throw new Error(`Expected rendered token button in HTML, got: ${renderedTokenHtml}`);
}
console.log('Smart Counter Timer instruction parser tests passed.');

console.log('--- Testing Palate Distance & Similarity Calculation ---');
const { calculatePalateSimilarity } = await import('../js/modules/balance.js');

// 1. Identical recipes must yield 100% similarity
const negroniPalateMatchSelf = calculatePalateSimilarity(negroniSeed, negroniSeed);
if (negroniPalateMatchSelf !== 100) {
  throw new Error(`Expected self-palate match to be 100%, got ${negroniPalateMatchSelf}%`);
}

// 2. Max Euclidean distance between fully opposite profiles must be 0%
const maxOppositeA = { balance: { sweet: 100, sour: 100, bitter: 100, boozy: 100, herbal: 100 } };
const maxOppositeB = { balance: { sweet: 0, sour: 0, bitter: 0, boozy: 0, herbal: 0 } };
const oppositeMatch = calculatePalateSimilarity(maxOppositeA, maxOppositeB);
if (oppositeMatch !== 0) {
  throw new Error(`Expected opposite profiles to yield 0% similarity, got ${oppositeMatch}%`);
}

// 3. Negroni vs Boulevardier (closely related flavor profiles) vs Negroni vs Daiquiri
const boulevardierSeed = SEED_RECIPES.find(r => r.id === 'boulevardier');
if (!boulevardierSeed) throw new Error('Boulevardier seed recipe missing');

const negroniBoulevardierMatch = calculatePalateSimilarity(negroniSeed, boulevardierSeed);
const negroniDaiquiriMatch = calculatePalateSimilarity(negroniSeed, daiquiriSeed);
console.log(`Negroni <-> Boulevardier Palate Match: ${negroniBoulevardierMatch}%`);
console.log(`Negroni <-> Daiquiri Palate Match: ${negroniDaiquiriMatch}%`);

if (negroniBoulevardierMatch < 75) {
  throw new Error(`Expected Negroni-Boulevardier similarity to be high (>=75%), got ${negroniBoulevardierMatch}%`);
}
if (negroniBoulevardierMatch <= negroniDaiquiriMatch) {
  throw new Error(`Expected Negroni-Boulevardier (${negroniBoulevardierMatch}%) > Negroni-Daiquiri (${negroniDaiquiriMatch}%)`);
}

// 4. Raw flavor balance objects and boundary tolerance
const directBalA = { sweet: 50, sour: 20, bitter: 30, boozy: 40, herbal: 10 };
const directBalB = { sweet: 55, sour: 18, bitter: 28, boozy: 42, herbal: 12 };
const directMatch = calculatePalateSimilarity(directBalA, directBalB);
if (typeof directMatch !== 'number' || directMatch < 90 || directMatch > 100) {
  throw new Error(`Expected close balance similarity to be 90-100%, got ${directMatch}%`);
}

if (calculatePalateSimilarity(null, negroniSeed) !== 0 || calculatePalateSimilarity(undefined, null) !== 0) {
  throw new Error('Expected 0 for null/undefined inputs');
}

// 5. Plain English palate match descriptor tests
const { formatPalateMatchLabel } = await import('../js/views/counter-view.js');
const highTier = formatPalateMatchLabel(97);
if (!highTier || highTier.label !== 'Close Match' || highTier.tierClass !== 'match-high') {
  throw new Error(`Expected Close Match / match-high for 97%, got ${JSON.stringify(highTier)}`);
}
const midTier = formatPalateMatchLabel(82);
if (!midTier || midTier.label !== 'Similar Vibe' || midTier.tierClass !== 'match-mid') {
  throw new Error(`Expected Similar Vibe / match-mid for 82%, got ${JSON.stringify(midTier)}`);
}
const below80Tier = formatPalateMatchLabel(79);
if (below80Tier !== null) {
  throw new Error(`Expected null for 79%, got ${JSON.stringify(below80Tier)}`);
}
const boundary91 = formatPalateMatchLabel(91);
if (!boundary91 || boundary91.label !== 'Close Match') {
  throw new Error(`Expected Close Match for 91%, got ${JSON.stringify(boundary91)}`);
}
const boundary90 = formatPalateMatchLabel(90);
if (!boundary90 || boundary90.label !== 'Similar Vibe') {
  throw new Error(`Expected Similar Vibe for 90%, got ${JSON.stringify(boundary90)}`);
}
const boundary80 = formatPalateMatchLabel(80);
if (!boundary80 || boundary80.label !== 'Similar Vibe') {
  throw new Error(`Expected Similar Vibe for 80%, got ${JSON.stringify(boundary80)}`);
}

console.log('Palate distance and similarity tests passed.');

console.log('--- Testing Ranked Bar Unlock Shopping List Engine ---');
const { getRankedShoppingList } = await import('../js/modules/taxonomy.js');

// 1. Controlled mock catalog test
const mockRecipes = [
  // Cocktail 1: Needs only Sweet Vermouth (1-bottle unlock)
  { id: 'mock-1', name: 'Mock Boulevardier', specs: [{ name: 'Bourbon' }, { name: 'Campari' }, { name: 'Sweet Vermouth' }] },
  // Cocktail 2: Needs only Sweet Vermouth (1-bottle unlock)
  { id: 'mock-2', name: 'Mock Negroni', specs: [{ name: 'Gin' }, { name: 'Campari' }, { name: 'Sweet Vermouth' }] },
  // Cocktail 3: Needs only Dry Vermouth (1-bottle unlock)
  { id: 'mock-3', name: 'Mock Martini', specs: [{ name: 'Gin' }, { name: 'Dry Vermouth' }] },
  // Cocktail 4: Needs Scotch and Amaretto (2-bottle unlock for each)
  { id: 'mock-4', name: 'Mock Godfather', specs: [{ name: 'Scotch' }, { name: 'Amaretto' }] },
  // Cocktail 5: Needs Scotch and Drambuie (2-bottle unlock for each)
  { id: 'mock-5', name: 'Mock Rusty Nail', specs: [{ name: 'Scotch' }, { name: 'Drambuie' }] },
  // Cocktail 6: Needs 3 bottles (neither 1-bottle nor 2-bottle unlock)
  { id: 'mock-6', name: 'Mock Complex', specs: [{ name: 'Tequila' }, { name: 'Mezcal' }, { name: 'Chartreuse' }] },
];

const mockInventory = new Set(['bourbon', 'campari', 'gin']);
const mockRanked = getRankedShoppingList(mockRecipes, mockInventory);

// Sweet Vermouth should be #1 with 2 direct unlocks
const topItem = mockRanked[0];
if (!topItem || topItem.id !== 'sweet_vermouth' || topItem.unlockCount !== 2) {
  throw new Error(`Expected Sweet Vermouth ranked #1 with 2 unlocks, got ${JSON.stringify(topItem)}`);
}
if (topItem.unlockedCocktails.length !== 2) {
  throw new Error(`Expected 2 unlocked cocktails for Sweet Vermouth, got ${topItem.unlockedCocktails.length}`);
}

// Dry Vermouth should be #2 with 1 direct unlock
const secondItem = mockRanked[1];
if (!secondItem || secondItem.id !== 'dry_vermouth' || secondItem.unlockCount !== 1) {
  throw new Error(`Expected Dry Vermouth ranked #2 with 1 unlock, got ${JSON.stringify(secondItem)}`);
}

// Scotch has 0 direct unlocks, but secondaryCount = 2 (unlocks Mock Godfather and Mock Rusty Nail to 1-away)
const scotchItem = mockRanked.find(i => i.id === 'scotch');
const amarettoItem = mockRanked.find(i => i.id === 'nut_liqueur');
if (!scotchItem || scotchItem.unlockCount !== 0 || scotchItem.secondaryCount !== 2) {
  throw new Error(`Expected Scotch secondaryCount = 2, got ${JSON.stringify(scotchItem)}`);
}
if (!amarettoItem || amarettoItem.unlockCount !== 0 || amarettoItem.secondaryCount !== 1) {
  throw new Error(`Expected Amaretto secondaryCount = 1, got ${JSON.stringify(amarettoItem)}`);
}

// Scotch must be ranked before Amaretto due to secondary tie-breaker
const scotchIndex = mockRanked.findIndex(i => i.id === 'scotch');
const amarettoIndex = mockRanked.findIndex(i => i.id === 'nut_liqueur');
if (scotchIndex >= amarettoIndex) {
  throw new Error(`Expected Scotch (secondary: 2) to rank ahead of Amaretto (secondary: 1)`);
}

// 2. Canonical Seed Recipes + DEFAULT_STARTER_BAR Test
const starterBarInventory = new Set(DEFAULT_STARTER_BAR);
const canonicalShoppingList = getRankedShoppingList(SEED_RECIPES, starterBarInventory);

if (canonicalShoppingList.length === 0) {
  throw new Error('Expected canonical shopping list to have recommendations for Starter Bar');
}

// Verify strict descending sort
for (let i = 0; i < canonicalShoppingList.length - 1; i++) {
  const curr = canonicalShoppingList[i];
  const next = canonicalShoppingList[i + 1];
  if (curr.unlockCount < next.unlockCount) {
    throw new Error(`Ranking order violation: ${curr.name} (${curr.unlockCount}) < ${next.name} (${next.unlockCount})`);
  }
  if (curr.unlockCount === next.unlockCount && curr.secondaryCount < next.secondaryCount) {
    throw new Error(`Tie-breaker violation: ${curr.name} (${curr.secondaryCount}) < ${next.name} (${next.secondaryCount})`);
  }
}

// Total 1-bottle unlocks across the shopping list must equal the 48 bottle-next drinks from Starter Bar.
// (Was 52 before Peychaud's Bitters got its own taxonomy id split out of aromatic_bitters —
// Sazerac, Vieux Carré, Metropole, Monte Carlo, and À La Louisienne all call for it by name, and
// were incorrectly counted as "ready to make" off owning Angostura alone. Splitting them fixed the
// glass color for those recipes but correctly cost 2 bottle-next unlocks off the Starter Bar's count.
// Was 50 before Mint Julep and Mojito got "Fresh Mint" added to their specs — both recipes'
// instructions always called for muddling/pressing mint, but it was missing from the ingredient
// list entirely. Mint isn't in the Starter Bar, so this correctly cost 2 more bottle-next unlocks.)
const totalStarterUnlocks = canonicalShoppingList.reduce((sum, item) => sum + item.unlockCount, 0);
console.log(`Canonical Starter Bar Total Unlocks: ${totalStarterUnlocks} (expected: 48)`);
if (totalStarterUnlocks !== 48) {
  throw new Error(`Expected exactly 48 bottle-next unlocks from Starter Bar, got ${totalStarterUnlocks}`);
}

console.log(`Top recommended bottle to buy for Starter Bar: ${canonicalShoppingList[0].name} (+${canonicalShoppingList[0].unlockCount} cocktails)`);
console.log('Ranked Bar Unlock Shopping List tests passed.');

console.log('--- Testing Backup Export/Import (v1 Schema) ---');
const { buildBackupPayload, importData, saveRecipes, saveInventory, getInventory, getUnitPreference } = await import('../js/modules/storage.js');

const customRiff = {
  id: 'test-custom-riff',
  name: 'Test Custom Riff',
  glassware: 'Coupe',
  method: 'Stirred',
  garnish: '',
  description: '',
  instructions: '',
  source: '',
  sourceUrl: '',
  notes: '',
  riffOfId: 'dry-martini',
  riffOfName: 'Dry Martini',
  tags: [],
  specs: [{ amount: 2, unit: 'oz', name: 'Gin', abv: 40 }],
};
const modifiedNegroni = { ...SEED_RECIPES.find(r => r.id === 'negroni'), notes: 'Stirred extra long' };
const untouchedSeeds = SEED_RECIPES.filter(r => r.id !== 'negroni');

saveRecipes([...untouchedSeeds, modifiedNegroni, customRiff]);
saveInventory(['gin', 'dry_vermouth']);
saveHiddenRecipeIds(['blue-hawaii']);

// 1. Export payload shape and unmodified-seed exclusion
const backup = buildBackupPayload();
if (backup.version !== 1) throw new Error('Expected backup version to be 1');
if (typeof backup.exportedAt !== 'string') throw new Error('Expected backup exportedAt to be a timestamp string');
if (!Array.isArray(backup.inventory) || !backup.inventory.includes('gin')) {
  throw new Error(`Expected backup inventory to include "gin", got ${JSON.stringify(backup.inventory)}`);
}
if (!Array.isArray(backup.hiddenRecipes) || !backup.hiddenRecipes.includes('blue-hawaii')) {
  throw new Error(`Expected backup hiddenRecipes to include "blue-hawaii", got ${JSON.stringify(backup.hiddenRecipes)}`);
}
if (!backup.settings || typeof backup.settings.unitPref !== 'string' || typeof backup.settings.sortPref !== 'string' || typeof backup.settings.glassViewPref !== 'string') {
  throw new Error(`Expected backup settings to include unitPref/sortPref/glassViewPref, got ${JSON.stringify(backup.settings)}`);
}
const backupIds = backup.customRecipes.map(r => r.id);
if (!backupIds.includes('test-custom-riff')) {
  throw new Error('Expected backup customRecipes to include the custom riff');
}
if (!backupIds.includes('negroni')) {
  throw new Error('Expected backup customRecipes to include the hand-modified Negroni');
}
if (untouchedSeeds.some(seed => backupIds.includes(seed.id))) {
  throw new Error('Expected backup customRecipes to exclude unmodified canonical seed recipes');
}
console.log('Export payload schema test passed.');

// Regression: getRecipes() normalizes tags on every load (retired variants like
// "aperitivo" get dropped, renamed variants like "tiki" get canonicalized), so a
// stored recipe's tags can differ cosmetically from SEED_RECIPES' raw tags without
// the user having touched the recipe. That drift must not make it look "modified"
// and leak into the backup. Simulate a stale raw tag on a seed (as seed-recipes.js
// itself briefly had for Ferrari/Bitter Giuseppe/La Rosita/Old Pal until it was
// cleaned up) by temporarily mutating one seed's tags, then restore it.
const tagDriftSeed = SEED_RECIPES.find(r => r.id === 'negroni');
const originalNegroniTags = tagDriftSeed.tags;
try {
  tagDriftSeed.tags = [...originalNegroniTags, 'aperitivo'];
  const storedNegroniAfterNormalization = { ...tagDriftSeed, tags: originalNegroniTags };
  saveRecipes([
    ...SEED_RECIPES.filter(r => r.id !== 'negroni'),
    storedNegroniAfterNormalization,
  ]);
  const driftBackup = buildBackupPayload();
  if (driftBackup.customRecipes.some(r => r.id === 'negroni')) {
    throw new Error('Expected a seed recipe whose stored tags are already normalized to be excluded from the backup, even when the raw seed still carries a stale/retired tag');
  }
} finally {
  tagDriftSeed.tags = originalNegroniTags;
}
console.log('Retired/renamed-tag normalization does not cause false-positive backup inclusion.');

unhideAllRecipes();

// 2. Only the v1 unified schema is accepted; anything else is rejected outright
let rejectedFlatArray = false;
try {
  importData(JSON.stringify([customRiff]));
} catch (err) {
  rejectedFlatArray = true;
}
if (!rejectedFlatArray) {
  throw new Error('Expected importData to reject a bare array (unsupported legacy format)');
}
console.log('Non-v1 import format is rejected as expected.');

// 3. Unified v1 backup import merges (never overwrites) inventory/hidden recipes
saveRecipes(SEED_RECIPES);
saveInventory(['gin']);
saveHiddenRecipeIds([]);

const v1Result = importData(JSON.stringify({
  version: 1,
  exportedAt: new Date().toISOString(),
  inventory: ['campari', 'sweet_vermouth'],
  hiddenRecipes: ['negroni'],
  settings: { unitPref: 'ml' },
  customRecipes: [customRiff],
}));

if (v1Result.importedRecipeCount !== 1) {
  throw new Error(`Expected v1 import to add 1 custom recipe, got ${v1Result.importedRecipeCount}`);
}
const mergedInventory = getInventory();
if (!mergedInventory.includes('gin') || !mergedInventory.includes('campari')) {
  throw new Error(`Expected merged inventory to retain "gin" and add "campari", got ${JSON.stringify(mergedInventory)}`);
}
if (!getHiddenRecipeIds().includes('negroni')) {
  throw new Error('Expected v1 import to merge in the "negroni" hidden recipe');
}
if (getUnitPreference() !== 'ml') {
  throw new Error('Expected v1 import to restore the unitPref setting');
}
console.log('Unified v1 backup import test passed.');

unhideAllRecipes();
saveRecipes(SEED_RECIPES);
saveInventory([]);
console.log('Backup export/import tests passed.');

console.log('All tests completed successfully!');


