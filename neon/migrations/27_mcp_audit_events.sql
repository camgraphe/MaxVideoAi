CREATE TABLE IF NOT EXISTS mcp_audit_events (
  id BIGSERIAL PRIMARY KEY,
  event_type TEXT NOT NULL,
  user_id TEXT NOT NULL,
  oauth_client_id TEXT,
  tool_name TEXT,
  outcome TEXT NOT NULL CHECK (outcome IN ('success', 'failure')),
  surface TEXT CHECK (surface IS NULL OR surface IN ('video', 'image')),
  engine_id TEXT,
  error_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS mcp_audit_events_user_created_idx
  ON mcp_audit_events (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS mcp_audit_events_type_created_idx
  ON mcp_audit_events (event_type, created_at DESC);
