-- Users & Core Settings
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    display_name TEXT,
    settings TEXT DEFAULT '{"unitPref":"oz","sortPref":"curated","glassViewMode":"layered"}',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Sessions (Lightweight Auth Token Store)
CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at DATETIME NOT NULL
);

-- Multiple Saved Bars per User
CREATE TABLE IF NOT EXISTS bars (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    is_default INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Ingredients per Bar (Taxonomy IDs)
CREATE TABLE IF NOT EXISTS bar_inventory (
    bar_id TEXT NOT NULL REFERENCES bars(id) ON DELETE CASCADE,
    ingredient_id TEXT NOT NULL,
    is_low_stock INTEGER DEFAULT 0,
    PRIMARY KEY (bar_id, ingredient_id)
);

-- Custom User Cocktails & Lineage Riffs
CREATE TABLE IF NOT EXISTS custom_recipes (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    glassware TEXT,
    method TEXT,
    specs TEXT NOT NULL,          -- JSON array of ingredients/amounts
    instructions TEXT,
    description TEXT,
    notes TEXT,
    riff_of_id TEXT,
    riff_of_name TEXT,
    tags TEXT,                   -- JSON array of tag strings
    is_public INTEGER DEFAULT 0,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Public Read-Only Snapshots of Custom Recipes (Share-via-Link)
CREATE TABLE IF NOT EXISTS shares (
    share_id TEXT PRIMARY KEY,
    recipe TEXT NOT NULL,          -- JSON blob: full recipe snapshot at share-time
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Drink History ("I made this" Log)
CREATE TABLE IF NOT EXISTS drink_history (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recipe_id TEXT NOT NULL,
    made_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- One-Time Password / Magic Link Codes
CREATE TABLE IF NOT EXISTS otp_codes (
    email TEXT NOT NULL,
    code TEXT NOT NULL,
    expires_at DATETIME NOT NULL
);
