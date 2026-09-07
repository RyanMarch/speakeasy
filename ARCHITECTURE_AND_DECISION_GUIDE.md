# Speakeasy Architecture & Decision Guide

A system reference and decision manual for evaluating, maintaining, and extending Speakeasy without needing prior codebase exposure.

---

## 1. Executive Summary & Core Philosophy

Speakeasy is a local-first web application for cocktail enthusiasts and bartenders. It couples accurate ingredient taxonomy, real-time proportional vector glassware visualization, and backbar inventory intelligence with a counter-optimized interface.

### Foundational Principles

1. **Zero Runtime Dependencies**: Built entirely with standards-based HTML5, modern vanilla CSS, and ES6+ modules running directly in browsers. No bundlers or client frameworks.
2. **Local-First & Client-Authoritative**: All application state, custom recipes, inventory toggles, and UI preferences persist in browser `localStorage`. No external database or login is required.
3. **Cocktail Craft Realism**: Calculations for ABV, dilution, ingredient hierarchy, bottle substitutions, and glassware fluid physics follow established bar industry standards.
4. **Counter & Kitchen Usability**: Dark-mode aesthetic tailored for low-light bar environments with large touch targets, instant imperial (`oz`) and metric (`ml`) conversion, and sticky recipe navigation.

---

## 2. System Architecture

```
speakeasy/
├── index.html                 # Semantic single-page layout, modals, SVG symbol defs
├── app.js                     # Application coordinator, routing/views, DOM event wiring
├── css/
│   ├── base.css               # Design tokens, typography variables, color palette
│   └── index.css              # Component styles, layouts, responsive rules, animations
├── js/modules/
│   ├── taxonomy.js            # Hierarchical ingredient graph, brand mapping, search, substitutes
│   ├── storage.js             # LocalStorage manager, 182 canonical seed recipes, import/export
│   ├── parser.js              # Natural text ingredient parser, fractions, method formatter
│   ├── glassware.js           # Glassware geometric profiles, fluid paths, clip paths
│   ├── glass-view.js          # SVG renderer for layered liquids, ice, and blended cocktails
│   ├── garnishes.js           # Garnish parser and vector garnish SVG renderer
│   ├── colors.js              # Color calculation, hex blending, and volume normalization
│   └── abv.js                 # Proof heuristics, method-based dilution (stir/shake/build/blend)
├── assets/                    # Favicons, web app icons, and graphics
├── tests/
│   └── parser-test.js         # Headless test runner covering parsing, taxonomy, ABV, and seeds
├── manifest.webmanifest       # PWA manifest (standalone mode)
└── wrangler.toml              # Cloudflare Pages deployment configuration
```

---

## 3. Core Subsystems

### 3.1 Ingredient Taxonomy & Knowledge Graph (`taxonomy.js`)
- **Structure**: A multi-tiered hierarchy:
  - `parent`: Broad category (`spirits`, `fortified_wine`, `liqueurs`, `citrus`, `syrups`, `bitters`, `mixers`).
  - `family`: Mid-tier classification (e.g., `whiskey`, `rum`, `amaro`, `vermouth`).
  - `id`: Specific ingredient type (e.g., `bourbon`, `rye_whiskey`, `london_dry_gin`).
- **Brand & Alias Resolution**: Hundreds of commercial brand names (e.g., *Buffalo Trace*, *Aperol*, *Chartreuse*, *Tanqueray*) map directly into their canonical taxonomy identities.
- **Substitution Engine**: Evaluates ingredient families to supply realistic substitutions when an ingredient is missing.
- **Storage & Refrigeration Flags**: Identifies ingredients requiring refrigeration once opened (e.g., vermouths, aperitif wines, natural syrups, fresh juices).

### 3.2 Recipe Storage, Seeding & Lineage (`storage.js`)
- **Canonical Seeds**: 182 pre-loaded classic and modern craft cocktail recipes.
- **Data Model**:
  ```javascript
  {
    id: "boulevardier",
    name: "Boulevardier",
    glassware: "Rocks",           // Coupe, Rocks, Highball, Nick & Nora, Martini, etc.
    method: "Stirred",             // Stirred, Shaken, Built, Blended
    garnish: "Orange twist",       // Parsed into vector garnish
    specs: [                       // Array of parsed components
      { amount: 1.5, unit: "oz", name: "Bourbon" },
      { amount: 1, unit: "oz", name: "Campari" },
      { amount: 1, unit: "oz", name: "Sweet Vermouth" }
    ],
    instructions: "1. Combine...",
    description: "...",
    notes: "...",
    riffOfId: "negroni",           // Lineage pointer to parent drink
    riffOfName: "Negroni",
    tags: ["classic", "whiskey-forward", "riff"]
  }
  ```
- **State Partitioning**:
  - `speakeasy_recipes`: Custom user recipes and overrides to canonical seeds.
  - `speakeasy_inventory`: User backbar bottle collection.
  - `speakeasy_hidden_recipes`: Soft-hidden recipe IDs.
  - `speakeasy_unit_pref`, `speakeasy_sort_pref`, `speakeasy_glass_view_pref`: UI state.

### 3.3 Text Parser & Quantities (`parser.js`)
- **Quick-Paste Ingestion**: Parses freeform bartender notes and multi-line specs into structured objects.
- **Fraction & Unit Normalization**: Converts ASCII and unicode vulgar fractions (`3/4`, `¾`, `1 1/2`, `1 ½`) into decimal numbers.
- **Volume Normalization**: Normalizes bar units (`oz`, `ml`, `cl`, `dash`, `dashes`, `drop`, `drops`, `barspoon`, `rinse`, `top`) to fluid ounces for internal mathematics.

### 3.4 Glassware & Fluid Dynamics (`glassware.js`, `glass-view.js`, `colors.js`)
- **Proportional Stacking**: Calculates each ingredient's volume percentage and stacks proportional SVG color layers inside the container's clip path.
- **Blended / Mixed Mode**: For shaken or blended recipes, blends liquid colors using volume-weighted RGB calculations.
- **Vector Garnishes**: Parses garnish strings into discrete SVG elements (wheels, wedges, twists, brandied cherries, mint sprigs) anchored to glass rims or fluid levels.
- **Two-Way Hover Binding**: Hovering over a liquid layer in the SVG highlights the matching spec line in the recipe, and vice versa.

### 3.5 ABV & Dilution Mechanics (`abv.js`)
- **Proof Estimation**: Automatically resolves proof from taxonomy data.
- **Dilution Models**:
  - Stirred with ice: ~20% dilution.
  - Shaken with ice: ~25% dilution.
  - Built on rocks: ~15% dilution.
  - Blended / Neat: 0% dilution offset.

### 3.6 Backbar Inventory & Bottle-Next Logic (`taxonomy.js`, `app.js`)
- **Can-Make Evaluation**: Evaluates active inventory against recipe requirements. Pantry staples (water, standard ice, simple syrup) are treated as always in stock.
- **Directional Hierarchy**: Owning a specific child satisfying a generic recipe requirement (e.g., owning *Bourbon* satisfies a recipe asking for *Whiskey*), but not the reverse.
- **Bottle-Next Calculation**: Identifies drinks missing exactly one ingredient and flags which single bottle purchase unlocks the highest number of new drinks.

---

## 4. Application Flow & Routing

Speakeasy utilizes a lightweight hash-based router combined with the native browser **View Transitions API**:
- `#/` (Home View): Curated recipe shelves, collection packs, and drink discovery.
- `#/drink/:slug` (Recipe / Counter View): Full drink specs, vector glassware, ABV, garnish, step-by-step instructions, and riff substitution controls.
- Modal Overlays: Quick-paste Recipe Editor, Backbar Inventory Drawer, and Settings.

---

## 5. Decision-Making Matrix for Future Changes

When evaluating proposed modifications, consult these guidelines:

| Proposed Change | Guidance / Constraints |
|---|---|
| **Adding New Frameworks (React, Vue, Tailwind)** | **Reject**: The project is intentionally zero-build and runtime dependency-free. Additions should use vanilla ES modules and standard CSS variables. |
| **Adding New Cocktail Recipes** | **Approve**: Append valid recipe objects to `SEED_RECIPES` in `js/modules/storage.js`. Ensure glassware, method, specs, and tags align with existing records. Run `npm test` to validate parsing and ABV sanity. |
| **Expanding Brands / Taxonomy** | **Approve**: Add brands or aliases under the relevant taxonomy family in `js/modules/taxonomy.js`. Run `npm test` to verify no alias collision. |
| **Modifying Local Storage Schema** | **Caution**: Must maintain backward compatibility. Provide fallback parsing or migration for existing `localStorage` keys so user bars and recipes are not lost. |
| **Modifying Port or Cloudflare Config** | `wrangler.toml` targets Cloudflare Pages output `.`. Dev server runs on port `8789` via `npm run dev`. |

---

## 6. Verification & Test Commands

Before committing any alterations:

1. **Syntax Check & Test Suite**:
   ```bash
   npm test
   ```
   *Runs syntax checks across all JS modules and executes the test harness validating all 182 recipes, taxonomy lookup, and color calculations.*

2. **Local Preview**:
   ```bash
   npm run dev
   ```
   *Serves application locally at `http://localhost:8789` via Wrangler Pages.*

---

*Last updated: September 7, 2026*

