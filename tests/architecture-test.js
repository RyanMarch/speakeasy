/**
 * Architecture & Module Integrity Test Suite
 * Validates module exports, HTML preloads, CSS imports, and data schemas.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

let totalTests = 0;
let passedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exitCode = 1;
  } else {
    passedTests++;
    console.log(`PASS: ${message}`);
  }
}

async function runTests() {
  console.log('\n--- 1. Testing Data & Seed Recipes ---');
  const { SEED_RECIPES: directSeeds } = await import('../js/data/seed-recipes.js');
  const { SEED_RECIPES: storageSeeds } = await import('../js/modules/storage.js');

  assert(Array.isArray(directSeeds), 'seed-recipes.js exports an array');
  assert(directSeeds.length === 181, `seed-recipes.js has 181 recipes (found: ${directSeeds.length})`);
  const storageMod = await import('../js/modules/storage.js');
  assert(typeof storageMod.clearUserDataOnSignOut === 'function', 'storage.js exports clearUserDataOnSignOut()');
  assert(storageMod.SEED_RECIPES === directSeeds, 'storage.js re-exports the exact same SEED_RECIPES array');

  const seenIds = new Set();
  let validSpecsCount = 0;
  for (const recipe of directSeeds) {
    if (!recipe.id || seenIds.has(recipe.id)) break;
    seenIds.add(recipe.id);
    if (Array.isArray(recipe.specs) && recipe.specs.length > 0) {
      validSpecsCount++;
    }
  }
  assert(seenIds.size === 181, 'All 181 recipe IDs are unique');
  assert(validSpecsCount === 181, 'All 181 recipes have non-empty specs arrays');

  console.log('\n--- 2. Testing Module Exports & Contracts ---');
  const stateMod = await import('../js/state.js');
  assert(typeof stateMod.state === 'object', 'js/state.js exports state object');
  assert(typeof stateMod.elements === 'object', 'js/state.js exports elements object');
  assert(typeof stateMod.getCachedInventoryAnalysis === 'function', 'js/state.js exports getCachedInventoryAnalysis()');
  assert(typeof stateMod.invalidateInventoryCache === 'function', 'js/state.js exports invalidateInventoryCache()');
  assert(Array.isArray(stateMod.BACKBAR_CATEGORIES), 'js/state.js exports BACKBAR_CATEGORIES array');
  assert(Array.isArray(stateMod.HOME_DEFAULT_COLLECTIONS), 'js/state.js exports HOME_DEFAULT_COLLECTIONS array');

  const routerMod = await import('../js/router.js');
  assert(typeof routerMod.selectRecipe === 'function', 'js/router.js exports selectRecipe()');
  assert(typeof routerMod.renderCurrentView === 'function', 'js/router.js exports renderCurrentView()');
  assert(typeof routerMod.goHome === 'function', 'js/router.js exports goHome()');
  assert(typeof routerMod.showDrinksListMobile === 'function', 'js/router.js exports showDrinksListMobile()');

  const homeViewMod = await import('../js/views/home-view.js');
  assert(typeof homeViewMod.renderHomeView === 'function', 'home-view.js exports renderHomeView()');
  assert(typeof homeViewMod.renderHomeShelf === 'function', 'home-view.js exports renderHomeShelf()');
  assert(typeof homeViewMod.renderHomeCard === 'function', 'home-view.js exports renderHomeCard()');
  assert(typeof homeViewMod.formatRelativeTime === 'function', 'home-view.js exports formatRelativeTime()');
  assert(typeof homeViewMod.setHomeViewCallbacks === 'function', 'home-view.js exports setHomeViewCallbacks()');

  const counterViewMod = await import('../js/views/counter-view.js');
  assert(typeof counterViewMod.renderCounterView === 'function', 'counter-view.js exports renderCounterView()');
  assert(typeof counterViewMod.duplicateRecipe === 'function', 'counter-view.js exports duplicateRecipe()');
  assert(typeof counterViewMod.toggleHideRecipe === 'function', 'counter-view.js exports toggleHideRecipe()');
  assert(typeof counterViewMod.confirmDeleteRecipe === 'function', 'counter-view.js exports confirmDeleteRecipe()');
  assert(typeof counterViewMod.setCounterViewCallbacks === 'function', 'counter-view.js exports setCounterViewCallbacks()');
  assert(typeof counterViewMod.requestWakeLock === 'function', 'counter-view.js exports requestWakeLock()');
  assert(typeof counterViewMod.releaseWakeLock === 'function', 'counter-view.js exports releaseWakeLock()');

  const recipeListViewMod = await import('../js/views/recipe-list-view.js');
  assert(typeof recipeListViewMod.renderRecipeList === 'function', 'recipe-list-view.js exports renderRecipeList()');
  assert(typeof recipeListViewMod.updateCustomFilterVisibility === 'function', 'recipe-list-view.js exports updateCustomFilterVisibility()');
  assert(typeof recipeListViewMod.filterByTag === 'function', 'recipe-list-view.js exports filterByTag()');
  assert(typeof recipeListViewMod.setupTagAutocomplete === 'function', 'recipe-list-view.js exports setupTagAutocomplete()');
  assert(typeof recipeListViewMod.setRecipeListCallbacks === 'function', 'recipe-list-view.js exports setRecipeListCallbacks()');

  const topBarMod = await import('../js/components/top-bar.js');
  assert(typeof topBarMod.setupTopBarEventListeners === 'function', 'top-bar.js exports setupTopBarEventListeners()');
  assert(typeof topBarMod.updateMyBarBadge === 'function', 'top-bar.js exports updateMyBarBadge()');
  assert(typeof topBarMod.updateVaultStats === 'function', 'top-bar.js exports updateVaultStats()');
  assert(typeof topBarMod.setUnitSystem === 'function', 'top-bar.js exports setUnitSystem()');
  assert(typeof topBarMod.setGlassViewMode === 'function', 'top-bar.js exports setGlassViewMode()');
  assert(typeof topBarMod.setLibrarySort === 'function', 'top-bar.js exports setLibrarySort()');
  assert(typeof topBarMod.setTopBarCallbacks === 'function', 'top-bar.js exports setTopBarCallbacks()');

  const backbarModalMod = await import('../js/components/backbar-modal.js');
  assert(typeof backbarModalMod.setupBackbarEventListeners === 'function', 'backbar-modal.js exports setupBackbarEventListeners()');
  assert(typeof backbarModalMod.openBackbarModal === 'function', 'backbar-modal.js exports openBackbarModal()');
  assert(typeof backbarModalMod.closeBackbarModal === 'function', 'backbar-modal.js exports closeBackbarModal()');
  assert(typeof backbarModalMod.toggleInventoryBottle === 'function', 'backbar-modal.js exports toggleInventoryBottle()');
  assert(typeof backbarModalMod.renderBackbarModalContent === 'function', 'backbar-modal.js exports renderBackbarModalContent()');

  const hiddenModalMod = await import('../js/components/hidden-modal.js');
  assert(typeof hiddenModalMod.setupHiddenModalEventListeners === 'function', 'hidden-modal.js exports setupHiddenModalEventListeners()');
  assert(typeof hiddenModalMod.openHiddenModal === 'function', 'hidden-modal.js exports openHiddenModal()');
  assert(typeof hiddenModalMod.closeHiddenModal === 'function', 'hidden-modal.js exports closeHiddenModal()');
  assert(typeof hiddenModalMod.renderHiddenRecipesModal === 'function', 'hidden-modal.js exports renderHiddenRecipesModal()');

  const editorModalMod = await import('../js/components/editor-modal.js');
  assert(typeof editorModalMod.openEditor === 'function', 'editor-modal.js exports openEditor()');
  assert(typeof editorModalMod.cancelEditor === 'function', 'editor-modal.js exports cancelEditor()');
  assert(typeof editorModalMod.renderEditorSpecRows === 'function', 'editor-modal.js exports renderEditorSpecRows()');
  assert(typeof editorModalMod.renderEditorTagChips === 'function', 'editor-modal.js exports renderEditorTagChips()');
  assert(typeof editorModalMod.setupEditorEvents === 'function', 'editor-modal.js exports setupEditorEvents()');

  const toastMod = await import('../js/components/toast.js');
  assert(typeof toastMod.showToast === 'function', 'toast.js exports showToast()');
  assert(typeof toastMod.escapeHtml === 'function', 'toast.js exports escapeHtml()');

  const timerModalMod = await import('../js/components/timer-modal.js');
  assert(typeof timerModalMod.openTimerModal === 'function', 'timer-modal.js exports openTimerModal()');
  assert(typeof timerModalMod.closeTimerModal === 'function', 'timer-modal.js exports closeTimerModal()');
  assert(typeof timerModalMod.setupTimerModalEventListeners === 'function', 'timer-modal.js exports setupTimerModalEventListeners()');

  const parserMod = await import('../js/modules/parser.js');
  assert(typeof parserMod.detectTimers === 'function', 'parser.js exports detectTimers()');
  assert(typeof parserMod.renderInstructionTimers === 'function', 'parser.js exports renderInstructionTimers()');

  const balanceMod = await import('../js/modules/balance.js');
  assert(typeof balanceMod.calculatePalateSimilarity === 'function', 'balance.js exports calculatePalateSimilarity()');

  const taxonomyMod = await import('../js/modules/taxonomy.js');
  assert(typeof taxonomyMod.getRankedShoppingList === 'function', 'taxonomy.js exports getRankedShoppingList()');

  assert(typeof counterViewMod.getEnhancedSimilarCocktails === 'function', 'counter-view.js exports getEnhancedSimilarCocktails()');
  assert(typeof counterViewMod.formatPalateMatchLabel === 'function', 'counter-view.js exports formatPalateMatchLabel()');
  assert(typeof backbarModalMod.renderShoppingListContent === 'function', 'backbar-modal.js exports renderShoppingListContent()');

  const historyMod = await import('../js/modules/history.js');
  assert(typeof historyMod.logDrinkMade === 'function', 'history.js exports logDrinkMade()');
  assert(typeof historyMod.getDrinkHistory === 'function', 'history.js exports getDrinkHistory()');
  assert(typeof historyMod.syncLocalHistoryToCloud === 'function', 'history.js exports syncLocalHistoryToCloud()');

  assert(typeof topBarMod.updateAuthIndicator === 'function', 'top-bar.js exports updateAuthIndicator()');

  const authModalMod = await import('../js/components/auth-modal.js');
  assert(typeof authModalMod.setupAuthModalEventListeners === 'function', 'auth-modal.js exports setupAuthModalEventListeners()');
  assert(typeof authModalMod.openAuthModal === 'function', 'auth-modal.js exports openAuthModal()');
  assert(typeof authModalMod.closeAuthModal === 'function', 'auth-modal.js exports closeAuthModal()');

  const appMod = await import('../app.js');
  assert(typeof appMod === 'object', 'app.js imports and evaluates successfully');

  console.log('\n--- 3. Testing HTML Preload & Asset Consistency ---');
  const indexHtml = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');

  // Check modulepreloads
  const preloadRegex = /<link\s+rel="modulepreload"\s+href="([^"?]+)(?:\?[^"]*)?"/g;
  let match;
  const preloadedPaths = [];
  while ((match = preloadRegex.exec(indexHtml)) !== null) {
    preloadedPaths.push(match[1]);
  }
  assert(preloadedPaths.length > 0, `Found ${preloadedPaths.length} modulepreload links in index.html`);
  for (const relPath of preloadedPaths) {
    const fullPath = path.join(rootDir, relPath);
    assert(fs.existsSync(fullPath), `Preloaded file exists: ${relPath}`);
  }

  // Check stylesheet links
  const cssRegex = /<link\s+rel="stylesheet"\s+href="([^"?]+)(?:\?[^"]*)?"/g;
  const cssLinks = [];
  while ((match = cssRegex.exec(indexHtml)) !== null) {
    cssLinks.push(match[1]);
  }
  for (const relPath of cssLinks) {
    const fullPath = path.join(rootDir, relPath);
    assert(fs.existsSync(fullPath), `Stylesheet file exists: ${relPath}`);
  }

  // Check main module script tag
  const scriptMatch = indexHtml.match(/<script\s+type="module"\s+src="([^"?]+)(?:\?[^"]*)?"/);
  assert(scriptMatch !== null, 'Found type="module" script in index.html');
  if (scriptMatch) {
    const scriptPath = path.join(rootDir, scriptMatch[1]);
    assert(fs.existsSync(scriptPath), `Main script file exists: ${scriptMatch[1]}`);
  }

  console.log('\n--- 4. Testing CSS Import Chain & Rules ---');
  const indexCss = fs.readFileSync(path.join(rootDir, 'css', 'index.css'), 'utf8');
  const importRegex = /@import\s+url\(['"]?\.?\/?([^'")]+)['"]?\);/g;
  const importedCss = [];
  while ((match = importRegex.exec(indexCss)) !== null) {
    importedCss.push(match[1]);
  }
  assert(importedCss.length === 8, `index.css imports 8 modular stylesheets (found: ${importedCss.length})`);
  for (const cssFile of importedCss) {
    const fullPath = path.join(rootDir, 'css', cssFile);
    assert(fs.existsSync(fullPath), `CSS module file exists: css/${cssFile}`);
    const content = fs.readFileSync(fullPath, 'utf8');
    assert(content.length > 50, `css/${cssFile} is non-empty (${content.length} bytes)`);

    // Basic brace balance check
    const openBraces = (content.match(/{/g) || []).length;
    const closeBraces = (content.match(/}/g) || []).length;
    assert(openBraces === closeBraces, `css/${cssFile} has balanced braces (${openBraces} open, ${closeBraces} close)`);
  }

  console.log('\n--- 5. Testing Inventory Analysis Caching ---');
  const testRecipe = directSeeds[0];
  const v1 = stateMod.inventoryVersion;
  const res1 = stateMod.getCachedInventoryAnalysis(testRecipe);
  const res2 = stateMod.getCachedInventoryAnalysis(testRecipe);
  assert(res1 === res2, 'getCachedInventoryAnalysis returns cached reference on consecutive calls');

  stateMod.invalidateInventoryCache();
  assert(stateMod.inventoryVersion === v1 + 1, 'invalidateInventoryCache increments inventoryVersion');
  const res3 = stateMod.getCachedInventoryAnalysis(testRecipe);
  assert(typeof res3 === 'object' && res3.canMake !== undefined, 'getCachedInventoryAnalysis re-evaluates after cache invalidation');

  console.log('\n--- 6. Testing Custom Pack Filter Visibility & Filter Logic ---');
  const authMod = await import('../js/modules/auth.js');
  const mockButton = { style: { display: 'none' } };
  stateMod.elements.packPillCustom = mockButton;

  // Case 1: Guest (not authenticated), with custom recipes -> hidden
  stateMod.state.recipes = [...directSeeds, { id: 'custom-cocktail-1', name: 'My Own Cocktail', specs: [] }];
  recipeListViewMod.updateCustomFilterVisibility();
  assert(mockButton.style.display === 'none', 'Custom filter button is hidden when user is not authenticated');

  // Case 2: Signed in, but 0 custom recipes -> hidden
  globalThis.localStorage = {
    getItem: (k) => k === 'speakeasy_auth_token' ? 'fake-token-123' : (k === 'speakeasy_user' ? JSON.stringify({ id: 'u1', email: 'test@example.com' }) : null),
    setItem: () => {},
    removeItem: () => {}
  };
  stateMod.state.recipes = [...directSeeds];
  recipeListViewMod.updateCustomFilterVisibility();
  assert(mockButton.style.display === 'none', 'Custom filter button is hidden when user has no custom recipes');

  // Case 3: Signed in AND has custom recipes -> displayed
  stateMod.state.recipes = [...directSeeds, { id: 'custom-cocktail-1', name: 'My Own Cocktail', specs: [] }];
  recipeListViewMod.updateCustomFilterVisibility();
  assert(mockButton.style.display === 'inline-flex', 'Custom filter button is shown when signed in and user has custom cocktails');

  // Case 4: Pack filter set to custom filters properly
  stateMod.state.packFilter = 'custom';
  stateMod.state.searchQuery = '';
  stateMod.state.inventoryFilter = 'all';
  recipeListViewMod.renderRecipeList();
  // Ensure the count reflects custom recipes
  assert(stateMod.elements.countAll?.textContent === '1', 'Custom pack filter only includes non-seed recipes');

  // Clean up mock localStorage
  delete globalThis.localStorage;

  console.log(`\nAll Architecture Tests Complete! Passed: ${passedTests} / ${totalTests}`);
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
