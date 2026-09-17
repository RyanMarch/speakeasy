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

  // Celery stands in the glass on its own, not perched on a rim slot, so it
  // doesn't compete with (or get squeezed out by) the rim-slot cap below —
  // it's the whole point of a Bloody Mary, not an afterthought.
  const hasCelery = text.includes('celery');

  // Smoke (a smoked glass, or a smoking gun finish) hangs as its own cloud
  // over the drink rather than perching on the rim, so it doesn't compete for
  // a rim slot either — same treatment as celery.
  const hasSmoke = text.includes('smoke');

  // Cinnamon stick is planted diagonally into the drink / resting against the rim
  const isCinnamonDust = text.includes('cinnamon dust') || text.includes('grated cinnamon') || (text.includes('cinnamon') && (text.includes('dust') || text.includes('grated')));
  const hasCinnamonStick = !isCinnamonDust && (text.includes('cinnamon stick') || text.includes('cinnamon quill') || (text.includes('cinnamon') && !text.includes('syrup') && !text.includes('sugar')));

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

  // Pickle spear is checked early (ahead of olive/onion/etc.) so it wins the
  // 2-garnish cap below on drinks that list several — it's the whole point
  // of a Pickletini, not an afterthought.
  if (text.includes('pickle')) {
    pushGarnishRepeated(garnishes, 'pickleSpear', detectGarnishCount(text, 'pickles?(?:\\s+spears?)?'));
  }

  // Olive
  if (text.includes('olive')) {
    pushGarnishRepeated(garnishes, 'olive', detectGarnishCount(text, 'olives?'));
  }

  // Cocktail Onion
  if (text.includes('onion') || text.includes('gibson onion') || text.includes('cocktail onion') || text.includes('pearl onion')) {
    pushGarnishRepeated(garnishes, 'cocktailOnion', detectGarnishCount(text, '(?:gibson |cocktail |pearl )?onions?'));
  }

  // Cherry
  if (text.includes('cherry') || text.includes('cherries') || text.includes('maraschino')) {
    pushGarnishRepeated(garnishes, 'cherry', detectGarnishCount(text, '(?:maraschino\\s+)?cherr(?:y|ies)|maraschino'));
  }

  // Cranberry
  if (text.includes('cranberr')) {
    pushGarnishRepeated(garnishes, 'cranberry', detectGarnishCount(text, 'cranberr(?:y|ies)'));
  }

  // Nutmeg / Cinnamon Dust
  if (text.includes('nutmeg') || text.includes('cinnamon dust') || text.includes('grated cinnamon') || text.includes('dusting')) {
    garnishes.push('nutmegDust');
  }

  // Cocktail Umbrella
  if (text.includes('umbrella') || text.includes('parasol')) {
    garnishes.push('cocktailUmbrella');
  }

  // Edible Flower / Orchid
  if (text.includes('orchid') || text.includes('edible flower') || text.includes('flower') || text.includes('blossom') || text.includes('pansy') || text.includes('hibiscus')) {
    garnishes.push('edibleFlower');
  }

  // Mint
  if (text.includes('mint') || text.includes('basil')) {
    garnishes.push('mintSprig');
  }

  // Rosemary
  if (text.includes('rosemary')) {
    garnishes.push('rosemarySprig');
  }

  // Thyme
  if (text.includes('thyme')) {
    garnishes.push('thymeSprig');
  }

  // Pineapple
  if (text.includes('pineapple')) {
    garnishes.push('pineappleWedge');
  }

  // Apple ("\b" word boundaries so this doesn't false-match inside "pineapple")
  if (/\bapple\b/.test(text)) {
    garnishes.push('appleSlice');
  }

  // Cucumber
  if (text.includes('cucumber')) {
    garnishes.push('cucumberSlice');
  }

  // Strawberry
  if (text.includes('strawberr')) {
    garnishes.push('strawberry');
  }

  // Jalapeño
  if (text.includes('jalapeno') || text.includes('jalapeño')) {
    garnishes.push('jalapenoSlice');
  }

  // Marshmallow
  if (text.includes('marshmallow') || text.includes('smore') || text.includes("s'more")) {
    garnishes.push('marshmallow');
  }

  // Dehydrated Citrus Wheel
  const isDehydrated = text.includes('dehydrated') || text.includes('dried wheel') || text.includes('dried citrus') || text.includes('dried lime') || text.includes('dried orange') || text.includes('dried lemon');
  if (isDehydrated) {
    garnishes.push('dehydratedCitrusWheel');
  }

  // Wheels and Slices
  if (!isDehydrated) {
    if (/lime.*(wheel|disc|slice)/.test(text) || /(wheel|disc|slice).*lime/.test(text)) {
      garnishes.push('limeWheel');
    } else if (/grapefruit.*(wheel|disc|slice)/.test(text) || /(wheel|disc|slice).*grapefruit/.test(text)) {
      garnishes.push('grapefruitWheel');
    } else if (/lemon.*(wheel|slice)/.test(text) || /wheel.*lemon/.test(text)) {
      garnishes.push('lemonWheel');
    } else if (/orange.*(wheel|slice)/.test(text) || /wheel.*orange/.test(text)) {
      garnishes.push('orangeWheel');
    }
  }

  // Wedges
  if (!isDehydrated) {
    if (text.includes('grapefruit wedge')) {
      if (!garnishes.includes('grapefruitWheel')) garnishes.push('grapefruitWedge');
    } else if (text.includes('lime wedge') || text.includes('wedge') && text.includes('lime')) {
      if (!garnishes.includes('limeWheel')) garnishes.push('limeWedge');
    } else if (text.includes('lemon wedge')) {
      if (!garnishes.includes('lemonWheel')) garnishes.push('lemonWedge');
    } else if (text.includes('orange wedge')) {
      if (!garnishes.includes('orangeWheel')) garnishes.push('orangeWedge');
    }
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
    if (text.includes('grapefruit')) garnishes.push('grapefruitWheel');
    else if (text.includes('lime')) garnishes.push('limeWheel');
    else if (text.includes('lemon')) garnishes.push('lemonWheel');
    else if (text.includes('orange')) garnishes.push('orangeTwist');
  }

  // Cocktail-pick garnishes (olive, onion, cherry, pickle) all share a single
  // physical pick (see renderCombinedPick below) instead of each claiming a
  // rim slot of their own, so they don't compete against wheels/wedges/twists
  // for the 2-slot visual cap — a martini calling for both an olive and an
  // onion should show both, speared together, not lose one to the cap. Pick
  // garnishes also keep their repeat count (e.g. "three cherries" pushed
  // 'cherry' three times above) rather than being deduped like everything
  // else, so all three end up threaded onto the pick.
  let otherSlotCount = 0;
  const seenOther = new Set();
  const capped = [];
  for (const g of garnishes) {
    if (PICK_GARNISH_TYPES.has(g)) {
      capped.push(g);
    } else if (!seenOther.has(g)) {
      seenOther.add(g);
      if (otherSlotCount < 2) {
        capped.push(g);
        otherSlotCount++;
      }
    }
  }

  // Celery, smoke, and cinnamon sticks aren't part of that cap (see above) — they're always
  // included when present.
  const result = [];
  if (hasCelery) result.push('celeryStalk');
  if (hasSmoke) result.push('smokeCloud');
  if (hasCinnamonStick) result.push('cinnamonStick');
  result.push(...capped);
  return result;
}

// Garnishes that ride on a cocktail pick rather than perching directly on the
// rim — combined onto a single shared pick by renderCombinedPick instead of
// each rendering its own separate pick.
const PICK_GARNISH_TYPES = new Set(['cherry', 'cranberry', 'olive', 'cocktailOnion', 'pickleSpear']);

// Number words a recipe might use ahead of a pick garnish's name ("three
// cherries", "double olive") so its count can carry through to the pick.
const GARNISH_COUNT_WORDS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, double: 2, triple: 3 };
// However many the recipe calls for, this many end up threaded on the shared
// pick at most — past this it reads as clutter rather than a garnish choice.
const MAX_GARNISH_REPEAT = 4;

/**
 * Looks for a quantity word/digit sitting just before a garnish noun (e.g.
 * "three cherries", "2 olives", "double onion") and returns how many of that
 * garnish the recipe is calling for. Defaults to 1 when no quantity is found.
 */
function detectGarnishCount(text, nounPattern) {
  const countWord = Object.keys(GARNISH_COUNT_WORDS).join('|');
  const re = new RegExp(`\\b(\\d+|${countWord})\\b(?:\\s+\\w+)?\\s+(?:${nounPattern})`, 'i');
  const match = text.match(re);
  if (!match) return 1;
  const token = match[1].toLowerCase();
  if (GARNISH_COUNT_WORDS[token] !== undefined) return GARNISH_COUNT_WORDS[token];
  const n = parseInt(token, 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

function pushGarnishRepeated(garnishes, type, count) {
  const clamped = Math.min(Math.max(count, 1), MAX_GARNISH_REPEAT);
  for (let i = 0; i < clamped; i++) garnishes.push(type);
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
function renderCitrusWheel(x, y, type = 'lime', angle = 4) {
  const themes = {
    lime: { rind: '#2e7d32', pith: '#dcedc8', pulp: '#7cb342', pulpDark: '#558b2f', mem: '#f1f8e9' },
    lemon: { rind: '#fbc02d', pith: '#fff9c4', pulp: '#fdd835', pulpDark: '#f57f17', mem: '#fffde7' },
    orange: { rind: '#e65100', pith: '#ffe0b2', pulp: '#fb8c00', pulpDark: '#ef6c00', mem: '#fff3e0' },
    grapefruit: { rind: '#d84315', pith: '#ffebee', pulp: '#e57373', pulpDark: '#c62828', mem: '#fff5f5' },
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
    grapefruit: { rind: '#d84315', pith: '#ffebee', pulp: '#e57373' },
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
function renderPeelTwist(x, y, type = 'lemon', isLeft = false, isFlamed = false) {
  const isOrange = type === 'orange';
  const isLime = type === 'lime';
  const peelColor = isOrange ? '#ef6c00' : isLime ? '#2e7d32' : '#fbc02d';
  const peelLight = isOrange ? '#ff9800' : isLime ? '#66bb6a' : '#fff59d';
  const peelDark = isOrange ? '#b23c00' : isLime ? '#1b5e20' : '#d49b00';
  const pithColor = isOrange ? '#ffe0b2' : isLime ? '#dcedc8' : '#fffde7';
  const sx = isLeft ? -1 : 1;
  const rot = isLeft ? -8 : 8;

  // Flamed zest char and ember sparks
  const flamedSvg = isFlamed ? `
    <!-- Charred caramelization along the crest -->
    <path
      d="M -1 -9 C 4 -12, 9 -8, 10 -1"
      stroke="#3e1a00"
      stroke-width="2.2"
      stroke-linecap="round"
      fill="none"
      opacity="0.85"
    />
    <!-- Aromatic warmth ember glow -->
    <ellipse
      class="peel-ember-glow"
      cx="4"
      cy="-6"
      rx="9"
      ry="6"
      fill="rgba(255, 145, 0, 0.45)"
    />
    <!-- Tiny micro-spark embers drifting up from the flame -->
    <g class="peel-sparks-group">
      <circle class="peel-spark peel-spark-1" cx="3" cy="-11" r="1.1" fill="#ffe082" />
      <circle class="peel-spark peel-spark-2" cx="7" cy="-8" r="0.85" fill="#ffb74d" />
      <circle class="peel-spark peel-spark-3" cx="1" cy="-14" r="0.95" fill="#ffd54f" />
    </g>
  ` : '';

  return `
    <g class="garnish garnish-${type}-twist${isFlamed ? ' garnish-flamed-twist' : ''}" transform="translate(${x.toFixed(1)}, ${y.toFixed(1)}) rotate(${rot}) scale(${sx}, 1)" pointer-events="none">
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

      <!-- Flamed peel warm glow & ember sparks (if flamed) -->
      ${flamedSvg}

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
 * Local-origin fruit/veg shapes for the items threaded onto a shared cocktail
 * pick (see renderCombinedPick) — the same artwork as the standalone
 * render*OnPick functions above, minus their own shaft/knob, since a combined
 * pick draws one shaft for every item strung on it.
 */
function cherryPickShape() {
  return `
    <path d="M 0 -8 C -3 -16, -2 -22, -8 -25" stroke="#4e342e" stroke-width="1.2" fill="none" stroke-linecap="round" />
    <circle cx="0" cy="0" r="10.5" fill="#7b112b" />
    <ellipse cx="-1" cy="3" rx="7" ry="5" fill="#4a0014" opacity="0.6" />
    <ellipse cx="3" cy="-3" rx="3.2" ry="1.8" fill="rgba(255, 255, 255, 0.65)" transform="rotate(-20 3 -3)" />
    <circle cx="1" cy="-4" r="1" fill="rgba(255, 255, 255, 0.45)" />
  `;
}

function cranberryPickShape() {
  return `
    <!-- Distinctive slightly oblong / firm barrel-shaped berry silhouette with matte crimson skin -->
    <ellipse cx="0" cy="0" rx="9" ry="11" fill="#b71c1c" />
    <ellipse cx="-0.5" cy="0" rx="8.2" ry="10.2" fill="#c62828" />

    <!-- Subdued firm shading (matte skin, avoiding cherry's syrupy glossy high sheen) -->
    <ellipse cx="-1" cy="3.5" rx="6.5" ry="6" fill="#880e4f" opacity="0.5" />
    <ellipse cx="0" cy="5" rx="5" ry="3.5" fill="#4a0014" opacity="0.4" />

    <!-- Satin specular crescent (subtle waxy bloom, soft highlight rather than high-gloss hotspot) -->
    <path d="M -4.5 -4 C -5.5 0, -4.5 4, -2.5 7" stroke="rgba(255, 220, 225, 0.45)" stroke-width="1.4" stroke-linecap="round" fill="none" />

    <!-- Iconic 4-lobed / 5-point persistent calyx crown (blossom-end star scar, unique to cranberries) -->
    <g transform="translate(0, -9.2)">
      <circle cx="0" cy="0" r="2.2" fill="#3e1319" />
      <path d="M 0 -2.6 L 0.7 -1.2 L 2.2 -1.2 L 1.0 -0.2 L 1.5 1.2 L 0 0.4 L -1.5 1.2 L -1.0 -0.2 L -2.2 -1.2 L -0.7 -1.2 Z" fill="#260b10" />
      <circle cx="0" cy="0" r="0.7" fill="#581b23" />
    </g>
  `;
}

function olivePickShape() {
  return `
    <ellipse cx="0" cy="0" rx="12" ry="17.5" fill="#2e4215" opacity="0.6" />
    <ellipse cx="-0.5" cy="0" rx="11.2" ry="16.5" fill="#689f38" />
    <path d="M -6.5 3 C -8 8, -5 12, -2 13.5" stroke="rgba(255, 255, 255, 0.62)" stroke-width="1.8" stroke-linecap="round" fill="none" />
    <ellipse cx="0" cy="-4.5" rx="4.8" ry="3.5" fill="#b71c1c" />
    <ellipse cx="0" cy="-4.5" rx="3" ry="2" fill="#d32f2f" />
    <circle cx="1" cy="-5.2" r="0.8" fill="#ffffff" opacity="0.8" />
  `;
}

function onionPickShape() {
  return `
    <circle cx="0" cy="0" r="13" fill="#37474f" opacity="0.35" />
    <circle cx="-0.5" cy="0" r="12" fill="#f8fafc" />
    <ellipse cx="0" cy="0" rx="10" ry="11.5" fill="#f1f5f9" />
    <ellipse cx="-0.5" cy="0" rx="7.5" ry="9" fill="none" stroke="#e2e8f0" stroke-width="1.2" opacity="0.9" />
    <ellipse cx="-0.5" cy="0" rx="4.5" ry="6" fill="none" stroke="#cbd5e1" stroke-width="1" opacity="0.85" />
    <ellipse cx="-0.5" cy="0" rx="2" ry="3.2" fill="#94a3b8" opacity="0.7" />
    <path d="M -2 11.5 Q 0 13.5 2 11.5" stroke="#94a3b8" stroke-width="1.2" fill="none" stroke-linecap="round" />
    <path d="M -6 -5 C -7 -1, -5 4, -2 6" stroke="rgba(255, 255, 255, 0.85)" stroke-width="1.8" stroke-linecap="round" fill="none" />
    <circle cx="3" cy="-5" r="1.2" fill="#ffffff" opacity="0.9" />
  `;
}

function picklePickShape() {
  return `
    <ellipse cx="0" cy="3" rx="11" ry="28" fill="#2e4215" opacity="0.5" />
    <rect x="-9.5" y="-25" width="19" height="50" rx="9.5" fill="#4c7a1f" />
    <rect x="-9.5" y="-25" width="19" height="50" rx="9.5" fill="none" stroke="#33500f" stroke-width="1" />
    <circle cx="-4.5" cy="-15" r="1.5" fill="#33500f" opacity="0.55" />
    <circle cx="5" cy="-6" r="1.5" fill="#33500f" opacity="0.55" />
    <circle cx="-5" cy="4" r="1.5" fill="#33500f" opacity="0.55" />
    <circle cx="4.5" cy="14" r="1.5" fill="#33500f" opacity="0.55" />
    <circle cx="-3" cy="20" r="1.3" fill="#33500f" opacity="0.55" />
    <ellipse cx="0" cy="-24" rx="8.5" ry="3.4" fill="#8bc34a" />
    <ellipse cx="0" cy="-24" rx="5.2" ry="2" fill="#c5e1a5" opacity="0.85" />
    <path d="M -5.5 -16 C -7.5 -5, -7 8, -5 19" stroke="rgba(255, 255, 255, 0.4)" stroke-width="2" stroke-linecap="round" fill="none" />
  `;
}

// Roughly half the along-shaft length of each item's artwork, used to space
// items on a shared pick — a pickle spear needs much more berth than a
// cherry or a pearl onion. Items sit touching (no gap), like fruit actually
// pressed together on a real cocktail pick.
const PICK_ITEM_HALF_LENGTH = { cherry: 12, cranberry: 11, olive: 18, cocktailOnion: 13, pickleSpear: 27 };
const PICK_ITEM_SHAPE_RENDERERS = {
  cherry: cherryPickShape,
  cranberry: cranberryPickShape,
  olive: olivePickShape,
  cocktailOnion: onionPickShape,
  pickleSpear: picklePickShape,
};

// How far from the rim contact point the first item starts, and the shaft's
// tail past the last item.
const PICK_START_DISTANCE = 14;
const PICK_TAIL_DISTANCE = 6;
// The shaft can reach this far into the glass before it starts crossing out
// through the glass's own sloped walls (a martini's V narrows fast — this
// matches how far a single pickle spear, the longest single item, already
// reached safely). Stacking more items shrinks them to fit within this same
// reach rather than pushing the pick further in.
const PICK_MAX_REACH = 88;
const PICK_MIN_SCALE = 0.45;

/**
 * Render every pick-riding garnish (olive, cocktail onion, cherry, pickle
 * spear) threaded onto a single shared cocktail pick, rather than each type
 * getting its own separate pick — a Gibson's onion and a Dirty Martini's
 * olive read as one garnish choice on one pick, not two picks competing for
 * rim space. Items are packed touching each other and shrunk just enough
 * (never below PICK_MIN_SCALE) that the whole pick still fits inside the
 * glass no matter how many garnishes are threaded onto it.
 */
function renderCombinedPick(rimX, rimY, isLeft, itemTypes) {
  const sx = isLeft ? 1 : -1;
  const contactX = rimX + (2 * sx);
  const contactY = rimY;

  // Same ~32-degree insertion angle the individual pick garnishes used, so a
  // combined pick reads identically to the single-item ones it replaces.
  const angle = (32 * Math.PI) / 180;
  const dirX = Math.cos(angle) * sx;
  const dirY = Math.sin(angle);
  const pointAt = (d) => ({ x: contactX + dirX * d, y: contactY + dirY * d });

  const rawSpan = itemTypes.reduce((sum, type) => sum + 2 * (PICK_ITEM_HALF_LENGTH[type] ?? 15), 0);
  const available = PICK_MAX_REACH - PICK_START_DISTANCE - PICK_TAIL_DISTANCE;
  const scale = rawSpan > 0 ? Math.max(PICK_MIN_SCALE, Math.min(1, available / rawSpan)) : 1;

  let cursor = PICK_START_DISTANCE;
  const itemDistances = itemTypes.map((type) => {
    const half = (PICK_ITEM_HALF_LENGTH[type] ?? 15) * scale;
    const d = cursor + half;
    cursor += 2 * half;
    return d;
  });

  const knob = pointAt(-18);
  const tip = pointAt(cursor + PICK_TAIL_DISTANCE);
  const rot = 32 * sx;

  const itemsSvg = itemTypes.map((type, i) => {
    const p = pointAt(itemDistances[i]);
    const shapeFn = PICK_ITEM_SHAPE_RENDERERS[type];
    if (!shapeFn) return '';
    return `<g transform="translate(${p.x.toFixed(1)}, ${p.y.toFixed(1)}) rotate(${rot}) scale(${scale.toFixed(2)})">${shapeFn()}</g>`;
  }).join('');

  return `
    <g class="garnish garnish-combined-pick" pointer-events="none">
      <!-- Shared cocktail pick shaft resting across rim -->
      <line
        x1="${knob.x.toFixed(1)}"
        y1="${knob.y.toFixed(1)}"
        x2="${tip.x.toFixed(1)}"
        y2="${tip.y.toFixed(1)}"
        stroke="#cfd8dc"
        stroke-width="2.1"
        stroke-linecap="round"
      />
      <!-- Pick top knob handle -->
      <circle cx="${knob.x.toFixed(1)}" cy="${knob.y.toFixed(1)}" r="3.4" fill="#90a4ae" stroke="#607d8b" stroke-width="0.8" />
      ${itemsSvg}
    </g>
  `;
}

/**
 * Render fresh mint sprig with generous bouquet
 */
function renderMintSprig(x, y, angle = -12) {
  // The tallest leaf reaches 66 above the anchor; on a short-rimmed glass (a
  // highball's rim sits only ~52 above the SVG's own top edge) that overshoots
  // the canvas and gets clipped. Scale down (never below 0.55, so it doesn't
  // vanish) whenever the anchor doesn't have that much headroom above it —
  // full-size on roomier glasses, shorter but intact on tight ones.
  const maxReach = 66;
  const margin = 6;
  const scale = Math.max(0.55, Math.min(1, (y - margin) / maxReach));
  return `
    <g class="garnish garnish-mint" transform="translate(${x.toFixed(1)}, ${y.toFixed(1)}) rotate(${angle}) scale(${scale.toFixed(2)})" pointer-events="none">
      <!-- Mint stem extending down into the glass interior & curving over rim -->
      <path d="M 0 -10 Q -2 14, -7 38" stroke="#256029" stroke-width="3.6" stroke-linecap="round" fill="none" />
      <path d="M -0.5 -10 Q -2.5 14, -7.5 38" stroke="#388e3c" stroke-width="1.6" stroke-linecap="round" fill="none" opacity="0.6" />

      <!-- Stem rim clasp / shadow accent -->
      <ellipse cx="-1" cy="4" rx="3" ry="1.5" fill="rgba(0, 0, 0, 0.25)" />

      <!-- Back leaf (deep shadow/depth) -->
      <path d="M -2 -4 C -22 -14, -30 -36, -18 -52 C -4 -42, 0 -18, -2 -4 Z" fill="#1b5e20" opacity="0.9" />
      <path d="M -2 -4 Q -14 -28 -18 -50" stroke="#4caf50" stroke-width="1.2" fill="none" opacity="0.6" />

      <!-- Left spreading broad leaf -->
      <path d="M -1 -2 C -24 -2, -38 -20, -32 -40 C -14 -36, -5 -14, -1 -2 Z" fill="#2e7d32" />
      <path d="M -1 -2 Q -18 -16 -32 -39" stroke="#81c784" stroke-width="1.4" fill="none" opacity="0.8" />
      <path d="M -11 -9 Q -18 -10 -24 -14 M -6 -2 Q -12 -5 -18 -8 M -16 -17 Q -22 -20 -27 -25" stroke="#a5d6a7" stroke-width="0.9" fill="none" opacity="0.65" />

      <!-- Right spreading leaf -->
      <path d="M 1 0 C 26 -4, 42 -22, 34 -44 C 18 -40, 6 -14, 1 0 Z" fill="#388e3c" />
      <path d="M 1 0 Q 18 -14 34 -43" stroke="#a5d6a7" stroke-width="1.4" fill="none" opacity="0.85" />
      <path d="M 11 -8 Q 18 -10 25 -15 M 6 -2 Q 13 -5 20 -9 M 17 -17 Q 23 -21 28 -27" stroke="#c8e6c9" stroke-width="0.9" fill="none" opacity="0.7" />

      <!-- Central dominant crown leaf -->
      <path d="M 0 -6 C -16 -24, -10 -58, 0 -66 C 10 -58, 16 -24, 0 -6 Z" fill="#43a047" />
      <path d="M 0 -6 L 0 -64" stroke="#c8e6c9" stroke-width="1.5" fill="none" opacity="0.9" />
      <path d="M 0 -20 L -6 -28 M 0 -20 L 6 -28 M 0 -36 L -5 -43 M 0 -36 L 5 -43 M 0 -50 L -4 -55 M 0 -50 L 4 -55" stroke="#e8f5e9" stroke-width="0.9" fill="none" opacity="0.75" />

      <!-- Mid-foreground leaf for depth and lushness -->
      <path d="M 0 0 C -12 -10, -10 -30, 2 -34 C 10 -26, 8 -8, 0 0 Z" fill="#4caf50" />
      <path d="M 0 0 Q 0 -16 2 -33" stroke="#c8e6c9" stroke-width="1.1" fill="none" opacity="0.85" />

      <!-- Front budding tender leaf -->
      <path d="M 0 1 C -8 -6, -6 -20, 0 -24 C 6 -20, 8 -6, 0 1 Z" fill="#66bb6a" opacity="0.98" />
      <path d="M 0 1 L 0 -22" stroke="#e8f5e9" stroke-width="0.9" fill="none" opacity="0.85" />
    </g>
  `;
}

/**
 * Render a fresh sprig of rosemary perched on the glass rim with needle-like leaves
 */
function renderRosemarySprig(x, y, angle = -8) {
  const maxReach = 64;
  const margin = 6;
  const scale = Math.max(0.55, Math.min(1, (y - margin) / maxReach));

  return `
    <g class="garnish garnish-rosemary" transform="translate(${x.toFixed(1)}, ${y.toFixed(1)}) rotate(${angle}) scale(${scale.toFixed(2)})" pointer-events="none">
      <!-- Woody lower stem extending down inside the glass -->
      <path d="M 0 -8 Q -1 14, -5 36" stroke="#4a3728" stroke-width="3.2" stroke-linecap="round" fill="none" />
      <path d="M -0.4 -8 Q -1.4 14, -5.4 36" stroke="#6d543e" stroke-width="1.4" stroke-linecap="round" fill="none" opacity="0.65" />

      <!-- Stem rim clasp shadow -->
      <ellipse cx="-1" cy="3" rx="3.2" ry="1.6" fill="rgba(0, 0, 0, 0.28)" />

      <!-- Upper woody/greenish stem -->
      <path d="M 0 4 Q 0 -28, 0 -60" stroke="#334626" stroke-width="2.6" stroke-linecap="round" fill="none" />
      <path d="M 0.3 4 Q 0.3 -28, 0.3 -60" stroke="#4a6336" stroke-width="1.2" stroke-linecap="round" fill="none" opacity="0.7" />

      <!-- Dense tiers of needle leaves angled upward (background darker layer) -->
      <!-- Tier 1: lower-mid needles -->
      <path d="M -1 -2 Q -12 -5, -22 -10" stroke="#1e381b" stroke-width="2.4" stroke-linecap="round" fill="none" />
      <path d="M 1 -1 Q 12 -4, 21 -9" stroke="#1e381b" stroke-width="2.4" stroke-linecap="round" fill="none" />

      <!-- Tier 2: mid needles -->
      <path d="M -1 -12 Q -14 -18, -24 -24" stroke="#234220" stroke-width="2.2" stroke-linecap="round" fill="none" />
      <path d="M 1 -11 Q 14 -17, 23 -23" stroke="#234220" stroke-width="2.2" stroke-linecap="round" fill="none" />

      <!-- Tier 3: upper-mid needles -->
      <path d="M -1 -22 Q -13 -32, -22 -40" stroke="#284b25" stroke-width="2.1" stroke-linecap="round" fill="none" />
      <path d="M 1 -21 Q 13 -31, 22 -39" stroke="#284b25" stroke-width="2.1" stroke-linecap="round" fill="none" />

      <!-- Tier 4: high needles -->
      <path d="M -0.8 -33 Q -11 -45, -18 -54" stroke="#2d552a" stroke-width="2.0" stroke-linecap="round" fill="none" />
      <path d="M 0.8 -32 Q 11 -44, 18 -53" stroke="#2d552a" stroke-width="2.0" stroke-linecap="round" fill="none" />

      <!-- Foreground & highlight needle layers (finer needle highlights & leafy crown) -->
      <!-- Tier 1 foreground highlights -->
      <path d="M -0.8 -3 Q -11 -6, -21 -11" stroke="#3d6b38" stroke-width="1.3" stroke-linecap="round" fill="none" />
      <path d="M 0.8 -2 Q 11 -5, 20 -10" stroke="#4c7e46" stroke-width="1.3" stroke-linecap="round" fill="none" />

      <!-- Tier 2 foreground highlights -->
      <path d="M -0.8 -13 Q -13 -19, -23 -25" stroke="#4c7e46" stroke-width="1.2" stroke-linecap="round" fill="none" />
      <path d="M 0.8 -12 Q 13 -18, 22 -24" stroke="#5c9354" stroke-width="1.2" stroke-linecap="round" fill="none" />

      <!-- Tier 3 foreground highlights -->
      <path d="M -0.8 -23 Q -12 -33, -21 -41" stroke="#5c9354" stroke-width="1.2" stroke-linecap="round" fill="none" />
      <path d="M 0.8 -22 Q 12 -32, 21 -40" stroke="#6fa966" stroke-width="1.2" stroke-linecap="round" fill="none" />

      <!-- Tier 4 foreground highlights -->
      <path d="M -0.6 -34 Q -10 -46, -17 -55" stroke="#6fa966" stroke-width="1.1" stroke-linecap="round" fill="none" />
      <path d="M 0.6 -33 Q 10 -45, 17 -54" stroke="#82bf79" stroke-width="1.1" stroke-linecap="round" fill="none" />

      <!-- Upright crown tip cluster -->
      <path d="M -0.5 -44 Q -6 -54, -10 -63" stroke="#5c9354" stroke-width="1.7" stroke-linecap="round" fill="none" />
      <path d="M 0.5 -44 Q 6 -54, 10 -63" stroke="#6fa966" stroke-width="1.7" stroke-linecap="round" fill="none" />
      <path d="M 0 -48 L 0 -64" stroke="#82bf79" stroke-width="1.8" stroke-linecap="round" fill="none" />
      <path d="M 0 -54 L 0 -65" stroke="#a5d6a7" stroke-width="0.9" stroke-linecap="round" fill="none" />
    </g>
  `;
}

/**
 * Render a Bloody Mary-style celery stalk standing tall out of the drink
 */
let celeryInstanceCounter = 0;

function renderCeleryStalk(x, y, angle = -4, glassBottomY = null) {
  // Stalk spans from the actual bottom of the glass (so it reads as planted
  // the full depth of the drink, not just dipped below the surface) up to a
  // fixed distance above the rim. glassBottomY is in the same absolute SVG
  // coordinate space as y (the anchor); everything else here is relative to
  // that anchor, so it's converted once up front.
  const bottom = glassBottomY !== null ? (glassBottomY - y) : 16;
  const top = -190;
  // Original design was authored for a bottom/top of 16/-118 (range 134); this
  // interpolates every other control point proportionally so the same taper
  // and leaf shape hold at any length.
  const at = (origY) => (bottom + (origY - 16) * ((top - bottom) / -134)).toFixed(1);
  const stalkPathD = `M -8 ${bottom.toFixed(1)} C -9 ${at(-30)}, -8 ${at(-82)}, -3 ${top} L 9 ${top} C 6 ${at(-82)}, 8 ${at(-30)}, 8 ${bottom.toFixed(1)} Z`;
  // Local y 0 is the anchor, which callers set to the liquid surface — so
  // everything from 0 down to `bottom` is the submerged portion.
  const clipId = `celery-clip-${celeryInstanceCounter++}`;

  return `
    <g class="garnish garnish-celery" transform="translate(${x.toFixed(1)}, ${y.toFixed(1)}) rotate(${angle})" pointer-events="none">
      <defs>
        <clipPath id="${clipId}">
          <path d="${stalkPathD}" />
        </clipPath>
      </defs>

      <!-- Cast shadow where the stalk plunges into the drink -->
      <ellipse cx="0" cy="${(bottom - 6).toFixed(1)}" rx="9" ry="3.5" fill="rgba(0, 0, 0, 0.3)" />

      <!-- Ribbed stalk body, planted at the bottom of the glass and standing tall above the rim -->
      <path d="${stalkPathD}" fill="#aed581" stroke="#7cb342" stroke-width="1" />
      <!-- Concave channel highlight running the length of the stalk -->
      <path d="M -1.5 ${(bottom - 4).toFixed(1)} C -3 ${at(-30)}, -1.5 ${at(-78)}, 1.5 ${(top + 4)}" stroke="#dcedc8" stroke-width="3" stroke-linecap="round" fill="none" opacity="0.85" />
      <!-- Fiber ridge lines -->
      <line x1="-4.5" y1="${(bottom - 8).toFixed(1)}" x2="-3" y2="${(top + 12)}" stroke="#8bc34a" stroke-width="0.9" opacity="0.7" />
      <line x1="4.5" y1="${(bottom - 8).toFixed(1)}" x2="5.5" y2="${(top + 12)}" stroke="#8bc34a" stroke-width="0.9" opacity="0.7" />

      <!-- Submerged tint: darken/mute the portion below the liquid surface so it
           reads as seen through the drink rather than floating on top of it. -->
      <rect x="-10" y="0" width="20" height="${bottom.toFixed(1)}" fill="rgba(15, 20, 10, 0.45)" clip-path="url(#${clipId})" />

      <!-- Leafy top fronds (above the surface, unaffected by the tint) -->
      <path d="M -1.5 ${top + 4} C -15 ${top - 11}, -21 ${top - 29}, -12 ${top - 44} C -4 ${top - 29}, -1.5 ${top - 11}, 0 ${top + 4} Z" fill="#689f38" />
      <path d="M 1.5 ${top + 1} C 12 ${top - 17}, 21 ${top - 32}, 33 ${top - 38} C 27 ${top - 20}, 12 ${top - 5}, 3 ${top + 4} Z" fill="#7cb342" />
      <path d="M 0 ${top + 1} C -3 ${top - 20}, 0 ${top - 38}, 6 ${top - 53} C 10.5 ${top - 35}, 9 ${top - 14}, 4.5 ${top + 4} Z" fill="#558b2f" />
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

let smokeInstanceCounter = 0;

/**
 * Render swirling waves and clouds of smoke emanating from the liquid level
 * and rising up out of the glass before fading away.
 */
function renderSmokeCloud(cx, rimY, liquidY) {
  const filterId = `smoke-blur-${smokeInstanceCounter++}`;
  const maskId = `smoke-fade-mask-${smokeInstanceCounter}`;
  const startY = typeof liquidY === 'number' && !isNaN(liquidY) ? liquidY : rimY + 10;

  // Wave ribbons rising up from liquid surface and curling gracefully past rim
  // Kept within rimY - 58 so they naturally dissipate well below the viewBox boundary
  const waveRibbons = [
    {
      d: `M ${cx - 20} ${startY} C ${cx - 34} ${startY - 14}, ${cx - 8} ${rimY - 10}, ${cx - 22} ${rimY - 32} S ${cx - 10} ${rimY - 48}, ${cx - 18} ${rimY - 56}`,
      width: 11.5,
      opacity: 0.33,
      variant: 1,
    },
    {
      d: `M ${cx} ${startY + 2} C ${cx + 15} ${startY - 12}, ${cx - 16} ${rimY - 14}, ${cx + 8} ${rimY - 36} S ${cx - 4} ${rimY - 50}, ${cx + 4} ${rimY - 58}`,
      width: 13.5,
      opacity: 0.38,
      variant: 2,
    },
    {
      d: `M ${cx + 18} ${startY} C ${cx + 30} ${startY - 14}, ${cx + 4} ${rimY - 8}, ${cx + 20} ${rimY - 30} S ${cx + 10} ${rimY - 46}, ${cx + 16} ${rimY - 54}`,
      width: 11,
      opacity: 0.31,
      variant: 3,
    },
  ];

  // Billowing cloud puffs floating, diffusing, and fading away gently as they ascend
  const clouds = [
    // Low mist settling right above liquid level
    { cx: cx - 14, cy: startY - 4, rx: 21, ry: 8, opacity: 0.27, variant: 1 },
    { cx: cx + 12, cy: startY - 2, rx: 23, ry: 9, opacity: 0.30, variant: 2 },
    // Mid-level swirls around and above the rim
    { cx: cx - 12, cy: rimY - 12, rx: 25, ry: 11, opacity: 0.36, variant: 2 },
    { cx: cx + 14, cy: rimY - 18, rx: 28, ry: 12, opacity: 0.34, variant: 3 },
    { cx: cx - 2, cy: rimY - 28, rx: 26, ry: 11, opacity: 0.29, variant: 1 },
    // Upper puffs dissipating cleanly before reaching the top
    { cx: cx + 8, cy: rimY - 40, rx: 27, ry: 12, opacity: 0.22, variant: 2 },
    { cx: cx - 8, cy: rimY - 48, rx: 23, ry: 10, opacity: 0.14, variant: 3 },
    { cx: cx + 2, cy: rimY - 54, rx: 19, ry: 8, opacity: 0.08, variant: 1 },
  ];

  return `
    <g class="garnish garnish-smoke" pointer-events="none">
      <defs>
        <filter id="${filterId}" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="4.5" />
        </filter>
        <!-- Soft vertical fade mask ensuring the smoke feather-fades to 0% at the top with no hard crop -->
        <linearGradient id="${maskId}" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stop-color="#fff" stop-opacity="1" />
          <stop offset="75%" stop-color="#fff" stop-opacity="0.9" />
          <stop offset="90%" stop-color="#fff" stop-opacity="0.35" />
          <stop offset="100%" stop-color="#fff" stop-opacity="0" />
        </linearGradient>
        <mask id="${maskId}-apply">
          <rect x="${cx - 80}" y="${rimY - 80}" width="160" height="${startY - (rimY - 80) + 20}" fill="url(#${maskId})" />
        </mask>
      </defs>

      <!-- Smoke mass with soft blur and gradual upward fade mask -->
      <g mask="url(#${maskId}-apply)" filter="url(#${filterId})">
        <!-- Rising wave ribbons -->
        ${waveRibbons.map(w => `
          <path
            class="garnish-smoke-wave garnish-smoke-wave-${w.variant}"
            d="${w.d}"
            fill="none"
            stroke="rgba(226, 230, 240, ${w.opacity})"
            stroke-width="${w.width}"
            stroke-linecap="round"
          />
        `).join('')}

        <!-- Billowing cloud puffs -->
        ${clouds.map(c => `
          <ellipse
            class="garnish-smoke-puff garnish-smoke-puff-${c.variant}"
            cx="${c.cx.toFixed(1)}"
            cy="${c.cy.toFixed(1)}"
            rx="${c.rx}"
            ry="${c.ry}"
            fill="rgba(230, 234, 245, ${c.opacity})"
          />
        `).join('')}
      </g>

      <!-- Subtle shimmering highlight wafting across the smoke crest -->
      <ellipse
        class="garnish-smoke-shimmer"
        cx="${cx.toFixed(1)}"
        cy="${(rimY - 20).toFixed(1)}"
        rx="28"
        ry="14"
        fill="rgba(255, 255, 255, 0.32)"
        filter="url(#${filterId})"
      />
    </g>
  `;
}

/**
 * Render delicate, wispy, vertical steam tendrils rising from a hot beverage.
 * Visibly thinner than smoke ribbons, wafting much higher upward, and dissolving smoothly.
 */
let steamInstanceCounter = 0;

export function renderSteamVapor(cx, rimY, liquidY) {
  const filterId = `steam-blur-${steamInstanceCounter++}`;
  const maskId = `steam-fade-mask-${steamInstanceCounter}`;
  const startY = typeof liquidY === 'number' && !isNaN(liquidY) ? liquidY : rimY + 8;

  // Multiple layered wisps that ascend vertically in staggered streams
  const wisps = [
    {
      // Stream 1: left stream, primary wave
      d: `M ${cx - 16} ${startY + 6} C ${cx - 24} ${startY - 18}, ${cx - 8} ${rimY - 15}, ${cx - 18} ${rimY - 45} S ${cx - 6} ${rimY - 78}, ${cx - 14} ${rimY - 96}`,
      width: 2.4,
      opacity: 0.40,
      variant: 1,
    },
    {
      // Stream 2: left stream, follow-up wave (staggered for seamless continuity)
      d: `M ${cx - 13} ${startY + 12} C ${cx - 20} ${startY - 12}, ${cx - 10} ${rimY - 12}, ${cx - 16} ${rimY - 42} S ${cx - 8} ${rimY - 74}, ${cx - 12} ${rimY - 90}`,
      width: 1.8,
      opacity: 0.32,
      variant: 4,
    },
    {
      // Stream 3: central stream, rising tallest
      d: `M ${cx} ${startY + 8} C ${cx + 8} ${startY - 20}, ${cx - 10} ${rimY - 20}, ${cx + 8} ${rimY - 52} S ${cx - 6} ${rimY - 86}, ${cx + 4} ${rimY - 106}`,
      width: 2.8,
      opacity: 0.46,
      variant: 2,
    },
    {
      // Stream 4: central stream, secondary wave
      d: `M ${cx + 2} ${startY + 16} C ${cx + 10} ${startY - 14}, ${cx - 8} ${rimY - 16}, ${cx + 6} ${rimY - 48} S ${cx - 4} ${rimY - 80}, ${cx + 2} ${rimY - 98}`,
      width: 2.0,
      opacity: 0.36,
      variant: 5,
    },
    {
      // Stream 5: right stream
      d: `M ${cx + 15} ${startY + 6} C ${cx + 22} ${startY - 16}, ${cx + 6} ${rimY - 14}, ${cx + 18} ${rimY - 46} S ${cx + 8} ${rimY - 76}, ${cx + 14} ${rimY - 95}`,
      width: 2.2,
      opacity: 0.38,
      variant: 3,
    },
  ];

  return `
    <g class="garnish garnish-steam" pointer-events="none">
      <defs>
        <filter id="${filterId}" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="2.4" />
        </filter>
        <!-- Vertical fade mask: allows steam to emerge smoothly from the liquid and cleanly evaporate into air -->
        <linearGradient id="${maskId}" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stop-color="#fff" stop-opacity="0.05" />
          <stop offset="20%" stop-color="#fff" stop-opacity="0.85" />
          <stop offset="65%" stop-color="#fff" stop-opacity="0.80" />
          <stop offset="85%" stop-color="#fff" stop-opacity="0.25" />
          <stop offset="100%" stop-color="#fff" stop-opacity="0" />
        </linearGradient>
        <mask id="${maskId}-apply">
          <rect x="${cx - 70}" y="${rimY - 125}" width="140" height="${startY - (rimY - 125) + 20}" fill="url(#${maskId})" />
        </mask>
      </defs>

      <!-- Wispy steam ribbons masked for vertical dissipation -->
      <g mask="url(#${maskId}-apply)" filter="url(#${filterId})">
        ${wisps.map(w => `
          <path
            class="garnish-steam-wisp garnish-steam-wisp-${w.variant}"
            d="${w.d}"
            fill="none"
            stroke="rgba(255, 255, 255, ${w.opacity})"
            stroke-width="${w.width}"
            stroke-linecap="round"
          />
        `).join('')}
      </g>
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
 * Render an apple wedge straddling the rim, structured like renderCitrusWedge
 * but reskinned: pale cream flesh, a red skin arc, and a couple of pips.
 */
function renderAppleSlice(x, y, isLeft = false) {
  const sx = isLeft ? -1 : 1;
  const rot = isLeft ? -6 : 6;

  return `
    <g class="garnish garnish-apple" transform="translate(${x.toFixed(1)}, ${y.toFixed(1)}) rotate(${rot}) scale(${sx}, 1)" pointer-events="none">
      <!-- Outer red skin arc -->
      <path
        d="M -19 5 C -19 -14, -10 -22, 0 -22 C 10 -22, 19 -14, 19 5 L 16 6 C 16 -11, 8 -19, 0 -19 C -8 -19, -16 -11, -16 6 Z"
        fill="#c62828"
      />
      <!-- Pale flesh underlayer -->
      <path
        d="M -16 6 C -16 -11, -8 -19, 0 -19 C 8 -19, 16 -11, 16 6 L 14 6.5 C 14 -8.5, 7 -16.5, 0 -16.5 C -7 -16.5, -14 -8.5, -14 6.5 Z"
        fill="#f5f0dc"
      />
      <!-- Flesh body -->
      <path
        d="M -14 6.5 C -14 -8.5, -7 -16.5, 0 -16.5 C 7 -16.5, 14 -8.5, 14 6.5 L 1 5.5 L 0 -6 L -1 5.5 Z"
        fill="#faf6e6"
      />
      <!-- Core line and seeds -->
      <line x1="0" y1="-6" x2="0" y2="5" stroke="#c9b98a" stroke-width="0.8" opacity="0.7" />
      <ellipse cx="-2.4" cy="1" rx="1.6" ry="2.6" fill="#4e342e" transform="rotate(-18 -2.4 1)" />
      <ellipse cx="2.4" cy="1" rx="1.6" ry="2.6" fill="#4e342e" transform="rotate(18 2.4 1)" />
      <!-- Rim notch shadow -->
      <line x1="0" y1="6.5" x2="0" y2="-6" stroke="rgba(0,0,0,0.4)" stroke-width="1.4" />
    </g>
  `;
}

/**
 * Render a cucumber wheel, structured like renderCitrusWheel but reskinned:
 * dark rind, pale seedless-cucumber flesh, and scattered soft seeds instead
 * of radial citrus segments.
 */
function renderCucumberSlice(x, y, angle = 1) {
  const seeds = [
    { dx: -6, dy: -3 }, { dx: -2, dy: 5 }, { dx: 4, dy: -5 },
    { dx: 6, dy: 3 }, { dx: 0, dy: -1 }, { dx: -5, dy: 6 },
  ];
  return `
    <g class="garnish garnish-cucumber" transform="translate(${x.toFixed(1)}, ${y.toFixed(1)}) rotate(${angle})" pointer-events="none">
      <circle cx="0" cy="0" r="21" fill="#33691e" />
      <circle cx="0" cy="0" r="18.5" fill="#dcedc8" />
      <circle cx="0" cy="0" r="15.5" fill="#c5e8a8" />
      ${seeds.map(s => `<ellipse cx="${s.dx}" cy="${s.dy}" rx="1.6" ry="0.9" fill="#f1f8e9" opacity="0.9" />`).join('')}
      <circle cx="0" cy="0" r="3" fill="#eef7e0" opacity="0.85" />
      <!-- Rim notch illusion -->
      <line x1="0" y1="2" x2="0" y2="21" stroke="rgba(0,0,0,0.3)" stroke-width="1.2" />
    </g>
  `;
}

/**
 * Render a whole strawberry perched on the rim with a slotted incision,
 * seed achenes, and leafy green hull calyx.
 */
function renderStrawberry(x, y, isLeft = false) {
  const sx = isLeft ? -1 : 1;
  const rot = isLeft ? -10 : 10;
  const seeds = [
    { x: -5, y: -9 }, { x: 0, y: -10 }, { x: 5, y: -9 },
    { x: -9, y: -3 }, { x: -3, y: -3 }, { x: 3, y: -3 }, { x: 9, y: -3 },
    { x: -8, y: 3 }, { x: -2, y: 4 }, { x: 4, y: 4 }, { x: 8, y: 3 },
    { x: -5, y: 9 }, { x: 1, y: 10 }, { x: 6, y: 9 },
    { x: -2, y: 15 }, { x: 2, y: 15 },
    { x: 0, y: 19 },
  ];

  return `
    <g class="garnish garnish-strawberry" transform="translate(${x.toFixed(1)}, ${y.toFixed(1)}) rotate(${rot}) scale(${sx}, 1)" pointer-events="none">
      <!-- Shadow accent behind berry -->
      <path d="M 0 -14 C -17 -14, -18 6, 0 24 C 18 6, 17 -14, 0 -14 Z" fill="#780616" opacity="0.4" />
      <!-- Main berry body -->
      <path d="M 0 -14 C -16 -14, -17 5, 0 23 C 17 5, 16 -14, 0 -14 Z" fill="#d31932" />
      <!-- Highlight sheen along shoulder -->
      <path d="M -12 -8 C -14 0, -10 10, -2 17" stroke="rgba(255, 255, 255, 0.45)" stroke-width="2.2" stroke-linecap="round" fill="none" />
      <!-- Strawberry seeds (achenes) with shadow recess -->
      ${seeds.map(s => `
        <ellipse cx="${s.x}" cy="${s.y}" rx="0.9" ry="1.4" fill="#ffeb3b" transform="rotate(10 ${s.x} ${s.y})" />
        <circle cx="${s.x + 0.3}" cy="${s.y + 0.6}" r="0.45" fill="#880e4f" opacity="0.6" />
      `).join('')}
      <!-- Green stem & calyx leaves sitting on top -->
      <!-- Stem -->
      <path d="M 0 -14 Q 1 -21, 5 -24" stroke="#2e7d32" stroke-width="2" stroke-linecap="round" fill="none" />
      <!-- Calyx crown fronds -->
      <path d="M 0 -13 C -6 -18, -13 -17, -15 -14 C -12 -12, -6 -11, 0 -13 Z" fill="#4caf50" stroke="#2e7d32" stroke-width="0.6" />
      <path d="M 0 -13 C -3 -20, -6 -23, -8 -25 C -5 -19, -2 -16, 0 -13 Z" fill="#66bb6a" stroke="#2e7d32" stroke-width="0.6" />
      <path d="M 0 -13 C 3 -20, 6 -23, 8 -25 C 5 -19, 2 -16, 0 -13 Z" fill="#66bb6a" stroke="#2e7d32" stroke-width="0.6" />
      <path d="M 0 -13 C 6 -18, 13 -17, 15 -14 C 12 -12, 6 -11, 0 -13 Z" fill="#4caf50" stroke="#2e7d32" stroke-width="0.6" />
      <path d="M 0 -13 C -3 -9, -4 -3, -5 0 C -3 -5, -1 -9, 0 -13 Z" fill="#388e3c" />
      <path d="M 0 -13 C 3 -9, 4 -3, 5 0 C 3 -5, 1 -9, 0 -13 Z" fill="#388e3c" />
      <!-- Rim notch slit illusion -->
      <line x1="0" y1="2" x2="0" y2="23" stroke="rgba(0, 0, 0, 0.45)" stroke-width="1.6" />
    </g>
  `;
}

/**
 * Render a sliced jalapeño coin/wheel with shiny dark green skin, pale inner
 * placenta, round seeds, and rim notch.
 */
function renderJalapenoSlice(x, y, angle = 3) {
  const seeds = [
    { dx: -4.5, dy: -3.5 },
    { dx: 4.5, dy: -3.5 },
    { dx: 0, dy: 5 },
    { dx: -3.8, dy: 3 },
    { dx: 3.8, dy: 3 },
  ];

  return `
    <g class="garnish garnish-jalapeno" transform="translate(${x.toFixed(1)}, ${y.toFixed(1)}) rotate(${angle})" pointer-events="none">
      <!-- Outer dark pepper skin -->
      <circle cx="0" cy="0" r="19" fill="#1b5e20" />
      <!-- Glossy skin edge highlight -->
      <circle cx="0" cy="0" r="18" fill="#2e7d32" />
      <!-- Inner pepper wall flesh -->
      <circle cx="0" cy="0" r="15.5" fill="#43a047" />
      <!-- Pale core cavity / placenta ring -->
      <circle cx="0" cy="0" r="11" fill="#c8e6c9" opacity="0.9" />
      <!-- Cavity hollow center -->
      <circle cx="0" cy="0" r="7.5" fill="#e8f5e9" />
      <!-- Internal rib segments connecting wall to core -->
      <line x1="0" y1="-7.5" x2="0" y2="-15.5" stroke="#a5d6a7" stroke-width="2.2" stroke-linecap="round" />
      <line x1="-6.5" y1="3.8" x2="-13.4" y2="7.8" stroke="#a5d6a7" stroke-width="2.2" stroke-linecap="round" />
      <line x1="6.5" y1="3.8" x2="13.4" y2="7.8" stroke="#a5d6a7" stroke-width="2.2" stroke-linecap="round" />
      <!-- Characteristic round jalapeño seeds -->
      ${seeds.map(s => `
        <ellipse cx="${s.dx}" cy="${s.dy}" rx="2" ry="1.6" fill="#fff9c4" stroke="#d4c878" stroke-width="0.5" />
        <circle cx="${s.dx + 0.3}" cy="${s.dy - 0.3}" r="0.5" fill="#ffffff" opacity="0.8" />
      `).join('')}
      <!-- Rim notch illusion -->
      <line x1="0" y1="2" x2="0" y2="19" stroke="rgba(0, 0, 0, 0.4)" stroke-width="1.3" />
    </g>
  `;
}

/**
 * Render a golden toasted marshmallow perched on the glass rim with
 * caramelized brûlée top, gooey pillowy contours, and toasted blisters.
 */
function renderMarshmallow(x, y, isLeft = false) {
  const sx = isLeft ? -1 : 1;
  const rot = isLeft ? -6 : 6;

  return `
    <g class="garnish garnish-marshmallow" transform="translate(${x.toFixed(1)}, ${y.toFixed(1)}) rotate(${rot}) scale(${sx}, 1)" pointer-events="none">
      <!-- Cast shadow behind marshmallow -->
      <path d="M -13 -13 C -13 -16, 13 -16, 13 -13 L 14 11 C 14 16, -14 16, -14 11 Z" fill="#4a250a" opacity="0.3" />

      <!-- Main pillowy marshmallow cylindrical body -->
      <rect x="-13" y="-12" width="26" height="23" rx="4.5" fill="#fcfaf2" stroke="#e8dfce" stroke-width="0.8" />

      <!-- Soft gradient shading on body sides -->
      <path d="M -13 -10 C -13 0, -13 8, -13 10 C -11 10, -10 0, -10 -10 Z" fill="#ece1cd" opacity="0.6" />
      <path d="M 13 -10 C 13 0, 13 8, 13 10 C 11 10, 10 0, 10 -10 Z" fill="#ece1cd" opacity="0.6" />

      <!-- Golden toasted surface patches along side and base -->
      <ellipse cx="6" cy="3" rx="4.5" ry="3.2" fill="#d4944d" opacity="0.75" />
      <ellipse cx="6" cy="3" rx="2.5" ry="1.6" fill="#8d4b1a" opacity="0.85" />
      <ellipse cx="-5" cy="6" rx="3.5" ry="2.2" fill="#d4944d" opacity="0.65" />

      <!-- Toasted caramelized brûlée top crown -->
      <ellipse cx="0" cy="-12" rx="13" ry="4.5" fill="#d99955" />
      <ellipse cx="0" cy="-12.3" rx="11.2" ry="3.6" fill="#8c4714" />
      <!-- Dark charred center spots from torch/campfire flame -->
      <ellipse cx="-2" cy="-12.5" rx="5" ry="1.8" fill="#421a05" />
      <circle cx="4" cy="-12.8" r="1.6" fill="#361504" />
      <circle cx="-6" cy="-12.2" r="1.2" fill="#5a270a" />

      <!-- Subtle gooey sheen highlight -->
      <path d="M -8 -8 C -10 -4, -10 2, -8 6" stroke="rgba(255, 255, 255, 0.85)" stroke-width="1.4" stroke-linecap="round" fill="none" />

      <!-- Rim notch slot illusion -->
      <line x1="0" y1="2" x2="0" y2="12" stroke="rgba(0, 0, 0, 0.35)" stroke-width="1.5" />
    </g>
  `;
}

/**
 * Render a swizzle stick planted into the drink — a thin wooden shaft topped
 * with the classic radiating-spoke pinwheel, standing tall out of crushed ice
 * for tiki/swizzle-method drinks (Queen's Park Swizzle, Chartreuse Swizzle, etc.)
 */
let swizzleInstanceCounter = 0;

function renderSwizzleStick(x, y, angle = 6, glassBottomY = null) {
  // Same headroom guard as renderMintSprig: the spoke tip reaches 132 above
  // the anchor, which is taller than a lot of glasses have room for above
  // the liquid surface. Scale down rather than clip.
  const spokeLen = 24;
  const maxReach = 108 + spokeLen;
  const margin = 8;
  const scale = Math.max(0.5, Math.min(1, (y - margin) / maxReach));

  // A swizzle stick is actually inserted down through the crushed ice to the
  // bottom of the glass (that's the technique — insert, then spin), not just
  // rested on the surface, so it's planted the same way renderCeleryStalk is.
  const bottom = glassBottomY !== null ? (glassBottomY - y) : 14;
  const clipId = `swizzle-clip-${swizzleInstanceCounter++}`;
  const shaftPathD = `M -1.7 ${bottom.toFixed(1)} L 1.7 ${bottom.toFixed(1)} L 0 -108 Z`;

  const spokes = [-70, -45, -20, 5, 30, 55].map(a => {
    const rad = (a * Math.PI) / 180;
    return `<line x1="0" y1="-108" x2="${(Math.sin(rad) * spokeLen).toFixed(1)}" y2="${(-108 - Math.cos(rad) * spokeLen).toFixed(1)}" stroke="#8d6e63" stroke-width="2.4" stroke-linecap="round" />`;
  }).join('');

  return `
    <g class="garnish garnish-swizzle-stick" transform="translate(${x.toFixed(1)}, ${y.toFixed(1)}) rotate(${angle}) scale(${scale.toFixed(2)})" pointer-events="none">
      <defs>
        <clipPath id="${clipId}">
          <path d="${shaftPathD}" />
        </clipPath>
      </defs>

      <!-- Cast shadow where the stick plunges into the crushed ice -->
      <ellipse cx="0" cy="${(bottom - 4).toFixed(1)}" rx="6" ry="2.5" fill="rgba(0, 0, 0, 0.3)" />
      <!-- Wooden shaft, planted at the bottom of the glass -->
      <line x1="0" y1="${bottom.toFixed(1)}" x2="0" y2="-108" stroke="#a1887f" stroke-width="3.4" stroke-linecap="round" />
      <line x1="-0.6" y1="${(bottom - 4).toFixed(1)}" x2="-0.6" y2="-104" stroke="#d7ccc8" stroke-width="1" stroke-linecap="round" opacity="0.6" />
      <!-- Submerged tint: darken/mute the portion below the liquid surface so it
           reads as seen through the drink rather than floating on top of it. -->
      <rect x="-3" y="0" width="6" height="${bottom.toFixed(1)}" fill="rgba(15, 20, 10, 0.4)" clip-path="url(#${clipId})" />
      <!-- Radiating pinwheel spokes (sun-ray head) at the top -->
      ${spokes}
      <circle cx="0" cy="-108" r="3.6" fill="#795548" />
    </g>
  `;
}

/**
 * Render a whole cinnamon stick quill planted diagonally inside the drink,
 * resting against the glass rim and protruding out into the aroma zone.
 */
let cinnamonInstanceCounter = 0;

function renderCinnamonStick(x, y, angle = 18, glassBottomY = null) {
  const bottom = glassBottomY !== null ? (glassBottomY - y) : 18;
  const top = -74;
  const clipId = `cinnamon-clip-${cinnamonInstanceCounter++}`;
  const quillPathD = `
    M -4.5 ${bottom.toFixed(1)}
    L -5 ${top}
    C -4.5 ${top - 3}, 4.5 ${top - 3}, 5 ${top}
    L 4.5 ${bottom.toFixed(1)}
    Z
  `;

  return `
    <g class="garnish garnish-cinnamon-stick" transform="translate(${x.toFixed(1)}, ${y.toFixed(1)}) rotate(${angle})" pointer-events="none">
      <defs>
        <clipPath id="${clipId}">
          <path d="${quillPathD}" />
        </clipPath>
      </defs>

      <!-- Soft contact shadow in the liquid/base -->
      <ellipse cx="0" cy="${(bottom - 3).toFixed(1)}" rx="6" ry="2.2" fill="rgba(0, 0, 0, 0.28)" />

      <!-- Main toasted wood-bark body -->
      <path
        d="${quillPathD}"
        fill="#82451e"
        stroke="#52240b"
        stroke-width="1.2"
        stroke-linejoin="round"
      />

      <!-- Characteristic inner roll scroll curl at cut top -->
      <path
        d="M -3.8 ${top} C -3.8 ${top - 2.8}, 3.8 ${top - 2.8}, 3.8 ${top} C 3.8 ${top + 2.5}, -1 ${top + 2.5}, -1 ${top} C -1 ${top - 1.5}, 2 ${top - 1.5}, 2 ${top}"
        fill="#a75d2d"
        stroke="#3c1906"
        stroke-width="0.9"
      />

      <!-- Vertical bark ridges, natural striations and cinnamon parchment layers -->
      <line x1="-2.2" y1="${bottom.toFixed(1)}" x2="-2.6" y2="${top + 2}" stroke="#a75d2d" stroke-width="1.1" opacity="0.8" />
      <line x1="0.5" y1="${bottom.toFixed(1)}" x2="0.3" y2="${top + 2}" stroke="#482108" stroke-width="1.3" opacity="0.75" />
      <line x1="2.4" y1="${bottom.toFixed(1)}" x2="2.2" y2="${top + 2}" stroke="#be7642" stroke-width="0.9" opacity="0.7" />

      <!-- Submerged tint to integrate through liquid -->
      <rect x="-8" y="0" width="16" height="${bottom.toFixed(1)}" fill="rgba(20, 10, 5, 0.4)" clip-path="url(#${clipId})" />
    </g>
  `;
}

/**
 * Render fine grated nutmeg or cinnamon dust flecks sprinkled across surface
 */
function renderNutmegDust(cx, surfaceY) {
  // Delicate distribution of aromatic spice flecks floating on fluid surface / foam
  const flecks = [
    { x: -28, y: -2, r: 0.9, op: 0.75, col: '#5c3214' },
    { x: -22, y: 3, r: 0.7, op: 0.70, col: '#7a451d' },
    { x: -16, y: -4, r: 1.1, op: 0.85, col: '#45220c' },
    { x: -11, y: 1, r: 0.8, op: 0.80, col: '#673617' },
    { x: -6, y: -3, r: 1.2, op: 0.90, col: '#3e1d08' },
    { x: -2, y: 4, r: 0.7, op: 0.65, col: '#824b22' },
    { x: 3, y: -1, r: 1.0, op: 0.85, col: '#4c250d' },
    { x: 8, y: -5, r: 0.8, op: 0.75, col: '#613214' },
    { x: 14, y: 2, r: 1.1, op: 0.80, col: '#53280e' },
    { x: 19, y: -3, r: 0.7, op: 0.70, col: '#754019' },
    { x: 25, y: 1, r: 0.9, op: 0.75, col: '#421f0a' },
    { x: -18, y: -1, r: 0.5, op: 0.60, col: '#8d5228' },
    { x: -8, y: 3, r: 0.6, op: 0.65, col: '#5c3214' },
    { x: 5, y: 3, r: 0.6, op: 0.65, col: '#7a451d' },
    { x: 12, y: -2, r: 0.5, op: 0.60, col: '#45220c' },
  ];

  return `
    <g class="garnish garnish-nutmeg-dust" transform="translate(${cx.toFixed(1)}, ${surfaceY.toFixed(1)})" pointer-events="none">
      ${flecks.map(f => `
        <circle cx="${f.x}" cy="${f.y}" r="${f.r}" fill="${f.col}" opacity="${f.op}" />
      `).join('')}
    </g>
  `;
}

/**
 * Render artisanal dehydrated citrus wheel (caramelized deep amber/translucent disc with darkened rind)
 */
function renderDehydratedCitrusWheel(x, y, angle = 5) {
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
    segments.push(`<path d="M 0 0 L ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2} Z" fill="#9e561a" opacity="0.82" />`);
  }

  return `
    <g class="garnish garnish-dehydrated-wheel" transform="translate(${x.toFixed(1)}, ${y.toFixed(1)}) rotate(${angle})" pointer-events="none">
      <!-- Dark browned/caramelized outer rind -->
      <circle cx="0" cy="0" r="21" fill="#422008" stroke="#2b1404" stroke-width="0.8" />
      <!-- Dried parchment pith ring -->
      <circle cx="0" cy="0" r="18" fill="#7a4216" opacity="0.9" />
      <!-- Darkened inner translucent pulp base -->
      <circle cx="0" cy="0" r="15.5" fill="#5a2e0e" />
      <!-- Radial translucent glassine segments -->
      ${segments.join('')}
      <!-- Delicate caramelized fiber veins -->
      <circle cx="0" cy="0" r="2.8" fill="#381905" />
      <!-- Rim notch illusion -->
      <line x1="0" y1="2" x2="0" y2="21" stroke="rgba(0,0,0,0.5)" stroke-width="1.3" />
    </g>
  `;
}

/**
 * Render a classic colorful tiki paper cocktail umbrella / parasol
 */
function renderCocktailUmbrella(x, y, isLeft = false) {
  const sx = isLeft ? -1 : 1;
  const rot = isLeft ? -16 : 16;
  const maxReach = 65;
  const margin = 8;
  const scale = Math.max(0.6, Math.min(1, (y - margin) / maxReach));

  return `
    <g class="garnish garnish-cocktail-umbrella" transform="translate(${x.toFixed(1)}, ${y.toFixed(1)}) rotate(${rot}) scale(${sx * scale}, ${scale})" pointer-events="none">
      <!-- Bamboo toothpick shaft extending down into the drink and up to crown -->
      <line x1="-8" y1="32" x2="8" y2="-44" stroke="#d7ccc8" stroke-width="2.4" stroke-linecap="round" />
      <line x1="-7.5" y1="32" x2="8.5" y2="-44" stroke="#8d6e63" stroke-width="0.8" stroke-linecap="round" opacity="0.6" />

      <!-- Umbrella paper canopy assembly -->
      <g transform="translate(6, -34) rotate(-22)">
        <!-- Back underside fold shadow -->
        <path d="M -30 0 Q 0 -16, 30 0 Q 0 4, -30 0 Z" fill="#b71c1c" opacity="0.8" />

        <!-- Main parasol conical paper facets with alternating vibrant tropical ribs -->
        <path d="M -30 0 Q -15 -8, 0 -20 L 0 0 Z" fill="#e53935" />
        <path d="M 0 -20 Q 15 -8, 30 0 L 0 0 Z" fill="#fbc02d" />
        <path d="M -18 -4 Q -9 -10, 0 -20 L -6 0 Z" fill="#ffb300" opacity="0.9" />
        <path d="M 0 -20 Q 9 -10, 18 -4 L 6 0 Z" fill="#e53935" opacity="0.9" />

        <!-- Scalloped delicate rim edge -->
        <path d="M -30 0 Q -24 3, -18 -1 Q -12 4, -6 1 Q 0 4, 6 1 Q 12 4, 18 -1 Q 24 3, 30 0" stroke="#ffffff" stroke-width="1.2" fill="none" opacity="0.9" />

        <!-- Rib lines radiating from apex -->
        <line x1="0" y1="-20" x2="-30" y2="0" stroke="#ffe082" stroke-width="0.9" opacity="0.85" />
        <line x1="0" y1="-20" x2="-18" y2="-1" stroke="#ffe082" stroke-width="0.9" opacity="0.85" />
        <line x1="0" y1="-20" x2="-6" y2="1" stroke="#ffe082" stroke-width="0.9" opacity="0.85" />
        <line x1="0" y1="-20" x2="6" y2="1" stroke="#ffe082" stroke-width="0.9" opacity="0.85" />
        <line x1="0" y1="-20" x2="18" y2="-1" stroke="#ffe082" stroke-width="0.9" opacity="0.85" />
        <line x1="0" y1="-20" x2="30" y2="0" stroke="#ffe082" stroke-width="0.9" opacity="0.85" />

        <!-- Top toothpick finial tip -->
        <line x1="0" y1="-20" x2="1" y2="-27" stroke="#d7ccc8" stroke-width="2.2" stroke-linecap="round" />
        <circle cx="1" cy="-27" r="1.8" fill="#ff5252" />
      </g>
    </g>
  `;
}

/**
 * Render vibrant edible flower (cocktail orchid / pansy blossom) resting on surface/rim
 */
function renderEdibleFlower(x, y, angle = 8) {
  return `
    <g class="garnish garnish-edible-flower" transform="translate(${x.toFixed(1)}, ${y.toFixed(1)}) rotate(${angle})" pointer-events="none">
      <!-- Soft drop shadow on liquid / glass -->
      <ellipse cx="0" cy="4" rx="14" ry="7" fill="rgba(0, 0, 0, 0.28)" />

      <!-- Lower petal pair (deep velvety purple) -->
      <path d="M 0 0 C -12 8, -18 20, -5 23 C 4 24, 6 12, 0 0 Z" fill="#4a148c" opacity="0.95" />
      <path d="M 0 0 C 12 8, 18 20, 5 23 C -4 24, -6 12, 0 0 Z" fill="#4a148c" opacity="0.95" />

      <!-- Lateral spreading petals (vibrant magenta/violet) -->
      <path d="M 0 0 C -16 -4, -26 4, -22 14 C -16 20, -6 8, 0 0 Z" fill="#8e24aa" />
      <path d="M 0 0 C 16 -4, 26 4, 22 14 C 16 20, 6 8, 0 0 Z" fill="#8e24aa" />

      <!-- Top upright dorsal petal (bright orchid pink/purple) -->
      <path d="M 0 0 C -14 -10, -12 -25, 0 -26 C 12 -25, 14 -10, 0 0 Z" fill="#ab47bc" />

      <!-- Center eye & golden throat labellum -->
      <ellipse cx="0" cy="3" rx="4.5" ry="3.5" fill="#fbc02d" />
      <circle cx="0" cy="2" r="2.0" fill="#e65100" />
      <circle cx="0" cy="2" r="1.0" fill="#ffffff" opacity="0.9" />

      <!-- Delicate petal vein radiating accents -->
      <path d="M 0 -2 L -5 -16 M 0 -2 L 5 -16 M 0 3 L -12 9 M 0 3 L 12 9" stroke="#ce93d8" stroke-width="0.8" opacity="0.75" />
    </g>
  `;
}

/**
 * Render a fresh sprig of garden thyme with delicate woody stem and tiny oval leaves
 */
function renderThymeSprig(x, y, angle = -10) {
  const maxReach = 58;
  const margin = 6;
  const scale = Math.max(0.55, Math.min(1, (y - margin) / maxReach));

  // Small pair of thyme oval leaves along stem
  const leafPair = (stemY, dx, rot) => `
    <g transform="translate(0, ${stemY}) rotate(${rot})">
      <ellipse cx="${-dx}" cy="0" rx="3.6" ry="1.9" fill="#388e3c" transform="rotate(-15)" />
      <ellipse cx="${-dx + 0.3}" cy="-0.2" rx="2.5" ry="1.1" fill="#66bb6a" transform="rotate(-15)" opacity="0.7" />
      <ellipse cx="${dx}" cy="0" rx="3.6" ry="1.9" fill="#2e7d32" transform="rotate(15)" />
      <ellipse cx="${dx - 0.3}" cy="-0.2" rx="2.5" ry="1.1" fill="#4caf50" transform="rotate(15)" opacity="0.7" />
    </g>
  `;

  return `
    <g class="garnish garnish-thyme" transform="translate(${x.toFixed(1)}, ${y.toFixed(1)}) rotate(${angle}) scale(${scale.toFixed(2)})" pointer-events="none">
      <!-- Submerged woody twig -->
      <path d="M 0 -6 Q -2 14, -6 34" stroke="#4e342e" stroke-width="2.2" stroke-linecap="round" fill="none" />
      <ellipse cx="-1" cy="3" rx="2.8" ry="1.4" fill="rgba(0, 0, 0, 0.25)" />

      <!-- Upper main curving stem -->
      <path d="M 0 3 Q 2 -25, -2 -54" stroke="#5d4037" stroke-width="1.8" stroke-linecap="round" fill="none" />
      <path d="M 0.2 3 Q 2.2 -25, -1.8 -54" stroke="#795548" stroke-width="0.9" stroke-linecap="round" fill="none" opacity="0.6" />

      <!-- Side branchlet -->
      <path d="M 1 -18 Q 8 -26, 12 -34" stroke="#5d4037" stroke-width="1.3" stroke-linecap="round" fill="none" />

      <!-- Paired thyme leaves along primary stem -->
      ${leafPair(-4, 5, -8)}
      ${leafPair(-14, 5.2, 5)}
      ${leafPair(-24, 4.8, -12)}
      ${leafPair(-34, 4.4, 8)}
      ${leafPair(-44, 3.8, -6)}

      <!-- Branchlet leaves -->
      <g transform="translate(7, -26) rotate(35)">
        <ellipse cx="-3" cy="0" rx="3.0" ry="1.6" fill="#43a047" />
        <ellipse cx="3" cy="0" rx="3.0" ry="1.6" fill="#388e3c" />
      </g>
      <g transform="translate(12, -34) rotate(40)">
        <ellipse cx="0" cy="-2.5" rx="1.8" ry="3.0" fill="#4caf50" />
      </g>

      <!-- Terminal tip cluster -->
      <ellipse cx="-2" cy="-55" rx="2.0" ry="3.4" fill="#66bb6a" transform="rotate(-6)" />
      <ellipse cx="-3.5" cy="-53" rx="1.7" ry="2.8" fill="#4caf50" transform="rotate(-25)" />
      <ellipse cx="-0.5" cy="-53" rx="1.7" ry="2.8" fill="#388e3c" transform="rotate(20)" />
    </g>
  `;
}

// How far above the rim (in the shared 240-wide drawing scale) each garnish
// type's ink actually reaches, measured from each render function above.
// Used by glass-view.js to crop the SVG viewBox to *this recipe's* actual
// content instead of reserving room for the tallest garnish on every drink.
const GARNISH_HEADROOM = {
  mintSprig: 72, // 66-unit max leaf reach + 6 margin (see renderMintSprig)
  rosemarySprig: 70, // 64-unit max needle reach + 6 margin (see renderRosemarySprig)
  thymeSprig: 64,
  cocktailUmbrella: 72,
  pineappleWedge: 48,
  limeWheel: 29, lemonWheel: 29, orangeWheel: 29, grapefruitWheel: 29, dehydratedCitrusWheel: 29, cucumberSlice: 29, jalapenoSlice: 26,
  limeWedge: 24, lemonWedge: 24, orangeWedge: 24, grapefruitWedge: 24, appleSlice: 24, strawberry: 32, marshmallow: 24,
  edibleFlower: 26,
  lemonTwist: 14, orangeTwist: 14, limeTwist: 14,
  cherry: 15, cranberry: 15, olive: 15, cocktailOnion: 15, pickleSpear: 15,
  cinnamonStick: 48,
  smokeCloud: 96, // rising waves and dissipated puffs extend up out of the glass
};
// Rim highlight stroke + a touch of breathing room — the floor for any drink,
// garnished or not.
const BASE_HEADROOM = 14;
// A flamed twist's micro-sparks drift as far as ~14 (local cy) + 26 (drift
// keyframe) units above the twist anchor — well past the 14-unit headroom a
// plain twist needs — so they need their own reserved clearance or the
// viewBox crops them out entirely.
const FLAMED_TWIST_HEADROOM = 44;
const TWIST_TYPES = new Set(['lemonTwist', 'orangeTwist', 'limeTwist']);
// Celery and the swizzle stick are planted at the bottom of the glass and
// rise well above the rim, same order of magnitude as mint. Both only occur
// in practice on already-tall glasses (highball/tiki mug) that need little
// or no crop anyway, so this generous value costs those recipes nothing.
const TALL_PLANTED_HEADROOM = 72;

/**
 * How much clearance (in SVG units, above the glass's rim) this specific
 * recipe's garnish needs so glass-view.js can crop its viewBox tightly
 * without clipping anything.
 */
export function getGarnishHeadroom(recipe) {
  const types = resolveGarnishTypes(recipe?.garnish);
  if (types.includes('celeryStalk')) return TALL_PLANTED_HEADROOM;

  const swizzleSignal = `${recipe?.method || ''} ${recipe?.instructions || ''}`.toLowerCase();
  const hasSwizzleStick = recipe?.method === 'Swizzled' || swizzleSignal.includes('swizzle stick');
  if (hasSwizzleStick) return TALL_PLANTED_HEADROOM;

  const recipeText = `${recipe?.garnish || ''} ${recipe?.instructions || ''} ${recipe?.notes || ''}`.toLowerCase();
  const isFlamed = recipeText.includes('flamed');

  let headroom = BASE_HEADROOM;
  for (const type of types) {
    let typeHeadroom = GARNISH_HEADROOM[type] ?? BASE_HEADROOM;
    if (isFlamed && TWIST_TYPES.has(type)) {
      typeHeadroom = FLAMED_TWIST_HEADROOM;
    }
    headroom = Math.max(headroom, typeHeadroom);
  }
  return headroom;
}

/**
 * Main entry point: Renders garnish SVG elements for a cocktail recipe and glassware
 */
export function renderGarnishesSvg(recipe, glassware, surfaceY) {
  const garnishStr = recipe?.garnish;
  if (!glassware) return '';

  const types = resolveGarnishTypes(garnishStr);

  // Swizzle sticks come from the technique, not the garnish text — none of
  // this app's swizzle recipes actually list "swizzle stick" as a garnish,
  // they describe it as part of the method/instructions instead.
  const swizzleSignal = `${recipe?.method || ''} ${recipe?.instructions || ''}`.toLowerCase();
  const hasSwizzleStick = recipe?.method === 'Swizzled' || swizzleSignal.includes('swizzle stick');

  if (types.length === 0 && !hasSwizzleStick) return '';

  const rim = glassware.rim || { leftX: 46, rightX: 194, y: 96 };
  const floatY = surfaceY !== null && surfaceY !== undefined ? parseFloat(surfaceY) : rim.y + 12;
  const centerX = (rim.leftX + rim.rightX) / 2;

  const rendered = [];

  // Celery (and the swizzle stick, added separately below) stands planted in
  // the drink rather than perched on a rim corner, so it's excluded from the
  // left/right rim-slot rotation the rest of these garnishes share. Pick-riding
  // garnishes (olive/onion/cherry/pickle) are excluded too — however many of
  // them the recipe calls for, they all thread onto one shared pick (see
  // renderCombinedPick) which claims a single rim slot of its own, represented
  // here by the '__pickGroup__' placeholder.
  const pickTypes = types.filter(t => PICK_GARNISH_TYPES.has(t));
  const otherSlotTypes = types.filter(t => t !== 'celeryStalk' && t !== 'smokeCloud' && t !== 'cinnamonStick' && t !== 'nutmegDust' && !t.includes('Rim') && t !== 'coffeeBeans' && !PICK_GARNISH_TYPES.has(t));
  const slotTypes = pickTypes.length > 0 ? [...otherSlotTypes, '__pickGroup__'] : otherSlotTypes;

  const glassBottomY = glassware.fluidBounds?.bottomY ?? 300;

  // Detect flamed twist/peel instructions or garnish
  const recipeText = `${recipe?.garnish || ''} ${recipe?.instructions || ''} ${recipe?.notes || ''}`.toLowerCase();
  const isFlamed = recipeText.includes('flamed');

  types.forEach((type) => {
    if (type === 'celeryStalk') {
      rendered.push(renderCeleryStalk(centerX, floatY, -4, glassBottomY));
      return;
    }
    if (type === 'smokeCloud') {
      rendered.push(renderSmokeCloud(centerX, rim.y, floatY));
      return;
    }
    if (type === 'cinnamonStick') {
      // Place leaning toward right or left depending on whether another rim garnish exists
      const angle = slotTypes.length > 0 ? 18 : 12;
      const posX = slotTypes.length > 0 ? rim.rightX - 16 : centerX + 12;
      rendered.push(renderCinnamonStick(posX, floatY, angle, glassBottomY));
      return;
    }
    if (type === 'nutmegDust') {
      rendered.push(renderNutmegDust(centerX, floatY - 2));
      return;
    }
    // Pick-riding garnishes are rendered once as a group after this loop.
    if (PICK_GARNISH_TYPES.has(type)) return;

    const slotIndex = slotTypes.indexOf(type);
    // Positioning slot: if two garnishes, place first on left, second on right
    const isSlotLeft = slotTypes.length > 1 && slotIndex === 0;
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
      case 'grapefruitWheel':
        rendered.push(renderCitrusWheel(posX, posY - 6, 'grapefruit', isSlotLeft ? -14 : 14));
        break;
      case 'dehydratedCitrusWheel':
        rendered.push(renderDehydratedCitrusWheel(posX, posY - 6, isSlotLeft ? -14 : 14));
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
      case 'grapefruitWedge':
        rendered.push(renderCitrusWedge(posX, posY, 'grapefruit', isSlotLeft));
        break;
      case 'lemonTwist':
        rendered.push(renderPeelTwist(posX, posY, 'lemon', isSlotLeft, isFlamed));
        break;
      case 'orangeTwist':
        rendered.push(renderPeelTwist(posX, posY, 'orange', isSlotLeft, isFlamed));
        break;
      case 'limeTwist':
        rendered.push(renderPeelTwist(posX, posY, 'lime', isSlotLeft, isFlamed));
        break;
      case 'mintSprig':
        rendered.push(renderMintSprig(isSlotLeft ? rim.leftX + 4 : rim.rightX - 4, posY + 2, isSlotLeft ? 14 : -14));
        break;
      case 'rosemarySprig':
        rendered.push(renderRosemarySprig(isSlotLeft ? rim.leftX + 4 : rim.rightX - 4, posY + 2, isSlotLeft ? 12 : -12));
        break;
      case 'thymeSprig':
        rendered.push(renderThymeSprig(isSlotLeft ? rim.leftX + 4 : rim.rightX - 4, posY + 2, isSlotLeft ? 12 : -12));
        break;
      case 'cocktailUmbrella':
        rendered.push(renderCocktailUmbrella(posX, posY, isSlotLeft));
        break;
      case 'edibleFlower':
        rendered.push(renderEdibleFlower(isSlotLeft ? rim.leftX + 8 : rim.rightX - 8, floatY + 4, isSlotLeft ? -12 : 12));
        break;
      case 'pineappleWedge':
        rendered.push(renderPineappleWedge(posX, posY - 4, isSlotLeft ? -16 : 16));
        break;
      case 'appleSlice':
        rendered.push(renderAppleSlice(posX, posY, isSlotLeft));
        break;
      case 'cucumberSlice':
        rendered.push(renderCucumberSlice(posX, posY - 6, isSlotLeft ? -14 : 14));
        break;
      case 'strawberry':
        rendered.push(renderStrawberry(posX, posY, isSlotLeft));
        break;
      case 'jalapenoSlice':
        rendered.push(renderJalapenoSlice(posX, posY - 6, isSlotLeft ? -14 : 14));
        break;
      case 'marshmallow':
        rendered.push(renderMarshmallow(posX, posY, isSlotLeft));
        break;
    }
  });

  if (pickTypes.length > 0) {
    const pickSlotIndex = slotTypes.indexOf('__pickGroup__');
    const isPickSlotLeft = slotTypes.length > 1 && pickSlotIndex === 0;
    rendered.push(renderCombinedPick(isPickSlotLeft ? rim.leftX : rim.rightX, rim.y, isPickSlotLeft, pickTypes));
  }

  if (hasSwizzleStick) {
    rendered.push(renderSwizzleStick(centerX, floatY, 5, glassBottomY));
  }

  return rendered.join('\n');
}
