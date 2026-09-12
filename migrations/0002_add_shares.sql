-- Public Read-Only Snapshots of Custom Recipes (Share-via-Link)
CREATE TABLE IF NOT EXISTS shares (
    share_id TEXT PRIMARY KEY,
    recipe TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
