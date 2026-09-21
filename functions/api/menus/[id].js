/**
 * Cloudflare Pages Function: /api/menus/:id
 *
 *   GET    public — the menu as guests see it (no edit token in the response)
 *   PUT    host   — update name / recipes / "out" list (Bearer edit token)
 *   DELETE host   — unpublish (Bearer edit token)
 */

import { jsonResponse } from '../_lib/http.js';
import {
  MENU_ID_PATTERN, extractEditToken, hashEditToken, hashesMatch,
  sanitizeMenuName, sanitizeMenuRecipes, sanitizeUnavailable,
} from './_lib.js';

function menuIdFrom(params) {
  const id = typeof params.id === 'string' ? params.id.trim() : '';
  return id && MENU_ID_PATTERN.test(id) ? id : null;
}

function safeParse(json, fallback) {
  try {
    return JSON.parse(json);
  } catch {
    return fallback;
  }
}

async function authorize(request, row) {
  const token = extractEditToken(request);
  if (!token) return false;
  return hashesMatch(await hashEditToken(token), row.edit_token_hash);
}

export async function onRequestGet(context) {
  const { params, env } = context;
  if (!env || !env.speakeasy_db) {
    return jsonResponse({ error: 'Database binding (speakeasy_db) is unavailable.' }, 500);
  }
  const menuId = menuIdFrom(params);
  if (!menuId) return jsonResponse({ error: 'Menu not found.' }, 404);

  const row = await env.speakeasy_db.prepare(
    `SELECT name, recipes, unavailable, updated_at FROM menus WHERE menu_id = ?`
  ).bind(menuId).first();
  if (!row) return jsonResponse({ error: 'Menu not found.' }, 404);

  const recipes = safeParse(row.recipes, null);
  if (!Array.isArray(recipes)) return jsonResponse({ error: 'Menu data is corrupted.' }, 500);

  // Availability changes mid-party, so a guest reloading the page must never
  // be served a cached copy.
  return jsonResponse({
    success: true,
    menu: {
      name: row.name,
      recipes,
      unavailable: safeParse(row.unavailable, []),
      updatedAt: row.updated_at,
    },
  }, 200, { 'Cache-Control': 'no-store' });
}

export async function onRequestPut(context) {
  const { params, env, request } = context;
  if (!env || !env.speakeasy_db) {
    return jsonResponse({ error: 'Database binding (speakeasy_db) is unavailable.' }, 500);
  }
  const menuId = menuIdFrom(params);
  if (!menuId) return jsonResponse({ error: 'Menu not found.' }, 404);

  const row = await env.speakeasy_db.prepare(
    `SELECT edit_token_hash, recipes, unavailable FROM menus WHERE menu_id = ?`
  ).bind(menuId).first();
  if (!row) return jsonResponse({ error: 'Menu not found.' }, 404);
  if (!(await authorize(request, row))) return jsonResponse({ error: 'Not authorized.' }, 403);

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body.' }, 400);
  }
  if (!body || typeof body !== 'object') return jsonResponse({ error: 'Invalid JSON body.' }, 400);

  // Partial updates: a "mark Old Fashioned out" toggle sends only `unavailable`,
  // not the whole recipe list again.
  const sets = [];
  const binds = [];
  let recipes = safeParse(row.recipes, []);

  if (body.name !== undefined) {
    const name = sanitizeMenuName(body.name);
    if (!name) return jsonResponse({ error: 'Menu name cannot be empty.' }, 400);
    sets.push('name = ?');
    binds.push(name);
  }
  if (body.recipes !== undefined) {
    const cleaned = sanitizeMenuRecipes(body.recipes);
    if (!cleaned || cleaned.length === 0) {
      return jsonResponse({ error: 'A menu needs at least one cocktail (and must be a reasonable size).' }, 400);
    }
    recipes = cleaned;
    sets.push('recipes = ?');
    binds.push(JSON.stringify(cleaned));
    // Re-validate the "out" list against the new recipes even when the caller
    // didn't resend it, so a removed drink can't linger in it.
    if (body.unavailable === undefined) body.unavailable = safeParse(row.unavailable, []);
  }
  if (body.unavailable !== undefined) {
    sets.push('unavailable = ?');
    binds.push(JSON.stringify(sanitizeUnavailable(body.unavailable, recipes)));
  }
  if (sets.length === 0) return jsonResponse({ error: 'Nothing to update.' }, 400);

  sets.push('updated_at = CURRENT_TIMESTAMP');
  await env.speakeasy_db.prepare(
    `UPDATE menus SET ${sets.join(', ')} WHERE menu_id = ?`
  ).bind(...binds, menuId).run();

  return jsonResponse({ success: true });
}

export async function onRequestDelete(context) {
  const { params, env, request } = context;
  if (!env || !env.speakeasy_db) {
    return jsonResponse({ error: 'Database binding (speakeasy_db) is unavailable.' }, 500);
  }
  const menuId = menuIdFrom(params);
  if (!menuId) return jsonResponse({ error: 'Menu not found.' }, 404);

  const row = await env.speakeasy_db.prepare(
    `SELECT edit_token_hash FROM menus WHERE menu_id = ?`
  ).bind(menuId).first();
  if (!row) return jsonResponse({ success: true });
  if (!(await authorize(request, row))) return jsonResponse({ error: 'Not authorized.' }, 403);

  await env.speakeasy_db.prepare(`DELETE FROM menus WHERE menu_id = ?`).bind(menuId).run();
  return jsonResponse({ success: true });
}
