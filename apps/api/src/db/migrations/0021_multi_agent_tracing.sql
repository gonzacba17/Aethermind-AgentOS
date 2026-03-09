-- Add multi-agent tracing columns to telemetry_events
ALTER TABLE telemetry_events
  ADD COLUMN IF NOT EXISTS trace_id VARCHAR(64),
  ADD COLUMN IF NOT EXISTS agent_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS workflow_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS workflow_step INTEGER,
  ADD COLUMN IF NOT EXISTS parent_agent_id VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_telemetry_trace_id ON telemetry_events(trace_id);
CREATE INDEX IF NOT EXISTS idx_telemetry_workflow_id ON telemetry_events(workflow_id);

-- New agent_traces table
CREATE TABLE IF NOT EXISTS agent_traces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  trace_id VARCHAR(64) NOT NULL,
  agent_id VARCHAR(255) NOT NULL,
  agent_name VARCHAR(255),
  parent_agent_id VARCHAR(255),
  workflow_id VARCHAR(255),
  workflow_step INTEGER,
  model VARCHAR(255),
  provider VARCHAR(50),
  input_tokens INTEGER DEFAULT 0 NOT NULL,
  output_tokens INTEGER DEFAULT 0 NOT NULL,
  cost_usd DECIMAL(10,6) DEFAULT 0 NOT NULL,
  latency_ms INTEGER,
  status VARCHAR(20) DEFAULT 'success' NOT NULL,
  error TEXT,
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_agent_traces_trace_id ON agent_traces(organization_id, trace_id);
CREATE INDEX IF NOT EXISTS idx_agent_traces_workflow_id ON agent_traces(organization_id, workflow_id);
CREATE INDEX IF NOT EXISTS idx_agent_traces_agent_id ON agent_traces(organization_id, agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_traces_created_at ON agent_traces(created_at);
