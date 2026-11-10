import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { startDisposablePostgres } from './helpers/disposable-postgres';

test('recorded storage follows confirmed object deletion and separates retained shared files', { timeout: 90_000 }, async t => {
  const pg = await startDisposablePostgres('library-storage-purge');
  const previousUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL = pg.databaseUrl;
  const db = await import('../frontend/src/lib/db');
  t.after(async () => { await db.getDb().end(); process.env.DATABASE_URL = previousUrl; await pg.cleanup(); });
  const schema = await import('../frontend/src/lib/schema');
  await schema.ensureAssetSchema(); await schema.ensureMediaLibrarySchema(); await schema.ensureMediaLibraryOrganizationSchema();
  await pg.pool.query(`CREATE TABLE app_jobs(job_id text PRIMARY KEY,user_id text,status text DEFAULT 'completed',hidden boolean DEFAULT false)`);
  const fences = readFileSync('neon/migrations/37_mcp_reference_upload_recovery_state.sql', 'utf8');
  await pg.pool.query(fences.match(/CREATE TABLE IF NOT EXISTS mcp_reference_upload_object_fences[\s\S]*?\n\);/)![0]);
  await pg.pool.query(readFileSync('neon/migrations/43_mcp_reference_asset_deletion.sql', 'utf8').match(/CREATE OR REPLACE FUNCTION reference_storage_authority_is_recognized[\s\S]*?\n\$\$;/)![0]);
  const { installLibraryPurgeSchema } = await import('../frontend/server/media-library/purge-schema');
  await installLibraryPurgeSchema();
  const { readLibraryStorageUsage: read } = await import('../frontend/server/media-library/storage-usage');
  const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
  let index = 0;
  const asset = async (owner: string, bytes: number | null, original?: string) => {
    const id = `storage-${++index}`, publicId = `ma_${String(index).padStart(32, '0')}`;
    const url = original ?? `https://cdn.maxvideoai.com/user-assets/${owner}/${id}.png`;
    await pg.pool.query(`INSERT INTO media_assets(id,public_id,user_id,kind,url,size_bytes,source) VALUES($1,$2,$3,'image',$4,$5,'upload')`, [id, publicId, owner, url, bytes]);
    return { type: 'asset', id, publicId, kind: 'image', url, original: url, provenance: null, jobId: null, outputId: null, createdAt: new Date().toISOString(), available: true };
  };
  const organization = async (owner: string, source: Awaited<ReturnType<typeof asset>>, state?: string) => {
    const key = `lo_${hash([owner, source.id])}`, reference = { type: 'asset', assetId: source.publicId, kind: 'image' };
    const revision = `sr_${hash(['v1', 'image', source.original])}`;
    await pg.pool.query(`INSERT INTO library_organization(user_id,key,kind,trashed_at,purge_requested_at) VALUES($1,$2,'image',now(),CASE WHEN $3::text IS NULL OR $3='failed' THEN NULL ELSE now() END)`, [owner, key, state ?? null]);
    await pg.pool.query(`INSERT INTO library_organization_aliases(user_id,organization_key,alias_type,alias_id,source_revision,reference) VALUES($1,$2,'asset',$3,$4,$5)`, [owner, key, hash(reference), revision, reference]);
    if (state) await pg.pool.query(`INSERT INTO library_purge_requests(user_id,organization_key,kind,reference,source_revision,sources,state,last_error) VALUES($1,$2,'image',$3,$4,$5,$6,CASE WHEN $6='failed' THEN 'SOURCE_CHANGED' ELSE NULL END)`, [owner, key, reference, revision, JSON.stringify([source]), state]);
    return key;
  };
  const object = async (owner: string, key: string, source: Awaited<ReturnType<typeof asset>>, bytes: number | null, state: string, options: { role?: string; reason?: string; conflict?: boolean } = {}) => {
    const objectKey = new URL(source.url).pathname.slice(1);
    await pg.pool.query(`INSERT INTO library_purge_objects(user_id,organization_key,object_key,url,size_bytes,size_conflict,role,state,reason) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [owner, key, objectKey, source.url, bytes, options.conflict ?? false, options.role ?? 'original', state, options.reason ?? null]);
    return objectKey;
  };
  const tombstone = (id: string) => pg.pool.query(`UPDATE media_assets SET status='deleted',deleted_at=now() WHERE id=$1`, [id]);
  const zeros = { recordedBytes: 0, measuredFiles: 0, totalFiles: 0, pendingDeletionFiles: 0, pendingDeletionBytes: 0,
    failedDeletionFiles: 0, trashedFiles: 0, trashedBytes: 0, sharedDeletionFiles: 0, sharedDeletionBytes: 0, limitBytes: null, enforcement: false };

  await t.test('duplicates and active work do not reduce recorded bytes before physical cleanup succeeds', async () => {
    const owner = 'storage-lifecycle', source = await asset(owner, 100), key = await organization(owner, source, 'pending');
    await pg.pool.query(`INSERT INTO user_assets(asset_id,user_id,url,size_bytes,mime_type) VALUES('mirror',$1,$2,100,'image/png')`, [owner, source.url]);
    await pg.pool.query(`INSERT INTO app_jobs(job_id,user_id,hidden) VALUES('hidden-job',$1,true)`, [owner]);
    await pg.pool.query(`INSERT INTO job_outputs(id,job_id,user_id,kind,url) VALUES('output','hidden-job',$1,'image',$2)`, [owner, source.url]);
    assert.deepEqual(await read(owner), { ...zeros, recordedBytes: 100, measuredFiles: 1, totalFiles: 1, pendingDeletionFiles: 1, pendingDeletionBytes: 100 });
    const objectKey = await object(owner, key, source, 100, 'pending');
    await object(owner, key, { ...source, url: `${source.url}.thumb` }, 999, 'pending', { role: 'thumbnail' });
    await tombstone(source.id);
    await pg.pool.query(`DELETE FROM user_assets WHERE user_id=$1`, [owner]);
    await pg.pool.query(`UPDATE job_outputs SET status='deleted' WHERE user_id=$1`, [owner]);
    await pg.pool.query(`UPDATE library_purge_requests SET state='deleting' WHERE user_id=$1`, [owner]);
    assert.deepEqual(await read(owner), { ...zeros, recordedBytes: 100, measuredFiles: 1, totalFiles: 1, pendingDeletionFiles: 1, pendingDeletionBytes: 100 }, 'tombstoning alone has not freed bytes; derivatives remain outside this estimate');
    await pg.pool.query(`UPDATE library_purge_objects SET reason='STORAGE_RETRY' WHERE user_id=$1 AND role='original'`, [owner]);
    assert.equal((await read(owner)).failedDeletionFiles, 1);
    await pg.pool.query(`UPDATE library_purge_objects SET state='deleted',reason=NULL WHERE user_id=$1 AND role='original'`, [owner]);
    await pg.pool.query(`INSERT INTO library_storage_object_fences(object_key,state,created_at,updated_at) VALUES($1,'deleted',now(),now()) ON CONFLICT(object_key) DO UPDATE SET state='deleted'`, [objectKey]);
    assert.deepEqual(await read(owner), zeros, 'only confirmed original-object deletion releases its recorded bytes');
  });

  await t.test('recoverable Trash and failed proof remain accounted once with exact revision matching', async () => {
    const owner = 'storage-trash', source = await asset(owner, 50);
    const key = await organization(owner, source, 'failed');
    assert.deepEqual(await read(owner), { ...zeros, recordedBytes: 50, measuredFiles: 1, totalFiles: 1, trashedFiles: 1, trashedBytes: 50, failedDeletionFiles: 1 });
    await pg.pool.query(`UPDATE library_organization SET trashed_at=NULL WHERE user_id=$1 AND key=$2`, [owner, key]);
    assert.equal((await read(owner)).trashedFiles, 0);
    const next = await asset(owner, 70);
    await organization(owner, next);
    await pg.pool.query(`UPDATE media_assets SET url=$2 WHERE id=$1`, [next.id, `${next.url}.new-version`]);
    assert.equal((await read(owner)).trashedFiles, 0, 'an alias for the old source revision cannot mark the replacement as Trash');
  });

  await t.test('shared objects remain explicit but another owner does not keep charging the deleted owner', async () => {
    const owner = 'storage-shared', source = await asset(owner, 200), key = await organization(owner, source, 'deleting');
    await pg.pool.query(`INSERT INTO app_jobs(job_id,user_id) VALUES('shared-job',$1)`, [owner]);
    await pg.pool.query(`INSERT INTO job_outputs(id,job_id,user_id,kind,url) VALUES('shared-survivor','shared-job',$1,'image',$2)`, [owner, source.url]);
    await asset('storage-foreign-survivor', 200, source.url);
    await object(owner, key, source, 200, 'shared', { reason: 'LIVE_REFERENCE' }); await tombstone(source.id);
    assert.deepEqual(await read(owner), { ...zeros, recordedBytes: 200, measuredFiles: 1, totalFiles: 1, sharedDeletionFiles: 1, sharedDeletionBytes: 200 });
    await pg.pool.query(`UPDATE job_outputs SET status='deleted' WHERE id='shared-survivor'`);
    assert.deepEqual(await read(owner), { ...zeros, sharedDeletionFiles: 1, sharedDeletionBytes: 200 });
    assert.deepEqual(await read('storage-foreign-survivor'), { ...zeros, recordedBytes: 200, measuredFiles: 1, totalFiles: 1 });
  });

  await t.test('an old shared ledger cannot hide pending final-copy cleanup, a retry or a size conflict', async () => {
    const owner = 'storage-shared-final-copy', first = await asset(owner, 80);
    const finalCopy = await asset(owner, 80, `${first.url}?copy=2`);
    const firstKey = await organization(owner, first, 'deleting');
    const finalKey = await organization(owner, finalCopy, 'deleting');
    await object(owner, firstKey, first, 80, 'shared', { reason: 'LIVE_REFERENCE' });
    await object(owner, finalKey, finalCopy, 80, 'pending', { reason: 'STORAGE_RETRY' });
    await tombstone(first.id); await tombstone(finalCopy.id);
    assert.deepEqual(await read(owner), { ...zeros, recordedBytes: 80, measuredFiles: 1, totalFiles: 1,
      pendingDeletionFiles: 1, pendingDeletionBytes: 80, failedDeletionFiles: 1 },
    'the final copy still occupies 80 bytes and needs retry, despite the earlier shared record');
    await pg.pool.query(`UPDATE library_purge_objects SET state='deleting',reason=NULL WHERE user_id=$1 AND organization_key=$2`, [owner, finalKey]);
    assert.deepEqual(await read(owner), { ...zeros, recordedBytes: 80, measuredFiles: 1, totalFiles: 1,
      pendingDeletionFiles: 1, pendingDeletionBytes: 80 });
    await pg.pool.query(`UPDATE library_purge_objects SET size_conflict=true WHERE user_id=$1 AND organization_key=$2`, [owner, firstKey]);
    assert.deepEqual(await read(owner), { ...zeros, totalFiles: 1, pendingDeletionFiles: 1 },
      'a durable conflict remains unknown without dropping the occupied original from file counts');
    await pg.pool.query(`UPDATE library_purge_objects SET size_conflict=false WHERE user_id=$1 AND organization_key=$2`, [owner, firstKey]);
    await pg.pool.query(`UPDATE library_purge_objects SET state='retained',reason='EXPLICIT_RETENTION' WHERE user_id=$1 AND organization_key=$2`, [owner, finalKey]);
    assert.deepEqual(await read(owner), { ...zeros, recordedBytes: 80, measuredFiles: 1, totalFiles: 1 },
      'explicit retention is still accounted when an old shared ledger remains');
  });

  await t.test('retained and conflicting-size originals never masquerade as freed or measured zero-byte files', async () => {
    const retainedOwner = 'storage-retained', retained = await asset(retainedOwner, 300), retainedKey = await organization(retainedOwner, retained, 'completed');
    await object(retainedOwner, retainedKey, retained, 300, 'retained', { reason: 'EXPLICIT_RETENTION' }); await tombstone(retained.id);
    assert.deepEqual(await read(retainedOwner), { ...zeros, recordedBytes: 300, measuredFiles: 1, totalFiles: 1 });
    const owner = 'storage-conflict', source = await asset(owner, 20), key = await organization(owner, source, 'deleting');
    await pg.pool.query(`INSERT INTO user_assets(asset_id,user_id,url,size_bytes,mime_type) VALUES('size-conflict',$1,$2,30,'image/png')`, [owner, source.url]);
    await object(owner, key, source, null, 'pending', { conflict: true, reason: 'STORAGE_RETRY' }); await tombstone(source.id);
    assert.deepEqual(await read(owner), { ...zeros, totalFiles: 1, pendingDeletionFiles: 1, failedDeletionFiles: 1 });
  });

  await t.test('physical deletion fences retire stale projections and a later available object is counted again', async () => {
    const owner = 'storage-fence', source = await asset(owner, 80), key = await organization(owner, source, 'completed');
    const objectKey = await object(owner, key, source, 80, 'deleted');
    await pg.pool.query(`INSERT INTO library_storage_object_fences(object_key,state,created_at,updated_at) VALUES($1,'deleted',now(),now()) ON CONFLICT(object_key) DO UPDATE SET state='deleted'`, [objectKey]);
    assert.deepEqual(await read(owner), zeros);
    await pg.pool.query(`UPDATE library_purge_objects SET size_conflict=true WHERE user_id=$1`, [owner]);
    await pg.pool.query(`UPDATE library_storage_object_fences SET state='available' WHERE object_key=$1`, [objectKey]);
    assert.deepEqual(await read(owner), { ...zeros, recordedBytes: 80, measuredFiles: 1, totalFiles: 1 });
  });

  await t.test('published storage aliases and signed variants deduplicate while unrelated hosts retain exact identity', async () => {
    const owner = 'storage-aliases', source = await asset(owner, 120), key = await organization(owner, source, 'deleting');
    const aliasUrl = source.url.replace('cdn.maxvideoai.com', 'media.maxvideoai.com') + '?signature=second';
    await pg.pool.query(`INSERT INTO user_assets(asset_id,user_id,url,size_bytes,mime_type) VALUES('signed-alias',$1,$2,120,'image/png')`, [owner, aliasUrl]);
    await object(owner, key, source, 120, 'pending');
    assert.deepEqual(await read(owner), { ...zeros, recordedBytes: 120, measuredFiles: 1, totalFiles: 1, pendingDeletionFiles: 1, pendingDeletionBytes: 120 });
    const foreign = source.url.replace('cdn.maxvideoai.com', 'provider.invalid');
    await asset(owner, 40, foreign);
    assert.equal((await read(owner)).recordedBytes, 160, 'similar paths on an unrelated authority are not object identity');
    await pg.pool.query(`INSERT INTO library_storage_object_fences(object_key,state,created_at,updated_at) VALUES($1,'deleted',now(),now()) ON CONFLICT(object_key) DO UPDATE SET state='deleted'`, [new URL(source.url).pathname.slice(1)]);
    assert.deepEqual(await read(owner), { ...zeros, recordedBytes: 40, measuredFiles: 1, totalFiles: 1 });
  });
});
