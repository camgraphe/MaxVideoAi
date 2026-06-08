import { query } from '@/lib/db';

export async function ensureTimelineExportSchema(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS app_timeline_exports (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      idempotency_key TEXT NOT NULL,
      project_name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'queued',
      progress INTEGER NOT NULL DEFAULT 0,
      message TEXT,
      duration_sec NUMERIC NOT NULL DEFAULT 0,
      resolution TEXT,
      fps INTEGER,
      quality_preset TEXT NOT NULL DEFAULT 'standard',
      amount_cents INTEGER NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'USD',
      billing_kind TEXT NOT NULL,
      billing_status TEXT NOT NULL,
      render_manifest JSONB NOT NULL,
      export_settings JSONB NOT NULL,
      output_url TEXT,
      output_asset_id TEXT,
      output_size_bytes BIGINT,
      output_mime_type TEXT,
      started_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,
      failed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    CREATE UNIQUE INDEX IF NOT EXISTS app_timeline_exports_user_idempotency_idx
      ON app_timeline_exports (user_id, idempotency_key);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS app_timeline_exports_user_created_idx
      ON app_timeline_exports (user_id, created_at DESC);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS app_timeline_exports_queue_idx
      ON app_timeline_exports (status, created_at ASC)
      WHERE status = 'queued';
  `);
}
