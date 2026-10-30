import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { startDisposablePostgres } from './helpers/disposable-postgres';
import type { QueryExecutor } from '../frontend/src/lib/db';
import { deleteMarketingVideo, updateMarketingVisibility } from '../frontend/server/marketing-media/manage';
import { listMarketingPlacements } from '../frontend/server/marketing-media/placements';
import { readMarketingRow } from '../frontend/server/marketing-media/store';
import { marketingVideoReader } from '../frontend/server/marketing-media/public-read';

test('marketing deletion protects placements, leaves the personal source intact and rejects stale placement writes', async (t) => {
  const db = await startDisposablePostgres('marketing-management');
  const query: QueryExecutor['query'] = async (sql, params) => (await db.pool.query(sql, params as any[])).rows;
  const transaction = async <T>(run: (executor: QueryExecutor) => Promise<T>): Promise<T> => {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await run({ query: async (sql, params) => (await client.query(sql, params as any[])).rows });
      await client.query('COMMIT');
      return result;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  };
  const purged: string[] = [];
  const deps = {
    db: { query },
    transaction,
    purge: async (id: string) => {
      purged.push(id);
    },
    enabled: true,
  };
  try {
    await query(`CREATE TABLE app_jobs(job_id text,video_url text,engine_id text NOT NULL);INSERT INTO app_jobs VALUES('stable','https://media.example/personal.mp4','luma-ray-3-2');
   CREATE TABLE playlists(id text PRIMARY KEY,name text,slug text,is_public boolean);CREATE TABLE playlist_items(playlist_id text,video_id text);
   CREATE TABLE homepage_sections(key text,video_id text);CREATE TABLE playlist_curations(playlist_id text,ordered_ids text[],opening_ids text[]);
   CREATE TABLE video_seo_pages(video_id text,seo_status text);
   INSERT INTO playlists VALUES('gallery','Gallery','gallery',true);INSERT INTO playlist_items VALUES('gallery','stable');`);
    await query(readFileSync('neon/migrations/78_marketing_media.sql', 'utf8'));
    await query(`INSERT INTO marketing_media(video_id,copy_id,state,source_fingerprint,source_snapshot,source_record,publication,attempt_id,copied_by)
   VALUES('stable','00000000-0000-4000-8000-000000000001','ready','f','{}','{}','{"job_id":"stable","engine_id":"luma-ray-3-2","visibility":"public","indexable":true,"video_url":"https://media.example/marketing-media/original.mp4"}',gen_random_uuid(),'admin')`);
    assert.equal((await listMarketingPlacements((await readMarketingRow('stable', { query }))!, { query })).length, 2);
    await assert.rejects(deleteMarketingVideo('stable', deps), /used|placement/i);
    assert.equal(purged.length, 0);
    assert.equal((await updateMarketingVisibility('stable', { visibility: 'private' }, deps))?.indexable, false);
    await assert.rejects(deleteMarketingVideo('stable', deps), /used|placement/i);
    await query(`DELETE FROM playlist_items;INSERT INTO homepage_sections VALUES('hero','stable')`);
    await assert.rejects(deleteMarketingVideo('stable', deps), /used|placement/i);
    await query(`DELETE FROM homepage_sections;INSERT INTO playlist_curations VALUES('gallery',ARRAY['stable'],NULL)`);
    await assert.rejects(deleteMarketingVideo('stable', deps), /used|placement/i);
    await query('DELETE FROM playlist_curations');
    assert.equal(await deleteMarketingVideo('stable', deps), true);
    assert.equal(purged.length, 1);
    assert.equal(
      (await query<any>('SELECT video_url FROM app_jobs'))[0].video_url,
      'https://media.example/personal.mp4',
    );
    await assert.rejects(query(`INSERT INTO playlist_items VALUES('gallery','stable')`), /marketing media/i);
    assert.equal(await deleteMarketingVideo('stable', deps), true);
    assert.equal(purged.length, 1, 'deleted operation is idempotent');
    await t.test('stale editorial writes cannot publish a deleted marketing identity', async () => {
      await assert.rejects(query(`INSERT INTO video_seo_pages VALUES('stable','approved')`), /marketing media/i);
      await query(`INSERT INTO video_seo_pages VALUES('stable','disabled')`);
      await assert.rejects(
        query(`UPDATE video_seo_pages SET seo_status='approved' WHERE video_id='stable'`),
        /marketing media/i,
      );
      await query(`UPDATE video_seo_pages SET seo_status='disabled' WHERE video_id='stable'`);
    });
    await t.test(
      'cleaning up a never-ready attempt preserves its legacy source and placements throughout',
      async () => {
        await query(`INSERT INTO app_jobs VALUES('failed','https://media.example/failed.mp4','luma-ray-3-2');
        INSERT INTO playlist_items VALUES('gallery','failed');
        INSERT INTO marketing_media(video_id,copy_id,state,source_fingerprint,source_snapshot,source_record,attempt_id,copied_by)
        VALUES('failed',gen_random_uuid(),'failed','f','{}','{}',gen_random_uuid(),'admin')`);
        const reader = marketingVideoReader({ query }, true);
        const visible = async () => (await reader.query(`SELECT job_id FROM app_jobs WHERE job_id='failed'`)).length;
        assert.equal(await visible(), 1);
        await assert.rejects(deleteMarketingVideo('failed', deps, { publicationOnly: true }), /preparation/i);
        assert.equal(
          await deleteMarketingVideo('failed', {
            ...deps,
            purge: async () => {
              assert.equal(await visible(), 1, 'an in-progress cleanup never hides the legacy source');
              await query(`INSERT INTO homepage_sections VALUES('legacy','failed')`);
            },
          }),
          true,
        );
        assert.equal(await visible(), 1);
        assert.equal(await readMarketingRow('failed', { query }), null, 'cleanup permits a fresh copy later');
        assert.equal((await query(`SELECT * FROM playlist_items WHERE video_id='failed'`)).length, 1);
      },
    );
  } finally {
    await db.cleanup();
  }
});
