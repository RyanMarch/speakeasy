/**
 * Bar Basics: how to make the house-made ingredients cocktail recipes lean on.
 *
 * Each entry is keyed by its taxonomy ingredient id (js/modules/taxonomy.js), so
 * any recipe row that resolves to that ingredient can offer the "how to make"
 * sheet, and the Bar Basics tab in the Bar Tools dialog lists them all. Shelf
 * lives are for a clean, sealed bottle in the refrigerator.
 *
 * Measurements follow the user's unit choice (state.unitSystem: 'oz' or 'ml').
 * Ingredient amounts and yields are numeric (u(...), both(...)) so a batch can be
 * scaled; read them through formatAmount()/formatYield() in bar-basics-format.js.
 * Free text that holds a measurement (steps, tips) is { us, metric } read through
 * pickUnit(); a plain string means "same for both".
 *
 * Entry shape:
 *   id          taxonomy id (must exist in TAXONOMY)
 *   group       id of one of BAR_BASICS_GROUPS, which sections the Bar Basics list
 *   name        display name
 *   tagline     one line on what it is / what it's for
 *   ratio       short ratio or headline spec, shown as a badge
 *   yield       approximate finished amount            (numeric, both(...))
 *   time        active + steeping time
 *   ingredients [{ amount (numeric, both(...)), item }]
 *   brix        optional { sugarG, waterMl }: opens the Brix Blender with these
 *   steps       ordered method                         (unit values)
 *   keeps       shelf life, refrigerated
 *   tips        optional extra advice                  (unit values)
 *   note        optional safety / allergen note
 *   credit      optional attribution, when adapted from a published recipe
 */

// Amount helpers (see js/modules/bar-basics-format.js for the shapes and units):
// u(qty, unit, note?) is a numeric amount, both(us, metric) pairs the two systems.
const u = (qty, unit, note) => (note ? { qty, unit, note } : { qty, unit });
const both = (us, metric) => ({ us, metric });

/**
 * The sections of the Bar Basics list, in display order. BAR_BASICS below is kept
 * in the same order, so entries in a group sit together.
 */
export const BAR_BASICS_GROUPS = [
  { id: 'sugar', label: 'Sugar syrups' },
  { id: 'honey_agave', label: 'Honey & agave' },
  { id: 'flavored', label: 'Flavored syrups' },
  { id: 'cordials_nut', label: 'Cordials & nut syrups' },
];

export const BAR_BASICS = [
  {
    id: 'simple_syrup',
    group: 'sugar',
    brix: { sugarG: 200, waterMl: 240 },
    name: 'Simple Syrup',
    tagline: 'The all-purpose bar sweetener: equal parts sugar and water.',
    ratio: '1:1 sugar to water',
    yield: both(u(12, 'oz'), u(350, 'ml')),
    time: '10 minutes',
    ingredients: [
      { amount: both(u(1, 'cup'), u(200, 'g')), item: 'white granulated sugar' },
      { amount: both(u(1, 'cup'), u(240, 'ml')), item: 'water' },
    ],
    steps: [
      'Combine the sugar and water in a small saucepan over medium-low heat.',
      'Stir until the sugar has fully dissolved and the liquid is clear. It does not need to boil.',
      'Let it cool completely, then pour into a clean bottle or jar.',
      'Store in the refrigerator.',
    ],
    keeps: 'About 1 month',
    tips: [
      'No stove? Shake equal parts sugar and very hot tap water in a sealed jar until clear.',
      'Weigh the sugar and water for the most consistent sweetness from batch to batch.',
    ],
  },
  {
    id: 'rich_simple_syrup',
    group: 'sugar',
    brix: { sugarG: 400, waterMl: 240 },
    name: 'Rich Simple Syrup',
    tagline: 'Twice the sugar for a heavier, silkier sweetener that dilutes a drink less.',
    ratio: '2:1 sugar to water',
    yield: both(u(16, 'oz'), u(475, 'ml')),
    time: '10 minutes',
    ingredients: [
      { amount: both(u(2, 'cup'), u(400, 'g')), item: 'white granulated sugar' },
      { amount: both(u(1, 'cup'), u(240, 'ml')), item: 'water' },
    ],
    steps: [
      'Combine the sugar and water in a saucepan over low heat.',
      'Stir gently until the sugar has fully dissolved. Do not let it boil hard, which can cook the syrup and darken it.',
      'Let it cool completely, then bottle and refrigerate.',
    ],
    keeps: '3 to 6 months',
    tips: [
      'It is sweeter by volume, so use about two thirds to three quarters as much when swapping in for 1:1 simple syrup.',
      'It runs thick when cold. Let the bottle sit at room temperature for a few minutes before pouring.',
    ],
  },
  {
    id: 'demerara_syrup',
    group: 'sugar',
    brix: { sugarG: 200, waterMl: 240 },
    name: 'Demerara Syrup',
    tagline: 'Caramel and molasses notes for Old Fashioneds, rum drinks and anything with aged spirits.',
    ratio: '1:1 demerara sugar to water',
    yield: both(u(12, 'oz'), u(350, 'ml')),
    time: '10 minutes',
    ingredients: [
      { amount: both(u(1, 'cup'), u(200, 'g')), item: 'demerara sugar' },
      { amount: both(u(1, 'cup'), u(240, 'ml')), item: 'water' },
    ],
    steps: [
      'Combine the demerara sugar and water in a small saucepan over medium-low heat.',
      'Stir until the crystals have fully dissolved. It does not need to boil.',
      'Let it cool completely, then bottle and refrigerate.',
    ],
    keeps: 'About 1 month',
    tips: [
      'Make it 2:1 (two parts sugar to one part water) for a richer syrup that keeps for months.',
      'Turbinado works as a substitute; the flavor is a little lighter.',
    ],
  },
  {
    id: 'honey_syrup',
    group: 'honey_agave',
    name: 'Honey Syrup',
    tagline: 'Thinned honey that mixes into a cold shaker instead of clumping at the bottom.',
    ratio: '1:1 honey to hot water',
    yield: both(u(8, 'oz'), u(240, 'ml')),
    time: '5 minutes',
    ingredients: [
      { amount: both(u(0.5, 'cup'), u(170, 'g')), item: 'honey' },
      { amount: both(u(0.5, 'cup'), u(120, 'ml')), item: 'hot water' },
    ],
    steps: [
      'Heat the water until steaming hot, but not boiling.',
      'Pour the water over the honey in a jar or heatproof pitcher and stir until fully blended.',
      'Let it cool, then seal and refrigerate.',
    ],
    keeps: '2 to 4 weeks',
    tips: [
      'Use a mild honey such as clover or wildflower. Stronger honeys can take over a drink.',
      'Prefer it thicker and richer? Use 3 parts honey to 1 part water, and pour a little less.',
      'It thickens in the fridge. Warm the jar in your hands or in a bowl of warm water before measuring.',
    ],
  },
  {
    id: 'honey_ginger_syrup',
    group: 'honey_agave',
    name: 'Honey-Ginger Syrup',
    tagline: 'Honey syrup steeped with fresh ginger. The backbone of a Penicillin.',
    ratio: '1:1 honey to water, steeped with fresh ginger',
    yield: both(u(16, 'oz'), u(475, 'ml')),
    time: '10 minutes, plus overnight steeping',
    ingredients: [
      { amount: both(u(1, 'cup'), u(340, 'g')), item: 'honey' },
      { amount: both(u(1, 'cup'), u(240, 'ml')), item: 'water' },
      { amount: both(u(1, 'piece', '6 in'), u(1, 'piece', '15 cm')), item: 'of fresh ginger, peeled and thinly sliced' },
    ],
    steps: [
      'Combine the honey, water and ginger in a saucepan over high heat and bring to a boil.',
      'Reduce the heat to medium and simmer for 5 minutes.',
      'Let it cool, then refrigerate overnight so the ginger keeps steeping.',
      'Strain through cheesecloth into a clean bottle and keep refrigerated.',
    ],
    keeps: 'About 2 weeks',
    tips: [
      'For an extra-fiery drink, use more ginger or grate it instead of slicing.',
      'Use a mild honey such as clover or wildflower so the ginger and the whisky stay in front.',
      'It thickens in the fridge. Warm the bottle in your hands or in a bowl of warm water before measuring.',
    ],
    credit: 'Adapted from the Liquor.com Penicillin recipe.',
  },
  {
    id: 'agave_syrup',
    group: 'honey_agave',
    name: 'Agave Syrup',
    tagline: 'Thinned agave nectar for Margaritas, Palomas and other tequila and mezcal drinks.',
    ratio: '1:1 agave nectar to warm water',
    yield: both(u(8, 'oz'), u(240, 'ml')),
    time: '5 minutes',
    ingredients: [
      { amount: both(u(0.5, 'cup'), u(170, 'g')), item: 'agave nectar' },
      { amount: both(u(0.5, 'cup'), u(120, 'ml')), item: 'warm water' },
    ],
    steps: [
      'Warm the water until it is hot to the touch, not boiling.',
      'Stir the agave nectar into the water until fully blended.',
      'Let it cool, then bottle and refrigerate.',
    ],
    keeps: 'About 1 month',
    tips: [
      'Thinning it makes it pourable and helps it mix into cold drinks. Straight agave nectar sinks and sticks.',
      'Agave is sweeter than sugar, so start with a little less than a recipe calls for in simple syrup.',
    ],
  },
  {
    id: 'ginger_syrup',
    group: 'flavored',
    name: 'Ginger Syrup',
    tagline: 'Spicy, warming ginger syrup for Moscow Mules, Penicillins and whiskey sours.',
    ratio: '1:1 sugar to water, steeped with fresh ginger',
    yield: both(u(10, 'oz'), u(300, 'ml')),
    time: '15 minutes, plus 30 to 60 minutes steeping',
    ingredients: [
      { amount: both(u(1, 'cup'), u(240, 'ml')), item: 'water' },
      { amount: both(u(1, 'cup'), u(200, 'g')), item: 'white granulated sugar' },
      { amount: both(u(4, 'oz'), u(115, 'g')), item: 'fresh ginger, scrubbed and thinly sliced (no need to peel)' },
    ],
    steps: [
      'Combine the water, sugar and ginger in a saucepan and bring to a gentle simmer, stirring until the sugar dissolves.',
      'Reduce the heat and simmer for 10 to 15 minutes.',
      'Remove from the heat, cover, and let steep for 30 to 60 minutes. Longer steeping means a spicier syrup.',
      'Strain out the ginger, cool, then bottle and refrigerate.',
    ],
    keeps: '2 to 3 weeks',
    tips: [
      'For a brighter, zingier version, use equal parts fresh ginger juice and sugar, stirred until dissolved with no heat.',
      'Save the candied ginger slices to eat or use as a garnish.',
    ],
  },
  {
    id: 'cinnamon_syrup',
    group: 'flavored',
    name: 'Cinnamon Syrup',
    tagline: 'Warm baking spice for Old Fashioneds, hot toddies, rum and tiki drinks.',
    ratio: '1:1 sugar to water, steeped with cinnamon sticks',
    yield: both(u(12, 'oz'), u(350, 'ml')),
    time: '15 minutes, plus 30 to 60 minutes steeping',
    ingredients: [
      { amount: both(u(1, 'cup'), u(240, 'ml')), item: 'water' },
      { amount: both(u(1, 'cup'), u(200, 'g')), item: 'white granulated sugar' },
      { amount: both(u(3, 'stick', '3 in'), u(3, 'stick', '8 cm')), item: 'of cinnamon, broken in half' },
    ],
    steps: [
      'Combine the water, sugar and cinnamon sticks in a saucepan over medium heat.',
      'Bring to a gentle simmer, stirring until the sugar dissolves, and simmer for 10 minutes.',
      'Remove from the heat, cover, and steep for 30 to 60 minutes, tasting until it is as strong as you like.',
      'Strain, cool, then bottle and refrigerate.',
    ],
    keeps: 'About 1 month',
    tips: [
      'Cassia sticks give a bolder, spicier syrup. Ceylon is softer and more delicate.',
      'Toast the sticks in a dry pan for a minute first for a deeper flavor.',
    ],
  },
  {
    id: 'vanilla_syrup',
    group: 'flavored',
    name: 'Vanilla Syrup',
    tagline: 'Smooth vanilla sweetness for bourbon, rum, coffee drinks and creamy cocktails.',
    ratio: '1:1 sugar to water, with vanilla',
    yield: both(u(12, 'oz'), u(350, 'ml')),
    time: '10 minutes, plus 30 minutes steeping',
    ingredients: [
      { amount: both(u(1, 'cup'), u(240, 'ml')), item: 'water' },
      { amount: both(u(1, 'cup'), u(200, 'g')), item: 'white granulated sugar' },
      { amount: u(1, 'bean'), item: 'of vanilla, split and scraped' },
    ],
    steps: [
      'Combine the water and sugar in a saucepan over medium-low heat and stir until the sugar dissolves.',
      'Add the scraped seeds and the pod to the syrup, then remove from the heat. Cover and steep for at least 30 minutes.',
      'Strain, cool, then bottle and refrigerate.',
    ],
    keeps: '2 to 4 weeks',
    tips: [
      {
        us: 'No bean? Skip the steeping and stir 1 tablespoon of pure vanilla extract into the syrup once it has cooled.',
        metric: 'No bean? Skip the steeping and stir 15 ml of pure vanilla extract into the syrup once it has cooled.',
      },
      'Rinse and dry the used vanilla pod and keep it in a jar of sugar for vanilla sugar.',
    ],
  },
  {
    id: 'raspberry_syrup',
    group: 'flavored',
    name: 'Raspberry Syrup',
    tagline: 'Bright, tart berry syrup for Clover Clubs, sours and spritzes.',
    ratio: '1:1 sugar to water, cooked with raspberries',
    yield: both(u(10, 'oz'), u(300, 'ml')),
    time: '20 minutes',
    ingredients: [
      { amount: both(u(1, 'cup'), u(125, 'g')), item: 'fresh or frozen raspberries' },
      { amount: both(u(1, 'cup'), u(200, 'g')), item: 'white granulated sugar' },
      { amount: both(u(1, 'cup'), u(240, 'ml')), item: 'water' },
    ],
    steps: [
      'Combine the raspberries, sugar and water in a saucepan over medium heat.',
      'Bring to a gentle simmer, stirring and crushing the berries against the side of the pot, and simmer for about 10 minutes.',
      'Remove from the heat and let it sit for 15 minutes.',
      'Strain through a fine mesh strainer, pressing gently. Line it with cheesecloth for a clearer syrup.',
      'Cool completely, then bottle and refrigerate.',
    ],
    keeps: '1 to 2 weeks',
    tips: [
      'Frozen berries work as well as fresh and are often better out of season.',
      'A squeeze of lemon juice at the end brightens the flavor and helps keep the color.',
    ],
  },
  {
    id: 'grenadine',
    group: 'cordials_nut',
    name: 'Grenadine',
    tagline: 'Real pomegranate grenadine: tart, deep red and nothing like the bright red bottled kind.',
    ratio: '1:1 pomegranate juice to sugar',
    yield: both(u(12, 'oz'), u(350, 'ml')),
    time: '15 minutes',
    ingredients: [
      { amount: both(u(1, 'cup'), u(240, 'ml')), item: '100% pomegranate juice, unsweetened' },
      { amount: both(u(1, 'cup'), u(200, 'g')), item: 'white granulated sugar' },
      { amount: both(u(1, 'tsp'), u(5, 'ml')), item: 'pomegranate molasses (optional, for depth)' },
      { amount: '2 to 3 drops', item: 'orange flower water (optional)' },
    ],
    steps: [
      'Warm the pomegranate juice in a saucepan over medium-low heat until steaming. Do not let it boil, which dulls the flavor.',
      'Add the sugar and stir until fully dissolved.',
      'Off the heat, stir in the pomegranate molasses and the orange flower water, if using.',
      'Cool completely, then bottle and refrigerate.',
    ],
    keeps: '2 to 4 weeks',
    tips: [
      'No heat: shake the juice and sugar together in a sealed jar until dissolved. The flavor is brighter, but it keeps closer to 2 weeks.',
      'A small splash of vodka in the bottle helps it last longer.',
    ],
  },
  {
    id: 'orgeat',
    group: 'cordials_nut',
    name: 'Orgeat',
    tagline: 'Almond syrup with a touch of orange flower water. Essential for a Mai Tai.',
    ratio: '1 part almond milk to 1½ parts sugar',
    yield: both(u(14, 'oz'), u(415, 'ml')),
    time: '15 minutes',
    ingredients: [
      { amount: both(u(1, 'cup'), u(240, 'ml')), item: 'unsweetened almond milk' },
      { amount: both(u(1.5, 'cup'), u(300, 'g')), item: 'white granulated sugar' },
      { amount: both(u(0.5, 'tsp'), u(2.5, 'ml')), item: 'pure almond extract' },
      { amount: both(u(0.5, 'tsp'), u(2.5, 'ml')), item: 'rose water (optional)' },
      { amount: both(u(1, 'tsp'), u(5, 'ml')), item: 'orange flower water' },
      { amount: both(u(2, 'tbsp'), u(30, 'ml')), item: 'cognac or brandy (optional)' },
    ],
    steps: [
      'Shake the almond milk well, then pour it into a small saucepan with the sugar.',
      'Warm over low to medium heat, stirring constantly, until the sugar has completely dissolved. Do not let it boil.',
      'Remove from the heat and let it cool completely.',
      'Stir in the almond extract, the rose water and cognac if you are using them, and the orange flower water.',
      'Bottle and refrigerate. Shake well before each use.',
    ],
    keeps: 'About 1 month',
    tips: [
      'No grinding, soaking or straining: the almond milk does the work of the traditional almonds.',
      'Pick an unsweetened, unflavored almond milk with as few additives as you can find. It is the base of the whole syrup.',
      'Rose water is strong, so use the amount listed and taste before adding more.',
      {
        us: 'For a richer, sweeter syrup, use 2 cups of sugar for each cup of almond milk. Jamie Boudreau’s version, from his Canon Cocktail Book, is made that way and includes the cognac.',
        metric: 'For a richer, sweeter syrup, use 400 g of sugar for each 240 ml of almond milk. Jamie Boudreau’s version, from his Canon Cocktail Book, is made that way and includes the cognac.',
      },
      'It freezes well. Pour it into an ice cube tray and thaw one cube at a time.',
    ],
    note: 'Contains tree nuts (almond milk and almond extract).',
    credit: 'Adapted from Anders Erickson’s quick orgeat syrup recipe, with the optional cognac from Jamie Boudreau’s Canon Cocktail Book.',
  },
];

const BAR_BASICS_BY_ID = new Map(BAR_BASICS.map(entry => [entry.id, entry]));

/** The how-to entry for a taxonomy ingredient id, or null if there is none. */
export function getBarBasic(taxonomyId) {
  return BAR_BASICS_BY_ID.get(taxonomyId) || null;
}

/**
 * Resolves a value that may carry both unit systems. `unitSystem` is the app's
 * unit preference: 'ml' picks the metric form, anything else the US one. Plain
 * strings are returned as-is.
 */
export function pickUnit(value, unitSystem) {
  if (value && typeof value === 'object') {
    return unitSystem === 'ml' ? value.metric : value.us;
  }
  return value;
}
