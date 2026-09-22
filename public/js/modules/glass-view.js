/**
 * Speakeasy Interactive Vector Fluid Glass Renderer
 * Generates an SVG glass with proportional fluid layers, clipped to glassware geometry.
 */

import { resolveGlassware, isHotBeverage } from './glassware.js';
import { calculateFluidLayers, calculateBlendedColor } from './colors.js';
import { renderGarnishesSvg, getGarnishHeadroom, renderSteamVapor } from './garnishes.js';

let nextGlassId = 1;

function escapeXml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * The SVG viewBox for a given recipe's glass, cropped to just this glass's
 * own geometry *and* this recipe's own garnish — a coupe pouring a cherry
 * garnish doesn't need the headroom a mint sprig would, so reserving it
 * unconditionally just left dead space above the drink. Shared by
 * renderGlassSvg (the drawing) and GlassView (the container's aspect-ratio)
 * so both always agree.
 */
function computeGlassViewBox(recipe, glassware) {
  const garnishHeadroom = getGarnishHeadroom(recipe);
  const isHot = isHotBeverage(recipe, glassware);
  // Steam tendrils waft high above the rim (up to ~95 units), so reserve headroom when hot
  const steamHeadroom = isHot ? 88 : 0;
  const headroom = Math.max(garnishHeadroom, steamHeadroom);
  const top = Math.max(0, glassware.rim.y - headroom);
  const bottom = glassware.canvasBottom;
  return { top, height: bottom - top };
}

/**
 * Generate pure SVG markup for a cocktail recipe
 * @param {Object} recipe
 * @param {string} id
 * @param {Object} options - { mode: 'layered' | 'blended' }
 */
export function renderGlassSvg(recipe, id = '', options = {}) {
  const mode = options.mode || 'layered';
  const glassId = id || `glass-${nextGlassId++}`;
  const glassware = resolveGlassware(recipe?.glassware);
  const layers = calculateFluidLayers(recipe?.specs || []);
  const blendedInfo = calculateBlendedColor(recipe?.specs || [], recipe);

  const clipId = `${glassId}-clip`;
  const gradPrefix = `${glassId}-grad`;
  const blendGradId = `${glassId}-blend-grad`;

  // Maximum liquid level fills ~84% of the glassware bowl
  const bounds = glassware.fluidBounds;
  const fillPercent = layers.length > 0 ? 0.84 : 0;
  const fluidTotalHeight = bounds.height * fillPercent;
  const fluidBottomY = bounds.bottomY;

  // Build gradient definitions for each layer
  const gradientDefs = layers.map((layer, i) => `
    <linearGradient id="${gradPrefix}-${i}" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="${layer.dark}" stop-opacity="0.92" />
      <stop offset="35%" stop-color="${layer.color}" stop-opacity="0.95" />
      <stop offset="70%" stop-color="${layer.light}" stop-opacity="0.98" />
      <stop offset="100%" stop-color="${layer.dark}" stop-opacity="0.94" />
    </linearGradient>
  `).join('');

  // Blended composite gradient (matching glassware lighting)
  const blendedGradDef = `
    <linearGradient id="${blendGradId}" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="${blendedInfo.dark}" stop-opacity="0.94" />
      <stop offset="28%" stop-color="${blendedInfo.color}" stop-opacity="0.96" />
      <stop offset="68%" stop-color="${blendedInfo.light}" stop-opacity="0.98" />
      <stop offset="100%" stop-color="${blendedInfo.dark}" stop-opacity="0.94" />
    </linearGradient>
    <linearGradient id="${blendGradId}-depth" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.18" />
      <stop offset="25%" stop-color="#ffffff" stop-opacity="0.0" />
      <stop offset="85%" stop-color="#000000" stop-opacity="0.0" />
      <stop offset="100%" stop-color="#000000" stop-opacity="0.28" />
    </linearGradient>
  `;

  // Determine perspective curve sag for liquid surface interfaces.
  // Glasses viewed from eye level have a gentle downward dip matching the front lip of the glassware rim.
  const rimSag = glassware.rimSag || 3.5;

  // Helper to build a curved liquid slice matching the perspective curvature:
  // Starts at left (x=-10), arcs across center (cx=120, y=topY + rimSag) to right (x=250),
  // goes down to bottomY, arcs across bottom with same sag, and closes back on left.
  function buildCurvedLayerPath(topY, bottomY) {
    const t = parseFloat(topY.toFixed(2));
    const b = parseFloat(bottomY.toFixed(2));
    return `
      M -10 ${t}
      Q 120 ${t + rimSag}, 250 ${t}
      L 250 ${b}
      Q 120 ${b + rimSag}, -10 ${b}
      Z
    `;
  }

  // Build liquid layers
  // Stacking starts from bottom of the glass upwards
  const fluidLayersHtml = layers.map((layer, i) => {
    const layerBottomY = fluidBottomY - (fluidTotalHeight * layer.startRatio);
    const layerTopY = fluidBottomY - (fluidTotalHeight * layer.endRatio);
    // Overlap by 0.6 prevents subpixel gaps between adjacent layers
    const pathD = buildCurvedLayerPath(layerTopY, layerBottomY + 0.6);

    return `
      <path
        class="fluid-layer"
        data-index="${i}"
        data-name="${escapeXml(layer.spec.name)}"
        data-amount="${layer.spec.amount ?? ''}"
        data-unit="${layer.spec.unit ?? ''}"
        d="${pathD}"
        fill="url(#${gradPrefix}-${i})"
      >
        <title>${escapeXml(layer.spec.name)} (${(layer.ratio * 100).toFixed(0)}%)</title>
      </path>
    `;
  }).join('');

  // Blended single body with matching perspective curve
  const blendTopY = fluidBottomY - fluidTotalHeight;
  const blendedPathD = buildCurvedLayerPath(blendTopY, fluidBottomY + 1);

  const blendedLiquidHtml = layers.length > 0 ? `
    <g class="blended-fluid-body">
      <path
        class="blended-fill-base"
        d="${blendedPathD}"
        fill="url(#${blendGradId})"
      >
        <title>${escapeXml(recipe?.name || 'Blended Cocktail')} (Mixed)</title>
      </path>
      <path
        class="blended-fill-shading"
        d="${blendedPathD}"
        fill="url(#${blendGradId}-depth)"
        pointer-events="none"
      />
    </g>
  ` : '';

  // Top surface liquid meniscus line
  const surfaceY = (fluidBottomY - fluidTotalHeight).toFixed(2);
  const surfaceMeniscus = '';

  // Detect effervescence / sparkling ingredients (club soda, tonic, prosecco, champagne, cava, sparkling wine/cider, ginger beer, cola, beer)
  const sparklingPattern = /\b(soda|tonic|prosecco|champagne|cava|sparkling|seltzer|ginger beer|ginger ale|cola|coke|beer|lager|stout)\b/i;
  const hasSparkle = (recipe?.specs || []).some(s => sparklingPattern.test(s?.name || ''));

  const effervescenceHtml = (hasSparkle && layers.length > 0) ? `
    <!-- Ambient Effervescence: streams of micro-bubbles rising from depths to surface -->
    <g class="fluid-effervescence" pointer-events="none">
      <circle class="fluid-bubble fluid-bubble-1" cx="108" cy="${(fluidBottomY - 14).toFixed(1)}" r="1.6" fill="rgba(255, 255, 255, 0.95)" stroke="rgba(20, 30, 45, 0.45)" stroke-width="0.55" />
      <circle class="fluid-bubble fluid-bubble-2" cx="126" cy="${(fluidBottomY - 8).toFixed(1)}" r="2.0" fill="rgba(255, 255, 255, 0.95)" stroke="rgba(20, 30, 45, 0.45)" stroke-width="0.55" />
      <circle class="fluid-bubble fluid-bubble-3" cx="114" cy="${(fluidBottomY - 24).toFixed(1)}" r="1.5" fill="rgba(255, 255, 255, 0.95)" stroke="rgba(20, 30, 45, 0.45)" stroke-width="0.55" />
      <circle class="fluid-bubble fluid-bubble-4" cx="132" cy="${(fluidBottomY - 18).toFixed(1)}" r="1.9" fill="rgba(255, 255, 255, 0.95)" stroke="rgba(20, 30, 45, 0.45)" stroke-width="0.55" />
      <circle class="fluid-bubble fluid-bubble-5" cx="102" cy="${(fluidBottomY - 32).toFixed(1)}" r="1.4" fill="rgba(255, 255, 255, 0.95)" stroke="rgba(20, 30, 45, 0.45)" stroke-width="0.55" />
      <circle class="fluid-bubble fluid-bubble-6" cx="120" cy="${(fluidBottomY - 40).toFixed(1)}" r="1.8" fill="rgba(255, 255, 255, 0.95)" stroke="rgba(20, 30, 45, 0.45)" stroke-width="0.55" />
      <circle class="fluid-bubble fluid-bubble-7" cx="138" cy="${(fluidBottomY - 28).toFixed(1)}" r="1.5" fill="rgba(255, 255, 255, 0.95)" stroke="rgba(20, 30, 45, 0.45)" stroke-width="0.55" />
    </g>
  ` : '';

  // Glass reflections and sheen
  const glassSheen = `
    <!-- Specular reflection along left wall (tailored to glassware geometry) -->
    ${glassware.sheenD ? `
      <path
        d="${glassware.sheenD}"
        stroke="rgba(255, 255, 255, 0.18)"
        stroke-width="1.8"
        stroke-linecap="round"
        fill="none"
        pointer-events="none"
      />
    ` : ''}
    <!-- Rim highlight -->
    <path
      d="${glassware.glassRimD}"
      stroke="rgba(255, 255, 255, 0.45)"
      stroke-width="1.8"
      stroke-linecap="round"
      fill="none"
      pointer-events="none"
    />
  `;

  // Garnishes
  const garnishesSvg = renderGarnishesSvg(recipe, glassware, layers.length > 0 ? surfaceY : null);

  const { top: vbTop, height: vbHeight } = computeGlassViewBox(recipe, glassware);

  return `
    <svg
      class="speakeasy-glass-svg"
      viewBox="0 ${vbTop} 240 ${vbHeight}"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="${escapeXml(recipe?.name || 'Cocktail')} visual ratio preview"
    >
      <defs>
        <clipPath id="${clipId}">
          <path d="${glassware.fluidClipD}" />
        </clipPath>
        ${gradientDefs}
        ${blendedGradDef}
        <filter id="${glassId}-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
        <!-- Indulgent swirl blend distortion filter -->
        <filter id="${glassId}-swirl" x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence type="fractalNoise" baseFrequency="0.035 0.07" numOctaves="3" result="noise" seed="42" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="14" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>

      <!-- Subtle glass background cavity -->
      <path
        d="${glassware.fluidClipD}"
        fill="rgba(255, 255, 255, 0.03)"
        stroke="none"
      />

      <!-- Proportional Fluid Layers and Blended Body (clipped to glass interior) -->
      <g clip-path="url(#${clipId})" class="fluid-stack" data-mode="${mode}">
        <!-- Layered Stacks -->
        <g class="fluid-layered-group">
          ${fluidLayersHtml}
        </g>

        <!-- Indulgent Blended Fluid Body -->
        <g class="fluid-blended-group">
          ${blendedLiquidHtml}
        </g>

        <!-- Ambient Effervescence -->
        ${effervescenceHtml}

        <!-- Common Surface Meniscus -->
        ${surfaceMeniscus}
      </g>

      <!-- Glass stem and base (if applicable) -->
      ${glassware.stemD ? `
        <path
          d="${glassware.stemD}"
          stroke="rgba(255, 255, 255, 0.4)"
          stroke-width="4.5"
          stroke-linecap="round"
          fill="none"
        />
      ` : ''}

      ${glassware.baseD ? `
        <path
          d="${glassware.baseD}"
          fill="rgba(255, 255, 255, 0.08)"
          stroke="rgba(255, 255, 255, 0.35)"
          stroke-width="1.5"
        />
      ` : ''}

      <!-- Outer Glass Silhouette Outline -->
      <path
        d="${glassware.glassOutlineD}"
        fill="none"
        stroke="rgba(255, 255, 255, 0.42)"
        stroke-width="2.2"
        stroke-linejoin="round"
      />

      <!-- Glass Handle (e.g. Mug / Hot Toddy Glass) -->
      ${glassware.handleD ? `
        <path
          d="${glassware.handleD}"
          fill="rgba(255, 255, 255, 0.05)"
          stroke="rgba(255, 255, 255, 0.42)"
          stroke-width="2.0"
          stroke-linejoin="round"
        />
      ` : ''}

      <!-- Cut glass facet details (e.g. Tartan pattern) -->
      ${glassware.detailsD ? `
        <path
          d="${glassware.detailsD}"
          fill="none"
          stroke="rgba(255, 255, 255, 0.28)"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          pointer-events="none"
        />
      ` : ''}

      ${glassSheen}

      <!-- Garnishes -->
      ${garnishesSvg}

      <!-- Ambient Steam for hot beverages (drifting upward from surface) -->
      ${(isHotBeverage(recipe, glassware) && layers.length > 0) ? renderSteamVapor(
        (glassware.rim.leftX + glassware.rim.rightX) / 2,
        glassware.rim.y,
        parseFloat(surfaceY)
      ) : ''}
    </svg>
  `;
}

export class GlassView {
  constructor(containerEl, options = {}) {
    this.container = containerEl;
    this.options = {
      onLayerHover: null,
      onLayerSelect: null,
      initialMode: 'layered',
      ...options,
    };
    this.id = `glass-${nextGlassId++}`;
    this.currentRecipe = null;
    this.layers = [];
    this.mode = this.options.initialMode || 'layered';
  }

  render(recipe, mode = this.mode) {
    this.currentRecipe = recipe;
    this.mode = mode;
    this.layers = calculateFluidLayers(recipe?.specs || []);
    const svg = renderGlassSvg(recipe, this.id, { mode: this.mode });
    this.container.innerHTML =  /*html*/svg;
    // The viewBox is cropped to this glass+garnish's own height (see
    // computeGlassViewBox above), so the wrapper's aspect-ratio must follow
    // suit — otherwise a fixed-height box would just stretch a short glass
    // (e.g. a coupe pouring a cherry) to fill space sized for a tall one.
    const { height: vbHeight } = computeGlassViewBox(recipe, resolveGlassware(recipe?.glassware));
    this.container.style.aspectRatio = `240 / ${vbHeight}`;
    this.wireEvents();
  }

  setMode(mode) {
    if (this.mode === mode) return;
    this.mode = mode;

    const stack = this.container.querySelector('.fluid-stack');
    const svgEl = this.container.querySelector('.speakeasy-glass-svg');

    if (stack && svgEl) {
      // Trigger extravagant vortex swirl animation class
      svgEl.classList.remove('is-blending-forward', 'is-blending-backward');
      // Trigger reflow to restart animation cleanly
      void svgEl.offsetWidth;

      // Ensure the SVG filter matches this glass view instance
      svgEl.style.setProperty('--swirl-filter', `url(#${this.id}-swirl)`);

      if (mode === 'blended') {
        svgEl.classList.add('is-blending-forward');
      } else {
        svgEl.classList.add('is-blending-backward');
      }

      stack.setAttribute('data-mode', mode);

      // Clean up dynamic animation classes once complete
      setTimeout(() => {
        svgEl.classList.remove('is-blending-forward', 'is-blending-backward');
      }, 950);
    } else if (this.currentRecipe) {
      this.render(this.currentRecipe, mode);
    }
  }

  wireEvents() {
    const layerEls = this.container.querySelectorAll('.fluid-layer');
    layerEls.forEach(el => {
      const idx = parseInt(el.getAttribute('data-index'), 10);
      el.addEventListener('mouseenter', () => {
        this.highlightLayer(idx);
        if (typeof this.options.onLayerHover === 'function') {
          this.options.onLayerHover(idx, this.layers[idx]);
        }
      });

      el.addEventListener('mouseleave', () => {
        this.clearHighlight();
        if (typeof this.options.onLayerHover === 'function') {
          this.options.onLayerHover(null, null);
        }
      });

      el.addEventListener('click', () => {
        if (typeof this.options.onLayerSelect === 'function') {
          this.options.onLayerSelect(idx, this.layers[idx]);
        }
      });
    });
  }

  highlightLayer(index) {
    const layerEls = this.container.querySelectorAll('.fluid-layer');
    layerEls.forEach((el, i) => {
      if (index === null || index === undefined) {
        el.style.opacity = '';
        el.style.filter = '';
      } else if (i === index) {
        el.style.opacity = '1';
        el.style.filter = 'brightness(1.25) drop-shadow(0 0 7px rgba(255, 255, 255, 0.5))';
      } else {
        el.style.opacity = '0.35';
        el.style.filter = 'grayscale(0.4)';
      }
    });
  }

  clearHighlight() {
    this.highlightLayer(null);
  }

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
