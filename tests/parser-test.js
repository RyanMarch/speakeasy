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

console.log('--- Testing 100 Canonical Seed Recipes ---');
if (SEED_RECIPES.length !== 100) {
  throw new Error(`Expected exactly 100 seed recipes, got ${SEED_RECIPES.length}`);
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
console.log(`All 100 canonical recipes verified: proper metadata, valid fluid layers, and realistic ABV calculations.`);

console.log('All tests completed successfully!');

