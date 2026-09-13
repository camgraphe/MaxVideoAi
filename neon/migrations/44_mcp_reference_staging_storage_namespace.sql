-- Preserve the dedicated staging namespace in durable cleanup identities while
-- retaining the existing production content-addressed and thumbnail keys.

ALTER TABLE mcp_reference_upload_object_fences
  DROP CONSTRAINT IF EXISTS mcp_reference_upload_object_fence_key;
ALTER TABLE mcp_reference_upload_object_fences
  ADD CONSTRAINT mcp_reference_upload_object_fence_key CHECK (
    length(object_key) BETWEEN 1 AND 1024
    AND object_key = btrim(object_key)
    AND (
      object_key LIKE 'user-assets/by-content/%'
      OR object_key LIKE 'user-asset-thumbs/%'
      OR object_key LIKE 'mcp-reference-staging/user-assets/by-content/%'
      OR object_key LIKE 'mcp-reference-staging/user-asset-thumbs/%'
    )
  ) NOT VALID;

CREATE OR REPLACE FUNCTION reference_storage_path_object_key(candidate_url TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN normalized_path ~ '^([^/?#[:space:]]+/)*(mcp-reference-staging/user-assets/by-content/[^?#[:space:]]+)$'
    THEN regexp_replace(
      normalized_path,
      '^([^/?#[:space:]]+/)*(mcp-reference-staging/user-assets/by-content/[^?#[:space:]]+)$', '\2'
    )
    WHEN normalized_path ~ '^([^/?#[:space:]]+/)*(mcp-reference-staging/user-asset-thumbs/[^?#[:space:]]+)$'
    THEN regexp_replace(
      normalized_path,
      '^([^/?#[:space:]]+/)*(mcp-reference-staging/user-asset-thumbs/[^?#[:space:]]+)$', '\2'
    )
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
      AND (
        reference_storage_path_object_key(candidate_url) LIKE 'user-assets/by-content/%'
        OR reference_storage_path_object_key(candidate_url) LIKE 'mcp-reference-staging/user-assets/by-content/%'
      )
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
      AND (
        reference_storage_path_object_key(candidate_url) LIKE 'user-asset-thumbs/%'
        OR reference_storage_path_object_key(candidate_url) LIKE 'mcp-reference-staging/user-asset-thumbs/%'
      )
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
