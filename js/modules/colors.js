/**
 * Speakeasy Color & Volume Math
 * Translates ingredient names into cocktail liquid colors and normalizes volumetric units.
 */

import { getIngredientMetadata } from './taxonomy.js';
import { UNIT_CONVERSIONS_TO_OZ, normalizeUnit } from './parser.js';

const COLOR_MAP = [
  // Red bitters & amari
  { pattern: /\b(campari|aperol|cappelletti|select aperitivo|red bitter)\b/i, color: '#e63946', light: '#ff5c6a', dark: '#b01925', label: 'Crimson Aperitivo' },
  { pattern: /\b(sweet vermouth|rosso|punt e mes|carpano|amaro nonino|averna|cynar|amaro)\b/i, color: '#6b1822', light: '#8c2430', dark: '#470b13', label: 'Ruby Amaro' },
  { pattern: /\b(angostura|peychaud|bitters?)\b/i, color: '#7a1921', light: '#9b2933', dark: '#520b12', label: 'Spiced Bitters' },
  { pattern: /\b(grenadine|pomegranate|maraschino|cherry)\b/i, color: '#9e1b32', light: '#bf2c47', dark: '#6e0d1f', label: 'Ruby Syrup' },

  // Dark spirits & whiskeys
  { pattern: /\b(bourbon|rye|whiskey|whisky|scotch|cognac|brandy|calvados)\b/i, color: '#c67828', light: '#e5933d', dark: '#914f11', label: 'Amber Whiskey' },
  { pattern: /\b(dark rum|aged rum|blackstrap|gold rum|demerara rum)\b/i, color: '#8d481d', light: '#a85a26', dark: '#5e2d0d', label: 'Aged Rum' },

  // Herbal & specialty liqueurs
  { pattern: /\b(green chartreuse|absinthe|midori|mint|pastis|anisette)\b/i, color: '#68b338', light: '#85d44d', dark: '#488220', label: 'Herbal Botanical' },
  { pattern: /\b(yellow chartreuse|strega|benedictine|galliano|suze)\b/i, color: '#d4b426', light: '#edd03b', dark: '#9c8112', label: 'Golden Liqueur' },
  { pattern: /\b(blue cura[cç]ao|cura[cç]ao blue)\b/i, color: '#0096c7', light: '#48cae4', dark: '#023e8a', label: 'Blue Curaçao' },
  { pattern: /\b(kahl[uú]a|coffee|espresso|tia maria|cacao|chocolate)\b/i, color: '#3c2317', light: '#573423', dark: '#24130b', label: 'Espresso Liqueur' },

  // Citrus & juices
  { pattern: /\b(lime juice|fresh lime|lime)\b/i, color: '#b9db70', light: '#d0ed8e', dark: '#8cae46', label: 'Fresh Lime' },
  { pattern: /\b(lemon juice|fresh lemon|lemon)\b/i, color: '#f3da58', light: '#f9e87d', dark: '#c7ae29', label: 'Fresh Lemon' },
  { pattern: /\b(grapefruit|pink grapefruit)\b/i, color: '#f4978e', light: '#f8b4ad', dark: '#c96a60', label: 'Grapefruit' },
  { pattern: /\b(orange juice|fresh orange|pineapple|passion fruit)\b/i, color: '#f77f00', light: '#fc9e38', dark: '#c45a00', label: 'Citrus Juice' },

  // Syrups, sweeteners & pantry dairy
  { pattern: /\b(butter)\b/i, color: '#f6e49d', light: '#fdf5cb', dark: '#d6be63', label: 'Butter' },
  { pattern: /\b(orgeat|cream|coconut cream|milk|egg white|aquafaba)\b/i, color: '#f4ede2', light: '#ffffff', dark: '#dcd3c5', label: 'Velvet Cream' },
  { pattern: /\b(demerara|honey|maple|molasses|rich simple|brown sugar)\b/i, color: '#a66a38', light: '#bf834e', dark: '#73441e', label: 'Demerara Gold' },
  { pattern: /\b(simple syrup|sugar syrup|agave|cane syrup|gomme)\b/i, color: '#f1e8be', light: '#faf5d8', dark: '#cfc48f', label: 'Cane Syrup' },
  { pattern: /\b(cointreau|triple sec|orange cura[cç]ao|grand marnier)\b/i, color: '#ecc170', light: '#f5d693', dark: '#bd9446', label: 'Orange Liqueur' },
  { pattern: /\b(cinnamon)\b/i, color: '#9c522b', light: '#ba6a3e', dark: '#6e3416', label: 'Cinnamon' },

  // Clear spirits & effervescence
  { pattern: /\b(gin|vodka|blanco tequila|silver tequila|white rum|light rum|mezcal|pisco|dry vermouth|aquavit)\b/i, color: '#d2e2ec', light: '#e7f0f6', dark: '#a5c0d1', label: 'Clear Spirit' },
  { pattern: /\b(boiling water|hot water|chilled water|tap water|cold water|warm water|water)\b/i, color: '#f8fafc', light: '#ffffff', dark: '#e2e8f0', label: 'Water' },
  { pattern: /\b(tonic|club soda|sparkling|seltzer|ginger beer|ginger ale|champagne|prosecco|cava)\b/i, color: '#d9eef9', light: '#edf7fc', dark: '#afd5ea', label: 'Sparkling Mixer' },
];

export function getIngredientColor(name = '') {
  const trimmed = name.trim();
  if (!trimmed) {
    return { color: '#d2e2ec', light: '#e7f0f6', dark: '#a5c0d1', label: 'Unknown' };
  }

  // 1. Check hierarchical taxonomy
  const meta = getIngredientMetadata(trimmed);
  if (meta && meta.color) {
    return {
      color: meta.color,
      light: meta.light,
      dark: meta.dark,
      label: meta.label || meta.name,
    };
  }

  // 2. Legacy pattern match fallback
  for (const entry of COLOR_MAP) {
    if (entry.pattern.test(trimmed)) {
      return entry;
    }
  }

  // Hash-based deterministic color fallback for unknown ingredients
  let hash = 0;
  for (let i = 0; i < trimmed.length; i++) {
    hash = (hash << 5) - hash + trimmed.charCodeAt(i);
    hash |= 0;
  }
  const hue = Math.abs(hash) % 360;
  return {
    color: `hsl(${hue}, 60%, 55%)`,
    light: `hsl(${hue}, 65%, 68%)`,
    dark: `hsl(${hue}, 60%, 38%)`,
    label: 'Custom Ingredient',
  };
}

export function normalizeVolumeToOz(amount, unit = 'oz') {
  if (amount === null || amount === undefined || isNaN(amount) || amount <= 0) {
    return 0.05; // Visual trace amount (e.g., rinse)
  }

  const cleanUnit = normalizeUnit(unit);
  const factor = UNIT_CONVERSIONS_TO_OZ[cleanUnit] ?? 1.0;
  return amount * factor;
}

/**
 * Calculates proportional layers for a cocktail's specs.
 * Returns an array of layer objects ready for SVG rendering.
 */
export function calculateFluidLayers(specs = []) {
  if (!specs || specs.length === 0) {
    return [];
  }

  const validSpecs = specs.filter(s => s && s.name);
  if (validSpecs.length === 0) {
    return [];
  }

  const layersWithVol = validSpecs.map((spec, index) => {
    const volOz = normalizeVolumeToOz(spec.amount, spec.unit);
    const colorInfo = getIngredientColor(spec.name);
    return {
      index,
      spec,
      volOz,
      color: colorInfo.color,
      light: colorInfo.light,
      dark: colorInfo.dark,
      label: colorInfo.label,
    };
  });

  const totalVol = layersWithVol.reduce((sum, layer) => sum + layer.volOz, 0);

  // Compute proportional percentage and cumulative offsets
  let cumulativeRatio = 0;
  return layersWithVol.map(layer => {
    const ratio = totalVol > 0 ? layer.volOz / totalVol : 1 / layersWithVol.length;
    const startRatio = cumulativeRatio;
    cumulativeRatio += ratio;
    return {
      ...layer,
      ratio,
      startRatio,
      endRatio: cumulativeRatio,
      totalVolOz: totalVol,
    };
  });
}

/**
 * Helper to parse hex string (#rgb or #rrggbb) or hsl to {r, g, b}
 */
export function hexToRgb(hex) {
  if (!hex) return { r: 210, g: 226, b: 236 };
  let clean = hex.trim();
  if (clean.startsWith('hsl')) {
    const m = clean.match(/hsl\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%\s*\)/i);
    if (m) {
      const h = parseFloat(m[1]) / 360;
      const s = parseFloat(m[2]) / 100;
      const l = parseFloat(m[3]) / 100;
      return hslToRgb(h, s, l);
    }
    return { r: 210, g: 226, b: 236 };
  }

  clean = clean.replace('#', '');
  if (clean.length === 3) {
    clean = clean.split('').map(c => c + c).join('');
  }
  const num = parseInt(clean, 16);
  if (isNaN(num)) return { r: 210, g: 226, b: 236 };
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

export function rgbToHex(r, g, b) {
  const clamp = (val) => Math.max(0, Math.min(255, Math.round(val)));
  return '#' + [r, g, b].map(v => clamp(v).toString(16).padStart(2, '0')).join('');
}

function hslToRgb(h, s, l) {
  let r, g, b;
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
}

function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;

  if (max === min) {
    h = s = 0; // achromatic
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return { h, s, l };
}

/**
 * Derives coordinated highlight and shadow tones from a base hex color
 */
export function deriveShades(baseHex) {
  const rgb = hexToRgb(baseHex);
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);

  // Light highlight: higher lightness, slightly boosted saturation
  const lightL = Math.min(0.92, hsl.l + 0.16);
  const lightS = Math.min(1, hsl.s * 1.05);
  const lightRgb = hslToRgb(hsl.h, lightS, lightL);

  // Dark shadow: lower lightness, deeper depth
  const darkL = Math.max(0.12, hsl.l - 0.22);
  const darkS = Math.min(1, hsl.s * 1.12);
  const darkRgb = hslToRgb(hsl.h, darkS, darkL);

  return {
    color: baseHex,
    light: rgbToHex(lightRgb.r, lightRgb.g, lightRgb.b),
    dark: rgbToHex(darkRgb.r, darkRgb.g, darkRgb.b),
  };
}

/**
 * Calculates a unified blended color from liquid specs by volume weighting.
 * Takes into account dominant tinting (e.g. blue curacao or campari strongly tinting pale liquids)
 * and opacity/dairy body.
 */
export function calculateBlendedColor(specs = [], recipeContext = null) {
  const layers = calculateFluidLayers(specs);
  if (layers.length === 0) {
    return {
      color: '#d2e2ec',
      light: '#e7f0f6',
      dark: '#a5c0d1',
      label: 'Clear',
      dominantName: 'Clear Spirit',
    };
  }

  if (layers.length === 1) {
    return {
      color: layers[0].color,
      light: layers[0].light,
      dark: layers[0].dark,
      label: layers[0].label,
      dominantName: layers[0].spec?.name || layers[0].label,
    };
  }

  // Special-case: Aperol Spritz signature radiant bittersweet orange
  const recipeName = typeof recipeContext === 'string'
    ? recipeContext
    : (recipeContext?.name || '');
  const isAperolSpritzByName = /aperol\s+spritz/i.test(recipeName);
  const hasAperol = layers.some(l => /\baperol\b/i.test(l.spec?.name || ''));
  const hasBubbles = layers.some(l => /\b(sparkling wine|prosecco|champagne|cava)\b/i.test(l.spec?.name || ''));
  const isAperolSpritzBySpecs = hasAperol && hasBubbles && layers.length <= 4;

  if (isAperolSpritzByName || isAperolSpritzBySpecs) {
    const aperolSpritzShades = deriveShades('#f4621b');
    return {
      color: aperolSpritzShades.color,
      light: aperolSpritzShades.light,
      dark: aperolSpritzShades.dark,
      label: 'Aperol Spritz',
      dominantName: 'Aperol',
    };
  }

  // Weight ingredients by volumetric ratio and tinting dye potency
  // Highly concentrated colored liqueurs (e.g. blue curaçao, campari, grenadine, chartreuse)
  // possess extraordinary tinting strength (staining even large volumes of light citrus or spirit)
  let weightedR = 0;
  let weightedG = 0;
  let weightedB = 0;
  let totalWeight = 0;

  for (const layer of layers) {
    const rgb = hexToRgb(layer.color);
    const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
    const nameLower = (layer.spec?.name || '').toLowerCase();
    
    // Potency weight: High-chroma saturated ingredients tint drinks significantly
    let potency = 1 + (hsl.s * 1.5);
    if (/blue cura[cç]ao|cura[cç]ao blue/i.test(nameLower)) {
      // Blue Curaçao uses brilliant blue dye (E133 / FD&C Blue No. 1) which aggressively turns drinks vivid cyan/aqua
      potency *= 5.5;
    } else if (/campari|grenadine|midori|cassis|cynar/i.test(nameLower)) {
      potency *= 3.0;
    } else if (/chartreuse|galliano|strega|cura[cç]ao/i.test(nameLower)) {
      potency *= 2.0;
    } else if (hsl.s < 0.15) {
      // Neutral clear spirits (vodka, gin, light rum, seltzer) dilute without altering tint
      potency *= 0.4;
    }

    const weight = layer.volOz * potency;

    weightedR += rgb.r * weight;
    weightedG += rgb.g * weight;
    weightedB += rgb.b * weight;
    totalWeight += weight;
  }

  const avgR = totalWeight > 0 ? weightedR / totalWeight : 210;
  const avgG = totalWeight > 0 ? weightedG / totalWeight : 226;
  const avgB = totalWeight > 0 ? weightedB / totalWeight : 236;

  const baseHex = rgbToHex(avgR, avgG, avgB);
  const shades = deriveShades(baseHex);

  return {
    color: shades.color,
    light: shades.light,
    dark: shades.dark,
    label: 'Blended Cocktail',
    dominantName: layers.reduce((max, cur) => (cur.volOz > max.volOz ? cur : max), layers[0])?.spec?.name || 'Blended',
  };
}
