/**
 * Cloudflare Pages Function: GET /share/:id
 *
 * A real (non-hash) URL for a shared cocktail, so link-preview crawlers
 * (iMessage, Slack, Twitter/X, etc.) get per-recipe <title>/OG tags — a bot
 * fetching /app#share/:id would only ever see the generic app.html, since
 * the fragment after "#" never reaches the server. Human visitors are
 * bounced straight into the real SPA route via meta-refresh + JS redirect;
 * this page itself is never meant to be looked at.
 */

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const SHARE_ID_PATTERN = /^[23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]{1,32}$/;

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

<meta name="twitter:card" content="${imageUrl ? 'summary_large_image' : 'summary'}">
<meta name="twitter:title" content="${escapeHtml(title)}">
<meta name="twitter:description" content="${escapeHtml(description)}">
${imageUrl ? `<meta name="twitter:image" content="${escapeHtml(imageUrl)}">` : ''}

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
  const { params, env, request } = context;
  const origin = new URL(request.url).origin;
  const genericAppUrl = `${origin}/app`;

  if (!env || !env.speakeasy_db) {
    return htmlResponse(renderShell({
      appUrl: genericAppUrl,
      title: 'Speakeasy: Cocktail Recipe Library',
      description: 'Cocktail recipe library with interactive fluid layers and instant spec parsing.',
      imageUrl: null,
      canonicalUrl: genericAppUrl,
    }));
  }

  const shareId = typeof params.id === 'string' ? params.id.trim() : '';
  if (!shareId || !SHARE_ID_PATTERN.test(shareId)) {
    return htmlResponse(renderShell({
      appUrl: genericAppUrl,
      title: 'Speakeasy: Cocktail Recipe Library',
      description: 'This link is no longer valid or doesn’t exist.',
      imageUrl: null,
      canonicalUrl: genericAppUrl,
    }), 404);
  }

  const row = await env.speakeasy_db.prepare(
    `SELECT recipe FROM shares WHERE share_id = ?`
  ).bind(shareId).first();

  // ROUTING MIGRATION: this is the one hash-coupled line in this file — the
  // in-app destination a real visitor gets bounced to. If/when the app's
  // router (js/router.js, app.js) moves from `#`-based to real path-based
  // routing, this becomes whatever the new path for "open share <id> in the
  // app" is (very likely just `canonicalUrl` below, i.e. no redirect at
  // all — this whole shell page could probably be replaced by a Function
  // that serves the real app document with rewritten <title>/OG tags
  // in-place, once paths are meaningful).
  const appUrl = `${origin}/app#share/${shareId}`;
  const canonicalUrl = `${origin}/share/${shareId}`;

  if (!row) {
    return htmlResponse(renderShell({
      appUrl: genericAppUrl,
      title: 'Speakeasy: Cocktail Recipe Library',
      description: 'This link is no longer valid or doesn’t exist.',
      imageUrl: null,
      canonicalUrl: genericAppUrl,
    }), 404);
  }

  let recipe;
  try {
    recipe = JSON.parse(row.recipe);
  } catch {
    return htmlResponse(renderShell({
      appUrl: genericAppUrl,
      title: 'Speakeasy: Cocktail Recipe Library',
      description: 'This link is no longer valid or doesn’t exist.',
      imageUrl: null,
      canonicalUrl: genericAppUrl,
    }), 500);
  }

  const description = recipe.riffOfName
    ? `A riff on ${recipe.riffOfName} · ${recipe.glassware || 'Rocks'} · ${recipe.method || 'Stirred'}`
    : `${recipe.glassware || 'Rocks'} · ${recipe.method || 'Stirred'}`;

  return htmlResponse(renderShell({
    appUrl,
    title: `${recipe.name} — Speakeasy`,
    description,
    imageUrl: `${origin}/share/${shareId}/og.png`,
    canonicalUrl,
  }));
}
