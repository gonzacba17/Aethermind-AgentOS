-- Add missing user fields for onboarding and verification
-- Migration: add_user_onboarding_fields
-- Date: 2026-01-15

-- Add verification expiry field
ALTER TABLE "users" 
ADD COLUMN IF NOT EXISTS "verification_expiry" TIMESTAMPTZ(6);

-- Add onboarding tracking fields
ALTER TABLE "users" 
ADD COLUMN IF NOT EXISTS "has_completed_onboarding" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "users" 
ADD COLUMN IF NOT EXISTS "onboarding_step" VARCHAR(50) DEFAULT 'welcome';

-- Add trial management fields
ALTER TABLE "users" 
ADD COLUMN IF NOT EXISTS "trial_started_at" TIMESTAMPTZ(6);

ALTER TABLE "users" 
ADD COLUMN IF NOT EXISTS "trial_ends_at" TIMESTAMPTZ(6);

-- Add subscription status field
ALTER TABLE "users" 
ADD COLUMN IF NOT EXISTS "subscription_status" VARCHAR(50) NOT NULL DEFAULT 'free';

-- Add login tracking fields
ALTER TABLE "users" 
ADD COLUMN IF NOT EXISTS "last_login_at" TIMESTAMPTZ(6);

ALTER TABLE "users" 
ADD COLUMN IF NOT EXISTS "first_login_at" TIMESTAMPTZ(6);

-- Add free tier limits
ALTER TABLE "users" 
ADD COLUMN IF NOT EXISTS "max_agents" INTEGER NOT NULL DEFAULT 3;

ALTER TABLE "users" 
ADD COLUMN IF NOT EXISTS "log_retention_days" INTEGER NOT NULL DEFAULT 30;

-- Make password_hash nullable for OAuth users
ALTER TABLE "users" 
ALTER COLUMN "password_hash" DROP NOT NULL;

-- Add name column if it doesn't exist
ALTER TABLE "users" 
ADD COLUMN IF NOT EXISTS "name" VARCHAR(255);

-- Add OAuth ID columns if they don't exist
ALTER TABLE "users" 
ADD COLUMN IF NOT EXISTS "google_id" VARCHAR(255);

ALTER TABLE "users" 
ADD COLUMN IF NOT EXISTS "github_id" VARCHAR(255);

-- Create unique indexes for OAuth IDs
CREATE UNIQUE INDEX IF NOT EXISTS "users_google_id_key" ON "users"("google_id");
CREATE UNIQUE INDEX IF NOT EXISTS "users_github_id_key" ON "users"("github_id");

-- Create indexes for new fields
CREATE INDEX IF NOT EXISTS "idx_users_google_id" ON "users"("google_id");
CREATE INDEX IF NOT EXISTS "idx_users_github_id" ON "users"("github_id");

-- Create subscription_logs table if not exists
CREATE TABLE IF NOT EXISTS "subscription_logs" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "user_id" TEXT NOT NULL,
    "event" VARCHAR(100) NOT NULL,
    "metadata" JSONB,
    "timestamp" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "subscription_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Create indexes for subscription_logs
CREATE INDEX IF NOT EXISTS "idx_subscription_logs_user_id" ON "subscription_logs"("user_id");
CREATE INDEX IF NOT EXISTS "idx_subscription_logs_timestamp" ON "subscription_logs"("timestamp");
CREATE INDEX IF NOT EXISTS "idx_subscription_logs_event" ON "subscription_logs"("event");
