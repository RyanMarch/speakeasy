/**
 * Speakeasy Share Card Renderer
 * Draws the deco-themed link-preview card (og:image for a shared cocktail)
 * onto an offscreen <canvas>, entirely client-side.
 *
 * This runs in the browser rather than on the server because the server is
 * a Cloudflare Workers Free plan function with a 10ms/request CPU budget —
 * nowhere near enough for WASM-based SVG rasterization. A browser already
 * has real SVG/font rendering built in and no such limit, and produces a
 * more faithful result besides (canvas natively supports the glass art's
 * gradients/clipPath/filters, which a Workers-side SVG-to-PNG library
 * couldn't). See functions/share/[id]/og.png.js for the server side, which
 * just stores/serves whatever PNG this module hands it.
 */
import { renderGlassSvg } from './glass-view.js';

const CARD_WIDTH = 1200;
const CARD_HEIGHT = 630;
// 1200x630 is the standard og:image size platforms expect and display link
// previews at — typically a few hundred px wide in the client UI, so 2x
// would roughly quadruple both the stored blob size and the download for
// negligible visible gain.
const RENDER_SCALE = 1;

const COLOR_BG = '#020f20';
const COLOR_GOLD = '#ebbc72';
const COLOR_GOLD_SUBTLE = 'rgba(235, 188, 114, 0.45)';
const COLOR_WHITE = '#ffffff';
const COLOR_MUTED = '#d5dde6';

function svgToDataUri(svg) {
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function drawRoundedRect(ctx, x, y, width, height, radius) {
  if (typeof ctx.roundRect === 'function') {
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, radius);
    return;
  }
  // Manual fallback for browsers without CanvasRenderingContext2D.roundRect.
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

function fillTextSpaced(ctx, text, x, y, letterSpacing) {
  let cursorX = x;
  for (const char of text) {
    ctx.fillText(char, cursorX, y);
    cursorX += ctx.measureText(char).width + letterSpacing;
  }
}

/** Word-wraps text to fit maxWidth, capped at maxLines (last line ellipsized if it still overflows). */
function wrapText(ctx, text, maxWidth, maxLines) {
  const words = text.split(' ');
  const lines = [];
  let current = '';

  for (const word of words) {
    const attempt = current ? `${current} ${word}` : word;
    if (ctx.measureText(attempt).width > maxWidth && current) {
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
    while (ctx.measureText(`${lastLine}…`).width > maxWidth && lastLine.length > 1) {
      lastLine = lastLine.slice(0, -1);
    }
    const consumedWords = lines.slice(0, -1).join(' ').split(' ').length;
    if (words.length > consumedWords + lastLine.split(' ').length) {
      lines[maxLines - 1] = `${lastLine}…`;
    }
  }
  return lines;
}

/**
 * wrapText(), but steps the font size down when the title would otherwise
 * truncate with an ellipsis — e.g. "Hot Buttered Rum" at the shortest-name
 * tier's 86px wraps to "HOT"/"BUTTERED…", silently dropping "Rum". A
 * shrunk-but-complete title reads better than a bigger one that's missing
 * a word, and this only kicks in for the rare title where three-plus words
 * don't fit two lines at the tier's default size — most names render at
 * exactly titleFontSize()'s size. Sets ctx.font as a side effect, to
 * whatever size it settles on.
 */
function fitTitle(ctx, name, startFontSize, maxWidth, maxLines) {
  const upper = (name || 'A Speakeasy Cocktail').toUpperCase();
  let fontSize = startFontSize;
  ctx.font = `700 ${fontSize}px "Gurmukhi MN", "DM Sans", sans-serif`;
  let lines = wrapText(ctx, upper, maxWidth, maxLines);
  while (lines.some((line) => line.endsWith('…')) && fontSize > 40) {
    fontSize -= 4;
    ctx.font = `700 ${fontSize}px "Gurmukhi MN", "DM Sans", sans-serif`;
    lines = wrapText(ctx, upper, maxWidth, maxLines);
  }
  return { fontSize, lines };
}

function titleFontSize(name) {
  const len = (name || '').length;
  if (len > 34) return 48;
  if (len > 24) return 56;
  if (len > 16) return 62;
  return 86;
}

/**
 * Renders the share card for a recipe and resolves with a base64 PNG data
 * URL. Resolves to null (rather than rejecting) on any failure — a broken
 * share-preview image should never block sharing the link itself.
 */
export async function renderShareCardPng(recipe) {
  try {
    await document.fonts.ready;

    const canvas = document.createElement('canvas');
    canvas.width = CARD_WIDTH * RENDER_SCALE;
    canvas.height = CARD_HEIGHT * RENDER_SCALE;
    const ctx = canvas.getContext('2d');
    ctx.scale(RENDER_SCALE, RENDER_SCALE);

    // Background
    ctx.fillStyle = COLOR_BG;
    ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

    // Deco double-frame
    ctx.strokeStyle = COLOR_GOLD;
    ctx.lineWidth = 3;
    drawRoundedRect(ctx, 28, 28, CARD_WIDTH - 56, CARD_HEIGHT - 56, 12);
    ctx.stroke();

    ctx.strokeStyle = COLOR_GOLD_SUBTLE;
    ctx.lineWidth = 1;
    drawRoundedRect(ctx, 44, 44, CARD_WIDTH - 88, CARD_HEIGHT - 88, 8);
    ctx.stroke();

    // "SPEAKEASY" label. Sized and viewed as a phone-screen thumbnail (a
    // link preview in Messages/Slack/etc. renders this card at a few
    // hundred px wide), not at its native 1200px canvas size, so text needs
    // real heft to survive that downscale — 22px all but disappears.
    ctx.fillStyle = COLOR_GOLD;
    ctx.font = '700 42px "Gurmukhi MN", "DM Sans", sans-serif';
    ctx.textBaseline = 'alphabetic';
    fillTextSpaced(ctx, 'SPEAKEASY', 100, 120, 11);

    // Title. Uppercased for the same reason every other Gurmukhi MN heading
    // in the app is styled with text-transform: uppercase (see
    // css/theme-deco.css) instead of drawn as typed: the font's accented
    // Latin glyphs (é, ñ, á, ç…) only exist in its uppercase set, so a
    // mixed-case name like "Piña Colada" silently loses its tilde where an
    // ordinary DOM heading would just pick that glyph up from the CSS
    // transform — canvas fillText draws the literal string with no such
    // transform applied for us.
    ctx.fillStyle = COLOR_WHITE;
    const { fontSize, lines: titleLines } = fitTitle(ctx, recipe.name, titleFontSize(recipe.name), 640, 2);
    const lineHeight = fontSize * 1.12;
    // Rebalanced for the larger type scale: a 2-line title at the largest
    // tier plus the enlarged button needs more vertical room than the old
    // constants (tuned when everything was smaller) left, which pushed the
    // button below the card's bottom edge for any short name that wraps.
    // SPEAKEASY moved up (see its y= above) to free up that space rather
    // than shrinking the type back down.
    const titleY = 190 + fontSize * 0.7;
    titleLines.forEach((line, i) => {
      ctx.fillText(line, 100, titleY + i * lineHeight);
    });

    // Fake "View Drink" button — decorative CTA flavor, in place of the
    // glassware/method or riff-attribution line; matches the fallback
    // card's button for a consistent look across both. Sized up for the
    // same thumbnail-legibility reason as the SPEAKEASY label above.
    const btnRowY = titleY + titleLines.length * lineHeight + 20;
    ctx.font = '600 38px "DM Sans", sans-serif';
    const btnText = 'View Drink  →';
    const btnPaddingX = 44, btnHeight = 92;
    const btnWidth = ctx.measureText(btnText).width + btnPaddingX * 2;
    drawRoundedRect(ctx, 100, btnRowY, btnWidth, btnHeight, btnHeight / 2);
    ctx.strokeStyle = COLOR_GOLD;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = COLOR_GOLD;
    ctx.textBaseline = 'middle';
    ctx.fillText(btnText, 100 + btnPaddingX, btnRowY + btnHeight / 2 + 1);
    ctx.textBaseline = 'alphabetic';

    // Glass art
    const glassSvgFragment = renderGlassSvg(recipe, 'sharecard', { mode: 'layered' });
    // Same fix as the (now-removed) server-side renderer needed: a data-URI
    // <img> is an isolated document with no access to the app's stylesheet,
    // and the layered-vs-blended toggle (.fluid-layered-group opacity) lives
    // entirely in css/counter-view.css keyed on a data-mode attribute. Bake
    // "layered" mode in directly so the glass doesn't render as the blended
    // body (which paints last and would otherwise cover the layers).
    const glassSvg = glassSvgFragment
      // renderGlassSvg's fragment is meant for innerHTML, where the browser
      // infers the SVG namespace from context — loaded standalone via an
      // <img> data URI, it's parsed as its own XML document and needs an
      // explicit xmlns or the image fails to decode entirely.
      .replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"')
      .replace(
        '<defs>',
        '<defs><style>.fluid-layered-group{opacity:1}.fluid-blended-group{opacity:0}</style>'
      );
    const viewBoxMatch = glassSvg.match(/viewBox="0 [-.\d]+ 240 ([.\d]+)"/);
    const vbHeight = viewBoxMatch ? parseFloat(viewBoxMatch[1]) : 300;
    const glassAspect = 240 / vbHeight;
    // Contain-fit within a box rather than a fixed height: glassware varies
    // a lot in its own aspect ratio (a short, wide Rocks tumbler vs. a tall,
    // narrow Coupe/Martini stem), and a fixed height let short/wide glasses
    // compute a width that broke past the card's right border entirely.
    const GLASS_MAX_WIDTH = 340;
    const GLASS_MAX_HEIGHT = 460;
    let glassRenderHeight = GLASS_MAX_HEIGHT;
    let glassRenderWidth = glassRenderHeight * glassAspect;
    if (glassRenderWidth > GLASS_MAX_WIDTH) {
      glassRenderWidth = GLASS_MAX_WIDTH;
      glassRenderHeight = glassRenderWidth / glassAspect;
    }

    const glassImg = await loadImage(svgToDataUri(glassSvg));
    const glassColumnCenterX = 930;
    const glassX = glassColumnCenterX - glassRenderWidth / 2;
    const glassY = (CARD_HEIGHT - glassRenderHeight) / 2;
    ctx.drawImage(glassImg, glassX, glassY, glassRenderWidth, glassRenderHeight);

    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
}
