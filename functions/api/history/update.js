/**
 * Cloudflare Pages Function: POST /api/history/update
 *
 * Updates the rating and/or tasting notes on an existing drink_history entry,
 * scoped to the authenticated user so one account can never edit another's history.
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

  // 2. Parse payload: { id: string, rating?: number|null, notes?: string|null }
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body.' }, 400);
  }

  if (!body || typeof body !== 'object') {
    return jsonResponse({ error: 'Payload must be a JSON object.' }, 400);
  }

  const id = typeof body.id === 'string' ? body.id.trim() : '';
  if (!id) {
    return jsonResponse({ error: 'Missing or invalid id.' }, 400);
  }

  let rating = null;
  if (body.rating !== undefined && body.rating !== null) {
    const parsedRating = Number(body.rating);
    if (!Number.isInteger(parsedRating) || parsedRating < 1 || parsedRating > 5) {
      return jsonResponse({ error: 'rating must be an integer between 1 and 5.' }, 400);
    }
    rating = parsedRating;
  }

  const notes = typeof body.notes === 'string' && body.notes.trim() ? body.notes.trim() : null;

  // 3. Confirm the entry exists and belongs to this user
  const existing = await env.speakeasy_db.prepare(
    `SELECT id FROM drink_history WHERE id = ? AND user_id = ?`
  ).bind(id, userId).first();

  if (!existing) {
    return jsonResponse({ error: 'History entry not found.' }, 404);
  }

  // 4. Update rating and notes
  await env.speakeasy_db.prepare(
    `UPDATE drink_history SET rating = ?, notes = ? WHERE id = ? AND user_id = ?`
  ).bind(rating, notes, id, userId).run();

  return jsonResponse({
    success: true,
    entry: { id, rating, notes },
  });
}
