import assert from 'node:assert/strict';

class MockLocalStorage {
  constructor() { this.store = new Map(); }
  getItem(key) { return this.store.has(key) ? this.store.get(key) : null; }
  setItem(key, value) { this.store.set(key, String(value)); }
  removeItem(key) { this.store.delete(key); }
}
Object.defineProperty(globalThis, 'localStorage', { value: new MockLocalStorage(), configurable: true, writable: true });

const { getSaved, toggleSaved, pruneSaved } = await import('../js/modules/guest-saved.js');
const { getGuestName, setGuestName, buildOrderMessage, MAX_NAME_LENGTH } = await import('../js/modules/guest-order.js');
const { glassLabel } = await import('../js/modules/glassware.js');

console.log('--- Testing the guest Saved list and order card ---');

// Test 1: hearting a drink saves it, in order, and hearting again removes it
{
  assert.deepEqual(getSaved('AAAAAAAAAA'), [], 'Nothing saved to begin with');
  assert.deepEqual(toggleSaved('AAAAAAAAAA', 'manhattan'), { saved: true, ids: ['manhattan'] });
  toggleSaved('AAAAAAAAAA', 'negroni');
  assert.deepEqual(getSaved('AAAAAAAAAA'), ['manhattan', 'negroni'], 'Kept in the order saved');
  assert.deepEqual(toggleSaved('AAAAAAAAAA', 'manhattan'), { saved: false, ids: ['negroni'] });
  assert.deepEqual(getSaved('BBBBBBBBBB'), [], 'Lists are per menu');
  console.log('PASS: saving toggles, keeps order, and is kept per menu');
}

// Test 2: a removed drink can't linger; only recent menus are remembered
{
  toggleSaved('CCCCCCCCCC', 'a'); toggleSaved('CCCCCCCCCC', 'b'); toggleSaved('CCCCCCCCCC', 'c');
  assert.deepEqual(pruneSaved('CCCCCCCCCC', ['a', 'c', 'z']), ['a', 'c'], 'Drinks the host removed drop out');
  assert.deepEqual(getSaved('CCCCCCCCCC'), ['a', 'c'], 'The pruned list is what is remembered');
  assert.deepEqual(pruneSaved('DDDDDDDDDD', ['a']), [], 'Pruning an empty list is harmless');

  toggleSaved('EEEEEEEEEE', 'x'); toggleSaved('FFFFFFFFFF', 'x'); toggleSaved('GGGGGGGGGG', 'x');
  const remembered = ['AAAAAAAAAA', 'CCCCCCCCCC', 'EEEEEEEEEE', 'FFFFFFFFFF', 'GGGGGGGGGG'].filter(id => getSaved(id).length > 0);
  assert.ok(remembered.length <= 3, `Only the last 3 menus keep a list; ${remembered.length} did`);
  assert.deepEqual(getSaved('GGGGGGGGGG'), ['x'], 'The most recent menu is always kept');
  console.log('PASS: removed drinks are pruned, and only the last few menus are remembered');
}

// Test 3: corrupt storage reads as "nothing saved"
{
  localStorage.setItem('speakeasy_guest_saved_HHHHHHHHHH', '{nope');
  assert.deepEqual(getSaved('HHHHHHHHHH'), []);
  localStorage.setItem('speakeasy_guest_saved_IIIIIIIIII', JSON.stringify({ not: 'an array' }));
  assert.deepEqual(getSaved('IIIIIIIIII'), []);
  console.log('PASS: corrupt saved data reads as empty');
}

// Test 4: the order message reads like a person wrote it
{
  assert.equal(buildOrderMessage({ drinkNames: ['Manhattan'] }), "Hi! I'd like the Manhattan, please.");
  assert.equal(buildOrderMessage({ name: 'Alex', drinkNames: ['Manhattan'] }), "Hi! I'd like the Manhattan, please. — Alex");
  assert.equal(buildOrderMessage({ name: 'Alex', drinkNames: ['Manhattan', 'Negroni'] }), "Hi! I'd like the Manhattan and the Negroni, please. — Alex");
  assert.equal(buildOrderMessage({ drinkNames: ['Manhattan', 'Negroni', 'Daiquiri'] }), "Hi! I'd like the Manhattan, the Negroni and the Daiquiri, please.");
  assert.equal(buildOrderMessage({ drinkNames: [] }), '', 'Nothing to order, nothing to say');
  assert.equal(buildOrderMessage({ name: '  ', drinkNames: ['  ', 'Manhattan'] }), "Hi! I'd like the Manhattan, please.", 'Blank names and drinks are ignored');
  console.log('PASS: order messages read naturally for one, two, and several drinks');
}

// Test 5: the guest's name is remembered, trimmed, and capped
{
  assert.equal(getGuestName(), '');
  assert.equal(setGuestName('  Alex  '), 'Alex');
  assert.equal(getGuestName(), 'Alex');
  assert.equal(setGuestName('x'.repeat(100)).length, MAX_NAME_LENGTH, 'Long names are capped');
  assert.equal(setGuestName(''), '');
  assert.equal(getGuestName(), '', 'Clearing the name forgets it');
  console.log('PASS: the guest name is remembered, trimmed, capped, and clearable');
}

// Test 6: glass names read like a sentence
{
  assert.equal(glassLabel('Rocks'), 'Rocks glass');
  assert.equal(glassLabel('Coupe'), 'Coupe glass');
  assert.equal(glassLabel('Nick & Nora'), 'Nick & Nora glass');
  assert.equal(glassLabel('Mug'), 'Mug', 'A mug is already a vessel');
  assert.equal(glassLabel('Tiki Mug'), 'Tiki Mug');
  assert.equal(glassLabel('Rocks glass'), 'Rocks glass', 'Never doubled up');
  assert.equal(glassLabel(''), '');
  assert.equal(glassLabel(undefined), '');
  console.log('PASS: glass names read naturally ("Rocks glass", "Tiki Mug"), and never double up');
}

{
  const { randomNamePlaceholder } = await import('../js/modules/guest-order.js');
  assert.match(randomNamePlaceholder(), /^e\.g\. \S/);
  assert.notEqual(randomNamePlaceholder(() => 0), randomNamePlaceholder(() => 0.99), 'Different rolls give different examples');
  assert.ok(randomNamePlaceholder(() => 0.9999999).length > 5, 'The top of the range is still a valid pick');
  console.log('PASS: the name field shows a random example placeholder');
}

console.log('All guest personal tests passed.');
