-- Phase 5: Learning Engine — client_insights & platform_benchmarks

-- 1. client_insights table
CREATE TABLE IF NOT EXISTS "client_insights" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "client_id" UUID NOT NULL REFERENCES "clients"("id") ON DELETE CASCADE,
  "type" VARCHAR(50) NOT NULL,
  "data" JSONB NOT NULL,
  "estimated_savings_usd" DECIMAL(10,2),
  "acknowledged" BOOLEAN NOT NULL DEFAULT FALSE,
  "applied_at" TIMESTAMP(6) WITH TIME ZONE,
  "dismissed_at" TIMESTAMP(6) WITH TIME ZONE,
  "created_at" TIMESTAMP(6) WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_client_insights_client_id" ON "client_insights" ("client_id");
CREATE INDEX IF NOT EXISTS "idx_client_insights_type" ON "client_insights" ("type");
CREATE INDEX IF NOT EXISTS "idx_client_insights_client_type" ON "client_insights" ("client_id", "type");
CREATE INDEX IF NOT EXISTS "idx_client_insights_created_at" ON "client_insights" ("created_at");

-- 2. platform_benchmarks table
CREATE TABLE IF NOT EXISTS "platform_benchmarks" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "calculated_at" TIMESTAMP(6) WITH TIME ZONE NOT NULL,
  "avg_cost_per_request" DECIMAL(10,6) NOT NULL,
  "p50_cost_per_request" DECIMAL(10,6) NOT NULL,
  "p90_cost_per_request" DECIMAL(10,6) NOT NULL,
  "avg_cache_hit_rate" DECIMAL(5,4) NOT NULL,
  "avg_compression_ratio" DECIMAL(5,4) NOT NULL,
  "sample_size" INTEGER NOT NULL,
  "created_at" TIMESTAMP(6) WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_platform_benchmarks_calculated_at" ON "platform_benchmarks" ("calculated_at");
