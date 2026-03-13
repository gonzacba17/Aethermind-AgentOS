-- Add missing indexes identified in DB audit

-- Composite index: telemetry_events(organization_id, status)
-- Speeds up per-org status filtering (dashboard error rate queries)
CREATE INDEX IF NOT EXISTS idx_telemetry_org_status
  ON telemetry_events (organization_id, status);

-- Partial index: clients(token_expires_at) WHERE token_expires_at IS NOT NULL
-- Only index rows with expiration set (skips legacy null-expiry tokens)
-- Drop the old full index first if it exists, then create the partial one
DROP INDEX IF EXISTS idx_clients_token_expires_at;
CREATE INDEX IF NOT EXISTS idx_clients_token_expires_at_partial
  ON clients (token_expires_at)
  WHERE token_expires_at IS NOT NULL;

-- Partial index: users(verification_token) WHERE verification_token IS NOT NULL
-- Only active verification tokens need indexing (most rows are NULL after verification)
CREATE INDEX IF NOT EXISTS idx_users_verification_token
  ON users (verification_token)
  WHERE verification_token IS NOT NULL;

-- Partial index: users(reset_token) WHERE reset_token IS NOT NULL
-- Only active reset tokens need indexing (most rows are NULL)
CREATE INDEX IF NOT EXISTS idx_users_reset_token
  ON users (reset_token)
  WHERE reset_token IS NOT NULL;
