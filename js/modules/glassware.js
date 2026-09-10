/**
 * Speakeasy Glassware Profiles
 * Provides vector paths, fluid bounding boxes, and clip-path paths for cocktail glasses.
 */

export const GLASS_TYPES = {
  coupe: {
    id: 'coupe',
    name: 'Coupe',
    aliases: ['coupe', 'cocktail glass', 'saucer'],
    viewBox: '0 0 240 320',
    fluidBounds: {
      bottomY: 165,
      topY: 88,
      height: 77,
      leftX: 42,
      rightX: 198,
      width: 156,
    },
    // The interior cavity clip path for fluid
    fluidClipD: `
      M 38 88
      C 42 145, 80 166, 120 166
      C 160 166, 198 145, 202 88
      Z
    `,
    // The outer bowl silhouette
    glassOutlineD: `
      M 36 84
      C 40 148, 80 170, 120 170
      C 160 170, 200 148, 204 84
    `,
    glassRimD: 'M 36 84 C 70 88, 170 88, 204 84',
    rim: { leftX: 36, rightX: 204, y: 84 },
    stemD: 'M 120 170 L 120 282',
    baseD: 'M 68 288 C 90 285, 150 285, 172 288 L 174 291 C 150 293, 90 293, 66 291 Z',
  },

  rocks: {
    id: 'rocks',
    name: 'Rocks / Old Fashioned (Anchor Hocking Tartan)',
    aliases: ['rocks', 'old fashioned', 'lowball', 'tumbler', 'double old fashioned'],
    viewBox: '0 0 240 320',
    fluidBounds: {
      bottomY: 216,
      topY: 104,
      height: 112,
      leftX: 52,
      rightX: 188,
      width: 136,
    },
    fluidClipD: `
      M 51 104
      L 54 216
      C 80 219, 160 219, 186 216
      L 189 104
      Z
    `,
    glassOutlineD: `
      M 46 96
      L 48 164
      L 50 166
      L 48 168
      L 49 214
      L 51 216
      L 49 218
      L 51 242
      C 52 247, 59 249, 70 249
      L 170 249
      C 181 249, 188 247, 189 242
      L 191 218
      L 189 216
      L 191 214
      L 192 168
      L 190 166
      L 192 164
      L 194 96
    `,
    glassRimD: 'M 46 96 C 80 100, 160 100, 194 96',
    rim: { leftX: 46, rightX: 194, y: 96 },
    stemD: null,
    baseD: `
      M 49 216
      C 80 219, 160 219, 191 216
      L 189 242
      C 188 247, 181 249, 170 249
      L 70 249
      C 59 249, 52 247, 51 242
      Z
    `,
    detailsD: `
      M 49 166 C 80 169, 160 169, 191 166
      M 50 216 C 80 219, 160 219, 190 216
      M 72 124 L 72 246
      M 104 118 L 104 248
      M 136 118 L 136 248
      M 168 124 L 168 246
      M 56 240 C 80 242, 160 242, 184 240
    `,
    sheenD: null,
  },

  highball: {
    id: 'highball',
    name: 'Highball / Collins',
    aliases: ['highball', 'collins', 'fizz', 'tall'],
    viewBox: '0 0 240 320',
    fluidBounds: {
      bottomY: 260,
      topY: 52,
      height: 208,
      leftX: 74,
      rightX: 166,
      width: 92,
    },
    fluidClipD: `
      M 74 52
      L 77 260
      C 95 262, 145 262, 163 260
      L 166 52
      Z
    `,
    glassOutlineD: `
      M 70 48
      L 74 264
      C 76 284, 164 284, 166 264
      L 170 48
    `,
    glassRimD: 'M 70 48 C 90 51, 150 51, 170 48',
    rim: { leftX: 70, rightX: 170, y: 48 },
    stemD: null,
    baseD: `
      M 74 264
      C 90 266, 150 266, 166 264
      L 167 282
      C 150 285, 90 285, 73 282
      Z
    `,
  },

  martini: {
    id: 'martini',
    name: 'Martini',
    aliases: ['martini', 'v-shape', 'cocktail'],
    viewBox: '0 0 240 320',
    fluidBounds: {
      bottomY: 160,
      topY: 66,
      height: 94,
      leftX: 40,
      rightX: 200,
      width: 160,
    },
    fluidClipD: `
      M 40 66
      L 120 160
      L 200 66
      Z
    `,
    glassOutlineD: `
      M 36 62
      L 120 163
      L 204 62
    `,
    glassRimD: 'M 36 62 C 70 65, 170 65, 204 62',
    rim: { leftX: 36, rightX: 204, y: 62 },
    stemD: 'M 120 163 L 120 282',
    baseD: 'M 68 288 C 90 285, 150 285, 172 288 L 174 291 C 150 293, 90 293, 66 291 Z',
  },

  nickAndNora: {
    id: 'nickAndNora',
    name: 'Nick & Nora',
    aliases: ['nick and nora', 'nick & nora', 'bell', 'tulip'],
    viewBox: '0 0 240 320',
    fluidBounds: {
      bottomY: 174,
      topY: 76,
      height: 98,
      leftX: 62,
      rightX: 178,
      width: 116,
    },
    fluidClipD: `
      M 62 76
      C 63 125, 78 174, 120 174
      C 162 174, 177 125, 178 76
      Z
    `,
    glassOutlineD: `
      M 59 72
      C 60 128, 76 178, 120 178
      C 164 178, 180 128, 181 72
    `,
    glassRimD: 'M 59 72 C 85 75, 155 75, 181 72',
    rim: { leftX: 59, rightX: 181, y: 72 },
    stemD: 'M 120 178 L 120 282',
    baseD: 'M 72 288 C 95 285, 145 285, 168 288 L 170 291 C 145 293, 95 293, 70 291 Z',
  },

  wine: {
    id: 'wine',
    name: 'Wine Glass',
    aliases: ['wine', 'wine glass', 'spritz', 'goblet'],
    viewBox: '0 0 240 320',
    fluidBounds: {
      bottomY: 195,
      topY: 60,
      height: 135,
      leftX: 52,
      rightX: 188,
      width: 136,
    },
    fluidClipD: `
      M 64 60
      C 44 115, 68 195, 120 195
      C 172 195, 196 115, 176 60
      Z
    `,
    glassOutlineD: `
      M 62 56
      C 40 115, 66 198, 120 198
      C 174 198, 200 115, 178 56
    `,
    glassRimD: 'M 62 56 C 85 60, 155 60, 178 56',
    rim: { leftX: 62, rightX: 178, y: 56 },
    stemD: 'M 120 198 L 120 282',
    baseD: 'M 68 288 C 90 285, 150 285, 172 288 L 174 291 C 150 293, 90 293, 66 291 Z',
  },

  tikiMug: {
    id: 'tikiMug',
    name: 'Tiki Mug',
    aliases: ['tiki', 'tiki mug', 'mug', 'totem'],
    viewBox: '0 0 240 320',
    fluidBounds: {
      bottomY: 260,
      topY: 48,
      height: 212,
      leftX: 62,
      rightX: 178,
      width: 116,
    },
    fluidClipD: `
      M 66 48
      C 58 100, 68 155, 60 210
      C 58 238, 64 260, 66 260
      L 174 260
      C 176 260, 182 238, 180 210
      C 172 155, 182 100, 174 48
      Z
    `,
    glassOutlineD: `
      M 64 45
      C 55 100, 65 155, 57 210
      C 55 240, 61 264, 64 266
      C 80 268, 160 268, 176 266
      C 179 264, 185 240, 183 210
      C 175 155, 185 100, 176 45
    `,
    glassRimD: 'M 64 45 C 85 48, 155 48, 176 45',
    rim: { leftX: 64, rightX: 176, y: 45 },
    stemD: null,
    baseD: `
      M 64 266
      C 80 268, 160 268, 176 266
      L 178 282
      C 160 285, 80 285, 62 282
      Z
    `,
    detailsD: `
      M 84 95 C 100 88, 140 88, 156 95
      M 86 115 C 100 120, 140 120, 154 115
      M 100 135 L 120 160 L 140 135
      M 80 185 C 95 178, 145 178, 160 185
      M 82 205 C 100 215, 140 215, 158 205
      M 80 185 L 82 205
      M 160 185 L 158 205
      M 96 182 L 96 208
      M 112 180 L 112 210
      M 128 180 L 128 210
      M 144 182 L 144 208
    `,
    sheenD: null,
  },

  champagneFlute: {
    id: 'champagneFlute',
    name: 'Champagne Flute',
    aliases: ['champagne flute', 'champagne', 'flute', 'sparkling'],
    canvasBottom: 303,
    fluidBounds: {
      bottomY: 240,
      topY: 50,
      height: 190,
      leftX: 100,
      rightX: 140,
      width: 40,
    },
    fluidClipD: `
      M 100 50
      L 104 240
      C 110 242, 130 242, 136 240
      L 140 50
      Z
    `,
    glassOutlineD: `
      M 96 46
      L 102 244
      C 104 264, 136 264, 138 244
      L 144 46
    `,
    glassRimD: 'M 96 46 C 110 48, 130 48, 144 46',
    rim: { leftX: 96, rightX: 144, y: 46 },
    stemD: 'M 120 244 L 120 282',
    baseD: 'M 108 288 C 115 285, 125 285, 132 288 L 133 291 C 125 293, 115 293, 107 291 Z',
  },
};

export function resolveGlassware(glasswareString = '') {
  const query = glasswareString.toLowerCase().trim();
  if (!query) {
    return GLASS_TYPES.rocks;
  }

  for (const glass of Object.values(GLASS_TYPES)) {
    if (glass.aliases.some(alias => query.includes(alias))) {
      return glass;
    }
  }

  return GLASS_TYPES.rocks;
}
