-- Tokens issued before this moment are rejected, so changing or resetting a
-- password signs the user out everywhere. Truncated to whole seconds to match
-- the JWT `iat` claim. TIMESTAMPTZ so the epoch comparison is timezone-safe.
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ;

-- Login looks emails up case-insensitively.
CREATE INDEX IF NOT EXISTS idx_users_email_lower ON users (LOWER(email));

-- password_reset_token now stores a SHA-256 hash of the emailed token, never the
-- token itself. Clear any plain-text tokens issued before this change.
UPDATE users
SET password_reset_token = NULL, password_reset_expires = NULL
WHERE password_reset_token IS NOT NULL;
