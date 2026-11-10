import assert from 'node:assert/strict';
import test from 'node:test';
import { startDisposablePostgres } from './helpers/disposable-postgres';

test('physical purge retains exact job and Character media projections across owners', { timeout: 120000 }, async t => {
  const pg = await startDisposablePostgres('library-purge-retention');
  t.after(() => pg.cleanup());
  await pg.pool.query(`CREATE FUNCTION library_possible_storage_key(value text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
      SELECT CASE WHEN value ~* '^https://[^/?#]+/' THEN regexp_replace(split_part(split_part(value,'?',1),'#',1),'^https://[^/]+/','','i') END $$;
    CREATE TABLE app_jobs(job_id text PRIMARY KEY,user_id text,video_url text,audio_url text,thumb_url text,
      preview_video_url text,preview_frame text,keyframe_urls jsonb,render_ids jsonb,hero_render_id text,pricing_details jsonb);
    CREATE TABLE character_studio_characters(id bigint,user_id uuid,image_url text,thumb_url text);
    CREATE TABLE character_studio_looks(id bigint,user_id uuid,image_url text,thumb_url text);`);
  const { readPurgeProjectionRetentionSql } = await import('../frontend/server/media-library/purge-sources');
  const executor = { query: async <T>(sql: string, values?: unknown[]) => (await pg.pool.query(sql, values)).rows as T[] };
  const sql = await readPurgeProjectionRetentionSql(executor);
  assert.ok(!sql.includes('to_jsonb('), 'only named media fields may be inspected, never the full pricing/job row');
  const referenced = async (key: string) => (await pg.pool.query(`${sql} LIMIT 1`, [key])).rowCount! > 0;
  const url = (key: string) => `https://another-possible-alias.test/${key}?signature=x`;
  await pg.pool.query(`INSERT INTO app_jobs VALUES('foreign-owner','another-owner',$1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [url('video'), url('audio'), url('thumb'), url('preview'), url('frame'), { middle: url('keyframe') },
      JSON.stringify([url('render-string'), { url: url('render-original'), thumb_url: url('render-thumb'), previewUrl: url('render-preview'), imageDisplay: { url: url('render-display') } }]),
      url('hero'), { arbitraryInvoiceAttachment: url('pricing-is-not-media') }]);
  await pg.pool.query(`INSERT INTO character_studio_characters VALUES(1,'00000000-0000-0000-0000-000000000001',$1,$2)`, [url('character'), url('character-thumb')]);
  await pg.pool.query(`INSERT INTO character_studio_looks VALUES(2,'00000000-0000-0000-0000-000000000002',$1,$2)`, [url('look'), url('look-thumb')]);
  for (const key of ['video','audio','thumb','preview','frame','keyframe','render-string','render-original','render-thumb','render-preview','render-display','hero','character','character-thumb','look','look-thumb']) {
    assert.equal(await referenced(key), true, `missing live projection: ${key}`);
  }
  assert.equal(await referenced('pricing-is-not-media'), false);
  assert.equal(await referenced('absent'), false);
  await pg.pool.query(`UPDATE app_jobs SET render_ids=to_jsonb($1::text)`, [JSON.stringify([{ url: url('encoded-render'), thumbUrl: url('encoded-thumb') }])]);
  assert.equal(await referenced('encoded-render'), true);
  assert.equal(await referenced('encoded-thumb'), true);
  await pg.pool.query(`UPDATE app_jobs SET render_ids='"malformed JSON string"'::jsonb`);
  assert.equal(await referenced('encoded-render'), false, 'an invalid legacy JSON string must not break cleanup');

  // Older fixtures and optional Character installations expose only available fields.
  await pg.pool.query('DROP TABLE character_studio_characters; DROP TABLE character_studio_looks; DROP TABLE app_jobs; CREATE TABLE app_jobs(job_id text,video_url text)');
  await pg.pool.query('INSERT INTO app_jobs VALUES($1,$2)', ['old', url('old-fixture-video')]);
  const oldSql = await readPurgeProjectionRetentionSql(executor);
  assert.equal((await pg.pool.query(`${oldSql} LIMIT 1`, ['old-fixture-video'])).rowCount, 1);
});
