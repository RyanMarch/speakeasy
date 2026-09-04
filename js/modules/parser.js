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
