import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import test from 'node:test';
import { transformSync } from 'esbuild';
import { createPaidGenerationTestSchema, startDisposablePostgres } from './helpers/disposable-postgres';
import { getDb } from '../frontend/src/lib/db';
import { readRecentGenerationRecordsForWeb } from '../frontend/src/server/generations/recent-generations';
import type { VideoGroup } from '../frontend/types/video-groups';

// The real preview route reads the same disposable DB; replace only the signed-in identity.
function authenticatedPreview(userId: string): Promise<VideoGroup | null> {
  const filename = resolve('frontend/src/server/app-initial-preview.ts');
  const source = readFileSync(filename, 'utf8');
  const { code } = transformSync(source, { loader: 'ts', format: 'cjs' });
  const requireFromPreview = createRequire(filename);
  const fixture = { exports: {} as { resolveInitialAppPreviewGroup(): Promise<VideoGroup | null> } };
  new Function('module', 'exports', 'require', code)(fixture, fixture.exports, (id: string) =>
    id === '@/lib/supabase-ssr' ? { getRouteAuthContext: async () => ({ userId }) } : requireFromPreview(id));
  return fixture.exports.resolveInitialAppPreviewGroup();
}

test('personal workspace preview and both video feed paths recognize owned legacy videos', async t => {
  const db = await startDisposablePostgres('workspace-personal-video');
  const previous = process.env.DATABASE_URL;
  process.env.DATABASE_URL = db.databaseUrl;
  try {
    await createPaidGenerationTestSchema(db.pool);
    await db.pool.query(`
      INSERT INTO app_jobs(job_id,user_id,surface,settings_snapshot,engine_id,video_url,thumb_url,render_ids,
                           status,hidden,visibility,created_at,updated_at)
      SELECT name,owner,surface,snapshot::jsonb,engine,video,'/poster.webp',renders::jsonb,
             status,hidden,'private',TIMESTAMPTZ '2026-01-01' + n * INTERVAL '1 minute',NOW() - INTERVAL '1 hour'
      FROM (VALUES
        (1,'marked','owner','video','{"surface":"video"}','wan-2-6','/marked.mp4',NULL,'completed',false),
        (2,'null-recipe','owner','video',NULL,'wan-2-6','/old.mp4',NULL,'completed',false),
        (3,'missing-marker','owner','video','{"schemaVersion":1}','wan-2-6','/new.mp4',NULL,'completed',false),
        (3,'equal-timestamp','owner','video','{}','wan-2-6','/tied.mp4',NULL,'completed',false),
        (4,'foreign','other','video','{}','wan-2-6','/foreign.mp4',NULL,'completed',false),
        (5,'hidden','owner','video','{}','wan-2-6','/hidden.mp4',NULL,'completed',true),
        (6,'old-error','owner','video','{}','wan-2-6','/error.mp4',NULL,'failed',false),
        (7,'image-recipe','owner','video','{"surface":"image"}','unknown','/wrong.mp4',NULL,'completed',false),
        (8,'image-alias','owner','video','{}','gpt-image-2',NULL,NULL,'completed',false),
        (9,'image-renders','owner','video','{}',NULL,NULL,'["image"]','completed',false),
        (10,'storyboard_private','owner','video','{}','unknown','/wrong.mp4',NULL,'completed',false),
        (11,'tool_background_removal_private','owner','video','{}','unknown','/wrong.mp4',NULL,'completed',false),
        (12,'other-surface','owner','tool','{}','unknown','/wrong.mp4',NULL,'completed',false),
        (13,'external-import','owner','video','{"origin":"external_fal_import"}','wan-2-6','/external.mp4',NULL,'completed',false),
        (14,'unclassified','owner',NULL,NULL,NULL,NULL,NULL,'completed',false)
      ) AS fixture(n,name,owner,surface,snapshot,engine,video,renders,status,hidden)`);
    for (const requestedSurface of [null, 'video'] as const) {
      await t.test(requestedSurface ? 'explicit video surface' : 'video feed', async () => {
        const rows = await readRecentGenerationRecordsForWeb({ userId: 'owner', feedType: 'video', requestedSurface, limit: 24 });
        assert.deepEqual(rows.map(r => r.job_id), ['equal-timestamp','missing-marker','null-recipe','marked']);
      });
    }
    await t.test('image jobs retain their own history', async () => {
      const rows = await readRecentGenerationRecordsForWeb({ userId: 'owner', feedType: 'image', requestedSurface: null, limit: 24 });
      assert.deepEqual(rows.map(r => r.job_id), ['image-renders','image-alias','image-recipe']);
    });
    await t.test('first personal preview', async () => {
      const preview = await authenticatedPreview('owner');
      assert.equal(preview?.heroItemId, 'equal-timestamp');
      assert.equal(preview?.items[0].meta?.curated, false);
      assert.equal(await authenticatedPreview('nobody'), null);
    });
  } finally {
    await getDb().end();
    if (previous === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previous;
    await db.cleanup();
  }
});
