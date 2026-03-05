CREATE TABLE "alert_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"budget_id" uuid NOT NULL,
	"threshold" integer NOT NULL,
	"triggered_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
	"notified_at" timestamp (6) with time zone
);
--> statement-breakpoint
CREATE TABLE "alert_rules" (
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
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"user_id" text,
	"action" varchar(100) NOT NULL,
	"entity_type" varchar(50) NOT NULL,
	"entity_id" varchar(255),
	"old_values" json,
	"new_values" json,
	"ip_address" varchar(45),
	"user_agent" text,
	"timestamp" timestamp (6) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "backup_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"filename" varchar(255) NOT NULL,
	"file_size" integer NOT NULL,
	"backup_type" varchar(50) NOT NULL,
	"status" varchar(20) NOT NULL,
	"storage_location" varchar(500),
	"error" text,
	"started_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp (6) with time zone,
	"expires_at" timestamp (6) with time zone
);
--> statement-breakpoint
CREATE TABLE "cache_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"similarity_threshold" numeric(3, 2) DEFAULT '0.90' NOT NULL,
	"ttl_seconds" integer DEFAULT 86400 NOT NULL,
	"deterministic_ttl_seconds" integer,
	"updated_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cache_settings_client_id_unique" UNIQUE("client_id")
);
--> statement-breakpoint
CREATE TABLE "client_budgets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"type" varchar(20) NOT NULL,
	"limit_usd" numeric(10, 2) NOT NULL,
	"alert_thresholds" jsonb DEFAULT '[80,90,100]'::jsonb NOT NULL,
	"created_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (6) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "client_insights" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"type" varchar(50) NOT NULL,
	"data" jsonb NOT NULL,
	"estimated_savings_usd" numeric(10, 2),
	"acknowledged" boolean DEFAULT false NOT NULL,
	"applied_at" timestamp (6) with time zone,
	"dismissed_at" timestamp (6) with time zone,
	"created_at" timestamp (6) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_name" varchar(255) NOT NULL,
	"access_token" varchar(80) NOT NULL,
	"sdk_api_key" varchar(255) NOT NULL,
	"organization_id" uuid,
	"rate_limit_per_min" integer DEFAULT 100 NOT NULL,
	"is_active" boolean DEFAULT true,
	"webhook_url" varchar(500),
	"created_at" timestamp with time zone DEFAULT now(),
	"notes" text,
	CONSTRAINT "clients_access_token_unique" UNIQUE("access_token")
);
--> statement-breakpoint
CREATE TABLE "optimization_settings" (
	"client_id" uuid PRIMARY KEY NOT NULL,
	"compression_enabled" boolean DEFAULT false NOT NULL,
	"min_compression_ratio" numeric(3, 2) DEFAULT '0.15' NOT NULL,
	"updated_at" timestamp (6) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_benchmarks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"calculated_at" timestamp (6) with time zone NOT NULL,
	"avg_cost_per_request" numeric(10, 6) NOT NULL,
	"p50_cost_per_request" numeric(10, 6) NOT NULL,
	"p90_cost_per_request" numeric(10, 6) NOT NULL,
	"avg_cache_hit_rate" numeric(5, 4) NOT NULL,
	"avg_compression_ratio" numeric(5, 4) NOT NULL,
	"sample_size" integer NOT NULL,
	"created_at" timestamp (6) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prompt_compression_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"original_tokens" integer NOT NULL,
	"compressed_tokens" integer NOT NULL,
	"saved_tokens" integer NOT NULL,
	"saved_usd" numeric(10, 6) DEFAULT '0' NOT NULL,
	"compression_applied" boolean DEFAULT false NOT NULL,
	"model" varchar(255) NOT NULL,
	"agent_id" varchar(255),
	"created_at" timestamp (6) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "provider_health" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" varchar(50) NOT NULL,
	"status" varchar(20) DEFAULT 'ok' NOT NULL,
	"latency_ms" integer,
	"last_checked_at" timestamp (6) with time zone,
	"error_message" text,
	"created_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "provider_health_provider_unique" UNIQUE("provider")
);
--> statement-breakpoint
CREATE TABLE "routing_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"simple_model" varchar(255) DEFAULT 'gpt-4o-mini' NOT NULL,
	"medium_model" varchar(255) DEFAULT 'gpt-4o-mini' NOT NULL,
	"complex_model" varchar(255) DEFAULT 'gpt-4o' NOT NULL,
	"created_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "routing_rules_client_id_unique" UNIQUE("client_id")
);
--> statement-breakpoint
CREATE TABLE "semantic_cache" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"prompt_hash" varchar(64) NOT NULL,
	"prompt_embedding" jsonb,
	"prompt" text NOT NULL,
	"response" text NOT NULL,
	"model" varchar(255) NOT NULL,
	"tokens_used" integer NOT NULL,
	"cost_usd" numeric(10, 6) NOT NULL,
	"hit_count" integer DEFAULT 0 NOT NULL,
	"is_deterministic" boolean DEFAULT false NOT NULL,
	"ttl_expires_at" timestamp (6) with time zone,
	"created_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (6) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "spans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trace_id" varchar(64) NOT NULL,
	"span_id" varchar(32) NOT NULL,
	"parent_span_id" varchar(32),
	"organization_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"kind" varchar(50) NOT NULL,
	"start_time" timestamp (6) with time zone NOT NULL,
	"end_time" timestamp (6) with time zone,
	"duration_ms" integer,
	"status" varchar(20) DEFAULT 'ok' NOT NULL,
	"status_message" text,
	"attributes" json DEFAULT '{}'::json,
	"events" json DEFAULT '[]'::json,
	"links" json DEFAULT '[]'::json,
	"created_at" timestamp (6) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"provider" varchar(50) NOT NULL,
	"name" varchar(100) NOT NULL,
	"encrypted_key" text NOT NULL,
	"masked_key" varchar(20) NOT NULL,
	"is_valid" boolean DEFAULT true NOT NULL,
	"last_validated" timestamp (6) with time zone,
	"last_used" timestamp (6) with time zone,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (6) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" DROP CONSTRAINT "users_api_key_unique";--> statement-breakpoint
DROP INDEX "idx_users_api_key";--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "deleted_at" timestamp (6) with time zone;--> statement-breakpoint
ALTER TABLE "executions" ADD COLUMN "trace_id" varchar(64);--> statement-breakpoint
ALTER TABLE "executions" ADD COLUMN "deleted_at" timestamp (6) with time zone;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "api_key_prefix" varchar(16);--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "deleted_at" timestamp (6) with time zone;--> statement-breakpoint
ALTER TABLE "telemetry_events" ADD COLUMN "agent_id" varchar(255);--> statement-breakpoint
ALTER TABLE "telemetry_events" ADD COLUMN "session_id" varchar(255);--> statement-breakpoint
ALTER TABLE "telemetry_events" ADD COLUMN "original_model" varchar(255);--> statement-breakpoint
ALTER TABLE "telemetry_events" ADD COLUMN "routed_model" varchar(255);--> statement-breakpoint
ALTER TABLE "telemetry_events" ADD COLUMN "fallback_used" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "telemetry_events" ADD COLUMN "provider_fallback" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "telemetry_events" ADD COLUMN "fallback_provider" varchar(50);--> statement-breakpoint
ALTER TABLE "telemetry_events" ADD COLUMN "quality_rating" varchar(10);--> statement-breakpoint
ALTER TABLE "telemetry_events" ADD COLUMN "cache_hit" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "telemetry_events" ADD COLUMN "cache_saved_usd" numeric(10, 6);--> statement-breakpoint
ALTER TABLE "telemetry_events" ADD COLUMN "compression_applied" boolean;--> statement-breakpoint
ALTER TABLE "telemetry_events" ADD COLUMN "original_tokens" integer;--> statement-breakpoint
ALTER TABLE "telemetry_events" ADD COLUMN "compressed_tokens" integer;--> statement-breakpoint
ALTER TABLE "telemetry_events" ADD COLUMN "tokens_saved" integer;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "api_key_hash" varchar(255) NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "deleted_at" timestamp (6) with time zone;--> statement-breakpoint
ALTER TABLE "alert_events" ADD CONSTRAINT "alert_events_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_events" ADD CONSTRAINT "alert_events_budget_id_client_budgets_id_fk" FOREIGN KEY ("budget_id") REFERENCES "public"."client_budgets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_rules" ADD CONSTRAINT "alert_rules_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_rules" ADD CONSTRAINT "alert_rules_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cache_settings" ADD CONSTRAINT "cache_settings_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_budgets" ADD CONSTRAINT "client_budgets_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_insights" ADD CONSTRAINT "client_insights_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "optimization_settings" ADD CONSTRAINT "optimization_settings_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prompt_compression_log" ADD CONSTRAINT "prompt_compression_log_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routing_rules" ADD CONSTRAINT "routing_rules_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "semantic_cache" ADD CONSTRAINT "semantic_cache_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spans" ADD CONSTRAINT "spans_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_api_keys" ADD CONSTRAINT "user_api_keys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_alert_events_client_id" ON "alert_events" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_alert_events_budget_id" ON "alert_events" USING btree ("budget_id");--> statement-breakpoint
CREATE INDEX "idx_alert_events_unique" ON "alert_events" USING btree ("budget_id","threshold","triggered_at");--> statement-breakpoint
CREATE INDEX "idx_alert_rules_client_id" ON "alert_rules" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_alert_rules_org_id" ON "alert_rules" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_alert_rules_enabled" ON "alert_rules" USING btree ("enabled");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_org" ON "audit_logs" USING btree ("organization_id","timestamp");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_user" ON "audit_logs" USING btree ("user_id","timestamp");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_entity" ON "audit_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_action" ON "audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "idx_backup_history_status" ON "backup_history" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_backup_history_started_at" ON "backup_history" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "idx_client_budgets_client_id" ON "client_budgets" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_client_budgets_type" ON "client_budgets" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_client_insights_client_id" ON "client_insights" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_client_insights_type" ON "client_insights" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_client_insights_client_type" ON "client_insights" USING btree ("client_id","type");--> statement-breakpoint
CREATE INDEX "idx_client_insights_created_at" ON "client_insights" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_clients_access_token" ON "clients" USING btree ("access_token");--> statement-breakpoint
CREATE INDEX "idx_clients_sdk_api_key" ON "clients" USING btree ("sdk_api_key");--> statement-breakpoint
CREATE INDEX "idx_clients_organization_id" ON "clients" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_platform_benchmarks_calculated_at" ON "platform_benchmarks" USING btree ("calculated_at");--> statement-breakpoint
CREATE INDEX "idx_compression_log_client_id" ON "prompt_compression_log" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_compression_log_created_at" ON "prompt_compression_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_compression_log_client_created" ON "prompt_compression_log" USING btree ("client_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_provider_health_provider" ON "provider_health" USING btree ("provider");--> statement-breakpoint
CREATE INDEX "idx_provider_health_status" ON "provider_health" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_routing_rules_client_id" ON "routing_rules" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_semantic_cache_client_hash" ON "semantic_cache" USING btree ("client_id","prompt_hash");--> statement-breakpoint
CREATE INDEX "idx_semantic_cache_client_id" ON "semantic_cache" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_semantic_cache_deterministic" ON "semantic_cache" USING btree ("is_deterministic");--> statement-breakpoint
CREATE INDEX "idx_spans_trace_id" ON "spans" USING btree ("trace_id");--> statement-breakpoint
CREATE INDEX "idx_spans_parent_id" ON "spans" USING btree ("parent_span_id");--> statement-breakpoint
CREATE INDEX "idx_spans_org_time" ON "spans" USING btree ("organization_id","start_time");--> statement-breakpoint
CREATE INDEX "idx_spans_kind" ON "spans" USING btree ("kind");--> statement-breakpoint
CREATE INDEX "idx_user_api_keys_user_id" ON "user_api_keys" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_user_api_keys_provider" ON "user_api_keys" USING btree ("provider");--> statement-breakpoint
CREATE INDEX "idx_user_api_keys_user_provider" ON "user_api_keys" USING btree ("user_id","provider");--> statement-breakpoint
CREATE INDEX "idx_agents_deleted_at" ON "agents" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "idx_executions_trace_id" ON "executions" USING btree ("trace_id");--> statement-breakpoint
CREATE INDEX "idx_executions_deleted_at" ON "executions" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "idx_organizations_api_key_prefix" ON "organizations" USING btree ("api_key_prefix");--> statement-breakpoint
CREATE INDEX "idx_organizations_deleted_at" ON "organizations" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "idx_telemetry_agent_id" ON "telemetry_events" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "idx_telemetry_session_id" ON "telemetry_events" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_telemetry_routed_model" ON "telemetry_events" USING btree ("routed_model");--> statement-breakpoint
CREATE INDEX "idx_users_api_key_hash" ON "users" USING btree ("api_key_hash");--> statement-breakpoint
CREATE INDEX "idx_users_deleted_at" ON "users" USING btree ("deleted_at");--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "api_key";--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_api_key_hash_unique" UNIQUE("api_key_hash");