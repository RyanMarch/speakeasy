/**
 * Speakeasy Flavor Balance Engine
 * Computes a recipe's aggregate sweet/sour/bitter/boozy/herbal profile from its
 * parsed specs, and renders it as a lightweight SVG radar — no chart library,
 * just five points of trigonometry, consistent with the rest of the app's
 * hand-rolled SVG renderers (glass-view.js, garnishes.js).
 */

import { normalizeVolumeToOz } from './colors.js';
import { getFlavorProfile } from './taxonomy.js';
import { estimateIngredientAbv } from './abv.js';

export const FLAVOR_AXES = [
  { key: 'sweet', label: 'Sweet' },
  { key: 'sour', label: 'Sour' },
  { key: 'bitter', label: 'Bitter' },
  { key: 'boozy', label: 'Boozy' },
  { key: 'herbal', label: 'Herbal' },
];

// Each axis's raw score is a volume-weighted average of 0.0-1.0 per-ingredient
// intensities (see taxonomy.js), diluted by however much of the drink's volume
// comes from ingredients that don't contribute to that axis at all. In practice
// that means raw scores almost never get anywhere near 100 even for a drink that
// legitimately reads as, say, very bitter — a Negroni's raw bitter score is only
// ~38, because two of its three equal parts don't carry any bitterness. Checked
// against all 182 seed recipes, raw scores top out around sweet:41 sour:65
// bitter:77 boozy:45 herbal:50, with 90th-percentile drinks sitting at roughly
// half that. A flat 0-100 display would leave EVERY recipe's radar reading as a
// small blob near the center, indistinguishable from any other — accurate
// per-axis math, but useless as a *comparison* between drinks, which is the
// entire point of a radar chart.
//
// REFERENCE_MAX rescales each axis so that its realistic high end (roughly the
// 90th-percentile recipe for that axis, with some headroom) reads as strongly
// dominant on the chart, and only the genuine standout extremes (a Fernet-heavy
// Ferrari's bitter/herbal, a straight-orange-juice Garibaldi's sour) clip to 100.
// These are calibrated against the seed recipe corpus, not derived per-request,
// so adding new recipes won't shift how existing ones render.
const REFERENCE_MAX = { sweet: 35, sour: 28, bitter: 32, boozy: 40, herbal: 30 };

/**
 * Calculates a recipe's flavor balance profile from its specs, scaled 0-100.
 * sweet/sour/bitter/herbal come from each ingredient's taxonomy flavor profile,
 * volume-weighted; boozy is volume-weighted estimated ABV. All four are then
 * rescaled against REFERENCE_MAX (see above) so the visual range is actually used.
 *
 * @param {Array<{amount: number, unit: string, name: string}>} specs
 * @returns {{sweet: number, sour: number, bitter: number, boozy: number, herbal: number}}
 */
export function calculateBalanceProfile(specs = []) {
  const totals = { sweet: 0, sour: 0, bitter: 0, boozy: 0, herbal: 0 };
  let totalOz = 0;

  for (const spec of specs || []) {
    if (!spec || !spec.name || !spec.name.trim()) continue;

    const oz = normalizeVolumeToOz(spec.amount, spec.unit);
    const flavor = getFlavorProfile(spec.name);
    const abv = estimateIngredientAbv(spec.name);

    totals.sweet += flavor.sweet * oz;
    totals.sour += flavor.sour * oz;
    totals.bitter += flavor.bitter * oz;
    totals.herbal += flavor.herbal * oz;
    totals.boozy += (abv / 100) * oz;
    totalOz += oz;
  }

  if (totalOz <= 0) {
    return { sweet: 0, sour: 0, bitter: 0, boozy: 0, herbal: 0 };
  }

  const profile = {};
  for (const axis of FLAVOR_AXES) {
    const rawFraction = totals[axis.key] / totalOz; // 0.0-1.0, pre-rescale
    const rawScore = rawFraction * 100;
    const displayScore = (rawScore / REFERENCE_MAX[axis.key]) * 100;
    profile[axis.key] = Math.round(Math.max(0, Math.min(100, displayScore)));
  }
  return profile;
}

/**
 * Returns the dominant (highest-scoring) axes of a profile, e.g. for a subtitle
 * like "Bitter · Sweet · Boozy". Ties are broken by axis order.
 */
export function getDominantAxes(profile, count = 3) {
  return [...FLAVOR_AXES]
    .sort((a, b) => (profile?.[b.key] || 0) - (profile?.[a.key] || 0))
    .slice(0, count)
    .filter(axis => (profile?.[axis.key] || 0) > 0)
    .map(axis => axis.label);
}

function escapeXml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function axisPoint(index, fraction, center, radius) {
  const angle = -Math.PI / 2 + index * ((2 * Math.PI) / FLAVOR_AXES.length);
  return {
    x: center + radius * fraction * Math.cos(angle),
    y: center + radius * fraction * Math.sin(angle),
  };
}

/**
 * Renders a self-contained, responsive SVG radar for a flavor profile.
 * @param {{sweet: number, sour: number, bitter: number, boozy: number, herbal: number}} profile
 */
export function renderFlavorRadarSvg(profile = {}) {
  const size = 200;
  const center = size / 2;
  const radius = 68;

  const gridRings = [0.25, 0.5, 0.75, 1]
    .map(frac => {
      const pts = FLAVOR_AXES.map((_, i) => {
        const p = axisPoint(i, frac, center, radius);
        return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
      }).join(' ');
      return `<polygon points="${pts}" class="flavor-radar-ring" />`;
    })
    .join('');

  const axisLines = FLAVOR_AXES.map((_, i) => {
    const p = axisPoint(i, 1, center, radius);
    return `<line x1="${center}" y1="${center}" x2="${p.x.toFixed(1)}" y2="${p.y.toFixed(1)}" class="flavor-radar-axis-line" />`;
  }).join('');

  const dataPoints = FLAVOR_AXES.map((axis, i) => {
    const value = Math.max(0, Math.min(100, profile?.[axis.key] || 0)) / 100;
    const p = axisPoint(i, value, center, radius);
    return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
  }).join(' ');

  const dataDots = FLAVOR_AXES.map((axis, i) => {
    const value = Math.max(0, Math.min(100, profile?.[axis.key] || 0)) / 100;
    const p = axisPoint(i, value, center, radius);
    return `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="2.5" class="flavor-radar-dot" />`;
  }).join('');

  const labels = FLAVOR_AXES.map((axis, i) => {
    const p = axisPoint(i, 1.3, center, radius);
    let anchor = 'middle';
    if (p.x < center - 8) anchor = 'end';
    else if (p.x > center + 8) anchor = 'start';
    const value = Math.max(0, Math.min(100, Math.round(profile?.[axis.key] || 0)));
    return /*html*/`
      <text x="${p.x.toFixed(1)}" y="${p.y.toFixed(1)}" text-anchor="${anchor}" class="flavor-radar-label">${escapeXml(axis.label)}</text>
      <text x="${p.x.toFixed(1)}" y="${(p.y + 13).toFixed(1)}" text-anchor="${anchor}" class="flavor-radar-value">${value}</text>
    `;
  }).join('');

  const ariaLabel = FLAVOR_AXES.map(a => `${a.label} ${Math.round(profile?.[a.key] || 0)} of 100`).join(', ');

  return /*html*/`
    <svg class="flavor-radar-svg" viewBox="0 0 ${size} ${size}" role="img" aria-label="Flavor balance: ${escapeXml(ariaLabel)}">
      <g class="flavor-radar-grid">${gridRings}</g>
      <g class="flavor-radar-axes">${axisLines}</g>
      <polygon points="${dataPoints}" class="flavor-radar-shape" />
      <g class="flavor-radar-dots">${dataDots}</g>
      <g class="flavor-radar-labels">${labels}</g>
    </svg>
  `;
}
