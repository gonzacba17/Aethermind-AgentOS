-- Migration: add_budgets_and_alerts
-- Created: 2025-12-16
-- Description: Add Budget and AlertLog tables for FinOps functionality

-- Create budgets table
CREATE TABLE IF NOT EXISTS budgets (
    id UUID PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    limit_amount DECIMAL(10, 2) NOT NULL,
    period VARCHAR(20) NOT NULL,
    scope VARCHAR(50) NOT NULL,
    scope_id VARCHAR(255),
    current_spend DECIMAL(10, 6) NOT NULL DEFAULT 0,
    hard_limit BOOLEAN NOT NULL DEFAULT true,
    alert_at INTEGER NOT NULL DEFAULT 80,
    alert_80_sent BOOLEAN NOT NULL DEFAULT false,
    alert_100_sent BOOLEAN NOT NULL DEFAULT false,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_budgets_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create indexes for budgets
CREATE INDEX IF NOT EXISTS idx_budgets_user_id ON budgets(user_id);
CREATE INDEX IF NOT EXISTS idx_budgets_status ON budgets(status);
CREATE INDEX IF NOT EXISTS idx_budgets_scope ON budgets(scope, scope_id);

-- Create alert_logs table
CREATE TABLE IF NOT EXISTS alert_logs (
    id UUID PRIMARY KEY,
    budget_id UUID NOT NULL,
    alert_type VARCHAR(50) NOT NULL,
    channel VARCHAR(50) NOT NULL,
    recipient VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    sent_at TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
    success BOOLEAN NOT NULL DEFAULT true,
    error TEXT
);

-- Create indexes for alert_logs
CREATE INDEX IF NOT EXISTS idx_alert_logs_budget_id ON alert_logs(budget_id);
CREATE INDEX IF NOT EXISTS idx_alert_logs_sent_at ON alert_logs(sent_at);

-- Verify tables were created
SELECT 
    table_name, 
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public' 
AND table_name IN ('budgets', 'alert_logs')
ORDER BY table_name;
