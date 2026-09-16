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

import { renderShell, htmlResponse } from '../_lib/og-shell.js';
import { SHARE_ID_PATTERN } from '../api/shares/_lib.js';

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
