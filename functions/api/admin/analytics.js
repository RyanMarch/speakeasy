/**
 * Cloudflare Pages Function: GET /api/admin/analytics
 *
 * Provides aggregated product and usage metrics for the Speakeasy Admin Dashboard:
 * - Popularity: Most/least viewed cocktails, most poured drinks ("I Made This")
 * - Search Analytics: Most frequent queries, zero-result terms
 * - Ingredients: Most required in cocktail specs, most frequently stocked across user bars
 * - Devices & Traffic: Desktop vs. Mobile distribution (plus Cloudflare Web Analytics GraphQL if configured)
 * - Feature Usage: Menu builder, riff lineage editor, wake lock, unit toggle
 * - Account Stats: Total users, 7d/30d active, total bars, custom recipes
 */

import { checkAdminAuth, jsonResponse } from './_auth.js';

const DAY_SECONDS = 86400;

export async function onRequestGet(context) {
  const authErr = await checkAdminAuth(context);
  if (authErr) return authErr;

  const { request, env } = context;
  if (!env || !env.speakeasy_db) {
    return jsonResponse({ error: 'Database unavailable' }, 500);
  }

  const url = new URL(request.url);
  const daysParam = url.searchParams.get('days');
  const days = daysParam === 'all' ? 0 : Math.min(Math.max(parseInt(daysParam, 10) || 30, 1), 365);

  const now = new Date();
  const dateThreshold = days > 0 ? new Date(Date.now() - days * DAY_SECONDS * 1000).toISOString() : null;

  try {
    // 1. General Overview & User Accounts
    const [userStats, customRecipeStats, barStats, drinkHistoryStats] = await Promise.all([
      env.speakeasy_db.prepare(
        `SELECT 
           COUNT(*) AS total_users,
           SUM(CASE WHEN created_at >= datetime('now', '-7 days') THEN 1 ELSE 0 END) AS users_7d,
           SUM(CASE WHEN created_at >= datetime('now', '-30 days') THEN 1 ELSE 0 END) AS users_30d
         FROM users`
      ).first().catch(() => ({ total_users: 0, users_7d: 0, users_30d: 0 })),

      env.speakeasy_db.prepare(
        `SELECT 
           COUNT(*) AS total_custom,
           SUM(CASE WHEN riff_of_id IS NOT NULL THEN 1 ELSE 0 END) AS total_riffs,
           SUM(CASE WHEN is_public = 1 THEN 1 ELSE 0 END) AS total_public
         FROM custom_recipes`
      ).first().catch(() => ({ total_custom: 0, total_riffs: 0, total_public: 0 })),

      env.speakeasy_db.prepare(
        `SELECT COUNT(*) AS total_bars FROM bars`
      ).first().catch(() => ({ total_bars: 0 })),

      env.speakeasy_db.prepare(
        dateThreshold
          ? `SELECT COUNT(*) AS total_pours FROM drink_history WHERE made_at >= ?`
          : `SELECT COUNT(*) AS total_pours FROM drink_history`
      ).bind(...(dateThreshold ? [dateThreshold] : [])).first().catch(() => ({ total_pours: 0 })),
    ]);

    // 2. Recipe Views (Most & Least Viewed)
    const viewsQuery = dateThreshold
      ? `SELECT target_id, COUNT(*) AS views 
         FROM analytics_events 
         WHERE event_type = 'recipe_view' AND created_at >= ?
         GROUP BY target_id 
         ORDER BY views DESC`
      : `SELECT target_id, COUNT(*) AS views 
         FROM analytics_events 
         WHERE event_type = 'recipe_view' 
         GROUP BY target_id 
         ORDER BY views DESC`;

    const viewsResult = await env.speakeasy_db.prepare(viewsQuery)
      .bind(...(dateThreshold ? [dateThreshold] : []))
      .all().catch(() => ({ results: [] }));
    const viewRows = viewsResult.results || [];

    const topViews = viewRows.slice(0, 15);
    // Reverse for least viewed with at least 1 view, or tail end
    const leastViews = [...viewRows].reverse().slice(0, 10);

    // 3. Most Poured Cocktails (from drink_history)
    const poursQuery = dateThreshold
      ? `SELECT recipe_id, COUNT(*) AS pour_count, MAX(made_at) AS last_poured
         FROM drink_history
         WHERE made_at >= ?
         GROUP BY recipe_id
         ORDER BY pour_count DESC
         LIMIT 15`
      : `SELECT recipe_id, COUNT(*) AS pour_count, MAX(made_at) AS last_poured
         FROM drink_history
         GROUP BY recipe_id
         ORDER BY pour_count DESC
         LIMIT 15`;

    const poursResult = await env.speakeasy_db.prepare(poursQuery)
      .bind(...(dateThreshold ? [dateThreshold] : []))
      .all().catch(() => ({ results: [] }));
    const topPours = poursResult.results || [];

    // 4. Most Popular Searches & Zero-result queries
    const searchQuery = dateThreshold
      ? `SELECT query, COUNT(*) AS search_count, MAX(created_at) AS last_searched
         FROM analytics_events
         WHERE event_type = 'search' AND query IS NOT NULL AND query != '' AND created_at >= ?
         GROUP BY query
         ORDER BY search_count DESC
         LIMIT 20`
      : `SELECT query, COUNT(*) AS search_count, MAX(created_at) AS last_searched
         FROM analytics_events
         WHERE event_type = 'search' AND query IS NOT NULL AND query != ''
         GROUP BY query
         ORDER BY search_count DESC
         LIMIT 20`;

    const searchResult = await env.speakeasy_db.prepare(searchQuery)
      .bind(...(dateThreshold ? [dateThreshold] : []))
      .all().catch(() => ({ results: [] }));

    // 5. Frequently Stocked Ingredients in User Bars
    const stockedIngredientsResult = await env.speakeasy_db.prepare(
      `SELECT ingredient_id, COUNT(*) AS bar_count
       FROM bar_inventory
       GROUP BY ingredient_id
       ORDER BY bar_count DESC
       LIMIT 15`
    ).all().catch(() => ({ results: [] }));

    // 6. Device Distribution (Mobile vs Desktop)
    const deviceQuery = dateThreshold
      ? `SELECT device_type, COUNT(*) AS count
         FROM analytics_events
         WHERE created_at >= ?
         GROUP BY device_type`
      : `SELECT device_type, COUNT(*) AS count
         FROM analytics_events
         GROUP BY device_type`;

    const deviceResult = await env.speakeasy_db.prepare(deviceQuery)
      .bind(...(dateThreshold ? [dateThreshold] : []))
      .all().catch(() => ({ results: [] }));

    let mobileCount = 0;
    let desktopCount = 0;
    for (const d of deviceResult.results || []) {
      if (d.device_type === 'mobile') mobileCount += d.count;
      else desktopCount += d.count;
    }

    // 7. Feature Usage breakdown
    const featureQuery = dateThreshold
      ? `SELECT target_id AS feature_name, COUNT(*) AS count
         FROM analytics_events
         WHERE event_type = 'feature_use' AND created_at >= ?
         GROUP BY target_id
         ORDER BY count DESC`
      : `SELECT target_id AS feature_name, COUNT(*) AS count
         FROM analytics_events
         WHERE event_type = 'feature_use'
         GROUP BY target_id
         ORDER BY count DESC`;

    const featureResult = await env.speakeasy_db.prepare(featureQuery)
      .bind(...(dateThreshold ? [dateThreshold] : []))
      .all().catch(() => ({ results: [] }));

    // Total events recorded
    const totalEventsRow = await env.speakeasy_db.prepare(
      dateThreshold
        ? `SELECT COUNT(*) AS total FROM analytics_events WHERE created_at >= ?`
        : `SELECT COUNT(*) AS total FROM analytics_events`
    ).bind(...(dateThreshold ? [dateThreshold] : [])).first().catch(() => ({ total: 0 }));

    // 8. Optional Cloudflare Web Analytics GraphQL query if token and account id exist
    let cloudflareRUM = null;
    const cfApiToken = env.CF_API_TOKEN || env.CF_ACCOUNT_TOKEN;
    if (cfApiToken && env.CF_ACCOUNT_ID) {
      try {
        const sinceIso = dateThreshold || new Date(Date.now() - 30 * DAY_SECONDS * 1000).toISOString();
        const untilIso = now.toISOString();
        const host = (url.hostname === 'localhost' || url.hostname === '127.0.0.1')
          ? (env.CF_ANALYTICS_HOST || 'speakeasy.ryanmarch.me')
          : url.hostname;

        const cfQuery = `
          query($accountTag: string!, $since: string!, $until: string!, $host: string!) {
            viewer {
              accounts(filter: { accountTag: $accountTag }) {
                pageviews: rumPageloadEventsAdaptiveGroups(
                  limit: 100
                  filter: { datetime_geq: $since, datetime_leq: $until, requestHost: $host }
                  orderBy: [date_ASC]
                ) {
                  count
                  dimensions { date }
                }
                devices: rumPageloadEventsAdaptiveGroups(
                  limit: 5
                  filter: { datetime_geq: $since, datetime_leq: $until, requestHost: $host }
                  orderBy: [count_DESC]
                ) {
                  count
                  dimensions { deviceType }
                }
              }
            }
          }
        `;

        const cfRes = await fetch('https://api.cloudflare.com/client/v4/graphql', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${cfApiToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: cfQuery,
            variables: {
              accountTag: env.CF_ACCOUNT_ID,
              since: sinceIso,
              until: untilIso,
              host,
            },
          }),
        });

        if (cfRes.ok) {
          const cfData = await cfRes.json();
          const accountData = cfData?.data?.viewer?.accounts?.[0];
          if (accountData) {
            cloudflareRUM = {
              pageviews: accountData.pageviews || [],
              devices: accountData.devices || [],
            };
          }
        }
      } catch (e) {
        console.warn('[analytics] Cloudflare RUM fetch skipped or failed:', e.message);
      }
    }

    return jsonResponse({
      window_days: days,
      overview: {
        total_users: userStats?.total_users || 0,
        users_7d: userStats?.users_7d || 0,
        users_30d: userStats?.users_30d || 0,
        total_bars: barStats?.total_bars || 0,
        total_custom_recipes: customRecipeStats?.total_custom || 0,
        total_riffs: customRecipeStats?.total_riffs || 0,
        total_public_recipes: customRecipeStats?.total_public || 0,
        total_pours: drinkHistoryStats?.total_pours || 0,
        total_events: totalEventsRow?.total || 0,
      },
      cocktails: {
        top_views: topViews,
        least_views: leastViews,
        top_pours: topPours,
      },
      searches: searchResult.results || [],
      stocked_ingredients: stockedIngredientsResult.results || [],
      devices: {
        mobile: mobileCount,
        desktop: desktopCount,
        total: mobileCount + desktopCount,
      },
      features: featureResult.results || [],
      cloudflare_rum: cloudflareRUM,
    });
  } catch (err) {
    console.error('[analytics] Query error:', err);
    return jsonResponse({ error: 'Failed to aggregate analytics', message: err.message }, 500);
  }
}
