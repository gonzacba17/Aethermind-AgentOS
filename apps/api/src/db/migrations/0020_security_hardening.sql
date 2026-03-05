-- Security hardening: hashed SDK keys + token expiration
-- Phase 1 security improvements

-- Add hashed SDK key columns for bcrypt-based lookup
ALTER TABLE clients ADD COLUMN IF NOT EXISTS sdk_api_key_hash VARCHAR(255);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS sdk_api_key_prefix VARCHAR(20);
CREATE INDEX IF NOT EXISTS idx_clients_sdk_api_key_prefix ON clients (sdk_api_key_prefix);

-- Add token expiration column
ALTER TABLE clients ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_clients_token_expires_at ON clients (token_expires_at);

-- Backfill: set prefix from existing plaintext keys (hash must be done in app code)
UPDATE clients
SET sdk_api_key_prefix = LEFT(sdk_api_key, 20)
WHERE sdk_api_key_prefix IS NULL AND sdk_api_key IS NOT NULL;
