/**
 * Speakeasy Interactive Vector Fluid Glass Renderer
 * Generates an SVG glass with proportional fluid layers, clipped to glassware geometry.
 */

import { resolveGlassware } from './glassware.js';
import { calculateFluidLayers } from './colors.js';

let nextGlassId = 1;

export class GlassView {
  constructor(containerEl, options = {}) {
    this.container = containerEl;
    this.options = {
      onLayerHover: null,
      onLayerSelect: null,
      ...options,
    };
    this.id = `glass-${nextGlassId++}`;
    this.currentRecipe = null;
    this.layers = [];
  }

  render(recipe) {
    this.currentRecipe = recipe;
    const glassware = resolveGlassware(recipe?.glassware);
    const layers = calculateFluidLayers(recipe?.specs || []);
    this.layers = layers;

    const clipId = `${this.id}-clip`;
    const gradPrefix = `${this.id}-grad`;

    // Maximum liquid level fills ~82% of the glassware bowl
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
          data-name="${this.escapeHtml(layer.spec.name)}"
          data-amount="${layer.spec.amount ?? ''}"
          data-unit="${layer.spec.unit ?? ''}"
          x="0"
          y="${layerTopY.toFixed(2)}"
          width="240"
          height="${height.toFixed(2)}"
          fill="url(#${gradPrefix}-${i})"
        >
          <title>${this.escapeHtml(layer.spec.name)} (${(layer.ratio * 100).toFixed(0)}%)</title>
        </rect>
      `;
    }).join('');

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

    const svg = `
      <svg
        class="speakeasy-glass-svg"
        viewBox="${glassware.viewBox}"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="${this.escapeHtml(recipe?.name || 'Cocktail')} visual ratio preview"
      >
        <defs>
          <clipPath id="${clipId}">
            <path d="${glassware.fluidClipD}" />
          </clipPath>
          ${gradientDefs}
          <filter id="${this.id}-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        <!-- Subtle glass background cavity -->
        <path
          d="${glassware.fluidClipD}"
          fill="rgba(255, 255, 255, 0.03)"
          stroke="none"
        />

        <!-- Proportional Fluid Layers (clipped to glass interior) -->
        <g clip-path="url(#${clipId})" class="fluid-stack">
          ${fluidLayersHtml}
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
      </svg>
    `;

    this.container.innerHTML =  /*html*/svg;
    this.wireEvents();
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
        el.style.opacity = '1';
        el.style.filter = '';
      } else if (i === index) {
        el.style.opacity = '1';
        el.style.filter = 'brightness(1.22) drop-shadow(0 0 6px rgba(255, 255, 255, 0.4))';
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
