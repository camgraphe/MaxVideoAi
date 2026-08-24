CREATE TABLE IF NOT EXISTS mcp_reference_upload_sessions (
  session_id UUID PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL,
  oauth_client_id TEXT,
  state TEXT NOT NULL DEFAULT 'created',
  claim_id UUID,
  asset_id TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  claimed_at TIMESTAMPTZ,
  uploaded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,

  CONSTRAINT mcp_reference_upload_sessions_token_hash_format CHECK (
    token_hash ~ '^[a-f0-9]{64}$'
  ),
  CONSTRAINT mcp_reference_upload_sessions_user_format CHECK (
    length(user_id) BETWEEN 1 AND 128 AND user_id = btrim(user_id)
  ),
  CONSTRAINT mcp_reference_upload_sessions_client_format CHECK (
    oauth_client_id IS NULL
    OR (length(oauth_client_id) BETWEEN 1 AND 256 AND oauth_client_id = btrim(oauth_client_id))
  ),
  CONSTRAINT mcp_reference_upload_sessions_state_allowlist CHECK (
    state IN ('created', 'uploaded', 'expired', 'revoked')
  ),
  CONSTRAINT mcp_reference_upload_sessions_lifetime CHECK (
    expires_at = created_at + INTERVAL '15 minutes'
  ),
  CONSTRAINT mcp_reference_upload_sessions_time_order CHECK (
    updated_at >= created_at
    AND (claimed_at IS NULL OR (claimed_at >= created_at AND claimed_at < expires_at))
    AND (uploaded_at IS NULL OR (uploaded_at >= created_at AND uploaded_at < expires_at))
  ),
  CONSTRAINT mcp_reference_upload_sessions_claim_shape CHECK (
    (claim_id IS NULL) = (claimed_at IS NULL)
  ),
  CONSTRAINT mcp_reference_upload_sessions_asset_format CHECK (
    asset_id IS NULL
    OR (length(asset_id) BETWEEN 1 AND 512 AND asset_id = btrim(asset_id))
  ),
  CONSTRAINT mcp_reference_upload_sessions_state_shape CHECK (
    CASE state
      WHEN 'created' THEN asset_id IS NULL AND uploaded_at IS NULL
      WHEN 'uploaded' THEN
        claim_id IS NOT NULL AND claimed_at IS NOT NULL
        AND asset_id IS NOT NULL AND uploaded_at IS NOT NULL
      WHEN 'expired' THEN
        claim_id IS NULL AND claimed_at IS NULL AND asset_id IS NULL AND uploaded_at IS NULL
      WHEN 'revoked' THEN
        claim_id IS NULL AND claimed_at IS NULL AND asset_id IS NULL AND uploaded_at IS NULL
      ELSE FALSE
    END
  )
);

CREATE INDEX IF NOT EXISTS mcp_reference_upload_sessions_user_created_idx
  ON mcp_reference_upload_sessions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS mcp_reference_upload_sessions_expiration_idx
  ON mcp_reference_upload_sessions (expires_at, session_id)
  WHERE state = 'created';

CREATE OR REPLACE FUNCTION enforce_mcp_reference_upload_session_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.session_id IS DISTINCT FROM OLD.session_id
    OR NEW.token_hash IS DISTINCT FROM OLD.token_hash
    OR NEW.user_id IS DISTINCT FROM OLD.user_id
    OR NEW.oauth_client_id IS DISTINCT FROM OLD.oauth_client_id
    OR NEW.expires_at IS DISTINCT FROM OLD.expires_at
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'mcp_reference_upload_sessions identity is immutable';
  END IF;

  IF OLD.state <> 'created' THEN
    RAISE EXCEPTION 'mcp_reference_upload_sessions terminal rows are immutable';
  END IF;
  IF NEW.state NOT IN ('created', 'uploaded', 'expired', 'revoked') THEN
    RAISE EXCEPTION 'invalid mcp_reference_upload_sessions transition';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS mcp_reference_upload_sessions_enforce_update
  ON mcp_reference_upload_sessions;
CREATE TRIGGER mcp_reference_upload_sessions_enforce_update
  BEFORE UPDATE ON mcp_reference_upload_sessions
  FOR EACH ROW
  EXECUTE FUNCTION enforce_mcp_reference_upload_session_update();
