# Speakeasy

A local-first cocktail recipe vault featuring interactive vector fluid glassware layers, instant spec parsing, and counter-optimized typography. Built with vanilla HTML5, CSS3, and ES6+ modules with zero runtime dependencies.

## Key Capabilities

- **Interactive Vector Fluid Layers**: Proportional SVG liquid rendering inside authentic glassware silhouettes (Coupe, Rocks, Highball, Martini, Nick & Nora).
- **Two-Way Hover Synchronization**: Hovering fluid layers highlights corresponding ingredients in the recipe list and vice-versa.
- **Quick Paste Parser**: Multi-line ingredient text parser handling fractions, vulgar unicode fractions, and bar measures.
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
  - `glassware.js`: SVG glassware geometries, stem/base paths, and fluid clip definitions.
  - `glass-view.js`: Proportional stacked fluid layer SVG renderer.
  - `storage.js`: LocalStorage manager, default seed recipes, and JSON portability.
- `tests/`: Automated test suite for parser and volume calculations.

## Development & Verification

Run the local dev server:

```bash
npm run dev
```

Run syntax checks and parser tests:

```bash
npm test
```
