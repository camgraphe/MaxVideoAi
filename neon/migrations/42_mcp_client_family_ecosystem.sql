-- Extend privacy-safe MCP client attribution to the complete integration registry.
-- Existing rows and the historical `other` bucket remain unchanged.
ALTER TABLE mcp_audit_events
  DROP CONSTRAINT IF EXISTS mcp_audit_events_client_family_check;

ALTER TABLE mcp_audit_events
  ADD CONSTRAINT mcp_audit_events_client_family_check
  CHECK (client_family IS NULL OR client_family IN (
    'chatgpt', 'claude', 'codex', 'openclaw', 'n8n', 'cursor',
    'githubCopilot', 'geminiCli', 'microsoftCopilot', 'other'
  ));
