/**
 * Speakeasy "show the bartender" order card: the words, and the guest's name.
 * There's no ordering backend on purpose: a guest shows their phone to the
 * host, or sends them a message. This builds that message.
 */

const NAME_KEY = 'speakeasy_guest_name';
export const MAX_NAME_LENGTH = 30;

// Example names for the "Add your name" field: period nicknames. Only ever shown
// as a placeholder, never entered for the guest.
const NAME_EXAMPLES = [
  'Dapper Dan', 'Lucky Lou', 'Velvet Vic', 'Miss Fizz', 'Big Sal', 'Smoky Joe', 'Bootleg Betty',
  'The Colonel', 'Gin Rickey', 'Sweet Pea', 'Mack the Knife', 'Duchess', 'Fast Eddie', 'Cleo',
  'Scarface Sue', 'Baby Face', 'Two-Bit Tilly', 'Legs Malone', 'Fingers Finnegan', 'Rusty Nickel',
  'Diamond Dottie', 'Slim Jim', 'Honey Bourbon', 'Lady Luck', 'Dizzy Dolores', 'Nickels McGee',
  'Silky Sullivan', 'Moonshine Mabel', 'Gentleman Jack', 'Pinstripe Pete', 'Whiskey Wanda',
  'Cufflinks Carl', 'Ragtime Rosie', 'The Professor', 'Flapper Flo', 'Rumrunner Ray', 'Snake Eyes',
  'Cherry Bomb', 'Madame Mint', 'The Okay Gatsby', 'Big Al', 'Peaches', 'Butterscotch Bill',
  'Jazz Hands Jenny', 'Gin Fizz Fred', 'Bee\'s Knees Betty', 'Cat\'s Pajamas Kate', 'Giggle Water Gus',
  'Hooch Harry', 'Doll Face', 'Gin Joint Jimmy', 'The Bootlegger\'s Daughter',
];

/** A random "e.g. …" placeholder; `random` is injectable for tests. */
export function randomNamePlaceholder(random = Math.random) {
  return `e.g. ${NAME_EXAMPLES[Math.floor(random() * NAME_EXAMPLES.length)]}`;
}

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
