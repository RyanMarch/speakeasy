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
import { renderShell, htmlResponse } from '../_lib/og-shell.js';

export async function onRequestGet(context) {
  const { params, request } = context;
  const origin = new URL(request.url).origin;
  const genericAppUrl = `${origin}/app`;

  const recipeId = typeof params.id === 'string' ? params.id.trim() : '';
  const recipe = SEED_RECIPES.find(r => r.id === recipeId);

  if (!recipe) {
    return htmlResponse(renderShell({
      appUrl: genericAppUrl,
      title: 'Speakeasy: The Craft Cocktail Companion',
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
