/**
 * Cloudflare Pages Function: POST /api/telemetry
 *
 * Receives lightweight, privacy-first telemetry events (recipe views, searches, feature usage).
 * Batched or single event submission supported.
 */

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json;charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

export async function onRequestOptions() {
  return jsonResponse({ ok: true });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env || !env.speakeasy_db) {
    return jsonResponse({ error: 'Database unavailable' }, 500);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }

  // Detect device category (mobile vs desktop)
  const userAgent = request.headers.get('User-Agent') || '';
  const isMobileHeader = request.headers.get('Sec-CH-UA-Mobile');
  let deviceType = 'desktop';

  if (isMobileHeader === '?1') {
    deviceType = 'mobile';
  } else if (/Mobi|Android|iPhone|iPad|iPod/i.test(userAgent)) {
    deviceType = 'mobile';
  }

  const events = Array.isArray(body) ? body : [body];
  const validEvents = [];

  for (const ev of events) {
    if (!ev || typeof ev !== 'object') continue;
    const type = typeof ev.type === 'string' ? ev.type.trim().slice(0, 50) : null;
    if (!type) continue;

    const targetId = typeof ev.targetId === 'string' ? ev.targetId.trim().slice(0, 100) : null;
    const query = typeof ev.query === 'string' ? ev.query.trim().toLowerCase().slice(0, 100) : null;
    const explicitDevice = ev.device === 'mobile' || ev.device === 'desktop' ? ev.device : deviceType;

    validEvents.push({
      type,
      targetId,
      query,
      device: explicitDevice,
    });
  }

  if (validEvents.length === 0) {
    return jsonResponse({ success: true, count: 0 });
  }

  try {
    const statements = validEvents.map(ev =>
      env.speakeasy_db.prepare(
        `INSERT INTO analytics_events (event_type, target_id, query, device_type) VALUES (?, ?, ?, ?)`
      ).bind(ev.type, ev.targetId, ev.query, ev.device)
    );

    if (statements.length === 1) {
      await statements[0].run();
    } else {
      await env.speakeasy_db.batch(statements);
    }
  } catch (err) {
    console.error('[telemetry] Error inserting analytics events:', err);
    return jsonResponse({ error: 'Database insert error', details: err.message }, 500);
  }

  return jsonResponse({ success: true, count: validEvents.length });
}
