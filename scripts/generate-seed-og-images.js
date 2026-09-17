#!/usr/bin/env node
/**
 * Pre-renders the deco share-card (og:image) for every bundled seed
 * cocktail, including its glassware art, and emits a single SQL file that
 * bulk-loads them into the seed_drink_images table (see
 * migrations/0010_add_seed_drink_images.sql).
 *
 * This mirrors js/modules/share-card.js's layout, but as SVG rasterized by
 * sharp rather than <canvas> — there's no browser here to draw into. It's a
 * build-time-only script (not part of the request path), so the CPU-budget
 * concern that keeps functions/drink/[id]/og.png.js from rendering on
 * demand doesn't apply: this runs once, offline, whenever seed-recipes.js
 * changes, and its output is checked into the database, not regenerated
 * per request.
 *
 * Usage:
 *   node scripts/generate-seed-og-images.js > migrations/seed-data/seed_drink_images.sql
 *   wrangler d1 execute speakeasy-db --local --file=migrations/seed-data/seed_drink_images.sql
 *   wrangler d1 execute speakeasy-db --remote --file=migrations/seed-data/seed_drink_images.sql
 */
import sharp from 'sharp';
import { SEED_RECIPES } from '../js/data/seed-recipes.js';
import { renderGlassSvg } from '../js/modules/glass-view.js';

const CARD_WIDTH = 1200;
const CARD_HEIGHT = 630;

const COLOR_BG = '#020f20';
const COLOR_GOLD = '#ebbc72';
const COLOR_GOLD_SUBTLE = 'rgba(235, 188, 114, 0.45)';
const COLOR_WHITE = '#ffffff';

// Matches --font-display / --font-sans in css/theme-deco.css — the actual
// deco theme's fonts, not share-card.js's own "Playfair Display", which is
// base.css's (different, unused-by-this-theme) display font and predates
// the Gurmukhi MN/DM Sans rebrand.
//
// This script runs through sharp/librsvg, which has no web fonts and
// resolves font-family by name against whatever the machine's font system
// (fontconfig, on macOS scanning the real OS font directories including
// ~/Library/Fonts) has installed — sharp's bundled fontconfig ignores
// FONTCONFIG_PATH/XDG_DATA_HOME overrides, so a project-local fonts
// directory doesn't work here. "Gurmukhi MN" is a deliberately confusing
// name: it's this app's own display font (assets/fonts/gurmukhi-mn.ttf),
// but macOS also ships a real (Punjabi-script) font of the same name —
// fontconfig correctly prefers ours for Latin text by glyph coverage, but
// confirm that (e.g. render a small test SVG and inspect it) after
// installing fonts on a new machine rather than assuming it. If either
// font isn't installed wherever this runs, sharp silently falls back to a
// generic serif/sans-serif with no warning.
const FONT_SERIF = "'Gurmukhi MN', 'DM Sans', sans-serif";
const FONT_SANS = "'DM Sans', 'Josefin Sans', 'Jost', sans-serif";

function escapeXml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function titleFontSize(name) {
  const len = (name || '').length;
  if (len > 34) return 48;
  if (len > 24) return 56;
  if (len > 16) return 62;
  return 86;
}

// Rough width-per-character estimates, used only to decide where to wrap —
// sharp/librsvg (unlike canvas) has no measureText we can call ahead of
// drawing, so these don't need to be exact, just conservative enough that
// text doesn't overrun the card. Calibrated per font by rendering sample
// strings and measuring actual pixel width (Gurmukhi MN, the bold display
// font, runs ~0.6-0.69 per sampled title; DM Sans, the button's font, runs
// ~0.45) — each rounded up so an inaccurate estimate errs toward wrapping
// a line early, or a button a little wide, rather than overlapping the
// glass art or clipping button text.
const TITLE_CHAR_WIDTH_RATIO = 0.7;
const BUTTON_CHAR_WIDTH_RATIO = 0.5;

function estimateTextWidth(text, fontSize, ratio) {
  return text.length * fontSize * ratio;
}

function wrapTitle(name, fontSize, maxWidth, maxLines) {
  const words = (name || 'A Speakeasy Cocktail').split(' ');
  const lines = [];
  let current = '';

  for (const word of words) {
    const attempt = current ? `${current} ${word}` : word;
    if (estimateTextWidth(attempt, fontSize, TITLE_CHAR_WIDTH_RATIO) > maxWidth && current) {
      lines.push(current);
      current = word;
      if (lines.length === maxLines) break;
    } else {
      current = attempt;
    }
  }
  if (lines.length < maxLines && current) lines.push(current);

  if (lines.length === maxLines) {
    let lastLine = lines[maxLines - 1];
    while (estimateTextWidth(`${lastLine}…`, fontSize, TITLE_CHAR_WIDTH_RATIO) > maxWidth && lastLine.length > 1) {
      lastLine = lastLine.slice(0, -1).trimEnd();
    }
    const consumedWords = lines.slice(0, -1).join(' ').split(' ').length;
    if (words.length > consumedWords + lastLine.split(' ').length) {
      lines[maxLines - 1] = `${lastLine}…`;
    }
  }
  return lines;
}

/**
 * wrapTitle(), but steps the font size down when the title would otherwise
 * truncate with an ellipsis — e.g. "Hot Buttered Rum" at the shortest-name
 * tier's 86px wraps to "HOT"/"BUTTERED…", silently dropping "Rum". A
 * shrunk-but-complete title reads better than a bigger one that's missing
 * a word, and this only kicks in for the rare title where three-plus words
 * don't fit two lines at the tier's default size — most names render at
 * exactly titleFontSize()'s size.
 */
function fitTitle(name, startFontSize, maxWidth, maxLines) {
  const upper = (name || 'A Speakeasy Cocktail').toUpperCase();
  let fontSize = startFontSize;
  let lines = wrapTitle(upper, fontSize, maxWidth, maxLines);
  while (lines.some((line) => line.endsWith('…')) && fontSize > 40) {
    fontSize -= 4;
    lines = wrapTitle(upper, fontSize, maxWidth, maxLines);
  }
  return { fontSize, lines };
}

/** Builds the glass art fragment, sized and positioned exactly as share-card.js contain-fits it. */
function buildGlassFragment(recipe) {
  const raw = renderGlassSvg(recipe, 'seedog', { mode: 'layered' })
    .replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"')
    .replace(
      '<defs>',
      '<defs><style>.fluid-layered-group{opacity:1}.fluid-blended-group{opacity:0}</style>'
    );

  const viewBoxMatch = raw.match(/viewBox="0 [-.\d]+ 240 ([.\d]+)"/);
  const vbHeight = viewBoxMatch ? parseFloat(viewBoxMatch[1]) : 300;
  const glassAspect = 240 / vbHeight;

  const GLASS_MAX_WIDTH = 340;
  const GLASS_MAX_HEIGHT = 460;
  let height = GLASS_MAX_HEIGHT;
  let width = height * glassAspect;
  if (width > GLASS_MAX_WIDTH) {
    width = GLASS_MAX_WIDTH;
    height = width / glassAspect;
  }

  const glassColumnCenterX = 930;
  const x = glassColumnCenterX - width / 2;
  const y = (CARD_HEIGHT - height) / 2;

  // Embedding as a nested <svg> (rather than a data-URI <image>, which is
  // what the browser version needs) lets librsvg rasterize the gradients/
  // clipPath/filters directly in the same document, at full fidelity.
  // Extract by position rather than a symmetric open/close regex — the
  // fragment's own <defs>/<style> content can itself contain "</...>"-shaped
  // text that a naive closing-tag regex could match early.
  const openTagEnd = raw.indexOf('>') + 1;
  const closeTagStart = raw.lastIndexOf('</svg>');
  const innerContent = raw.slice(openTagEnd, closeTagStart);
  const viewBox = viewBoxMatch ? viewBoxMatch[0].slice('viewBox="'.length, -1) : `0 0 240 ${vbHeight}`;

  return `<g transform="translate(${x}, ${y})">
    <svg width="${width}" height="${height}" viewBox="${viewBox}" overflow="visible">${innerContent}</svg>
  </g>`;
}

function buildCardSvg(recipe) {
  // Uppercased for the same reason every other Gurmukhi MN heading in the
  // app is styled with text-transform: uppercase instead of drawn as typed
  // (see the matching note in share-card.js): the font's accented Latin
  // glyphs only exist in its uppercase set, so e.g. "Piña Colada" would
  // silently lose its tilde otherwise — there's no CSS transform to save us
  // when drawing raw SVG <text>.
  const { fontSize, lines: titleLines } = fitTitle(recipe.name, titleFontSize(recipe.name), 640, 2);
  const lineHeight = fontSize * 1.12;
  // Rebalanced for the larger type scale below: a 2-line title at the
  // largest tier (86px) plus the enlarged button needs ~350px of vertical
  // room, which the old constants (tuned when everything was smaller) no
  // longer had — they pushed the button below the card's bottom edge for
  // any short name that wraps. SPEAKEASY moved up (see its y= below) to
  // free up that space rather than shrinking the type back down.
  const titleY = 190 + fontSize * 0.7;

  const titleTspans = titleLines
    .map((line, i) => `<tspan x="100" y="${titleY + i * lineHeight}">${escapeXml(line)}</tspan>`)
    .join('');

  const btnRowY = titleY + titleLines.length * lineHeight + 20;
  const btnText = 'View Drink  →';
  const btnPaddingX = 44;
  const btnHeight = 92;
  // Same rough-estimate rationale as wrapTitle() — no measureText available here.
  const btnWidth = estimateTextWidth(btnText, 38, BUTTON_CHAR_WIDTH_RATIO) + btnPaddingX * 2;

  const glassFragment = buildGlassFragment(recipe);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_WIDTH}" height="${CARD_HEIGHT}" viewBox="0 0 ${CARD_WIDTH} ${CARD_HEIGHT}">
    <rect width="${CARD_WIDTH}" height="${CARD_HEIGHT}" fill="${COLOR_BG}" />

    <rect x="28" y="28" width="${CARD_WIDTH - 56}" height="${CARD_HEIGHT - 56}" rx="12"
      fill="none" stroke="${COLOR_GOLD}" stroke-width="3" />
    <rect x="44" y="44" width="${CARD_WIDTH - 88}" height="${CARD_HEIGHT - 88}" rx="8"
      fill="none" stroke="${COLOR_GOLD_SUBTLE}" stroke-width="1" />

    <text x="100" y="120" font-family="${FONT_SERIF}" font-weight="700" font-size="42"
      letter-spacing="11" fill="${COLOR_GOLD}">SPEAKEASY</text>

    <text font-family="${FONT_SERIF}" font-weight="700" font-size="${fontSize}" fill="${COLOR_WHITE}">${titleTspans}</text>

    <rect x="100" y="${btnRowY}" width="${btnWidth}" height="${btnHeight}" rx="${btnHeight / 2}"
      fill="none" stroke="${COLOR_GOLD}" stroke-width="2" />
    <text x="${100 + btnPaddingX}" y="${btnRowY + btnHeight / 2 + 13}" font-family="${FONT_SANS}"
      font-weight="600" font-size="38" fill="${COLOR_GOLD}">${btnText}</text>

    ${glassFragment}
  </svg>`;
}

async function renderRecipePng(recipe) {
  const svg = buildCardSvg(recipe);
  return sharp(Buffer.from(svg))
    .png({ compressionLevel: 9, palette: true })
    .toBuffer();
}

function sqlEscapeId(id) {
  return id.replace(/'/g, "''");
}

async function main() {
  const rows = [];
  for (const recipe of SEED_RECIPES) {
    const png = await renderRecipePng(recipe);
    rows.push(`('${sqlEscapeId(recipe.id)}', X'${png.toString('hex')}')`);
    process.stderr.write(`rendered ${recipe.id} (${png.length} bytes)\n`);
  }

  process.stdout.write('DELETE FROM seed_drink_images;\n');
  // One row per INSERT statement: a multi-row VALUES list of hex-encoded
  // PNGs quickly trips wrangler d1 execute's SQLITE_TOOBIG statement-length
  // limit, well before D1's actual per-value size limit.
  for (const row of rows) {
    process.stdout.write(`INSERT INTO seed_drink_images (recipe_id, og_image) VALUES\n${row};\n`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
