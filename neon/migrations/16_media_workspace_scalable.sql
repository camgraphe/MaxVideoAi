CREATE TABLE IF NOT EXISTS job_outputs (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  user_id TEXT,
  workspace_id TEXT,
  kind TEXT NOT NULL CHECK (kind IN ('image','video','audio')),
  url TEXT NOT NULL,
  storage_url TEXT,
  thumb_url TEXT,
  preview_url TEXT,
  mime_type TEXT,
  width INTEGER,
  height INTEGER,
  duration_sec INTEGER,
  position INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'ready',
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE job_outputs
  ADD COLUMN IF NOT EXISTS preview_url TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS job_outputs_job_kind_position_idx
  ON job_outputs (job_id, kind, position);

CREATE INDEX IF NOT EXISTS job_outputs_user_created_idx
  ON job_outputs (user_id, created_at DESC)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS job_outputs_job_idx ON job_outputs (job_id);
CREATE INDEX IF NOT EXISTS job_outputs_kind_idx ON job_outputs (kind);

CREATE TABLE IF NOT EXISTS media_assets (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  workspace_id TEXT,
  kind TEXT NOT NULL CHECK (kind IN ('image','video','audio')),
  url TEXT NOT NULL,
  thumb_url TEXT,
  preview_url TEXT,
  mime_type TEXT,
  width INTEGER,
  height INTEGER,
  size_bytes BIGINT,
  source TEXT NOT NULL CHECK (source IN ('upload','saved_job_output','character','angle','upscale','import')),
  source_job_id TEXT,
  source_output_id TEXT,
  status TEXT NOT NULL DEFAULT 'ready',
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

ALTER TABLE media_assets
  ADD COLUMN IF NOT EXISTS preview_url TEXT;

CREATE INDEX IF NOT EXISTS media_assets_user_created_idx
  ON media_assets (user_id, created_at DESC)
  WHERE user_id IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS media_assets_user_kind_created_idx
  ON media_assets (user_id, kind, created_at DESC)
  WHERE user_id IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS media_assets_source_output_idx
  ON media_assets (source_output_id)
  WHERE source_output_id IS NOT NULL AND deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS media_assets_user_source_output_unique_idx
  ON media_assets (user_id, source_output_id)
  WHERE source_output_id IS NOT NULL AND deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS media_assets_user_kind_url_unique_idx
  ON media_assets (user_id, kind, url)
  WHERE source_output_id IS NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS media_assets_kind_idx ON media_assets (kind);

INSERT INTO job_outputs (
  id,
  job_id,
  user_id,
  kind,
  url,
  thumb_url,
  preview_url,
  mime_type,
  duration_sec,
  position,
  status,
  metadata,
  created_at,
  updated_at
)
SELECT
  app_jobs.job_id || ':video:0',
  app_jobs.job_id,
  app_jobs.user_id,
  'video',
  app_jobs.video_url,
  COALESCE(NULLIF(app_jobs.thumb_url, ''), app_jobs.preview_frame),
  to_jsonb(app_jobs)->>'preview_video_url',
  'video/mp4',
  app_jobs.duration_sec,
  0,
  CASE WHEN app_jobs.status = 'failed' THEN 'failed' ELSE 'ready' END,
  jsonb_build_object('legacy', true, 'surface', app_jobs.surface),
  app_jobs.created_at,
  app_jobs.updated_at
FROM app_jobs
WHERE COALESCE(app_jobs.video_url, '') <> ''
ON CONFLICT (job_id, kind, position) DO NOTHING;

INSERT INTO job_outputs (
  id,
  job_id,
  user_id,
  kind,
  url,
  mime_type,
  duration_sec,
  position,
  status,
  metadata,
  created_at,
  updated_at
)
SELECT
  app_jobs.job_id || ':audio:0',
  app_jobs.job_id,
  app_jobs.user_id,
  'audio',
  app_jobs.audio_url,
  'audio/mpeg',
  app_jobs.duration_sec,
  0,
  CASE WHEN app_jobs.status = 'failed' THEN 'failed' ELSE 'ready' END,
  jsonb_build_object('legacy', true, 'surface', app_jobs.surface),
  app_jobs.created_at,
  app_jobs.updated_at
FROM app_jobs
WHERE COALESCE(app_jobs.audio_url, '') <> ''
ON CONFLICT (job_id, kind, position) DO NOTHING;

INSERT INTO job_outputs (
  id,
  job_id,
  user_id,
  kind,
  url,
  thumb_url,
  preview_url,
  mime_type,
  width,
  height,
  position,
  status,
  metadata,
  created_at,
  updated_at
)
SELECT
  app_jobs.job_id || ':image:' || (render_entry.ordinality - 1)::text,
  app_jobs.job_id,
  app_jobs.user_id,
  'image',
  CASE
    WHEN jsonb_typeof(render_entry.value) = 'string' THEN trim(both '"' from render_entry.value::text)
    ELSE render_entry.value->>'url'
  END,
  CASE
    WHEN jsonb_typeof(render_entry.value) = 'object' THEN COALESCE(render_entry.value->>'thumb_url', render_entry.value->>'thumbUrl', render_entry.value->>'url')
    ELSE trim(both '"' from render_entry.value::text)
  END,
  NULL,
  CASE
    WHEN jsonb_typeof(render_entry.value) = 'object' THEN render_entry.value->>'mime_type'
    ELSE 'image/png'
  END,
  CASE
    WHEN jsonb_typeof(render_entry.value) = 'object' AND (render_entry.value->>'width') ~ '^[0-9]+$'
      THEN (render_entry.value->>'width')::integer
    ELSE NULL
  END,
  CASE
    WHEN jsonb_typeof(render_entry.value) = 'object' AND (render_entry.value->>'height') ~ '^[0-9]+$'
      THEN (render_entry.value->>'height')::integer
    ELSE NULL
  END,
  render_entry.ordinality - 1,
  CASE WHEN app_jobs.status = 'failed' THEN 'failed' ELSE 'ready' END,
  jsonb_build_object('legacy', true, 'surface', app_jobs.surface),
  app_jobs.created_at,
  app_jobs.updated_at
FROM app_jobs
CROSS JOIN LATERAL jsonb_array_elements(
  CASE
    WHEN jsonb_typeof(to_jsonb(app_jobs.render_ids)) = 'array' THEN to_jsonb(app_jobs.render_ids)
    ELSE '[]'::jsonb
  END
) WITH ORDINALITY AS render_entry(value, ordinality)
WHERE COALESCE(app_jobs.render_ids::text, '') <> ''
  AND COALESCE(
    CASE
      WHEN jsonb_typeof(render_entry.value) = 'string' THEN trim(both '"' from render_entry.value::text)
      ELSE render_entry.value->>'url'
    END,
    ''
  ) <> ''
ON CONFLICT (job_id, kind, position) DO NOTHING;

INSERT INTO media_assets (
  id,
  user_id,
  kind,
  url,
  thumb_url,
  preview_url,
  mime_type,
  width,
  height,
  size_bytes,
  source,
  source_job_id,
  status,
  metadata,
  created_at,
  updated_at
)
SELECT
  user_assets.asset_id,
  user_assets.user_id,
  CASE
    WHEN COALESCE(user_assets.mime_type, '') LIKE 'video/%' THEN 'video'
    WHEN COALESCE(user_assets.mime_type, '') LIKE 'audio/%' THEN 'audio'
    ELSE 'image'
  END,
  user_assets.url,
  user_assets.metadata->>'thumbUrl',
  user_assets.metadata->>'previewUrl',
  user_assets.mime_type,
  user_assets.width,
  user_assets.height,
  user_assets.size_bytes,
  CASE
    WHEN user_assets.source IN ('upload', 'character', 'angle', 'upscale') THEN user_assets.source
    WHEN user_assets.source = 'generated' THEN 'saved_job_output'
    ELSE 'import'
  END,
  user_assets.metadata->>'jobId',
  'ready',
  COALESCE(user_assets.metadata, '{}'::jsonb) || jsonb_build_object('legacyUserAsset', true),
  user_assets.created_at,
  user_assets.created_at
FROM user_assets
ON CONFLICT DO NOTHING;
