-- Migration: Add Soft Deletes and Table Partitioning
-- Created: 2024-02-02
-- Description: Adds deletedAt columns for soft deletes and prepares for table partitioning

-- ============================================
-- SOFT DELETES - Add deletedAt columns
-- ============================================

-- Organizations
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_organizations_deleted_at ON organizations(deleted_at) WHERE deleted_at IS NULL;

-- Users
ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON users(deleted_at) WHERE deleted_at IS NULL;

-- Agents
ALTER TABLE agents ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_agents_deleted_at ON agents(deleted_at) WHERE deleted_at IS NULL;

-- Executions
ALTER TABLE executions ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_executions_deleted_at ON executions(deleted_at) WHERE deleted_at IS NULL;

-- Budgets
ALTER TABLE budgets ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_budgets_deleted_at ON budgets(deleted_at) WHERE deleted_at IS NULL;

-- Workflows
ALTER TABLE workflows ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_workflows_deleted_at ON workflows(deleted_at) WHERE deleted_at IS NULL;

-- ============================================
-- PARTITIONING PREPARATION
-- For tables that will grow large (telemetry_events, logs, costs)
-- ============================================

-- Create partitioned telemetry events table (new)
CREATE TABLE IF NOT EXISTS telemetry_events_partitioned (
    id UUID DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL,
    provider VARCHAR(50) NOT NULL,
    model VARCHAR(255) NOT NULL,
    prompt_tokens INTEGER NOT NULL,
    completion_tokens INTEGER NOT NULL,
    total_tokens INTEGER NOT NULL,
    cost DECIMAL(10, 6) NOT NULL,
    latency INTEGER NOT NULL,
    status VARCHAR(20) NOT NULL,
    error TEXT,
    trace_id VARCHAR(64),
    span_id VARCHAR(32),
    user_id TEXT,
    agent_id UUID,
    session_id VARCHAR(64),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    PRIMARY KEY (id, timestamp)
) PARTITION BY RANGE (timestamp);

-- Create monthly partitions for telemetry (next 12 months)
DO $$
DECLARE
    start_date DATE := DATE_TRUNC('month', CURRENT_DATE);
    partition_date DATE;
    partition_name TEXT;
    partition_start TEXT;
    partition_end TEXT;
BEGIN
    FOR i IN 0..11 LOOP
        partition_date := start_date + (i || ' months')::INTERVAL;
        partition_name := 'telemetry_events_y' || TO_CHAR(partition_date, 'YYYY') || 'm' || TO_CHAR(partition_date, 'MM');
        partition_start := TO_CHAR(partition_date, 'YYYY-MM-DD');
        partition_end := TO_CHAR(partition_date + '1 month'::INTERVAL, 'YYYY-MM-DD');

        EXECUTE format(
            'CREATE TABLE IF NOT EXISTS %I PARTITION OF telemetry_events_partitioned
             FOR VALUES FROM (%L) TO (%L)',
            partition_name, partition_start, partition_end
        );
    END LOOP;
END $$;

-- Create default partition for data outside range
CREATE TABLE IF NOT EXISTS telemetry_events_default
    PARTITION OF telemetry_events_partitioned DEFAULT;

-- Indexes for partitioned table
CREATE INDEX IF NOT EXISTS idx_telemetry_part_org_time
    ON telemetry_events_partitioned(organization_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_telemetry_part_provider_model
    ON telemetry_events_partitioned(provider, model);
CREATE INDEX IF NOT EXISTS idx_telemetry_part_status
    ON telemetry_events_partitioned(status);
CREATE INDEX IF NOT EXISTS idx_telemetry_part_trace
    ON telemetry_events_partitioned(trace_id) WHERE trace_id IS NOT NULL;

-- ============================================
-- LOGS PARTITIONED TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS logs_partitioned (
    id UUID DEFAULT gen_random_uuid(),
    execution_id UUID,
    agent_id UUID,
    organization_id UUID,
    level VARCHAR(20) NOT NULL,
    message TEXT NOT NULL,
    metadata JSONB,
    timestamp TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    PRIMARY KEY (id, timestamp)
) PARTITION BY RANGE (timestamp);

-- Create monthly partitions for logs
DO $$
DECLARE
    start_date DATE := DATE_TRUNC('month', CURRENT_DATE);
    partition_date DATE;
    partition_name TEXT;
    partition_start TEXT;
    partition_end TEXT;
BEGIN
    FOR i IN 0..11 LOOP
        partition_date := start_date + (i || ' months')::INTERVAL;
        partition_name := 'logs_y' || TO_CHAR(partition_date, 'YYYY') || 'm' || TO_CHAR(partition_date, 'MM');
        partition_start := TO_CHAR(partition_date, 'YYYY-MM-DD');
        partition_end := TO_CHAR(partition_date + '1 month'::INTERVAL, 'YYYY-MM-DD');

        EXECUTE format(
            'CREATE TABLE IF NOT EXISTS %I PARTITION OF logs_partitioned
             FOR VALUES FROM (%L) TO (%L)',
            partition_name, partition_start, partition_end
        );
    END LOOP;
END $$;

CREATE TABLE IF NOT EXISTS logs_default PARTITION OF logs_partitioned DEFAULT;

CREATE INDEX IF NOT EXISTS idx_logs_part_exec_time
    ON logs_partitioned(execution_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_logs_part_agent_time
    ON logs_partitioned(agent_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_logs_part_level
    ON logs_partitioned(level);

-- ============================================
-- SPANS TABLE (for distributed tracing)
-- ============================================
CREATE TABLE IF NOT EXISTS spans (
    id UUID DEFAULT gen_random_uuid(),
    trace_id VARCHAR(64) NOT NULL,
    span_id VARCHAR(32) NOT NULL,
    parent_span_id VARCHAR(32),
    organization_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    kind VARCHAR(50) NOT NULL, -- 'llm', 'tool', 'chain', 'agent', 'internal'
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ,
    duration_ms INTEGER,
    status VARCHAR(20) NOT NULL DEFAULT 'ok', -- 'ok', 'error', 'unset'
    status_message TEXT,
    attributes JSONB DEFAULT '{}',
    events JSONB DEFAULT '[]',
    links JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_spans_trace_id ON spans(trace_id);
CREATE INDEX IF NOT EXISTS idx_spans_parent_id ON spans(parent_span_id) WHERE parent_span_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_spans_org_time ON spans(organization_id, start_time);
CREATE INDEX IF NOT EXISTS idx_spans_kind ON spans(kind);

-- ============================================
-- DATA RETENTION POLICY (function for cleanup)
-- ============================================
CREATE OR REPLACE FUNCTION cleanup_old_partitions(
    table_prefix TEXT,
    retention_months INTEGER DEFAULT 6
) RETURNS INTEGER AS $$
DECLARE
    partition_name TEXT;
    cutoff_date DATE := CURRENT_DATE - (retention_months || ' months')::INTERVAL;
    dropped_count INTEGER := 0;
BEGIN
    FOR partition_name IN
        SELECT tablename
        FROM pg_tables
        WHERE tablename LIKE table_prefix || '_y%m%'
        AND tablename NOT LIKE '%default%'
    LOOP
        -- Extract date from partition name and check if older than cutoff
        IF partition_name ~ '_y[0-9]{4}m[0-9]{2}$' THEN
            DECLARE
                part_year INTEGER := SUBSTRING(partition_name FROM '_y([0-9]{4})m')::INTEGER;
                part_month INTEGER := SUBSTRING(partition_name FROM 'm([0-9]{2})$')::INTEGER;
                part_date DATE := make_date(part_year, part_month, 1);
            BEGIN
                IF part_date < cutoff_date THEN
                    EXECUTE format('DROP TABLE IF EXISTS %I', partition_name);
                    dropped_count := dropped_count + 1;
                    RAISE NOTICE 'Dropped partition: %', partition_name;
                END IF;
            END;
        END IF;
    END LOOP;

    RETURN dropped_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- AUDIT LOG TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID,
    user_id TEXT,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(255),
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    timestamp TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_org ON audit_logs(organization_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);

-- ============================================
-- MATERIALIZED VIEW FOR DAILY COST AGGREGATES
-- ============================================
CREATE MATERIALIZED VIEW IF NOT EXISTS daily_cost_summary AS
SELECT
    organization_id,
    DATE_TRUNC('day', timestamp) AS day,
    provider,
    model,
    COUNT(*) AS request_count,
    SUM(prompt_tokens) AS total_prompt_tokens,
    SUM(completion_tokens) AS total_completion_tokens,
    SUM(total_tokens) AS total_tokens,
    SUM(cost) AS total_cost,
    AVG(latency) AS avg_latency,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency) AS p95_latency,
    COUNT(*) FILTER (WHERE status = 'error') AS error_count
FROM telemetry_events
GROUP BY organization_id, DATE_TRUNC('day', timestamp), provider, model;

CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_cost_summary_unique
    ON daily_cost_summary(organization_id, day, provider, model);

-- Function to refresh materialized view
CREATE OR REPLACE FUNCTION refresh_daily_cost_summary()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY daily_cost_summary;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- BUDGET ALERTS TRIGGER
-- ============================================
CREATE OR REPLACE FUNCTION check_budget_threshold()
RETURNS TRIGGER AS $$
DECLARE
    budget_record RECORD;
    spend_percentage DECIMAL;
BEGIN
    -- Find relevant budgets for this organization
    FOR budget_record IN
        SELECT * FROM budgets
        WHERE status = 'active'
        AND (
            (scope = 'organization' AND scope_id = NEW.organization_id::TEXT)
            OR scope = 'global'
        )
    LOOP
        spend_percentage := (budget_record.current_spend / budget_record.limit_amount) * 100;

        -- Check 80% threshold
        IF spend_percentage >= 80 AND NOT budget_record.alert_80_sent THEN
            UPDATE budgets SET alert_80_sent = true WHERE id = budget_record.id;
            -- Insert alert log (actual notification handled by application)
            INSERT INTO alert_logs (budget_id, alert_type, channel, recipient, message)
            VALUES (budget_record.id, 'warning_80', 'system', 'system',
                    'Budget ' || budget_record.name || ' reached 80% threshold');
        END IF;

        -- Check 100% threshold
        IF spend_percentage >= 100 AND NOT budget_record.alert_100_sent THEN
            UPDATE budgets SET alert_100_sent = true WHERE id = budget_record.id;
            INSERT INTO alert_logs (budget_id, alert_type, channel, recipient, message)
            VALUES (budget_record.id, 'critical_100', 'system', 'system',
                    'Budget ' || budget_record.name || ' exceeded 100%');
        END IF;
    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Note: Trigger would be created on telemetry_events if needed
-- CREATE TRIGGER check_budget_after_telemetry
-- AFTER INSERT ON telemetry_events
-- FOR EACH ROW EXECUTE FUNCTION check_budget_threshold();
