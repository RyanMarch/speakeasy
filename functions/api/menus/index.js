/**
 * Cloudflare Pages Function: POST /api/menus
 *
 * Publishes a host's menu for guests and returns a short public link plus a
 * one-time edit token. Creating a menu needs a signed-in session; after that the
 * token (stored hashed) is the host's credential for updating or unpublishing it,
 * so a guest link keeps working for the host even if their session lapses.
 */

import { jsonResponse } from '../_lib/http.js';
import { requireSession } from '../_lib/auth.js';
import {
  generateMenuId, generateEditToken, hashEditToken,
  sanitizeMenuName, sanitizeMenuRecipes, sanitizeUnavailable, sanitizeFeatured,
} from './_lib.js';

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env || !env.speakeasy_db) {
    return jsonResponse({ error: 'Database binding (speakeasy_db) is unavailable.' }, 500);
  }

  // Building a menu is part of having an account. Guests only ever read a menu
  // (GET) and the host edits or removes theirs with the edit token, so only
  // creating one needs a session.
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body.' }, 400);
  }

  const name = sanitizeMenuName(body && body.name) || 'Tonight’s Menu';
  const recipes = sanitizeMenuRecipes(body && body.recipes);
  if (!recipes || recipes.length === 0) {
    return jsonResponse({ error: 'A menu needs at least one cocktail (and must be a reasonable size).' }, 400);
  }
  const unavailable = sanitizeUnavailable(body.unavailable, recipes);
  const featured = sanitizeFeatured(body.featured, recipes);

  const editToken = generateEditToken();
  const editTokenHash = await hashEditToken(editToken);

  const MAX_ATTEMPTS = 5;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const menuId = generateMenuId();
    try {
      await env.speakeasy_db.prepare(
        `INSERT INTO menus (menu_id, edit_token_hash, name, recipes, unavailable, featured) VALUES (?, ?, ?, ?, ?, ?)`
      ).bind(menuId, editTokenHash, name, JSON.stringify(recipes), JSON.stringify(unavailable), JSON.stringify(featured)).run();

      const origin = new URL(request.url).origin;
      return jsonResponse({
        success: true,
        menuId,
        editToken,
        // The crawler-visible shell (functions/menu/[id].js), same reasoning
        // as shares: it redirects real visitors into /app#menu/:id.
        url: `${origin}/menu/${menuId}`,
      });
    } catch (err) {
      console.error('menus INSERT failed:', err && err.stack || err);
      if (attempt === MAX_ATTEMPTS - 1) {
        return jsonResponse({ error: 'Failed to publish menu. Please try again.' }, 500);
      }
    }
  }
}
