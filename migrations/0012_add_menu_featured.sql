-- Host's picks (Hosting Mode).
-- Up to three drinks a host has starred on a published menu; guests see them
-- first, badged. Stored as a JSON array of recipe ids, like `unavailable`.
-- Existing menus simply have no picks.
ALTER TABLE menus ADD COLUMN featured TEXT NOT NULL DEFAULT '[]';
