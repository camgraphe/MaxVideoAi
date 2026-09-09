import { readFile } from 'node:fs/promises';
import type { DisposablePostgres } from './disposable-postgres';
import { STUDIO_FIXTURE_OWNERS } from './studio-auth-fixture';
import { STUDIO_PRIVATE_MEDIA_HOST, STUDIO_PRIVATE_MEDIA_KEYS } from './studio-private-storage-fixture';

export const STUDIO_CONNECTED_ASSET_IDS = {
  a: `ma_${'1'.repeat(32)}`, b: `ma_${'2'.repeat(32)}`,
  foreign: `ma_${'3'.repeat(32)}`, unmeasured: `ma_${'4'.repeat(32)}`,
} as const;

export const STUDIO_CONNECTED_MONTAGE_INPUT = {
  title: 'Two real local clips',
  settings: { fps: 30, aspectRatio: '16:9', resolution: '1080p', audioMode: 'preserve' },
  clips: [
    { assetId: STUDIO_CONNECTED_ASSET_IDS.b, sourceInFrame: 30, durationFrames: 60 },
    { assetId: STUDIO_CONNECTED_ASSET_IDS.a, sourceInFrame: 15, durationFrames: 60 },
  ],
  idempotencyKey: 'studio-local-montage-1',
} as const;

/** Invoke ONLY as initializeDatabase of the verified, newly created Studio test runtime. */
export async function initializeStudioConnectedFixture(database: DisposablePostgres): Promise<void> {
  for (const name of [
    '26_studio_projects.sql', '29_mcp_audit_events.sql', '41_mcp_client_family.sql',
    '42_studio_connected_montages.sql',
  ]) {
    await database.pool.query(await readFile(`neon/migrations/${name}`, 'utf8'));
  }
  await database.pool.query(`
    CREATE TABLE IF NOT EXISTS user_roles (
      user_id text NOT NULL,
      role text NOT NULL,
      PRIMARY KEY (user_id, role)
    )
  `);
  await database.pool.query(`
    INSERT INTO user_roles (user_id, role)
    SELECT owner_id, 'admin'
    FROM unnest($1::text[]) AS owner_id
    ON CONFLICT DO NOTHING
  `, [[...STUDIO_FIXTURE_OWNERS]]);
  // Exact media-reader shapes only. This does not claim the full app/library/funnel schema.
  await database.pool.query(`
    CREATE TABLE app_jobs(job_id text PRIMARY KEY, user_id text NOT NULL, hidden boolean NOT NULL DEFAULT false);
    CREATE TABLE job_outputs(id uuid PRIMARY KEY, job_id text, user_id text, kind text, url text,
      storage_url text, mime_type text, status text, metadata jsonb);
    CREATE TABLE media_assets(id uuid PRIMARY KEY, public_id text UNIQUE NOT NULL, user_id text NOT NULL,
      kind text NOT NULL, url text NOT NULL, thumb_url text, preview_url text, mime_type text, status text,
      deleted_at timestamptz, source_job_id text, source_output_id uuid, original_name text, metadata jsonb);
  `);
  const mediaFacts = { source: 'probe', durationSec: 6, width: 320, height: 180, hasAudio: true };
  const entries = [
    { suffix: 1, assetId: STUDIO_CONNECTED_ASSET_IDS.a, owner: STUDIO_FIXTURE_OWNERS[0], key: STUDIO_PRIVATE_MEDIA_KEYS.a, name: 'Pattern A', metadata: { mediaFacts } },
    { suffix: 2, assetId: STUDIO_CONNECTED_ASSET_IDS.b, owner: STUDIO_FIXTURE_OWNERS[0], key: STUDIO_PRIVATE_MEDIA_KEYS.b, name: 'Pattern B', metadata: { mediaFacts } },
    { suffix: 3, assetId: STUDIO_CONNECTED_ASSET_IDS.foreign, owner: STUDIO_FIXTURE_OWNERS[1], key: STUDIO_PRIVATE_MEDIA_KEYS.foreign, name: 'Foreign pattern', metadata: { mediaFacts } },
    { suffix: 4, assetId: STUDIO_CONNECTED_ASSET_IDS.unmeasured, owner: STUDIO_FIXTURE_OWNERS[0], key: STUDIO_PRIVATE_MEDIA_KEYS.a, name: 'Unmeasured declaration', metadata: { durationSec: 6 } },
  ];
  for (const item of entries) {
    await database.pool.query(`INSERT INTO media_assets
      (id, public_id, user_id, kind, url, mime_type, status, original_name, metadata)
      VALUES ($1, $2, $3, 'video', $4, 'video/mp4', 'ready', $5, $6::jsonb)`, [
      `20000000-0000-4000-8000-${String(item.suffix).padStart(12, '0')}`,
      item.assetId, item.owner, `https://${STUDIO_PRIVATE_MEDIA_HOST}/${item.key}`, item.name, JSON.stringify(item.metadata),
    ]);
  }
}
