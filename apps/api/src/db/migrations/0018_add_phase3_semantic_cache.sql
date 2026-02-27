-- Phase 3: Semantic Caching

-- 1. semantic_cache table
CREATE TABLE IF NOT EXISTS "semantic_cache" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "client_id" UUID NOT NULL REFERENCES "clients"("id") ON DELETE CASCADE,
  "prompt_hash" VARCHAR(64) NOT NULL,
  "prompt_embedding" JSONB,
  "prompt" TEXT NOT NULL,
  "response" TEXT NOT NULL,
  "model" VARCHAR(255) NOT NULL,
  "tokens_used" INTEGER NOT NULL,
  "cost_usd" DECIMAL(10,6) NOT NULL,
  "hit_count" INTEGER NOT NULL DEFAULT 0,
  "is_deterministic" BOOLEAN NOT NULL DEFAULT FALSE,
  "ttl_expires_at" TIMESTAMP(6) WITH TIME ZONE,
  "created_at" TIMESTAMP(6) WITH TIME ZONE NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP(6) WITH TIME ZONE NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_semantic_cache_client_hash" ON "semantic_cache" ("client_id", "prompt_hash");
CREATE INDEX IF NOT EXISTS "idx_semantic_cache_client_id" ON "semantic_cache" ("client_id");
CREATE INDEX IF NOT EXISTS "idx_semantic_cache_deterministic" ON "semantic_cache" ("is_deterministic");

-- 2. cache_settings table
CREATE TABLE IF NOT EXISTS "cache_settings" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "client_id" UUID NOT NULL UNIQUE REFERENCES "clients"("id") ON DELETE CASCADE,
  "enabled" BOOLEAN NOT NULL DEFAULT FALSE,
  "similarity_threshold" DECIMAL(3,2) NOT NULL DEFAULT 0.90,
  "ttl_seconds" INTEGER NOT NULL DEFAULT 86400,
  "deterministic_ttl_seconds" INTEGER,
  "updated_at" TIMESTAMP(6) WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 3. Extend telemetry_events
ALTER TABLE "telemetry_events" ADD COLUMN IF NOT EXISTS "cache_hit" BOOLEAN DEFAULT FALSE;
ALTER TABLE "telemetry_events" ADD COLUMN IF NOT EXISTS "cache_saved_usd" DECIMAL(10,6);
