-- Rate-limiting support for OTP verification: track failed attempts so a
-- code can be locked out well before its 10-minute expiry, and track when it
-- was issued so request-otp can refuse to mint a fresh code (and reset the
-- attempt budget) more than once per minute for the same email.
--
-- created_at has no DEFAULT here (unlike the same column in schema.sql's
-- fresh-install CREATE TABLE) because D1/SQLite rejects CURRENT_TIMESTAMP as
-- an ALTER TABLE ADD COLUMN default ("Cannot add a column with non-constant
-- default"). request-otp.js binds created_at explicitly on every insert, so
-- no column-level default is actually needed.
ALTER TABLE otp_codes ADD COLUMN attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE otp_codes ADD COLUMN created_at DATETIME;
UPDATE otp_codes SET created_at = CURRENT_TIMESTAMP WHERE created_at IS NULL;
