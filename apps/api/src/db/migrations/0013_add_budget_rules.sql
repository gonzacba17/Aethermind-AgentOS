-- Migration: 0013_add_budget_rules
-- Description: Add tables for intelligent budget guards, scheduled tasks, and action rules
-- Sprint: 6 - Intelligent Budget Guards

-- ============================================
-- BUDGET GUARD RULES TABLE
-- Stores custom guard rules for fine-grained budget control
-- ============================================
CREATE TABLE IF NOT EXISTS budget_guard_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    budget_id UUID REFERENCES budgets(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    enabled BOOLEAN DEFAULT true NOT NULL,
    priority INTEGER DEFAULT 0 NOT NULL,

    -- Rule action
    action VARCHAR(50) NOT NULL CHECK (action IN ('allow', 'warn', 'throttle', 'downgrade_model', 'block', 'queue')),

    -- Conditions (stored as JSONB for flexibility)
    conditions JSONB NOT NULL DEFAULT '[]',

    -- Action configuration
    config JSONB NOT NULL DEFAULT '{}',

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Indexes for guard rules
CREATE INDEX IF NOT EXISTS idx_guard_rules_user_id ON budget_guard_rules(user_id);
CREATE INDEX IF NOT EXISTS idx_guard_rules_budget_id ON budget_guard_rules(budget_id);
CREATE INDEX IF NOT EXISTS idx_guard_rules_enabled ON budget_guard_rules(enabled);
CREATE INDEX IF NOT EXISTS idx_guard_rules_user_enabled ON budget_guard_rules(user_id, enabled);

-- ============================================
-- SCHEDULED BUDGET TASKS TABLE
-- Stores scheduled operations for budgets
-- ============================================
CREATE TABLE IF NOT EXISTS budget_scheduled_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    budget_id UUID NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    enabled BOOLEAN DEFAULT true NOT NULL,

    -- Schedule configuration
    schedule_type VARCHAR(20) NOT NULL CHECK (schedule_type IN ('once', 'daily', 'weekly', 'monthly', 'cron')),
    cron_expression VARCHAR(100),
    day_of_week INTEGER CHECK (day_of_week >= 0 AND day_of_week <= 6),
    day_of_month INTEGER CHECK (day_of_month >= 1 AND day_of_month <= 31),
    hour INTEGER DEFAULT 0 NOT NULL CHECK (hour >= 0 AND hour <= 23),
    minute INTEGER DEFAULT 0 NOT NULL CHECK (minute >= 0 AND minute <= 59),
    timezone VARCHAR(50) DEFAULT 'UTC' NOT NULL,

    -- Action configuration
    action VARCHAR(50) NOT NULL CHECK (action IN (
        'increase_limit', 'decrease_limit', 'set_limit',
        'reset_spend', 'pause_budget', 'resume_budget',
        'change_period', 'send_report'
    )),
    action_config JSONB NOT NULL DEFAULT '{}',

    -- Execution tracking
    last_run_at TIMESTAMP WITH TIME ZONE,
    next_run_at TIMESTAMP WITH TIME ZONE NOT NULL,
    run_count INTEGER DEFAULT 0 NOT NULL,
    max_runs INTEGER,
    failed_runs INTEGER DEFAULT 0 NOT NULL,
    last_error TEXT,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Indexes for scheduled tasks
CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_budget_id ON budget_scheduled_tasks(budget_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_enabled ON budget_scheduled_tasks(enabled);
CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_next_run ON budget_scheduled_tasks(next_run_at) WHERE enabled = true;
CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_schedule ON budget_scheduled_tasks(schedule_type, enabled);

-- ============================================
-- BUDGET ACTION RULES TABLE
-- Stores automatic action rules triggered by events
-- ============================================
CREATE TABLE IF NOT EXISTS budget_action_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    budget_id UUID REFERENCES budgets(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    enabled BOOLEAN DEFAULT true NOT NULL,
    priority INTEGER DEFAULT 0 NOT NULL,

    -- Trigger configuration
    trigger_type VARCHAR(50) NOT NULL CHECK (trigger_type IN (
        'threshold_reached', 'threshold_exceeded', 'anomaly_detected',
        'circuit_tripped', 'forecast_warning', 'manual', 'scheduled'
    )),

    -- Conditions (stored as JSONB)
    conditions JSONB NOT NULL DEFAULT '[]',

    -- Actions to execute (stored as JSONB array)
    actions JSONB NOT NULL DEFAULT '[]',

    -- Execution settings
    cooldown_minutes INTEGER DEFAULT 60 NOT NULL,
    max_executions_per_day INTEGER DEFAULT 10 NOT NULL,

    -- Execution tracking
    last_executed_at TIMESTAMP WITH TIME ZONE,
    execution_count INTEGER DEFAULT 0 NOT NULL,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Indexes for action rules
CREATE INDEX IF NOT EXISTS idx_action_rules_user_id ON budget_action_rules(user_id);
CREATE INDEX IF NOT EXISTS idx_action_rules_budget_id ON budget_action_rules(budget_id);
CREATE INDEX IF NOT EXISTS idx_action_rules_enabled ON budget_action_rules(enabled);
CREATE INDEX IF NOT EXISTS idx_action_rules_trigger ON budget_action_rules(trigger_type, enabled);
CREATE INDEX IF NOT EXISTS idx_action_rules_user_enabled ON budget_action_rules(user_id, enabled);

-- ============================================
-- CIRCUIT BREAKER STATE TABLE
-- Persists circuit breaker state across restarts
-- ============================================
CREATE TABLE IF NOT EXISTS budget_circuit_state (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    budget_id UUID NOT NULL REFERENCES budgets(id) ON DELETE CASCADE UNIQUE,

    -- Circuit state
    state VARCHAR(20) DEFAULT 'closed' NOT NULL CHECK (state IN ('closed', 'open', 'half_open')),
    trip_reason VARCHAR(50),
    tripped_at TIMESTAMP WITH TIME ZONE,

    -- Counters
    failure_count INTEGER DEFAULT 0 NOT NULL,
    success_count INTEGER DEFAULT 0 NOT NULL,
    half_open_success_count INTEGER DEFAULT 0 NOT NULL,
    half_open_attempts INTEGER DEFAULT 0 NOT NULL,

    -- Last attempt
    last_attempt_at TIMESTAMP WITH TIME ZONE,

    -- Metadata
    metadata JSONB DEFAULT '{}',

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Index for circuit state
CREATE INDEX IF NOT EXISTS idx_circuit_state_budget_id ON budget_circuit_state(budget_id);
CREATE INDEX IF NOT EXISTS idx_circuit_state_state ON budget_circuit_state(state);

-- ============================================
-- ACTION EXECUTION LOG TABLE
-- Tracks execution of automatic actions
-- ============================================
CREATE TABLE IF NOT EXISTS budget_action_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_id UUID NOT NULL REFERENCES budget_action_rules(id) ON DELETE CASCADE,
    budget_id UUID REFERENCES budgets(id) ON DELETE SET NULL,

    -- Execution details
    action_type VARCHAR(50) NOT NULL,
    trigger_type VARCHAR(50) NOT NULL,
    success BOOLEAN NOT NULL,
    message TEXT,
    error TEXT,

    -- Context snapshot
    context_snapshot JSONB,

    -- Timing
    executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    duration_ms INTEGER
);

-- Indexes for action log
CREATE INDEX IF NOT EXISTS idx_action_log_rule_id ON budget_action_log(rule_id);
CREATE INDEX IF NOT EXISTS idx_action_log_budget_id ON budget_action_log(budget_id);
CREATE INDEX IF NOT EXISTS idx_action_log_executed_at ON budget_action_log(executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_action_log_success ON budget_action_log(success, executed_at DESC);

-- ============================================
-- FORECAST CACHE TABLE
-- Caches forecast results for performance
-- ============================================
CREATE TABLE IF NOT EXISTS budget_forecast_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Cache metadata
    cache_key VARCHAR(255) NOT NULL,
    horizon_days INTEGER NOT NULL,
    period_type VARCHAR(20) NOT NULL,

    -- Forecast data
    forecast_data JSONB NOT NULL,

    -- Validity
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,

    UNIQUE(organization_id, cache_key)
);

-- Indexes for forecast cache
CREATE INDEX IF NOT EXISTS idx_forecast_cache_org_id ON budget_forecast_cache(organization_id);
CREATE INDEX IF NOT EXISTS idx_forecast_cache_expires ON budget_forecast_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_forecast_cache_key ON budget_forecast_cache(organization_id, cache_key);

-- ============================================
-- PREDICTIVE ALERTS TABLE
-- Stores predictive alerts generated by ML system
-- ============================================
CREATE TABLE IF NOT EXISTS predictive_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    budget_id UUID REFERENCES budgets(id) ON DELETE SET NULL,
    user_id TEXT REFERENCES users(id) ON DELETE SET NULL,

    -- Alert info
    alert_type VARCHAR(50) NOT NULL,
    priority VARCHAR(20) NOT NULL CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    details JSONB DEFAULT '{}',

    -- Delivery
    channels TEXT[] DEFAULT ARRAY['in_app'],
    delivered BOOLEAN DEFAULT false NOT NULL,
    delivery_errors TEXT[],

    -- Lifecycle
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    action_taken TEXT
);

-- Indexes for predictive alerts
CREATE INDEX IF NOT EXISTS idx_predictive_alerts_org_id ON predictive_alerts(organization_id);
CREATE INDEX IF NOT EXISTS idx_predictive_alerts_budget_id ON predictive_alerts(budget_id);
CREATE INDEX IF NOT EXISTS idx_predictive_alerts_priority ON predictive_alerts(priority, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_predictive_alerts_active ON predictive_alerts(organization_id, expires_at)
    WHERE acknowledged_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_predictive_alerts_type ON predictive_alerts(alert_type, created_at DESC);

-- ============================================
-- ADD NEW COLUMNS TO EXISTING BUDGETS TABLE
-- ============================================
-- Add guard configuration to budgets
ALTER TABLE budgets ADD COLUMN IF NOT EXISTS guard_config JSONB DEFAULT '{}';

-- Add circuit breaker reference
ALTER TABLE budgets ADD COLUMN IF NOT EXISTS circuit_breaker_enabled BOOLEAN DEFAULT true;

-- Add forecast settings
ALTER TABLE budgets ADD COLUMN IF NOT EXISTS forecast_enabled BOOLEAN DEFAULT true;
ALTER TABLE budgets ADD COLUMN IF NOT EXISTS forecast_horizon_days INTEGER DEFAULT 7;

-- ============================================
-- UPDATE TRIGGERS
-- ============================================
-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers to new tables
DROP TRIGGER IF EXISTS update_budget_guard_rules_updated_at ON budget_guard_rules;
CREATE TRIGGER update_budget_guard_rules_updated_at
    BEFORE UPDATE ON budget_guard_rules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_budget_scheduled_tasks_updated_at ON budget_scheduled_tasks;
CREATE TRIGGER update_budget_scheduled_tasks_updated_at
    BEFORE UPDATE ON budget_scheduled_tasks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_budget_action_rules_updated_at ON budget_action_rules;
CREATE TRIGGER update_budget_action_rules_updated_at
    BEFORE UPDATE ON budget_action_rules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_budget_circuit_state_updated_at ON budget_circuit_state;
CREATE TRIGGER update_budget_circuit_state_updated_at
    BEFORE UPDATE ON budget_circuit_state
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON TABLE budget_guard_rules IS 'Custom guard rules for fine-grained budget control';
COMMENT ON TABLE budget_scheduled_tasks IS 'Scheduled operations for budget management';
COMMENT ON TABLE budget_action_rules IS 'Automatic action rules triggered by budget events';
COMMENT ON TABLE budget_circuit_state IS 'Circuit breaker state persistence';
COMMENT ON TABLE budget_action_log IS 'Execution log for automatic budget actions';
COMMENT ON TABLE budget_forecast_cache IS 'Cache for ML-based cost forecasts';
COMMENT ON TABLE predictive_alerts IS 'Predictive alerts generated by ML analysis';
