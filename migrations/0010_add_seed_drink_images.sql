-- Per-recipe link-preview images (og:image) for the ~180 bundled seed
-- cocktails, keyed by the recipe's static id. Unlike shares.og_image, these
-- are never rendered client-side at request time — seed recipes have no
-- creation flow to render one at — so they're pre-rendered once offline
-- (see scripts/generate-seed-og-images.js, which draws the same glassware
-- art as the share card) and bulk-loaded here rather than shipped as static
-- files, so functions/drink/[id]/og.png.js can serve them the same way
-- functions/share/[id]/og.png.js already serves shares.og_image.
CREATE TABLE IF NOT EXISTS seed_drink_images (
    recipe_id TEXT PRIMARY KEY,
    og_image BLOB NOT NULL,
    generated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
