import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createQueryExecutor } from '../frontend/src/lib/db';
import { claimStorageObjectProducer, settleStorageObjectProducer } from '../frontend/src/server/storage-object-producer-claims';
import { cleanupExpiredReferenceUploadAttempts } from '../frontend/src/server/agent-api/reference-upload-attempts';
import { startDisposablePostgres } from './helpers/disposable-postgres';

test('reserved private excerpt leaves retain references and cleanup isolation under unchanged PG17 fences', async t => {
  const database = await startDisposablePostgres('excerpt-private-fences');
  t.after(() => database.cleanup());
  const { pool } = database;
  const version = await pool.query('SHOW server_version_num');
  assert.equal(Math.floor(Number(version.rows[0].server_version_num) / 10000), 17);
  await pool.query(`CREATE TABLE media_assets (
    id text PRIMARY KEY, public_id text, user_id text, url text, thumb_url text,
    status text DEFAULT 'ready', updated_at timestamptz DEFAULT now(), deleted_at timestamptz
  )`);
  await pool.query('CREATE TABLE user_assets (asset_id text PRIMARY KEY, user_id text, url text, metadata jsonb)');
  for (const name of [
    '32_mcp_reference_uploads.sql', '34_mcp_reference_upload_media_kind.sql',
    '35_mcp_reference_upload_hardening.sql', '36_mcp_reference_upload_replay_safety.sql',
    '37_mcp_reference_upload_recovery_state.sql', '43_mcp_reference_asset_deletion.sql',
    '44_mcp_reference_staging_storage_namespace.sql',
  ]) await pool.query(readFileSync(`neon/migrations/${name}`, 'utf8'));
  const executor = createQueryExecutor(pool);
  const now = new Date();
  const retained: string[] = [];
  for (const [index, prefix] of ['', 'mcp-reference-staging/'].entries()) {
    const key = `${prefix}user-assets/by-content/${'a'.repeat(32)}/video-excerpts-private-v3-prepared-${'b'.repeat(64)}.mp4`;
    const thumb = `${prefix}user-asset-thumbs/owner/video-excerpts-private-v3-fixture.jpg`;
    const canonical = `https://assets.maxvideo.ai/${key}`;
    const thumbUrl = `https://assets.maxvideo.ai/${thumb}`;
    const claim = await claimStorageObjectProducer({ objectKey: key }, { executor, now });
    await assert.rejects(claimStorageObjectProducer({ objectKey: key }, { executor, now }), /being deleted or produced/);
    await pool.query('INSERT INTO user_assets (asset_id,user_id,url,metadata) VALUES ($1,$2,$3,$4)', [
      `legacy-${index}`, 'owner', canonical, { thumbUrl },
    ]);
    await pool.query('INSERT INTO media_assets (id,public_id,user_id,url,thumb_url) VALUES ($1,$2,$3,$4,$5)', [
      `media-${index}`, `ma_${String(index + 1).repeat(32)}`, 'owner', canonical, thumbUrl,
    ]);
    await settleStorageObjectProducer({ claim, outcome: 'persisted' }, { executor, now });
    const classification = (await pool.query(
      'SELECT content_addressed_object_key($1) AS original, thumbnail_object_key($2) AS thumbnail, reference_storage_object_key($3) AS foreign',
      [canonical, thumbUrl, `https://foreign.example/${key}`],
    )).rows[0];
    assert.deepEqual(classification, { original: key, thumbnail: thumb, foreign: null });
    retained.push(key, thumb);
  }
  const fences = (await pool.query('SELECT object_key,state FROM mcp_reference_upload_object_fences ORDER BY object_key')).rows;
  assert.equal(fences.length, 4);
  assert.deepEqual(new Set(fences.map(row => row.object_key)), new Set(retained));
  assert.ok(fences.every(row => row.state === 'referenced'));
  const orphan = `user-assets/by-content/${'c'.repeat(32)}/video-excerpts-private-v3-abandoned.mp4`;
  const abandoned = await claimStorageObjectProducer({ objectKey: orphan }, { executor, now });
  await settleStorageObjectProducer({ claim: abandoned, outcome: 'abandoned' }, { executor, now });
  const deleted: string[] = [];
  await cleanupExpiredReferenceUploadAttempts({ limit: 10 }, {
    executor, now: () => new Date(now.getTime() + 10 * 60_000),
    deleteStorageObjectKey: async key => { deleted.push(key); },
  });
  assert.deepEqual(deleted, [orphan]);
  assert.equal((await pool.query('SELECT count(*)::int AS count FROM user_assets')).rows[0].count, 2);
  assert.equal((await pool.query('SELECT count(*)::int AS count FROM media_assets WHERE deleted_at IS NULL')).rows[0].count, 2);
  assert.equal((await pool.query("SELECT count(*)::int AS count FROM mcp_reference_upload_object_fences WHERE state='referenced'")).rows[0].count, 4);
});
