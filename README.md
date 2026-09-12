# Speakeasy

Speakeasy is a personal cocktail library and digital bar companion designed for use directly on your kitchen or bar counter. It combines visual glassware, instant recipe parsing, and inventory tracking to help you mix better drinks with the bottles you have on hand.

Everything runs locally in your browser by default. You can use it completely offline with no tracking scripts. Optionally, you can sign in to sync your library across devices, manage multiple bars, and share your custom cocktails with friends.

---

## Highlights

### Visual Glassware & Live Fluid Layers
- See your drink come together before pouring: recipes render inside glassware silhouettes such as Coupes, Highballs, Rocks glasses, Nick & Noras, and Tiki Mugs.
- Hover over an ingredient to highlight its corresponding layer in the glass, or hover over the glass to identify the ingredient.
- Toggle between layered pours and blended views for drinks that shake or blend into a uniform color.
- Accurate garnishes (citrus wheels, twists, cherries, and sprigs) anchor automatically to the glass rim and liquid level.

### Smart Backbar Inventory & Bottle-Next
- Check off the spirits, liqueurs, bitters, and mixers in your collection.
- Instantly see which recipes you can make right now.
- Discover drinks where you are only one bottle away, helping you decide what to pick up next.
- Understand bottle storage requirements, including which fortified wines and vermouths belong in the refrigerator once opened.

### Menu Builder & Event Planning
- Curate custom drink menus for dinner parties, gatherings, or seasonal rotations.
- Automatically calculates total glassware requirements across your chosen drink lineup.
- Generates a consolidated checklist categorized by bar, refrigerator, and pantry locations, highlighting exactly which bottles you need to purchase.

### Riff Engine & Lineage
- Explore cocktail family trees to learn how modern drinks evolved from classics.
- Missing a bottle? Use built-in substitution recommendations to swap ingredients without ruining drink balance.
- Discover similar drinks through flavor radar palate matching.

### Counter View
- High-contrast typography designed to stay readable across a dimly lit bar counter.
- One-tap conversions between fluid ounces (`oz`) and milliliters (`ml`).
- Dynamic serving multipliers to scale recipes up or down for guests.
- Sticky drink titles and screen wake-lock ensure you never lose your place while mixing.
- Inline smart timers detected directly from recipe instructions with haptic alerts.

### Quick Paste & Recipe Notes
- Paste raw cocktail specs from recipe books, websites, or personal notes. The parser interprets vulgar unicode fractions, decimals, barspoons, dashes, and standard units automatically.
- Automatic detection identifies preparation methods, glassware types, and suggested flavor tags.
- Hide drinks you do not plan to serve to keep your collection curated.

### Private, Portable & Shareable
- **Cloud Sync & Multiple Bars**: Optionally sign in to sync your data across devices and manage multiple distinct bar locations (e.g., "Home Bar" and "Office Bar").
- **Share Any Drink**: Share deep links to canonical seed recipes, or generate public read-only links for your own custom creations.
- **Drink History**: Log drinks as you make them to keep a running history of what you've mixed and when.
- **Unified Export**: Back up or transfer your library anytime with unified JSON export and import.

### Admin Dashboard & Product Analytics
- **Privacy-First Analytics**: Local-first event telemetry tracks cocktail views, user discovery searches, and feature utilization without capturing IP addresses or personal identifiers.
- **Insight Dashboards**: Monitor most/least viewed cocktails, top poured drinks ("I Made This"), search query gaps, and device category splits.
- **Ingredient & Spirit Trends**: Analyze frequently stocked bottles across user bars alongside most/least called-for ingredients and base spirit family distributions across catalog cocktails.
- **Global Recipe Management**: Review and promote custom cocktails into the global catalog, or hide canonical recipes across all users.

---

## Technical Details

Speakeasy is built with vanilla HTML5, modern CSS, and ES6 JavaScript modules with zero external runtime dependencies or build steps.

For complete developer specifications, module hierarchies, and architectural decisions, see the [Architecture & Decision Guide](ARCHITECTURE_AND_DECISION_GUIDE.md).

---

## Getting Started

### Local Development

1. Start the local server:
   ```bash
   npm run dev
   ```
2. Open `http://localhost:8789` in your browser.

### Run Tests

Verify recipe data, taxonomy logic, and parsing mechanics:
```bash
npm test
```

---

*Last updated: September 10, 2026*
