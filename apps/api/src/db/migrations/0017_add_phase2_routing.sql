-- Phase 2: Model Routing & Provider Routing
-- Migration: Add routing_rules, provider_health tables and extend telemetry_events

-- ============================================
-- 1. Extend telemetry_events with routing fields
-- ============================================
ALTER TABLE "telemetry_events" ADD COLUMN IF NOT EXISTS "original_model" VARCHAR(255);
ALTER TABLE "telemetry_events" ADD COLUMN IF NOT EXISTS "routed_model" VARCHAR(255);
ALTER TABLE "telemetry_events" ADD COLUMN IF NOT EXISTS "fallback_used" BOOLEAN DEFAULT FALSE;
ALTER TABLE "telemetry_events" ADD COLUMN IF NOT EXISTS "provider_fallback" BOOLEAN DEFAULT FALSE;
ALTER TABLE "telemetry_events" ADD COLUMN IF NOT EXISTS "fallback_provider" VARCHAR(50);
ALTER TABLE "telemetry_events" ADD COLUMN IF NOT EXISTS "quality_rating" VARCHAR(10);

-- Index for routing analysis
CREATE INDEX IF NOT EXISTS "idx_telemetry_routed_model" ON "telemetry_events" ("routed_model");

-- ============================================
-- 2. Create routing_rules table
-- ============================================
CREATE TABLE IF NOT EXISTS "routing_rules" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "client_id" UUID NOT NULL UNIQUE REFERENCES "clients"("id") ON DELETE CASCADE,
  "enabled" BOOLEAN NOT NULL DEFAULT FALSE,
  "simple_model" VARCHAR(255) NOT NULL DEFAULT 'gpt-4o-mini',
  "medium_model" VARCHAR(255) NOT NULL DEFAULT 'gpt-4o-mini',
  "complex_model" VARCHAR(255) NOT NULL DEFAULT 'gpt-4o',
  "created_at" TIMESTAMP(6) WITH TIME ZONE NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP(6) WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_routing_rules_client_id" ON "routing_rules" ("client_id");

-- ============================================
-- 3. Create provider_health table
-- ============================================
CREATE TABLE IF NOT EXISTS "provider_health" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "provider" VARCHAR(50) NOT NULL UNIQUE,
  "status" VARCHAR(20) NOT NULL DEFAULT 'ok',
  "latency_ms" INTEGER,
  "last_checked_at" TIMESTAMP(6) WITH TIME ZONE,
  "error_message" TEXT,
  "created_at" TIMESTAMP(6) WITH TIME ZONE NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP(6) WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_provider_health_provider" ON "provider_health" ("provider");
CREATE INDEX IF NOT EXISTS "idx_provider_health_status" ON "provider_health" ("status");

-- Seed initial provider health rows
INSERT INTO "provider_health" ("provider", "status") VALUES
  ('openai', 'ok'),
  ('anthropic', 'ok'),
  ('ollama', 'ok')
ON CONFLICT ("provider") DO NOTHING;
