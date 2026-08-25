ALTER TABLE mcp_reference_upload_attempts
  ADD COLUMN IF NOT EXISTS protocol_version SMALLINT NOT NULL DEFAULT 1;

UPDATE mcp_reference_upload_attempts
   SET protocol_version = 2
 WHERE file_sha256 ~ '^[a-f0-9]{64}$'
   AND chunk_bytes > 0
   AND total_parts > 0;

ALTER TABLE mcp_reference_upload_attempts
  DROP CONSTRAINT IF EXISTS mcp_reference_upload_attempts_protocol_shape;
ALTER TABLE mcp_reference_upload_attempts
  ADD CONSTRAINT mcp_reference_upload_attempts_protocol_shape CHECK (
    protocol_version IN (1, 2)
    AND (
      protocol_version = 1
      OR (
        file_sha256 ~ '^[a-f0-9]{64}$'
        AND chunk_bytes > 0
        AND total_parts > 0
      )
    )
  ) NOT VALID;

CREATE TABLE IF NOT EXISTS mcp_reference_upload_cleanup_objects (
  cleanup_id UUID PRIMARY KEY,
  session_id UUID NOT NULL,
  upload_id UUID NOT NULL,
  user_id TEXT NOT NULL,
  media_kind TEXT NOT NULL,
  object_role TEXT NOT NULL CHECK (object_role IN ('part', 'final', 'thumbnail', 'legacy_staging')),
  object_key TEXT NOT NULL,
  owner_prefix TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'retained', 'deleted')),
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT mcp_reference_upload_cleanup_attempt_fk
    FOREIGN KEY (session_id, upload_id, user_id, media_kind)
    REFERENCES mcp_reference_upload_attempts (session_id, upload_id, user_id, media_kind)
    ON DELETE CASCADE,
  CONSTRAINT mcp_reference_upload_cleanup_attempt_object_unique
    UNIQUE (session_id, upload_id, user_id, media_kind, object_key),
  CONSTRAINT mcp_reference_upload_cleanup_owner_scope CHECK (
    length(object_key) BETWEEN 1 AND 1024
    AND length(owner_prefix) BETWEEN 1 AND 900
    AND object_key = btrim(object_key)
    AND owner_prefix = btrim(owner_prefix)
    AND object_key LIKE owner_prefix || '%'
  )
);

CREATE INDEX IF NOT EXISTS mcp_reference_upload_cleanup_pending_idx
  ON mcp_reference_upload_cleanup_objects (state, updated_at, cleanup_id)
  WHERE state = 'pending';

INSERT INTO mcp_reference_upload_cleanup_objects (
  cleanup_id, session_id, upload_id, user_id, media_kind, object_role,
  object_key, owner_prefix, state, created_at, updated_at
)
SELECT gen_random_uuid(), parts.session_id, parts.upload_id, parts.user_id, parts.media_kind, 'part',
  parts.storage_key,
  CASE WHEN position('/' IN parts.storage_key) > 0
    THEN regexp_replace(parts.storage_key, '[^/]+$', '')
    ELSE parts.storage_key
  END,
  'pending', parts.created_at, parts.updated_at
  FROM mcp_reference_upload_parts AS parts
ON CONFLICT (session_id, upload_id, user_id, media_kind, object_key) DO NOTHING;

INSERT INTO mcp_reference_upload_cleanup_objects (
  cleanup_id, session_id, upload_id, user_id, media_kind, object_role,
  object_key, owner_prefix, state, created_at, updated_at
)
SELECT gen_random_uuid(), session_id, upload_id, user_id, media_kind, 'legacy_staging',
  storage_key, regexp_replace(storage_key, '[^/]+$', ''), 'pending', created_at, updated_at
  FROM mcp_reference_upload_attempts
 WHERE protocol_version = 1 AND state <> 'completed' AND storage_key LIKE 'mcp-reference-%/%'
ON CONFLICT (session_id, upload_id, user_id, media_kind, object_key) DO NOTHING;

CREATE OR REPLACE FUNCTION register_mcp_reference_upload_v1_cleanup()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.protocol_version = 1 AND NEW.storage_key LIKE 'mcp-reference-%/%' THEN
    INSERT INTO mcp_reference_upload_cleanup_objects (
      cleanup_id, session_id, upload_id, user_id, media_kind, object_role,
      object_key, owner_prefix, state, created_at, updated_at
    ) VALUES (
      gen_random_uuid(), NEW.session_id, NEW.upload_id, NEW.user_id, NEW.media_kind, 'legacy_staging',
      NEW.storage_key, regexp_replace(NEW.storage_key, '[^/]+$', ''), 'pending', NEW.created_at, NEW.updated_at
    ) ON CONFLICT (session_id, upload_id, user_id, media_kind, object_key) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS mcp_reference_upload_attempts_register_v1_cleanup
  ON mcp_reference_upload_attempts;
CREATE TRIGGER mcp_reference_upload_attempts_register_v1_cleanup
  AFTER INSERT ON mcp_reference_upload_attempts
  FOR EACH ROW EXECUTE FUNCTION register_mcp_reference_upload_v1_cleanup();

CREATE OR REPLACE FUNCTION classify_mcp_reference_upload_protocol()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.file_sha256 ~ '^[a-f0-9]{64}$' AND NEW.chunk_bytes > 0 AND NEW.total_parts > 0 THEN
    NEW.protocol_version := 2;
  ELSE
    NEW.protocol_version := 1;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS mcp_reference_upload_attempts_classify_protocol
  ON mcp_reference_upload_attempts;
CREATE TRIGGER mcp_reference_upload_attempts_classify_protocol
  BEFORE INSERT ON mcp_reference_upload_attempts
  FOR EACH ROW EXECUTE FUNCTION classify_mcp_reference_upload_protocol();

CREATE OR REPLACE FUNCTION register_mcp_reference_upload_part_cleanup()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO mcp_reference_upload_cleanup_objects (
    cleanup_id, session_id, upload_id, user_id, media_kind, object_role,
    object_key, owner_prefix, state, created_at, updated_at
  ) VALUES (
    gen_random_uuid(), NEW.session_id, NEW.upload_id, NEW.user_id, NEW.media_kind, 'part',
    NEW.storage_key,
    CASE WHEN position('/' IN NEW.storage_key) > 0
      THEN regexp_replace(NEW.storage_key, '[^/]+$', '')
      ELSE NEW.storage_key
    END,
    'pending', NEW.created_at, NEW.updated_at
  ) ON CONFLICT (session_id, upload_id, user_id, media_kind, object_key) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS mcp_reference_upload_parts_register_cleanup
  ON mcp_reference_upload_parts;
CREATE TRIGGER mcp_reference_upload_parts_register_cleanup
  AFTER INSERT ON mcp_reference_upload_parts
  FOR EACH ROW EXECUTE FUNCTION register_mcp_reference_upload_part_cleanup();

CREATE OR REPLACE FUNCTION enforce_mcp_reference_upload_cleanup_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.cleanup_id IS DISTINCT FROM OLD.cleanup_id
    OR NEW.session_id IS DISTINCT FROM OLD.session_id
    OR NEW.upload_id IS DISTINCT FROM OLD.upload_id
    OR NEW.user_id IS DISTINCT FROM OLD.user_id
    OR NEW.media_kind IS DISTINCT FROM OLD.media_kind
    OR NEW.object_role IS DISTINCT FROM OLD.object_role
    OR NEW.object_key IS DISTINCT FROM OLD.object_key
    OR NEW.owner_prefix IS DISTINCT FROM OLD.owner_prefix
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'mcp_reference_upload_cleanup_objects identity is immutable';
  END IF;
  IF OLD.state <> 'pending' AND NEW IS DISTINCT FROM OLD THEN
    RAISE EXCEPTION 'mcp_reference_upload_cleanup_objects terminal rows are immutable';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS mcp_reference_upload_cleanup_enforce_update
  ON mcp_reference_upload_cleanup_objects;
CREATE TRIGGER mcp_reference_upload_cleanup_enforce_update
  BEFORE UPDATE ON mcp_reference_upload_cleanup_objects
  FOR EACH ROW EXECUTE FUNCTION enforce_mcp_reference_upload_cleanup_update();

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
    OR NEW.protocol_version IS DISTINCT FROM OLD.protocol_version
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
