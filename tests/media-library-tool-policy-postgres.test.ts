import assert from 'node:assert/strict';
import test from 'node:test';
import { startDisposablePostgres } from './helpers/disposable-postgres';

test(
  'disabled tool sources are filtered before winners/count/page and frozen snapshots while review projections remain eligible',
  { timeout: 120000 },
  async (t) => {
    const pg = await startDisposablePostgres('library-tool-policy'),
      previous = process.env.DATABASE_URL;
    process.env.DATABASE_URL = pg.databaseUrl;
    const db = await import('../frontend/src/lib/db');
    t.after(async () => {
      await db.getDb().end();
      process.env.DATABASE_URL = previous;
      await pg.cleanup();
    });
    const schema = await import('../frontend/src/lib/schema');
    await schema.ensureAssetSchema();
    await schema.ensureMediaLibrarySchema();
    await schema.ensureMediaLibraryOrganizationSchema();
    await pg.pool
      .query(`CREATE TABLE app_jobs(job_id text PRIMARY KEY,user_id text,hidden boolean DEFAULT false,prompt text,surface text,settings_snapshot jsonb,duration_sec integer,aspect_ratio text,created_at timestamptz DEFAULT now());
 INSERT INTO app_jobs(job_id,user_id,prompt,surface,settings_snapshot) VALUES('policy-job','policy','tool output','image','{}');
 INSERT INTO job_outputs(id,job_id,user_id,kind,url,position,created_at) VALUES('policy-output','policy-job','policy','image','https://test/policy/output.png',0,'2026-01-05');
 INSERT INTO media_assets(id,public_id,user_id,kind,url,source,source_job_id,source_output_id,metadata,created_at)
 SELECT 'hidden-'||i,'ma_hidden_'||i,'policy','image','https://test/policy/hidden/'||i,(ARRAY['storyboard','character','angle'])[1+(i%3)],NULL,NULL,'{}','2026-02-01'::timestamptz+i*interval '1 second' FROM generate_series(1,35)i;
 INSERT INTO media_assets(id,public_id,user_id,kind,url,source,metadata,created_at) VALUES
 ('policy-upload','ma_policy_upload','policy','image','https://test/policy/upload.png','upload','{}','2026-01-01'),
 ('policy-upscale','ma_policy_upscale','policy','image','https://test/policy/upscale.png','upscale','{}','2026-01-02'),
 ('policy-bg','ma_policy_bg','policy','image','https://test/policy/bg.png','background-removal','{}','2026-01-03');
 INSERT INTO media_assets(id,public_id,user_id,kind,url,source,source_job_id,source_output_id,metadata,created_at) VALUES('policy-hidden-copy','ma_policy_hidden_copy','policy','image','https://test/policy/output.png','character','policy-job','policy-output','{}','2026-01-05');
 INSERT INTO user_assets(asset_id,user_id,url,mime_type,source,metadata,created_at) VALUES('policy-legacy','policy','https://test/policy/legacy.png','image/png','character','{}','2026-03-01');`);
    const { browseLibrary } = await import('../frontend/server/media-library/browse');
    const { createLibrarySelectionSnapshot } = await import(
      '../frontend/server/media-library/selection'
    );
    const scope = { view: 'all', kind: 'all', sort: 'recent' } as const;
    const hidden = await browseLibrary(
      { userId: 'policy', scope, limit: 2 },
      { toolsEnabled: false }
    );
    assert.equal(hidden.totalCount, 4);
    assert.deepEqual(
      hidden.assets.map((a) => a.id),
      ['output:policy-output', 'policy-bg']
    );
    const second = await browseLibrary(
      { userId: 'policy', scope, limit: 2, cursor: hidden.nextCursor },
      { toolsEnabled: false }
    );
    assert.deepEqual(
      second.assets.map((a) => a.id),
      ['policy-upscale', 'policy-upload']
    );
    assert.equal(second.hasMore, false);
    const snapshot = await createLibrarySelectionSnapshot(
      { userId: 'policy', scope },
      { toolsEnabled: false }
    );
    assert.equal(snapshot.totalCount, 4);
    assert.deepEqual(
      new Set(snapshot.keys),
      new Set([...hidden.assets, ...second.assets].map((a) => a.organization.key))
    );
    const shown = await browseLibrary(
      { userId: 'policy', scope, limit: 30 },
      { toolsEnabled: true }
    );
    assert.equal(shown.totalCount, 40);
    assert.equal(shown.assets.length, 30);
    assert.ok(shown.assets.every((a) => ['storyboard', 'character', 'angle'].includes(a.source!)));
    await assert.rejects(
      browseLibrary(
        { userId: 'policy', scope, limit: 2, cursor: hidden.nextCursor },
        { toolsEnabled: true }
      ),
      /INVALID_CURSOR/
    );
    assert.equal(
      (await createLibrarySelectionSnapshot({ userId: 'policy', scope }, { toolsEnabled: true }))
        .totalCount,
      40
    );
    const review = await browseLibrary(
      { userId: 'policy', scope: { ...scope, view: 'review' } },
      { toolsEnabled: false }
    );
    assert.equal(review.totalCount, 1);
    assert.equal(review.assets[0].source, 'saved_job_output');
    const saved = await browseLibrary(
      { userId: 'policy', scope: { ...scope, view: 'saved' } },
      { toolsEnabled: false }
    );
    assert.equal(saved.totalCount, 3);
  }
);
