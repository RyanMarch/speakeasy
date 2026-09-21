/**
 * Cloudflare Pages Function: GET /menu/:id
 *
 * The crawler-visible entry point for a published guest menu, so a link pasted
 * into iMessage/Slack unfurls with the menu's name. Real visitors (guests
 * scanning the host's QR code) are bounced into the SPA's guest menu view via
 * the shared shell's meta-refresh + JS redirect; see functions/share/[id].js
 * for why the real route is a hash route.
 */

import { renderShell, htmlResponse } from '../_lib/og-shell.js';
import { MENU_ID_PATTERN } from '../api/menus/_lib.js';

const GENERIC_TITLE = 'Speakeasy: The Craft Cocktail Companion';

export async function onRequestGet(context) {
  const { params, env, request } = context;
  const origin = new URL(request.url).origin;
  const genericAppUrl = `${origin}/app`;

  const notFound = () => htmlResponse(renderShell({
    appUrl: genericAppUrl,
    title: GENERIC_TITLE,
    description: 'This menu is no longer available.',
    imageUrl: null,
    canonicalUrl: genericAppUrl,
  }), 404);

  if (!env || !env.speakeasy_db) {
    return htmlResponse(renderShell({
      appUrl: genericAppUrl,
      title: GENERIC_TITLE,
      description: 'Cocktail recipe library with interactive fluid layers and instant spec parsing.',
      imageUrl: null,
      canonicalUrl: genericAppUrl,
    }));
  }

  const menuId = typeof params.id === 'string' ? params.id.trim() : '';
  if (!menuId || !MENU_ID_PATTERN.test(menuId)) return notFound();

  const row = await env.speakeasy_db.prepare(
    `SELECT name, recipes FROM menus WHERE menu_id = ?`
  ).bind(menuId).first();
  if (!row) return notFound();

  let count = 0;
  try {
    count = JSON.parse(row.recipes).length;
  } catch {
    // Unparseable recipes still deserve a working link; the app shows the error.
  }

  return htmlResponse(renderShell({
    appUrl: `${origin}/app#menu/${menuId}`,
    title: `${row.name} — Speakeasy`,
    description: count > 0
      ? `${count} cocktail${count === 1 ? '' : 's'} on tonight’s menu. Tap to see what’s pouring.`
      : 'Tap to see what’s pouring.',
    imageUrl: `${origin}/assets/og-home.png`,
    canonicalUrl: `${origin}/menu/${menuId}`,
  }));
}
