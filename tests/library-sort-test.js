/**
 * Tests for library filter and sort options:
 * - Sort ordering (name-asc, abv-asc, specs-asc, calories-asc, curated)
 * - Storage persistence and validation
 * - Filter & sort active count logic
 */

import assert from 'node:assert';
import test from 'node:test';

// Create an in-memory mock for localStorage
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

const storageMod = await import('../js/modules/storage.js');
const { getSortPreference, saveSortPreference } = storageMod;
const { calculateCocktailAbv, calculateCocktailCalories } = await import('../js/modules/abv.js');

test('Sort preference persistence and validation', () => {
  mockStorage.clear();

  // Default is curated
  assert.strictEqual(getSortPreference(), 'curated');

  // Valid sorts
  saveSortPreference('name-asc');
  assert.strictEqual(getSortPreference(), 'name-asc');

  saveSortPreference('abv-asc');
  assert.strictEqual(getSortPreference(), 'abv-asc');

  saveSortPreference('specs-asc');
  assert.strictEqual(getSortPreference(), 'specs-asc');

  saveSortPreference('calories-asc');
  assert.strictEqual(getSortPreference(), 'calories-asc');

  // Invalid sort falls back to curated
  saveSortPreference('invalid-sort-name');
  assert.strictEqual(getSortPreference(), 'curated');
});

test('Cocktail ABV and Calorie sort comparators', () => {
  const lowAbvDrink = {
    name: 'Aperol Spritz',
    method: 'Built',
    specs: [
      { amount: 3, unit: 'oz', name: 'Prosecco', abv: 11 },
      { amount: 2, unit: 'oz', name: 'Aperol', abv: 11 },
      { amount: 1, unit: 'oz', name: 'Club Soda', abv: 0 },
    ],
  };

  const highAbvDrink = {
    name: 'Martini',
    method: 'Stirred',
    specs: [
      { amount: 2.5, unit: 'oz', name: 'London Dry Gin', abv: 40 },
      { amount: 0.5, unit: 'oz', name: 'Dry Vermouth', abv: 16 },
    ],
  };

  const abvLow = Math.round(calculateCocktailAbv(lowAbvDrink.specs, lowAbvDrink.method).estimatedAbv);
  const abvHigh = Math.round(calculateCocktailAbv(highAbvDrink.specs, highAbvDrink.method).estimatedAbv);

  assert(abvLow < abvHigh, `Expected ${abvLow}% < ${abvHigh}%`);

  const calLow = calculateCocktailCalories(lowAbvDrink.specs).totalKcal;
  const calHigh = calculateCocktailCalories(highAbvDrink.specs).totalKcal;

  assert(typeof calLow === 'number' && typeof calHigh === 'number');
});

test('Filter button active count calculation', () => {
  const avoid = new Set();
  let sort = 'curated';

  const getActiveCount = (s, a) => (s && s !== 'curated' ? 1 : 0) + a.size;

  // Initial state: nothing active
  assert.strictEqual(getActiveCount(sort, avoid), 0);

  // Non-default sort only
  sort = 'abv-asc';
  assert.strictEqual(getActiveCount(sort, avoid), 1);

  // Non-default sort + 2 allergens
  avoid.add('egg');
  avoid.add('dairy');
  assert.strictEqual(getActiveCount(sort, avoid), 3);

  // Default sort + 2 allergens
  sort = 'curated';
  assert.strictEqual(getActiveCount(sort, avoid), 2);
});
