/**
 * Cloudflare Pages Function: POST /api/history/log
 *
 * Logs a drink creation event to the D1 drink_history table for authenticated users.
 */

import { jsonResponse } from '../_lib/http.js';
import { requireSession } from '../_lib/auth.js';

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env || !env.speakeasy_db) {
    return jsonResponse({ error: 'Database binding (speakeasy_db) is unavailable.' }, 500);
  }

  // 1. Verify session
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;
  const { userId } = session;

  // 2. Parse payload: { recipeId: string, madeAt?: string }
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body.' }, 400);
  }

  if (!body || typeof body !== 'object') {
    return jsonResponse({ error: 'Payload must be a JSON object.' }, 400);
  }

  const recipeId = typeof body.recipeId === 'string' ? body.recipeId.trim() : '';
  if (!recipeId) {
    return jsonResponse({ error: 'Missing or invalid recipeId.' }, 400);
  }

  // Determine timestamp
  const madeAt = typeof body.madeAt === 'string' && body.madeAt.trim()
    ? body.madeAt.trim()
    : new Date().toISOString();

  const id = crypto.randomUUID();

  // 3. Insert into drink_history
  await env.speakeasy_db.prepare(
    `INSERT INTO drink_history (id, user_id, recipe_id, made_at) VALUES (?, ?, ?, ?)`
  ).bind(id, userId, recipeId, madeAt).run();

  return jsonResponse({
    success: true,
    entry: {
      id,
      recipeId,
      madeAt,
    },
  });
}
