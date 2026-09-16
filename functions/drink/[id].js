/**
 * Cloudflare Pages Function: GET /drink/:id
 *
 * A real (non-hash) URL for a *seed* cocktail — the counterpart to
 * /share/:id for custom recipes. Seed recipes are bundled into every
 * install and never touch the shares table, so a plain `#recipe-id` deep
 * link (see shareRecipe() in counter-view.js) always resolved for a human
 * visitor with zero backend involvement — but a link-preview crawler never
 * sees anything after "#", so that link never carried a real title or
 * image. This route looks the id up directly in the same seed data the
 * client ships, and redirects a real visitor straight into /app#:id.
 */
import { SEED_RECIPES } from '../../js/data/seed-recipes.js';

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderShell({ appUrl, title, description, imageUrl, canonicalUrl }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}">
<meta http-equiv="refresh" content="0; url=${escapeHtml(appUrl)}">
<link rel="canonical" href="${escapeHtml(canonicalUrl)}">

<meta property="og:type" content="website">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:url" content="${escapeHtml(canonicalUrl)}">
${imageUrl ? `<meta property="og:image" content="${escapeHtml(imageUrl)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">` : ''}

<meta name="theme-color" content="#020f20">
<script>location.replace(${JSON.stringify(appUrl)});</script>
</head>
<body style="background:#020f20;color:#f0eae1;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
  <p>Redirecting to <a href="${escapeHtml(appUrl)}" style="color:#ebbc72;">${escapeHtml(title)}</a>&hellip;</p>
</body>
</html>`;
}

function htmlResponse(html, status = 200) {
  return new Response(html, {
    status,
    headers: { 'Content-Type': 'text/html;charset=utf-8' },
  });
}

export async function onRequestGet(context) {
  const { params, request } = context;
  const origin = new URL(request.url).origin;
  const genericAppUrl = `${origin}/app`;

  const recipeId = typeof params.id === 'string' ? params.id.trim() : '';
  const recipe = SEED_RECIPES.find(r => r.id === recipeId);

  if (!recipe) {
    return htmlResponse(renderShell({
      appUrl: genericAppUrl,
      title: 'Speakeasy: Cocktail Recipe Library',
      description: 'This link is no longer valid or doesn’t exist.',
      imageUrl: null,
      canonicalUrl: genericAppUrl,
    }), 404);
  }

  // ROUTING MIGRATION: this is the one hash-coupled line in this file — see
  // the matching note in functions/share/[id].js for the full explanation.
  const appUrl = `${origin}/app#${recipeId}`;
  const canonicalUrl = `${origin}/drink/${recipeId}`;
  const description = `${recipe.glassware || 'Rocks'} · ${recipe.method || 'Stirred'}`;

  return htmlResponse(renderShell({
    appUrl,
    title: `${recipe.name} — Speakeasy`,
    description,
    imageUrl: `${origin}/drink/${recipeId}/og.png`,
    canonicalUrl,
  }));
}
