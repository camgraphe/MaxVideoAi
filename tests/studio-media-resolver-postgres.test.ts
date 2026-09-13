import assert from 'node:assert/strict';
import test from 'node:test';
import { startDisposablePostgres, missingDisposablePostgresCommand } from './helpers/disposable-postgres';

test('Studio resolver uses exact owned rows and owned original objects in a read-only disposable PostgreSQL transaction', async () => {
  assert.equal(missingDisposablePostgresCommand(), null);
  const database = await startDisposablePostgres('stmed');
  try {
    const socket = new URL(database.databaseUrl).searchParams.get('host');
    const facts = (await database.pool.query("SELECT current_setting('listen_addresses') AS listeners, current_setting('server_version_num')::int AS version, current_setting('unix_socket_directories') AS sockets")).rows[0];
    assert.equal(facts.listeners, ''); assert.equal(facts.sockets, socket); assert.ok(facts.version >= 170000 && facts.version < 180000);
    // Only after proving this newly created socket-only instance do we create fixtures.
    await database.pool.query(`CREATE TABLE app_jobs(job_id text PRIMARY KEY, user_id text, hidden boolean);
      CREATE TABLE job_outputs(id text PRIMARY KEY, job_id text, user_id text, kind text, url text, storage_url text, mime_type text, status text, metadata jsonb);
      CREATE TABLE media_assets(id text PRIMARY KEY, public_id text, user_id text, kind text, url text, mime_type text, status text, deleted_at timestamptz, source_job_id text, source_output_id text, metadata jsonb);
      INSERT INTO app_jobs VALUES ('job-a','owner-a',false), ('job-hidden','owner-a',true), ('job-b','owner-b',false);
      INSERT INTO job_outputs VALUES
        ('out-exact','job-a','owner-a','audio','https://media.maxvideoai.com/legacy.wav','https://media.maxvideoai.com/user-assets/owner-a/original.wav?Signature=a%2Fb&x=+','audio/wav','ready','{"mediaFacts":{"source":"probe","durationSec":9.25}}'),
        ('out-hidden','job-hidden','owner-a','audio','https://media.maxvideoai.com/user-assets/owner-a/hidden.wav',null,'audio/wav','ready','{}');
      INSERT INTO media_assets VALUES
        ('internal','ma_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa','owner-a','audio','https://media.maxvideoai.com/user-assets/owner-a/source.wav?signature=exact%2F','audio/wav','ready',null,null,null,'{"mediaFacts":{"source":"probe","durationSec":9.25}}'),
        ('hidden','ma_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb','owner-a','audio','https://media.maxvideoai.com/user-assets/owner-a/hidden.wav','audio/wav','ready',null,null,'out-hidden','{}'),
        ('forged','ma_cccccccccccccccccccccccccccccccc','owner-a','audio','https://media.maxvideoai.com/user-assets/owner-b/secret.wav','audio/wav','ready',null,null,null,'{}'),
        ('external','ma_dddddddddddddddddddddddddddddddd','owner-a','audio','https://cdn.maxvideoai.com/external.wav?sig=a%2Fb','audio/wav','ready',null,null,null,'{}');`);
    const savedBase = process.env.S3_PUBLIC_BASE_URL;
    process.env.S3_PUBLIC_BASE_URL = 'https://media.maxvideoai.com';
    const { resolveStudioMedia } = await import('../frontend/src/server/studio/media-resolver');
    if (savedBase === undefined) delete process.env.S3_PUBLIC_BASE_URL; else process.env.S3_PUBLIC_BASE_URL = savedBase;
    const client = await database.pool.connect();
    try {
      await client.query('BEGIN READ ONLY');
      const execute = async (sql: string, values: string[]) => (await client.query(sql, values)).rows;
      const assetRef = (letter: string) => ({ type: 'asset', assetId: `ma_${letter.repeat(32)}`, kind: 'audio' });
      const owned = await resolveStudioMedia('owner-a', assetRef('a'), execute);
      assert.equal(owned.url, 'https://media.maxvideoai.com/user-assets/owner-a/source.wav?signature=exact%2F');
      assert.deepEqual(owned.originalAccess, { type: 'owned-storage', storageKey: 'user-assets/owner-a/source.wav' });
      assert.equal(owned.mediaFacts?.durationSec, 9.25);
      const recentRef = { type: 'job-output', jobId: 'job-a', outputId: 'out-exact', kind: 'audio' };
      const recent = await resolveStudioMedia('owner-a', recentRef, execute);
      assert.equal(recent.url, 'https://media.maxvideoai.com/user-assets/owner-a/original.wav?Signature=a%2Fb&x=+');
      assert.deepEqual((await resolveStudioMedia('owner-a', assetRef('d'), execute)).originalAccess, { type: 'external' });
      for (const [account, ref] of [['owner-b', assetRef('a')], ['owner-a', assetRef('b')], ['owner-a', assetRef('c')], ['owner-a', { ...recentRef, jobId: 'job-b' }], ['owner-a', { ...recentRef, kind: 'image' }], ['owner-a', { type: 'asset', assetId: 'internal', kind: 'audio' }]] as const) await assert.rejects(resolveStudioMedia(account, ref, execute), /MEDIA_NOT_AVAILABLE/);
      await client.query('ROLLBACK');
    } finally { client.release(); }
    for (const mutation of ["status = 'pending'", "deleted_at = now()", "mime_type = 'image/png'", "url = 'javascript:alert(1)'"]) {
      await database.pool.query(`UPDATE media_assets SET status='ready', deleted_at=null, mime_type='audio/wav', url='https://media.maxvideoai.com/user-assets/owner-a/source.wav' WHERE id='internal'`);
      await database.pool.query(`UPDATE media_assets SET ${mutation} WHERE id='internal'`);
      await assert.rejects(resolveStudioMedia('owner-a', { type: 'asset', assetId: `ma_${'a'.repeat(32)}`, kind: 'audio' }, async (sql, values) => (await database.pool.query(sql, values)).rows), /MEDIA_NOT_AVAILABLE/);
    }
  } finally { await database.cleanup(); }
});
