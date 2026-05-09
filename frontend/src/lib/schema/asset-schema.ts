import { query } from '@/lib/db';

let ensureAssetsPromise: Promise<void> | null = null;

export async function ensureAssetSchema(): Promise<void> {
  if (ensureAssetsPromise) return ensureAssetsPromise;

  const ensure = async () => {
  await query(`
    CREATE TABLE IF NOT EXISTS user_assets (
      id BIGSERIAL PRIMARY KEY,
      asset_id TEXT NOT NULL UNIQUE,
      user_id TEXT,
      url TEXT NOT NULL,
      mime_type TEXT,
      width INTEGER,
      height INTEGER,
      size_bytes BIGINT,
      source TEXT,
      metadata JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS user_assets_user_created_idx ON user_assets (user_id, created_at DESC);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS user_assets_user_source_origin_idx
    ON user_assets (user_id, source, (metadata->>'originUrl'));
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS user_assets_user_source_sha_idx
    ON user_assets (user_id, source, (metadata->>'contentSha256'));
  `);
  };

  ensureAssetsPromise = ensure().catch((error) => {
  ensureAssetsPromise = null;
  console.error('[schema] Failed to ensure asset schema', error);
  throw error;
  });

  await ensureAssetsPromise;
}
