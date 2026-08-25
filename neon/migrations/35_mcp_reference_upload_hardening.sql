CREATE EXTENSION IF NOT EXISTS "pgcrypto";

ALTER TABLE media_assets
  ADD COLUMN IF NOT EXISTS public_id TEXT;

ALTER TABLE media_assets
  ALTER COLUMN public_id SET DEFAULT ('ma_' || replace(gen_random_uuid()::text, '-', ''));

UPDATE media_assets
   SET public_id = 'ma_' || replace(gen_random_uuid()::text, '-', '')
 WHERE public_id IS NULL;

ALTER TABLE media_assets
  DROP CONSTRAINT IF EXISTS media_assets_public_id_format;
ALTER TABLE media_assets
  ADD CONSTRAINT media_assets_public_id_format
  CHECK (public_id ~ '^ma_[a-f0-9]{32}$') NOT VALID;
ALTER TABLE media_assets
  VALIDATE CONSTRAINT media_assets_public_id_format;
ALTER TABLE media_assets
  ALTER COLUMN public_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS media_assets_public_id_idx
  ON media_assets (public_id);

CREATE UNIQUE INDEX IF NOT EXISTS mcp_reference_upload_sessions_identity_idx
  ON mcp_reference_upload_sessions (session_id, user_id, media_kind);

CREATE TABLE IF NOT EXISTS mcp_reference_upload_attempts (
  session_id UUID PRIMARY KEY REFERENCES mcp_reference_upload_sessions(session_id) ON DELETE CASCADE,
  upload_id UUID NOT NULL UNIQUE,
  user_id TEXT NOT NULL,
  media_kind TEXT NOT NULL CHECK (media_kind IN ('image', 'video', 'audio')),
  storage_key TEXT NOT NULL,
  file_name TEXT NOT NULL,
  declared_mime TEXT NOT NULL,
  declared_size BIGINT NOT NULL CHECK (declared_size > 0),
  content_sha256 TEXT,
  staged_asset_id TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT mcp_reference_upload_attempts_session_identity_fk
    FOREIGN KEY (session_id, user_id, media_kind)
    REFERENCES mcp_reference_upload_sessions (session_id, user_id, media_kind)
    ON DELETE CASCADE,
  CONSTRAINT mcp_reference_upload_attempts_user_format CHECK (
    length(user_id) BETWEEN 1 AND 128 AND user_id = btrim(user_id)
  ),
  CONSTRAINT mcp_reference_upload_attempts_file_name_format CHECK (
    length(file_name) BETWEEN 1 AND 255 AND file_name = btrim(file_name)
  ),
  CONSTRAINT mcp_reference_upload_attempts_mime_format CHECK (
    length(declared_mime) BETWEEN 1 AND 128 AND declared_mime = btrim(declared_mime)
  ),
  CONSTRAINT mcp_reference_upload_attempts_storage_key_format CHECK (
    length(storage_key) BETWEEN 1 AND 1024 AND storage_key = btrim(storage_key)
  ),
  CONSTRAINT mcp_reference_upload_attempts_digest_format CHECK (
    content_sha256 IS NULL OR content_sha256 ~ '^[a-f0-9]{64}$'
  ),
  CONSTRAINT mcp_reference_upload_attempts_stage_shape CHECK (
    (content_sha256 IS NULL) = (staged_asset_id IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS mcp_reference_upload_attempts_user_created_idx
  ON mcp_reference_upload_attempts (user_id, created_at DESC);

CREATE OR REPLACE FUNCTION enforce_mcp_reference_upload_attempt_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.session_id IS DISTINCT FROM OLD.session_id
    OR NEW.upload_id IS DISTINCT FROM OLD.upload_id
    OR NEW.user_id IS DISTINCT FROM OLD.user_id
    OR NEW.media_kind IS DISTINCT FROM OLD.media_kind
    OR NEW.storage_key IS DISTINCT FROM OLD.storage_key
    OR NEW.file_name IS DISTINCT FROM OLD.file_name
    OR NEW.declared_mime IS DISTINCT FROM OLD.declared_mime
    OR NEW.declared_size IS DISTINCT FROM OLD.declared_size
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'mcp_reference_upload_attempts identity is immutable';
  END IF;
  IF OLD.staged_asset_id IS NOT NULL
    AND (
      NEW.staged_asset_id IS DISTINCT FROM OLD.staged_asset_id
      OR NEW.content_sha256 IS DISTINCT FROM OLD.content_sha256
    )
  THEN
    RAISE EXCEPTION 'mcp_reference_upload_attempts staged result is immutable';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS mcp_reference_upload_attempts_enforce_update
  ON mcp_reference_upload_attempts;
CREATE TRIGGER mcp_reference_upload_attempts_enforce_update
  BEFORE UPDATE ON mcp_reference_upload_attempts
  FOR EACH ROW
  EXECUTE FUNCTION enforce_mcp_reference_upload_attempt_update();
