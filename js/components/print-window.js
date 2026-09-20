/**
 * Speakeasy Print Window
 * Printing directly out of the main app document (via window.print() on the
 * live page) turned into a whack-a-mole of print-engine bugs — Safari/WebKit
 * in particular fractures flex/grid ancestors and inserts large blank gaps
 * around anything marked page-break-inside:avoid that doesn't quite fit,
 * even after the app shell's own grid/flex layout was neutralized for print.
 * Rather than keep fighting inherited layout from the app's screen-oriented
 * CSS cascade, this opens a brand-new, self-contained popup window with its
 * own minimal inline-styled HTML document — no app shell, no grid/flex
 * ancestors, no inherited cascade at all — and prints *that*. Plain block
 * layout throughout, since that's the one thing every print engine handles
 * correctly.
 */

const BASE_STYLES = /*css*/`
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300..700;1,9..40,300..700&display=swap');

  /* This popup is a brand-new document with no access to the app's own
     stylesheets, so the app's display font is re-declared here rather than
     relied on — same source file, absolute path (this document's base URL
     is the app's own, but a relative '../assets/...' path was written for
     css/ and would resolve wrong from here). */
  @font-face {
    font-family: 'Gurmukhi MN';
    src: url('/assets/fonts/gurmukhi-mn.ttf') format('truetype');
    font-weight: 400 700;
    font-style: normal;
    font-display: swap;
  }

  :root {
    /* Mirrors the app's Art Deco Midnight Navy & Gold theme (theme-deco.css) */
    --color-header-bg: #1b2738;
    --color-surface-card: #2c3b52;
    --color-accent: #ebbc72;
    --color-accent-dark: #c99849;
    --color-text: #ffffff;
    --color-text-secondary: #f0eae1;
    --color-text-muted: #d5dde6;
    --color-text-faint: #9fb0c4;
    --color-text-on-light: #1a2332;
    --color-muted-on-light: #5b6b80;
    --font-display: 'Gurmukhi MN', 'DM Sans', serif;
    --font-sans: 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif;
  }

  @page { margin: 0.5in; }
  * {
    box-sizing: border-box;
    /* Browsers don't expose their "print backgrounds" checkbox to page CSS
       or JS at all, so there's no way to make this card conditionally
       redraw itself in response to it — forcing colors on is the only way
       to guarantee the on-brand navy card actually prints instead of a
       washed-out white one, which is what happens by default in several
       browsers regardless of that checkbox's state. */
    print-color-adjust: exact;
    -webkit-print-color-adjust: exact;
  }
  body {
    margin: 0;
    padding: 24px;
    background: #ffffff;
    font-family: var(--font-sans);
    color: #1a2332;
  }

  /* The layered-vs-blended glass toggle (.fluid-layered-group opacity) lives
     entirely in css/counter-view.css, keyed off a data-mode attribute — this
     isolated document has no access to that stylesheet, so without this both
     groups paint at full opacity, with blended (painted last) covering the
     layers and making every glass look "mixed" regardless of the mode
     requested when the SVG was built. Same fix share-card.js already needed
     for the same reason. */
  .fluid-layered-group { opacity: 1; }
  .fluid-blended-group { opacity: 0; }

  /* Ensure steam lines render clearly on printed recipe cards and menus */
  .garnish-steam {
    display: block !important;
  }
  .garnish-steam-wisp {
    animation: none !important;
  }

  /* Shared brand mark styling — the actual icon/title/subtitle markup is
     produced by renderBrandHeaderBar()/renderBrandRow() below, in one of two
     layouts (a full-bleed page header for documents with no card of their
     own, or a compact row for embedding inside one), but both share these
     class names so the two always render identically: same font, same
     letter-spacing, same gold. Mirrors the real app header (.app-header/
     .brand-title/.brand-subtitle in layout.css and theme-deco.css) as
     closely as a standalone document reasonably can. */
  .pw-brand-icon { color: var(--color-accent); flex-shrink: 0; }
  .pw-brand-title {
    font-family: var(--font-display);
    font-weight: 700;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--color-accent);
    margin: 0;
    line-height: 1;
  }
  .pw-brand-subtitle {
    font-weight: 600;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--color-accent);
    margin-top: 3px;
  }

  /* Full-bleed page header, for documents printed straight onto white paper
     with no bordered card of their own (the guest menu). */
  .pw-header-bar {
    /* The app's real top bar uses --color-header-bg, a near-black navy that
       reads as barely-there in a small printed strip — the recipe card's
       lighter --color-surface-card is the blue people actually associate
       with the brand here, so the print masthead uses that instead. */
    background: var(--color-surface-card);
    border-bottom: 2px solid var(--color-accent);
    /* Cancels the body's own padding so the bar reaches the page edges,
       exactly like the app's own edge-to-edge header. */
    margin: -24px -24px 24px;
    padding: 14px 24px;
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .pw-header-bar .pw-brand-icon { width: 28px; height: 28px; }
  .pw-header-bar .pw-brand-title { font-size: 18px; }
  .pw-header-bar .pw-brand-subtitle { font-size: 10px; }

  /* Compact inline row, for embedding at the top of a card that already has
     its own navy background (the recipe card). */
  .pw-brand-row { display: flex; align-items: center; gap: 8px; margin: 0 0 14px; }
  .pw-brand-row .pw-brand-icon { width: 20px; height: 20px; }
  .pw-brand-row .pw-brand-title { font-size: 15px; }
  .pw-brand-row .pw-brand-subtitle { font-size: 9px; margin-top: 2px; }

  /* Footer for a document with no card — sits directly on the white page. */
  .pw-footer {
    margin-top: 24px;
    padding-top: 12px;
    border-top: 1px solid rgba(235, 188, 114, 0.3);
    text-align: center;
    font-size: 11px;
    letter-spacing: 0.05em;
    color: var(--color-muted-on-light);
  }
  /* Footer for embedding inside a card's own navy background. */
  .pw-card-footer {
    margin-top: 20px;
    padding-top: 12px;
    border-top: 1px solid rgba(235, 188, 114, 0.25);
    text-align: center;
    font-size: 11px;
    letter-spacing: 0.05em;
    color: var(--color-text-faint);
  }
`;

function brandMarkHtml() {
  return /*html*/`
    <svg class="pw-brand-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M8 22h8" />
      <path d="M12 11v11" />
      <path d="m19 3-7 8-7-8Z" />
    </svg>
    <div>
      <div class="pw-brand-title">Speakeasy</div>
      <div class="pw-brand-subtitle">The Craft Cocktail Companion</div>
    </div>
  `;
}

/** Full-bleed navy header bar for a print document with no card of its own. */
export function renderBrandHeaderBar() {
  return /*html*/`<div class="pw-header-bar">${brandMarkHtml()}</div>`;
}

/** Compact brand row for embedding inside a card that already has a navy background. */
export function renderBrandRow() {
  return /*html*/`<div class="pw-brand-row">${brandMarkHtml()}</div>`;
}

function escapeHost(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Footer for a document with no card, printed directly on the white page. */
export function renderFooterHtml() {
  return /*html*/`<div class="pw-footer">${escapeHost(window.location.host)}</div>`;
}

/** Footer for embedding inside a card's own navy background. */
export function renderCardFooterHtml() {
  return /*html*/`<div class="pw-card-footer">${escapeHost(window.location.host)}</div>`;
}

/**
 * Opens a new window, writes a complete standalone HTML document into it
 * (title + inline <style> + bodyHtml), and triggers the print dialog once
 * it has loaded. Returns the new window, or null if the popup was blocked.
 *
 * @param {string} title - document <title> (also what most browsers suggest as the PDF filename)
 * @param {string} styleHtml - extra CSS (plain text, no <style> tag) appended after the shared base styles
 * @param {string} bodyHtml - the printable content
 */
export function openPrintWindow(title, styleHtml, bodyHtml) {
  // No `noopener` here: we deliberately keep a scriptable reference to this
  // window so we can document.write() into it and call print() on it. Safari
  // takes `noopener` literally and hands back a window we can't write into —
  // the popup opens but stays permanently blank.
  const printWin = window.open('', '_blank', 'width=880,height=1140');
  if (!printWin) {
    return null;
  }

  const doc = printWin.document;
  doc.open();
  doc.write(/*html*/`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${title}</title>
<style>${BASE_STYLES}\n${styleHtml}</style>
</head>
<body>${bodyHtml}</body>
</html>`);
  doc.close();

  let hasPrinted = false;
  const triggerPrint = () => {
    if (hasPrinted) return;
    hasPrinted = true;
    printWin.focus();
    printWin.print();
  };

  // The document above has no external resources (no webfonts, no linked
  // stylesheets — every glass illustration is already-rendered inline SVG),
  // so 'load' fires essentially immediately; the short fallback timeout just
  // covers browsers that are slow to fire it for a document.write()'d page.
  printWin.addEventListener('load', triggerPrint);
  setTimeout(triggerPrint, 300);

  return printWin;
}
