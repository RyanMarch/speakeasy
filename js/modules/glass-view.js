/**
 * Speakeasy Interactive Vector Fluid Glass Renderer
 * Generates an SVG glass with proportional fluid layers, clipped to glassware geometry.
 */

import { resolveGlassware } from './glassware.js';
import { calculateFluidLayers, calculateBlendedColor } from './colors.js';
import { renderGarnishesSvg } from './garnishes.js';

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
  const blendedInfo = calculateBlendedColor(recipe?.specs || []);

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

  // Build liquid layers
  // Stacking starts from bottom of the glass upwards
  const fluidLayersHtml = layers.map((layer, i) => {
    const layerBottomY = fluidBottomY - (fluidTotalHeight * layer.startRatio);
    const layerTopY = fluidBottomY - (fluidTotalHeight * layer.endRatio);
    const height = Math.max(0.8, layerBottomY - layerTopY + 0.6); // 0.6 overlap prevents subpixel seam

    return `
      <rect
        class="fluid-layer"
        data-index="${i}"
        data-name="${escapeXml(layer.spec.name)}"
        data-amount="${layer.spec.amount ?? ''}"
        data-unit="${layer.spec.unit ?? ''}"
        x="0"
        y="${layerTopY.toFixed(2)}"
        width="240"
        height="${height.toFixed(2)}"
        fill="url(#${gradPrefix}-${i})"
      >
        <title>${escapeXml(layer.spec.name)} (${(layer.ratio * 100).toFixed(0)}%)</title>
      </rect>
    `;
  }).join('');

  // Blended single body
  const blendTopY = (fluidBottomY - fluidTotalHeight).toFixed(2);
  const blendedLiquidHtml = layers.length > 0 ? `
    <g class="blended-fluid-body">
      <rect
        class="blended-fill-base"
        x="0"
        y="${blendTopY}"
        width="240"
        height="${(fluidTotalHeight + 1).toFixed(2)}"
        fill="url(#${blendGradId})"
      >
        <title>${escapeXml(recipe?.name || 'Blended Cocktail')} (Mixed)</title>
      </rect>
      <rect
        class="blended-fill-shading"
        x="0"
        y="${blendTopY}"
        width="240"
        height="${(fluidTotalHeight + 1).toFixed(2)}"
        fill="url(#${blendGradId}-depth)"
        pointer-events="none"
      />
    </g>
  ` : '';

  // Top surface liquid meniscus line
  const surfaceY = (fluidBottomY - fluidTotalHeight).toFixed(2);

  const surfaceMeniscus = layers.length > 0 ? `
    <ellipse
      cx="120"
      cy="${surfaceY}"
      rx="${(bounds.width * 0.42).toFixed(1)}"
      ry="3.5"
      fill="rgba(255, 255, 255, 0.28)"
      class="liquid-meniscus"
    />
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

  return `
    <svg
      class="speakeasy-glass-svg"
      viewBox="${glassware.viewBox}"
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
