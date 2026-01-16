CREATE TABLE "agents" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" varchar(255) NOT NULL,
	"model" varchar(255) NOT NULL,
	"config" json DEFAULT '{}'::json NOT NULL,
	"created_at" timestamp (6) with time zone DEFAULT now(),
	"updated_at" timestamp (6) with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "alert_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"budget_id" uuid NOT NULL,
	"alert_type" varchar(50) NOT NULL,
	"channel" varchar(50) NOT NULL,
	"recipient" varchar(255) NOT NULL,
	"message" text NOT NULL,
	"sent_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
	"success" boolean DEFAULT true NOT NULL,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "budgets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" varchar(255) NOT NULL,
	"limit_amount" numeric(10, 2) NOT NULL,
	"period" varchar(20) NOT NULL,
	"scope" varchar(50) NOT NULL,
	"scope_id" varchar(255),
	"current_spend" numeric(10, 6) DEFAULT '0' NOT NULL,
	"hard_limit" boolean DEFAULT true NOT NULL,
	"alert_at" integer DEFAULT 80 NOT NULL,
	"alert_80_sent" boolean DEFAULT false NOT NULL,
	"alert_100_sent" boolean DEFAULT false NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"created_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (6) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "costs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"execution_id" uuid,
	"model" varchar(255) NOT NULL,
	"prompt_tokens" integer DEFAULT 0 NOT NULL,
	"completion_tokens" integer DEFAULT 0 NOT NULL,
	"total_tokens" integer DEFAULT 0 NOT NULL,
	"cost" numeric(10, 6) DEFAULT '0' NOT NULL,
	"currency" varchar(10) DEFAULT 'USD',
	"created_at" timestamp (6) with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "executions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"agent_id" uuid,
	"status" varchar(50) NOT NULL,
	"input" json,
	"output" json,
	"error" text,
	"started_at" timestamp (6) with time zone DEFAULT now(),
	"completed_at" timestamp (6) with time zone,
	"duration_ms" integer
);
--> statement-breakpoint
CREATE TABLE "logs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"execution_id" uuid,
	"agent_id" uuid,
	"level" varchar(20) NOT NULL,
	"message" text NOT NULL,
	"metadata" json,
	"timestamp" timestamp (6) with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"api_key_hash" varchar(255) NOT NULL,
	"plan" varchar(50) DEFAULT 'FREE' NOT NULL,
	"rate_limit_per_min" integer DEFAULT 100 NOT NULL,
	"created_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organizations_slug_unique" UNIQUE("slug"),
	CONSTRAINT "organizations_api_key_hash_unique" UNIQUE("api_key_hash")
);
--> statement-breakpoint
CREATE TABLE "subscription_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"event" varchar(100) NOT NULL,
	"metadata" json,
	"timestamp" timestamp (6) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "telemetry_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"timestamp" timestamp (6) with time zone NOT NULL,
	"provider" varchar(50) NOT NULL,
	"model" varchar(255) NOT NULL,
	"prompt_tokens" integer NOT NULL,
	"completion_tokens" integer NOT NULL,
	"total_tokens" integer NOT NULL,
	"cost" numeric(10, 6) NOT NULL,
	"latency" integer NOT NULL,
	"status" varchar(20) NOT NULL,
	"error" text,
	"created_at" timestamp (6) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "traces" (
	"id" uuid PRIMARY KEY NOT NULL,
	"execution_id" uuid,
	"tree_data" json NOT NULL,
	"metadata" json,
	"created_at" timestamp (6) with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" varchar(255),
	"name" varchar(255),
	"google_id" varchar(255),
	"github_id" varchar(255),
	"api_key" varchar(255) NOT NULL,
	"plan" varchar(50) DEFAULT 'free' NOT NULL,
	"usage_limit" integer DEFAULT 100 NOT NULL,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"stripe_customer_id" varchar(255),
	"stripe_subscription_id" varchar(255),
	"email_verified" boolean DEFAULT false NOT NULL,
	"verification_token" varchar(255),
	"verification_expiry" timestamp (6) with time zone,
	"reset_token" varchar(255),
	"reset_token_expiry" timestamp (6) with time zone,
	"organization_id" uuid,
	"created_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
	"has_completed_onboarding" boolean DEFAULT false NOT NULL,
	"onboarding_step" varchar(50) DEFAULT 'welcome',
	"trial_started_at" timestamp (6) with time zone,
	"trial_ends_at" timestamp (6) with time zone,
	"subscription_status" varchar(50) DEFAULT 'free' NOT NULL,
	"last_login_at" timestamp (6) with time zone,
	"first_login_at" timestamp (6) with time zone,
	"max_agents" integer DEFAULT 3 NOT NULL,
	"log_retention_days" integer DEFAULT 30 NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_google_id_unique" UNIQUE("google_id"),
	CONSTRAINT "users_github_id_unique" UNIQUE("github_id"),
	CONSTRAINT "users_api_key_unique" UNIQUE("api_key"),
	CONSTRAINT "users_stripe_customer_id_unique" UNIQUE("stripe_customer_id")
);
--> statement-breakpoint
CREATE TABLE "workflows" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"definition" json NOT NULL,
	"created_at" timestamp (6) with time zone DEFAULT now(),
	"updated_at" timestamp (6) with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "agents" ADD CONSTRAINT "agents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "costs" ADD CONSTRAINT "costs_execution_id_executions_id_fk" FOREIGN KEY ("execution_id") REFERENCES "public"."executions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "executions" ADD CONSTRAINT "executions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "executions" ADD CONSTRAINT "executions_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logs" ADD CONSTRAINT "logs_execution_id_executions_id_fk" FOREIGN KEY ("execution_id") REFERENCES "public"."executions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logs" ADD CONSTRAINT "logs_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_logs" ADD CONSTRAINT "subscription_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "telemetry_events" ADD CONSTRAINT "telemetry_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "traces" ADD CONSTRAINT "traces_execution_id_executions_id_fk" FOREIGN KEY ("execution_id") REFERENCES "public"."executions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_agents_user_id" ON "agents" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_alert_logs_budget_id" ON "alert_logs" USING btree ("budget_id");--> statement-breakpoint
CREATE INDEX "idx_alert_logs_sent_at" ON "alert_logs" USING btree ("sent_at");--> statement-breakpoint
CREATE INDEX "idx_budgets_user_id" ON "budgets" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_budgets_status" ON "budgets" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_budgets_scope" ON "budgets" USING btree ("scope","scope_id");--> statement-breakpoint
CREATE INDEX "idx_costs_execution_id" ON "costs" USING btree ("execution_id");--> statement-breakpoint
CREATE INDEX "idx_costs_model" ON "costs" USING btree ("model");--> statement-breakpoint
CREATE INDEX "idx_costs_created_at" ON "costs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_costs_model_date" ON "costs" USING btree ("model","created_at");--> statement-breakpoint
CREATE INDEX "idx_executions_user_id" ON "executions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_executions_agent_id" ON "executions" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "idx_executions_status" ON "executions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_executions_started_at" ON "executions" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "idx_executions_agent_status" ON "executions" USING btree ("agent_id","status");--> statement-breakpoint
CREATE INDEX "idx_logs_execution_id" ON "logs" USING btree ("execution_id");--> statement-breakpoint
CREATE INDEX "idx_logs_agent_id" ON "logs" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "idx_logs_timestamp" ON "logs" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "idx_logs_level" ON "logs" USING btree ("level");--> statement-breakpoint
CREATE INDEX "idx_logs_exec_time" ON "logs" USING btree ("execution_id","timestamp");--> statement-breakpoint
CREATE INDEX "idx_logs_agent_timestamp" ON "logs" USING btree ("agent_id","timestamp");--> statement-breakpoint
CREATE INDEX "idx_organizations_api_key" ON "organizations" USING btree ("api_key_hash");--> statement-breakpoint
CREATE INDEX "idx_organizations_plan" ON "organizations" USING btree ("plan");--> statement-breakpoint
CREATE INDEX "idx_subscription_logs_user_id" ON "subscription_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_subscription_logs_timestamp" ON "subscription_logs" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "idx_subscription_logs_event" ON "subscription_logs" USING btree ("event");--> statement-breakpoint
CREATE INDEX "idx_telemetry_org_time" ON "telemetry_events" USING btree ("organization_id","timestamp");--> statement-breakpoint
CREATE INDEX "idx_telemetry_provider_model" ON "telemetry_events" USING btree ("provider","model");--> statement-breakpoint
CREATE INDEX "idx_telemetry_status" ON "telemetry_events" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_telemetry_created_at" ON "telemetry_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_traces_execution_id" ON "traces" USING btree ("execution_id");--> statement-breakpoint
CREATE INDEX "idx_users_email" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_users_api_key" ON "users" USING btree ("api_key");--> statement-breakpoint
CREATE INDEX "idx_users_plan" ON "users" USING btree ("plan");--> statement-breakpoint
CREATE INDEX "idx_users_google_id" ON "users" USING btree ("google_id");--> statement-breakpoint
CREATE INDEX "idx_users_github_id" ON "users" USING btree ("github_id");--> statement-breakpoint
CREATE INDEX "idx_users_organization_id" ON "users" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_workflows_user_id" ON "workflows" USING btree ("user_id");