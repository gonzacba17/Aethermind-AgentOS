-- Phase 4: Prompt Optimization
-- Migration: Add compression tracking and optimization settings

-- 1. Add Phase 4 columns to telemetry_events (all nullable)
ALTER TABLE "telemetry_events" ADD COLUMN IF NOT EXISTS "compression_applied" boolean;
ALTER TABLE "telemetry_events" ADD COLUMN IF NOT EXISTS "original_tokens" integer;
ALTER TABLE "telemetry_events" ADD COLUMN IF NOT EXISTS "compressed_tokens" integer;
ALTER TABLE "telemetry_events" ADD COLUMN IF NOT EXISTS "tokens_saved" integer;

-- 2. Create prompt_compression_log table
CREATE TABLE IF NOT EXISTS "prompt_compression_log" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "client_id" uuid NOT NULL REFERENCES "clients"("id") ON DELETE CASCADE,
  "original_tokens" integer NOT NULL,
  "compressed_tokens" integer NOT NULL,
  "saved_tokens" integer NOT NULL,
  "saved_usd" numeric(10, 6) DEFAULT '0' NOT NULL,
  "compression_applied" boolean DEFAULT false NOT NULL,
  "model" varchar(255) NOT NULL,
  "agent_id" varchar(255),
  "created_at" timestamp(6) with time zone DEFAULT now() NOT NULL
);

-- 3. Indexes for prompt_compression_log
CREATE INDEX IF NOT EXISTS "idx_compression_log_client_id" ON "prompt_compression_log" ("client_id");
CREATE INDEX IF NOT EXISTS "idx_compression_log_created_at" ON "prompt_compression_log" ("created_at");
CREATE INDEX IF NOT EXISTS "idx_compression_log_client_created" ON "prompt_compression_log" ("client_id", "created_at");

-- 4. Create optimization_settings table (PK = client_id, one row per client)
CREATE TABLE IF NOT EXISTS "optimization_settings" (
  "client_id" uuid PRIMARY KEY REFERENCES "clients"("id") ON DELETE CASCADE,
  "compression_enabled" boolean DEFAULT false NOT NULL,
  "min_compression_ratio" numeric(3, 2) DEFAULT '0.15' NOT NULL,
  "updated_at" timestamp(6) with time zone DEFAULT now() NOT NULL
);
