/**
 * Speakeasy Cocktail Parser
 * Parses ingredient lines with amounts, fractional values, units, and ingredient names.
 */

const VULGAR_FRACTIONS = {
  '½': ' 1/2',
  '¼': ' 1/4',
  '¾': ' 3/4',
  '⅓': ' 1/3',
  '⅔': ' 2/3',
  '⅛': ' 1/8',
  '⅜': ' 3/8',
  '⅝': ' 5/8',
  '⅞': ' 7/8',
};

export function normalizeFractions(str) {
  if (!str) return '';
  return str
    .replace(/[½¼¾⅓⅔⅛⅜⅝⅞]/g, (char) => ` ${VULGAR_FRACTIONS[char] || char} `)
    .replace(/\s+/g, ' ');
}

// Spelled-out/pluralized/two-word unit variants the regex below recognizes but
// that don't match the app's canonical unit vocabulary (the editor's unit
// dropdown, and UNIT_CONVERSIONS_TO_OZ) verbatim — collapsed to the form those
// expect. Left out on purpose: "dash"/"dashes" and "drops" alone, which are
// already valid, distinct dropdown options and don't need collapsing to one
// spelling.
const UNIT_ALIASES = {
  ounce: 'oz',
  ounces: 'oz',
  'fl oz': 'oz',
  'fl. oz': 'oz',
  'fl.oz': 'oz',
  'fluid ounce': 'oz',
  'fluid ounces': 'oz',
  milliliter: 'ml',
  milliliters: 'ml',
  millilitre: 'ml',
  millilitres: 'ml',
  cc: 'ml',
  'bar spoon': 'barspoon',
  'bar spoons': 'barspoon',
  barspoons: 'barspoon',
  teaspoon: 'tsp',
  teaspoons: 'tsp',
  tsps: 'tsp',
  tablespoon: 'tbsp',
  tablespoons: 'tbsp',
  drop: 'drops',
  splashes: 'splash',
  parts: 'part',
  leaf: 'leaves',
  pinches: 'pinch',
  cups: 'cup',
  shots: 'shot',
};

export function parseIngredientLine(line) {
  if (!line) {
    return null;
  }
  const trimmed = normalizeFractions(line).trim();
  if (!trimmed) {
    return null;
  }

  // Matches "0.75 oz Bourbon", "1 1/2 oz Gin", "2 dashes Angostura", "Rinse Absinthe" —
  // also spelled-out/pluralized/two-word words ("2 ounces Scotch", "1 fl oz Gin",
  // "1 bar spoon Demerara", "1 teaspoon syrup"), normalized to their canonical
  // short form below via UNIT_ALIASES. "bar\s?spoon" (space optional) covers both
  // "barspoon" and "bar spoon" with one pattern rather than four separate ones.
  const regex = /^([\d\s\/\.]+)?\s*(dashes|dash|bar\s?spoons?|tbsp|tablespoons?|tsps?|tsp|teaspoons?|drops?|drop|fl\.?\s?oz\.?|fluid\s?ounces?|ounces?|oz|milliliters?|millilitres?|ml|cc|cl|splashes?|parts?|part|leaves|leaf|pinche?s?|cups?|shots?|rinse)?\s*(.+)$/i;
  const match = trimmed.match(regex);

  if (!match) {
    return { raw: trimmed, amount: null, unit: 'oz', name: trimmed };
  }

  let amount = null;
  if (match[1]) {
    const rawAmt = match[1].trim();
    if (rawAmt.includes('/')) {
      const parts = rawAmt.split(/\s+/).filter(Boolean);
      if (parts.length === 2) {
        const [num, den] = parts[1].split('/');
        amount = parseFloat(parts[0]) + parseFloat(num) / parseFloat(den);
      } else if (parts.length === 1) {
        const [num, den] = parts[0].split('/');
        amount = parseFloat(num) / parseFloat(den);
      }
    } else {
      amount = parseFloat(rawAmt);
    }
  }

  const rawUnit = (match[2] || '').toLowerCase();
  const parsedUnit = UNIT_ALIASES[rawUnit] || rawUnit;
  const name = match[3]?.trim() || '';

  return {
    raw: trimmed,
    amount: (amount !== null && !isNaN(amount)) ? amount : null,
    unit: parsedUnit || (amount !== null ? 'oz' : ''),
    name,
  };
}

// Bare section-header words that sometimes come along for the ride when
// pasting a recipe straight from a book/blog/PDF — e.g. an "Ingredients"
// label above the list, with no amount or unit of its own to distinguish it
// from a real line. Matched as a whole line (after trimming trailing
// punctuation like a colon), not a substring, so it can't eat a real
// ingredient that merely contains one of these words.
const SECTION_HEADER_LINES = new Set([
  'ingredients', 'ingredient', 'instructions', 'instruction',
  'directions', 'direction', 'method', 'recipe', 'specs', 'specifications',
  'you will need', "you'll need", 'preparation',
]);

/**
 * True for a pasted line that isn't really an ingredient at all — a bare
 * section header ("Ingredients") or a garnish line ("Garnish: lime wheel").
 * Garnish lines are deliberately excluded from specs here rather than kept
 * as a junk row; callers that want that content (see editor-modal.js's Quick
 * Paste handler) should pull it out of the raw text before/independently of
 * calling parseSpecsBlock.
 */
function isNonIngredientLine(line) {
  const bare = line.replace(/:\s*$/, '').trim().toLowerCase();
  if (SECTION_HEADER_LINES.has(bare)) return true;
  if (/^garnish(ed with)?:?\s*/i.test(line)) return true;
  return false;
}

/**
 * Pulls the content of a pasted "Garnish: lime wheel" line back out, so a
 * Quick Paste can route it into the Garnish field instead of just dropping it
 * (parseSpecsBlock excludes these lines from the ingredient specs entirely —
 * see isNonIngredientLine). Returns the trimmed garnish text, or null if no
 * such line is present.
 */
export function extractGarnishLine(text) {
  if (!text || typeof text !== 'string') return null;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    const match = line.match(/^garnish(?:ed with)?:?\s*(.+)$/i);
    if (match && match[1].trim()) {
      return match[1].trim();
    }
  }
  return null;
}

export function parseSpecsBlock(text) {
  if (!text || typeof text !== 'string') {
    return [];
  }

  return text
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.length > 0 && !line.startsWith('#') && !line.startsWith('//') && !isNonIngredientLine(line))
    .map(parseIngredientLine)
    .filter(item => item !== null && item.name.length > 0);
}

export function formatFraction(amount) {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return '';
  }

  const rounded = Math.round(amount * 100) / 100;
  const tolerance = 0.02;

  const whole = Math.floor(rounded);
  const frac = rounded - whole;

  const fractions = [
    { value: 0.125, label: '1/8' },
    { value: 0.25, label: '1/4' },
    { value: 0.333, label: '1/3' },
    { value: 0.5, label: '1/2' },
    { value: 0.666, label: '2/3' },
    { value: 0.75, label: '3/4' },
    { value: 0.875, label: '7/8' },
  ];

  for (const f of fractions) {
    if (Math.abs(frac - f.value) < tolerance) {
      return whole > 0 ? `${whole} ${f.label}` : f.label;
    }
  }

  return `${rounded}`;
}

/**
 * Parses method/instructions text and detects whether it is:
 * - 'ordered': numbered steps (1., 1), Step 1:, etc.)
 * - 'unordered': bulleted items (-, *, •)
 * - 'prose': plain descriptive paragraph(s)
 *
 * @param {string} text
 * @returns {{ type: 'ordered' | 'unordered' | 'prose', items: string[] }}
 */
export function parseMethodContent(text) {
  if (!text || typeof text !== 'string') {
    return { type: 'prose', items: [] };
  }

  const trimmed = text.trim();
  if (!trimmed) {
    return { type: 'prose', items: [] };
  }

  // Split into non-empty lines
  const lines = trimmed
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.length > 0);

  if (lines.length === 0) {
    return { type: 'prose', items: [] };
  }

  // Regex patterns for line prefixes
  const orderedRegex = /^(?:(?:step\s+)?\d+[\.\)\:]\s*|\(\d+\)\s*)/i;
  const unorderedRegex = /^[\*\-\•\–\—\>]\s+/;

  // Check if lines match ordered or unordered patterns
  const orderedMatches = lines.filter(line => orderedRegex.test(line));
  const unorderedMatches = lines.filter(line => unorderedRegex.test(line));

  // If there's multiple lines and all (or almost all) are ordered, or even a single line with "1. ..."
  if (orderedMatches.length > 0 && (orderedMatches.length === lines.length || (lines.length > 1 && orderedMatches.length >= lines.length * 0.8))) {
    const items = lines.map(line => line.replace(orderedRegex, '').trim()).filter(Boolean);
    return { type: 'ordered', items };
  }

  // If unordered bulleted list
  if (unorderedMatches.length > 0 && (unorderedMatches.length === lines.length || (lines.length > 1 && unorderedMatches.length >= lines.length * 0.8))) {
    const items = lines.map(line => line.replace(unorderedRegex, '').trim()).filter(Boolean);
    return { type: 'unordered', items };
  }

  // If text is a single block, check if multiple numbered items were written inline (e.g. "1. First... 2. Second... 3. Third...")
  const inlineOrderedMatch = trimmed.match(/(?:^|\s)(?:(?:step\s+)?\d+[\.\)]\s+)/i);
  if (inlineOrderedMatch) {
    const inlineSplit = trimmed.split(/(?:^|\s+)(?:(?:step\s+)?\d+[\.\)]\s+)/i).map(s => s.trim()).filter(Boolean);
    if (inlineSplit.length > 1) {
      return { type: 'ordered', items: inlineSplit };
    }
  }

  // Otherwise, return as prose
  return { type: 'prose', items: [trimmed] };
}

/**
 * Scans instruction text for durations specified in seconds.
 * Matches formats like "30 seconds", "25-30 seconds", "10-12 secs", "15 sec", "1 second".
 * For ranges, the upper number is taken as the target timer duration.
 *
 * @param {string} instructionText
 * @returns {Array<{text: string, label: string, seconds: number, index: number, length: number}>}
 */
export function detectTimers(instructionText) {
  if (!instructionText || typeof instructionText !== 'string') {
    return [];
  }

  const regex = /\b(?:(\d+)\s*[-–—]\s*)?(\d+)\s*(?:seconds?|secs?)\b/gi;
  const matches = [];
  let match;

  while ((match = regex.exec(instructionText)) !== null) {
    const rawMatch = match[0];
    const seconds = parseInt(match[2], 10);
    if (!isNaN(seconds) && seconds > 0) {
      matches.push({
        text: rawMatch,
        label: rawMatch,
        seconds,
        index: match.index,
        length: rawMatch.length,
      });
    }
  }

  return matches;
}

/**
 * Replaces duration text in an instruction string with interactive timer buttons.
 *
 * @param {string} text
 * @param {(str: string) => string} [escapeFn]
 * @returns {string}
 */
export function renderInstructionTimers(text, escapeFn = (s) => s) {
  if (!text || typeof text !== 'string') return '';
  const timers = detectTimers(text);
  if (timers.length === 0) {
    return escapeFn(text);
  }

  let html = '';
  let lastIndex = 0;

  for (const timer of timers) {
    if (timer.index > lastIndex) {
      html += escapeFn(text.substring(lastIndex, timer.index));
    }
    html += `<button type="button" class="timer-token" data-seconds="${timer.seconds}" aria-label="Start ${timer.seconds} second timer">${escapeFn(timer.text)}</button>`;
    lastIndex = timer.index + timer.length;
  }

  if (lastIndex < text.length) {
    html += escapeFn(text.substring(lastIndex));
  }

  return html;
}

