-- Canonical animated previews for video outputs and saved media assets.
-- video_url/url remains the final media; thumb_url remains the static thumbnail.

ALTER TABLE job_outputs
  ADD COLUMN IF NOT EXISTS preview_url TEXT;

ALTER TABLE media_assets
  ADD COLUMN IF NOT EXISTS preview_url TEXT;

UPDATE job_outputs output
   SET preview_url = COALESCE(output.preview_url, to_jsonb(job)->>'preview_video_url'),
       metadata = COALESCE(output.metadata, '{}'::jsonb)
         || jsonb_strip_nulls(jsonb_build_object('previewUrl', to_jsonb(job)->>'preview_video_url')),
       updated_at = NOW()
  FROM app_jobs job
 WHERE output.job_id = job.job_id
   AND output.kind = 'video'
   AND output.preview_url IS NULL
   AND COALESCE(to_jsonb(job)->>'preview_video_url', '') <> '';

WITH matched AS (
  SELECT DISTINCT ON (asset.id)
    asset.id AS asset_id,
    output.preview_url
  FROM media_assets asset
  JOIN job_outputs output
    ON output.user_id = asset.user_id
   AND output.kind = asset.kind
   AND output.status <> 'deleted'
   AND output.preview_url IS NOT NULL
  WHERE asset.deleted_at IS NULL
    AND asset.kind = 'video'
    AND asset.preview_url IS NULL
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
   SET preview_url = matched.preview_url,
       metadata = COALESCE(asset.metadata, '{}'::jsonb) || jsonb_build_object('previewUrl', matched.preview_url),
       updated_at = NOW()
  FROM matched
 WHERE asset.id = matched.asset_id
   AND asset.preview_url IS NULL;

WITH job_fallback AS (
  SELECT DISTINCT ON (asset.id)
    asset.id AS asset_id,
    output.preview_url
  FROM media_assets asset
  JOIN job_outputs output
    ON output.user_id = asset.user_id
   AND output.kind = 'video'
   AND output.job_id = COALESCE(asset.source_job_id, asset.metadata->>'jobId', asset.metadata->>'sourceJobId')
   AND output.status <> 'deleted'
   AND output.preview_url IS NOT NULL
  WHERE asset.deleted_at IS NULL
    AND asset.kind = 'video'
    AND asset.preview_url IS NULL
    AND asset.source IN ('saved_job_output', 'upscale', 'import')
  ORDER BY asset.id, output.position ASC, output.created_at DESC
)
UPDATE media_assets asset
   SET preview_url = job_fallback.preview_url,
       metadata = COALESCE(asset.metadata, '{}'::jsonb) || jsonb_build_object('previewUrl', job_fallback.preview_url),
       updated_at = NOW()
  FROM job_fallback
 WHERE asset.id = job_fallback.asset_id
   AND asset.preview_url IS NULL;

UPDATE user_assets legacy
   SET metadata = COALESCE(legacy.metadata, '{}'::jsonb) || jsonb_build_object('previewUrl', asset.preview_url)
  FROM media_assets asset
 WHERE legacy.asset_id = asset.id
   AND asset.preview_url IS NOT NULL
   AND legacy.metadata->>'previewUrl' IS NULL;
