/**
 * Speakeasy "show the bartender" order card: the words, and the guest's name.
 * There's no ordering backend on purpose: a guest shows their phone to the
 * host, or sends them a message. This builds that message.
 */

const NAME_KEY = 'speakeasy_guest_name';
export const MAX_NAME_LENGTH = 30;

export function getGuestName() {
  try {
    return (localStorage.getItem(NAME_KEY) || '').slice(0, MAX_NAME_LENGTH);
  } catch {
    return '';
  }
}

export function setGuestName(name) {
  const clean = String(name || '').trim().slice(0, MAX_NAME_LENGTH);
  try {
    if (clean) localStorage.setItem(NAME_KEY, clean);
    else localStorage.removeItem(NAME_KEY);
  } catch {
    // Not remembered, but the card still works for this visit.
  }
  return clean;
}

function joinNames(names) {
  const withThe = names.map(n => `the ${n}`);
  if (withThe.length <= 1) return withThe[0] || '';
  return `${withThe.slice(0, -1).join(', ')} and ${withThe[withThe.length - 1]}`;
}

/**
 * The message a guest sends (or reads out): "Hi! I'd like the Manhattan and the
 * Negroni, please. — Alex". Returns '' when there's nothing to order.
 */
export function buildOrderMessage({ name = '', drinkNames = [] } = {}) {
  const drinks = (drinkNames || []).map(n => String(n).trim()).filter(Boolean);
  if (drinks.length === 0) return '';
  const who = String(name || '').trim();
  return `Hi! I'd like ${joinNames(drinks)}, please.${who ? ` — ${who}` : ''}`;
}
