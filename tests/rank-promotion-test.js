/**
 * Regression test for the mixologist rank-up celebration banner.
 *
 * Sign-in fires several rank-affecting events in a tight burst (auth
 * change, cloud data pull, history sync each dispatch their own event —
 * see the listeners wired in top-bar.js), and the score can jump multiple
 * tiers across that burst. checkMixologistRankPromotion() must coalesce
 * same-burst calls into a single banner reflecting the user's final,
 * highest rank rather than stacking one banner per intermediate tier.
 */

import assert from 'node:assert/strict';

// Minimal in-memory localStorage
class MockLocalStorage {
  constructor() {
    this.store = new Map();
  }
  getItem(key) {
    return this.store.has(key) ? this.store.get(key) : null;
  }
  setItem(key, value) {
    this.store.set(key, String(value));
  }
  removeItem(key) {
    this.store.delete(key);
  }
  clear() {
    this.store.clear();
  }
}
const mockStorage = new MockLocalStorage();
globalThis.localStorage = mockStorage;

// Minimal document mock: just enough for toast.js's showLevelUpCelebration
// to build and append a toast node without a real DOM.
function createFakeElement() {
  return {
    className: '',
    innerHTML: '',
    style: { setProperty() {} },
    children: [],
    setAttribute() {},
    addEventListener() {},
    appendChild(child) {
      this.children.push(child);
    },
    remove() {},
  };
}
globalThis.document = {
  documentElement: { classList: { contains: () => false } },
  createElement: () => createFakeElement(),
  getElementById: () => null,
};

console.log('--- Testing Mixologist Rank-Up Banner Coalescing ---');

const stateMod = await import('../public/js/state.js');
const topBarMod = await import('../public/js/components/top-bar.js');

const HISTORY_STORAGE_KEY = 'speakeasy_drink_history';

function setDrinkHistory(count) {
  const entries = Array.from({ length: count }, (_, i) => ({
    id: `hist-${i}`,
    recipeId: `recipe-${i}`,
    madeAt: new Date(2026, 0, i + 1).toISOString(),
  }));
  mockStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(entries));
}

// getMixologistRankDetails() only reads getDrinkHistory()'s default 15-entry
// window, capping history's contribution at 90 points (15 * 6) — custom
// scratch recipes (8 pts each) push the score past that for the top tier.
function setCustomScratchRecipes(count) {
  stateMod.state.recipes = Array.from({ length: count }, (_, i) => ({
    id: `custom-scratch-${i}`,
    name: `Custom ${i}`,
    specs: [],
  }));
}

// Fake toast container the banner gets appended to
const toastContainer = { children: [], appendChild(el) { this.children.push(el); } };
stateMod.elements.toastContainer = toastContainer;
stateMod.state.recipes = [];
stateMod.state.pinnedTags = [];
stateMod.state.inventory = new Set();

// 1. Burst of calls while score climbs across multiple rank tiers must
// coalesce into exactly one banner, comparing against the pre-burst rank.
{
  mockStorage.clear();
  toastContainer.children = [];
  stateMod.state.recipes = [];
  mockStorage.setItem('speakeasy_last_seen_rank_score', '0'); // starts at "Cocktail Curious"
  mockStorage.setItem('speakeasy_mixologist_lifetime_score', '0');

  setDrinkHistory(0); // score 0 -> Cocktail Curious
  topBarMod.checkMixologistRankPromotion();

  setDrinkHistory(6); // score 36 -> Bootlegger (would be its own banner pre-fix)
  topBarMod.checkMixologistRankPromotion();

  setDrinkHistory(15); // score 90 (15-entry cap)
  setCustomScratchRecipes(2); // +16 -> score 106 -> Tin Shaker, the burst's final rank
  topBarMod.checkMixologistRankPromotion();

  assert.equal(toastContainer.children.length, 0, 'no banner shows synchronously during the burst');

  // Wait past the coalescing window
  await new Promise(resolve => setTimeout(resolve, 500));

  assert.equal(toastContainer.children.length, 1, 'exactly one banner shows after the burst settles');
  const toastHtml = toastContainer.children[0].innerHTML;
  assert.ok(toastHtml.includes('Tin Shaker'), 'banner reflects the final, highest rank reached');
  assert.ok(toastHtml.includes('Promoted from Cocktail Curious'), 'banner compares against the pre-burst rank, not an intermediate one');
  assert.ok(!toastHtml.includes('Bootlegger'), 'the intermediate tier crossed mid-burst is not shown as its own banner');

  assert.equal(mockStorage.getItem('speakeasy_last_seen_rank_score'), '100', 'last-seen rank threshold persisted as the final tier');

  console.log('PASS: rapid-fire promotion checks during a sign-in burst coalesce into a single banner for the highest rank');
}

// 2. A single, isolated call still behaves as a normal promotion check.
{
  mockStorage.clear();
  toastContainer.children = [];
  stateMod.state.recipes = [];
  mockStorage.setItem('speakeasy_last_seen_rank_score', '0');
  mockStorage.setItem('speakeasy_mixologist_lifetime_score', '0');

  setDrinkHistory(6); // score 36 -> Bootlegger
  topBarMod.checkMixologistRankPromotion();

  await new Promise(resolve => setTimeout(resolve, 500));

  assert.equal(toastContainer.children.length, 1, 'a single promotion still shows exactly one banner');
  assert.ok(toastContainer.children[0].innerHTML.includes('Bootlegger'), 'banner reflects the reached rank');

  console.log('PASS: a single, isolated promotion check is unaffected by the coalescing change');
}

console.log('All Rank Promotion tests passed successfully!\n');
