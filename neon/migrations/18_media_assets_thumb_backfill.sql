-- Backfill saved Library asset thumbnails from canonical job outputs.
-- Idempotent: only rows with a missing media_assets.thumb_url are updated.

WITH matched AS (
  SELECT DISTINCT ON (asset.id)
    asset.id AS asset_id,
    output.thumb_url
  FROM media_assets asset
  JOIN job_outputs output
    ON output.user_id = asset.user_id
   AND output.kind = asset.kind
   AND output.status <> 'deleted'
   AND output.thumb_url IS NOT NULL
  WHERE asset.deleted_at IS NULL
    AND asset.thumb_url IS NULL
    AND (
      (
        asset.source_output_id IS NOT NULL
        AND output.id = asset.source_output_id
      )
      OR (
        asset.source_job_id IS NOT NULL
        AND output.job_id = asset.source_job_id
        AND (
          output.url = asset.url
          OR output.storage_url = asset.url
          OR output.url = asset.metadata->>'originUrl'
          OR output.storage_url = asset.metadata->>'originUrl'
        )
      )
    )
  ORDER BY
    asset.id,
    CASE
      WHEN asset.source_output_id IS NOT NULL AND output.id = asset.source_output_id THEN 0
      WHEN output.url = asset.url THEN 1
      WHEN output.storage_url = asset.url THEN 2
      WHEN output.url = asset.metadata->>'originUrl' THEN 3
      WHEN output.storage_url = asset.metadata->>'originUrl' THEN 4
      ELSE 5
    END,
    output.position ASC,
    output.created_at DESC
)
UPDATE media_assets asset
   SET thumb_url = matched.thumb_url,
       metadata = COALESCE(asset.metadata, '{}'::jsonb) || jsonb_build_object('thumbUrl', matched.thumb_url),
       updated_at = NOW()
  FROM matched
 WHERE asset.id = matched.asset_id
   AND asset.thumb_url IS NULL;

WITH job_fallback AS (
  SELECT DISTINCT ON (asset.id)
    asset.id AS asset_id,
    output.thumb_url
  FROM media_assets asset
  JOIN job_outputs output
    ON output.user_id = asset.user_id
   AND output.kind = asset.kind
   AND output.job_id = asset.source_job_id
   AND output.status <> 'deleted'
   AND output.thumb_url IS NOT NULL
  WHERE asset.deleted_at IS NULL
    AND asset.kind = 'image'
    AND asset.thumb_url IS NULL
    AND asset.source IN ('saved_job_output', 'angle', 'character', 'upscale')
  ORDER BY asset.id, output.position ASC, output.created_at DESC
)
UPDATE media_assets asset
   SET thumb_url = job_fallback.thumb_url,
       metadata = COALESCE(asset.metadata, '{}'::jsonb) || jsonb_build_object('thumbUrl', job_fallback.thumb_url),
       updated_at = NOW()
  FROM job_fallback
 WHERE asset.id = job_fallback.asset_id
   AND asset.thumb_url IS NULL;

UPDATE user_assets legacy
   SET metadata = COALESCE(legacy.metadata, '{}'::jsonb) || jsonb_build_object('thumbUrl', asset.thumb_url)
  FROM media_assets asset
 WHERE legacy.asset_id = asset.id
   AND asset.thumb_url IS NOT NULL
   AND legacy.metadata->>'thumbUrl' IS NULL;
