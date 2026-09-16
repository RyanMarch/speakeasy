/**
 * Cloudflare Pages Function: GET /drink/:id/og.png
 *
 * Seed cocktails have no client-rendered image stored anywhere — there's no
 * share-creation step to render one at, unlike custom recipes (see
 * functions/share/[id]/og.png.js, which serves a real per-recipe image a
 * user's browser generated) — so this always serves the same static
 * generic card. Real per-drink art for all ~180 seed cocktails is possible
 * (pre-rendered once, offline, and shipped as static assets — same
 * zero-runtime-cost approach as this fallback) but is a separate, larger
 * follow-up, not done here.
 */
export async function onRequestGet(context) {
  return context.env.ASSETS.fetch(new URL('/assets/og-fallback.png', context.request.url));
}
