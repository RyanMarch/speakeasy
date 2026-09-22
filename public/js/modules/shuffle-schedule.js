/**
 * Speakeasy "Surprise me" shuffle schedule
 * The fake-out behind the reveal: a run of drinks that flash by, slowing down
 * like a slot machine, and always come to rest on the drink already chosen.
 * The pick is decided first (so it's fair and testable); this only decides what
 * flickers past on the way there and how long each frame stays up.
 *
 * Pure logic, no DOM. The animation lives in views/surprise-overlay.js.
 */

// Frame durations start fast and grow geometrically until they'd be slower than
// END_MS. Tuned for readability over speed: fewer frames, each up long enough
// to register as a drink rather than a blur, landing a little under two
// seconds. Quick enough that a guest isn't waiting on a joke, slow enough to
// build a bit of suspense.
const START_MS = 70;
const GROWTH = 1.19;
const END_MS = 360;

/**
 * @param {Array} pool   the drinks that can flash by (and include the pick)
 * @param {object} pick  the drink the run must land on
 * @returns {Array<{recipe: object, delay: number}>} frames in order; `delay` is
 *   how long that frame stays on screen before the next one replaces it
 */
export function buildShuffleSchedule(pool, pick, rng = Math.random) {
  const delays = [];
  for (let d = START_MS; d < END_MS; d *= GROWTH) delays.push(Math.round(d));
  // The last frame is the pick and holds while the reveal plays.
  delays.push(Math.round(END_MS));

  const others = (pool || []).filter(r => r.id !== pick.id);
  const frames = [];
  let previous = null;

  for (let i = 0; i < delays.length - 1; i++) {
    let choice;
    if (others.length === 0) {
      choice = pick;
    } else {
      // Never the same drink twice in a row (it would look like a stall), and
      // never the pick on the second-to-last frame (it would look like it
      // landed early and then wobbled).
      const candidates = others.length > 1 ? others.filter(r => !previous || r.id !== previous.id) : others;
      choice = candidates[Math.floor(rng() * candidates.length)];
    }
    frames.push({ recipe: choice, delay: delays[i] });
    previous = choice;
  }
  frames.push({ recipe: pick, delay: delays[delays.length - 1] });
  return frames;
}

/** Total time from the first frame until the pick is showing. */
export function timeToLanding(frames) {
  return frames.slice(0, -1).reduce((sum, f) => sum + f.delay, 0);
}

// Captions that rotate as the shuffle progresses, so the wait reads as a bit of
// theatre rather than a spinner.
export const SHUFFLE_CAPTIONS = [
  'Consulting the bartender…',
  'Shaking things up…',
  'Chilling the glasses…',
  'Muddling some ideas…',
  'Almost there…',
];

/** The caption for frame `index` of `total`, spread evenly across the run. */
export function captionForFrame(index, total) {
  const last = SHUFFLE_CAPTIONS.length - 1;
  const position = total <= 1 ? last : Math.floor((index / (total - 1)) * last);
  return SHUFFLE_CAPTIONS[Math.min(last, Math.max(0, position))];
}
