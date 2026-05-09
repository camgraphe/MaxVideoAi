import { query } from '@/lib/db';

const FEATURE_LAUNCH_TIMESTAMP: string = (() => {
  const fromEnv =
    process.env.FEATURE_LAUNCH_TIMESTAMP ??
    process.env.NEXT_PUBLIC_FEATURE_LAUNCH_TIMESTAMP;
  if (fromEnv && fromEnv.trim().length) {
    return fromEnv.trim();
  }
  return '2025-01-01T00:00:00Z';
})();

export async function ensureBillingContentSchema(): Promise<void> {
    await query(`
      CREATE TABLE IF NOT EXISTS playlists (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        slug TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        is_public BOOLEAN NOT NULL DEFAULT TRUE,
        created_by UUID,
        updated_by UUID,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS playlist_items (
        playlist_id UUID NOT NULL,
        video_id TEXT NOT NULL,
        order_index INTEGER NOT NULL DEFAULT 0,
        pinned BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (playlist_id, video_id)
      );
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS playlist_items_playlist_idx ON playlist_items (playlist_id, order_index);
    `);

    await query(`
      ALTER TABLE playlist_items
      ALTER COLUMN video_id TYPE TEXT USING video_id::text;
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS homepage_sections (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        key TEXT NOT NULL,
        type TEXT NOT NULL,
        title TEXT,
        subtitle TEXT,
        video_id TEXT,
        playlist_id UUID,
        order_index INTEGER NOT NULL DEFAULT 0,
        enabled BOOLEAN NOT NULL DEFAULT TRUE,
        start_at TIMESTAMPTZ,
        end_at TIMESTAMPTZ,
        updated_by UUID,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS homepage_sections_active_idx ON homepage_sections (enabled, order_index);
    `);

    await query(`
      ALTER TABLE homepage_sections
      ALTER COLUMN video_id TYPE TEXT USING video_id::text;
    `);

    await query(
      `
        UPDATE app_jobs
        SET visibility = 'private',
            indexable = FALSE,
            legacy_migrated = TRUE
        WHERE legacy_migrated IS NOT TRUE
          AND created_at < $1::timestamptz;
      `,
      [FEATURE_LAUNCH_TIMESTAMP]
    );
}
