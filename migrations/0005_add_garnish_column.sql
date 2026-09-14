-- The garnish field was never persisted to D1, so it silently dropped out of
-- custom_recipes and global_recipes on every cloud sync round-trip (push
-- omitted it, pull then overwrote the local copy with the column-less
-- version). Add the missing column to both tables.
ALTER TABLE custom_recipes ADD COLUMN garnish TEXT;
ALTER TABLE global_recipes ADD COLUMN garnish TEXT;
