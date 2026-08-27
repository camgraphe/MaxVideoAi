ALTER TABLE mcp_generation_quotes
  DROP CONSTRAINT IF EXISTS mcp_generation_quotes_lifetime;

ALTER TABLE mcp_generation_quotes
  ADD CONSTRAINT mcp_generation_quotes_lifetime CHECK (
    (
      expires_at = created_at + INTERVAL '10 minutes'
      OR expires_at = created_at + INTERVAL '45 minutes'
    ) IS TRUE
  );

COMMENT ON CONSTRAINT mcp_generation_quotes_lifetime ON mcp_generation_quotes IS
  'New MCP quotes use a 45-minute confirmation window. The 10-minute form remains valid for immutable historical quotes created before migration 39.';
