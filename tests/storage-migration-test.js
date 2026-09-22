/**
 * Dedicated test suite for localStorage migration, inventory cleanup, and settings consolidation.
 */

import assert from 'node:assert';

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
  get length() {
    return this.store.size;
  }
  key(index) {
    return Array.from(this.store.keys())[index] || null;
  }
}

// Attach localStorage before importing modules
const mockStorage = new MockLocalStorage();
globalThis.localStorage = new Proxy(mockStorage, {
  get(target, prop) {
    if (prop in target) {
      if (typeof target[prop] === 'function') {
        return target[prop].bind(target);
      }
      return target[prop];
    }
    // Allow Object.keys(localStorage) to enumerate stored keys
    return target.getItem(prop);
  },
  ownKeys(target) {
    return Array.from(target.store.keys());
  },
  getOwnPropertyDescriptor(target, prop) {
    if (target.store.has(prop)) {
      return {
        enumerable: true,
        configurable: true,
        writable: true,
        value: target.store.get(prop),
      };
    }
    return undefined;
  },
});

console.log('--- Testing Storage Migration & Consolidation ---');

const storageMod = await import('../public/js/modules/storage.js');

// 1. Test settings migration from individual keys to speakeasy_settings with boolean coercion
{
  mockStorage.clear();
  mockStorage.setItem('speakeasy_unit_system', 'ml');
  mockStorage.setItem('speakeasy_glass_view_mode', 'blended');
  mockStorage.setItem('speakeasy_wake_lock_enabled', 'false'); // string "false"
  mockStorage.setItem('speakeasy_fun_animations_enabled', 'true'); // string "true"
  mockStorage.setItem('speakeasy_library_sort', 'specs-asc');

  const settings = storageMod.getAppSettings();

  assert.strictEqual(settings.unitSystem, 'ml', 'unitSystem migrated to ml');
  assert.strictEqual(settings.glassViewMode, 'blended', 'glassViewMode migrated to blended');
  assert.strictEqual(settings.wakeLockEnabled, false, 'wakeLockEnabled strictly coerced to boolean false');
  assert.strictEqual(settings.funAnimationsEnabled, true, 'funAnimationsEnabled strictly coerced to boolean true');
  assert.strictEqual(settings.librarySort, 'specs-asc', 'librarySort migrated to specs-asc');

  // Verify legacy standalone keys were purged
  assert.strictEqual(mockStorage.getItem('speakeasy_unit_system'), null, 'legacy unit key removed');
  assert.strictEqual(mockStorage.getItem('speakeasy_glass_view_mode'), null, 'legacy glass mode key removed');
  assert.strictEqual(mockStorage.getItem('speakeasy_wake_lock_enabled'), null, 'legacy wake lock key removed');
  assert.strictEqual(mockStorage.getItem('speakeasy_fun_animations_enabled'), null, 'legacy fun animations key removed');
  assert.strictEqual(mockStorage.getItem('speakeasy_library_sort'), null, 'legacy sort key removed');

  // Verify accessor functions
  assert.strictEqual(storageMod.getUnitPreference(), 'ml');
  assert.strictEqual(storageMod.getGlassViewPreference(), 'blended');
  assert.strictEqual(storageMod.getWakeLockPreference(), false);
  assert.strictEqual(storageMod.getFunPreference(), true);
  assert.strictEqual(storageMod.getSortPreference(), 'specs-asc');

  console.log('PASS: Settings migration and strict boolean coercion verified');
}

// 2. Test inventory migration with ID deduping into default bar
{
  mockStorage.clear();

  const barId1 = 'bar-default-1';
  const barId2 = 'bar-secondary-2';
  const existingBars = [
    { id: barId1, name: 'Main Bar', isDefault: true, createdAt: 1000 },
    { id: barId2, name: 'Office Bar', isDefault: false, createdAt: 2000 }
  ];

  mockStorage.setItem('speakeasy_bars', JSON.stringify(existingBars));
  mockStorage.setItem('speakeasy_active_bar_id', JSON.stringify(barId1));

  // Current default bar inventory
  mockStorage.setItem(`speakeasy_inventory__${barId1}`, JSON.stringify(['bourbon', 'campari']));
  // Secondary bar inventory
  mockStorage.setItem(`speakeasy_inventory__${barId2}`, JSON.stringify(['gin']));
  // Orphaned bar inventory for a deleted bar
  mockStorage.setItem('speakeasy_inventory__bar-deleted-999', JSON.stringify(['vodka']));

  // Pre-multi-bar legacy inventory with overlapping bottle ('bourbon') and new bottle ('rye_whiskey')
  mockStorage.setItem('speakeasy_inventory', JSON.stringify(['bourbon', 'rye_whiskey']));
  mockStorage.setItem('speakeasy_bar_name', 'Old Bar Name');

  // Trigger bars initialization/cleanup
  const bars = storageMod.getBars();
  assert.strictEqual(bars.length, 2, 'Bars count remains 2');

  const defaultInventory = storageMod.getInventoryForBar(barId1);
  // Must contain bourbon, campari, rye_whiskey with no duplicates
  assert.deepStrictEqual(
    defaultInventory.sort(),
    ['bourbon', 'campari', 'rye_whiskey'].sort(),
    'Default bar inventory correctly unioned with legacy inventory and deduplicated'
  );

  // Secondary bar should be untouched
  assert.deepStrictEqual(storageMod.getInventoryForBar(barId2), ['gin'], 'Secondary bar inventory untouched');

  // Orphaned bar key should be pruned
  assert.strictEqual(mockStorage.getItem('speakeasy_inventory__bar-deleted-999'), null, 'Orphaned bar inventory key pruned');

  // Legacy single-bar keys should be removed
  assert.strictEqual(mockStorage.getItem('speakeasy_inventory'), null, 'Legacy speakeasy_inventory key removed');
  assert.strictEqual(mockStorage.getItem('speakeasy_bar_name'), null, 'Legacy speakeasy_bar_name key removed');

  console.log('PASS: Legacy inventory union-merge (exact ID deduping) and orphaned bar pruning verified');
}

// 3. Test clearUserDataOnSignOut cleans consolidated settings and per-bar inventory
{
  mockStorage.setItem('speakeasy_settings', JSON.stringify({ unitSystem: 'ml' }));
  mockStorage.setItem('speakeasy_inventory__bar-default-1', JSON.stringify(['bourbon']));

  storageMod.clearUserDataOnSignOut();

  assert.strictEqual(mockStorage.getItem('speakeasy_settings'), null, 'speakeasy_settings cleared on sign out');
  assert.strictEqual(mockStorage.getItem('speakeasy_inventory__bar-default-1'), null, 'Per-bar inventory cleared on sign out');

  console.log('PASS: Sign out clears consolidated settings and per-bar inventory');
}

// 4. Stored Penicillin copies pick up the honey-ginger syrup fix without touching other edits
{
  const STORAGE_KEY_RECIPES = 'speakeasy_recipes';
  const seedPen = storageMod.SEED_RECIPES.find(r => r.id === 'penicillin');
  const oldCopy = {
    ...seedPen,
    instructions: seedPen.instructions.replace('honey-ginger syrup', 'honey syrup'),
    notes: 'my own note',
    specs: seedPen.specs.map(s => (s.name === 'Honey-Ginger Syrup' ? { ...s, name: 'Honey Syrup' } : { ...s })),
  };
  mockStorage.setItem(STORAGE_KEY_RECIPES, JSON.stringify([oldCopy]));

  const migrated = storageMod.getRecipes().find(r => r.id === 'penicillin');
  assert.ok(migrated.specs.some(s => s.name === 'Honey-Ginger Syrup'), 'Penicillin spec migrated to Honey-Ginger Syrup');
  assert.ok(!migrated.specs.some(s => s.name === 'Honey Syrup'), 'Penicillin no longer lists plain Honey Syrup');
  assert.ok(migrated.instructions.includes('honey-ginger syrup'), 'Penicillin method text migrated');
  assert.strictEqual(migrated.notes, 'my own note', "the user's own edits to Penicillin are preserved");

  console.log('PASS: Stored Penicillin migrates to honey-ginger syrup and keeps user edits');
}

console.log('All Storage Migration tests passed successfully!\n');
