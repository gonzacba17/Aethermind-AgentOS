-- CreateEnum for plan types
CREATE TYPE "Plan" AS ENUM ('FREE', 'STARTUP', 'ENTERPRISE');

-- Create organizations table
CREATE TABLE "organizations" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "name" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(255) NOT NULL UNIQUE,
    "api_key_hash" VARCHAR(255) NOT NULL UNIQUE,
    "plan" VARCHAR(50) NOT NULL DEFAULT 'FREE',
    "rate_limit_per_min" INTEGER NOT NULL DEFAULT 100,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for organizations
CREATE INDEX "idx_organizations_api_key" ON "organizations"("api_key_hash");
CREATE INDEX "idx_organizations_plan" ON "organizations"("plan");

-- Add organization_id to users table
ALTER TABLE "users" 
ADD COLUMN "organization_id" UUID;

-- Add foreign key constraint
ALTER TABLE "users"
ADD CONSTRAINT "users_organization_id_fkey" 
FOREIGN KEY ("organization_id") 
REFERENCES "organizations"("id") 
ON DELETE SET NULL 
ON UPDATE CASCADE;

-- Create index for user-organization relationship
CREATE INDEX "idx_users_organization_id" ON "users"("organization_id");

-- Create telemetry_events table
CREATE TABLE "telemetry_events" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "timestamp" TIMESTAMPTZ(6) NOT NULL,
    "provider" VARCHAR(50) NOT NULL,
    "model" VARCHAR(255) NOT NULL,
    "prompt_tokens" INTEGER NOT NULL,
    "completion_tokens" INTEGER NOT NULL,
    "total_tokens" INTEGER NOT NULL,
    "cost" DECIMAL(10, 6) NOT NULL,
    "latency" INTEGER NOT NULL,
    "status" VARCHAR(20) NOT NULL,
    "error" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Add foreign key for organization
ALTER TABLE "telemetry_events"
ADD CONSTRAINT "telemetry_events_organization_id_fkey"
FOREIGN KEY ("organization_id")
REFERENCES "organizations"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

-- Create indexes for telemetry_events
CREATE INDEX "idx_telemetry_org_time" ON "telemetry_events"("organization_id", "timestamp" DESC);
CREATE INDEX "idx_telemetry_provider_model" ON "telemetry_events"("provider", "model");
CREATE INDEX "idx_telemetry_status" ON "telemetry_events"("status");
CREATE INDEX "idx_telemetry_created_at" ON "telemetry_events"("created_at" DESC);
