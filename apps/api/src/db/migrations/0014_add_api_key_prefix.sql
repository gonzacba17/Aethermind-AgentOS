-- Add apiKeyPrefix column for indexed API key lookup
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "api_key_prefix" varchar(16);

-- Create index for fast prefix-based lookups
CREATE INDEX IF NOT EXISTS "idx_organizations_api_key_prefix" ON "organizations" ("api_key_prefix");
