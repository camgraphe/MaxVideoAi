import { query } from '@/lib/db';

let ensureMediaLibraryPromise: Promise<void> | null = null;

export async function ensureMediaLibrarySchema(): Promise<void> {
  if (ensureMediaLibraryPromise) return ensureMediaLibraryPromise;

  const ensure = async () => {
  await query(`
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
  `);

  await query(`
    ALTER TABLE job_outputs
    ADD COLUMN IF NOT EXISTS preview_url TEXT;
  `);

  await query(`
    CREATE UNIQUE INDEX IF NOT EXISTS job_outputs_job_kind_position_idx
      ON job_outputs (job_id, kind, position);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS job_outputs_user_created_idx
      ON job_outputs (user_id, created_at DESC)
      WHERE user_id IS NOT NULL;
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS job_outputs_job_idx ON job_outputs (job_id);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS job_outputs_kind_idx ON job_outputs (kind);
  `);

  await query(`
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
      source TEXT NOT NULL CHECK (source IN ('upload','saved_job_output','storyboard','character','angle','upscale','import')),
      source_job_id TEXT,
      source_output_id TEXT,
      status TEXT NOT NULL DEFAULT 'ready',
      metadata JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at TIMESTAMPTZ
    );
  `);

  await query(`
    ALTER TABLE media_assets
    DROP CONSTRAINT IF EXISTS media_assets_source_check;
  `);

  await query(`
    UPDATE media_assets
    SET source = CASE
      WHEN source IN ('generated','job_output') THEN 'saved_job_output'
      WHEN source IN ('upload','saved_job_output','storyboard','character','angle','upscale','import','storyboard_template_reference') THEN source
      ELSE 'import'
    END
    WHERE source IS NULL
      OR source NOT IN ('upload','saved_job_output','storyboard','character','angle','upscale','import','storyboard_template_reference');
  `);

  await query(`
    ALTER TABLE media_assets
    ADD CONSTRAINT media_assets_source_check
    CHECK (source IN ('upload','saved_job_output','storyboard','character','angle','upscale','import','storyboard_template_reference'));
  `);

  await query(`
    ALTER TABLE media_assets
    ADD COLUMN IF NOT EXISTS preview_url TEXT;
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS media_assets_user_created_idx
      ON media_assets (user_id, created_at DESC)
      WHERE user_id IS NOT NULL AND deleted_at IS NULL;
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS media_assets_user_kind_created_idx
      ON media_assets (user_id, kind, created_at DESC)
      WHERE user_id IS NOT NULL AND deleted_at IS NULL;
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS media_assets_source_output_idx
      ON media_assets (source_output_id)
      WHERE source_output_id IS NOT NULL AND deleted_at IS NULL;
  `);

  await query(`
    CREATE UNIQUE INDEX IF NOT EXISTS media_assets_user_source_output_unique_idx
      ON media_assets (user_id, source_output_id)
      WHERE source_output_id IS NOT NULL AND deleted_at IS NULL;
  `);

  await query(`
    CREATE UNIQUE INDEX IF NOT EXISTS media_assets_user_kind_url_unique_idx
      ON media_assets (user_id, kind, url)
      WHERE source_output_id IS NULL AND deleted_at IS NULL;
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS media_assets_kind_idx ON media_assets (kind);
  `);
  };

  ensureMediaLibraryPromise = ensure().catch((error) => {
  ensureMediaLibraryPromise = null;
  console.error('[schema] Failed to ensure media library schema', error);
  throw error;
  });
  return ensureMediaLibraryPromise;
}
