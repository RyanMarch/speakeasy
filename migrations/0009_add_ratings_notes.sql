-- Adds optional star rating and free-text tasting notes to logged drink history entries.
ALTER TABLE drink_history ADD COLUMN rating INTEGER DEFAULT NULL;
ALTER TABLE drink_history ADD COLUMN notes TEXT DEFAULT NULL;
