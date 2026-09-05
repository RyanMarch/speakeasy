/**
 * Speakeasy Ingredient Taxonomy Module
 * Hierarchical cocktail ingredient classification, alias resolution,
 * color mapping, and category-aware search engine.
 */

export const TAXONOMY = {
  // ==========================================
  // 1. BASE SPIRITS (spirits)
  // ==========================================
  // Whiskey Family
  bourbon: {
    id: 'bourbon',
    name: 'Bourbon',
    family: 'whiskey',
    parent: 'spirits',
    color: '#c67828',
    light: '#e5933d',
    dark: '#914f11',
    defaultAbv: 45,
    aliases: ['bourbon whiskey', 'kentucky straight bourbon', 'straight bourbon', 'high-rye bourbon', 'wheated bourbon', 'bourbon'],
  },
  rye_whiskey: {
    id: 'rye_whiskey',
    name: 'Rye Whiskey',
    family: 'whiskey',
    parent: 'spirits',
    color: '#ba6e24',
    light: '#da8737',
    dark: '#884b12',
    defaultAbv: 45,
    aliases: ['rye whiskey', 'straight rye', 'maryland rye', 'rye'],
  },
  blended_scotch: {
    id: 'blended_scotch',
    name: 'Blended Scotch Whisky',
    family: 'whiskey',
    parent: 'spirits',
    color: '#c48232',
    light: '#df9c4e',
    dark: '#8c5519',
    defaultAbv: 40,
    aliases: ['blended scotch', 'blended scotch whisky', 'johnnie walker', 'famous grouse', 'monkey shoulder', 'dewars', 'compass box artist blend'],
  },
  single_malt_scotch: {
    id: 'single_malt_scotch',
    name: 'Single Malt Scotch',
    family: 'whiskey',
    parent: 'spirits',
    color: '#c88636',
    light: '#e19f50',
    dark: '#8f571b',
    defaultAbv: 43,
    aliases: ['single malt scotch', 'single malt', 'speyside scotch', 'highland scotch', 'macallan', 'glenlivet', 'glenfiddich', 'balvenie'],
  },
  peated_scotch: {
    id: 'peated_scotch',
    name: 'Peated / Islay Scotch',
    family: 'whiskey',
    parent: 'spirits',
    color: '#b56d25',
    light: '#d28539',
    dark: '#7f4510',
    defaultAbv: 46,
    aliases: ['peated scotch', 'islay scotch', 'laphroaig', 'ardbeg', 'lagavulin', 'bowmore', 'talisker', 'peated whisky'],
  },
  scotch: {
    id: 'scotch',
    name: 'Scotch Whisky',
    family: 'whiskey',
    parent: 'spirits',
    color: '#c48232',
    light: '#df9c4e',
    dark: '#8c5519',
    defaultAbv: 43,
    aliases: ['scotch', 'scotch whisky', 'blended malt scotch'],
  },
  irish_whiskey: {
    id: 'irish_whiskey',
    name: 'Irish Whiskey',
    family: 'whiskey',
    parent: 'spirits',
    color: '#cb8a3c',
    light: '#e2a45a',
    dark: '#945c1f',
    defaultAbv: 40,
    aliases: ['irish whiskey', 'single pot still irish whiskey', 'blended irish whiskey'],
  },
  japanese_whiskey: {
    id: 'japanese_whiskey',
    name: 'Japanese Whisky',
    family: 'whiskey',
    parent: 'spirits',
    color: '#c88636',
    light: '#e0a052',
    dark: '#92581c',
    defaultAbv: 43,
    aliases: ['japanese whisky', 'japanese whiskey'],
  },
  canadian_whisky: {
    id: 'canadian_whisky',
    name: 'Canadian Whisky',
    family: 'whiskey',
    parent: 'spirits',
    color: '#c07a2c',
    light: '#d99446',
    dark: '#8a4f15',
    defaultAbv: 40,
    aliases: ['canadian whisky', 'canadian whiskey', 'canadian rye'],
  },

  // Cane Spirits Family
  light_rum: {
    id: 'light_rum',
    name: 'Light Rum',
    family: 'rum',
    parent: 'spirits',
    color: '#dbe7ee',
    light: '#edf4f8',
    dark: '#b0c5d2',
    defaultAbv: 40,
    aliases: ['light rum', 'white rum', 'silver rum', 'blanco rum', 'carta blanca'],
  },
  aged_rum: {
    id: 'aged_rum',
    name: 'Gold / Aged Rum',
    family: 'rum',
    parent: 'spirits',
    color: '#9a4c1a',
    light: '#ba662d',
    dark: '#682e09',
    defaultAbv: 40,
    aliases: ['gold rum', 'aged rum', 'añejo rum', 'anejo rum', 'amber rum', 'dark rum', 'navy strength rum', 'demerara rum', 'rum'],
  },
  blackstrap_rum: {
    id: 'blackstrap_rum',
    name: 'Black / Blackstrap Rum',
    family: 'rum',
    parent: 'spirits',
    color: '#451f0b',
    light: '#633116',
    dark: '#240d03',
    defaultAbv: 40,
    aliases: ['blackstrap rum', 'blackstrap', 'black rum', 'goslings', 'coruba', 'cruzan black strap'],
  },
  overproof_rum: {
    id: 'overproof_rum',
    name: 'Overproof Rum',
    family: 'rum',
    parent: 'spirits',
    color: '#c46927',
    light: '#e0833e',
    dark: '#8e4310',
    defaultAbv: 63,
    aliases: ['overproof rum', 'wray & nephew', 'wray and nephew', '151 rum', 'plantation o.f.t.d.', 'o.f.t.d.'],
  },
  jamaican_rum: {
    id: 'jamaican_rum',
    name: 'Jamaican Rum',
    family: 'rum',
    parent: 'spirits',
    color: '#a85b24',
    light: '#c7743b',
    dark: '#753b11',
    defaultAbv: 46,
    aliases: ['jamaican rum', 'high-ester rum', 'funk rum', 'smith & cross', 'smith and cross', 'appleton', 'pot still rum'],
  },
  rhum_agricole: {
    id: 'rhum_agricole',
    name: 'Rhum Agricole',
    family: 'cane_spirits',
    parent: 'spirits',
    color: '#d8e5ec',
    light: '#edf4f8',
    dark: '#adc5d3',
    defaultAbv: 50,
    aliases: ['rhum agricole', 'agricole blanc', 'aged agricole', 'martinique rum', 'agricole'],
  },
  cachaca: {
    id: 'cachaca',
    name: 'Cachaça',
    family: 'cane_spirits',
    parent: 'spirits',
    color: '#dbe7ee',
    light: '#edf4f8',
    dark: '#b0c5d2',
    defaultAbv: 40,
    aliases: ['cachaça', 'cachaca'],
  },

  // Agave Spirits Family
  tequila_blanco: {
    id: 'tequila_blanco',
    name: 'Blanco Tequila',
    family: 'tequila',
    parent: 'spirits',
    color: '#d6e4ec',
    light: '#edf3f8',
    dark: '#a9c2d1',
    defaultAbv: 40,
    aliases: ['blanco tequila', 'silver tequila', 'plata tequila', 'white tequila', 'tequila blanco', 'tequila'],
  },
  tequila_joven: {
    id: 'tequila_joven',
    name: 'Joven / Gold Tequila',
    family: 'tequila',
    parent: 'spirits',
    color: '#deb66c',
    light: '#eed08f',
    dark: '#aa8134',
    defaultAbv: 40,
    aliases: ['joven tequila', 'tequila joven', 'gold tequila', 'oro tequila', 'tequila oro', 'suave tequila'],
  },
  tequila_reposado: {
    id: 'tequila_reposado',
    name: 'Reposado Tequila',
    family: 'tequila',
    parent: 'spirits',
    color: '#d8aa58',
    light: '#eec275',
    dark: '#9f762b',
    defaultAbv: 40,
    aliases: ['reposado tequila', 'tequila reposado', 'reposado'],
  },
  tequila_anejo: {
    id: 'tequila_anejo',
    name: 'Añejo Tequila',
    family: 'tequila',
    parent: 'spirits',
    color: '#be7d31',
    light: '#d8974a',
    dark: '#885317',
    defaultAbv: 40,
    aliases: ['añejo tequila', 'anejo tequila', 'tequila anejo'],
  },
  tequila_extra_anejo: {
    id: 'tequila_extra_anejo',
    name: 'Extra Añejo Tequila',
    family: 'tequila',
    parent: 'spirits',
    color: '#a15d21',
    light: '#bf7938',
    dark: '#713b0d',
    defaultAbv: 40,
    aliases: ['extra añejo', 'extra anejo', 'extra añejo tequila', 'extra anejo tequila'],
  },
  mezcal: {
    id: 'mezcal',
    name: 'Mezcal',
    family: 'agave_spirits',
    parent: 'spirits',
    color: '#d0dfe8',
    light: '#e8f0f5',
    dark: '#a2bdcb',
    defaultAbv: 45,
    aliases: ['mezcal', 'espadín', 'espadin', 'tobalá', 'tobala', 'mezcal joven'],
  },
  regional_agave: {
    id: 'regional_agave',
    name: 'Regional Agave Spirits',
    family: 'agave_spirits',
    parent: 'spirits',
    color: '#d2e1ea',
    light: '#e8f0f5',
    dark: '#a5c0ce',
    defaultAbv: 44,
    aliases: ['raicilla', 'sotol', 'bacanora'],
  },

  // Gin & Juniper Spirits Family
  london_dry_gin: {
    id: 'london_dry_gin',
    name: 'London Dry Gin',
    family: 'gin',
    parent: 'spirits',
    color: '#d2e2ec',
    light: '#e7f0f6',
    dark: '#a5c0d1',
    defaultAbv: 43,
    aliases: ['london dry gin', 'london dry', 'dry gin', 'gin'],
  },
  plymouth_gin: {
    id: 'plymouth_gin',
    name: 'Plymouth Gin',
    family: 'gin',
    parent: 'spirits',
    color: '#d2e2ec',
    light: '#e7f0f6',
    dark: '#a5c0d1',
    defaultAbv: 41.2,
    aliases: ['plymouth gin', 'plymouth'],
  },
  old_tom_gin: {
    id: 'old_tom_gin',
    name: 'Old Tom Gin',
    family: 'gin',
    parent: 'spirits',
    color: '#ddd5bb',
    light: '#f0e9d4',
    dark: '#b2a887',
    defaultAbv: 40,
    aliases: ['old tom gin', 'old tom'],
  },
  genever: {
    id: 'genever',
    name: 'Genever',
    family: 'gin',
    parent: 'spirits',
    color: '#ded7c1',
    light: '#eee8d6',
    dark: '#b3a98e',
    defaultAbv: 38,
    aliases: ['genever', 'dutch gin', 'holland gin'],
  },
  modern_gin: {
    id: 'modern_gin',
    name: 'Modern Gin',
    family: 'gin',
    parent: 'spirits',
    color: '#d2e2ec',
    light: '#e7f0f6',
    dark: '#a5c0d1',
    defaultAbv: 42,
    aliases: ['modern gin', 'contemporary gin', 'botanical gin', 'western gin', 'western dry gin'],
  },
  navy_strength_gin: {
    id: 'navy_strength_gin',
    name: 'Navy Strength Gin',
    family: 'gin',
    parent: 'spirits',
    color: '#d2e2ec',
    light: '#e7f0f6',
    dark: '#a5c0d1',
    defaultAbv: 57,
    aliases: ['navy strength gin', 'navy gin', 'gunpowder gin'],
  },
  sloe_gin: {
    id: 'sloe_gin',
    name: 'Sloe Gin',
    family: 'gin',
    parent: 'spirits',
    color: '#7a1928',
    light: '#9f283c',
    dark: '#500b16',
    defaultAbv: 28,
    aliases: ['sloe gin'],
  },

  // Brandy & Fruit Spirits Family
  cognac: {
    id: 'cognac',
    name: 'Cognac',
    family: 'brandy',
    parent: 'spirits',
    color: '#b96620',
    light: '#d88035',
    dark: '#7f3f0e',
    defaultAbv: 40,
    aliases: ['cognac', 'vs cognac', 'vsop', 'vsop cognac', 'xo cognac', 'xo', 'grape brandy', 'brandy'],
  },
  armagnac: {
    id: 'armagnac',
    name: 'Armagnac',
    family: 'brandy',
    parent: 'spirits',
    color: '#ba6721',
    light: '#d98136',
    dark: '#80400f',
    defaultAbv: 40,
    aliases: ['armagnac'],
  },
  pisco: {
    id: 'pisco',
    name: 'Pisco',
    family: 'brandy',
    parent: 'spirits',
    color: '#dbe7ee',
    light: '#edf4f8',
    dark: '#b0c5d2',
    defaultAbv: 40,
    aliases: ['pisco', 'pisco acholado', 'quebranta'],
  },
  grappa: {
    id: 'grappa',
    name: 'Grappa',
    family: 'brandy',
    parent: 'spirits',
    color: '#dce8ef',
    light: '#edf4f8',
    dark: '#b2c7d4',
    defaultAbv: 42,
    aliases: ['grappa'],
  },
  apple_brandy: {
    id: 'apple_brandy',
    name: 'Apple Brandy',
    family: 'brandy',
    parent: 'spirits',
    color: '#bd7228',
    light: '#dc8d3e',
    dark: '#834710',
    defaultAbv: 45,
    aliases: ['apple brandy', 'calvados', 'applejack', "laird's bonded", 'lairds bonded'],
  },
  eau_de_vie: {
    id: 'eau_de_vie',
    name: 'Fruit Eaux-de-Vie',
    family: 'brandy',
    parent: 'spirits',
    color: '#dce8ef',
    light: '#edf4f8',
    dark: '#b2c7d4',
    defaultAbv: 42,
    aliases: ['eau de vie', 'eaux-de-vie', 'kirsch', 'kirschwasser', 'poire williams', 'slivovitz'],
  },

  // Neutral Spirits Family
  vodka: {
    id: 'vodka',
    name: 'Vodka',
    family: 'neutral_spirits',
    parent: 'spirits',
    color: '#d2e2ec',
    light: '#e7f0f6',
    dark: '#a5c0d1',
    defaultAbv: 40,
    aliases: ['vodka', 'plain vodka', 'grain vodka', 'potato vodka'],
  },
  flavored_vodka: {
    id: 'flavored_vodka',
    name: 'Flavored Vodka',
    family: 'neutral_spirits',
    parent: 'spirits',
    color: '#d5e4ee',
    light: '#eaf1f7',
    dark: '#a8c2d2',
    defaultAbv: 40,
    aliases: ['flavored vodka', 'citrus vodka', 'vanilla vodka'],
  },
  aquavit: {
    id: 'aquavit',
    name: 'Aquavit',
    family: 'neutral_spirits',
    parent: 'spirits',
    color: '#d5e4ee',
    light: '#eaf1f7',
    dark: '#a8c2d2',
    defaultAbv: 42,
    aliases: ['aquavit', 'akvavit'],
  },

  // ==========================================
  // 2. FORTIFIED WINES & SAKES (fortified_wine)
  // ==========================================
  sweet_vermouth: {
    id: 'sweet_vermouth',
    name: 'Sweet Vermouth',
    family: 'vermouth',
    parent: 'fortified_wine',
    color: '#6b1822',
    light: '#8c2430',
    dark: '#470b13',
    defaultAbv: 16.5,
    aliases: ['sweet vermouth', 'red vermouth', 'rosso', 'italian vermouth', 'carpano antica', 'carpano', 'punt e mes'],
  },
  dry_vermouth: {
    id: 'dry_vermouth',
    name: 'Dry Vermouth',
    family: 'vermouth',
    parent: 'fortified_wine',
    color: '#dce6c4',
    light: '#edf4dc',
    dark: '#b0be92',
    defaultAbv: 18,
    aliases: ['dry vermouth', 'french vermouth', 'white vermouth', 'noilly prat', 'dolin dry', 'vermouth'],
  },
  blanc_vermouth: {
    id: 'blanc_vermouth',
    name: 'Blanc / Bianco Vermouth',
    family: 'vermouth',
    parent: 'fortified_wine',
    color: '#e5e9cf',
    light: '#f4f6e6',
    dark: '#bac09c',
    defaultAbv: 16,
    aliases: ['blanc vermouth', 'bianco vermouth', 'dolin blanc', 'carpano bianco', 'bianco'],
  },
  quinquina: {
    id: 'quinquina',
    name: 'Aperitif & Quinquina Wine',
    family: 'quinquina',
    parent: 'fortified_wine',
    color: '#d89b4b',
    light: '#edb569',
    dark: '#a16d25',
    defaultAbv: 17,
    aliases: ['lillet blanc', 'lillet rouge', 'lillet', 'cocchi americano', 'cocchi rosa', 'dubonnet', 'byrrh', 'bonal'],
  },
  dry_sherry: {
    id: 'dry_sherry',
    name: 'Dry Sherry',
    family: 'sherry',
    parent: 'fortified_wine',
    color: '#cb873b',
    light: '#e2a157',
    dark: '#91581d',
    defaultAbv: 17.5,
    aliases: ['dry sherry', 'fino', 'fino sherry', 'manzanilla', 'amontillado', 'oloroso', 'palo cortado', 'sherry'],
  },
  sweet_sherry: {
    id: 'sweet_sherry',
    name: 'Sweet Sherry',
    family: 'sherry',
    parent: 'fortified_wine',
    color: '#4a1e0b',
    light: '#6d3014',
    dark: '#2b0e03',
    defaultAbv: 17,
    aliases: ['sweet sherry', 'pedro ximénez', 'pedro ximenez', 'px', 'cream sherry', 'px sherry'],
  },
  port: {
    id: 'port',
    name: 'Port',
    family: 'port',
    parent: 'fortified_wine',
    color: '#681423',
    light: '#8b2234',
    dark: '#440913',
    defaultAbv: 19.5,
    aliases: ['port', 'ruby port', 'tawny port', 'white port', 'port wine'],
  },
  oxidized_wine: {
    id: 'oxidized_wine',
    name: 'Madeira & Marsala',
    family: 'oxidized_wine',
    parent: 'fortified_wine',
    color: '#883a18',
    light: '#a84f27',
    dark: '#5b210a',
    defaultAbv: 18,
    aliases: ['madeira', 'marsala'],
  },
  asian_rice_ferments: {
    id: 'asian_rice_ferments',
    name: 'Sake & Soju / Shochu',
    family: 'asian_rice_ferments',
    parent: 'fortified_wine',
    color: '#eef2ea',
    light: '#f8faf6',
    dark: '#c2cac0',
    defaultAbv: 15,
    aliases: ['sake', 'soju', 'shochu'],
  },
  red_wine: {
    id: 'red_wine',
    name: 'Dry Red Wine',
    family: 'wine',
    parent: 'fortified_wine',
    color: '#5e0b1b',
    light: '#7a1928',
    dark: '#3b040e',
    defaultAbv: 13.5,
    aliases: ['red wine', 'dry red wine', 'cabernet', 'pinot noir', 'syrah', 'shiraz', 'merlot', 'malbec', 'rioja', 'tempranillo', 'chianti', 'bordeaux'],
  },
  white_wine: {
    id: 'white_wine',
    name: 'Dry White Wine',
    family: 'wine',
    parent: 'fortified_wine',
    color: '#e8ecb8',
    light: '#f4f7d4',
    dark: '#c2c88e',
    defaultAbv: 12.5,
    aliases: ['white wine', 'dry white wine', 'sauvignon blanc', 'chardonnay', 'pinot grigio', 'pinot gris', 'albarino', 'riesling', 'dry riesling'],
  },
  rose_wine: {
    id: 'rose_wine',
    name: 'Rosé Wine',
    family: 'wine',
    parent: 'fortified_wine',
    color: '#e88796',
    light: '#f5abb6',
    dark: '#bc5b6b',
    defaultAbv: 12.5,
    aliases: ['rose wine', 'rosé wine', 'rose', 'rosé', 'dry rose', 'dry rosé', 'provence rose'],
  },
  sparkling_wine: {
    id: 'sparkling_wine',
    name: 'Sparkling Wine',
    family: 'sparkling_wine',
    parent: 'fortified_wine',
    color: '#eedda0',
    light: '#f7eec5',
    dark: '#c2b070',
    defaultAbv: 12,
    aliases: ['champagne', 'prosecco', 'cava', 'brut sparkling wine', 'sparkling wine'],
  },

  // ==========================================
  // 3. LIQUEURS, CORDIALS & AMARI (liqueurs)
  // ==========================================
  red_bitter: {
    id: 'red_bitter',
    name: 'Aperitivo / Red Bitter',
    family: 'amaro',
    parent: 'liqueurs',
    color: '#cf1020',
    light: '#eb3847',
    dark: '#920512',
    defaultAbv: 24,
    aliases: ['campari', 'aperol', 'select', 'cappelletti', 'red bitter', 'aperitivo'],
  },
  herbal_amaro: {
    id: 'herbal_amaro',
    name: 'Medium / Herbal Amaro',
    family: 'amaro',
    parent: 'liqueurs',
    color: '#541c10',
    light: '#732c1d',
    dark: '#330c05',
    defaultAbv: 29,
    aliases: ['averna', 'montenegro', 'amaro montenegro', 'nonino', 'amaro nonino', 'meletti', 'ramazzotti', 'lucano', 'cynar', 'amaro'],
  },
  fernet_alpine: {
    id: 'fernet_alpine',
    name: 'Fernet / Alpine Amaro',
    family: 'amaro',
    parent: 'liqueurs',
    color: '#38160c',
    light: '#562516',
    dark: '#1f0904',
    defaultAbv: 39,
    aliases: ['fernet-branca', 'fernet branca', 'branca menta', 'braulio', 'amaro sibilla', 'fernet'],
  },
  gentian: {
    id: 'gentian',
    name: 'Gentian Liqueur',
    family: 'amaro',
    parent: 'liqueurs',
    color: '#deb826',
    light: '#edd04a',
    dark: '#a58611',
    defaultAbv: 20,
    aliases: ['suze', 'salers', 'avèze', 'aveze', 'gentian liqueur', 'gentian'],
  },
  botanical_liqueur: {
    id: 'botanical_liqueur',
    name: 'Herbal & Botanical Liqueur',
    family: 'botanical_liqueur',
    parent: 'liqueurs',
    color: '#68b338',
    light: '#85d44d',
    dark: '#488220',
    defaultAbv: 45,
    aliases: ['green chartreuse', 'yellow chartreuse', 'chartreuse', 'bénédictine', 'benedictine', 'strega', 'galliano', 'sambuca', 'drambuie'],
  },
  anise: {
    id: 'anise',
    name: 'Anise Spirits',
    family: 'anise',
    parent: 'liqueurs',
    color: '#82b546',
    light: '#9ece61',
    dark: '#5b8a24',
    defaultAbv: 55,
    aliases: ['absinthe', 'pastis', 'pernod', 'ricard', 'herbsaint', 'ouzo'],
  },
  triple_sec: {
    id: 'triple_sec',
    name: 'Triple Sec',
    family: 'orange_liqueur',
    parent: 'liqueurs',
    color: '#ecc170',
    light: '#f5d693',
    dark: '#bd9446',
    defaultAbv: 38,
    aliases: ['triple sec', 'cointreau', 'combier'],
  },
  curacao: {
    id: 'curacao',
    name: 'Curaçao',
    family: 'orange_liqueur',
    parent: 'liqueurs',
    color: '#df9c36',
    light: '#f4b75a',
    dark: '#a86c18',
    defaultAbv: 35,
    aliases: ['dry curacao', 'dry curaçao', 'pierre ferrand dry curaçao', 'pierre ferrand dry curacao', 'curacao', 'curaçao', 'blue curacao', 'blue curaçao'],
  },
  brandy_orange_liqueur: {
    id: 'brandy_orange_liqueur',
    name: 'Brandy-Based Orange Liqueur',
    family: 'orange_liqueur',
    parent: 'liqueurs',
    color: '#c56e26',
    light: '#e18c44',
    dark: '#8c4610',
    defaultAbv: 40,
    aliases: ['grand marnier'],
  },
  citrus_liqueur: {
    id: 'citrus_liqueur',
    name: 'Citrus Liqueur',
    family: 'orange_liqueur',
    parent: 'liqueurs',
    color: '#edd44f',
    light: '#fae77b',
    dark: '#b7a022',
    defaultAbv: 25,
    aliases: ['limoncello', 'bergamot', 'italicus'],
  },
  // Fruit, Berry & Stone Fruit Liqueurs
  maraschino: {
    id: 'maraschino',
    name: 'Maraschino Liqueur',
    family: 'fruit_liqueur',
    parent: 'liqueurs',
    color: '#e5d7c3',
    light: '#f7ede0',
    dark: '#bda688',
    defaultAbv: 32,
    aliases: ['maraschino', 'luxardo', 'maraschino liqueur', 'luxardo maraschino'],
  },
  cherry_liqueur: {
    id: 'cherry_liqueur',
    name: 'Cherry Liqueur',
    family: 'fruit_liqueur',
    parent: 'liqueurs',
    color: '#6e0c1f',
    light: '#9e1a34',
    dark: '#450410',
    defaultAbv: 24,
    aliases: ['cherry heering', 'cherry liqueur', 'cherry brandy', 'kirsch', 'kirschwasser', 'guignolet'],
  },
  berry_liqueur: {
    id: 'berry_liqueur',
    name: 'Berry Liqueurs',
    family: 'fruit_liqueur',
    parent: 'liqueurs',
    color: '#5b122e',
    light: '#831e44',
    dark: '#38061a',
    defaultAbv: 18,
    aliases: ['crème de cassis', 'creme de cassis', 'crème de mûre', 'creme de mure', 'chambord', 'blackberry liqueur', 'raspberry liqueur', 'blackcurrant liqueur'],
  },
  stone_fruit_liqueur: {
    id: 'stone_fruit_liqueur',
    name: 'Stone Fruit Liqueurs',
    family: 'fruit_liqueur',
    parent: 'liqueurs',
    color: '#d46f2c',
    light: '#e8894b',
    dark: '#9d4a13',
    defaultAbv: 24,
    aliases: ['apricot liqueur', 'apricot brandy', 'peach schnapps', 'crème de pêche', 'creme de peche', 'peach liqueur', 'plum liqueur', 'umeshu'],
  },
  tropical_fruit_liqueur: {
    id: 'tropical_fruit_liqueur',
    name: 'Tropical & Banana Liqueurs',
    family: 'fruit_liqueur',
    parent: 'liqueurs',
    color: '#e0b234',
    light: '#f0c756',
    dark: '#a88118',
    defaultAbv: 24,
    aliases: ['banana liqueur', 'crème de banane', 'creme de banane', 'passion fruit liqueur', 'passoã', 'passoa', 'midori', 'melon liqueur'],
  },
  fruit_liqueur: {
    id: 'fruit_liqueur',
    name: 'Fruit & Berry Liqueurs',
    family: 'fruit_liqueur',
    parent: 'liqueurs',
    color: '#a01e38',
    light: '#c5324f',
    dark: '#6e0c1f',
    defaultAbv: 25,
    aliases: ['fruit liqueur', 'berry liqueur'],
  },
  coffee_liqueur: {
    id: 'coffee_liqueur',
    name: 'Coffee Liqueur',
    family: 'nut_seed_liqueur',
    parent: 'liqueurs',
    color: '#381e12',
    light: '#563120',
    dark: '#200e07',
    defaultAbv: 22,
    aliases: ['kahlúa', 'kahlua', 'mr black', 'tia maria', 'coffee liqueur'],
  },
  chocolate_liqueur: {
    id: 'chocolate_liqueur',
    name: 'Chocolate Liqueur',
    family: 'nut_seed_liqueur',
    parent: 'liqueurs',
    color: '#442314',
    light: '#623521',
    dark: '#241007',
    defaultAbv: 22,
    aliases: ['crème de cacao', 'creme de cacao', 'dark cacao', 'white cacao', 'chocolate liqueur'],
  },
  nut_liqueur: {
    id: 'nut_liqueur',
    name: 'Nut Liqueur',
    family: 'nut_seed_liqueur',
    parent: 'liqueurs',
    color: '#97481b',
    light: '#b9632f',
    dark: '#632b0a',
    defaultAbv: 24,
    aliases: ['amaretto', 'disaronno', 'frangelico', 'nocino'],
  },
  spiced_liqueur: {
    id: 'spiced_liqueur',
    name: 'Spiced Liqueurs',
    family: 'spiced_liqueur',
    parent: 'liqueurs',
    color: '#9a4718',
    light: '#ba602c',
    dark: '#6a2a07',
    defaultAbv: 28,
    aliases: ['allspice dram', 'pimento dram', 'falernum', 'velvet falernum', 'ginger liqueur', 'domaine de canton', 'ancho reyes', 'cinnamon liqueur'],
  },
  floral_liqueur: {
    id: 'floral_liqueur',
    name: 'Floral Liqueurs',
    family: 'floral_liqueur',
    parent: 'liqueurs',
    color: '#957bb0',
    light: '#b7a0cf',
    dark: '#6b5087',
    defaultAbv: 20,
    aliases: ['elderflower', 'elderflower liqueur', 'st-germain', 'st germain', 'violette', 'crème de violette', 'creme de violette', 'rose liqueur'],
  },
  corn_liqueur: {
    id: 'corn_liqueur',
    name: 'Corn Liqueur',
    family: 'specialty_liqueur',
    parent: 'liqueurs',
    color: '#e2b342',
    light: '#f5cb68',
    dark: '#a87e1a',
    defaultAbv: 30,
    aliases: ['nixta', 'nixta licor de elote', 'nixta licor elote', 'corn liqueur', 'elote liqueur', 'licor de elote'],
  },
  cream_liqueur: {
    id: 'cream_liqueur',
    name: 'Cream Liqueurs',
    family: 'cream_liqueur',
    parent: 'liqueurs',
    color: '#dccbb5',
    light: '#ede0cf',
    dark: '#b09a80',
    defaultAbv: 17,
    aliases: ['baileys', 'irish cream', 'rumchata', 'cream liqueur'],
  },

  // ==========================================
  // 4. SYRUPS & SWEETENERS (sweeteners)
  // ==========================================
  simple_syrup: {
    id: 'simple_syrup',
    name: 'Simple Syrup',
    family: 'cane_syrup',
    parent: 'sweeteners',
    color: '#f1e8be',
    light: '#faf5d8',
    dark: '#cfc48f',
    defaultAbv: 0,
    aliases: ['simple syrup', '1:1 simple', 'white sugar syrup', 'sugar syrup'],
  },
  rich_simple_syrup: {
    id: 'rich_simple_syrup',
    name: 'Rich Simple Syrup',
    family: 'cane_syrup',
    parent: 'sweeteners',
    color: '#ede0a8',
    light: '#f7eebe',
    dark: '#c5b67a',
    defaultAbv: 0,
    aliases: ['rich simple syrup', 'rich simple', '2:1 syrup'],
  },
  demerara_syrup: {
    id: 'demerara_syrup',
    name: 'Demerara Syrup',
    family: 'cane_syrup',
    parent: 'sweeteners',
    color: '#a66a38',
    light: '#bf834e',
    dark: '#73441e',
    defaultAbv: 0,
    aliases: ['demerara syrup', 'demerara', 'turbinado syrup', 'brown sugar syrup', 'cane syrup'],
  },
  orgeat: {
    id: 'orgeat',
    name: 'Orgeat',
    family: 'flavored_syrup',
    parent: 'sweeteners',
    color: '#f4ede2',
    light: '#ffffff',
    dark: '#dcd3c5',
    defaultAbv: 0,
    aliases: ['orgeat', 'almond syrup', 'almond orgeat syrup', 'almond orgeat', 'french orgeat', 'pistachio orgeat'],
  },
  grenadine: {
    id: 'grenadine',
    name: 'Grenadine',
    family: 'flavored_syrup',
    parent: 'sweeteners',
    color: '#9e1b32',
    light: '#bf2c47',
    dark: '#6e0d1f',
    defaultAbv: 0,
    aliases: ['grenadine', 'real pomegranate syrup', 'pomegranate syrup'],
  },
  honey_syrup: {
    id: 'honey_syrup',
    name: 'Honey Syrup',
    family: 'flavored_syrup',
    parent: 'sweeteners',
    color: '#cf9833',
    light: '#e8b555',
    dark: '#986a19',
    defaultAbv: 0,
    aliases: ['honey syrup', '3:1 honey', 'runny honey', 'honey'],
  },
  agave_syrup: {
    id: 'agave_syrup',
    name: 'Agave Nectar / Syrup',
    family: 'flavored_syrup',
    parent: 'sweeteners',
    color: '#d8a94a',
    light: '#ecc36b',
    dark: '#9f7724',
    defaultAbv: 0,
    aliases: ['agave nectar', 'light agave', 'agave syrup', 'agave'],
  },
  ginger_syrup: {
    id: 'ginger_syrup',
    name: 'Ginger Syrup',
    family: 'flavored_syrup',
    parent: 'sweeteners',
    color: '#d9a84e',
    light: '#ecc471',
    dark: '#9c7325',
    defaultAbv: 0,
    aliases: ['ginger syrup'],
  },
  passion_fruit_syrup: {
    id: 'passion_fruit_syrup',
    name: 'Passion Fruit Syrup',
    family: 'flavored_syrup',
    parent: 'sweeteners',
    color: '#df7418',
    light: '#f7933f',
    dark: '#9e4905',
    defaultAbv: 0,
    aliases: ['passion fruit syrup', 'passion fruit'],
  },
  cinnamon_syrup: {
    id: 'cinnamon_syrup',
    name: 'Cinnamon Syrup',
    family: 'flavored_syrup',
    parent: 'sweeteners',
    color: '#97451c',
    light: '#b65f32',
    dark: '#6a280a',
    defaultAbv: 0,
    aliases: ['cinnamon syrup'],
  },
  vanilla_syrup: {
    id: 'vanilla_syrup',
    name: 'Vanilla Syrup',
    family: 'flavored_syrup',
    parent: 'sweeteners',
    color: '#e2be79',
    light: '#edd298',
    dark: '#aa8846',
    defaultAbv: 0,
    aliases: ['vanilla syrup'],
  },
  raspberry_syrup: {
    id: 'raspberry_syrup',
    name: 'Raspberry Syrup',
    family: 'flavored_syrup',
    parent: 'sweeteners',
    color: '#ad1a3e',
    light: '#cb3358',
    dark: '#750b25',
    defaultAbv: 0,
    aliases: ['raspberry syrup'],
  },
  maple_syrup: {
    id: 'maple_syrup',
    name: 'Maple Syrup',
    family: 'flavored_syrup',
    parent: 'sweeteners',
    color: '#a35622',
    light: '#c36d33',
    dark: '#733510',
    defaultAbv: 0,
    aliases: ['maple syrup', 'pure maple syrup', 'grade a maple syrup', 'dark maple syrup'],
  },
  raw_sweetener: {
    id: 'raw_sweetener',
    name: 'Raw Sweetener',
    family: 'raw_sweetener',
    parent: 'sweeteners',
    color: '#a66a38',
    light: '#bf834e',
    dark: '#73441e',
    defaultAbv: 0,
    aliases: ['sugar cube', 'superfine sugar', 'sugar', 'molasses', 'jam', 'marmalade'],
  },

  // ==========================================
  // 5. JUICES, PRODUCE & ACIDS (produce)
  // ==========================================
  lime_juice: {
    id: 'lime_juice',
    name: 'Lime Juice',
    family: 'citrus_juice',
    parent: 'produce',
    color: '#b9db70',
    light: '#d0ed8e',
    dark: '#8cae46',
    defaultAbv: 0,
    aliases: ['lime juice', 'fresh lime juice', 'fresh lime', 'lime'],
  },
  lemon_juice: {
    id: 'lemon_juice',
    name: 'Lemon Juice',
    family: 'citrus_juice',
    parent: 'produce',
    color: '#f3da58',
    light: '#f9e87d',
    dark: '#c7ae29',
    defaultAbv: 0,
    aliases: ['lemon juice', 'fresh lemon juice', 'fresh lemon', 'lemon'],
  },
  grapefruit_juice: {
    id: 'grapefruit_juice',
    name: 'Grapefruit Juice',
    family: 'citrus_juice',
    parent: 'produce',
    color: '#f4978e',
    light: '#f8b4ad',
    dark: '#c96a60',
    defaultAbv: 0,
    aliases: ['grapefruit juice', 'pink grapefruit', 'white grapefruit', 'fresh grapefruit', 'grapefruit'],
  },
  orange_juice: {
    id: 'orange_juice',
    name: 'Orange Juice',
    family: 'citrus_juice',
    parent: 'produce',
    color: '#f77f00',
    light: '#fc9e38',
    dark: '#c45a00',
    defaultAbv: 0,
    aliases: ['orange juice', 'fresh oj', 'blood orange juice', 'fresh orange juice', 'fresh orange'],
  },
  pineapple_juice: {
    id: 'pineapple_juice',
    name: 'Pineapple Juice',
    family: 'fruit_juice',
    parent: 'produce',
    color: '#f3da58',
    light: '#f9e87d',
    dark: '#c7ae29',
    defaultAbv: 0,
    aliases: ['pineapple juice', 'fresh pineapple juice', 'fresh pineapple', 'pineapple'],
  },
  fruit_juice: {
    id: 'fruit_juice',
    name: 'Fruit Juice',
    family: 'fruit_juice',
    parent: 'produce',
    color: '#e89e2c',
    light: '#f7b958',
    dark: '#ab6c13',
    defaultAbv: 0,
    aliases: ['apple cider', 'apple juice', 'pomegranate juice'],
  },
  cranberry_juice: {
    id: 'cranberry_juice',
    name: 'Cranberry Juice',
    family: 'fruit_juice',
    parent: 'produce',
    color: '#a3172e',
    light: '#c82d47',
    dark: '#710a1b',
    defaultAbv: 0,
    aliases: ['cranberry juice', 'cranberry cocktail', 'unsweetened cranberry juice', 'cranberry'],
  },
  tomato_juice: {
    id: 'tomato_juice',
    name: 'Tomato Juice',
    family: 'fruit_juice',
    parent: 'produce',
    color: '#b5291c',
    light: '#d44335',
    dark: '#82170d',
    defaultAbv: 0,
    aliases: ['tomato juice', 'clamato', 'clamato juice', 'spiced tomato juice'],
  },
  olive_brine: {
    id: 'olive_brine',
    name: 'Olive Brine',
    family: 'brine',
    parent: 'produce',
    color: '#b5be8e',
    light: '#ced6aa',
    dark: '#8e9667',
    defaultAbv: 0,
    aliases: ['olive brine', 'olive juice', 'dirty martini olive juice', 'dirty olive brine', 'green olive brine'],
  },
  pickle_brine: {
    id: 'pickle_brine',
    name: 'Pickle Brine',
    family: 'brine',
    parent: 'produce',
    color: '#a1bb67',
    light: '#bcd383',
    dark: '#779040',
    defaultAbv: 0,
    aliases: ['pickle brine', 'pickle juice', 'dill pickle juice', 'dill pickle brine', 'pickle juice brine'],
  },
  worcestershire: {
    id: 'worcestershire',
    name: 'Worcestershire Sauce',
    family: 'savory',
    parent: 'produce',
    color: '#3d160c',
    light: '#5b2314',
    dark: '#220a04',
    defaultAbv: 0,
    aliases: ['worcestershire sauce', 'worcestershire', 'lea & perrins', 'lea and perrins'],
  },
  hot_sauce: {
    id: 'hot_sauce',
    name: 'Hot Sauce',
    family: 'savory',
    parent: 'produce',
    color: '#b82717',
    light: '#d94231',
    dark: '#85150a',
    defaultAbv: 0,
    aliases: ['hot sauce', 'tabasco', 'cholula', 'sriracha', 'habanero sauce'],
  },
  acids: {
    id: 'acids',
    name: 'Formulated Acids',
    family: 'acids',
    parent: 'produce',
    color: '#edf2e0',
    light: '#f8faf2',
    dark: '#c0cbab',
    defaultAbv: 0,
    aliases: ['citric acid solution', 'citric acid', 'malic acid solution', 'malic acid', 'acid-adjusted juice', 'verjus'],
  },
  fresh_produce: {
    id: 'fresh_produce',
    name: 'Fresh Produce',
    family: 'fresh_produce',
    parent: 'produce',
    color: '#68b338',
    light: '#85d44d',
    dark: '#488220',
    defaultAbv: 0,
    aliases: ['fresh mint', 'mint', 'basil', 'cucumber', 'ginger root', 'berries', 'blackberries', 'strawberries'],
  },

  // ==========================================
  // 6. BITTERS & TINCTURES (bitters)
  // ==========================================
  aromatic_bitters: {
    id: 'aromatic_bitters',
    name: 'Aromatic Bitters',
    family: 'bitters',
    parent: 'bitters',
    color: '#7a1921',
    light: '#9b2933',
    dark: '#520b12',
    defaultAbv: 44.7,
    aliases: ['angostura', 'angostura bitters', 'peychaud’s', "peychaud's", 'peychauds', "boker’s", "boker's", 'bokers', 'jerry thomas own decanter', 'aromatic bitters', 'bitters'],
  },
  citrus_bitters: {
    id: 'citrus_bitters',
    name: 'Citrus Bitters',
    family: 'bitters',
    parent: 'bitters',
    color: '#ba5816',
    light: '#d87632',
    dark: '#7f3609',
    defaultAbv: 35,
    aliases: ['orange bitters', "regan's no. 6", "regan's", 'fee brothers west indian orange', 'grapefruit bitters'],
  },
  specialty_bitters: {
    id: 'specialty_bitters',
    name: 'Specialty Bitters',
    family: 'bitters',
    parent: 'bitters',
    color: '#562514',
    light: '#733721',
    dark: '#341206',
    defaultAbv: 38,
    aliases: ['chocolate bitters', 'mole bitters', 'walnut bitters', 'celery bitters', 'cardamom bitters', 'cherry bitters'],
  },
  tinctures: {
    id: 'tinctures',
    name: 'Saline & Tinctures',
    family: 'tinctures',
    parent: 'bitters',
    color: '#d8e5ec',
    light: '#edf4f8',
    dark: '#adc5d3',
    defaultAbv: 0,
    aliases: ['saline solution', 'saline solution (20%)', 'saline', 'chili tincture', 'firewater'],
  },

  // ==========================================
  // 7. MIXERS, BUBBLES & EMULSIFIERS (mixers)
  // ==========================================
  club_soda: {
    id: 'club_soda',
    name: 'Club Soda',
    family: 'soda',
    parent: 'mixers',
    color: '#d9eef9',
    light: '#edf7fc',
    dark: '#afd5ea',
    defaultAbv: 0,
    aliases: ['club soda', 'seltzer', 'sparkling water', 'soda water', 'soda'],
  },
  tonic_water: {
    id: 'tonic_water',
    name: 'Tonic Water',
    family: 'soda',
    parent: 'mixers',
    color: '#d4ebf7',
    light: '#eaf5fb',
    dark: '#a5cfdf',
    defaultAbv: 0,
    aliases: ['tonic water', 'tonic', 'indian tonic', 'mediterranean tonic'],
  },
  ginger_beer: {
    id: 'ginger_beer',
    name: 'Ginger Beer',
    family: 'soda',
    parent: 'mixers',
    color: '#eedca8',
    light: '#f8eed0',
    dark: '#c2ae77',
    defaultAbv: 0,
    aliases: ['ginger beer'],
  },
  ginger_ale: {
    id: 'ginger_ale',
    name: 'Ginger Ale',
    family: 'soda',
    parent: 'mixers',
    color: '#edd594',
    light: '#f8e9bf',
    dark: '#c0a35e',
    defaultAbv: 0,
    aliases: ['ginger ale'],
  },
  grapefruit_soda: {
    id: 'grapefruit_soda',
    name: 'Grapefruit Soda',
    family: 'soda',
    parent: 'mixers',
    color: '#f4c5c7',
    light: '#fce1e2',
    dark: '#d6979a',
    defaultAbv: 0,
    aliases: ['grapefruit soda', 'ting', 'jarritos grapefruit', 'squirt', 'paloma soda'],
  },
  cola: {
    id: 'cola',
    name: 'Cola',
    family: 'soda',
    parent: 'mixers',
    color: '#391c0e',
    light: '#582d18',
    dark: '#1f0d05',
    defaultAbv: 0,
    aliases: ['cola', 'coca-cola', 'coke'],
  },
  egg_white: {
    id: 'egg_white',
    name: 'Egg White',
    family: 'texture',
    parent: 'mixers',
    color: '#f5f5f0',
    light: '#ffffff',
    dark: '#deded7',
    defaultAbv: 0,
    aliases: ['egg white', 'egg whites'],
  },
  whole_egg: {
    id: 'whole_egg',
    name: 'Whole Egg',
    family: 'texture',
    parent: 'mixers',
    color: '#f7df99',
    light: '#fdf1cc',
    dark: '#c9af64',
    defaultAbv: 0,
    aliases: ['whole egg', 'egg'],
  },
  aquafaba: {
    id: 'aquafaba',
    name: 'Aquafaba',
    family: 'texture',
    parent: 'mixers',
    color: '#f4ece1',
    light: '#ffffff',
    dark: '#dbd1c3',
    defaultAbv: 0,
    aliases: ['aquafaba', 'chickpea brine'],
  },
  dairy: {
    id: 'dairy',
    name: 'Cream & Milk',
    family: 'texture',
    parent: 'mixers',
    color: '#f4ede2',
    light: '#ffffff',
    dark: '#dcd3c5',
    defaultAbv: 0,
    aliases: ['heavy cream', 'half and half', 'whole milk', 'condensed milk', 'coconut cream', 'coco lopez', 'cream', 'milk'],
  },
  espresso: {
    id: 'espresso',
    name: 'Fresh Espresso',
    family: 'coffee',
    parent: 'mixers',
    color: '#2a170c',
    light: '#482a17',
    dark: '#140804',
    defaultAbv: 0,
    aliases: ['fresh espresso', 'espresso', 'cold brew', 'cold brew coffee', 'brewed coffee', 'coffee'],
  },
  beer: {
    id: 'beer',
    name: 'Beer',
    family: 'fermented',
    parent: 'mixers',
    color: '#d49b2c',
    light: '#eeb64a',
    dark: '#9a6b16',
    defaultAbv: 5,
    aliases: ['beer', 'lager', 'stout', 'pilsner', 'ipa', 'pale ale', 'guinness'],
  },
  cider: {
    id: 'cider',
    name: 'Hard Cider',
    family: 'fermented',
    parent: 'mixers',
    color: '#cea039',
    light: '#e8be55',
    dark: '#967019',
    defaultAbv: 5.5,
    aliases: ['hard cider', 'cider', 'dry cider'],
  },
  orange_flower_water: {
    id: 'orange_flower_water',
    name: 'Orange Flower Water',
    family: 'aromatic_water',
    parent: 'mixers',
    color: '#ffffff',
    light: '#ffffff',
    dark: '#eeeeee',
    defaultAbv: 0,
    aliases: ['orange flower water', 'orange blossom water'],
  },
  celery_salt: {
    id: 'celery_salt',
    name: 'Celery Salt & Spices',
    family: 'seasoning',
    parent: 'produce',
    color: '#d4c89c',
    light: '#ece5c3',
    dark: '#9a8d62',
    defaultAbv: 0,
    aliases: ['celery salt', 'celery seed', 'worcestershire sauce', 'worcestershire', 'hot sauce', 'tabasco', 'black pepper'],
  },
};

// Set of taxonomy ingredient IDs that should be kept refrigerated once opened
export const REFRIGERATED_INGREDIENT_IDS = new Set([
  // Fortified Wines, Vermouths, Sakes & Chilled Wines
  'sweet_vermouth',
  'dry_vermouth',
  'blanc_vermouth',
  'quinquina',
  'dry_sherry',
  'sweet_sherry',
  'port',
  'oxidized_wine',
  'asian_rice_ferments',
  'white_wine',
  'rose_wine',
  'sparkling_wine',

  // Perishable Syrups & Purees
  'simple_syrup',
  'rich_simple_syrup',
  'demerara_syrup',
  'orgeat',
  'grenadine',
  'honey_syrup',
  'passion_fruit_syrup',
  'ginger_syrup',
  'cinnamon_syrup',
  'vanilla_syrup',
  'raspberry_syrup',

  // Juices, Produce & Perishables
  'lime_juice',
  'lemon_juice',
  'grapefruit_juice',
  'orange_juice',
  'pineapple_juice',
  'cranberry_juice',
  'fruit_juice',
  'tomato_juice',
  'olive_brine',
  'pickle_brine',
  'fresh_produce',

  // Texture & Dairy
  'egg_white',
  'whole_egg',
  'aquafaba',
  'dairy',
  'espresso',
]);

// Pre-build a fast alias lookup table sorted by length descending so longer phrases match first
const ALIAS_LOOKUP = [];
for (const key of Object.keys(TAXONOMY)) {
  const item = TAXONOMY[key];
  const allNames = new Set([item.id, item.name.toLowerCase(), ...(item.aliases || []).map(a => a.toLowerCase())]);
  for (const alias of allNames) {
    ALIAS_LOOKUP.push({
      alias,
      length: alias.length,
      item,
    });
  }
}
ALIAS_LOOKUP.sort((a, b) => b.length - a.length);

/**
 * Normalizes text for comparison by lowercasing and standardizing spaces/accents
 */
export function normalizeText(text = '') {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['"’]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Resolves a raw ingredient string to a canonical taxonomy entry
 */
export function findIngredient(rawText = '') {
  if (!rawText) return null;
  const normalized = normalizeText(rawText);
  if (!normalized) return null;

  // 1. Direct exact alias match
  for (const entry of ALIAS_LOOKUP) {
    const normAlias = normalizeText(entry.alias);
    if (normalized === normAlias) {
      return entry.item;
    }
  }

  // 2. Word boundary substring match (longer phrases prioritized)
  for (const entry of ALIAS_LOOKUP) {
    const normAlias = normalizeText(entry.alias);
    if (normAlias.length < 3) continue;
    const pattern = new RegExp(`(^|\\s)${normAlias}(\\s|$)`, 'i');
    if (pattern.test(normalized)) {
      return entry.item;
    }
  }

  // 3. Fallback partial inclusion for long phrases
  for (const entry of ALIAS_LOOKUP) {
    const normAlias = normalizeText(entry.alias);
    if (normAlias.length >= 4 && normalized.includes(normAlias)) {
      return entry.item;
    }
  }

  return null;
}

/**
 * Returns color, ABV, and category metadata for an ingredient
 */
export function getIngredientMetadata(rawText = '') {
  const item = findIngredient(rawText);
  if (!item) return null;

  const isRefrigerated = REFRIGERATED_INGREDIENT_IDS.has(item.id);

  return {
    id: item.id,
    name: item.name,
    family: item.family,
    parent: item.parent,
    color: item.color,
    light: item.light,
    dark: item.dark,
    defaultAbv: item.defaultAbv,
    label: item.name,
    storage: isRefrigerated ? 'fridge' : 'shelf',
    isRefrigerated,
  };
}

/**
 * Checks whether an ingredient matches a query via exact text, alias, family, or parent category
 */
export function ingredientMatchesQuery(rawIngredientName = '', query = '') {
  if (!query) return true;
  const cleanQuery = normalizeText(query);
  if (!cleanQuery) return true;

  const cleanIngredient = normalizeText(rawIngredientName);
  if (cleanIngredient.includes(cleanQuery)) {
    return true;
  }

  const item = findIngredient(rawIngredientName);
  if (!item) return false;

  // Check storage query: 'fridge', 'refrigerate', 'refrigerated', 'chill'
  if (['fridge', 'refrigerated', 'refrigerate', 'chilled', 'chill'].includes(cleanQuery)) {
    if (REFRIGERATED_INGREDIENT_IDS.has(item.id)) return true;
  }

  // Check ID and canonical name
  if (normalizeText(item.id).includes(cleanQuery)) return true;
  if (normalizeText(item.name).includes(cleanQuery)) return true;

  // Check family and parent category
  if (normalizeText(item.family).includes(cleanQuery)) return true;
  if (normalizeText(item.parent).includes(cleanQuery)) return true;

  // Family aliases and common drink groupings
  if (cleanQuery === 'whiskey' || cleanQuery === 'whisky') {
    if (item.family === 'whiskey') return true;
  }
  if (cleanQuery === 'rum' && (item.family === 'rum' || item.family === 'cane_spirits')) {
    return true;
  }
  if (cleanQuery === 'syrup' && (item.family === 'cane_syrup' || item.family === 'flavored_syrup' || item.parent === 'sweeteners')) {
    return true;
  }
  if (cleanQuery === 'amaro' && item.family === 'amaro') {
    return true;
  }
  if (cleanQuery === 'bitters' && item.parent === 'bitters') {
    return true;
  }
  if (cleanQuery === 'brine' && item.family === 'brine') {
    return true;
  }
  if (cleanQuery === 'coffee' && item.family === 'coffee') {
    return true;
  }

  // Check aliases
  for (const alias of item.aliases || []) {
    if (normalizeText(alias).includes(cleanQuery)) {
      return true;
    }
  }

  return false;
}

/**
 * Evaluates whether a recipe matches a search query, checking metadata and specs via taxonomy
 */
export function recipeMatchesQuery(recipe, query = '') {
  if (!query) return true;
  const q = query.trim().toLowerCase();
  if (!q) return true;

  // Explicit hashtag search (#tag)
  if (q.startsWith('#')) {
    const tagTerm = q.slice(1).trim();
    if (!tagTerm) return true;
    return Array.isArray(recipe.tags) && recipe.tags.some(t => (t || '').toLowerCase().includes(tagTerm));
  }

  // Metadata checks
  if ((recipe.name || '').toLowerCase().includes(q)) return true;
  if ((recipe.glassware || '').toLowerCase().includes(q)) return true;
  if ((recipe.method || '').toLowerCase().includes(q)) return true;
  if ((recipe.description || '').toLowerCase().includes(q)) return true;
  if ((recipe.source || '').toLowerCase().includes(q)) return true;
  if ((recipe.instructions || '').toLowerCase().includes(q)) return true;

  // Check tags if present
  if (Array.isArray(recipe.tags) && recipe.tags.some(t => (t || '').toLowerCase().includes(q))) {
    return true;
  }

  // Check ingredients via taxonomy
  const specs = recipe.specs || [];
  for (const spec of specs) {
    if (ingredientMatchesQuery(spec.name || '', q)) {
      return true;
    }
  }

  return false;
}

/**
 * Resolves logical ingredient substitutes from the taxonomy based on family or parent grouping.
 * Used by the Smart Ingredient Swapper ("Riff Mode").
 */
export function getIngredientSubstitutes(rawIngredientName = '') {
  const current = findIngredient(rawIngredientName);
  if (!current) return [];

  const candidates = [];
  const seenIds = new Set([current.id]);

  for (const key of Object.keys(TAXONOMY)) {
    const candidate = TAXONOMY[key];
    if (seenIds.has(candidate.id)) continue;

    let isMatch = false;

    // 1. Same exact family (e.g. whiskey, vermouth, amaro, soda, citrus_juice)
    if (candidate.family === current.family) {
      isMatch = true;
    }
    // 2. Agave spirits cross-family (mezcal <-> tequila)
    else if ((current.family === 'tequila' || current.family === 'agave_spirits') &&
      (candidate.family === 'tequila' || candidate.family === 'agave_spirits')) {
      isMatch = true;
    }
    // 3. Cane spirits cross-family (rum <-> rhum_agricole / cachaca)
    else if ((current.family === 'rum' || current.family === 'cane_spirits') &&
      (candidate.family === 'rum' || candidate.family === 'cane_spirits')) {
      isMatch = true;
    }
    // 4. Fortified wine / vermouth cross-family (vermouth <-> quinquina <-> sherry <-> port <-> oxidized_wine)
    else if ((current.family === 'vermouth' || current.family === 'quinquina' || current.family === 'sherry' || current.family === 'port' || current.family === 'oxidized_wine') &&
      (candidate.family === 'vermouth' || candidate.family === 'quinquina' || candidate.family === 'sherry' || candidate.family === 'port' || candidate.family === 'oxidized_wine')) {
      isMatch = true;
    }
    // 5. Still & sparkling table wines cross-family (wine <-> sparkling_wine)
    else if ((current.family === 'wine' || current.family === 'sparkling_wine') &&
      (candidate.family === 'wine' || candidate.family === 'sparkling_wine')) {
      isMatch = true;
    }
    // 6. Syrups cross-family (cane_syrup <-> flavored_syrup)
    else if ((current.family === 'cane_syrup' || current.family === 'flavored_syrup') &&
      (candidate.family === 'cane_syrup' || candidate.family === 'flavored_syrup')) {
      isMatch = true;
    }

    if (isMatch) {
      seenIds.add(candidate.id);
      candidates.push({
        id: candidate.id,
        name: candidate.name,
        family: candidate.family,
        parent: candidate.parent,
        defaultAbv: candidate.defaultAbv,
        color: candidate.color,
      });
    }
  }

  // Sort alphabetically by canonical name
  candidates.sort((a, b) => a.name.localeCompare(b.name));
  return candidates;
}

/**
 * Resolves the parent cocktail lineage of a recipe if it is a riff.
 * Checks explicit riffOfId / riffOfName, "<Base> (... Riff)" naming pattern, or description text.
 */
export function getRecipeRiffLineage(recipe, allRecipes = []) {
  if (!recipe) return null;

  // 1. Explicit riffOfId
  if (recipe.riffOfId) {
    const parent = allRecipes.find(r => r.id === recipe.riffOfId);
    if (parent) return { parentId: parent.id, parentName: parent.name };
  }

  // 2. Explicit riffOfName
  if (recipe.riffOfName) {
    const parent = allRecipes.find(r => r.name.toLowerCase().trim() === recipe.riffOfName.toLowerCase().trim());
    return { parentId: parent?.id || null, parentName: parent?.name || recipe.riffOfName };
  }

  // 3. Name pattern: e.g. "Old Fashioned (Scotch Whisky / Maple Syrup Riff)"
  if (recipe.name) {
    const nameMatch = recipe.name.match(/^(.+?)\s*\((.+?)\s*Riff\)$/i);
    if (nameMatch) {
      const baseName = nameMatch[1].trim();
      const parent = allRecipes.find(r => r.name.toLowerCase().trim() === baseName.toLowerCase());
      if (parent) {
        return { parentId: parent.id, parentName: parent.name };
      }
      return { parentId: null, parentName: baseName };
    }
  }

  // 4. Description pattern: e.g. "Riff on Old Fashioned:"
  if (recipe.description) {
    const descMatch = recipe.description.match(/Riff on ([^:.\n]+)/i);
    if (descMatch) {
      const baseName = descMatch[1].trim();
      const parent = allRecipes.find(r => r.name.toLowerCase().trim() === baseName.toLowerCase());
      if (parent) {
        return { parentId: parent.id, parentName: parent.name };
      }
      return { parentId: null, parentName: baseName };
    }
  }

  return null;
}

/**
 * Discovers similar and riff-connected cocktails across the recipe vault.
 * Connects original cocktails to their riffs and vice versa, plus taxonomy formula matches.
 */
export function findSimilarCocktails(currentRecipe, allRecipes = []) {
  if (!currentRecipe || !Array.isArray(allRecipes)) return [];

  const results = [];
  const addedIds = new Set([currentRecipe.id]);
  const currentName = (currentRecipe.name || '').toLowerCase().trim();
  const currentLineage = getRecipeRiffLineage(currentRecipe, allRecipes);

  // 1. If this recipe is a riff of another cocktail, link the original cocktail first
  if (currentLineage) {
    const parent = allRecipes.find(r =>
      (currentLineage.parentId && r.id === currentLineage.parentId) ||
      (currentLineage.parentName && r.name.toLowerCase().trim() === currentLineage.parentName.toLowerCase().trim())
    );
    if (parent && !addedIds.has(parent.id)) {
      results.push({
        recipe: parent,
        relation: 'Original',
        badgeClass: 'badge-orig',
        isParent: true,
      });
      addedIds.add(parent.id);
    }

    // Also link sibling riffs (other riffs sharing the same parent)
    for (const r of allRecipes) {
      if (!addedIds.has(r.id)) {
        const rLineage = getRecipeRiffLineage(r, allRecipes);
        const isSibling = rLineage && (
          (currentLineage.parentId && rLineage.parentId === currentLineage.parentId) ||
          (currentLineage.parentName && rLineage.parentName.toLowerCase().trim() === currentLineage.parentName.toLowerCase().trim())
        );
        if (isSibling) {
          results.push({
            recipe: r,
            relation: 'Riff',
            badgeClass: 'badge-riff',
            isSibling: true,
          });
          addedIds.add(r.id);
        }
      }
    }
  }

  // 2. If other recipes were riffed off this cocktail, link them as Riffs!
  for (const r of allRecipes) {
    if (!addedIds.has(r.id)) {
      const rLineage = getRecipeRiffLineage(r, allRecipes);
      const isChild = rLineage && (
        (rLineage.parentId && rLineage.parentId === currentRecipe.id) ||
        (rLineage.parentName && rLineage.parentName.toLowerCase().trim() === currentName)
      );
      if (isChild) {
        results.push({
          recipe: r,
          relation: 'Riff',
          badgeClass: 'badge-riff',
          isChild: true,
        });
        addedIds.add(r.id);
      }
    }
  }

  // 3. Taxonomy formula & spirit family similarity
  const currentFamilies = new Set();
  const currentItemIds = new Set();
  for (const spec of currentRecipe.specs || []) {
    const item = findIngredient(spec.name);
    if (item) {
      currentItemIds.add(item.id);
      currentFamilies.add(item.family);
      if (item.parent) currentFamilies.add(item.parent);
    }
  }

  const formulaMatches = [];
  for (const candidate of allRecipes) {
    if (addedIds.has(candidate.id)) continue;

    let matchCount = 0;
    for (const spec of candidate.specs || []) {
      const item = findIngredient(spec.name);
      if (item) {
        if (currentItemIds.has(item.id)) {
          matchCount += 2; // Exact ingredient match
        } else if (currentFamilies.has(item.family)) {
          matchCount += 1; // Family match
        }
      }
    }

    if (candidate.glassware && candidate.glassware === currentRecipe.glassware) {
      matchCount += 0.5;
    }
    if (candidate.method && candidate.method === currentRecipe.method) {
      matchCount += 0.5;
    }

    if (matchCount >= 2.5) {
      formulaMatches.push({
        recipe: candidate,
        relation: 'Similar Style',
        badgeClass: 'badge-style',
        score: matchCount,
      });
    }
  }

  formulaMatches.sort((a, b) => b.score - a.score);

  for (const match of formulaMatches) {
    if (results.length >= 6) break;
    results.push({
      recipe: match.recipe,
      relation: match.relation,
      badgeClass: match.badgeClass,
    });
    addedIds.add(match.recipe.id);
  }

  return results;
}

// ==========================================
// Backbar Inventory & Bottle Next Engine
// ==========================================

const PANTRY_STAPLE_NAMES = new Set([
  'water',
  'ice',
  'tap water',
  'cold water',
  'hot water',
  'chilled water',
  'saline',
  'saline solution',
  'saline solution (20%)',
  'salt',
  'sugar',
  'granulated sugar',
  'white sugar',
  'orange flower water',
  'orange blossom water',
  'celery salt',
  'black pepper',
  'worcestershire sauce',
  'worcestershire',
  'hot sauce',
  'tabasco',
]);

const GENERIC_FAMILIES = {
  whiskey: ['whiskey', 'whisky', 'blended whiskey', 'american whiskey'],
  rum: ['rum', 'cane spirits', 'blended rum'],
  tequila: ['tequila', 'agave spirit'],
  orange_liqueur: ['orange liqueur', 'triple sec or curacao', 'curacao or triple sec', 'citrus liqueur'],
  vermouth: ['vermouth'],
  cane_syrup: ['simple syrup or demerara', 'sugar syrup'],
};

/**
 * Checks whether an ingredient is present in the user's inventory.
 * Handles pantry staples, direct matches, aliases, and child-to-parent hierarchy.
 */
export function checkIngredientStock(specName, inventorySet = new Set()) {
  if (!specName) return { inStock: true, isStaple: true };
  const clean = specName.trim().toLowerCase();

  // 1. Always-assumed pantry staples (ice, water, saline)
  if (PANTRY_STAPLE_NAMES.has(clean) || clean === 'ice' || clean === 'water') {
    return { inStock: true, isStaple: true, name: specName };
  }

  // 2. Direct ID or Alias match in inventory
  const item = findIngredient(specName);
  if (item) {
    if (inventorySet.has(item.id)) {
      return { inStock: true, item, id: item.id, name: item.name };
    }
    for (const alias of item.aliases || []) {
      if (inventorySet.has(alias.toLowerCase())) {
        return { inStock: true, item, id: item.id, name: item.name };
      }
    }
  }

  // Direct string match in inventory
  if (inventorySet.has(clean)) {
    return { inStock: true, item, id: item ? item.id : clean, name: item ? item.name : specName };
  }

  // 3. Hierarchical Child-to-Parent match:
  // If recipe calls for generic family (e.g. "Whiskey"), check if user owns any specific bottle in that family
  for (const [familyKey, genericTerms] of Object.entries(GENERIC_FAMILIES)) {
    if (genericTerms.includes(clean) || (item && item.family === familyKey && genericTerms.includes(item.name.toLowerCase()))) {
      for (const ownedId of inventorySet) {
        const ownedTax = TAXONOMY[ownedId];
        if (ownedTax && ownedTax.family === familyKey) {
          return { inStock: true, item: ownedTax, id: item ? item.id : ownedTax.id, name: specName, substitutedWith: ownedTax.name };
        }
      }
    }
  }

  // Missing bottle
  return {
    inStock: false,
    item,
    id: item ? item.id : clean.replace(/\s+/g, '_'),
    name: item ? item.name : specName,
    family: item ? item.family : 'other',
    color: item ? item.color : '#c67828',
  };
}

/**
 * Analyzes a recipe against the user's backbar inventory.
 * Computes whether the drink can be made immediately or requires +1 bottle.
 */
export function analyzeRecipeInventory(recipe, inventorySet = new Set()) {
  if (!recipe || !Array.isArray(recipe.specs)) {
    return { canMake: false, canMakeWithSubs: false, isBottleNext: false, missingCount: 0, missingItems: [], matchedItems: [], itemsWithInStockSubs: [], missingWithSub: null, bestSubstitute: null, totalCount: 0, matchCount: 0 };
  }

  const missingItems = [];
  const matchedItems = [];
  const processedKeys = new Set();

  for (const spec of recipe.specs) {
    if (!spec.name || !spec.name.trim()) continue;
    const stockStatus = checkIngredientStock(spec.name, inventorySet);

    // Pantry staples never count against missing bottles
    if (stockStatus.isStaple) continue;

    const dedupeKey = stockStatus.id || stockStatus.name.toLowerCase();
    if (processedKeys.has(dedupeKey)) continue;
    processedKeys.add(dedupeKey);

    if (stockStatus.inStock) {
      matchedItems.push(stockStatus);
    } else {
      // Find in-stock substitutes from user inventory
      const substitutes = getIngredientSubstitutes(stockStatus.name);
      const inStockSubstitutes = [];
      for (const sub of substitutes) {
        const subStock = checkIngredientStock(sub.name, inventorySet);
        if (subStock.inStock) {
          inStockSubstitutes.push(sub);
        }
      }
      stockStatus.inStockSubstitutes = inStockSubstitutes;
      missingItems.push(stockStatus);
    }
  }

  const totalCount = matchedItems.length + missingItems.length;
  const missingCount = missingItems.length;
  const canMake = missingCount === 0 && totalCount > 0;
  const isBottleNext = missingCount === 1;

  const itemsWithInStockSubs = missingItems.filter(m => m.inStockSubstitutes && m.inStockSubstitutes.length > 0);
  const canMakeWithSubs = !canMake && missingItems.length > 0 && itemsWithInStockSubs.length === missingItems.length;
  const missingWithSub = itemsWithInStockSubs.length > 0 ? itemsWithInStockSubs[0] : null;
  const bestSubstitute = missingWithSub ? missingWithSub.inStockSubstitutes[0] : null;

  return {
    canMake,
    canMakeWithSubs,
    isBottleNext,
    missingCount,
    missingItems,
    matchedItems,
    itemsWithInStockSubs,
    missingWithSub,
    bestSubstitute,
    totalCount,
    matchCount: matchedItems.length,
  };
}


