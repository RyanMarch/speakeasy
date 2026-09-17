# Speakeasy Architecture & Decision Guide

A system reference and decision manual for evaluating, maintaining, and extending Speakeasy without needing prior codebase exposure.

---

## 1. Executive Summary & Core Philosophy

Speakeasy is a local-first web application for cocktail enthusiasts and bartenders. It couples accurate ingredient taxonomy, real-time proportional vector glassware visualization, and backbar inventory intelligence with a counter-optimized interface.

### Foundational Principles

1. **Zero Runtime Dependencies**: Built entirely with standards-based HTML5, modern vanilla CSS, and ES6+ modules running directly in browsers. No bundlers or client frameworks.
2. **Local-First & Client-Authoritative**: All application state persists locally in browser `localStorage` first. While an optional Cloudflare D1 backend provides cloud synchronization, multi-bar management, and custom recipe sharing, the client remains authoritative and fully functional offline.
3. **Cocktail Craft Realism**: Calculations for ABV, dilution, ingredient hierarchy, bottle substitutions, and glassware fluid physics follow established bar industry standards.
4. **Counter & Kitchen Usability**: Dark-mode aesthetic tailored for low-light bar environments with large touch targets, instant imperial (`oz`) and metric (`ml`) conversion, wake-lock screen retention, and sticky recipe navigation.

---

## 2. System Architecture

```
speakeasy/
├── index.html                 # Dedicated marketing landing page
├── app.html                   # Cocktail counter application shell, modals, and SVG defs
├── terms.html                 # Combined Terms of Service & Privacy Policy
├── admin.html                 # Admin Dashboard: Analytics, Global Recipe Manager & Visibility
├── app.js                     # Application lifecycle, routing, and coordinator
├── css/
│   ├── base.css               # Design tokens, typography variables, color palette
│   ├── theme-deco.css         # Art Deco navy (#020f20) and gold (#ebbc72) palette & fonts
│   ├── marketing.css          # Editorial styling for marketing landing page & legal document
│   ├── layout.css             # App shell, header, top-bar, vault popover
│   ├── recipe-list.css        # Sidebar list, search, sort, pack pills, segmented filter
│   ├── counter-view.css       # Recipe spread, vector glass, specs table, servings, riffs
│   ├── home-view.css          # Home landing page, shelves, card carousels, pin-a-tag
│   ├── menu-builder-view.css  # Event menu planning, glassware tallies, checklist sections
│   ├── editor.css             # Recipe editor modal, spec rows, tag chips
│   ├── modals.css             # Backbar inventory drawer, hidden recipes modal, low-stock badges
│   ├── responsive.css         # Bottom mobile nav, mobile sheets, breakpoints
│   └── index.css              # Master aggregator importing 8 modular stylesheets
├── docs/                      # User Guides & Documentation Hub
│   ├── index.html             # Documentation entry point & guide hub
│   ├── list.html              # Searchable guide directory
│   ├── style.css              # Editorial docs stylesheet
│   ├── docs-components.js     # Custom element layout & navigation
│   ├── search-index.json      # Client-side documentation search index
│   └── */index.html           # Individual guide topics (Getting Started, Inventory, etc.)
├── scripts/                   # Documentation tooling & build helpers
│   ├── init-docs.js           # Initialize docs scaffold
│   ├── add-new-doc.js         # Interactive CLI to create a new guide
│   └── generate-docs-index.js # Compiles search index from doc headings & meta
├── js/
│   ├── state.js               # Shared application state, DOM cache, inventory cache
│   ├── router.js              # Application routing and View Transitions API coordinator
│   ├── data/
│   │   ├── seed-recipes.js    # 181 canonical seed recipes
│   │   └── featured-cocktails.js # Curated featured drinks for landing page showcase
│   ├── views/
│   │   ├── home-view.js       # Home view shelves, carousels, pin-a-tag bar
│   │   ├── counter-view.js    # Single recipe view, glassware sync, radar, servings, riffs, sharing
│   │   ├── menu-builder-view.js# Saved event menus, recipe picker, bar/fridge/pantry checklist
│   │   ├── recipe-list-view.js# Sidebar list, search, sort select, pack pills, tag autocomplete
│   │   └── shared-recipe-view.js # Snapshot view for shared cocktail links
│   ├── components/
│   │   ├── top-bar.js         # Header brand navigation, desktop sticky title, vault popover
│   │   ├── editor-modal.js    # Quick-paste recipe editor, natural language spec parser, batch yield
│   │   ├── backbar-modal.js   # Inventory drawer modal, bottle toggling, category tabs, shopping list
│   │   ├── calculator-modal.js# Bar calculators (batch punch/bottle sizing, acid adjustment, Brix syrup)
│   │   ├── rating-modal.js    # Rating & tasting note modal for drinks and pour history
│   │   ├── print-window.js    # Print preview and format helper for menus and recipe sheets
│   │   ├── hidden-modal.js    # Hidden cocktails management modal
│   │   ├── timer-modal.js     # Floating counter timer toast, 3-phase countdown, haptic alerts
│   │   └── toast.js           # Toast notifications and HTML escaping utility
│   └── modules/
│       ├── auth.js            # Passwordless OTP authentication and session management
│       ├── history.js         # Drink history logging, ratings, tasting notes, cloud sync
│       ├── telemetry.js       # Client telemetry tracking (views, searches, feature usage)
│       ├── taxonomy.js        # Hierarchical ingredient graph, brand mapping, search, substitutes, shopping list
│       ├── storage.js         # LocalStorage manager, menus, low stock, backup export/import, seed re-exports
│       ├── parser.js          # Natural text ingredient parser, fractions, method/timer detector
│       ├── calculators.js     # Batch scaling, dilution math, acid adjustment, and syrup Brix calculations
│       ├── auto-detect.js     # Recipe editor auto-detection for method, glass, garnish, and computed tags
│       ├── glassware.js       # Glassware geometric profiles, fluid paths, clip paths
│       ├── glass-view.js      # SVG renderer for layered liquids, ice, and blended cocktails
│       ├── garnishes.js       # Garnish parser and vector garnish SVG renderer
│       ├── colors.js          # Color calculation, hex blending, and volume normalization
│       ├── balance.js         # Flavor balance radar calculation, SVG renderer, palate distance similarity
│       └── abv.js             # Proof heuristics, method-based dilution (stir/shake/build/blend)
├── functions/
│   └── api/                   # Cloudflare Pages Functions (Serverless Backend)
│       ├── admin/             # Endpoints for admin session, analytics aggregation, recipes, and visibility
│       ├── auth/              # Endpoints for OTP generation, verification, session, and account deletion
│       ├── history/           # Endpoints to log, update (rating/notes), and list user drink history
│       ├── shares/            # Endpoints to create and read public recipe snapshots
│       ├── telemetry.js       # Ingestion endpoint for recipe views, search logs, and feature events
│       └── sync.js            # Endpoint to sync local library to the cloud and fetch updates
├── migrations/                # Versioned Cloudflare D1 SQL schema migrations
│   ├── 0001_initial_schema.sql
│   ├── 0002_add_shares.sql
│   ├── 0003_global_recipes.sql
│   ├── 0004_analytics.sql
│   ├── 0005_add_garnish_column.sql
│   ├── 0006_add_source_columns.sql
│   ├── 0007_add_og_image_column.sql
│   ├── 0008_otp_rate_limit.sql
│   └── 0009_add_ratings_notes.sql
├── .github/
│   └── workflows/
│       └── deploy.yml         # GitHub Actions automated test, D1 migration & Pages deploy
├── assets/                    # Favicons, web app icons, and graphics
├── tests/
│   ├── architecture-test.js   # Structural integrity, module exports, CSS imports, preload checks
│   ├── parser-test.js         # Headless test runner covering parsing, taxonomy, ABV, seeds, and backups
│   ├── calculator-test.js     # Batch punch scaling, acid balancing, and Brix syrup calculations
│   ├── sync-test.js           # Cloud sync, hydration, and multi-bar persistence tests
│   ├── auth-test.js           # Passwordless OTP, session, and account deletion tests
│   ├── history-test.js        # Drink history logging, ratings, and guest-to-cloud migration tests
│   ├── shares-test.js         # Recipe sharing and snapshot endpoint tests
│   └── admin-test.js          # Admin dashboard, analytics, and recipe moderation tests
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
    yield: 1,                     // Base batch servings (default 1)
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
  - `speakeasy_drink_history`: Log of drinks made (`{ id, recipeId, madeAt, rating, notes }`).
  - `speakeasy_pinned_tags`: Array of tag names pinned to display as dedicated carousels on the Home landing page.
  - `speakeasy_bars`: Metadata for multi-bar locations, with `speakeasy_active_bar_id` tracking the current view.
  - `speakeasy_auth_token` and `speakeasy_user`: Authentication state for cloud sync.
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
- **Dilution Models** (`METHOD_DILUTION` in `abv.js`):
  - Stirred with ice: ~22% dilution.
  - Shaken with ice: ~32% dilution.
  - Rolled: ~18% dilution.
  - Built on rocks: ~5% dilution.
  - Blended: ~45% dilution.

### 3.9 Flavor Balance & Palate Distance Matching (`balance.js`, `counter-view.js`)
- **Radar Dimensions**: Calculates profile values (Sweet, Sour, Bitter, Spirit, Herbal) based on normalized recipe ingredient volumes.
- **Palate Distance**: Computes Euclidean distance between radar vectors to determine taste similarity percentages (`calculatePalateSimilarity`).
- **Enhanced Recommendations**: Powers "Similar Cocktails" suggestions on the counter view, presenting palate match scores to guide drink selection.

### 3.10 Backbar Inventory & Bottle-Next Logic (`taxonomy.js`, `state.js`)
- **Can-Make Evaluation**: Evaluates active inventory against recipe requirements. Pantry staples (water, standard ice, simple syrup) are treated as always in stock.
- **Directional Hierarchy**: Owning a specific child satisfying a generic recipe requirement (for instance, owning *Bourbon* satisfies a recipe asking for *Whiskey*), but not the reverse.
- **Performance Caching**: Inventory analysis results are memoized per recipe in `state.js` using an incrementing `inventoryVersion` cache key.
- **Bottle-Next Calculation**: Identifies drinks missing exactly one ingredient and flags which single bottle purchase unlocks the highest number of new drinks.

### 3.11 Mixologist Ranks & Progression Mechanics (`top-bar.js`, `toast.js`)
- **Philosophy**: Progression is designed to occur naturally through organic home bar use rather than grinding. Points are weighted directly by effort and culinary craft, ranging from basic setup up to authoring original recipes from scratch.
- **Activity Hierarchy & Scoring Formula**:
  $$\begin{aligned}
  \text{Score} = &\ \lfloor \min(\text{inventorySize} \times 0.5, 15) \rfloor \\
  &+ \min(\text{pinnedTagsCount}, 5) \\
  &+ \min(\text{customRiffsCount} \times 3, 24) \\
  &+ \min(\text{customScratchCount} \times 8, 40) \\
  &+ (\text{drinksPoured} \times 2) \\
  &+ (\text{uniqueDrinksPoured} \times 4)
  \end{aligned}$$
  - **Tier 1 (Stocking the Bar, 0.5 pt each, capped at 15)**: Low-barrier setup action. A fully stocked backbar advances a new user into *Apprentice* (12 pts), but cannot reach *Barback* (20 pts) on bottles alone.
  - **Tier 2 (App Customization, 1 pt each, capped at 5)**: Pinning preferred tags or collections to the home view.
  - **Tier 3 (Riff Crafting, 3 pts each, capped at 24)**: Creating a customized variant of an existing recipe.
  - **Tier 4 (Core Action, 2 pts each, uncapped)**: Pouring a repeat cocktail via "I Made This".
  - **Tier 5 (Palate Exploration, +4 bonus pts each)**: Pouring a new unique cocktail yields 6 points total on first pour (2 pour + 4 variety bonus).
  - **Tier 6 (Peak Craft, 8 pts each, capped at 40)**: Authoring a completely original, non-riff cocktail from scratch.
- **High-Water Mark (Lifetime Peak)**:
  - Users **never lose rank or points**.
  - If a user runs out of ingredients, deletes a draft test riff, or switches to a smaller secondary bar, `speakeasy_mixologist_lifetime_score` in `localStorage` locks in their highest achieved score.
- **Alert Debouncing & Coalescence**:
  - Toggling bottles while the Backbar Modal is open suppresses mid-session popups.
  - When the Backbar Modal closes, net promotions are checked and coalesced into a single celebratory banner celebrating their highest unlocked rank.
- **Threshold Table (`MIXOLOGIST_RANKS`)**:
  - `0`: Cocktail Curious
  - `5`: Soda Jerk
  - `12`: Apprentice
  - `20`: Barback
  - `32`: Bootlegger
  - `45`: Rum Runner
  - `60`: Day-Shift Pourer
  - `78`: Bartender
  - `100`: Tin Shaker
  - `125`: The House Host
  - `155`: Palate Detective
  - `190`: Head Mixologist
  - `230`: Spirits Connoisseur
  - `275`: The Alchemist
  - `325`: Liquid Architect
  - `380`: Master Distiller
  - `440`: The Maestro
  - `510`: Speakeasy Proprietor
  - `590`: Cellar Master
  - `680`: Copper & Oak
  - `780`: Blind-Tasting Savant
  - `890`: Grand Conservator
  - `1000`: Living Legend
- **Level-Up Celebrations**:
  - Crossing a rank threshold triggers `showLevelUpCelebration` with an Art Deco gold gradient toast, 3D badge pop, and radiating sparkle particles.
  - **Animation Guard**: Suppressed automatically whenever the **More Fun** setting is toggled off (`animations-disabled` class) or system `prefers-reduced-motion` is active.
  - **Developer Testing Helper**: Triggerable in console via `speakeasyLevelUp(newTitle, previousTitle)`.

### 3.12 Bar Calculators & Batch Scaling Engine (`calculators.js`, `calculator-modal.js`)
- **Batch Scaling & Dilution**: Calculates scaled ingredient volumes and required dilution water when pre-batching cocktails into bottles or punch bowls. Incorporates method-specific dilution rates (`Stirred` ~22%, `Shaken` ~32%, `Built` ~5%, `Blended` ~45%) to ensure pre-chilled bottled batches match standard shaken/stirred drinks.
- **Acid Adjustment**: Computes citric and malic acid powder weights needed to balance fresh juices (such as orange or grapefruit) to match the acidity of lime or lemon, maintaining standard cocktail ratios without altering flavor profiles.
- **Syrup Brix Calculator**: Calculates sugar content percentage by weight (°Bx) and total finished yield volume for simple, rich, or custom ratio syrups.
- **Recipe Batch Yield**: Recipes support a `yield` integer property (defaults to 1). Ingredients in recipes authored as batches or punches automatically scale down to single-serving portions for glass rendering, calories, and ABV estimation, while preserving batch specs for display and scaling.

### 3.13 Recipe Ratings, Tasting Notes & Pour History (`rating-modal.js`, `history.js`, `functions/api/history/*`)
- **Star Ratings & Notes**: Users can assign 1 to 5 star ratings and add tasting notes when recording drinks made ("I Made This") or directly from the counter view.
- **Persistence & Cloud Sync**: Ratings and notes persist locally across sessions in `speakeasy_drink_history` and synchronize with Cloudflare D1 via `/api/history/log` and `/api/history/update`.
- **Guest-to-Cloud Migration**: Local guest ratings and notes seamlessly migrate to the user's remote account upon sign-in.

### 3.14 Print Engine & Physical Formats (`print-window.js`, `css/print.css`)
- **Menu Builder Printing**: Generates clean, printer-optimized physical menus directly from saved event menus with course sections, descriptions, and spirit highlights.
- **Recipe Sheet Printing**: Outputs formatted index cards and counter recipe sheets complete with glassware specs, instructions, and measurements.

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
- **Custom Recipes**: Custom recipes can be shared by posting a read-only snapshot to `/api/shares`. This generates a public short link backed by D1, allowing recipients to view the exact specs and instructions without needing an account.

### Admin Dashboard & Product Analytics
- **Separate Surface**: Accessible at `/admin.html`. Gated behind an admin authentication session (`ADMIN_PASSWORD` or signed HMAC cookie issued by `/api/admin/login`).
- **Telemetry Module (`js/modules/telemetry.js`)**: Fire-and-forget event dispatcher queuing recipe views, debounced search queries, and feature interactions. Flushes via `navigator.sendBeacon` or `fetch` with `keepalive: true`.
- **Privacy Design**: Telemetry stores no personal identity, account IDs, or IP addresses. It captures event type, target entity ID/query, timestamp, and coarse device classification (`mobile` vs `desktop`).
- **Analytics Aggregations (`/api/admin/analytics`)**: Summarizes total users, active accounts (7d/30d), total bars saved, custom recipes created, most/least viewed cocktails, top drinks poured via "I Made This", search trends, and backbar bottle stock counts.
- **Catalog & Ingredient Intelligence**: Computes most and least called-for ingredients across catalog cocktails and visualizes the distribution of base spirit families (Whiskey, Gin, Rum, Agave, Brandy, Vodka, Liqueurs) via an SVG donut breakdown.
- **Global Recipe Management**: Allows promoting user-created riffs into the global library (`global_recipes` table) and toggling global recipe visibility (`global_hidden_recipes` table).

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

*Last updated: September 17, 2026*
