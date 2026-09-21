-- Published guest menus (Hosting Mode).
-- A host publishes a menu from the Menu Builder and hands guests a link/QR
-- code. Unlike `shares` (a frozen single-recipe snapshot), a menu is *mutable*:
-- the host can update it or mark drinks "out" mid-party, so each row carries a
-- hashed edit token (returned once, at creation) instead of requiring an account.
CREATE TABLE IF NOT EXISTS menus (
    menu_id TEXT PRIMARY KEY,
    edit_token_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    recipes TEXT NOT NULL,                 -- JSON array of recipe snapshots (each carries its id)
    unavailable TEXT NOT NULL DEFAULT '[]', -- JSON array of recipe ids currently marked "out"
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
