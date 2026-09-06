-- Coarse self-reported MCP application family; no raw client metadata is retained.
ALTER TABLE mcp_audit_events ADD COLUMN IF NOT EXISTS client_family TEXT
  CHECK (client_family IS NULL OR client_family IN ('chatgpt', 'claude', 'codex', 'other'));
