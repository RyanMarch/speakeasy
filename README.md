# Speakeasy

A local-first cocktail recipe library featuring interactive vector fluid glassware layers, instant spec parsing, and counter-optimized typography. Built with vanilla HTML5, CSS3, and ES6+ modules with zero runtime dependencies.

## Key Features

- **Interactive Vector Fluid Layers**: Proportional SVG liquid rendering inside authentic glassware silhouettes (Coupe, Rocks, Highball, Martini, Nick & Nora, Tiki Mug, and more).
- **Two-Way Hover Synchronization**: Hovering fluid layers highlights corresponding ingredients in the recipe list and vice-versa.
- **Vector Garnish Rendering**: Garnish descriptions are parsed into recognized types (twists, wheels, wedges, rims, cherries, sprigs) and rendered as SVG anchored to the glass rim and fluid level.
- **Quick Paste Parser**: Multi-line ingredient text parser handling fractions, vulgar unicode fractions, and bar measures.
- **Ingredient Taxonomy**: Hierarchical classification of spirits, liqueurs, and modifiers with alias resolution and category-aware search.
- **Backbar Inventory & Bottle-Next Engine**: Track what's in your bar, see which recipes you can make now, and which are one bottle away.
- **Riffs & Similar Style Detection**: Surfaces recipe lineage (riff-of relationships) and stylistically similar cocktails.
- **Tags & Filtering**: Arbitrary tagging with hashtag and plain-text matching across recipes.
- **Counter View**: High-contrast typography designed for legibility on kitchen and bar counters, with instant imperial (`oz`) and metric (`ml`) conversion.
- **Estimated Alcohol by Volume (ABV)**: Computes finished cocktail ABV accounting for ingredient proof and preparation dilution (stirred, shaken, built, blended).
- **Local Persistence & Portability**: Automatically syncs to `localStorage` with JSON export and import capabilities.

## Architecture

- `index.html`: Semantic markup and two-pane split layout.
- `app.js`: Application coordinator, state management, and UI events.
- `css/`: Modular stylesheets (`base.css` design tokens, `index.css` layout and components).
- `js/modules/`:
  - `abv.js`: Cocktail ABV calculations and ingredient proof heuristics.
  - `parser.js`: Ingredient line regex and fraction normalizer.
  - `colors.js`: Ingredient color heuristics and normalized volume math.
  - `taxonomy.js`: Hierarchical ingredient classification, alias resolution, and category-aware search.
  - `glassware.js`: SVG glassware geometries, stem/base paths, and fluid clip definitions.
  - `glass-view.js`: Proportional stacked fluid layer SVG renderer.
  - `garnishes.js`: Garnish description parsing and vector garnish rendering.
  - `storage.js`: LocalStorage manager, default seed recipes, backbar inventory, and JSON portability.
- `functions/`: Cloudflare Pages Functions (server-side API routes).
- `tests/`: Automated test suite for parser, ABV, inventory, tagging, and garnish logic.

## Development & Verification

Run the local dev server:

```bash
npm run dev
```

Run syntax checks and the test suite:

```bash
npm test
```
