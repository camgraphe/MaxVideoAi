-- Apply explicitly after 53. This migration does not activate any tool.
-- Toolbox sessions are never inferred from null OAuth clients or Studio projects.
ALTER TABLE mcp_generation_quotes DROP CONSTRAINT IF EXISTS generation_quote_origin_scope;
ALTER TABLE mcp_generation_quotes ADD CONSTRAINT generation_quote_origin_scope CHECK ((
  (auth_origin = 'oauth' AND studio_project_id IS NULL)
  OR (auth_origin = 'studio-session' AND oauth_client_id IS NULL
      AND funding_mode = 'wallet' AND request_json->>'surface' IN ('image','video','audio')
      AND length(studio_project_id) BETWEEN 1 AND 128
      AND studio_project_id = btrim(studio_project_id))
  OR (auth_origin = 'toolbox-session' AND oauth_client_id IS NULL
      AND studio_project_id IS NULL AND funding_mode = 'wallet'
      AND request_json->>'surface' IN ('image','video'))
) IS TRUE);

COMMENT ON COLUMN mcp_generation_quotes.auth_origin IS
  'Immutable server-authorized OAuth, Studio project or Toolbox session scope. Historical rows remain OAuth.';
