-- Add user_api_keys table for storing encrypted API keys
CREATE TABLE IF NOT EXISTS "user_api_keys" (
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
ALTER TABLE "user_api_keys" ADD CONSTRAINT "user_api_keys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_user_api_keys_user_id" ON "user_api_keys" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_user_api_keys_provider" ON "user_api_keys" USING btree ("provider");--> statement-breakpoint
CREATE INDEX "idx_user_api_keys_user_provider" ON "user_api_keys" USING btree ("user_id","provider");
