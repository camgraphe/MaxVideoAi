-- Explicit migration only. Canonical generation remains the owner of quotes, jobs and charges.
CREATE TABLE IF NOT EXISTS creator_operations (
  id uuid PRIMARY KEY REFERENCES mcp_generation_quotes(quote_id),
  user_id text NOT NULL,
  auth_origin text NOT NULL CHECK (auth_origin IN ('oauth','studio-session','toolbox-session')),
  oauth_client_id text,
  studio_project_id text,
  tool_id text NOT NULL CHECK (tool_id IN ('lip-sync','product-photo-editor','product-video-editor','motion-transfer')),
  profile_id text NOT NULL,
  profile_revision integer NOT NULL CHECK (profile_revision > 0),
  request_hash text NOT NULL,
  snapshot jsonb NOT NULL,
  status text NOT NULL DEFAULT 'prepared' CHECK (status IN ('prepared','running','finalizing','completed','failed')),
  result jsonb,
  error text,
  lease_token uuid,
  lease_expires_at timestamptz,
  version integer NOT NULL DEFAULT 0,
  finalize_attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz,
  last_observed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((auth_origin='oauth' AND studio_project_id IS NULL)
    OR (auth_origin='studio-session' AND oauth_client_id IS NULL AND length(studio_project_id)>0)
    OR (auth_origin='toolbox-session' AND oauth_client_id IS NULL AND studio_project_id IS NULL)),
  CHECK ((status='completed') = (result IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS creator_operations_refresh_idx ON creator_operations (next_attempt_at,updated_at) WHERE status IN ('prepared','running','finalizing');
CREATE OR REPLACE FUNCTION creator_operation_identity_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF ROW(OLD.id,OLD.user_id,OLD.auth_origin,OLD.oauth_client_id,OLD.studio_project_id,OLD.tool_id,OLD.profile_id,OLD.profile_revision,OLD.request_hash,OLD.snapshot)
     IS DISTINCT FROM ROW(NEW.id,NEW.user_id,NEW.auth_origin,NEW.oauth_client_id,NEW.studio_project_id,NEW.tool_id,NEW.profile_id,NEW.profile_revision,NEW.request_hash,NEW.snapshot)
  THEN RAISE EXCEPTION 'Creator operation identity is immutable'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS creator_operation_identity_guard ON creator_operations;
CREATE TRIGGER creator_operation_identity_guard BEFORE UPDATE ON creator_operations FOR EACH ROW EXECUTE FUNCTION creator_operation_identity_immutable();
