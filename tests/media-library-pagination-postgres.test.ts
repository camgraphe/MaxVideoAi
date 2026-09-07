import assert from 'node:assert/strict';
import test from 'node:test';

import { missingDisposablePostgresCommand, startDisposablePostgres } from './helpers/disposable-postgres';

test('recent output search and cursors run against PostgreSQL', { timeout: 90_000 }, async (t) => {
  const missing = missingDisposablePostgresCommand();
  if (missing) return t.skip(`local PostgreSQL command unavailable: ${missing}`);
  const database = await startDisposablePostgres('media-library-pagination');
  t.after(database.cleanup);

  await database.pool.query(`
    CREATE TABLE app_jobs (
      job_id text PRIMARY KEY,
      user_id text NOT NULL,
      prompt text,
      duration_sec integer,
      aspect_ratio text,
      surface text,
      settings_snapshot jsonb,
      hidden boolean DEFAULT false,
      created_at timestamptz NOT NULL DEFAULT now()
    );
  `);

  const timestamp = '2026-09-01T10:00:00.000Z';
  for (const userId of ['user-a', 'user-b']) {
    for (let index = 0; index < 125; index += 1) {
      const suffix = String(index).padStart(3, '0');
      const jobId = `${userId}-job-${suffix}`;
      const prompt = index === 118 ? 'literal 100%_match\\ token' : `ordinary prompt ${suffix}`;
      await database.pool.query(
        `INSERT INTO app_jobs (job_id,user_id,prompt,surface,settings_snapshot,created_at)
         VALUES ($1,$2,$3,'image','{}'::jsonb,$4)`,
        [jobId, userId, prompt, timestamp]
      );
      await database.pool.query(
        `INSERT INTO job_outputs
          (id,job_id,user_id,kind,url,mime_type,position,status,metadata,created_at)
         VALUES ($1,$2,$3,'image',$4,'image/png',0,'ready','{}'::jsonb,$5)`,
        [`output-${userId}-${suffix}`, jobId, userId, `https://example.test/${jobId}.png`, timestamp]
      ).catch(async (error) => {
        if (String(error).includes('job_outputs')) {
          process.env.DATABASE_URL = database.databaseUrl;
          const { ensureMediaLibrarySchema } = await import('../frontend/src/lib/schema');
          await ensureMediaLibrarySchema();
          await database.pool.query(
            `INSERT INTO job_outputs
              (id,job_id,user_id,kind,url,mime_type,position,status,metadata,created_at)
             VALUES ($1,$2,$3,'image',$4,'image/png',0,'ready','{}'::jsonb,$5)`,
            [`output-${userId}-${suffix}`, jobId, userId, `https://example.test/${jobId}.png`, timestamp]
          );
        } else {
          throw error;
        }
      });
    }
  }

  const previousDatabaseUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL = database.databaseUrl;
  try {
    const { listRecentOutputPage } = await import('../frontend/server/media-library/job-outputs');
    const { listLibraryAssetPage } = await import('../frontend/server/media-library/assets');
    const { ensureAssetSchema } = await import('../frontend/src/lib/schema');
    await ensureAssetSchema();

    const ids: string[] = [];
    let cursor: string | null = null;
    do {
      const page = await listRecentOutputPage({ userId: 'user-a', kind: 'image', limit: 60, cursor });
      ids.push(...page.items.map((item) => item.id));
      cursor = page.nextCursor;
    } while (cursor);
    assert.equal(ids.length, 125);
    assert.equal(new Set(ids).size, 125);
    assert.ok(ids.every((id) => id.includes('user-a')), 'cursor pages must remain account isolated');

    const literalWildcard = await listRecentOutputPage({
      userId: 'user-a',
      kind: 'image',
      q: '100%_match\\',
      limit: 60,
    });
    assert.deepEqual(literalWildcard.items.map((item) => item.jobId), ['user-a-job-118']);

    const oldJob = await listRecentOutputPage({
      userId: 'user-a',
      kind: 'image',
      jobId: 'user-a-job-004',
      limit: 60,
    });
    assert.deepEqual(oldJob.items.map((item) => item.jobId), ['user-a-job-004']);

    const otherUser = await listRecentOutputPage({
      userId: 'user-b',
      kind: 'image',
      q: '100%_match\\',
      limit: 60,
    });
    assert.deepEqual(otherUser.items.map((item) => item.jobId), ['user-b-job-118']);

    for (let index = 0; index < 125; index += 1) {
      const suffix = String(index).padStart(3, '0');
      const originUrl = index === 100
        ? 'https://origin.example.test/cross-boundary.png'
        : `https://example.test/asset-a-${suffix}.png`;
      await database.pool.query(
        `INSERT INTO media_assets
          (id,user_id,kind,url,mime_type,source,status,metadata,created_at)
         VALUES ($1,'user-a','image',$2,'image/png','upload','ready',$3::jsonb,$4)`,
        [
          `asset-a-${suffix}`,
          `https://example.test/asset-a-${suffix}.png`,
          JSON.stringify({
            label: index === 118 ? 'saved 50%_literal\\ name' : `saved ${suffix}`,
            ...(index === 100 ? { originUrl } : {}),
          }),
          timestamp,
        ]
      );
      await database.pool.query(
        `INSERT INTO user_assets (asset_id,user_id,url,mime_type,source,metadata,created_at)
         VALUES ($1,'user-a',$2,'image/png','upload',$3::jsonb,$4)`,
        [
          `legacy-copy-${suffix}`,
          originUrl,
          JSON.stringify({ originUrl }),
          new Date(Date.parse(timestamp) - (index + 1) * 1000).toISOString(),
        ]
      );
    }
    await database.pool.query(
      `INSERT INTO user_assets (asset_id,user_id,url,mime_type,source,metadata,created_at)
       VALUES ('legacy-old','user-a','https://example.test/legacy.png','image/png','upload',
               '{"label":"legacy needle","jobId":"legacy-job"}'::jsonb,$1)`,
      [timestamp]
    );
    await database.pool.query(
      `INSERT INTO media_assets
        (id,user_id,kind,url,mime_type,source,status,metadata,created_at)
       VALUES
        ('newer-video','user-a','video','https://example.test/newer.mp4','video/mp4','upload','ready','{}',
         '2026-09-02T10:00:00.000Z'),
        ('other-user-image','user-b','image','https://example.test/other.png','image/png','upload','ready','{}',
         '2026-09-02T10:00:00.000Z')`
    );

    const assetIds: string[] = [];
    cursor = null;
    do {
      const page = await listLibraryAssetPage({
        userId: 'user-a', kind: 'image', source: 'upload', limit: 60, cursor,
      });
      assetIds.push(...page.items.map((item) => item.id));
      cursor = page.nextCursor;
    } while (cursor);
    assert.equal(assetIds.length, 126);
    assert.equal(new Set(assetIds).size, 126);
    assert.ok(assetIds.every((id) => !id.startsWith('legacy-copy-')));
    assert.ok(!assetIds.includes('newer-video'), 'kind filtering must happen before the bounded result limit');
    assert.ok(!assetIds.includes('other-user-image'), 'ownership filtering must happen before the bounded result limit');

    const savedWildcard = await listLibraryAssetPage({
      userId: 'user-a', kind: 'image', source: 'upload', q: '50%_literal\\', limit: 60,
    });
    assert.deepEqual(savedWildcard.items.map((item) => item.id), ['asset-a-118']);
    const legacySearch = await listLibraryAssetPage({
      userId: 'user-a', kind: 'image', source: 'upload', q: 'legacy needle', limit: 60,
    });
    assert.deepEqual(legacySearch.items.map((item) => item.id), ['legacy-old']);

    const providerUrl = 'https://provider.example.test/user-a-job-004.png';
    const durableUrl = 'https://storage.example.test/user-a-job-004.png';
    await database.pool.query(
      `UPDATE job_outputs SET url = $1, storage_url = $2 WHERE id = 'output-user-a-004'`,
      [providerUrl, durableUrl]
    );
    const outputOriginal = await listLibraryAssetPage({
      userId: 'user-a', kind: 'image', source: 'saved_job_output', q: 'ordinary prompt 004', includeOutputs: true,
    });
    assert.deepEqual(outputOriginal.items.map((item) => ({ id: item.id, url: item.url })), [
      { id: 'output:output-user-a-004', url: durableUrl },
    ]);

    await database.pool.query(
      `INSERT INTO media_assets
        (id,user_id,kind,url,mime_type,source,source_job_id,source_output_id,status,metadata,created_at)
       VALUES
        ('saved-output-user-a-004','user-a','image',$1,'image/png','saved_job_output','user-a-job-004',
         'output-user-a-004','ready','{"label":"ordinary prompt 004"}'::jsonb,$2)`,
      [durableUrl, timestamp]
    );
    const deduplicatedOriginal = await listLibraryAssetPage({
      userId: 'user-a', kind: 'image', source: 'saved_job_output', q: 'ordinary prompt 004', includeOutputs: true,
    });
    assert.deepEqual(deduplicatedOriginal.items.map((item) => ({ id: item.id, url: item.url })), [
      { id: 'saved-output-user-a-004', url: durableUrl },
    ]);
  } finally {
    const { getDb } = await import('../frontend/src/lib/db');
    await getDb().end();
    if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousDatabaseUrl;
  }
});
