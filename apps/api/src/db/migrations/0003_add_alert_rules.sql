-- Add alert_rules table for persisting user-defined alert rules
CREATE TABLE IF NOT EXISTS "alert_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"budget_id" uuid,
	"trigger" varchar(100) NOT NULL,
	"conditions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"actions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"cooldown_minutes" integer DEFAULT 60 NOT NULL,
	"max_executions_per_day" integer DEFAULT 10 NOT NULL,
	"last_executed_at" timestamp (6) with time zone,
	"execution_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (6) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "alert_rules" ADD CONSTRAINT "alert_rules_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "alert_rules" ADD CONSTRAINT "alert_rules_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_alert_rules_client_id" ON "alert_rules" USING btree ("client_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_alert_rules_org_id" ON "alert_rules" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_alert_rules_enabled" ON "alert_rules" USING btree ("enabled");
