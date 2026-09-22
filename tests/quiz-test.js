import assert from 'node:assert/strict';
import { SEED_RECIPES } from '../public/js/data/seed-recipes.js';
import { buildTraits, buildQuizQuestions, rankForQuiz, strengthBand, QUIZ_RESULT_COUNT } from '../public/js/modules/quiz.js';

console.log('--- Testing the "Find my drink" quiz ---');

// Deterministic tiebreaks so the test is reproducible
function seededRng(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const traits = buildTraits(SEED_RECIPES);

// Test 1: a full menu asks all three questions, each with real choices
{
  const questions = buildQuizQuestions(SEED_RECIPES, traits);
  assert.deepEqual(questions.map(q => q.id), ['vibe', 'strength', 'spirit']);
  for (const q of questions) {
    assert.ok(q.options.length >= 3, `Question "${q.id}" needs real choices`);
    assert.ok(q.options.some(o => o.value === 'any'), `Question "${q.id}" needs a no-preference answer`);
    assert.equal(new Set(q.options.map(o => o.value)).size, q.options.length, `Question "${q.id}" has duplicate option values`);
  }
  console.log('PASS: a full menu gets vibe, strength, and spirit questions, each skippable');
}

// Test 2: a menu can't be asked about things it doesn't have
{
  const ginOnly = SEED_RECIPES.filter(r => r.tags.includes('gin-forward') && r.tags.includes('sour')).slice(0, 4);
  const questions = buildQuizQuestions(ginOnly, buildTraits(ginOnly));
  assert.ok(!questions.some(q => q.id === 'spirit'), 'A menu with one spirit should not ask which spirit');
  assert.ok(questions.some(q => q.id === 'strength'), 'Strength still applies');
  const spirits = buildQuizQuestions(SEED_RECIPES, traits).find(q => q.id === 'spirit').options.map(o => o.value);
  assert.ok(spirits.includes('gin') && spirits.includes('bourbon') && spirits.includes('scotch'));
  console.log('PASS: questions with fewer than two real choices are skipped');
}

// Test 3: named preferences drive the pick
{
  const answers = { vibe: 'refreshing', strength: 'light', spirit: 'gin' };
  const results = rankForQuiz(SEED_RECIPES, traits, answers, seededRng(1));
  assert.equal(results.length, QUIZ_RESULT_COUNT);
  assert.equal(new Set(results.map(r => r.recipe.id)).size, QUIZ_RESULT_COUNT, 'Expected three different drinks');
  const top = results[0];
  assert.ok(traits.get(top.recipe.id).tags.has('gin-forward'), `Top pick "${top.recipe.name}" should be gin-forward when gin was requested`);
  assert.ok(top.score >= results[1].score && results[1].score >= results[2].score, 'Expected best-first ordering');
  assert.ok(top.reasons.includes('Gin') && top.reasons.includes('Bright & refreshing'), `Expected the reasons to explain the match, got ${top.reasons}`);
  console.log(`PASS: asking for a light, refreshing gin drink returns ${top.recipe.name} first, with reasons`);
}

// Test 4: strength steers toward the right band
{
  const strong = rankForQuiz(SEED_RECIPES, traits, { strength: 'strong', vibe: 'any', spirit: 'any' }, seededRng(2));
  for (const r of strong) assert.equal(strengthBand(traits.get(r.recipe.id).abv), 'strong', `${r.recipe.name} isn't a strong drink`);
  console.log('PASS: strength answers steer results into the right band');
}

// Test 5: "no preference" everywhere is a random three, and varies between runs
{
  const anything = { vibe: 'any', strength: 'any', spirit: 'any' };
  const a = rankForQuiz(SEED_RECIPES, traits, anything, seededRng(10)).map(r => r.recipe.id);
  const b = rankForQuiz(SEED_RECIPES, traits, anything, seededRng(11)).map(r => r.recipe.id);
  assert.equal(a.length, QUIZ_RESULT_COUNT);
  assert.notDeepEqual(a, b, 'Different draws should be able to surface different drinks');
  console.log('PASS: no preferences gives a random three');
}

// Test 6: only the drinks it's handed can be recommended (so "out" drinks can be excluded by the caller)
{
  const menu = SEED_RECIPES.filter(r => !['negroni', 'daiquiri'].includes(r.id));
  const results = rankForQuiz(menu, buildTraits(menu), { vibe: 'bittersweet', strength: 'any', spirit: 'any' }, seededRng(4));
  assert.ok(!results.some(r => ['negroni', 'daiquiri'].includes(r.recipe.id)));
  assert.deepEqual(rankForQuiz([], new Map(), {}), [], 'An empty menu recommends nothing');
  const two = SEED_RECIPES.slice(0, 2);
  assert.equal(rankForQuiz(two, buildTraits(two), {}, seededRng(5)).length, 2, 'A tiny menu returns what it has');
  console.log('PASS: only offered drinks are recommended; tiny and empty menus are handled');
}

// Test 7: the host's picks break ties but never beat a real preference
{
  const none = { vibe: 'any', strength: 'any', spirit: 'any' };
  const pickA = SEED_RECIPES.find(r => r.id === 'daiquiri');
  const pickB = SEED_RECIPES.find(r => r.id === 'manhattan');
  // With no preferences every drink ties, so a starred drink should always lead.
  for (let seed = 1; seed <= 25; seed++) {
    const results = rankForQuiz(SEED_RECIPES, traits, none, seededRng(seed), { featured: new Set([pickA.id, pickB.id]) });
    assert.deepEqual(new Set(results.slice(0, 2).map(r => r.recipe.id)), new Set([pickA.id, pickB.id]), `Seed ${seed}: the two picks should lead a full tie`);
  }
  // ...but a real match still wins: ask for gin and the (whiskey/rum) picks must not top the list
  const ginResults = rankForQuiz(SEED_RECIPES, traits, { ...none, spirit: 'gin' }, seededRng(3), { featured: new Set([pickA.id, pickB.id]) });
  assert.ok(traits.get(ginResults[0].recipe.id).tags.has('gin-forward'), 'A real spirit request outranks the host\'s picks');
  // and no picks at all behaves exactly as before
  const plain = rankForQuiz(SEED_RECIPES, traits, none, seededRng(9)).map(r => r.recipe.id);
  const empty = rankForQuiz(SEED_RECIPES, traits, none, seededRng(9), { featured: new Set() }).map(r => r.recipe.id);
  assert.deepEqual(plain, empty, 'An empty picks set changes nothing');
  console.log('PASS: host picks win ties but never outrank a real preference');
}

// Test 8: asking for savory surfaces savory drinks with reason
{
  const answers = { vibe: 'savory', strength: 'any', spirit: 'any' };
  const results = rankForQuiz(SEED_RECIPES, traits, answers, seededRng(7));
  assert.equal(results.length, QUIZ_RESULT_COUNT);
  const top = results[0];
  assert.ok(traits.get(top.recipe.id).tags.has('savory'), `Top pick "${top.recipe.name}" should have savory tag`);
  assert.ok(top.reasons.includes('Savory'), `Expected reasons to include "Savory", got ${top.reasons}`);
  console.log(`PASS: asking for a savory drink returns ${top.recipe.name} with Savory reason`);
}

// Test 9: asking for scotch surfaces scotch drinks with reason
{
  const answers = { vibe: 'any', strength: 'any', spirit: 'scotch' };
  const results = rankForQuiz(SEED_RECIPES, traits, answers, seededRng(8));
  assert.equal(results.length, QUIZ_RESULT_COUNT);
  const top = results[0];
  assert.ok(traits.get(top.recipe.id).tags.has('scotch-forward'), `Top pick "${top.recipe.name}" should be scotch-forward`);
  assert.ok(top.reasons.includes('Scotch'), `Expected reasons to include "Scotch", got ${top.reasons}`);
  console.log(`PASS: asking for scotch returns ${top.recipe.name} with Scotch reason`);
}

console.log('All quiz tests passed.');
