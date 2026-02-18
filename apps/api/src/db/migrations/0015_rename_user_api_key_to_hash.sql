-- Rename users.api_key to users.api_key_hash
ALTER TABLE "users" RENAME COLUMN "api_key" TO "api_key_hash";

-- Drop old index and create new one
DROP INDEX IF EXISTS "idx_users_api_key";
CREATE INDEX IF NOT EXISTS "idx_users_api_key_hash" ON "users" ("api_key_hash");
