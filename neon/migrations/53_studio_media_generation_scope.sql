-- Explicitly apply after 49, before enabling Studio video or Audio adapters.
-- Preserve OAuth identities and immutable session/project origin; extend only the media surfaces.
ALTER TABLE mcp_generation_quotes DROP CONSTRAINT IF EXISTS generation_quote_origin_scope;
ALTER TABLE mcp_generation_quotes ADD CONSTRAINT generation_quote_origin_scope CHECK ((
  (auth_origin = 'oauth' AND studio_project_id IS NULL)
  OR (auth_origin = 'studio-session' AND oauth_client_id IS NULL
      AND funding_mode = 'wallet' AND request_json->>'surface' IN ('image','video','audio')
      AND length(studio_project_id) BETWEEN 1 AND 128
      AND studio_project_id = btrim(studio_project_id))
) IS TRUE);
