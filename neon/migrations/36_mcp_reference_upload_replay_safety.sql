ALTER TABLE mcp_reference_upload_attempts
  ADD COLUMN IF NOT EXISTS file_sha256 TEXT,
  ADD COLUMN IF NOT EXISTS chunk_bytes INTEGER,
  ADD COLUMN IF NOT EXISTS total_parts INTEGER,
  ADD COLUMN IF NOT EXISTS state TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS lease_id UUID,
  ADD COLUMN IF NOT EXISTS lease_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS failure_code TEXT,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS mcp_reference_upload_attempts_part_identity_idx
  ON mcp_reference_upload_attempts (session_id, upload_id, user_id, media_kind);

ALTER TABLE mcp_reference_upload_attempts
  DROP CONSTRAINT IF EXISTS mcp_reference_upload_attempts_replay_shape;
ALTER TABLE mcp_reference_upload_attempts
  ADD CONSTRAINT mcp_reference_upload_attempts_replay_shape CHECK (
    state IN ('pending', 'processing', 'staged', 'failed', 'completed', 'aborted')
    AND (file_sha256 IS NULL OR file_sha256 ~ '^[a-f0-9]{64}$')
    AND (chunk_bytes IS NULL OR chunk_bytes > 0)
    AND (total_parts IS NULL OR total_parts > 0)
    AND version >= 0
    AND ((lease_id IS NULL) = (lease_expires_at IS NULL))
  ) NOT VALID;

CREATE TABLE IF NOT EXISTS mcp_reference_upload_parts (
  session_id UUID NOT NULL,
  upload_id UUID NOT NULL,
  user_id TEXT NOT NULL,
  media_kind TEXT NOT NULL,
  part_number INTEGER NOT NULL CHECK (part_number > 0),
  state TEXT NOT NULL DEFAULT 'processing' CHECK (state IN ('processing', 'ready', 'failed')),
  lease_id UUID NOT NULL,
  lease_expires_at TIMESTAMPTZ NOT NULL,
  storage_key TEXT NOT NULL,
  size_bytes BIGINT,
  content_sha256 TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (upload_id, part_number),
  UNIQUE (upload_id, part_number),
  CONSTRAINT mcp_reference_upload_parts_attempt_fk
    FOREIGN KEY (session_id, upload_id, user_id, media_kind)
    REFERENCES mcp_reference_upload_attempts (session_id, upload_id, user_id, media_kind) ON DELETE CASCADE,
  CONSTRAINT mcp_reference_upload_parts_kind CHECK (media_kind IN ('image', 'video', 'audio')),
  CONSTRAINT mcp_reference_upload_parts_result CHECK (
    (state = 'ready' AND size_bytes > 0 AND content_sha256 ~ '^[a-f0-9]{64}$')
    OR (state <> 'ready' AND size_bytes IS NULL AND content_sha256 IS NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS mcp_reference_upload_parts_identity_idx
  ON mcp_reference_upload_parts (session_id, upload_id, user_id, media_kind, part_number);
CREATE INDEX IF NOT EXISTS mcp_reference_upload_attempts_expiry_cleanup_idx
  ON mcp_reference_upload_attempts (state, lease_expires_at, updated_at);

CREATE OR REPLACE FUNCTION enforce_mcp_reference_upload_part_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.session_id IS DISTINCT FROM OLD.session_id
    OR NEW.upload_id IS DISTINCT FROM OLD.upload_id
    OR NEW.user_id IS DISTINCT FROM OLD.user_id
    OR NEW.media_kind IS DISTINCT FROM OLD.media_kind
    OR NEW.part_number IS DISTINCT FROM OLD.part_number
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'mcp_reference_upload_parts identity is immutable';
  END IF;
  IF OLD.state = 'ready' AND NEW IS DISTINCT FROM OLD THEN
    RAISE EXCEPTION 'mcp_reference_upload_parts completed result is immutable';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS mcp_reference_upload_parts_enforce_update ON mcp_reference_upload_parts;
CREATE TRIGGER mcp_reference_upload_parts_enforce_update
  BEFORE UPDATE ON mcp_reference_upload_parts
  FOR EACH ROW EXECUTE FUNCTION enforce_mcp_reference_upload_part_update();

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
    OR NEW.file_sha256 IS DISTINCT FROM OLD.file_sha256
    OR NEW.chunk_bytes IS DISTINCT FROM OLD.chunk_bytes
    OR NEW.total_parts IS DISTINCT FROM OLD.total_parts
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'mcp_reference_upload_attempts identity is immutable';
  END IF;
  IF OLD.staged_asset_id IS NOT NULL
    AND (NEW.staged_asset_id IS DISTINCT FROM OLD.staged_asset_id
      OR NEW.content_sha256 IS DISTINCT FROM OLD.content_sha256)
  THEN
    RAISE EXCEPTION 'mcp_reference_upload_attempts staged result is immutable';
  END IF;
  RETURN NEW;
END;
$$;
