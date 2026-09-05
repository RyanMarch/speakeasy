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

export function parseIngredientLine(line) {
  if (!line) {
    return null;
  }
  const trimmed = normalizeFractions(line).trim();
  if (!trimmed) {
    return null;
  }

  // Matches "0.75 oz Bourbon", "1 1/2 oz Gin", "2 dashes Angostura", "Rinse Absinthe"
  const regex = /^([\d\s\/\.]+)?\s*(dashes|dash|barspoons?|barspoon|tbsp|tsps?|tsp|drops?|drop|oz|ml|cl|splash|parts?|part|rinse)?\s*(.+)$/i;
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

  const parsedUnit = (match[2] || '').toLowerCase();
  const name = match[3]?.trim() || '';

  return {
    raw: trimmed,
    amount: (amount !== null && !isNaN(amount)) ? amount : null,
    unit: parsedUnit || (amount !== null ? 'oz' : ''),
    name,
  };
}

export function parseSpecsBlock(text) {
  if (!text || typeof text !== 'string') {
    return [];
  }

  return text
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.length > 0 && !line.startsWith('#') && !line.startsWith('//'))
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
