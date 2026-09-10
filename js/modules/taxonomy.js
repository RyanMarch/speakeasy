/**
 * Speakeasy Ingredient Taxonomy Module
 * Hierarchical cocktail ingredient classification, alias resolution,
 * color mapping, and category-aware search engine.
 */

import { SEED_RECIPES } from '../data/seed-recipes.js';

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
    brands: [
      'Buffalo Trace',
      "Maker's Mark",
      'Makers Mark',
      'Wild Turkey',
      'Wild Turkey 101',
      'Four Roses',
      'Four Roses Single Barrel',
      'Four Roses Small Batch',
      'Woodford Reserve',
      'Bulleit Bourbon',
      'Bulleit',
      'Elijah Craig',
      'Elijah Craig Small Batch',
      'Knob Creek',
      'Knob Creek 9',
      'Old Forester',
      'Old Forester 100',
      'Old Forester 1920',
      'Evan Williams',
      'Evan Williams Bottled in Bond',
      'Jim Beam',
      'Eagle Rare',
      'Blanton\'s',
      'Blantons',
      'Weller',
      'W.L. Weller',
      'Special Reserve',
      'Antique 107',
      'Michter\'s Bourbon',
      'Michters US 1 Bourbon',
      'Basil Hayden',
      'Basil Hayden\'s',
      'Russell\'s Reserve',
      'Russells Reserve',
      'Pappy Van Winkle',
      'Van Winkle',
    ],
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
    brands: [
      'Rittenhouse',
      'Rittenhouse Rye',
      'Bulleit Rye',
      'WhistlePig',
      'Whistle Pig',
      'Sazerac Rye',
      'Baby Saz',
      'High West Double Rye',
      'High West Rendezvous Rye',
      'Michter\'s Rye',
      'Michters US 1 Rye',
      'Old Overholt',
      'Wild Turkey 101 Rye',
      'Knob Creek Rye',
      'Woodford Reserve Rye',
      'Pikesville Rye',
      'Templeton Rye',
      'Redemption Rye',
    ],
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
    aliases: ['blended scotch', 'blended scotch whisky'],
    brands: [
      'Johnnie Walker',
      'Johnnie Walker Black',
      'Johnnie Walker Red',
      'Famous Grouse',
      'The Famous Grouse',
      'Monkey Shoulder',
      'Dewars',
      "Dewar's White Label",
      'Compass Box Artist Blend',
      'Compass Box',
      'Chivas Regal',
      'Cutty Sark',
      'J&B',
    ],
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
    aliases: ['single malt scotch', 'single malt', 'speyside scotch', 'highland scotch'],
    brands: [
      'Macallan',
      'The Macallan',
      'Glenlivet',
      'The Glenlivet',
      'Glenfiddich',
      'Balvenie',
      'The Balvenie',
      'Glenmorangie',
      'Highland Park',
      'Oban',
      'Dalmore',
      'The Dalmore',
      'Aberlour',
    ],
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
    aliases: ['peated scotch', 'islay scotch', 'peated whisky'],
    brands: [
      'Laphroaig',
      'Laphroaig 10',
      'Ardbeg',
      'Ardbeg 10',
      'Lagavulin',
      'Lagavulin 16',
      'Bowmore',
      'Talisker',
      'Talisker 10',
      'Caol Ila',
      'Bruichladdich Port Charlotte',
    ],
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
    brands: [
      'Jameson',
      'Jameson Black Barrel',
      'Redbreast',
      'Redbreast 12',
      'Bushmills',
      'Bushmills Black Bush',
      'Tullamore D.E.W.',
      'Tullamore Dew',
      'Teeling',
      'Green Spot',
      'Yellow Spot',
      'Powers',
    ],
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
    brands: [
      'Suntory Toki',
      'Toki',
      'Yamazaki',
      'Yamazaki 12',
      'Hakushu',
      'Hakushu 12',
      'Hibiki Japanese Harmony',
      'Hibiki',
      'Nikka Coffey Grain',
      'Nikka Coffey Malt',
      'Nikka from the Barrel',
      'Nikka Yoichi',
    ],
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
    brands: [
      'Crown Royal',
      'Canadian Club',
      'Lot 40',
      'Seagram\'s 7',
      'Seagrams 7',
    ],
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
    brands: [
      'Bacardi Superior',
      'Bacardi Silver',
      'Bacardi',
      'Plantation 3 Stars',
      'Planteray 3 Stars',
      'Flor de Caña 4',
      'Flor de Cana 4',
      'Havana Club 3',
      'El Dorado 3',
      'Probitas',
      'Real McCoy 3',
    ],
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
    brands: [
      'Plantation 5 Year',
      'Planteray 5 Year',
      'Plantation Original Dark',
      'El Dorado 5',
      'El Dorado 8',
      'El Dorado 12',
      'Mount Gay Eclipse',
      'Mount Gay Black Barrel',
      'Mount Gay XO',
      'Diplomático Reserva Exclusiva',
      'Diplomatico',
      'Appleton Estate 8',
      'Appleton Estate 12',
      'Flor de Caña 7',
      'Flor de Cana 7',
      'Ron Zacapa 23',
      'Santa Teresa 1796',
    ],
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
    aliases: ['blackstrap rum', 'blackstrap', 'black rum'],
    brands: [
      "Goslings Black Seal",
      'Goslings',
      'Coruba Dark',
      'Coruba',
      'Cruzan Black Strap',
      'Myers\'s Rum',
      'Myerss Rum',
    ],
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
    aliases: ['overproof rum', '151 rum'],
    brands: [
      'Wray & Nephew',
      'Wray and Nephew',
      'Plantation O.F.T.D.',
      'Planteray O.F.T.D.',
      'O.F.T.D.',
      'Lemon Hart 151',
      'Hamilton 151',
    ],
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
    aliases: ['jamaican rum', 'high-ester rum', 'funk rum', 'pot still rum'],
    brands: [
      'Smith & Cross',
      'Smith and Cross',
      'Appleton Estate Signature',
      'Appleton Estate',
      'Appleton',
      'Hampden Estate',
      'Rum-Bar Overproof',
      'Rum Fire',
      'Worth Park',
    ],
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
    brands: [
      'Clément',
      'Clement',
      'Rhum J.M',
      'Rhum JM',
      'Neisson',
      'La Favorite',
      'Damoiseau',
    ],
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
    brands: [
      'Leblon',
      'Avuá',
      'Avua',
      'Novo Fogo',
      'Ypióca',
      'Ypioca',
      'Pitú',
      'Pitu',
    ],
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
    brands: [
      'Espolòn Blanco',
      'Espolon Blanco',
      'Espolòn',
      'Espolon',
      'Fortaleza Blanco',
      'Fortaleza',
      'Tequila Ocho Plata',
      'Tequila Ocho',
      'Ocho Blanco',
      'Ocho',
      'Siete Leguas Blanco',
      'Siete Leguas',
      'Casamigos Blanco',
      'Casamigos',
      'Don Julio Blanco',
      'Don Julio',
      'Patrón Silver',
      'Patron Silver',
      'Patrón',
      'Patron',
      'G4 Blanco',
      'El Tesoro Blanco',
      'El Tequileño Blanco',
      'Herradura Blanco',
    ],
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
    brands: [
      'Casa Dragones Joven',
      'Clase Azul Gold',
      'Jose Cuervo Especial Gold',
    ],
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
    brands: [
      'Espolòn Reposado',
      'Espolon Reposado',
      'Fortaleza Reposado',
      'Tequila Ocho Reposado',
      'Casamigos Reposado',
      'Don Julio Reposado',
      'El Tesoro Reposado',
      'Siete Leguas Reposado',
      'Clase Azul Reposado',
      'Herradura Reposado',
    ],
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
    brands: [
      'Fortaleza Añejo',
      'Fortaleza Anejo',
      'Don Julio 1942',
      'El Tesoro Añejo',
      'Casamigos Añejo',
      'Tequila Ocho Añejo',
      'Espolòn Añejo',
      'Herradura Añejo',
    ],
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
    brands: [
      'Tears of Llorona',
      'El Tesoro Paradiso',
      'Don Julio Real',
      'Cuervo Reserva de la Familia',
    ],
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
    brands: [
      'Del Maguey Vida',
      'Del Maguey',
      'Vida Mezcal',
      'Banhez Ensemble',
      'Banhez',
      'Ilegal Mezcal Joven',
      'Ilegal Mezcal',
      'Ilegal',
      'Montelobos Espadín',
      'Montelobos',
      'Bozal Ensamble',
      'Bozal',
      'Alipús',
      'Alipus',
      'Rey Campero',
      'Nuestra Soledad',
    ],
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
    brands: [
      'La Venenosa Raicilla',
      'Sotol Porfidio',
      'Fabriquero Bacanora',
    ],
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
    brands: [
      'Tanqueray',
      'Tanqueray No. Ten',
      'Tanqueray 10',
      'Beefeater',
      'Beefeater 24',
      'Bombay Sapphire',
      'Bombay',
      'Sipsmith',
      'Fords Gin',
      'Boodles',
      "Gordon's",
      'Gordons',
      'Broker\'s',
      'Brokers',
    ],
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
    brands: [
      'Plymouth Gin Original',
      'Plymouth Navy Strength',
    ],
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
    brands: [
      'Hayman\'s Old Tom',
      'Haymans Old Tom',
      'Ransom Old Tom',
      'Anchor Old Tom',
    ],
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
    brands: [
      'Bols Genever',
      'Bols',
      'Boomsma Jonge',
      'Rutte Old Simon',
    ],
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
    brands: [
      "Hendrick's",
      'Hendricks',
      'Hendricks Gin',
      'Aviation Gin',
      'Aviation American Gin',
      'Aviation',
      'Roku',
      'Roku Gin',
      'The Botanist',
      'Botanist',
      'Monkey 47',
      'St. George Terroir',
      'St George Terroir',
      'St. George Botanivore',
      'Empress 1908',
      'Empress Gin',
      'Ki No Bi',
      'Barr Hill Gin',
      'Malfy Gin',
    ],
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
    brands: [
      'Drumshanbo Gunpowder',
      'Perry\'s Tot',
      'Perrys Tot',
      'Hayman\'s Royal Dock',
      'Plymouth Navy Strength',
      'Ford\'s Officers\' Reserve',
    ],
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
  kirschwasser: {
    id: 'kirschwasser',
    name: 'Kirschwasser',
    family: 'brandy',
    parent: 'spirits',
    color: '#eceae0',
    light: '#f8f6f0',
    dark: '#d0cdc0',
    defaultAbv: 42,
    aliases: ['eau de vie', 'eaux-de-vie', 'kirsch', 'kirschwasser'],
  },
  poire_williams: {
    id: 'poire_williams',
    name: 'Poire Williams',
    family: 'brandy',
    parent: 'spirits',
    color: '#ecead8',
    light: '#f8f6ec',
    dark: '#cdc9b0',
    defaultAbv: 42,
    aliases: ['poire williams'],
  },
  slivovitz: {
    id: 'slivovitz',
    name: 'Slivovitz',
    family: 'brandy',
    parent: 'spirits',
    color: '#e8dcc0',
    light: '#f5ece0',
    dark: '#c4b48f',
    defaultAbv: 42,
    aliases: ['slivovitz'],
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
    brands: [
      "Tito's",
      'Titos',
      'Titos Handmade Vodka',
      'Grey Goose',
      'Ketel One',
      'Belvedere',
      'Absolut',
      'Stolichnaya',
      'Stoli',
      'Chopin',
      'Reyka',
      'Haku Vodka',
      'Beluga',
    ],
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
    aliases: ['flavored vodka', 'citrus vodka', 'citron vodka', 'vanilla vodka'],
    brands: [
      'Absolut Citron',
      'Ketel One Citroen',
      'Grey Goose Le Citron',
    ],
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
    brands: [
      'Linie Aquavit',
      'Aalborg',
      'Krogstad',
      'Brennivín',
      'Brennivin',
    ],
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
  lillet_blanc: {
    id: 'lillet_blanc',
    name: 'Lillet Blanc',
    family: 'quinquina',
    parent: 'fortified_wine',
    color: '#e0cf8a',
    light: '#f0e4b5',
    dark: '#a89858',
    defaultAbv: 17,
    aliases: ['lillet blanc', 'lillet'],
  },
  lillet_rouge: {
    id: 'lillet_rouge',
    name: 'Lillet Rouge',
    family: 'quinquina',
    parent: 'fortified_wine',
    color: '#6e1520',
    light: '#8f2938',
    dark: '#470b12',
    defaultAbv: 17,
    aliases: ['lillet rouge'],
  },
  cocchi_americano: {
    id: 'cocchi_americano',
    name: 'Cocchi Americano',
    family: 'quinquina',
    parent: 'fortified_wine',
    color: '#d4a83a',
    light: '#e8c463',
    dark: '#a17d20',
    defaultAbv: 17,
    aliases: ['cocchi americano'],
  },
  cocchi_rosa: {
    id: 'cocchi_rosa',
    name: 'Cocchi Rosa',
    family: 'quinquina',
    parent: 'fortified_wine',
    color: '#c0455a',
    light: '#d97080',
    dark: '#8a2c3a',
    defaultAbv: 17,
    aliases: ['cocchi rosa'],
  },
  dubonnet: {
    id: 'dubonnet',
    name: 'Dubonnet',
    family: 'quinquina',
    parent: 'fortified_wine',
    color: '#5c1428',
    light: '#7a2540',
    dark: '#380a18',
    defaultAbv: 17,
    aliases: ['dubonnet'],
  },
  byrrh: {
    id: 'byrrh',
    name: 'Byrrh',
    family: 'quinquina',
    parent: 'fortified_wine',
    color: '#4a1218',
    light: '#6e2028',
    dark: '#2e0810',
    defaultAbv: 17,
    aliases: ['byrrh'],
  },
  bonal: {
    id: 'bonal',
    name: 'Bonal',
    family: 'quinquina',
    parent: 'fortified_wine',
    color: '#6e2418',
    light: '#8f3d28',
    dark: '#45140c',
    defaultAbv: 17,
    aliases: ['bonal'],
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
  madeira: {
    id: 'madeira',
    name: 'Madeira',
    family: 'oxidized_wine',
    parent: 'fortified_wine',
    color: '#7a3e14',
    light: '#9c5c28',
    dark: '#4d2308',
    defaultAbv: 18,
    aliases: ['madeira'],
  },
  marsala: {
    id: 'marsala',
    name: 'Marsala',
    family: 'oxidized_wine',
    parent: 'fortified_wine',
    color: '#8a2e14',
    light: '#ac4a28',
    dark: '#5c1a08',
    defaultAbv: 18,
    aliases: ['marsala'],
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
  campari: {
    id: 'campari',
    name: 'Campari',
    family: 'amaro',
    parent: 'liqueurs',
    color: '#c8102e',
    light: '#e8354f',
    dark: '#8a0a1e',
    defaultAbv: 24,
    aliases: ['campari', 'red bitter', 'aperitivo'],
  },
  aperol: {
    id: 'aperol',
    name: 'Aperol',
    family: 'amaro',
    parent: 'liqueurs',
    color: '#e8641e',
    light: '#f5854a',
    dark: '#b4470f',
    defaultAbv: 24,
    aliases: ['aperol'],
  },
  select_aperitivo: {
    id: 'select_aperitivo',
    name: 'Select Aperitivo',
    family: 'amaro',
    parent: 'liqueurs',
    color: '#d4321e',
    light: '#e85a3f',
    dark: '#9c2010',
    defaultAbv: 24,
    aliases: ['select'],
  },
  cappelletti: {
    id: 'cappelletti',
    name: 'Cappelletti',
    family: 'amaro',
    parent: 'liqueurs',
    color: '#c01e2e',
    light: '#de3f4f',
    dark: '#870f1a',
    defaultAbv: 24,
    aliases: ['cappelletti'],
  },
  amaro_averna: {
    id: 'amaro_averna',
    name: 'Amaro Averna',
    family: 'amaro',
    parent: 'liqueurs',
    color: '#3a1e10',
    light: '#5c331e',
    dark: '#200f08',
    defaultAbv: 29,
    aliases: ['averna', 'amaro averna', 'amaro'],
  },
  amaro_montenegro: {
    id: 'amaro_montenegro',
    name: 'Amaro Montenegro',
    family: 'amaro',
    parent: 'liqueurs',
    color: '#a85a1e',
    light: '#c47a3a',
    dark: '#7a3d10',
    defaultAbv: 29,
    aliases: ['montenegro', 'amaro montenegro'],
  },
  amaro_nonino: {
    id: 'amaro_nonino',
    name: 'Amaro Nonino',
    family: 'amaro',
    parent: 'liqueurs',
    color: '#c48a2e',
    light: '#dda854',
    dark: '#916418',
    defaultAbv: 29,
    aliases: ['nonino', 'amaro nonino'],
  },
  meletti: {
    id: 'meletti',
    name: 'Meletti',
    family: 'amaro',
    parent: 'liqueurs',
    color: '#4a1e14',
    light: '#6e3320',
    dark: '#2e0f08',
    defaultAbv: 29,
    aliases: ['meletti'],
  },
  ramazzotti: {
    id: 'ramazzotti',
    name: 'Ramazzotti',
    family: 'amaro',
    parent: 'liqueurs',
    color: '#3a1a10',
    light: '#5c301e',
    dark: '#200d08',
    defaultAbv: 29,
    aliases: ['ramazzotti'],
  },
  amaro_lucano: {
    id: 'amaro_lucano',
    name: 'Amaro Lucano',
    family: 'amaro',
    parent: 'liqueurs',
    color: '#3e2010',
    light: '#603820',
    dark: '#221008',
    defaultAbv: 29,
    aliases: ['lucano'],
  },
  cynar: {
    id: 'cynar',
    name: 'Cynar',
    family: 'amaro',
    parent: 'liqueurs',
    color: '#2e1810',
    light: '#4a2c1a',
    dark: '#180c06',
    defaultAbv: 29,
    aliases: ['cynar'],
  },
  fernet: {
    id: 'fernet',
    name: 'Fernet',
    family: 'amaro',
    parent: 'liqueurs',
    color: '#1e120a',
    light: '#362010',
    dark: '#0d0704',
    defaultAbv: 39,
    aliases: ['fernet-branca', 'fernet branca', 'fernet'],
  },
  branca_menta: {
    id: 'branca_menta',
    name: 'Branca Menta',
    family: 'amaro',
    parent: 'liqueurs',
    color: '#2a3a1a',
    light: '#45592e',
    dark: '#16200e',
    defaultAbv: 39,
    aliases: ['branca menta'],
  },
  braulio: {
    id: 'braulio',
    name: 'Braulio',
    family: 'amaro',
    parent: 'liqueurs',
    color: '#2e2010',
    light: '#4a381e',
    dark: '#180f08',
    defaultAbv: 39,
    aliases: ['braulio', 'amaro braulio'],
  },
  amaro_sibilla: {
    id: 'amaro_sibilla',
    name: 'Amaro Sibilla',
    family: 'amaro',
    parent: 'liqueurs',
    color: '#302012',
    light: '#4e3820',
    dark: '#180f08',
    defaultAbv: 39,
    aliases: ['amaro sibilla'],
  },
  suze: {
    id: 'suze',
    name: 'Suze',
    family: 'amaro',
    parent: 'liqueurs',
    color: '#e0c422',
    light: '#f0da50',
    dark: '#a89012',
    defaultAbv: 20,
    aliases: ['suze', 'gentian liqueur', 'gentian'],
  },
  salers: {
    id: 'salers',
    name: 'Salers',
    family: 'amaro',
    parent: 'liqueurs',
    color: '#e0a822',
    light: '#f0c250',
    dark: '#a87d12',
    defaultAbv: 20,
    aliases: ['salers'],
  },
  aveze: {
    id: 'aveze',
    name: 'Avèze',
    family: 'amaro',
    parent: 'liqueurs',
    color: '#dcc030',
    light: '#ecd65a',
    dark: '#a48f18',
    defaultAbv: 20,
    aliases: ['avèze', 'aveze'],
  },
  green_chartreuse: {
    id: 'green_chartreuse',
    name: 'Green Chartreuse',
    family: 'botanical_liqueur',
    parent: 'liqueurs',
    color: '#7fb32e',
    light: '#a0d454',
    dark: '#588016',
    defaultAbv: 45,
    aliases: ['green chartreuse', 'chartreuse'],
  },
  yellow_chartreuse: {
    id: 'yellow_chartreuse',
    name: 'Yellow Chartreuse',
    family: 'botanical_liqueur',
    parent: 'liqueurs',
    color: '#e0c22e',
    light: '#f0da5c',
    dark: '#a88f18',
    defaultAbv: 45,
    aliases: ['yellow chartreuse'],
  },
  benedictine: {
    id: 'benedictine',
    name: 'Bénédictine',
    family: 'botanical_liqueur',
    parent: 'liqueurs',
    color: '#c17f2e',
    light: '#dc9f4f',
    dark: '#8f5c18',
    defaultAbv: 45,
    aliases: ['bénédictine', 'benedictine'],
  },
  strega: {
    id: 'strega',
    name: 'Strega',
    family: 'botanical_liqueur',
    parent: 'liqueurs',
    color: '#e0c817',
    light: '#f2dc4a',
    dark: '#a89408',
    defaultAbv: 45,
    aliases: ['strega'],
  },
  galliano: {
    id: 'galliano',
    name: 'Galliano',
    family: 'botanical_liqueur',
    parent: 'liqueurs',
    color: '#e0b52e',
    light: '#f0cc5a',
    dark: '#a88418',
    defaultAbv: 45,
    aliases: ['galliano'],
  },
  sambuca: {
    id: 'sambuca',
    name: 'Sambuca',
    family: 'botanical_liqueur',
    parent: 'liqueurs',
    color: '#ece7d6',
    light: '#f7f3e8',
    dark: '#c9c2a8',
    defaultAbv: 45,
    aliases: ['sambuca'],
  },
  drambuie: {
    id: 'drambuie',
    name: 'Drambuie',
    family: 'botanical_liqueur',
    parent: 'liqueurs',
    color: '#b8720f',
    light: '#d4922e',
    dark: '#8a5308',
    defaultAbv: 45,
    aliases: ['drambuie'],
  },
  absinthe: {
    id: 'absinthe',
    name: 'Absinthe',
    family: 'anise',
    parent: 'liqueurs',
    color: '#6faa3e',
    light: '#8fc95e',
    dark: '#4d7a26',
    defaultAbv: 55,
    aliases: ['absinthe'],
  },
  pastis: {
    id: 'pastis',
    name: 'Pastis',
    family: 'anise',
    parent: 'liqueurs',
    color: '#e0d9a0',
    light: '#ecE6b8',
    dark: '#a89f5a',
    defaultAbv: 55,
    aliases: ['pastis', 'ricard', 'pernod'],
  },
  herbsaint: {
    id: 'herbsaint',
    name: 'Herbsaint',
    family: 'anise',
    parent: 'liqueurs',
    color: '#a8c47a',
    light: '#c4dd9e',
    dark: '#7a9550',
    defaultAbv: 55,
    aliases: ['herbsaint'],
  },
  ouzo: {
    id: 'ouzo',
    name: 'Ouzo',
    family: 'anise',
    parent: 'liqueurs',
    color: '#e8e4d8',
    light: '#f5f2ea',
    dark: '#c4bfae',
    defaultAbv: 55,
    aliases: ['ouzo'],
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
    aliases: ['dry curacao', 'dry curaçao', 'pierre ferrand dry curaçao', 'pierre ferrand dry curacao', 'curacao', 'curaçao', 'orange curacao', 'orange curaçao'],
  },
  blue_curacao: {
    id: 'blue_curacao',
    name: 'Blue Curaçao',
    family: 'orange_liqueur',
    parent: 'liqueurs',
    color: '#0096c7',
    light: '#48cae4',
    dark: '#023e8a',
    defaultAbv: 25,
    aliases: ['blue curacao', 'blue curaçao', 'curacao blue', 'curaçao blue'],
  },
  grand_marnier: {
    id: 'grand_marnier',
    name: 'Grand Marnier',
    family: 'orange_liqueur',
    parent: 'liqueurs',
    color: '#c4701e',
    light: '#de9040',
    dark: '#914e10',
    defaultAbv: 40,
    aliases: ['grand marnier'],
  },
  limoncello: {
    id: 'limoncello',
    name: 'Limoncello',
    family: 'orange_liqueur',
    parent: 'liqueurs',
    color: '#f0e022',
    light: '#f8ec5a',
    dark: '#b8a812',
    defaultAbv: 25,
    aliases: ['limoncello'],
  },
  bergamot_liqueur: {
    id: 'bergamot_liqueur',
    name: 'Bergamot Liqueur',
    family: 'orange_liqueur',
    parent: 'liqueurs',
    color: '#e0dc8a',
    light: '#f0ecb5',
    dark: '#a8a458',
    defaultAbv: 25,
    aliases: ['bergamot', 'italicus', 'bergamot liqueur'],
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
    aliases: ['cherry heering', 'cherry liqueur', 'cherry brandy', 'guignolet'],
  },
  creme_de_cassis: {
    id: 'creme_de_cassis',
    name: 'Crème de Cassis',
    family: 'fruit_liqueur',
    parent: 'liqueurs',
    color: '#4a0e28',
    light: '#6e1c40',
    dark: '#2e0618',
    defaultAbv: 18,
    aliases: ['crème de cassis', 'creme de cassis', 'blackcurrant liqueur'],
  },
  creme_de_mure: {
    id: 'creme_de_mure',
    name: 'Crème de Mûre',
    family: 'fruit_liqueur',
    parent: 'liqueurs',
    color: '#380e2a',
    light: '#581c44',
    dark: '#200618',
    defaultAbv: 18,
    aliases: ['crème de mûre', 'creme de mure', 'blackberry liqueur'],
  },
  raspberry_liqueur: {
    id: 'raspberry_liqueur',
    name: 'Raspberry Liqueur',
    family: 'fruit_liqueur',
    parent: 'liqueurs',
    color: '#5c0e2e',
    light: '#821c46',
    dark: '#380818',
    defaultAbv: 18,
    aliases: ['chambord', 'raspberry liqueur'],
  },
  apricot_liqueur: {
    id: 'apricot_liqueur',
    name: 'Apricot Liqueur',
    family: 'fruit_liqueur',
    parent: 'liqueurs',
    color: '#e8942e',
    light: '#f5b054',
    dark: '#b4701a',
    defaultAbv: 24,
    aliases: ['apricot liqueur', 'apricot brandy'],
  },
  peach_schnapps: {
    id: 'peach_schnapps',
    name: 'Peach Schnapps',
    family: 'fruit_liqueur',
    parent: 'liqueurs',
    color: '#f0b888',
    light: '#f8d4b0',
    dark: '#c48f5e',
    defaultAbv: 24,
    aliases: ['peach schnapps', 'crème de pêche', 'creme de peche', 'peach liqueur'],
  },
  plum_liqueur: {
    id: 'plum_liqueur',
    name: 'Plum Liqueur',
    family: 'fruit_liqueur',
    parent: 'liqueurs',
    color: '#4a1e3a',
    light: '#6e3458',
    dark: '#2e1024',
    defaultAbv: 24,
    aliases: ['plum liqueur', 'umeshu'],
  },
  creme_de_banane: {
    id: 'creme_de_banane',
    name: 'Crème de Banane',
    family: 'fruit_liqueur',
    parent: 'liqueurs',
    color: '#e8d42e',
    light: '#f5e660',
    dark: '#b4a318',
    defaultAbv: 24,
    aliases: ['banana liqueur', 'crème de banane', 'creme de banane'],
  },
  passion_fruit_liqueur: {
    id: 'passion_fruit_liqueur',
    name: 'Passion Fruit Liqueur',
    family: 'fruit_liqueur',
    parent: 'liqueurs',
    color: '#e8a22e',
    light: '#f5bd58',
    dark: '#b47c1a',
    defaultAbv: 24,
    aliases: ['passion fruit liqueur', 'passoã', 'passoa'],
  },
  melon_liqueur: {
    id: 'melon_liqueur',
    name: 'Melon Liqueur',
    family: 'fruit_liqueur',
    parent: 'liqueurs',
    color: '#7ac82e',
    light: '#9ee158',
    dark: '#58941a',
    defaultAbv: 24,
    aliases: ['midori', 'melon liqueur'],
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
  amaretto: {
    id: 'amaretto',
    name: 'Amaretto',
    family: 'nut_seed_liqueur',
    parent: 'liqueurs',
    color: '#8a4a1e',
    light: '#ac6a38',
    dark: '#5c2f10',
    defaultAbv: 24,
    aliases: ['amaretto', 'disaronno'],
  },
  hazelnut_liqueur: {
    id: 'hazelnut_liqueur',
    name: 'Hazelnut Liqueur',
    family: 'nut_seed_liqueur',
    parent: 'liqueurs',
    color: '#96541e',
    light: '#b8763a',
    dark: '#6a3810',
    defaultAbv: 24,
    aliases: ['frangelico', 'hazelnut liqueur'],
  },
  nocino: {
    id: 'nocino',
    name: 'Nocino',
    family: 'nut_seed_liqueur',
    parent: 'liqueurs',
    color: '#241408',
    light: '#3c2210',
    dark: '#120a04',
    defaultAbv: 24,
    aliases: ['nocino'],
  },
  falernum: {
    id: 'falernum',
    name: 'Falernum',
    family: 'spiced_liqueur',
    parent: 'liqueurs',
    color: '#d4b483',
    light: '#e8d4a8',
    dark: '#a8875a',
    defaultAbv: 28,
    aliases: ['falernum', 'velvet falernum'],
  },
  allspice_dram: {
    id: 'allspice_dram',
    name: 'Allspice Dram',
    family: 'spiced_liqueur',
    parent: 'liqueurs',
    color: '#5c2a12',
    light: '#7a3f1f',
    dark: '#3a1608',
    defaultAbv: 28,
    aliases: ['allspice dram', 'pimento dram'],
  },
  ancho_chile_liqueur: {
    id: 'ancho_chile_liqueur',
    name: 'Ancho Chile Liqueur',
    family: 'spiced_liqueur',
    parent: 'liqueurs',
    color: '#7a1f12',
    light: '#9c3420',
    dark: '#4d0f08',
    defaultAbv: 28,
    aliases: ['ancho reyes', 'ancho chile liqueur'],
  },
  ginger_liqueur: {
    id: 'ginger_liqueur',
    name: 'Ginger Liqueur',
    family: 'spiced_liqueur',
    parent: 'liqueurs',
    color: '#c9962c',
    light: '#e0b355',
    dark: '#96701a',
    defaultAbv: 28,
    aliases: ['ginger liqueur', 'domaine de canton'],
  },
  cinnamon_liqueur: {
    id: 'cinnamon_liqueur',
    name: 'Cinnamon Liqueur',
    family: 'spiced_liqueur',
    parent: 'liqueurs',
    color: '#a85a2e',
    light: '#c47a4a',
    dark: '#7a3d1a',
    defaultAbv: 28,
    aliases: ['cinnamon liqueur'],
  },
  elderflower_liqueur: {
    id: 'elderflower_liqueur',
    name: 'Elderflower Liqueur',
    family: 'floral_liqueur',
    parent: 'liqueurs',
    color: '#e8dc8a',
    light: '#f5ecb5',
    dark: '#c4b45a',
    defaultAbv: 20,
    aliases: ['elderflower', 'elderflower liqueur', 'st-germain', 'st germain'],
  },
  creme_de_violette: {
    id: 'creme_de_violette',
    name: 'Crème de Violette',
    family: 'floral_liqueur',
    parent: 'liqueurs',
    color: '#6a4c93',
    light: '#8a6cb5',
    dark: '#452f66',
    defaultAbv: 20,
    aliases: ['violette', 'crème de violette', 'creme de violette'],
  },
  rose_liqueur: {
    id: 'rose_liqueur',
    name: 'Rose Liqueur',
    family: 'floral_liqueur',
    parent: 'liqueurs',
    color: '#e8a8b8',
    light: '#f5c9d4',
    dark: '#c47a8c',
    defaultAbv: 20,
    aliases: ['rose liqueur'],
  },
  fruit_cup: {
    id: 'fruit_cup',
    name: "Pimm's No. 1 / Fruit Cup",
    family: 'specialty_liqueur',
    parent: 'liqueurs',
    color: '#8b3d1f',
    light: '#ad522d',
    dark: '#5e230e',
    defaultAbv: 25,
    aliases: ["pimm's no. 1", "pimm's no 1", "pimms no 1", "pimms no. 1", "pimm's", 'pimms', 'fruit cup'],
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
  irish_cream: {
    id: 'irish_cream',
    name: 'Irish Cream',
    family: 'cream_liqueur',
    parent: 'liqueurs',
    color: '#d4b896',
    light: '#ead6bd',
    dark: '#a8875f',
    defaultAbv: 17,
    aliases: ['baileys', 'irish cream', 'cream liqueur'],
  },
  rumchata: {
    id: 'rumchata',
    name: 'RumChata',
    family: 'cream_liqueur',
    parent: 'liqueurs',
    color: '#e8dcc4',
    light: '#f5eeda',
    dark: '#c4b28f',
    defaultAbv: 17,
    aliases: ['rumchata'],
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
  sugar_cube: {
    id: 'sugar_cube',
    name: 'Sugar Cube',
    family: 'raw_sweetener',
    parent: 'sweeteners',
    color: '#f5f2ea',
    light: '#ffffff',
    dark: '#d4cfc0',
    defaultAbv: 0,
    aliases: ['sugar cube', 'superfine sugar', 'sugar'],
  },
  molasses: {
    id: 'molasses',
    name: 'Molasses',
    family: 'raw_sweetener',
    parent: 'sweeteners',
    color: '#2e1a0a',
    light: '#4a2c14',
    dark: '#180d04',
    defaultAbv: 0,
    aliases: ['molasses'],
  },
  jam: {
    id: 'jam',
    name: 'Jam',
    family: 'raw_sweetener',
    parent: 'sweeteners',
    color: '#7a1f2e',
    light: '#a3324a',
    dark: '#4d0f18',
    defaultAbv: 0,
    aliases: ['jam'],
  },
  marmalade: {
    id: 'marmalade',
    name: 'Marmalade',
    family: 'raw_sweetener',
    parent: 'sweeteners',
    color: '#d4711a',
    light: '#e89440',
    dark: '#a1540f',
    defaultAbv: 0,
    aliases: ['marmalade'],
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
  apple_cider: {
    id: 'apple_cider',
    name: 'Apple Cider',
    family: 'fruit_juice',
    parent: 'produce',
    color: '#d4941e',
    light: '#e8b448',
    dark: '#a1700f',
    defaultAbv: 0,
    aliases: ['apple cider'],
  },
  apple_juice: {
    id: 'apple_juice',
    name: 'Apple Juice',
    family: 'fruit_juice',
    parent: 'produce',
    color: '#e8c86e',
    light: '#f5dc98',
    dark: '#b89a48',
    defaultAbv: 0,
    aliases: ['apple juice'],
  },
  pomegranate_juice: {
    id: 'pomegranate_juice',
    name: 'Pomegranate Juice',
    family: 'fruit_juice',
    parent: 'produce',
    color: '#941e28',
    light: '#b83440',
    dark: '#6a0f16',
    defaultAbv: 0,
    aliases: ['pomegranate juice'],
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
  citric_acid: {
    id: 'citric_acid',
    name: 'Citric Acid',
    family: 'acids',
    parent: 'produce',
    color: '#f0ede4',
    light: '#faf8f2',
    dark: '#d4cfc0',
    defaultAbv: 0,
    aliases: ['citric acid solution', 'citric acid'],
  },
  malic_acid: {
    id: 'malic_acid',
    name: 'Malic Acid',
    family: 'acids',
    parent: 'produce',
    color: '#f0ede4',
    light: '#faf8f2',
    dark: '#d4cfc0',
    defaultAbv: 0,
    aliases: ['malic acid solution', 'malic acid'],
  },
  verjus: {
    id: 'verjus',
    name: 'Verjus',
    family: 'acids',
    parent: 'produce',
    color: '#d4d488',
    light: '#e8e8b0',
    dark: '#a3a35a',
    defaultAbv: 0,
    aliases: ['acid-adjusted juice', 'verjus'],
  },
  fresh_mint: {
    id: 'fresh_mint',
    name: 'Fresh Mint',
    family: 'fresh_produce',
    parent: 'produce',
    color: '#4a9e3a',
    light: '#6ec25a',
    dark: '#2e6e20',
    defaultAbv: 0,
    aliases: ['fresh mint', 'mint'],
  },
  basil: {
    id: 'basil',
    name: 'Basil',
    family: 'fresh_produce',
    parent: 'produce',
    color: '#3a6e2a',
    light: '#588f42',
    dark: '#204a16',
    defaultAbv: 0,
    aliases: ['basil'],
  },
  cucumber: {
    id: 'cucumber',
    name: 'Cucumber',
    family: 'fresh_produce',
    parent: 'produce',
    color: '#a8d488',
    light: '#c9e8ae',
    dark: '#7aa860',
    defaultAbv: 0,
    aliases: ['cucumber'],
  },
  ginger_root: {
    id: 'ginger_root',
    name: 'Ginger Root',
    family: 'fresh_produce',
    parent: 'produce',
    color: '#d4b57a',
    light: '#e8d4a3',
    dark: '#a3854f',
    defaultAbv: 0,
    aliases: ['ginger root'],
  },
  blackberries: {
    id: 'blackberries',
    name: 'Blackberries',
    family: 'fresh_produce',
    parent: 'produce',
    color: '#3a1a2e',
    light: '#5c2e4a',
    dark: '#200e18',
    defaultAbv: 0,
    aliases: ['blackberries', 'berries'],
  },
  strawberries: {
    id: 'strawberries',
    name: 'Strawberries',
    family: 'fresh_produce',
    parent: 'produce',
    color: '#c0202f',
    light: '#e0454f',
    dark: '#870f18',
    defaultAbv: 0,
    aliases: ['strawberries'],
  },
  grapes: {
    id: 'grapes',
    name: 'Grapes',
    family: 'fresh_produce',
    parent: 'produce',
    color: '#8ab84a',
    light: '#a8d46e',
    dark: '#5f8a2e',
    defaultAbv: 0,
    aliases: ['grapes', 'green grapes'],
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
    aliases: ['angostura', 'angostura bitters', "boker’s", "boker's", 'bokers', 'jerry thomas own decanter', 'aromatic bitters', 'bitters'],
  },
  peychauds_bitters: {
    id: 'peychauds_bitters',
    name: "Peychaud's Bitters",
    family: 'bitters',
    parent: 'bitters',
    // Peychaud's distinctive vivid ruby-pink — visibly different from Angostura's
    // dark brown-red, and the whole reason a Sazerac's rinse tints the glass pink.
    // It was previously just an alias of aromatic_bitters, so every recipe calling
    // for it by name (Sazerac, Vieux Carré, Metropole...) rendered Angostura's
    // color instead.
    color: '#c81d3f',
    light: '#e8395f',
    dark: '#8f0f28',
    defaultAbv: 35,
    aliases: ['peychaud’s', "peychaud's", 'peychauds', "peychaud's bitters", 'peychauds bitters'],
  },
  orange_bitters: {
    id: 'orange_bitters',
    name: 'Orange Bitters',
    family: 'bitters',
    parent: 'bitters',
    color: '#b8601e',
    light: '#d4823e',
    dark: '#874510',
    defaultAbv: 35,
    aliases: ['orange bitters', "regan's no. 6", "regan's", 'fee brothers west indian orange'],
  },
  grapefruit_bitters: {
    id: 'grapefruit_bitters',
    name: 'Grapefruit Bitters',
    family: 'bitters',
    parent: 'bitters',
    color: '#d4586a',
    light: '#e87d8c',
    dark: '#a13a48',
    defaultAbv: 35,
    aliases: ['grapefruit bitters'],
  },
  chocolate_bitters: {
    id: 'chocolate_bitters',
    name: 'Chocolate Bitters',
    family: 'bitters',
    parent: 'bitters',
    color: '#2e1a10',
    light: '#4a301e',
    dark: '#180d06',
    defaultAbv: 38,
    aliases: ['chocolate bitters'],
  },
  mole_bitters: {
    id: 'mole_bitters',
    name: 'Mole Bitters',
    family: 'bitters',
    parent: 'bitters',
    color: '#3a1810',
    light: '#5c2e1a',
    dark: '#200c06',
    defaultAbv: 38,
    aliases: ['mole bitters'],
  },
  walnut_bitters: {
    id: 'walnut_bitters',
    name: 'Walnut Bitters',
    family: 'bitters',
    parent: 'bitters',
    color: '#3a2414',
    light: '#593a22',
    dark: '#201207',
    defaultAbv: 38,
    aliases: ['walnut bitters'],
  },
  celery_bitters: {
    id: 'celery_bitters',
    name: 'Celery Bitters',
    family: 'bitters',
    parent: 'bitters',
    color: '#a8c47a',
    light: '#c4dd9e',
    dark: '#7a9550',
    defaultAbv: 38,
    aliases: ['celery bitters'],
  },
  cardamom_bitters: {
    id: 'cardamom_bitters',
    name: 'Cardamom Bitters',
    family: 'bitters',
    parent: 'bitters',
    color: '#8a6a3a',
    light: '#ac8c5c',
    dark: '#5c4520',
    defaultAbv: 38,
    aliases: ['cardamom bitters'],
  },
  cherry_bitters: {
    id: 'cherry_bitters',
    name: 'Cherry Bitters',
    family: 'bitters',
    parent: 'bitters',
    color: '#6e1420',
    light: '#8f2836',
    dark: '#470a14',
    defaultAbv: 38,
    aliases: ['cherry bitters'],
  },
  saline_solution: {
    id: 'saline_solution',
    name: 'Saline Solution',
    family: 'tinctures',
    parent: 'bitters',
    color: '#e8f0f2',
    light: '#f5fafb',
    dark: '#c9d8dc',
    defaultAbv: 0,
    aliases: ['saline solution', 'saline solution (20%)', 'saline'],
  },
  chili_tincture: {
    id: 'chili_tincture',
    name: 'Chili Tincture',
    family: 'tinctures',
    parent: 'bitters',
    color: '#8a1a12',
    light: '#b0301f',
    dark: '#5c0d08',
    defaultAbv: 0,
    aliases: ['chili tincture', 'firewater'],
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
  cocktail_foamer: {
    id: 'cocktail_foamer',
    name: 'Cocktail Foamer',
    family: 'texture',
    parent: 'mixers',
    color: '#f4ece1',
    light: '#ffffff',
    dark: '#dbd1c3',
    defaultAbv: 0,
    aliases: [
      'cocktail foamer',
      'foamer',
      'cocktail foaming agent',
      'foaming drops',
      'vegan foamer',
      'wonderfoam',
      'miraculous foamer',
      'stillabunt',
      'fee foam',
      'fee brothers fee foam',
    ],
    brands: [
      'Fee Brothers Fee Foam',
      'Fee Foam',
      'Wonderfoam',
      'Ms. Better\'s Bitters Miraculous Foamer',
      'Miraculous Foamer',
      'Stillabunt',
    ],
  },
  heavy_cream: {
    id: 'heavy_cream',
    name: 'Heavy Cream',
    family: 'dairy',
    parent: 'mixers',
    color: '#f5f0e4',
    light: '#ffffff',
    dark: '#d4cbb4',
    defaultAbv: 0,
    aliases: ['heavy cream', 'cream'],
  },
  half_and_half: {
    id: 'half_and_half',
    name: 'Half and Half',
    family: 'dairy',
    parent: 'mixers',
    color: '#f5f0e4',
    light: '#fffdf5',
    dark: '#d8cfb8',
    defaultAbv: 0,
    aliases: ['half and half'],
  },
  whole_milk: {
    id: 'whole_milk',
    name: 'Whole Milk',
    family: 'dairy',
    parent: 'mixers',
    color: '#f7f5ee',
    light: '#ffffff',
    dark: '#ded8c4',
    defaultAbv: 0,
    aliases: ['whole milk', 'milk'],
  },
  condensed_milk: {
    id: 'condensed_milk',
    name: 'Condensed Milk',
    family: 'dairy',
    parent: 'mixers',
    color: '#ecdca0',
    light: '#f5ecc0',
    dark: '#c4b078',
    defaultAbv: 0,
    aliases: ['condensed milk'],
  },
  coconut_cream: {
    id: 'coconut_cream',
    name: 'Coconut Cream',
    family: 'dairy',
    parent: 'mixers',
    color: '#f7f2e4',
    light: '#ffffff',
    dark: '#ddd4bd',
    defaultAbv: 0,
    aliases: ['coconut cream', 'coco lopez', 'cream of coconut'],
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
  mexican_lager: {
    id: 'mexican_lager',
    name: 'Mexican Lager',
    family: 'fermented',
    parent: 'mixers',
    color: '#e0b23e',
    light: '#f0cc68',
    dark: '#a8801e',
    defaultAbv: 5,
    aliases: ['beer', 'mexican lager', 'mexican beer', 'lager'],
  },
  stout: {
    id: 'stout',
    name: 'Stout',
    family: 'fermented',
    parent: 'mixers',
    color: '#1a0e08',
    light: '#301c10',
    dark: '#0a0503',
    defaultAbv: 5,
    aliases: ['guinness', 'stout'],
  },
  pilsner: {
    id: 'pilsner',
    name: 'Pilsner',
    family: 'fermented',
    parent: 'mixers',
    color: '#e8c458',
    light: '#f5da80',
    dark: '#b49630',
    defaultAbv: 5,
    aliases: ['pilsner'],
  },
  ipa: {
    id: 'ipa',
    name: 'IPA',
    family: 'fermented',
    parent: 'mixers',
    color: '#d4941e',
    light: '#e8b448',
    dark: '#a1700f',
    defaultAbv: 5,
    aliases: ['ipa', 'pale ale'],
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
    aliases: ['celery salt', 'celery seed', 'worcestershire sauce', 'worcestershire', 'hot sauce', 'tabasco', 'black pepper', 'salt', 'sea salt', 'kosher salt'],
  },
};

// Human-readable labels for the `family` field, used to sub-group My Bar's
// ingredient pills within a category (e.g. all rums together, all amari
// together) instead of one flat alphabetical list per category.
const FAMILY_LABELS = {
  amaro: 'Amaro',
  anise: 'Anise & Absinthe',
  botanical_liqueur: 'Herbal & Botanical Liqueurs',
  cream_liqueur: 'Cream Liqueurs',
  floral_liqueur: 'Floral Liqueurs',
  fruit_liqueur: 'Fruit Liqueurs',
  nut_seed_liqueur: 'Nut & Seed Liqueurs',
  orange_liqueur: 'Orange Liqueurs',
  specialty_liqueur: 'Specialty Liqueurs',
  spiced_liqueur: 'Spiced Liqueurs',
  brandy: 'Brandy & Eau de Vie',
  rum: 'Rum',
  gin: 'Gin',
  neutral_spirits: 'Vodka & Neutral Spirits',
  tequila: 'Tequila',
  agave_spirits: 'Mezcal & Agave Spirits',
  cane_spirits: 'Cachaça & Cane Spirits',
  vermouth: 'Vermouth',
  quinquina: 'Quinquina & Aperitif Wines',
  sherry: 'Sherry',
  port: 'Port',
  wine: 'Wine',
  sparkling_wine: 'Sparkling Wine',
  oxidized_wine: 'Madeira & Marsala',
  asian_rice_ferments: 'Sake & Rice Wine',
  bitters: 'Bitters',
  tinctures: 'Tinctures & Solutions',
  cane_syrup: 'Cane & Simple Syrups',
  flavored_syrup: 'Flavored Syrups',
  raw_sweetener: 'Raw Sweeteners',
  dairy: 'Dairy',
  soda: 'Soda & Sparkling Mixers',
  fermented: 'Beer & Fermented',
  texture: 'Texture & Foamers',
  coffee: 'Coffee',
  aromatic_water: 'Aromatic Waters',
  acids: 'Acids',
  brine: 'Brines',
  citrus_juice: 'Citrus Juice',
  fresh_produce: 'Fresh Produce',
  fruit_juice: 'Fruit Juice',
  savory: 'Savory',
  seasoning: 'Seasonings',
};

// Per-id overrides for families that are too coarse to be useful as a single
// display group on their own (e.g. every whiskey style shares `family:
// 'whiskey'` so substitution stays lenient, but "Bourbon", "Scotch", and
// "Irish Whiskey" still belong in visually separate clusters in My Bar).
const FAMILY_LABEL_ID_OVERRIDES = {
  bourbon: 'Bourbon',
  rye_whiskey: 'Rye Whiskey',
  blended_scotch: 'Scotch',
  single_malt_scotch: 'Scotch',
  peated_scotch: 'Scotch',
  scotch: 'Scotch',
  irish_whiskey: 'Irish Whiskey',
  japanese_whiskey: 'Japanese Whisky',
  canadian_whisky: 'Canadian Whisky',
};

/**
 * Human-readable sub-group label for an ingredient, used to cluster related
 * products together (e.g. all tequilas, all scotches) within a My Bar
 * category. Falls back to a title-cased version of the raw family id.
 */
export function getFamilyGroupLabel(item) {
  if (!item) return 'Other';
  return FAMILY_LABEL_ID_OVERRIDES[item.id]
    || FAMILY_LABELS[item.family]
    || titleCaseIngredientName((item.family || 'other').replace(/_/g, ' '));
}

// Set of taxonomy ingredient IDs that should be kept refrigerated once opened
export const REFRIGERATED_INGREDIENT_IDS = new Set([
  // Fortified Wines, Vermouths, Sakes & Chilled Wines
  'sweet_vermouth',
  'dry_vermouth',
  'blanc_vermouth',
  'lillet_blanc',
  'lillet_rouge',
  'cocchi_americano',
  'cocchi_rosa',
  'dubonnet',
  'byrrh',
  'bonal',
  'dry_sherry',
  'sweet_sherry',
  'port',
  'madeira',
  'marsala',
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
  'apple_cider',
  'apple_juice',
  'pomegranate_juice',
  'tomato_juice',
  'olive_brine',
  'pickle_brine',
  'fresh_mint',
  'basil',
  'cucumber',
  'ginger_root',
  'blackberries',
  'strawberries',
  'grapes',

  // Texture & Dairy
  'egg_white',
  'whole_egg',
  'aquafaba',
  'heavy_cream',
  'half_and_half',
  'whole_milk',
  'condensed_milk',
  'coconut_cream',
  'espresso',
]);

// Pre-build a fast alias lookup table sorted by length descending so longer phrases match first.
// normAlias/regex are precomputed once here (rather than inside findIngredient's hot loop) since
// this list is static for the life of the page — recomputing the same ~700 normalizations and
// RegExp objects on every findIngredient() call was the single biggest cost in recipe search.
const ALIAS_LOOKUP = [];
const EXACT_ALIAS_MAP = new Map();
for (const key of Object.keys(TAXONOMY)) {
  const item = TAXONOMY[key];
  const allNames = new Set([
    item.id,
    item.name.toLowerCase(),
    ...(item.aliases || []).map(a => a.toLowerCase()),
    ...(item.brands || []).map(b => b.toLowerCase()),
  ]);
  for (const alias of allNames) {
    const normAlias = normalizeText(alias);
    ALIAS_LOOKUP.push({
      alias,
      normAlias,
      length: alias.length,
      item,
      wordBoundaryRegex: normAlias.length >= 3 ? new RegExp(`(^|\\s)${normAlias}(\\s|$)`, 'i') : null,
    });
    // First entry wins on collision, matching the linear scan's original behavior.
    if (!EXACT_ALIAS_MAP.has(normAlias)) {
      EXACT_ALIAS_MAP.set(normAlias, item);
    }
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
 * Like normalizeText, but also collapses "&", the "'n" contraction (as in
 * "Dark 'n Stormy"), and a bare standalone "n" down to the same "and" token
 * before normalizing — so a search for "dark n stormy", "dark and stormy", or
 * "dark & stormy" all match a recipe actually named with an apostrophe-n.
 * Recipe/tag search should use this; ingredient-taxonomy lookups (which don't
 * have this "'n" pattern in their vocabulary) can stick with normalizeText.
 */
export function normalizeSearchText(text = '') {
  return normalizeText(
    String(text)
      .replace(/&/g, ' and ')
      .replace(/'n\b/gi, ' and ')
      .replace(/\bn\b/gi, ' and ')
  );
}

// Same taxonomy, same input strings recur constantly (every recipe's specs are drawn from a
// small shared ingredient vocabulary), so a plain result cache turns most calls into an O(1)
// Map lookup instead of re-running the resolution below.
const FIND_INGREDIENT_CACHE = new Map();

/**
 * Resolves a raw ingredient string to a canonical taxonomy entry
 */
export function findIngredient(rawText = '') {
  if (!rawText) return null;

  const cached = FIND_INGREDIENT_CACHE.get(rawText);
  if (cached !== undefined) return cached;

  const result = resolveIngredient(rawText);
  FIND_INGREDIENT_CACHE.set(rawText, result);
  return result;
}

function resolveIngredient(rawText) {
  const normalized = normalizeText(rawText);
  if (!normalized) return null;

  // 1. Direct exact alias match — O(1) instead of scanning the whole alias list
  const exact = EXACT_ALIAS_MAP.get(normalized);
  if (exact) return exact;

  // 2. Word boundary substring match (longer phrases prioritized)
  for (const entry of ALIAS_LOOKUP) {
    if (!entry.wordBoundaryRegex) continue;
    if (entry.wordBoundaryRegex.test(normalized)) {
      return entry.item;
    }
  }

  // 3. Fallback partial inclusion for long phrases
  for (const entry of ALIAS_LOOKUP) {
    if (entry.normAlias.length >= 4 && normalized.includes(entry.normAlias)) {
      return entry.item;
    }
  }

  return null;
}

/**
 * Suggests canonical ingredient names matching a partial, in-progress query —
 * for autocomplete while typing a spec's ingredient name. Requires at least 3
 * characters (anything shorter matches too much of the taxonomy to be useful).
 *
 * Ranked in four tiers, each sorted alphabetically: the canonical name matching
 * at a word boundary (typing "gin" finds "London Dry Gin"), then the name
 * matching anywhere, then an alias/brand matching at a word boundary, then an
 * alias/brand matching anywhere. Without this tiering, a query like "gin" could
 * rank a broad, barely-related category ahead of the obvious ingredient just
 * because it happened to have a matching alias buried in it.
 */
export function getIngredientSuggestions(query, limit = 8) {
  const q = normalizeText(query || '');
  if (q.length < 3) return [];
  const wordBoundary = new RegExp(`\\b${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i');

  const tiers = [[], [], [], []];
  const seen = new Set();

  for (const key of Object.keys(TAXONOMY)) {
    const item = TAXONOMY[key];
    if (seen.has(item.name)) continue;
    const nameNorm = normalizeText(item.name);

    if (wordBoundary.test(nameNorm)) {
      tiers[0].push(item.name);
      seen.add(item.name);
      continue;
    }
    if (nameNorm.includes(q)) {
      tiers[1].push(item.name);
      seen.add(item.name);
      continue;
    }

    const aliasCandidates = [...(item.aliases || []), ...(item.brands || [])].map(normalizeText);
    if (aliasCandidates.some(c => wordBoundary.test(c))) {
      tiers[2].push(item.name);
      seen.add(item.name);
    } else if (aliasCandidates.some(c => c.includes(q))) {
      tiers[3].push(item.name);
      seen.add(item.name);
    }
  }

  return tiers
    .flatMap(tier => tier.sort((a, b) => a.localeCompare(b)))
    .slice(0, limit);
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
    brands: item.brands || [],
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

  // Check aliases and brands
  for (const alias of item.aliases || []) {
    if (normalizeText(alias).includes(cleanQuery)) {
      return true;
    }
  }
  for (const brand of item.brands || []) {
    if (normalizeText(brand).includes(cleanQuery)) {
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

  // Metadata checks — normalized on both sides so punctuation differences
  // (apostrophes, "&" vs "and" vs a bare "n") between the query and the
  // stored text don't cause a false negative, e.g. searching "dark n stormy"
  // or "dark & stormy" for a recipe actually named "Dark 'n Stormy".
  const nq = normalizeSearchText(q);
  if (nq) {
    if (normalizeSearchText(recipe.name || '').includes(nq)) return true;
    if (normalizeSearchText(recipe.glassware || '').includes(nq)) return true;
    if (normalizeSearchText(recipe.method || '').includes(nq)) return true;
    if (normalizeSearchText(recipe.description || '').includes(nq)) return true;
    if (normalizeSearchText(recipe.source || '').includes(nq)) return true;
    if (normalizeSearchText(recipe.instructions || '').includes(nq)) return true;
  }

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
// Result depends only on the resolved ingredient's id, and TAXONOMY is static — cache by id so
// repeat callers (every missing-ingredient check in analyzeRecipeInventory) skip the full scan.
const SUBSTITUTES_CACHE = new Map();

export function getIngredientSubstitutes(rawIngredientName = '') {
  const current = findIngredient(rawIngredientName);
  if (!current) return [];

  const cached = SUBSTITUTES_CACHE.get(current.id);
  if (cached) return cached;

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
    // 3. Cane spirits cross-family — but only for light/unaged rum, which is
    // genuinely close to cachaça/rhum agricole's fresh, grassy character.
    // Deliberately excludes the darker rum styles (blackstrap, aged, Jamaican,
    // overproof): swapping cachaça into a Dark 'n Stormy or a Painkiller would
    // lose exactly the rich molasses character those recipes are built around.
    // Those still substitute freely with each other via the same-family rule above.
    else if (
      (current.family === 'cane_spirits' && candidate.id === 'light_rum') ||
      (current.id === 'light_rum' && candidate.family === 'cane_spirits')
    ) {
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
  SUBSTITUTES_CACHE.set(current.id, candidates);
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

    if (matchCount >= 2) {
      formulaMatches.push({
        recipe: candidate,
        relation: 'Similar Style',
        badgeClass: 'badge-family',
        matchCount,
      });
    }
  }

  // Sort formula matches by score descending
  formulaMatches.sort((a, b) => b.matchCount - a.matchCount);

  // Combine results up to a maximum of 6 related cocktails
  for (const fm of formulaMatches) {
    if (results.length >= 6) break;
    results.push(fm);
    addedIds.add(fm.recipe.id);
  }

  return results.slice(0, 6);
}

// ==========================================
// Backbar Inventory & Bottle Next Engine
// ==========================================

// Set of pantry staple ingredient names that home bartenders are assumed to always have in stock
export const PANTRY_STAPLE_NAMES = new Set([
  'ice',
  'tap water',
  'cold water',
  'hot water',
  'chilled water',
  'water',
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

// Normalizes casing for a recipe's own free-text ingredient name when it's
// shown verbatim on a shopping list (e.g. a recipe authored as "amaro
// averna" should read "Amaro Averna"). Deliberately simple word-by-word
// capitalization — recipe text is already close to correct almost always,
// this just cleans up the stray lowercase case.
const TITLE_CASE_MINOR_WORDS = new Set(['of', 'the', 'and', 'a', 'an', 'in', 'on', 'or']);

function titleCaseIngredientName(str) {
  let wordIndex = 0;
  return str.replace(/\w\S*/g, (w) => {
    const isMinor = wordIndex > 0 && TITLE_CASE_MINOR_WORDS.has(w.toLowerCase());
    wordIndex++;
    return isMinor ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1);
  });
}

/**
 * Checks whether an ingredient is present in the user's inventory.
 * Handles pantry staples, direct matches, aliases, brands, and child-to-parent hierarchy.
 */
export function checkIngredientStock(specName, inventorySet = new Set()) {
  if (!specName) return { inStock: true, isStaple: true };
  const clean = specName.trim().toLowerCase();

  // Every TAXONOMY entry now represents one real, specific, buyable product
  // (the former "family bucket" entries — e.g. a single "Spiced Liqueurs"
  // entry standing in for Falernum, Allspice Dram, Ancho Reyes... — have
  // been split into individual entries that share a `family` for
  // substitution purposes instead), so the resolved item's own name is
  // always the right thing to show. Only a completely unresolved ingredient
  // (no taxonomy match at all) falls back to the recipe's own free text.
  const displayName = (candidateItem) => {
    return candidateItem ? candidateItem.name : titleCaseIngredientName(specName.trim());
  };

  // 1. Always-assumed pantry staples (ice, water, saline)
  if (PANTRY_STAPLE_NAMES.has(clean) || clean === 'ice' || clean === 'water') {
    return { inStock: true, isStaple: true, name: specName };
  }

  // 2. Direct ID, Alias, or Brand match in inventory
  const item = findIngredient(specName);
  if (item) {
    if (inventorySet.has(item.id)) {
      return { inStock: true, item, id: item.id, name: displayName(item) };
    }
    for (const alias of item.aliases || []) {
      if (inventorySet.has(alias.toLowerCase())) {
        return { inStock: true, item, id: item.id, name: displayName(item) };
      }
    }
    for (const brand of item.brands || []) {
      if (inventorySet.has(brand.toLowerCase())) {
        return { inStock: true, item, id: item.id, name: displayName(item) };
      }
    }
  }

  // Direct string match in inventory
  if (inventorySet.has(clean)) {
    return { inStock: true, item, id: item ? item.id : clean, name: item ? displayName(item) : specName };
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
    name: item ? displayName(item) : specName,
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

/**
 * Flavor Profile Data (for the Dynamic Flavor Radar)
 *
 * Normalized 0.0-1.0 taste-intensity scores per taxonomy `family`, on four axes:
 * sweet, sour, bitter, herbal. (The fifth radar axis, "boozy", is deliberately NOT
 * modeled here — it's derived straight from each ingredient's existing `defaultAbv`
 * in js/modules/balance.js, since that data is already accurate and hand-tuning a
 * second "booziness" number per family would just be a worse duplicate of it.)
 *
 * Families are intentionally coarse (a family covers many ingredients), so a handful
 * of well-known ids that meaningfully diverge from their family's default get an
 * explicit override in ID_FLAVOR_OVERRIDES below — e.g. the `amaro` family spans
 * everything from bright, sweetish Aperol-style bitters to Fernet, so the family
 * default alone isn't accurate enough for those.
 */
const FAMILY_FLAVOR_PROFILES = {
  // Base spirits — mostly booze-only; character comes from what they're mixed with
  gin: { sweet: 0, sour: 0, bitter: 0.05, herbal: 0.35 },
  whiskey: { sweet: 0.1, sour: 0, bitter: 0.1, herbal: 0.05 },
  rum: { sweet: 0.15, sour: 0, bitter: 0, herbal: 0 },
  cane_spirits: { sweet: 0.1, sour: 0, bitter: 0, herbal: 0.05 },
  agave_spirits: { sweet: 0.05, sour: 0, bitter: 0.05, herbal: 0.1 },
  tequila: { sweet: 0.05, sour: 0, bitter: 0.05, herbal: 0.1 },
  neutral_spirits: { sweet: 0, sour: 0, bitter: 0, herbal: 0 },
  brandy: { sweet: 0.15, sour: 0, bitter: 0.05, herbal: 0 },
  fermented: { sweet: 0.15, sour: 0.15, bitter: 0.15, herbal: 0 },
  asian_rice_ferments: { sweet: 0.2, sour: 0.05, bitter: 0, herbal: 0 },

  // Anise, botanicals & herbal liqueurs
  anise: { sweet: 0.1, sour: 0, bitter: 0.1, herbal: 0.8 },
  botanical_liqueur: { sweet: 0.4, sour: 0, bitter: 0.15, herbal: 0.7 },
  floral_liqueur: { sweet: 0.5, sour: 0, bitter: 0, herbal: 0.3 },
  spiced_liqueur: { sweet: 0.4, sour: 0, bitter: 0.05, herbal: 0.35 },
  specialty_liqueur: { sweet: 0.4, sour: 0, bitter: 0.1, herbal: 0.2 },
  aromatic_water: { sweet: 0.1, sour: 0, bitter: 0, herbal: 0.5 },

  // Sweet liqueurs
  orange_liqueur: { sweet: 0.55, sour: 0.1, bitter: 0.05, herbal: 0 },
  fruit_liqueur: { sweet: 0.55, sour: 0.05, bitter: 0, herbal: 0 },
  cream_liqueur: { sweet: 0.7, sour: 0, bitter: 0, herbal: 0 },
  nut_seed_liqueur: { sweet: 0.6, sour: 0, bitter: 0.05, herbal: 0 },
  coffee: { sweet: 0.5, sour: 0, bitter: 0.25, herbal: 0 },

  // Amari & bittersweet aperitif wines (see ID_FLAVOR_OVERRIDES for specific amari)
  amaro: { sweet: 0.3, sour: 0, bitter: 0.55, herbal: 0.4 },
  vermouth: { sweet: 0.15, sour: 0.05, bitter: 0.15, herbal: 0.3 },
  quinquina: { sweet: 0.25, sour: 0.05, bitter: 0.3, herbal: 0.25 },
  sherry: { sweet: 0.2, sour: 0.05, bitter: 0, herbal: 0.05 },
  port: { sweet: 0.55, sour: 0, bitter: 0.05, herbal: 0 },
  oxidized_wine: { sweet: 0.35, sour: 0.05, bitter: 0.05, herbal: 0 },
  wine: { sweet: 0.15, sour: 0.15, bitter: 0, herbal: 0 },
  sparkling_wine: { sweet: 0.15, sour: 0.15, bitter: 0, herbal: 0 },

  // Bitters & tinctures — tiny volumes (dashes) so their weight in a recipe stays small
  bitters: { sweet: 0, sour: 0, bitter: 0.9, herbal: 0.3 },
  tinctures: { sweet: 0, sour: 0, bitter: 0.5, herbal: 0.4 },

  // Juices, produce & acids
  citrus_juice: { sweet: 0.05, sour: 0.9, bitter: 0.05, herbal: 0 },
  fruit_juice: { sweet: 0.5, sour: 0.2, bitter: 0, herbal: 0 },
  fresh_produce: { sweet: 0, sour: 0, bitter: 0.05, herbal: 0.6 },
  acids: { sweet: 0, sour: 0.9, bitter: 0, herbal: 0 },

  // Sweeteners
  cane_syrup: { sweet: 0.9, sour: 0, bitter: 0, herbal: 0 },
  flavored_syrup: { sweet: 0.75, sour: 0.05, bitter: 0, herbal: 0.1 },
  raw_sweetener: { sweet: 0.85, sour: 0, bitter: 0, herbal: 0 },

  // Savory & texture — mostly flavor-neutral on this scale
  brine: { sweet: 0, sour: 0.3, bitter: 0.1, herbal: 0 },
  savory: { sweet: 0.1, sour: 0.3, bitter: 0.1, herbal: 0.1 },
  seasoning: { sweet: 0, sour: 0, bitter: 0, herbal: 0.2 },
  texture: { sweet: 0, sour: 0, bitter: 0, herbal: 0 },
  soda: { sweet: 0.2, sour: 0, bitter: 0.05, herbal: 0 },
};

// Ingredient ids whose real-world character meaningfully diverges from their
// family's default above — mostly amari (which range from bright/bitter-Campari
// to deeply bitter Fernet) and vermouths (sweet vs. dry are very different drinks).
const ID_FLAVOR_OVERRIDES = {
  red_bitter: { sweet: 0.25, sour: 0, bitter: 0.85, herbal: 0.15 },       // Campari, Aperol
  herbal_amaro: { sweet: 0.35, sour: 0, bitter: 0.45, herbal: 0.5 },      // Averna, Cynar, Nonino
  fernet_alpine: { sweet: 0.1, sour: 0, bitter: 0.7, herbal: 0.85 },      // Fernet-Branca, Braulio
  gentian: { sweet: 0.15, sour: 0.05, bitter: 0.75, herbal: 0.4 },        // Suze, Salers
  sweet_vermouth: { sweet: 0.55, sour: 0.05, bitter: 0.25, herbal: 0.3 },
  dry_vermouth: { sweet: 0.1, sour: 0.15, bitter: 0.2, herbal: 0.35 },
  blanc_vermouth: { sweet: 0.4, sour: 0.1, bitter: 0.1, herbal: 0.35 },
  peychauds_bitters: { sweet: 0, sour: 0, bitter: 0.75, herbal: 0.55 },   // more anise/gentian-forward than the generic bitters family default
};

const NEUTRAL_FLAVOR_PROFILE = { sweet: 0, sour: 0, bitter: 0, herbal: 0 };

/**
 * Resolves the sweet/sour/bitter/herbal profile for a raw ingredient string, via
 * (in priority order) an id-level override, its family's default, or — for
 * unrecognized/custom ingredients — a flavor-neutral fallback so they still
 * contribute their volume without skewing any single axis.
 */
export function getFlavorProfile(rawIngredientName = '') {
  const item = findIngredient(rawIngredientName);
  if (!item) return { ...NEUTRAL_FLAVOR_PROFILE };
  const override = ID_FLAVOR_OVERRIDES[item.id];
  if (override) return { ...override };
  const familyDefault = FAMILY_FLAVOR_PROFILES[item.family];
  if (familyDefault) return { ...familyDefault };
  return { ...NEUTRAL_FLAVOR_PROFILE };
}

/**
 * Computes a ranked shopping list of missing ingredients across recipes against current inventory.
 * Ranks items descending by direct 1-bottle unlocks, tie-broken by secondary 2-bottle unlocks,
 * then alphabetical by ingredient display name.
 *
 * @param {Array<Object>} [recipes] - Recipes to inspect (defaults to user recipes or canonical seed recipes)
 * @param {Set<string>|Array<string>} [inventorySet] - Current owned inventory (defaults to speakeasy_inventory in localStorage)
 * @param {Object} [options]
 * @returns {Array<{id: string, name: string, family: string, color: string, unlockCount: number, secondaryCount: number, unlockedCocktails: Array<Object>, secondaryCocktails: Array<Object>, item: Object|null}>}
 */
export function getRankedShoppingList(recipes = null, inventorySet = null, options = {}) {
  // 1. Resolve inventory set
  let inv = inventorySet;
  if (!inv) {
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem('speakeasy_inventory');
        inv = new Set(raw ? JSON.parse(raw) : []);
      } else {
        inv = new Set();
      }
    } catch {
      inv = new Set();
    }
  } else if (Array.isArray(inv)) {
    inv = new Set(inv);
  }

  // 2. Resolve recipes
  let recs = recipes;
  if (!recs) {
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem('speakeasy_recipes');
        recs = raw ? JSON.parse(raw) : SEED_RECIPES;
      } else {
        recs = SEED_RECIPES;
      }
    } catch {
      recs = SEED_RECIPES;
    }
  }
  if (!Array.isArray(recs)) recs = [];

  const missingMap = new Map();

  const getOrCreateEntry = (stockStatus) => {
    const key = stockStatus.id || stockStatus.name.toLowerCase();
    const displayName = stockStatus.name || (stockStatus.item ? stockStatus.item.name : key);
    if (!missingMap.has(key)) {
      missingMap.set(key, {
        id: stockStatus.id || key,
        // Different recipes can ask for different specific products that
        // resolve to the same taxonomy bucket (e.g. one wants Falernum,
        // another wants Allspice Dram) — track every distinct name seen so
        // the merged entry says what's actually needed, not just whichever
        // recipe happened to be processed first.
        names: [displayName],
        name: displayName,
        family: stockStatus.family || (stockStatus.item ? stockStatus.item.family : 'other'),
        color: stockStatus.color || (stockStatus.item ? stockStatus.item.color : '#c67828'),
        unlockCount: 0,
        secondaryCount: 0,
        unlockedCocktails: [],
        secondaryCocktails: [],
        item: stockStatus.item || null,
      });
    } else {
      const entry = missingMap.get(key);
      // Keep the header name as whichever was seen first — joining every
      // variant into one string ("Campari / Aperol") reads as broken UI and
      // wraps badly; alternates are listed in the card's expandable detail
      // instead (see renderShoppingCard's `altNames` handling).
      if (!entry.names.includes(displayName)) {
        entry.names.push(displayName);
      }
    }
    return missingMap.get(key);
  };

  for (const recipe of recs) {
    if (!recipe || !Array.isArray(recipe.specs)) continue;
    const analysis = analyzeRecipeInventory(recipe, inv);

    // Register all missing items
    for (const m of analysis.missingItems) {
      getOrCreateEntry(m);
    }

    if (analysis.missingCount === 1) {
      // Direct 1-bottle unlock
      const missingBottle = analysis.missingItems[0];
      const entry = getOrCreateEntry(missingBottle);
      entry.unlockCount++;
      entry.unlockedCocktails.push(recipe);
    } else if (analysis.missingCount === 2) {
      // Secondary 2-bottle unlock (brings to 1 bottle away)
      for (const missingBottle of analysis.missingItems) {
        const entry = getOrCreateEntry(missingBottle);
        entry.secondaryCount++;
        entry.secondaryCocktails.push(recipe);
      }
    }
  }

  const results = Array.from(missingMap.values());

  // Sort descending by 1-bottle unlocks, tie-broken by secondary unlocks, then alphabetical
  results.sort((a, b) => {
    if (b.unlockCount !== a.unlockCount) {
      return b.unlockCount - a.unlockCount;
    }
    if (b.secondaryCount !== a.secondaryCount) {
      return b.secondaryCount - a.secondaryCount;
    }
    return a.name.localeCompare(b.name);
  });

  return results;
}



