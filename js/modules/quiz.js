/**
 * Speakeasy "Find my drink" quiz
 * A few taste questions, then a top pick and two runners-up from a menu.
 * Everything is derived from data recipes already carry (mood tags, computed
 * flavor profile and ABV, spirit tags), so it works for custom recipes and
 * needs no per-drink quiz data.
 *
 * Pure logic only (no DOM), so it can be tested; the UI lives in
 * views/guest-menu-view.js.
 */

import { computeRecipeTraits, moodsFromTraits } from './moods.js';

export const QUIZ_RESULT_COUNT = 3;

// ---- Answer scales ---------------------------------------------------------
// Bands are ordered, so a near miss ("medium" for someone who said "light")
// scores partial credit rather than nothing.
const STRENGTH_BANDS = ['light', 'medium', 'strong'];
const SWEETNESS_BANDS = ['dry', 'balanced', 'sweet'];

// Cut points sit near the quartiles of the bundled library (ABV: 15 / 26;
// sweet score: 49 / 74), so each band is a real slice of a menu.
export function strengthBand(abv) {
  return abv <= 15 ? 'light' : abv < 26 ? 'medium' : 'strong';
}

export function sweetnessBand(sweetScore) {
  return sweetScore < 50 ? 'dry' : sweetScore < 70 ? 'balanced' : 'sweet';
}

// A quiz "vibe" is a friendlier grouping of the guest-facing moods: "tart" and
// "refreshing" are one answer to a person, two chips to a browser.
const VIBES = [
  { value: 'refreshing', label: 'Bright & refreshing', hint: 'Crisp, citrusy, cooling', moods: ['refreshing', 'tart'] },
  { value: 'fruity', label: 'Fruity & fun', hint: 'Juicy and tropical', moods: ['fruity'] },
  { value: 'rich', label: 'Rich & cozy', hint: 'Smooth, sweet, indulgent', moods: ['rich'] },
  { value: 'bittersweet', label: 'Bitter & bold', hint: 'Amaro, aperitivo, grown-up', moods: ['bittersweet'] },
  { value: 'herbal', label: 'Herbal & complex', hint: 'Botanical and layered', moods: ['herbal'] },
  { value: 'smoky', label: 'Smoky & spicy', hint: 'Mezcal, peat, a little heat', moods: ['smoky'] },
];

// `label` reads as a quiz answer; `heading` reads as a section title on a menu.
// Shared with menu-sections.js so "what counts as gin" is defined once.
export const SPIRITS = [
  { value: 'whiskey', label: 'Whiskey', heading: 'Whiskey', tags: ['whiskey-forward'] },
  { value: 'gin', label: 'Gin', heading: 'Gin', tags: ['gin-forward'] },
  { value: 'rum', label: 'Rum', heading: 'Rum', tags: ['rum-forward', 'cachaca-forward'] },
  { value: 'agave', label: 'Tequila or mezcal', heading: 'Tequila & mezcal', tags: ['tequila-forward', 'mezcal-forward', 'agave-forward'] },
  { value: 'vodka', label: 'Vodka', heading: 'Vodka', tags: ['vodka-forward'] },
  { value: 'brandy', label: 'Brandy or cognac', heading: 'Brandy & cognac', tags: ['cognac-forward', 'brandy-forward'] },
];

const ANY = { value: 'any', label: 'Surprise me', hint: 'No preference' };

// Weights: a spirit or vibe someone names outranks a strength/sweetness
// leaning, and partial credit on the ordered scales breaks the rest.
// Host's picks nudge a tie their way but never outrank a real match.
const PICK_BONUS = 0.5;

const WEIGHTS = { vibe: 4, spirit: 4, strengthExact: 2, strengthNear: 1, sweetExact: 2, sweetNear: 1 };

/** Computes traits for every recipe once, keyed by recipe id. */
export function buildTraits(recipes) {
  const traits = new Map();
  for (const recipe of recipes || []) {
    const t = computeRecipeTraits(recipe);
    if (t) traits.set(recipe.id, { ...t, moods: moodsFromTraits(t) });
  }
  return traits;
}

/**
 * The questions worth asking for this set of recipes. A question with fewer
 * than two real choices is left out (asking "which spirit?" of a menu that's
 * all gin isn't a question), so a small menu gets a shorter quiz.
 */
export function buildQuizQuestions(recipes, traits) {
  const has = (test) => (recipes || []).some(r => traits.has(r.id) && test(traits.get(r.id)));

  const vibes = VIBES.filter(v => has(t => v.moods.some(m => t.moods.includes(m))));
  const spirits = SPIRITS.filter(s => has(t => s.tags.some(tag => t.tags.has(tag))));

  const questions = [];
  if (vibes.length >= 2) {
    questions.push({ id: 'vibe', title: 'What sounds good right now?', options: [...vibes, ANY] });
  }
  questions.push({
    id: 'strength',
    title: 'How strong are we feeling?',
    options: [
      { value: 'light', label: 'Light & easy', hint: 'Gentle, good for a long evening' },
      { value: 'medium', label: 'In the middle', hint: 'A regular cocktail' },
      { value: 'strong', label: 'Strong & sippable', hint: 'Mostly liquor, slow' },
      { ...ANY, label: 'Anything', hint: 'No preference' },
    ],
  });
  questions.push({
    id: 'sweetness',
    title: 'Sweet or dry?',
    options: [
      { value: 'sweet', label: 'Sweeter', hint: 'Round and easygoing' },
      { value: 'balanced', label: 'Balanced', hint: 'A bit of both' },
      { value: 'dry', label: 'Dry & tart', hint: 'Sharp, crisp, less sugar' },
      { ...ANY, label: 'Anything', hint: 'No preference' },
    ],
  });
  if (spirits.length >= 2) {
    questions.push({ id: 'spirit', title: 'Any spirit you’re after?', options: [...spirits, { ...ANY, label: 'I’m easy', hint: 'Any spirit is fine' }] });
  }
  return questions;
}

function bandDistance(bands, a, b) {
  return Math.abs(bands.indexOf(a) - bands.indexOf(b));
}

function scoreRecipe(recipe, t, answers) {
  let score = 0;
  const reasons = [];

  const vibe = VIBES.find(v => v.value === answers.vibe);
  if (vibe && vibe.moods.some(m => t.moods.includes(m))) {
    score += WEIGHTS.vibe;
    reasons.push(vibe.label);
  }

  const spirit = SPIRITS.find(s => s.value === answers.spirit);
  if (spirit && spirit.tags.some(tag => t.tags.has(tag))) {
    score += WEIGHTS.spirit;
    reasons.push(spirit.label);
  }

  if (STRENGTH_BANDS.includes(answers.strength)) {
    const gap = bandDistance(STRENGTH_BANDS, answers.strength, strengthBand(t.abv));
    if (gap === 0) {
      score += WEIGHTS.strengthExact;
      reasons.push({ light: 'Light', medium: 'Medium strength', strong: 'Strong' }[answers.strength]);
    } else if (gap === 1) {
      score += WEIGHTS.strengthNear;
    }
  }

  if (SWEETNESS_BANDS.includes(answers.sweetness)) {
    const gap = bandDistance(SWEETNESS_BANDS, answers.sweetness, sweetnessBand(t.profile.sweet));
    if (gap === 0) {
      score += WEIGHTS.sweetExact;
      reasons.push({ dry: 'Dry & tart', balanced: 'Balanced', sweet: 'Sweeter' }[answers.sweetness]);
    } else if (gap === 1) {
      score += WEIGHTS.sweetNear;
    }
  }

  return { recipe, score, reasons };
}

/**
 * Ranks `recipes` for the given answers and returns the top few, best first.
 * The caller passes only drinks that can actually be ordered. Ties are broken
 * at random (via `rng`) so retaking the quiz on the same answers can surface a
 * different good option instead of always the alphabetically-first one; with
 * no preferences at all it's simply a random three.
 */
export function rankForQuiz(recipes, traits, answers, rng = Math.random, { featured = null } = {}) {
  const scored = (recipes || [])
    .filter(r => traits.has(r.id))
    .map(r => {
      const scoredRecipe = scoreRecipe(r, traits.get(r.id), answers);
      // The host's picks win close calls: worth less than any real preference
      // (the smallest is 1), so they break ties without overriding a guest.
      if (featured && featured.has(r.id)) scoredRecipe.score += PICK_BONUS;
      return { ...scoredRecipe, tiebreak: rng() };
    });

  scored.sort((a, b) => b.score - a.score || a.tiebreak - b.tiebreak);
  return scored.slice(0, QUIZ_RESULT_COUNT).map(({ recipe, score, reasons }) => ({ recipe, score, reasons }));
}
