-- Rate-limiting support for OTP verification: track failed attempts so a
-- code can be locked out well before its 10-minute expiry, and track when it
-- was issued so request-otp can refuse to mint a fresh code (and reset the
-- attempt budget) more than once per minute for the same email.
ALTER TABLE otp_codes ADD COLUMN attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE otp_codes ADD COLUMN created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;
