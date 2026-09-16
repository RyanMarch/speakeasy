-- Same class of bug as 0005: source/sourceUrl (the seed recipe's editorial
-- citation, e.g. "Count Camillo Negroni, Florence (1919)") survives
-- duplicateRecipe()/buildRiffDraft() onto a custom recipe client-side, but
-- had no column to land in here, so it silently dropped on every cloud sync
-- round-trip (push omitted it, pull then overwrote the local copy with the
-- column-less version). Add the missing columns to both tables.
ALTER TABLE custom_recipes ADD COLUMN source TEXT;
ALTER TABLE custom_recipes ADD COLUMN source_url TEXT;
ALTER TABLE global_recipes ADD COLUMN source TEXT;
ALTER TABLE global_recipes ADD COLUMN source_url TEXT;
