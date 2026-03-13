-- Add environment field to distinguish dev/staging/production traces

ALTER TABLE telemetry_events
  ADD COLUMN IF NOT EXISTS environment VARCHAR(20) DEFAULT 'production';

ALTER TABLE agent_traces
  ADD COLUMN IF NOT EXISTS environment VARCHAR(20) DEFAULT 'production';

-- Index for filtering by environment in dashboard queries
CREATE INDEX IF NOT EXISTS idx_telemetry_environment
  ON telemetry_events (environment);

CREATE INDEX IF NOT EXISTS idx_agent_traces_environment
  ON agent_traces (environment);
