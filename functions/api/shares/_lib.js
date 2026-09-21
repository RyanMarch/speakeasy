/**
 * Shared share-id alphabet/pattern for Speakeasy's public recipe-sharing
 * surface — generation (shares/index.js) and validation (shares/[id].js,
 * functions/share/[id].js, functions/share/[id]/og.png.js) all derive from
 * this one definition so they can't drift out of sync with each other.
 */
// Unambiguous base58-style alphabet (no 0/O/l/I) for short, easy-to-read,
// hard-to-guess share ids. 10 chars ~= 58.6 bits of entropy.
export const SHARE_ID_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
export const SHARE_ID_LENGTH = 10;
export const SHARE_ID_PATTERN = new RegExp(`^[${SHARE_ID_ALPHABET}]{1,32}$`);

const MAX_ARRAY_ITEMS = 100;

export function generateShareId() {
  const bytes = new Uint8Array(SHARE_ID_LENGTH);
  crypto.getRandomValues(bytes);
  let id = '';
  for (let i = 0; i < SHARE_ID_LENGTH; i++) {
    id += SHARE_ID_ALPHABET[bytes[i] % SHARE_ID_ALPHABET.length];
  }
  return id;
}

export function sanitizeSharedRecipe(body) {
  if (!body || typeof body !== 'object') return null;
  if (typeof body.name !== 'string' || !body.name.trim()) return null;

  const tags = Array.isArray(body.tags)
    ? Array.from(new Set(body.tags.map(t => String(t).trim().toLowerCase()).filter(Boolean))).slice(0, MAX_ARRAY_ITEMS)
    : [];

  const specs = Array.isArray(body.specs)
    ? body.specs.slice(0, MAX_ARRAY_ITEMS).map(s => ({
        amount: s && s.amount !== null && s.amount !== undefined && !isNaN(Number(s.amount)) ? Number(s.amount) : null,
        unit: (s && typeof s.unit === 'string') ? s.unit : '',
        name: (s && typeof s.name === 'string') ? s.name : '',
        abv: s && s.abv !== null && s.abv !== undefined && !isNaN(Number(s.abv)) ? Number(s.abv) : undefined,
      }))
    : [];

  return {
    name: body.name.trim(),
    glassware: typeof body.glassware === 'string' ? body.glassware : 'Rocks',
    method: typeof body.method === 'string' ? body.method : 'Stirred',
    garnish: typeof body.garnish === 'string' ? body.garnish : '',
    instructions: typeof body.instructions === 'string' ? body.instructions : '',
    description: typeof body.description === 'string' ? body.description : '',
    notes: typeof body.notes === 'string' ? body.notes : '',
    source: typeof body.source === 'string' ? body.source : '',
    sourceUrl: typeof body.sourceUrl === 'string' ? body.sourceUrl : '',
    riffOfId: typeof body.riffOfId === 'string' ? body.riffOfId : null,
    riffOfName: typeof body.riffOfName === 'string' ? body.riffOfName : '',
    tags,
    specs,
  };
}
