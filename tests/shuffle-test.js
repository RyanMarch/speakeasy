import assert from 'node:assert/strict';
import { buildShuffleSchedule, timeToLanding, captionForFrame, SHUFFLE_CAPTIONS } from '../js/modules/shuffle-schedule.js';

console.log('--- Testing the "Surprise me" shuffle schedule ---');

function seededRng(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pool = Array.from({ length: 12 }, (_, i) => ({ id: `drink-${i}`, name: `Drink ${i}` }));

// Test 1: it always comes to rest on the pick, however the dice fall
{
  for (let seed = 1; seed <= 200; seed++) {
    const pick = pool[seed % pool.length];
    const frames = buildShuffleSchedule(pool, pick, seededRng(seed));
    assert.equal(frames[frames.length - 1].recipe.id, pick.id, `Seed ${seed}: the last frame must be the pick`);
  }
  console.log('PASS: every shuffle ends on the chosen drink');
}

// Test 2: it reads as a slowdown, not a stutter
{
  const frames = buildShuffleSchedule(pool, pool[3], seededRng(7));
  for (let i = 1; i < frames.length; i++) {
    assert.ok(frames[i].delay >= frames[i - 1].delay, 'Frames should never speed back up');
    assert.notEqual(frames[i].recipe.id, frames[i - 1].recipe.id, `Frames ${i - 1} and ${i} repeat the same drink`);
  }
  assert.ok(frames.length >= 9, 'Expected enough frames to feel like a shuffle');
  assert.notEqual(frames[frames.length - 2].recipe.id, pool[3].id, 'The pick must not appear early and then wobble');
  assert.ok(frames[0].delay < 80 && frames[frames.length - 1].delay >= 250, 'Should start fast and finish slow');
  const total = timeToLanding(frames);
  assert.ok(total >= 1000 && total <= 2000, `Landing at ${total}ms is outside a snappy 1-2s window`);
  console.log(`PASS: ${frames.length} frames slowing from ${frames[0].delay}ms to ${frames[frames.length - 1].delay}ms, landing in ${total}ms`);
}

// Test 3: tiny pools don't break it
{
  const solo = buildShuffleSchedule([pool[0]], pool[0], seededRng(1));
  assert.ok(solo.every(f => f.recipe.id === pool[0].id), 'A one-drink pool can only show that drink');
  const two = buildShuffleSchedule([pool[0], pool[1]], pool[1], seededRng(2));
  assert.equal(two[two.length - 1].recipe.id, pool[1].id);
  assert.ok(two.slice(0, -1).every(f => f.recipe.id === pool[0].id), 'The only other drink flashes by');
  assert.deepEqual(buildShuffleSchedule([], pool[0], seededRng(3)).map(f => f.recipe.id).filter(id => id !== pool[0].id), []);
  console.log('PASS: one-, two-, and zero-drink pools still land on the pick');
}

// Test 4: captions progress across the run, ending on the last line
{
  const total = 14;
  assert.equal(captionForFrame(0, total), SHUFFLE_CAPTIONS[0]);
  assert.equal(captionForFrame(total - 1, total), SHUFFLE_CAPTIONS[SHUFFLE_CAPTIONS.length - 1]);
  const seen = Array.from({ length: total }, (_, i) => SHUFFLE_CAPTIONS.indexOf(captionForFrame(i, total)));
  assert.deepEqual(seen, [...seen].sort((a, b) => a - b), 'Captions should only move forward');
  assert.equal(new Set(seen).size, SHUFFLE_CAPTIONS.length, 'Every caption should get its moment');
  console.log('PASS: captions advance evenly through the shuffle');
}

console.log('All shuffle tests passed.');
