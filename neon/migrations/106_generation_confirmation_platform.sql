-- Only the first native confirmation can supply this value. Historical rows stay NULL.
ALTER TABLE mcp_generation_quotes
  ADD COLUMN IF NOT EXISTS confirmation_platform text
    CHECK (confirmation_platform IS NULL OR (
      confirmation_platform IN ('ios', 'android')
      AND auth_origin IN ('studio-session', 'mobile-session')
      AND job_id IS NOT NULL AND claimed_at IS NOT NULL
    ));

CREATE OR REPLACE FUNCTION guard_generation_confirmation_platform() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Generation confirmation platform is fixed at first claim';
END;
$$;

DROP TRIGGER IF EXISTS generation_confirmation_platform_immutable ON mcp_generation_quotes;
CREATE TRIGGER generation_confirmation_platform_immutable
  BEFORE UPDATE OF confirmation_platform ON mcp_generation_quotes
  FOR EACH ROW WHEN (NEW.confirmation_platform IS DISTINCT FROM OLD.confirmation_platform
    AND NOT (OLD.state = 'prepared' AND NEW.state = 'claimed' AND OLD.confirmation_platform IS NULL))
  EXECUTE FUNCTION guard_generation_confirmation_platform();
