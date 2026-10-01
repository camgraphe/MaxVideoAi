-- Explicit origin prevents nullable OAuth ownership from becoming a session credential.
-- Historical rows keep OAuth origin. No request-time bootstrap calls this migration.
ALTER TABLE mcp_generation_quotes
  ADD COLUMN IF NOT EXISTS auth_origin TEXT NOT NULL DEFAULT 'oauth',
  ADD COLUMN IF NOT EXISTS studio_project_id TEXT;

ALTER TABLE mcp_generation_quotes DROP CONSTRAINT IF EXISTS generation_quote_origin_scope;
ALTER TABLE mcp_generation_quotes ADD CONSTRAINT generation_quote_origin_scope CHECK ((
  (auth_origin = 'oauth' AND studio_project_id IS NULL)
  OR (auth_origin = 'studio-session' AND oauth_client_id IS NULL
      AND funding_mode = 'wallet' AND request_json->>'surface' = 'image'
      AND length(studio_project_id) BETWEEN 1 AND 128
      AND studio_project_id = btrim(studio_project_id))
) IS TRUE);

CREATE OR REPLACE FUNCTION enforce_generation_quote_origin_update()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.auth_origin IS DISTINCT FROM OLD.auth_origin
    OR NEW.studio_project_id IS DISTINCT FROM OLD.studio_project_id THEN
    RAISE EXCEPTION 'Generation quote origin and project scope are immutable';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS generation_quote_origin_immutable ON mcp_generation_quotes;
CREATE TRIGGER generation_quote_origin_immutable BEFORE UPDATE ON mcp_generation_quotes
FOR EACH ROW EXECUTE FUNCTION enforce_generation_quote_origin_update();

COMMENT ON COLUMN mcp_generation_quotes.auth_origin IS
  'Server-owned transport origin. Existing quotes remain OAuth, including null OAuth client rows.';
COMMENT ON COLUMN mcp_generation_quotes.studio_project_id IS
  'Authorized Studio project binding; immutable and unavailable to OAuth quote adapters.';
