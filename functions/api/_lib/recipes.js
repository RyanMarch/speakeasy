/**
 * Shared D1 row -> JSON mapper for recipe rows (custom_recipes / global_recipes).
 * Consolidates what admin/recipes.js and sync.js each hand-rolled separately
 * for the same underlying columns, which had already started to drift (e.g.
 * only one of the two included `userId`).
 */
export function mapRecipeRow(row, options = {}) {
  const { isGlobal = false, includeUserId = false, includeIsPublic = false, includePublishedBy = false, includeTimestamps = false } = options;

  let specs = [];
  try { specs = JSON.parse(row.specs || '[]'); } catch {}
  let tags = [];
  try { tags = JSON.parse(row.tags || '[]'); } catch {}

  const mapped = {
    id: row.id,
    name: row.name,
    glassware: row.glassware || 'Rocks',
    method: row.method || 'Stirred',
    specs,
    instructions: row.instructions || '',
    description: row.description || '',
    notes: row.notes || '',
    garnish: row.garnish || '',
    source: row.source || '',
    sourceUrl: row.source_url || '',
    riffOfId: row.riff_of_id || null,
    riffOfName: row.riff_of_name || '',
    tags,
  };

  if (isGlobal) mapped.isGlobal = true;
  if (includeUserId) mapped.userId = row.user_id;
  if (includeIsPublic) mapped.isPublic = Boolean(row.is_public);
  if (includePublishedBy) mapped.publishedBy = row.published_by || 'admin';
  if (includeTimestamps) {
    mapped.createdAt = row.created_at;
    mapped.updatedAt = row.updated_at;
  }

  return mapped;
}
