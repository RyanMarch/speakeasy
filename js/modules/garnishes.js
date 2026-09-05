/**
 * Speakeasy Garnish SVG Profiles & Renderer
 * Provides vector garnish graphics anchored to glassware rims and fluid levels.
 */

/**
 * Parses garnish descriptions into recognized garnish identifiers
 */
export function resolveGarnishTypes(garnishString = '') {
  if (!garnishString || typeof garnishString !== 'string') return [];
  const text = garnishString.toLowerCase().trim();
  if (!text || text.includes('no garnish')) return [];

  const garnishes = [];

  // Salt or sugar rim
  if (text.includes('salt rim') || text.includes('salt') && text.includes('rim')) {
    garnishes.push('saltRim');
  } else if (text.includes('sugar rim') || text.includes('sugar') && text.includes('rim')) {
    garnishes.push('sugarRim');
  }

  // Coffee beans
  if (text.includes('coffee')) {
    garnishes.push('coffeeBeans');
  }

  // Olive
  if (text.includes('olive')) {
    garnishes.push('olive');
  }

  // Cherry
  if (text.includes('cherry') || text.includes('cherries') || text.includes('maraschino')) {
    garnishes.push('cherry');
  }

  // Mint
  if (text.includes('mint') || text.includes('basil')) {
    garnishes.push('mintSprig');
  }

  // Pineapple
  if (text.includes('pineapple')) {
    garnishes.push('pineappleWedge');
  }

  // Wheels and Slices
  if (/lime.*(wheel|disc)/.test(text) || /(wheel|disc).*lime/.test(text)) {
    garnishes.push('limeWheel');
  } else if (/lemon.*(wheel|slice)/.test(text) || /wheel.*lemon/.test(text)) {
    garnishes.push('lemonWheel');
  } else if (/orange.*(wheel|slice)/.test(text) || /wheel.*orange/.test(text)) {
    garnishes.push('orangeWheel');
  }

  // Wedges
  if (text.includes('lime wedge') || text.includes('wedge') && text.includes('lime')) {
    if (!garnishes.includes('limeWheel')) garnishes.push('limeWedge');
  } else if (text.includes('lemon wedge')) {
    if (!garnishes.includes('lemonWheel')) garnishes.push('lemonWedge');
  } else if (text.includes('orange wedge') || text.includes('grapefruit wedge')) {
    if (!garnishes.includes('orangeWheel')) garnishes.push('orangeWedge');
  }

  // Twists and Peels
  if (text.includes('orange twist') || text.includes('orange peel') || text.includes('flamed orange')) {
    garnishes.push('orangeTwist');
  } else if (text.includes('lemon twist') || text.includes('lemon peel') || text.includes('flamed lemon')) {
    garnishes.push('lemonTwist');
  } else if (text.includes('grapefruit twist') || text.includes('grapefruit peel')) {
    garnishes.push('orangeTwist');
  } else if (text.includes('lime twist')) {
    garnishes.push('limeTwist');
  } else if (text.includes('twist') || text.includes('peel')) {
    // Generic twist fallback
    if (!garnishes.some(g => g.endsWith('Twist'))) {
      garnishes.push('lemonTwist');
    }
  }

  // Generic fruit mention fallbacks if nothing matched yet
  if (garnishes.length === 0) {
    if (text.includes('lime')) garnishes.push('limeWheel');
    else if (text.includes('lemon')) garnishes.push('lemonWheel');
    else if (text.includes('orange')) garnishes.push('orangeTwist');
  }

  // Cap at 2 distinct garnishes to preserve visual balance
  return Array.from(new Set(garnishes)).slice(0, 2);
}

/**
 * Render salt or sugar rim along the glass rim contour
 */
function renderRimCrust(glassware, isSugar = false) {
  const color = isSugar ? 'rgba(255, 253, 231, 0.9)' : 'rgba(255, 255, 255, 0.9)';
  return `
    <g class="garnish garnish-rim-crust" pointer-events="none">
      <path d="${glassware.glassRimD}" stroke="${color}" stroke-width="4.5" stroke-linecap="round" fill="none" opacity="0.35" />
      <path d="${glassware.glassRimD}" stroke="${color}" stroke-width="3" stroke-linecap="round" stroke-dasharray="1.5 2.5" fill="none" opacity="0.95" />
      <path d="${glassware.glassRimD}" stroke="#ffffff" stroke-width="1.6" stroke-linecap="round" stroke-dasharray="0.8 3" fill="none" opacity="0.8" />
    </g>
  `;
}

/**
 * Render citrus wheel (lime, lemon, orange)
 */
function renderCitrusWheel(x, y, type = 'lime', angle = 14) {
  const themes = {
    lime: { rind: '#2e7d32', pith: '#dcedc8', pulp: '#7cb342', pulpDark: '#558b2f', mem: '#f1f8e9' },
    lemon: { rind: '#fbc02d', pith: '#fff9c4', pulp: '#fdd835', pulpDark: '#f57f17', mem: '#fffde7' },
    orange: { rind: '#e65100', pith: '#ffe0b2', pulp: '#fb8c00', pulpDark: '#ef6c00', mem: '#fff3e0' },
  };
  const t = themes[type] || themes.lime;

  const count = 8;
  const r = 15;
  const segments = [];
  for (let i = 0; i < count; i++) {
    const a1 = ((i * 360) / count + 4) * (Math.PI / 180);
    const a2 = (((i + 1) * 360) / count - 4) * (Math.PI / 180);
    const x1 = (Math.cos(a1) * r).toFixed(1);
    const y1 = (Math.sin(a1) * r).toFixed(1);
    const x2 = (Math.cos(a2) * r).toFixed(1);
    const y2 = (Math.sin(a2) * r).toFixed(1);
    segments.push(`<path d="M 0 0 L ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2} Z" fill="${t.pulp}" />`);
  }

  return `
    <g class="garnish garnish-${type}-wheel" transform="translate(${x.toFixed(1)}, ${y.toFixed(1)}) rotate(${angle})" pointer-events="none">
      <circle cx="0" cy="0" r="21" fill="${t.rind}" />
      <circle cx="0" cy="0" r="18" fill="${t.pith}" />
      <circle cx="0" cy="0" r="15.5" fill="${t.pulpDark}" />
      ${segments.join('')}
      <circle cx="0" cy="0" r="2.6" fill="${t.mem}" />
      <!-- Rim notch illusion -->
      <line x1="0" y1="2" x2="0" y2="21" stroke="rgba(0,0,0,0.35)" stroke-width="1.2" />
    </g>
  `;
}

/**
 * Render citrus wedge with realistic rim-slot cut that straddles the glass
 */
function renderCitrusWedge(x, y, type = 'lime', isLeft = false) {
  const themes = {
    lime: { rind: '#2e7d32', pith: '#dcedc8', pulp: '#7cb342' },
    lemon: { rind: '#fbc02d', pith: '#fff9c4', pulp: '#fdd835' },
    orange: { rind: '#e65100', pith: '#ffe0b2', pulp: '#fb8c00' },
  };
  const t = themes[type] || themes.lime;
  const sx = isLeft ? -1 : 1;
  const rot = isLeft ? -6 : 6;

  return `
    <g class="garnish garnish-${type}-wedge" transform="translate(${x.toFixed(1)}, ${y.toFixed(1)}) rotate(${rot}) scale(${sx}, 1)" pointer-events="none">
      <!-- Outer arched rind -->
      <path
        d="M -19 5 C -19 -14, -10 -22, 0 -22 C 10 -22, 19 -14, 19 5 L 16 6 C 16 -11, 8 -19, 0 -19 C -8 -19, -16 -11, -16 6 Z"
        fill="${t.rind}"
      />
      <!-- Pith underlayer -->
      <path
        d="M -16 6 C -16 -11, -8 -19, 0 -19 C 8 -19, 16 -11, 16 6 L 14 6.5 C 14 -8.5, 7 -16.5, 0 -16.5 C -7 -16.5, -14 -8.5, -14 6.5 Z"
        fill="${t.pith}"
      />
      <!-- Inner pulp body (left lobe inside glass) -->
      <path
        d="M -14 6.5 C -14 -8.5, -7 -16.5, 0 -16.5 L 0 -6 L -1 5.5 L -14 6.5 Z"
        fill="${t.pulp}"
      />
      <!-- Inner pulp body (right lobe outside glass) -->
      <path
        d="M 0 -16.5 C 7 -16.5, 14 -8.5, 14 6.5 L 1 5.5 L 0 -6 Z"
        fill="${t.pulp}"
      />
      <!-- Radial pulp membrane segments -->
      <path
        d="M 0 -6 L -8 -12 M 0 -6 L -12 -2 M 0 -6 L 8 -12 M 0 -6 L 12 -2"
        stroke="${t.pith}"
        stroke-width="0.9"
        opacity="0.85"
      />
      <!-- Rim notch shadow (rim seats deep into fruit) -->
      <line x1="0" y1="6.5" x2="0" y2="-6" stroke="rgba(0,0,0,0.55)" stroke-width="1.6" />
    </g>
  `;
}

/**
 * Render corkscrew citrus twist with authentic helical spiral, zest and pith surfaces, and bias-cut ends
 */
function renderPeelTwist(x, y, type = 'lemon', isLeft = false) {
  const isOrange = type === 'orange';
  const isLime = type === 'lime';
  const peelColor = isOrange ? '#ef6c00' : isLime ? '#2e7d32' : '#fbc02d';
  const peelLight = isOrange ? '#ff9800' : isLime ? '#66bb6a' : '#fff59d';
  const peelDark = isOrange ? '#b23c00' : isLime ? '#1b5e20' : '#d49b00';
  const pithColor = isOrange ? '#ffe0b2' : isLime ? '#dcedc8' : '#fffde7';
  const sx = isLeft ? -1 : 1;
  const rot = isLeft ? -8 : 8;

  return `
    <g class="garnish garnish-${type}-twist" transform="translate(${x.toFixed(1)}, ${y.toFixed(1)}) rotate(${rot}) scale(${sx}, 1)" pointer-events="none">
      <!-- Back coils of helix corkscrew (showing inner pith) -->
      <!-- Upper back coil rising from inside glass -->
      <path
        d="M -10 12 C -10 4, -7 -4, -2 -8"
        stroke="${pithColor}"
        stroke-width="5.5"
        stroke-linecap="square"
        fill="none"
      />
      <!-- Lower under-turn showing pith inside spiral loop -->
      <path
        d="M 10 7 C 12 15, 3 18, 0 23"
        stroke="${pithColor}"
        stroke-width="5"
        stroke-linecap="round"
        fill="none"
      />

      <!-- Drop shadow under front crossing ribbon -->
      <path
        d="M -2 -8 C 4 -12, 11 -7, 11 0 C 11 8, 7 13, 1 16"
        stroke="rgba(0, 0, 0, 0.22)"
        stroke-width="6.5"
        stroke-linecap="round"
        fill="none"
      />

      <!-- Front coils of corkscrew spiral (vibrant citrus zest) -->
      <!-- Main crest coil arching over the glass rim -->
      <path
        d="M -2 -8 C 4 -12, 11 -7, 11 0 C 11 8, 7 13, 1 16"
        stroke="${peelColor}"
        stroke-width="5"
        stroke-linecap="round"
        fill="none"
      />
      <!-- Glossy zest sheen highlight along crest -->
      <path
        d="M 0 -9 C 5 -12, 10 -7, 10 -1"
        stroke="${peelLight}"
        stroke-width="1.8"
        stroke-linecap="round"
        fill="none"
        opacity="0.9"
      />

      <!-- Lower outer tail coil corkscrewing forward with tapered knife cut -->
      <path
        d="M 1 23 C 3 27, 8 29, 7 35 C 6 38, 3 40, 1 41"
        stroke="${peelColor}"
        stroke-width="4.6"
        stroke-linecap="round"
        fill="none"
      />
      <!-- Tail sheen highlight -->
      <path
        d="M 2 24 C 4 28, 8 29, 7 35"
        stroke="${peelLight}"
        stroke-width="1.5"
        stroke-linecap="round"
        fill="none"
        opacity="0.85"
      />

      <!-- Sharp 45-degree knife cuts at both ends -->
      <line x1="-12" y1="14" x2="-8" y2="10" stroke="${peelDark}" stroke-width="1.8" stroke-linecap="round" />
      <line x1="-1" y1="40" x2="3" y2="42" stroke="${peelDark}" stroke-width="1.6" stroke-linecap="round" />
    </g>
  `;
}

/**
 * Render cherry on pick collinear with rim contact, fruit resting inside bowl
 */
function renderCherryOnPick(rimX, rimY, isLeft = false) {
  const sx = isLeft ? 1 : -1;
  const contactX = rimX + (2 * sx);
  const contactY = rimY;

  const knobX = contactX - (15 * sx);
  const knobY = contactY - 9.5;
  const cherryX = contactX + (24 * sx);
  const cherryY = contactY + 15.5;
  const tipX = contactX + (46 * sx);
  const tipY = contactY + 29;

  return `
    <g class="garnish garnish-cherry" pointer-events="none">
      <!-- Cocktail pick shaft -->
      <line
        x1="${knobX.toFixed(1)}"
        y1="${knobY.toFixed(1)}"
        x2="${tipX.toFixed(1)}"
        y2="${tipY.toFixed(1)}"
        stroke="#d7ccc8"
        stroke-width="1.8"
        stroke-linecap="round"
      />
      <circle cx="${knobX.toFixed(1)}" cy="${knobY.toFixed(1)}" r="2.6" fill="#90a4ae" stroke="#607d8b" stroke-width="0.7" />

      <!-- Delicate cherry stem -->
      <path
        d="M ${cherryX.toFixed(1)} ${(cherryY - 8).toFixed(1)} C ${(cherryX - (3 * sx)).toFixed(1)} ${(cherryY - 16).toFixed(1)}, ${(cherryX - (2 * sx)).toFixed(1)} ${(cherryY - 22).toFixed(1)}, ${(cherryX - (8 * sx)).toFixed(1)} ${(cherryY - 25).toFixed(1)}"
        stroke="#4e342e"
        stroke-width="1.2"
        fill="none"
        stroke-linecap="round"
      />

      <!-- Deep red cocktail cherry nestled inside drink -->
      <circle cx="${cherryX.toFixed(1)}" cy="${cherryY.toFixed(1)}" r="10.5" fill="#7b112b" />
      <ellipse cx="${(cherryX - (1 * sx)).toFixed(1)}" cy="${(cherryY + 3).toFixed(1)}" rx="7" ry="5" fill="#4a0014" opacity="0.6" />
      <ellipse cx="${(cherryX + (3 * sx)).toFixed(1)}" cy="${(cherryY - 3).toFixed(1)}" rx="3.2" ry="1.8" fill="rgba(255, 255, 255, 0.65)" transform="rotate(${-20 * sx} ${cherryX + (3 * sx)} ${cherryY - 3})" />
      <circle cx="${(cherryX + (1 * sx)).toFixed(1)}" cy="${(cherryY - 4).toFixed(1)}" r="1" fill="rgba(255, 255, 255, 0.45)" />
    </g>
  `;
}

/**
 * Render green olive on pick collinear with rim contact, olive safely inside bowl
 */
function renderOliveOnPick(rimX, rimY, isLeft = false) {
  const sx = isLeft ? 1 : -1;
  const contactX = rimX + (2 * sx);
  const contactY = rimY;

  // Exact collinear shaft tilted 32 degrees inward into the drink
  const knobX = contactX - (16 * sx);
  const knobY = contactY - 10;
  const oliveX = contactX + (28 * sx);
  const oliveY = contactY + 17.5;
  const tipX = contactX + (56 * sx);
  const tipY = contactY + 35;
  const oliveRot = 32 * sx;

  return `
    <g class="garnish garnish-olive" pointer-events="none">
      <!-- Cocktail pick shaft resting across rim -->
      <line
        x1="${knobX.toFixed(1)}"
        y1="${knobY.toFixed(1)}"
        x2="${tipX.toFixed(1)}"
        y2="${tipY.toFixed(1)}"
        stroke="#cfd8dc"
        stroke-width="2"
        stroke-linecap="round"
      />
      <!-- Pick top knob handle -->
      <circle cx="${knobX.toFixed(1)}" cy="${knobY.toFixed(1)}" r="3.2" fill="#90a4ae" stroke="#607d8b" stroke-width="0.8" />

      <!-- Olive submerged inside glass bowl -->
      <g transform="translate(${oliveX.toFixed(1)}, ${oliveY.toFixed(1)}) rotate(${oliveRot})">
        <!-- Cast shadow -->
        <ellipse cx="0" cy="0" rx="12" ry="17.5" fill="#2e4215" opacity="0.6" />
        <!-- Spanish / Castelvetrano green olive body -->
        <ellipse cx="-0.5" cy="0" rx="11.2" ry="16.5" fill="#689f38" />
        <!-- Glossy surface sheen highlight -->
        <path d="M -6.5 3 C -8 8, -5 12, -2 13.5" stroke="rgba(255, 255, 255, 0.62)" stroke-width="1.8" stroke-linecap="round" fill="none" />
        <!-- Red pimento slice center -->
        <ellipse cx="0" cy="-4.5" rx="4.8" ry="3.5" fill="#b71c1c" />
        <ellipse cx="0" cy="-4.5" rx="3" ry="2" fill="#d32f2f" />
        <!-- Specular shine pip on pimento -->
        <circle cx="1" cy="-5.2" r="0.8" fill="#ffffff" opacity="0.8" />
      </g>
    </g>
  `;
}

/**
 * Render fresh mint sprig with generous bouquet
 */
function renderMintSprig(x, y, angle = -12) {
  return `
    <g class="garnish garnish-mint" transform="translate(${x.toFixed(1)}, ${y.toFixed(1)}) rotate(${angle})" pointer-events="none">
      <!-- Main mint stem -->
      <path d="M 0 20 L 0 -6" stroke="#2e7d32" stroke-width="2.5" stroke-linecap="round" />
      
      <!-- Back / Left spreading leaf -->
      <path d="M 0 4 C -16 2, -24 -10, -20 -24 C -8 -22, -3 -8, 0 4 Z" fill="#2e7d32" />
      <path d="M 0 4 Q -11 -8 -20 -24" stroke="#81c784" stroke-width="1" fill="none" opacity="0.75" />
      <path d="M -7 -4 Q -12 -5 -15 -8 M -4 0 Q -8 -2 -11 -5" stroke="#81c784" stroke-width="0.7" fill="none" opacity="0.6" />

      <!-- Right spreading leaf -->
      <path d="M 0 6 C 16 4, 26 -8, 21 -22 C 11 -20, 4 -6, 0 6 Z" fill="#388e3c" />
      <path d="M 0 6 Q 11 -6 21 -22" stroke="#a5d6a7" stroke-width="1" fill="none" opacity="0.75" />
      <path d="M 7 -2 Q 12 -4 16 -7 M 4 2 Q 8 0 11 -3" stroke="#a5d6a7" stroke-width="0.7" fill="none" opacity="0.6" />

      <!-- Tall center crown leaf -->
      <path d="M 0 2 C -10 -12, -6 -32, 0 -38 C 6 -32, 10 -12, 0 2 Z" fill="#43a047" />
      <path d="M 0 2 L 0 -36" stroke="#c8e6c9" stroke-width="1.1" fill="none" opacity="0.85" />
      <path d="M 0 -12 L -4 -16 M 0 -12 L 4 -16 M 0 -22 L -3 -26 M 0 -22 L 3 -26" stroke="#c8e6c9" stroke-width="0.7" fill="none" opacity="0.7" />

      <!-- Foreground budding leaf -->
      <path d="M 0 2 C -5 -3, -4 -12, 0 -15 C 4 -12, 5 -3, 0 2 Z" fill="#66bb6a" opacity="0.95" />
      <path d="M 0 2 L 0 -14" stroke="#e8f5e9" stroke-width="0.7" fill="none" opacity="0.8" />
    </g>
  `;
}

/**
 * Render three coffee beans floated on surface
 */
function renderCoffeeBeans(cx, cy) {
  const beans = [
    { dx: 0, dy: -6, rot: 15 },
    { dx: -7, dy: 5, rot: -45 },
    { dx: 7, dy: 5, rot: 70 },
  ];
  return `
    <g class="garnish garnish-coffee-beans" transform="translate(${cx.toFixed(1)}, ${cy.toFixed(1)})" pointer-events="none">
      ${beans.map(b => `
        <g transform="translate(${b.dx}, ${b.dy}) rotate(${b.rot})">
          <ellipse cx="0" cy="0" rx="4.5" ry="3.2" fill="#2b1708" stroke="#160c04" stroke-width="0.6" />
          <path d="M -3.2 0 C -1 -0.8, 1 0.8, 3.2 0" stroke="#0e0602" stroke-width="0.8" fill="none" stroke-linecap="round" />
          <ellipse cx="0" cy="-1.4" rx="2.5" ry="0.8" fill="rgba(255, 255, 255, 0.16)" />
        </g>
      `).join('')}
    </g>
  `;
}

/**
 * Render pineapple wedge
 */
function renderPineappleWedge(x, y, angle = 16) {
  return `
    <g class="garnish garnish-pineapple" transform="translate(${x.toFixed(1)}, ${y.toFixed(1)}) rotate(${angle})" pointer-events="none">
      <!-- Background pineapple leaves -->
      <path d="M -4 8 C -14 -12, -4 -34, -8 -42 C 4 -32, 4 -14, 2 8 Z" fill="#2e7d32" />
      <path d="M -2 8 C 4 -8, 12 -28, 14 -38 C 12 -26, 6 -10, 4 8 Z" fill="#388e3c" />
      <!-- Golden triangular wedge -->
      <polygon points="-16,8 16,8 0,-24" fill="#fdd835" />
      <!-- Outer rind border -->
      <path d="M -16 8 Q 0 12 16 8 L 17 11 Q 0 15 -17 11 Z" fill="#795548" stroke="#5d4037" stroke-width="0.8" />
      <!-- Fiber grain lines -->
      <path d="M 0 -22 L -8 6 M 0 -22 L 0 7 M 0 -22 L 8 6" stroke="#fbc02d" stroke-width="1.2" opacity="0.8" />
      <line x1="0" y1="0" x2="0" y2="10" stroke="rgba(0,0,0,0.35)" stroke-width="1.2" />
    </g>
  `;
}

/**
 * Main entry point: Renders garnish SVG elements for a cocktail recipe and glassware
 */
export function renderGarnishesSvg(recipe, glassware, surfaceY) {
  const garnishStr = recipe?.garnish;
  if (!garnishStr || !glassware) return '';

  const types = resolveGarnishTypes(garnishStr);
  if (types.length === 0) return '';

  const rim = glassware.rim || { leftX: 46, rightX: 194, y: 96 };
  const floatY = surfaceY !== null && surfaceY !== undefined ? parseFloat(surfaceY) : rim.y + 12;

  const rendered = [];

  types.forEach((type, index) => {
    // Positioning slot: if two garnishes, place first on left, second on right
    const isSlotLeft = types.length > 1 && index === 0 && !type.includes('Rim') && type !== 'coffeeBeans';
    const posX = isSlotLeft ? rim.leftX + 2 : rim.rightX - 2;
    const posY = rim.y;

    switch (type) {
      case 'saltRim':
        rendered.push(renderRimCrust(glassware, false));
        break;
      case 'sugarRim':
        rendered.push(renderRimCrust(glassware, true));
        break;
      case 'coffeeBeans':
        rendered.push(renderCoffeeBeans(120, floatY + 6));
        break;
      case 'limeWheel':
        rendered.push(renderCitrusWheel(posX, posY - 6, 'lime', isSlotLeft ? -14 : 14));
        break;
      case 'lemonWheel':
        rendered.push(renderCitrusWheel(posX, posY - 6, 'lemon', isSlotLeft ? -14 : 14));
        break;
      case 'orangeWheel':
        rendered.push(renderCitrusWheel(posX, posY - 6, 'orange', isSlotLeft ? -14 : 14));
        break;
      case 'limeWedge':
        rendered.push(renderCitrusWedge(posX, posY, 'lime', isSlotLeft));
        break;
      case 'lemonWedge':
        rendered.push(renderCitrusWedge(posX, posY, 'lemon', isSlotLeft));
        break;
      case 'orangeWedge':
        rendered.push(renderCitrusWedge(posX, posY, 'orange', isSlotLeft));
        break;
      case 'lemonTwist':
        rendered.push(renderPeelTwist(posX, posY, 'lemon', isSlotLeft));
        break;
      case 'orangeTwist':
        rendered.push(renderPeelTwist(posX, posY, 'orange', isSlotLeft));
        break;
      case 'limeTwist':
        rendered.push(renderPeelTwist(posX, posY, 'lime', isSlotLeft));
        break;
      case 'cherry':
        rendered.push(renderCherryOnPick(isSlotLeft ? rim.leftX : rim.rightX, posY, isSlotLeft));
        break;
      case 'olive':
        rendered.push(renderOliveOnPick(isSlotLeft ? rim.leftX : rim.rightX, posY, isSlotLeft));
        break;
      case 'mintSprig':
        rendered.push(renderMintSprig(posX, posY - 4, isSlotLeft ? 12 : -12));
        break;
      case 'pineappleWedge':
        rendered.push(renderPineappleWedge(posX, posY - 4, isSlotLeft ? -16 : 16));
        break;
    }
  });

  return rendered.join('\n');
}
