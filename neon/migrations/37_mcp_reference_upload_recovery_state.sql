ALTER TABLE mcp_reference_upload_attempts
  ADD COLUMN IF NOT EXISTS protocol_version SMALLINT NOT NULL DEFAULT 1;

ALTER TABLE mcp_reference_upload_sessions
  DROP CONSTRAINT IF EXISTS mcp_reference_upload_sessions_time_order;
ALTER TABLE mcp_reference_upload_sessions
  ADD CONSTRAINT mcp_reference_upload_sessions_time_order CHECK (
    updated_at >= created_at
    AND (claimed_at IS NULL OR (claimed_at >= created_at AND claimed_at < expires_at))
    AND (uploaded_at IS NULL OR uploaded_at >= created_at)
  ) NOT VALID;

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

CREATE TABLE IF NOT EXISTS mcp_reference_upload_object_fences (
  object_key TEXT PRIMARY KEY,
  state TEXT NOT NULL DEFAULT 'available'
    CONSTRAINT mcp_reference_upload_object_fences_state_check
    CHECK (state IN ('available', 'producing', 'referenced', 'orphaned', 'deleting', 'deleted')),
  producer_claim_id UUID,
  producer_lease_expires_at TIMESTAMPTZ,
  delete_claim_id UUID,
  delete_lease_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT mcp_reference_upload_object_fence_shape CHECK (
    (state = 'producing' AND producer_claim_id IS NOT NULL AND producer_lease_expires_at IS NOT NULL
      AND delete_claim_id IS NULL AND delete_lease_expires_at IS NULL)
    OR (state = 'deleting' AND delete_claim_id IS NOT NULL AND delete_lease_expires_at IS NOT NULL
      AND producer_claim_id IS NULL AND producer_lease_expires_at IS NULL)
    OR (state = 'referenced'
      AND ((producer_claim_id IS NULL AND producer_lease_expires_at IS NULL)
        OR (producer_claim_id IS NOT NULL AND producer_lease_expires_at IS NOT NULL))
      AND delete_claim_id IS NULL AND delete_lease_expires_at IS NULL)
    OR (state IN ('available', 'orphaned', 'deleted')
      AND producer_claim_id IS NULL AND producer_lease_expires_at IS NULL
      AND delete_claim_id IS NULL AND delete_lease_expires_at IS NULL)
  ),
  CONSTRAINT mcp_reference_upload_object_fence_key CHECK (
    length(object_key) BETWEEN 1 AND 1024
    AND object_key = btrim(object_key)
    AND object_key LIKE 'user-assets/by-content/%'
  )
);

ALTER TABLE mcp_reference_upload_object_fences
  ADD COLUMN IF NOT EXISTS producer_claim_id UUID;
ALTER TABLE mcp_reference_upload_object_fences
  ADD COLUMN IF NOT EXISTS producer_lease_expires_at TIMESTAMPTZ;
ALTER TABLE mcp_reference_upload_object_fences
  DROP CONSTRAINT IF EXISTS mcp_reference_upload_object_fences_state_check;
ALTER TABLE mcp_reference_upload_object_fences
  ADD CONSTRAINT mcp_reference_upload_object_fences_state_check
  CHECK (state IN ('available', 'producing', 'referenced', 'orphaned', 'deleting', 'deleted')) NOT VALID;
ALTER TABLE mcp_reference_upload_object_fences
  DROP CONSTRAINT IF EXISTS mcp_reference_upload_object_fence_shape;
ALTER TABLE mcp_reference_upload_object_fences
  ADD CONSTRAINT mcp_reference_upload_object_fence_shape CHECK (
    (state = 'producing' AND producer_claim_id IS NOT NULL AND producer_lease_expires_at IS NOT NULL
      AND delete_claim_id IS NULL AND delete_lease_expires_at IS NULL)
    OR (state = 'deleting' AND delete_claim_id IS NOT NULL AND delete_lease_expires_at IS NOT NULL
      AND producer_claim_id IS NULL AND producer_lease_expires_at IS NULL)
    OR (state = 'referenced'
      AND ((producer_claim_id IS NULL AND producer_lease_expires_at IS NULL)
        OR (producer_claim_id IS NOT NULL AND producer_lease_expires_at IS NOT NULL))
      AND delete_claim_id IS NULL AND delete_lease_expires_at IS NULL)
    OR (state IN ('available', 'orphaned', 'deleted')
      AND producer_claim_id IS NULL AND producer_lease_expires_at IS NULL
      AND delete_claim_id IS NULL AND delete_lease_expires_at IS NULL)
  ) NOT VALID;

INSERT INTO mcp_reference_upload_object_fences (object_key, state, created_at, updated_at)
SELECT DISTINCT object_key, 'available', min(created_at), max(updated_at)
  FROM mcp_reference_upload_cleanup_objects
 WHERE object_role = 'final'
 GROUP BY object_key
ON CONFLICT (object_key) DO NOTHING;

CREATE OR REPLACE FUNCTION fence_mcp_reference_upload_final_registration()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  fenced_key TEXT;
BEGIN
  IF NEW.object_role <> 'final' THEN
    RETURN NEW;
  END IF;
  INSERT INTO mcp_reference_upload_object_fences (
    object_key, state, delete_claim_id, delete_lease_expires_at, created_at, updated_at
  ) VALUES (
    NEW.object_key, 'available', NULL, NULL, NEW.created_at, NEW.updated_at
  )
  ON CONFLICT (object_key) DO UPDATE
    SET updated_at = EXCLUDED.updated_at
    WHERE mcp_reference_upload_object_fences.state
      IN ('available', 'producing', 'referenced', 'orphaned')
  RETURNING object_key INTO fenced_key;
  IF fenced_key IS NULL THEN
    RAISE EXCEPTION 'reference upload object is being deleted; retry registration'
      USING ERRCODE = '40001';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS mcp_reference_upload_cleanup_fence_final_registration
  ON mcp_reference_upload_cleanup_objects;
CREATE TRIGGER mcp_reference_upload_cleanup_fence_final_registration
  BEFORE INSERT ON mcp_reference_upload_cleanup_objects
  FOR EACH ROW EXECUTE FUNCTION fence_mcp_reference_upload_final_registration();

CREATE OR REPLACE FUNCTION content_addressed_object_key(candidate_url TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  matched_key TEXT;
BEGIN
  IF candidate_url IS NULL THEN
    RETURN NULL;
  END IF;
  matched_key := substring(candidate_url FROM '(user-assets/by-content/[^?#[:space:]]+)');
  RETURN matched_key;
END;
$$;

CREATE OR REPLACE FUNCTION fence_canonical_content_addressed_asset()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  candidate_key TEXT;
  fenced_key TEXT;
BEGIN
  candidate_key := content_addressed_object_key(NEW.url);
  IF candidate_key IS NULL THEN
    RETURN NEW;
  END IF;
  INSERT INTO mcp_reference_upload_object_fences (
    object_key, state, created_at, updated_at
  ) VALUES (
    candidate_key, 'referenced', clock_timestamp(), clock_timestamp()
  )
  ON CONFLICT (object_key) DO UPDATE
    SET state = 'referenced', updated_at = clock_timestamp()
    WHERE mcp_reference_upload_object_fences.state
      IN ('available', 'producing', 'referenced', 'orphaned')
  RETURNING object_key INTO fenced_key;
  IF fenced_key IS NULL THEN
    RAISE EXCEPTION 'content-addressed storage object is deleted or being deleted; retry persistence'
      USING ERRCODE = '40001';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS user_assets_fence_content_addressed_object ON user_assets;
CREATE TRIGGER user_assets_fence_content_addressed_object
  BEFORE INSERT OR UPDATE OF url ON user_assets
  FOR EACH ROW EXECUTE FUNCTION fence_canonical_content_addressed_asset();

DROP TRIGGER IF EXISTS media_assets_fence_content_addressed_object ON media_assets;
CREATE TRIGGER media_assets_fence_content_addressed_object
  BEFORE INSERT OR UPDATE OF url ON media_assets
  FOR EACH ROW EXECUTE FUNCTION fence_canonical_content_addressed_asset();

DROP TRIGGER IF EXISTS media_assets_fence_restored_content_addressed_object ON media_assets;
CREATE TRIGGER media_assets_fence_restored_content_addressed_object
  BEFORE UPDATE OF deleted_at ON media_assets
  FOR EACH ROW
  WHEN (OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL)
  EXECUTE FUNCTION fence_canonical_content_addressed_asset();

CREATE OR REPLACE FUNCTION release_unreferenced_content_addressed_asset()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  previous_key TEXT;
BEGIN
  previous_key := content_addressed_object_key(OLD.url);
  IF previous_key IS NULL THEN
    RETURN NULL;
  END IF;
  IF TG_OP = 'UPDATE'
      AND previous_key = content_addressed_object_key(NEW.url)
      AND (TG_TABLE_NAME <> 'media_assets'
        OR to_jsonb(OLD)->'deleted_at' IS NOT DISTINCT FROM to_jsonb(NEW)->'deleted_at') THEN
    RETURN NULL;
  END IF;
  UPDATE mcp_reference_upload_object_fences AS fences
     SET state = 'orphaned', producer_claim_id = NULL,
         producer_lease_expires_at = NULL, updated_at = clock_timestamp()
   WHERE fences.object_key = previous_key
     AND fences.state = 'referenced'
     AND (fences.producer_claim_id IS NULL
       OR fences.producer_lease_expires_at <= clock_timestamp())
     AND NOT EXISTS (
       SELECT 1 FROM user_assets AS assets
        WHERE position(previous_key in assets.url) > 0
           OR position(previous_key in COALESCE(assets.metadata->>'thumbUrl', '')) > 0
     )
     AND NOT EXISTS (
       SELECT 1 FROM media_assets AS media
        WHERE media.deleted_at IS NULL
          AND (position(previous_key in media.url) > 0
            OR position(previous_key in COALESCE(media.thumb_url, '')) > 0)
     );
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS user_assets_release_content_addressed_object ON user_assets;
CREATE TRIGGER user_assets_release_content_addressed_object
  AFTER DELETE OR UPDATE OF url ON user_assets
  FOR EACH ROW EXECUTE FUNCTION release_unreferenced_content_addressed_asset();

DROP TRIGGER IF EXISTS media_assets_release_content_addressed_object ON media_assets;
CREATE TRIGGER media_assets_release_content_addressed_object
  AFTER DELETE OR UPDATE OF url, deleted_at ON media_assets
  FOR EACH ROW EXECUTE FUNCTION release_unreferenced_content_addressed_asset();

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
