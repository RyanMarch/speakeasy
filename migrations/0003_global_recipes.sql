-- Global Promoted Cocktails (Available across all users)
CREATE TABLE IF NOT EXISTS global_recipes (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    glassware TEXT,
    method TEXT,
    specs TEXT NOT NULL,
    instructions TEXT,
    description TEXT,
    notes TEXT,
    riff_of_id TEXT,
    riff_of_name TEXT,
    tags TEXT,
    published_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Globally Hidden Cocktails (Suppresses recipes from global visibility)
CREATE TABLE IF NOT EXISTS global_hidden_recipes (
    recipe_id TEXT PRIMARY KEY,
    hidden_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    reason TEXT
);
