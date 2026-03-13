-- Hash client access tokens and SDK API keys (bcrypt)
-- Phase 1: Add hash + prefix columns alongside existing plaintext columns.
-- Plaintext columns will be dropped in a separate migration after backfill verification.

-- access_token_hash: bcrypt hash of the full access token
ALTER TABLE clients ADD COLUMN IF NOT EXISTS access_token_hash VARCHAR(255);

-- access_token_prefix: first 16 chars of plaintext token, used for indexed candidate lookup
ALTER TABLE clients ADD COLUMN IF NOT EXISTS access_token_prefix VARCHAR(16);

-- sdk_api_key_hash and sdk_api_key_prefix were added in migration 0020 but never wired up.
-- Ensure they exist (idempotent).
ALTER TABLE clients ADD COLUMN IF NOT EXISTS sdk_api_key_hash VARCHAR(255);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS sdk_api_key_prefix VARCHAR(20);

-- Indexes for prefix-based candidate lookup (O(1) with index → bcrypt verify)
CREATE INDEX IF NOT EXISTS idx_clients_access_token_prefix ON clients (access_token_prefix);
-- idx_clients_sdk_api_key_prefix already created in migration 0020, but ensure it exists
CREATE INDEX IF NOT EXISTS idx_clients_sdk_api_key_prefix ON clients (sdk_api_key_prefix);

-- Backfill prefixes from existing plaintext tokens
UPDATE clients
SET access_token_prefix = LEFT(access_token, 16)
WHERE access_token_prefix IS NULL AND access_token IS NOT NULL;

UPDATE clients
SET sdk_api_key_prefix = LEFT(sdk_api_key, 20)
WHERE sdk_api_key_prefix IS NULL AND sdk_api_key IS NOT NULL;

-- NOTE: Hash backfill (bcrypt) must be done in application code since bcrypt
-- is not available as a native PostgreSQL function. Run the backfill script:
--   npx tsx apps/api/src/scripts/backfill-token-hashes.ts
