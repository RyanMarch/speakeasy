# Speakeasy Architecture & Decision Guide

A system reference and decision manual for evaluating, maintaining, and extending Speakeasy without needing prior codebase exposure.

---

## 1. Executive Summary & Core Philosophy

Speakeasy is a local-first web application for cocktail enthusiasts and bartenders. It couples accurate ingredient taxonomy, real-time proportional vector glassware visualization, and backbar inventory intelligence with a counter-optimized interface.

### Foundational Principles

1. **Zero Runtime Dependencies**: Built entirely with standards-based HTML5, modern vanilla CSS, and ES6+ modules running directly in browsers. No bundlers or client frameworks.
2. **Local-First & Client-Authoritative**: All application state, custom recipes, inventory toggles, event menus, and UI preferences persist in browser `localStorage`. No external database or login is required.
3. **Cocktail Craft Realism**: Calculations for ABV, dilution, ingredient hierarchy, bottle substitutions, and glassware fluid physics follow established bar industry standards.
4. **Counter & Kitchen Usability**: Dark-mode aesthetic tailored for low-light bar environments with large touch targets, instant imperial (`oz`) and metric (`ml`) conversion, wake-lock screen retention, and sticky recipe navigation.

---

## 2. System Architecture

```
speakeasy/
├── index.html                 # Semantic single-page layout, modals, SVG symbol defs
├── app.js                     # Application lifecycle, routing, and coordinator (~310 lines)
├── css/
│   ├── base.css               # Design tokens, typography variables, color palette
│   ├── layout.css             # App shell, header, top-bar, vault popover
│   ├── recipe-list.css        # Sidebar list, search, sort, pack pills, segmented filter
│   ├── counter-view.css       # Recipe spread, vector glass, specs table, servings, riffs
│   ├── home-view.css          # Home landing page, shelves, card carousels, pin-a-tag
│   ├── menu-builder-view.css  # Event menu planning, glassware tallies, checklist sections
│   ├── editor.css             # Recipe editor modal, spec rows, tag chips
│   ├── modals.css             # Backbar inventory drawer, hidden recipes modal, low-stock badges
│   ├── responsive.css         # Bottom mobile nav, mobile sheets, breakpoints
│   └── index.css              # Master aggregator importing 8 modular stylesheets
├── js/
│   ├── state.js               # Shared application state, DOM cache, inventory cache
│   ├── router.js              # Application routing and View Transitions API coordinator
│   ├── data/
│   │   └── seed-recipes.js    # 181 canonical seed recipes
│   ├── views/
│   │   ├── home-view.js       # Home view shelves, carousels, pin-a-tag bar
│   │   ├── counter-view.js    # Single recipe view, glassware sync, radar, servings, riffs, sharing
│   │   ├── menu-builder-view.js# Saved event menus, recipe picker, bar/fridge/pantry checklist
│   │   └── recipe-list-view.js# Sidebar list, search, sort select, pack pills, tag autocomplete
│   ├── components/
│   │   ├── top-bar.js         # Header brand navigation, desktop sticky title, vault popover
│   │   ├── editor-modal.js    # Quick-paste recipe editor, natural language spec parser
│   │   ├── backbar-modal.js   # Inventory drawer modal, bottle toggling, category tabs, shopping list
│   │   ├── hidden-modal.js    # Hidden cocktails management modal
│   │   ├── timer-modal.js     # Floating counter timer toast, 3-phase countdown, haptic alerts
│   │   └── toast.js           # Toast notifications and HTML escaping utility
│   └── modules/
│       ├── taxonomy.js        # Hierarchical ingredient graph, brand mapping, search, substitutes, shopping list
│       ├── storage.js         # LocalStorage manager, menus, low stock, backup export/import, seed re-exports
│       ├── parser.js          # Natural text ingredient parser, fractions, method/timer detector
│       ├── auto-detect.js     # Recipe editor auto-detection for method, glass, garnish, and computed tags
│       ├── glassware.js       # Glassware geometric profiles, fluid paths, clip paths
│       ├── glass-view.js      # SVG renderer for layered liquids, ice, and blended cocktails
│       ├── garnishes.js       # Garnish parser and vector garnish SVG renderer
│       ├── colors.js          # Color calculation, hex blending, and volume normalization
│       ├── balance.js         # Flavor balance radar calculation, SVG renderer, palate distance similarity
│       └── abv.js             # Proof heuristics, method-based dilution (stir/shake/build/blend)
├── assets/                    # Favicons, web app icons, and graphics
├── tests/
│   ├── architecture-test.js   # Structural integrity, module exports, CSS imports, preload checks
│   └── parser-test.js         # Headless test runner covering parsing, taxonomy, ABV, seeds, and backups
├── manifest.webmanifest       # PWA manifest (standalone mode)
└── wrangler.toml              # Cloudflare Pages deployment configuration
```

---

## 3. Core Subsystems

### 3.1 Ingredient Taxonomy & Knowledge Graph (`taxonomy.js`)
- **Structure**: A multi-tiered hierarchy:
  - `parent`: Broad category (`spirits`, `fortified_wine`, `liqueurs`, `citrus`, `syrups`, `bitters`, `mixers`).
  - `family`: Mid-tier classification (such as `whiskey`, `rum`, `amaro`, `vermouth`).
  - `id`: Specific ingredient type (such as `bourbon`, `rye_whiskey`, `london_dry_gin`).
- **Brand & Alias Resolution**: Hundreds of commercial brand names (such as *Buffalo Trace*, *Aperol*, *Chartreuse*, *Tanqueray*) map directly into their canonical taxonomy identities.
- **Substitution Engine**: Evaluates ingredient families to supply realistic substitutions when an ingredient is missing.
- **Storage & Refrigeration Flags**: Identifies ingredients requiring refrigeration once opened (`REFRIGERATED_INGREDIENT_IDS`), including vermouths, aperitif wines, natural syrups, and fresh juices.
- **Ranked Shopping List**: Analyzes missing ingredients across the entire recipe collection or starter set, ranking purchases by the net number of newly unlockable drinks (`getRankedShoppingList`).

### 3.2 Recipe Storage, Seeding & Full Persistence Schema (`storage.js`)
- **Canonical Seeds**: 181 pre-loaded classic and modern craft cocktail recipes located in `js/data/seed-recipes.js`.
- **Data Model**:
  ```javascript
  {
    id: "boulevardier",
    name: "Boulevardier",
    glassware: "Rocks",           // Coupe, Rocks, Highball, Nick & Nora, Martini, etc.
    method: "Stirred",            // Stirred, Shaken, Built, Blended
    garnish: "Orange twist",      // Parsed into vector garnish
    specs: [                      // Array of parsed components
      { amount: 1.5, unit: "oz", name: "Bourbon" },
      { amount: 1, unit: "oz", name: "Campari" },
      { amount: 1, unit: "oz", name: "Sweet Vermouth" }
    ],
    instructions: "1. Combine...",
    description: "...",
    notes: "...",
    riffOfId: "negroni",          // Lineage pointer to parent drink
    riffOfName: "Negroni",
    tags: ["classic", "whiskey-forward", "riff"]
  }
  ```
- **Local Storage Partitioning**:
  All application state is divided across isolated `localStorage` keys:
  - `speakeasy_recipes`: Array of active recipes, storing custom creations alongside any in-place user edits to canonical seeds.
  - `speakeasy_inventory`: Array of taxonomy IDs currently in the user's home bar.
  - `speakeasy_hidden_recipes`: Array of recipe IDs soft-hidden from general browsing.
  - `speakeasy_low_stock`: Array of taxonomy IDs marked as running low. Independent of ownership; cleared automatically when a bottle is toggled out of inventory.
  - `speakeasy_menus`: Array of saved event menus (`{ id, name, recipeIds, createdAt }`).
  - `speakeasy_pinned_tags`: Array of tag names pinned to display as dedicated carousels on the Home landing page.
  - `speakeasy_recently_viewed`: Array of the last 15 viewed recipe IDs for quick history recall.
  - `speakeasy_bar_name`: Custom bar title displayed in the app header (defaults to "Speakeasy Cocktail Library").
  - `speakeasy_unit_system`: Imperial (`oz`) or metric (`ml`) display preference.
  - `speakeasy_library_sort`: Selected sort order (`curated`, `name-asc`, `name-desc`, `ready`, `specs-asc`).
  - `speakeasy_glass_view_mode`: Preferred fluid presentation (`layered` or `blended`).
  - `speakeasy_last_active_recipe`: Last active recipe slug restored on initial load when no URL hash is specified.

- **Unified v1 Backup Portability (`buildBackupPayload`, `importData`)**:
  - Export generates a single structured JSON payload containing `{ version: 1, exportedAt, inventory, hiddenRecipes, settings, customRecipes }`.
  - Custom recipes for backup isolate non-seed recipes and seed recipes modified by the user (`recipeDiffersFromSeed`).
  - Importing merges custom recipes by ID and performs set unions on inventory and hidden recipes, preventing loss of existing user bottles or configurations.

### 3.3 Text Parser, Formatting & Timers (`parser.js`)
- **Quick-Paste Ingestion**: Parses freeform bartender notes and multi-line specs into structured ingredient objects.
- **Fraction & Unit Normalization**: Converts ASCII and unicode vulgar fractions (`3/4`, `¾`, `1 1/2`, `1 ½`) into decimal quantities.
- **Volume Normalization**: Normalizes bar units (`oz`, `ml`, `cl`, `dash`, `dashes`, `drop`, `drops`, `barspoon`, `rinse`, `top`) to fluid ounces for internal mathematics.
- **Timer Detection**: Scans recipe instruction text for duration patterns (`15 seconds`, `2 minutes`, `30 sec`) via `detectTimers` and converts them into interactive inline trigger chips via `renderInstructionTimers`.

### 3.4 Recipe Auto-Detection Engine (`auto-detect.js`)
- **Directions Text Extraction**: Matches procedural verbs in written directions to assign cocktail technique (`Stirred`, `Shaken`, `Blended`, `Rolled`, `Built`) and explicit glassware (`Coupe`, `Nick & Nora`, `Rocks`, `Highball`, `Martini`, `Wine`, `Tiki Mug`).
- **Compositional Tag Inference**: Analyzes ingredient families and calculated flavor/ABV balance to suggest tags non-destructively. Tags are additive, identifying dominant spirits, citrus presence, effervescence, sweetness, or herbal balance without overwriting existing tags.

### 3.5 Smart Counter Timers (`timer-modal.js`)
- **Floating Widget**: A non-modal floating toast widget anchored to the screen corner. Allows bartenders to scroll recipe steps and view glassware while timing an infusion, stir, or shake.
- **3-Phase Countdown**: Progresses through `ready`, `counting`, and `done` with an SVG circular progress ring.
- **Haptic Alerts**: Triggers subtle native vibration pulses (`navigator.vibrate`) upon countdown completion with zero jarring audio.

### 3.6 Menu Builder & Event Planning Subsystem (`menu-builder-view.js`)
- **Purpose**: Enables assembling focused cocktail menus for dinner parties, private events, or seasonal rotations.
- **Aggregated Requirements**:
  - Tally of glassware quantities needed across the chosen drink lineup.
  - Consolidated ingredient shopping checklist grouped by kitchen/bar storage zone: **Bar** (bottles/spirits), **Fridge** (refrigerated syrups, fortified wines, fresh juices), and **Pantry** (shelf-stable mixers and bitters).
- **Stock Filtering**: Filters items into "All Required" versus "Need to Buy" by cross-referencing active backbar inventory.
- **Routing Integration**: Deep-linked through `#menus` for the saved list and `#menus/<id>` for specific menus.

### 3.7 Glassware & Fluid Dynamics (`glassware.js`, `glass-view.js`, `colors.js`)
- **Proportional Stacking**: Calculates each ingredient's volume percentage and stacks proportional SVG color layers inside the container's clip path.
- **Blended / Mixed Mode**: For shaken or blended recipes, blends liquid colors using volume-weighted RGB calculations.
- **Vector Garnishes**: Parses garnish strings into discrete SVG elements (wheels, wedges, twists, brandied cherries, mint sprigs) anchored to glass rims or fluid levels.
- **Two-Way Hover Binding**: Hovering over a liquid layer in the SVG highlights the matching spec line in the recipe, and vice versa.

### 3.8 ABV & Dilution Mechanics (`abv.js`)
- **Proof Estimation**: Automatically resolves proof from taxonomy data.
- **Dilution Models**:
  - Stirred with ice: ~20% dilution.
  - Shaken with ice: ~25% dilution.
  - Built on rocks: ~15% dilution.
  - Blended / Neat: 0% dilution offset.

### 3.9 Flavor Balance & Palate Distance Matching (`balance.js`, `counter-view.js`)
- **Radar Dimensions**: Calculates profile values (Sweet, Sour, Bitter, Spirit, Herbal) based on normalized recipe ingredient volumes.
- **Palate Distance**: Computes Euclidean distance between radar vectors to determine taste similarity percentages (`calculatePalateSimilarity`).
- **Enhanced Recommendations**: Powers "Similar Cocktails" suggestions on the counter view, presenting palate match scores to guide drink selection.

### 3.10 Backbar Inventory & Bottle-Next Logic (`taxonomy.js`, `state.js`)
- **Can-Make Evaluation**: Evaluates active inventory against recipe requirements. Pantry staples (water, standard ice, simple syrup) are treated as always in stock.
- **Directional Hierarchy**: Owning a specific child satisfying a generic recipe requirement (for instance, owning *Bourbon* satisfies a recipe asking for *Whiskey*), but not the reverse.
- **Performance Caching**: Inventory analysis results are memoized per recipe in `state.js` using an incrementing `inventoryVersion` cache key.
- **Bottle-Next Calculation**: Identifies drinks missing exactly one ingredient and flags which single bottle purchase unlocks the highest number of new drinks.

---

## 4. Application Flow & Routing

Speakeasy utilizes a lightweight hash-based router combined with the native browser **View Transitions API**:
- `#/` (or empty hash): Home View featuring curated recipe shelves, collection packs, and drink discovery.
- `#<recipe-slug>`: Single recipe Counter View (such as `#negroni`, `#corpse-reviver-no-2`). Displays vector glassware, specs table, ABV, garnish, instructions, inline timers, and riff substitutions.
- `#menus`: Menu Builder landing list showing saved event menus and options to create a menu.
- `#menus/<menu-id>`: Specific event menu overview, glassware requirements, and storage-zoned ingredient checklist.
- Modal Overlays: Quick-paste Recipe Editor, Backbar Inventory Drawer, and Hidden Cocktails management.

### Deep Linking & Recipe Sharing
- **Seed Recipes**: Deep-linked and shared directly via native share sheets or clipboard (`#<id>`). Because canonical seed recipes are bundled in all installs, these links resolve reliably for any recipient.
- **Custom Recipes**: Confined to the creator's local storage. Custom recipes intentionally omit external share links until a self-contained URI format or remote synchronization exists.

---

## 5. Decision-Making Matrix for Future Changes

When evaluating proposed modifications, consult these guidelines:

| Proposed Change | Guidance / Constraints |
|---|---|
| **Adding New Frameworks (React, Vue, Tailwind)** | **Reject**: The project is intentionally zero-build and runtime dependency-free. Additions must use vanilla ES modules and standard CSS variables. |
| **Adding New Cocktail Recipes** | **Approve**: Append valid recipe objects to `SEED_RECIPES` in `js/data/seed-recipes.js`. Ensure glassware, method, specs, and tags align with existing records. Run `npm test` to validate parsing, ID uniqueness, and ABV sanity. |
| **Expanding Brands / Taxonomy** | **Approve**: Add brands or aliases under the relevant taxonomy family in `js/modules/taxonomy.js`. Run `npm test` to verify no alias collision. |
| **Modifying Local Storage Schema** | **Caution**: Must maintain backward compatibility. Update `buildBackupPayload` and `importData` in `storage.js` if adding persistent entities. Never overwrite existing keys destructively on import. |
| **Port or Cloudflare Configuration** | `wrangler.toml` targets Cloudflare Pages output `.`. Dev server runs on port `8789` via `npm run dev`. |
| **Feature Visibility Flags** | Features temporarily tucked away in UI styling (such as the Almost Ready banner or low-stock pill indicators) remain part of the architectural code surface; do not delete underlying module logic unless an explicit deprecation plan is enacted. |

---

## 6. Verification & Test Commands

Before committing any alterations:

1. **Syntax Check & Test Suite**:
   ```bash
   npm test
   ```
   *Executes tests across parser mechanics, taxonomy integrity, ABV calculations, seed validation, and architecture export contracts.*

2. **Local Preview**:
   ```bash
   npm run dev
   ```
   *Serves application locally at `http://localhost:8789` via Wrangler Pages.*

---

*Last updated: September 10, 2026*
