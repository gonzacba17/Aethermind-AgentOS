-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "api_key" VARCHAR(255) NOT NULL,
    "plan" VARCHAR(50) NOT NULL DEFAULT 'free',
    "usage_limit" INTEGER NOT NULL DEFAULT 100,
    "usage_count" INTEGER NOT NULL DEFAULT 0,
    "stripe_customer_id" VARCHAR(255),
    "stripe_subscription_id" VARCHAR(255),
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "verification_token" VARCHAR(255),
    "reset_token" VARCHAR(255),
    "reset_token_expiry" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agents" (
    "id" UUID NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "model" VARCHAR(255) NOT NULL,
    "config" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "executions" (
    "id" UUID NOT NULL,
    "user_id" TEXT NOT NULL,
    "agent_id" UUID,
    "status" VARCHAR(50) NOT NULL,
    "input" JSONB,
    "output" JSONB,
    "error" TEXT,
    "started_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(6),
    "duration_ms" INTEGER,

    CONSTRAINT "executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "logs" (
    "id" UUID NOT NULL,
    "execution_id" UUID,
    "agent_id" UUID,
    "level" VARCHAR(20) NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "timestamp" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "traces" (
    "id" UUID NOT NULL,
    "execution_id" UUID,
    "tree_data" JSONB NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "traces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "costs" (
    "id" UUID NOT NULL,
    "execution_id" UUID,
    "model" VARCHAR(255) NOT NULL,
    "prompt_tokens" INTEGER NOT NULL DEFAULT 0,
    "completion_tokens" INTEGER NOT NULL DEFAULT 0,
    "total_tokens" INTEGER NOT NULL DEFAULT 0,
    "cost" DECIMAL(10,6) NOT NULL DEFAULT 0,
    "currency" VARCHAR(10) DEFAULT 'USD',
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "costs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflows" (
    "id" UUID NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "definition" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflows_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_api_key_key" ON "users"("api_key");

-- CreateIndex
CREATE UNIQUE INDEX "users_stripe_customer_id_key" ON "users"("stripe_customer_id");

-- CreateIndex
CREATE INDEX "idx_users_email" ON "users"("email");

-- CreateIndex
CREATE INDEX "idx_users_api_key" ON "users"("api_key");

-- CreateIndex
CREATE INDEX "idx_users_plan" ON "users"("plan");

-- CreateIndex
CREATE INDEX "idx_agents_user_id" ON "agents"("user_id");

-- CreateIndex
CREATE INDEX "idx_executions_user_id" ON "executions"("user_id");

-- CreateIndex
CREATE INDEX "idx_executions_agent_id" ON "executions"("agent_id");

-- CreateIndex
CREATE INDEX "idx_executions_status" ON "executions"("status");

-- CreateIndex
CREATE INDEX "idx_executions_started_at" ON "executions"("started_at");

-- CreateIndex
CREATE INDEX "idx_executions_agent_status" ON "executions"("agent_id", "status");

-- CreateIndex
CREATE INDEX "idx_logs_execution_id" ON "logs"("execution_id");

-- CreateIndex
CREATE INDEX "idx_logs_agent_id" ON "logs"("agent_id");

-- CreateIndex
CREATE INDEX "idx_logs_timestamp" ON "logs"("timestamp");

-- CreateIndex
CREATE INDEX "idx_logs_level" ON "logs"("level");

-- CreateIndex
CREATE INDEX "idx_logs_exec_time" ON "logs"("execution_id", "timestamp");

-- CreateIndex
CREATE INDEX "idx_logs_composite" ON "logs"("execution_id", "timestamp" DESC, "level");

-- CreateIndex
CREATE INDEX "idx_logs_agent_timestamp" ON "logs"("agent_id", "timestamp" DESC);

-- CreateIndex
CREATE INDEX "idx_traces_execution_id" ON "traces"("execution_id");

-- CreateIndex
CREATE INDEX "idx_costs_execution_id" ON "costs"("execution_id");

-- CreateIndex
CREATE INDEX "idx_costs_model" ON "costs"("model");

-- CreateIndex
CREATE INDEX "idx_costs_created_at" ON "costs"("created_at");

-- CreateIndex
CREATE INDEX "idx_costs_model_date" ON "costs"("model", "created_at");

-- CreateIndex
CREATE INDEX "idx_workflows_user_id" ON "workflows"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "idx_workflows_user_name" ON "workflows"("user_id", "name");

-- AddForeignKey
ALTER TABLE "agents" ADD CONSTRAINT "agents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "executions" ADD CONSTRAINT "executions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "executions" ADD CONSTRAINT "executions_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "logs" ADD CONSTRAINT "logs_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "logs" ADD CONSTRAINT "logs_execution_id_fkey" FOREIGN KEY ("execution_id") REFERENCES "executions"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "traces" ADD CONSTRAINT "traces_execution_id_fkey" FOREIGN KEY ("execution_id") REFERENCES "executions"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "costs" ADD CONSTRAINT "costs_execution_id_fkey" FOREIGN KEY ("execution_id") REFERENCES "executions"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
