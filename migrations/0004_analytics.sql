-- Analytics & Telemetry Events
CREATE TABLE IF NOT EXISTS analytics_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type TEXT NOT NULL,       -- 'recipe_view', 'search', 'feature_use'
    target_id TEXT,                -- recipe ID, feature name (e.g. 'menu_builder', 'unit_oz')
    query TEXT,                    -- search query string
    device_type TEXT,              -- 'mobile' or 'desktop'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_analytics_events_type_created 
ON analytics_events (event_type, created_at);

CREATE INDEX IF NOT EXISTS idx_analytics_events_target 
ON analytics_events (target_id);

CREATE INDEX IF NOT EXISTS idx_analytics_events_query 
ON analytics_events (query);
