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
