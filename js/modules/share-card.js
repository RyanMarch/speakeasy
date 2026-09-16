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

function titleFontSize(name) {
  const len = (name || '').length;
  if (len > 34) return 46;
  if (len > 24) return 56;
  if (len > 16) return 66;
  return 76;
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

    // "SPEAKEASY" label
    ctx.fillStyle = COLOR_GOLD;
    ctx.font = '600 22px "DM Sans", sans-serif';
    ctx.textBaseline = 'alphabetic';
    fillTextSpaced(ctx, 'SPEAKEASY', 100, 234, 6);

    // Title
    const fontSize = titleFontSize(recipe.name);
    ctx.fillStyle = COLOR_WHITE;
    ctx.font = `700 ${fontSize}px "Playfair Display", Georgia, serif`;
    const titleLines = wrapText(ctx, recipe.name || 'A Speakeasy Cocktail', 620, 2);
    const lineHeight = fontSize * 1.12;
    // Scales with fontSize so the title's cap-height clears the SPEAKEASY
    // label by a consistent margin whether it's rendered at 46px or 76px.
    const titleY = 290 + fontSize * 0.75;
    titleLines.forEach((line, i) => {
      ctx.fillText(line, 100, titleY + i * lineHeight);
    });

    // Subtitle
    const subtitle = recipe.riffOfName
      ? `A riff on ${recipe.riffOfName}`
      : `${recipe.glassware || 'Rocks'} · ${recipe.method || 'Stirred'}`;
    ctx.fillStyle = COLOR_MUTED;
    ctx.font = '400 26px "DM Sans", sans-serif';
    ctx.fillText(subtitle, 100, titleY + titleLines.length * lineHeight + 20);

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
    const glassRenderHeight = 480;
    const glassRenderWidth = Math.round(glassRenderHeight * glassAspect);

    const glassImg = await loadImage(svgToDataUri(glassSvg));
    const glassColumnCenterX = 970;
    const glassX = glassColumnCenterX - glassRenderWidth / 2;
    const glassY = (CARD_HEIGHT - glassRenderHeight) / 2;
    ctx.drawImage(glassImg, glassX, glassY, glassRenderWidth, glassRenderHeight);

    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
}
