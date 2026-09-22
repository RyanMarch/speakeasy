/**
 * Formatting and scaling for Bar Basics amounts (js/data/bar-basics.js).
 *
 * An amount is one of:
 *   - a string: shown as-is and never scaled ("2 to 3 drops")
 *   - a numeric spec { qty, unit, note? }, used for both unit systems
 *   - { us, metric }, each of which is a numeric spec or a string
 *
 * Units: cup, tbsp, tsp (US volume, which roll up and down as the batch size
 * changes), oz, g, ml (rounded to sensible kitchen precision, g and ml rolling up
 * to kg and L), and the counts stick, bean and piece.
 *
 * Pure functions with no DOM access, so they run under Node tests too.
 */

export const BATCH_SCALES = [0.5, 1, 2, 4];
export const BATCH_SCALE_LABELS = { 0.5: '½×', 1: '1×', 2: '2×', 4: '4×' };

const FRACTIONS = [
  [0, ''], [1 / 8, '⅛'], [1 / 4, '¼'], [1 / 3, '⅓'], [3 / 8, '⅜'], [1 / 2, '½'],
  [5 / 8, '⅝'], [2 / 3, '⅔'], [3 / 4, '¾'], [7 / 8, '⅞'], [1, ''],
];

/** 1.5 -> "1½", 0.25 -> "¼", 2.96 -> "3". Never returns "0" for a positive input. */
function niceNumber(n) {
  let whole = Math.floor(n);
  const frac = n - whole;
  let best = FRACTIONS[0];
  for (const candidate of FRACTIONS) {
    if (Math.abs(candidate[0] - frac) < Math.abs(best[0] - frac)) best = candidate;
  }
  if (best[0] === 1) {
    whole += 1;
    best = FRACTIONS[0];
  }
  if (whole === 0 && best[1] === '') return '⅛';
  return `${whole || ''}${best[1]}`;
}

const TSP_PER = { tsp: 1, tbsp: 3, cup: 48 };

function formatUsVolume(qty, unit) {
  const tsp = qty * TSP_PER[unit];
  if (tsp >= 12) {
    const cups = tsp / 48;
    return `${niceNumber(cups)} ${cups > 1 ? 'cups' : 'cup'}`;
  }
  if (tsp >= 3) {
    const tbsp = tsp / 3;
    return `${niceNumber(tbsp)} ${tbsp > 1 ? 'tablespoons' : 'tablespoon'}`;
  }
  return `${niceNumber(tsp)} ${tsp > 1 ? 'teaspoons' : 'teaspoon'}`;
}

/** Trims a number to at most one decimal place: 2.50 -> "2.5", 3 -> "3". */
function trimNumber(n) {
  return String(Math.round(n * 10) / 10);
}

function roundMetric(n) {
  if (n < 10) return Math.round(n * 2) / 2;
  if (n < 100) return Math.round(n);
  return Math.round(n / 5) * 5;
}

function formatMetric(qty, unit) {
  if (unit === 'g' && qty >= 1000) return `${trimNumber(qty / 1000)} kg`;
  if (unit === 'ml' && qty >= 1000) return `${trimNumber(qty / 1000)} L`;
  return `${trimNumber(roundMetric(qty))} ${unit}`;
}

const COUNT_UNITS = { stick: 'stick', bean: 'bean', piece: 'piece' };

function formatSpec(spec, scale) {
  if (typeof spec === 'string') return spec;
  const qty = spec.qty * scale;

  if (TSP_PER[spec.unit]) return formatUsVolume(qty, spec.unit);
  if (spec.unit === 'g' || spec.unit === 'ml') return formatMetric(qty, spec.unit);
  if (spec.unit === 'oz') return `${niceNumber(qty)} oz`;
  if (COUNT_UNITS[spec.unit]) {
    const count = Math.max(1, Math.round(qty));
    const label = COUNT_UNITS[spec.unit] + (count === 1 ? '' : 's');
    return `${count} ${label}${spec.note ? ` (${spec.note})` : ''}`;
  }
  return `${trimNumber(qty)} ${spec.unit}`;
}

/** The amount for one unit system ('oz' or 'ml') at a batch scale (1 = as written). */
export function formatAmount(amount, unitSystem, scale = 1) {
  if (typeof amount === 'string') return amount;
  if ('qty' in amount) return formatSpec(amount, scale);
  return formatSpec(unitSystem === 'ml' ? amount.metric : amount.us, scale);
}

/** A finished-yield amount, always approximate: "about 14 oz". */
export function formatYield(amount, unitSystem, scale = 1) {
  const text = formatAmount(amount, unitSystem, scale);
  return /^about /i.test(text) ? text : `about ${text}`;
}

/** Sugar grams and water ml for the Brix Blender at a batch scale, or null. */
export function scaledBrixInputs(entry, scale = 1) {
  if (!entry.brix) return null;
  return { sugarG: entry.brix.sugarG * scale, waterMl: entry.brix.waterMl * scale };
}
