import assert from 'node:assert/strict';
import { SEED_RECIPES } from '../js/data/seed-recipes.js';
import { buildTraits, buildQuizQuestions, rankForQuiz, strengthBand, sweetnessBand, QUIZ_RESULT_COUNT } from '../js/modules/quiz.js';

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

// Test 1: a full menu asks all four questions, each with real choices
{
  const questions = buildQuizQuestions(SEED_RECIPES, traits);
  assert.deepEqual(questions.map(q => q.id), ['vibe', 'strength', 'sweetness', 'spirit']);
  for (const q of questions) {
    assert.ok(q.options.length >= 3, `Question "${q.id}" needs real choices`);
    assert.ok(q.options.some(o => o.value === 'any'), `Question "${q.id}" needs a no-preference answer`);
    assert.equal(new Set(q.options.map(o => o.value)).size, q.options.length, `Question "${q.id}" has duplicate option values`);
  }
  console.log('PASS: a full menu gets vibe, strength, sweetness, and spirit questions, each skippable');
}

// Test 2: a menu can't be asked about things it doesn't have
{
  const ginOnly = SEED_RECIPES.filter(r => r.tags.includes('gin-forward') && r.tags.includes('sour')).slice(0, 4);
  const questions = buildQuizQuestions(ginOnly, buildTraits(ginOnly));
  assert.ok(!questions.some(q => q.id === 'spirit'), 'A menu with one spirit should not ask which spirit');
  assert.ok(questions.some(q => q.id === 'strength'), 'Strength still applies');
  const spirits = buildQuizQuestions(SEED_RECIPES, traits).find(q => q.id === 'spirit').options.map(o => o.value);
  assert.ok(spirits.includes('gin') && spirits.includes('whiskey'));
  console.log('PASS: questions with fewer than two real choices are skipped');
}

// Test 3: named preferences drive the pick
{
  const answers = { vibe: 'refreshing', strength: 'light', sweetness: 'any', spirit: 'gin' };
  const results = rankForQuiz(SEED_RECIPES, traits, answers, seededRng(1));
  assert.equal(results.length, QUIZ_RESULT_COUNT);
  assert.equal(new Set(results.map(r => r.recipe.id)).size, QUIZ_RESULT_COUNT, 'Expected three different drinks');
  const top = results[0];
  assert.ok(traits.get(top.recipe.id).tags.has('gin-forward'), `Top pick "${top.recipe.name}" should be gin-forward when gin was requested`);
  assert.ok(top.score >= results[1].score && results[1].score >= results[2].score, 'Expected best-first ordering');
  assert.ok(top.reasons.includes('Gin') && top.reasons.includes('Bright & refreshing'), `Expected the reasons to explain the match, got ${top.reasons}`);
  console.log(`PASS: asking for a light, refreshing gin drink returns ${top.recipe.name} first, with reasons`);
}

// Test 4: strength and sweetness steer toward the right band
{
  const strong = rankForQuiz(SEED_RECIPES, traits, { strength: 'strong', sweetness: 'any', vibe: 'any', spirit: 'any' }, seededRng(2));
  for (const r of strong) assert.equal(strengthBand(traits.get(r.recipe.id).abv), 'strong', `${r.recipe.name} isn't a strong drink`);
  const dry = rankForQuiz(SEED_RECIPES, traits, { sweetness: 'dry', strength: 'any', vibe: 'any', spirit: 'any' }, seededRng(3));
  for (const r of dry) assert.equal(sweetnessBand(traits.get(r.recipe.id).profile.sweet), 'dry', `${r.recipe.name} isn't a dry drink`);
  console.log('PASS: strength and sweetness answers steer results into the right band');
}

// Test 5: "no preference" everywhere is a random three, and varies between runs
{
  const anything = { vibe: 'any', strength: 'any', sweetness: 'any', spirit: 'any' };
  const a = rankForQuiz(SEED_RECIPES, traits, anything, seededRng(10)).map(r => r.recipe.id);
  const b = rankForQuiz(SEED_RECIPES, traits, anything, seededRng(11)).map(r => r.recipe.id);
  assert.equal(a.length, QUIZ_RESULT_COUNT);
  assert.notDeepEqual(a, b, 'Different draws should be able to surface different drinks');
  console.log('PASS: no preferences gives a random three');
}

// Test 6: only the drinks it's handed can be recommended (so "out" drinks can be excluded by the caller)
{
  const menu = SEED_RECIPES.filter(r => !['negroni', 'daiquiri'].includes(r.id));
  const results = rankForQuiz(menu, buildTraits(menu), { vibe: 'bittersweet', strength: 'any', sweetness: 'any', spirit: 'any' }, seededRng(4));
  assert.ok(!results.some(r => ['negroni', 'daiquiri'].includes(r.recipe.id)));
  assert.deepEqual(rankForQuiz([], new Map(), {}), [], 'An empty menu recommends nothing');
  const two = SEED_RECIPES.slice(0, 2);
  assert.equal(rankForQuiz(two, buildTraits(two), {}, seededRng(5)).length, 2, 'A tiny menu returns what it has');
  console.log('PASS: only offered drinks are recommended; tiny and empty menus are handled');
}

console.log('All quiz tests passed.');
