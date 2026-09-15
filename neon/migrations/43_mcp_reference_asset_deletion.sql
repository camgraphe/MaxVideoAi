ALTER TABLE mcp_reference_upload_cleanup_objects
  DROP CONSTRAINT IF EXISTS mcp_reference_upload_cleanup_objects_state_check;
ALTER TABLE mcp_reference_upload_cleanup_objects
  ADD CONSTRAINT mcp_reference_upload_cleanup_objects_state_check
  CHECK (state IN ('pending', 'retained', 'released', 'deleted')) NOT VALID;

CREATE INDEX IF NOT EXISTS mcp_reference_upload_cleanup_released_idx
  ON mcp_reference_upload_cleanup_objects (updated_at, object_key, cleanup_id)
  WHERE state = 'released';

CREATE INDEX IF NOT EXISTS media_assets_deleted_mcp_reference_reconcile_idx
  ON media_assets (deleted_at, id)
  WHERE deleted_at IS NOT NULL AND public_id IS NOT NULL;

CREATE OR REPLACE FUNCTION enforce_mcp_reference_upload_cleanup_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.state <> 'pending' THEN
    RAISE EXCEPTION 'mcp_reference_upload_cleanup_objects must start pending';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS mcp_reference_upload_cleanup_enforce_insert
  ON mcp_reference_upload_cleanup_objects;
CREATE TRIGGER mcp_reference_upload_cleanup_enforce_insert
  BEFORE INSERT ON mcp_reference_upload_cleanup_objects
  FOR EACH ROW EXECUTE FUNCTION enforce_mcp_reference_upload_cleanup_insert();

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

  IF NEW.state IS DISTINCT FROM OLD.state AND NOT (
    (OLD.state = 'pending' AND NEW.state IN ('retained', 'deleted'))
    OR (OLD.state = 'retained' AND NEW.state = 'released')
    OR (OLD.state = 'released' AND NEW.state = 'deleted')
  ) THEN
    RAISE EXCEPTION 'invalid mcp_reference_upload_cleanup_objects state transition';
  END IF;

  IF NEW.state IS NOT DISTINCT FROM OLD.state AND NEW IS DISTINCT FROM OLD THEN
    RAISE EXCEPTION 'mcp_reference_upload_cleanup_objects state rows are immutable';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS mcp_reference_upload_cleanup_enforce_update
  ON mcp_reference_upload_cleanup_objects;
CREATE TRIGGER mcp_reference_upload_cleanup_enforce_update
  BEFORE UPDATE ON mcp_reference_upload_cleanup_objects
  FOR EACH ROW EXECUTE FUNCTION enforce_mcp_reference_upload_cleanup_update();

ALTER TABLE mcp_reference_upload_object_fences
  DROP CONSTRAINT IF EXISTS mcp_reference_upload_object_fence_key;
ALTER TABLE mcp_reference_upload_object_fences
  ADD CONSTRAINT mcp_reference_upload_object_fence_key CHECK (
    length(object_key) BETWEEN 1 AND 1024
    AND object_key = btrim(object_key)
    AND (object_key LIKE 'user-assets/by-content/%' OR object_key LIKE 'user-asset-thumbs/%')
  ) NOT VALID;

CREATE OR REPLACE FUNCTION fence_mcp_reference_upload_final_registration()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  fenced_key TEXT;
BEGIN
  IF NEW.object_role NOT IN ('final', 'thumbnail') THEN
    RETURN NEW;
  END IF;
  INSERT INTO mcp_reference_upload_object_fences (
    object_key, state, delete_claim_id, delete_lease_expires_at, created_at, updated_at
  ) VALUES (NEW.object_key, 'available', NULL, NULL, NEW.created_at, NEW.updated_at)
  ON CONFLICT (object_key) DO UPDATE
    SET updated_at = EXCLUDED.updated_at
    WHERE mcp_reference_upload_object_fences.state IN ('available', 'producing', 'referenced', 'orphaned')
  RETURNING object_key INTO fenced_key;
  IF fenced_key IS NULL THEN
    RAISE EXCEPTION 'reference upload object is being deleted; retry registration'
      USING ERRCODE = '40001';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION reference_storage_authority_is_recognized(candidate_url TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT candidate_url ~* '^https://(assets\.maxvideo\.ai|cdn\.maxvideoai\.com|media\.maxvideoai\.com)(:443)?/';
$$;

CREATE OR REPLACE FUNCTION reference_storage_path_object_key(candidate_url TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN normalized_path ~ '^([^/?#[:space:]]+/)*(user-assets/by-content/[^?#[:space:]]+)$'
    THEN regexp_replace(
      normalized_path,
      '^([^/?#[:space:]]+/)*(user-assets/by-content/[^?#[:space:]]+)$', '\2'
    )
    WHEN normalized_path ~ '^([^/?#[:space:]]+/)*(user-asset-thumbs/[^?#[:space:]]+)$'
    THEN regexp_replace(
      normalized_path,
      '^([^/?#[:space:]]+/)*(user-asset-thumbs/[^?#[:space:]]+)$', '\2'
    )
    ELSE NULL
  END
  FROM (
    SELECT regexp_replace(
      split_part(split_part(candidate_url, '?', 1), '#', 1), '^https?://[^/]+/', '', 'i'
    ) AS normalized_path
    WHERE candidate_url ~* '^https?://[^/?#]+/'
  ) AS parsed;
$$;

CREATE OR REPLACE FUNCTION content_addressed_object_key(candidate_url TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN reference_storage_authority_is_recognized(candidate_url)
      AND reference_storage_path_object_key(candidate_url) LIKE 'user-assets/by-content/%'
    THEN reference_storage_path_object_key(candidate_url)
    ELSE NULL
  END;
$$;

CREATE OR REPLACE FUNCTION thumbnail_object_key(candidate_url TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN reference_storage_authority_is_recognized(candidate_url)
      AND reference_storage_path_object_key(candidate_url) LIKE 'user-asset-thumbs/%'
    THEN reference_storage_path_object_key(candidate_url)
    ELSE NULL
  END;
$$;

CREATE OR REPLACE FUNCTION unrecognized_reference_storage_object_key(candidate_url TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN NOT reference_storage_authority_is_recognized(candidate_url)
    THEN reference_storage_path_object_key(candidate_url)
    ELSE NULL
  END;
$$;

CREATE OR REPLACE FUNCTION reference_storage_object_key(candidate_url TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(content_addressed_object_key(candidate_url), thumbnail_object_key(candidate_url));
$$;

CREATE OR REPLACE FUNCTION fence_canonical_content_addressed_asset()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  candidate_key TEXT;
  fenced_key TEXT;
  candidate_keys TEXT[];
BEGIN
  candidate_keys := ARRAY[
    COALESCE(reference_storage_object_key(to_jsonb(NEW)->>'url'),
      unrecognized_reference_storage_object_key(to_jsonb(NEW)->>'url')),
    COALESCE(reference_storage_object_key(to_jsonb(NEW)->>'thumb_url'),
      unrecognized_reference_storage_object_key(to_jsonb(NEW)->>'thumb_url')),
    COALESCE(reference_storage_object_key(to_jsonb(NEW)->'metadata'->>'thumbUrl'),
      unrecognized_reference_storage_object_key(to_jsonb(NEW)->'metadata'->>'thumbUrl'))
  ];
  FOREACH candidate_key IN ARRAY candidate_keys LOOP
    CONTINUE WHEN candidate_key IS NULL;
    fenced_key := NULL;
    INSERT INTO mcp_reference_upload_object_fences (object_key, state, created_at, updated_at)
    VALUES (candidate_key, 'referenced', clock_timestamp(), clock_timestamp())
    ON CONFLICT (object_key) DO UPDATE
      SET state = 'referenced', updated_at = clock_timestamp()
      WHERE mcp_reference_upload_object_fences.state IN ('available', 'producing', 'referenced', 'orphaned')
    RETURNING object_key INTO fenced_key;
    IF fenced_key IS NULL THEN
      RAISE EXCEPTION 'storage object is deleted or being deleted; retry persistence'
        USING ERRCODE = '40001';
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS user_assets_fence_content_addressed_object ON user_assets;
CREATE TRIGGER user_assets_fence_content_addressed_object
  BEFORE INSERT OR UPDATE OF url, metadata ON user_assets
  FOR EACH ROW EXECUTE FUNCTION fence_canonical_content_addressed_asset();

DROP TRIGGER IF EXISTS media_assets_fence_content_addressed_object ON media_assets;
CREATE TRIGGER media_assets_fence_content_addressed_object
  BEFORE INSERT OR UPDATE OF url, thumb_url ON media_assets
  FOR EACH ROW EXECUTE FUNCTION fence_canonical_content_addressed_asset();

CREATE OR REPLACE FUNCTION release_unreferenced_content_addressed_asset()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  previous_key TEXT;
  previous_keys TEXT[];
  next_keys TEXT[];
BEGIN
  previous_keys := ARRAY[
    COALESCE(reference_storage_object_key(to_jsonb(OLD)->>'url'),
      unrecognized_reference_storage_object_key(to_jsonb(OLD)->>'url')),
    COALESCE(reference_storage_object_key(to_jsonb(OLD)->>'thumb_url'),
      unrecognized_reference_storage_object_key(to_jsonb(OLD)->>'thumb_url')),
    COALESCE(reference_storage_object_key(to_jsonb(OLD)->'metadata'->>'thumbUrl'),
      unrecognized_reference_storage_object_key(to_jsonb(OLD)->'metadata'->>'thumbUrl'))
  ];
  IF TG_OP = 'DELETE' OR (TG_TABLE_NAME = 'media_assets' AND to_jsonb(NEW)->>'deleted_at' IS NOT NULL) THEN
    next_keys := ARRAY[]::TEXT[];
  ELSE
    next_keys := ARRAY[
      COALESCE(reference_storage_object_key(to_jsonb(NEW)->>'url'),
        unrecognized_reference_storage_object_key(to_jsonb(NEW)->>'url')),
      COALESCE(reference_storage_object_key(to_jsonb(NEW)->>'thumb_url'),
        unrecognized_reference_storage_object_key(to_jsonb(NEW)->>'thumb_url')),
      COALESCE(reference_storage_object_key(to_jsonb(NEW)->'metadata'->>'thumbUrl'),
        unrecognized_reference_storage_object_key(to_jsonb(NEW)->'metadata'->>'thumbUrl'))
    ];
  END IF;
  FOREACH previous_key IN ARRAY previous_keys LOOP
    CONTINUE WHEN previous_key IS NULL OR previous_key = ANY(next_keys);
    UPDATE mcp_reference_upload_object_fences AS fences
       SET state = 'orphaned', producer_claim_id = NULL,
           producer_lease_expires_at = NULL, updated_at = clock_timestamp()
     WHERE fences.object_key = previous_key
       AND fences.state = 'referenced'
       AND (fences.producer_claim_id IS NULL OR fences.producer_lease_expires_at <= clock_timestamp())
       AND NOT EXISTS (SELECT 1 FROM user_assets AS assets
         WHERE reference_storage_object_key(assets.url) = previous_key
            OR reference_storage_object_key(assets.metadata->>'thumbUrl') = previous_key)
       AND NOT EXISTS (SELECT 1 FROM media_assets AS media
         WHERE media.deleted_at IS NULL
           AND (reference_storage_object_key(media.url) = previous_key
             OR reference_storage_object_key(media.thumb_url) = previous_key));
  END LOOP;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS user_assets_release_content_addressed_object ON user_assets;
CREATE TRIGGER user_assets_release_content_addressed_object
  AFTER DELETE OR UPDATE OF url, metadata ON user_assets
  FOR EACH ROW EXECUTE FUNCTION release_unreferenced_content_addressed_asset();

DROP TRIGGER IF EXISTS media_assets_release_content_addressed_object ON media_assets;
CREATE TRIGGER media_assets_release_content_addressed_object
  AFTER DELETE OR UPDATE OF url, thumb_url, deleted_at ON media_assets
  FOR EACH ROW EXECUTE FUNCTION release_unreferenced_content_addressed_asset();

CREATE OR REPLACE FUNCTION release_deleted_mcp_reference_asset()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM mcp_reference_upload_attempts AS attempts
    WHERE attempts.user_id = NEW.user_id
      AND attempts.staged_asset_id = NEW.public_id
      AND attempts.state = 'completed') THEN
    RETURN NEW;
  END IF;

  DELETE FROM user_assets AS legacy
   WHERE legacy.user_id = NEW.user_id
     AND legacy.url = NEW.url
     AND NOT EXISTS (SELECT 1 FROM media_assets AS live
       WHERE live.id = legacy.asset_id
         AND live.user_id = legacy.user_id
         AND live.url = legacy.url
         AND live.deleted_at IS NULL);

  UPDATE mcp_reference_upload_cleanup_objects AS cleanup
     SET state = 'released', updated_at = clock_timestamp()
    FROM mcp_reference_upload_attempts AS attempts
   WHERE attempts.session_id = cleanup.session_id
     AND attempts.upload_id = cleanup.upload_id
     AND attempts.user_id = cleanup.user_id
     AND attempts.media_kind = cleanup.media_kind
     AND attempts.user_id = NEW.user_id
     AND attempts.staged_asset_id = NEW.public_id
     AND attempts.state = 'completed'
     AND cleanup.state = 'retained'
     AND cleanup.object_role IN ('final', 'thumbnail');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS media_assets_release_deleted_mcp_reference ON media_assets;
CREATE TRIGGER media_assets_release_deleted_mcp_reference
  AFTER UPDATE OF deleted_at ON media_assets
  FOR EACH ROW
  WHEN (OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL)
  EXECUTE FUNCTION release_deleted_mcp_reference_asset();
