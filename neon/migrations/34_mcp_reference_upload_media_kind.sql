ALTER TABLE mcp_reference_upload_sessions
  ADD COLUMN IF NOT EXISTS media_kind TEXT NOT NULL DEFAULT 'image';

ALTER TABLE mcp_reference_upload_sessions
  DROP CONSTRAINT IF EXISTS mcp_reference_upload_sessions_media_kind_allowlist;
ALTER TABLE mcp_reference_upload_sessions
  ADD CONSTRAINT mcp_reference_upload_sessions_media_kind_allowlist CHECK (
    media_kind IN ('image', 'video', 'audio')
  );

CREATE OR REPLACE FUNCTION enforce_mcp_reference_upload_session_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.session_id IS DISTINCT FROM OLD.session_id
    OR NEW.token_hash IS DISTINCT FROM OLD.token_hash
    OR NEW.user_id IS DISTINCT FROM OLD.user_id
    OR NEW.oauth_client_id IS DISTINCT FROM OLD.oauth_client_id
    OR NEW.media_kind IS DISTINCT FROM OLD.media_kind
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
