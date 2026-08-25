import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import type { Pool, PoolClient } from 'pg';

import { createQueryExecutor, type TransactionQueryExecutor } from '../frontend/src/lib/db';
import {
  abortReferenceUploadAttempt,
  acquireReferenceUploadCompletionLease,
  claimReferenceUploadPart,
  cleanupReferenceUploadParts,
  cleanupExpiredReferenceUploadAttempts,
  completeReferenceUploadPart,
  completeReferenceUploadAttempt,
  createReferenceUploadAttempt,
  failReferenceUploadAttempt,
  getOwnedReferenceUploadAttempt,
  renewReferenceUploadCompletionLease,
  registerReferenceUploadCleanupObject,
  retainReferenceUploadCleanupObject,
  stageReferenceUploadAttempt,
} from '../frontend/src/server/agent-api/reference-upload-attempts';
import {
  claimUploadSessionForUpload,
  completeUploadSession,
  createUploadSession,
} from '../frontend/src/server/agent-api/reference-upload-sessions';
import {
  missingDisposablePostgresCommand,
  startDisposablePostgres,
} from './helpers/disposable-postgres';

const sessionId = '00000000-0000-4000-8000-000000000101';
const claimId = '00000000-0000-4000-8000-000000000102';
const uploadId = '00000000-0000-4000-8000-000000000103';
const firstLeaseId = '00000000-0000-4000-8000-000000000104';
const retryLeaseId = '00000000-0000-4000-8000-000000000105';
const partLeaseId = '00000000-0000-4000-8000-000000000106';
const publicAssetId = 'ma_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const fileSha256 = 'a'.repeat(64);
const now = new Date();

async function transaction<T>(pool: Pool, callback: (executor: TransactionQueryExecutor, client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(createQueryExecutor(client) as TransactionQueryExecutor, client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function reset(pool: Pool): Promise<void> {
  await pool.query('TRUNCATE mcp_reference_upload_sessions, media_assets, user_assets CASCADE');
}

async function createClaimedAttempt(pool: Pool) {
  const created = await createUploadSession({ userId: 'user-a', oauthClientId: 'client-a', mediaKind: 'video' }, {
    executor: createQueryExecutor(pool), now: () => now,
    randomUUID: () => sessionId, randomToken: () => `mru_${'A'.repeat(43)}`,
  });
  const claimed = await transaction(pool, (executor) => claimUploadSessionForUpload(
    { token: created.token, userId: 'user-a' }, { executor, randomUUID: () => claimId },
  ));
  const attempt = await transaction(pool, (executor) => createReferenceUploadAttempt({
    session: claimed, uploadId, storageKey: `mcp-reference-staging/${'b'.repeat(32)}/${uploadId}`,
    fileName: 'reference.mp4', declaredMime: 'video/mp4', declaredSize: 4,
    fileSha256, chunkBytes: 4, totalParts: 1, mediaKind: 'video',
  }, { executor }));
  return { created, attempt };
}

test('real PostgreSQL upload recovery and interleavings preserve one terminal asset', async (t) => {
  const missing = missingDisposablePostgresCommand();
  if (missing) {
    t.skip(`${missing} is unavailable`);
    return;
  }
  const database = await startDisposablePostgres('mru');
  t.after(() => database.cleanup());
  await database.pool.query(`CREATE TABLE media_assets (
    id text PRIMARY KEY, public_id text, user_id text, url text, thumb_url text, deleted_at timestamptz
  )`);
  await database.pool.query(`CREATE TABLE user_assets (
    asset_id text PRIMARY KEY, user_id text, url text, metadata jsonb
  )`);
  for (const migration of [32, 34, 35, 36, 37]) {
    const name = migration === 32 ? '32_mcp_reference_uploads.sql'
      : migration === 34 ? '34_mcp_reference_upload_media_kind.sql'
        : migration === 35 ? '35_mcp_reference_upload_hardening.sql'
          : migration === 36 ? '36_mcp_reference_upload_replay_safety.sql'
            : '37_mcp_reference_upload_recovery_state.sql';
    await database.pool.query(readFileSync(`neon/migrations/${name}`, 'utf8'));
  }

  await t.test('old-binary v1 rows remain parseable while every new attempt is explicitly v2', async () => {
    await reset(database.pool);
    const created = await createUploadSession({ userId: 'user-a', oauthClientId: 'client-a', mediaKind: 'video' }, {
      executor: createQueryExecutor(database.pool), now: () => now,
      randomUUID: () => sessionId, randomToken: () => `mru_${'A'.repeat(43)}`,
    });
    const claimed = await transaction(database.pool, (executor) => claimUploadSessionForUpload(
      { token: created.token, userId: 'user-a' }, { executor, randomUUID: () => claimId },
    ));
    await database.pool.query(`INSERT INTO mcp_reference_upload_attempts (
      session_id, upload_id, user_id, media_kind, storage_key, file_name, declared_mime,
      declared_size, created_at, updated_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9)`, [
      sessionId, uploadId, 'user-a', 'video', `mcp-reference-staging/${'b'.repeat(32)}/${uploadId}`,
      'legacy.mp4', 'video/mp4', 4, claimed.claimedAt,
    ]);
    const legacy = await getOwnedReferenceUploadAttempt({ token: created.token, userId: 'user-a', uploadId }, {
      executor: createQueryExecutor(database.pool),
    });
    assert.equal(legacy.protocolVersion, 1);
    assert.equal(legacy.fileSha256, null);
    assert.deepEqual((await database.pool.query<{ object_role: string; state: string }>(
      'SELECT object_role, state FROM mcp_reference_upload_cleanup_objects WHERE upload_id = $1', [uploadId],
    )).rows, [{ object_role: 'legacy_staging', state: 'pending' }]);
    await assert.rejects(() => transaction(database.pool, (executor) => claimReferenceUploadPart({
      attempt: legacy, partNumber: 1, contentSha256: fileSha256, sizeBytes: 4,
    }, { executor, now, leaseId: partLeaseId })), /restart|protocol/iu);

    await reset(database.pool);
    const fresh = await createClaimedAttempt(database.pool);
    assert.equal(fresh.attempt.protocolVersion, 2);
    const persisted = await database.pool.query<{ protocol_version: number }>(
      'SELECT protocol_version FROM mcp_reference_upload_attempts WHERE upload_id = $1', [uploadId],
    );
    assert.equal(persisted.rows[0]?.protocol_version, 2);
  });

  await t.test('staged failure leases again and completes the actual processing state once', async () => {
    await reset(database.pool);
    const { attempt } = await createClaimedAttempt(database.pool);
    await database.pool.query('INSERT INTO media_assets (id, public_id) VALUES ($1,$2)', ['internal-asset', publicAssetId]);
    const leased = await transaction(database.pool, (executor) => acquireReferenceUploadCompletionLease(
      { attempt }, { executor, now, leaseId: firstLeaseId },
    ));
    const staged = await transaction(database.pool, (executor) => stageReferenceUploadAttempt({
      attempt: leased, leaseId: firstLeaseId, version: leased.version,
      contentSha256: fileSha256, assetId: publicAssetId,
    }, { executor, updatedAt: new Date(now.getTime() + 1_000) }));

    await assert.rejects(() => transaction(database.pool, async (executor) => {
      await completeUploadSession({ sessionId: staged.session.sessionId, userId: 'user-a', claimId,
        mediaKind: 'video', assetId: publicAssetId }, { executor, uploadedAt: new Date(now.getTime() + 2_000) });
      throw new Error('simulated failure after canonical persistence');
    }), /simulated failure/iu);
    assert.equal(await transaction(database.pool, (executor) => failReferenceUploadAttempt({
      attempt: staged, leaseId: firstLeaseId, version: staged.version, failureCode: 'SIMULATED',
    }, { executor, failedAt: new Date(now.getTime() + 3_000) })), true);

    const retry = await transaction(database.pool, (executor) => acquireReferenceUploadCompletionLease(
      { attempt: staged }, { executor, now: new Date(now.getTime() + 4_000), leaseId: retryLeaseId },
    ));
    assert.equal(retry.stagedAssetId, publicAssetId);
    await transaction(database.pool, async (executor) => {
      await completeUploadSession({ sessionId: retry.session.sessionId, userId: 'user-a', claimId,
        mediaKind: 'video', assetId: publicAssetId }, { executor, uploadedAt: new Date(now.getTime() + 5_000) });
      await completeReferenceUploadAttempt({ attempt: retry, leaseId: retryLeaseId, version: retry.version },
        { executor, completedAt: new Date(now.getTime() + 5_000) });
    });
    const terminal = await database.pool.query<{ state: string; staged_asset_id: string }>(
      'SELECT state, staged_asset_id FROM mcp_reference_upload_attempts WHERE upload_id = $1', [uploadId],
    );
    assert.deepEqual(terminal.rows, [{ state: 'completed', staged_asset_id: publicAssetId }]);
    assert.equal((await database.pool.query('SELECT 1 FROM media_assets')).rowCount, 1);
  });

  await t.test('stale part claim cannot cross a completion lease and abort respects active then expired leases', async () => {
    await reset(database.pool);
    const { attempt } = await createClaimedAttempt(database.pool);
    const leased = await transaction(database.pool, (executor) => acquireReferenceUploadCompletionLease(
      { attempt }, { executor, now, leaseId: firstLeaseId },
    ));
    await assert.rejects(() => transaction(database.pool, (executor) => claimReferenceUploadPart({
      attempt, partNumber: 1, contentSha256: fileSha256, sizeBytes: 4,
    }, { executor, now: new Date(now.getTime() + 1_000), leaseId: partLeaseId })), /already|cannot/iu);
    assert.equal((await database.pool.query('SELECT 1 FROM mcp_reference_upload_parts')).rowCount, 0);

    await assert.rejects(() => transaction(database.pool, (executor) => abortReferenceUploadAttempt(
      { attempt: leased }, { executor, abortedAt: new Date(now.getTime() + 2_000) },
    )), /cannot|already/iu);
    const aborted = await transaction(database.pool, (executor) => abortReferenceUploadAttempt(
      { attempt: leased }, { executor, abortedAt: new Date(now.getTime() + 6 * 60_000) },
    ));
    assert.equal(aborted.state, 'aborted');
  });

  await t.test('completion lease renews by CAS and excludes a finalizer beyond the original window', async () => {
    await reset(database.pool);
    const { attempt } = await createClaimedAttempt(database.pool);
    const leased = await transaction(database.pool, (executor) => acquireReferenceUploadCompletionLease(
      { attempt }, { executor, now, leaseId: firstLeaseId },
    ));
    const renewed = await transaction(database.pool, (executor) => renewReferenceUploadCompletionLease(
      { attempt: leased, leaseId: firstLeaseId, version: leased.version },
      { executor, now: new Date(now.getTime() + 4 * 60_000) },
    ));
    assert.equal(renewed.leaseId, firstLeaseId);
    assert.ok(renewed.leaseExpiresAt);
    assert.equal(renewed.leaseExpiresAt.getTime(), now.getTime() + 9 * 60_000);

    await assert.rejects(() => transaction(database.pool, (executor) => acquireReferenceUploadCompletionLease(
      { attempt }, { executor, now: new Date(now.getTime() + 6 * 60_000), leaseId: retryLeaseId },
    )), /processing/iu);
    await assert.rejects(() => transaction(database.pool, (executor) => abortReferenceUploadAttempt(
      { attempt: renewed }, { executor, abortedAt: new Date(now.getTime() + 6 * 60_000) },
    )), /cannot|already/iu);
    const aborted = await transaction(database.pool, (executor) => abortReferenceUploadAttempt(
      { attempt: renewed }, { executor, abortedAt: new Date(now.getTime() + 10 * 60_000) },
    ));
    assert.equal(aborted.state, 'aborted');
  });

  await t.test('every issued part key remains in the durable ledger until a failed delete retries successfully', async () => {
    await reset(database.pool);
    const { attempt } = await createClaimedAttempt(database.pool);
    const claimed = await transaction(database.pool, (executor) => claimReferenceUploadPart({
      attempt, partNumber: 1, contentSha256: fileSha256, sizeBytes: 4,
    }, { executor, now, leaseId: partLeaseId }));
    await transaction(database.pool, (executor) => completeReferenceUploadPart({
      attempt, partNumber: 1, leaseId: partLeaseId, contentSha256: fileSha256, sizeBytes: 4,
    }, { executor, now: new Date(now.getTime() + 1_000) }));
    const ledger = await database.pool.query<{ object_key: string; state: string; object_role: string }>(
      'SELECT object_key, state, object_role FROM mcp_reference_upload_cleanup_objects',
    );
    assert.deepEqual(ledger.rows, [{ object_key: claimed.storageKey, state: 'pending', object_role: 'part' }]);

    let deletes = 0;
    assert.equal(await cleanupReferenceUploadParts({ attempt }, {
      executor: createQueryExecutor(database.pool),
      async deleteStorageObjectKey(key) {
        assert.equal(key, claimed.storageKey);
        deletes += 1;
        throw new Error('temporary delete failure');
      },
    }), 0);
    assert.equal((await database.pool.query<{ state: string }>(
      'SELECT state FROM mcp_reference_upload_cleanup_objects WHERE object_key = $1', [claimed.storageKey],
    )).rows[0]?.state, 'pending');

    assert.equal(await cleanupReferenceUploadParts({ attempt }, {
      executor: createQueryExecutor(database.pool),
      async deleteStorageObjectKey(key) { assert.equal(key, claimed.storageKey); deletes += 1; },
    }), 1);
    assert.equal(deletes, 2);
    assert.equal((await database.pool.query<{ state: string }>(
      'SELECT state FROM mcp_reference_upload_cleanup_objects WHERE object_key = $1', [claimed.storageKey],
    )).rows[0]?.state, 'deleted');
  });

  await t.test('final and thumbnail keys are durably registered before effects and winner keys are retained', async () => {
    await reset(database.pool);
    const { attempt } = await createClaimedAttempt(database.pool);
    const finalKey = `user-assets/by-content/${'c'.repeat(32)}/${fileSha256}.mp4`;
    const thumbnailKey = `user-asset-thumbs/${'d'.repeat(32)}/thumb.jpg`;
    await transaction(database.pool, async (executor) => {
      await registerReferenceUploadCleanupObject({ attempt, objectKey: finalKey, objectRole: 'final', safeToDelete: false }, { executor, now });
      await registerReferenceUploadCleanupObject({ attempt, objectKey: thumbnailKey, objectRole: 'thumbnail', safeToDelete: true }, { executor, now });
      await retainReferenceUploadCleanupObject({ attempt, objectKey: thumbnailKey }, { executor, now: new Date(now.getTime() + 1_000) });
    });
    assert.deepEqual((await database.pool.query<{ object_key: string; object_role: string; state: string }>(
      'SELECT object_key, object_role, state FROM mcp_reference_upload_cleanup_objects ORDER BY object_role',
    )).rows, [
      { object_key: finalKey, object_role: 'final', state: 'retained' },
      { object_key: thumbnailKey, object_role: 'thumbnail', state: 'retained' },
    ]);
  });

  await t.test('expiry cleanup takes over only an expired lease and retries its durable tombstone', async () => {
    await reset(database.pool);
    const { attempt } = await createClaimedAttempt(database.pool);
    const claimed = await transaction(database.pool, (executor) => claimReferenceUploadPart({
      attempt, partNumber: 1, contentSha256: fileSha256, sizeBytes: 4,
    }, { executor, now, leaseId: partLeaseId }));
    await transaction(database.pool, (executor) => completeReferenceUploadPart({
      attempt, partNumber: 1, leaseId: partLeaseId, contentSha256: fileSha256, sizeBytes: 4,
    }, { executor, now: new Date(now.getTime() + 1_000) }));
    await transaction(database.pool, (executor) => acquireReferenceUploadCompletionLease(
      { attempt }, { executor, now: new Date(now.getTime() + 2_000), leaseId: firstLeaseId },
    ));

    const deleted: string[] = [];
    assert.deepEqual(await cleanupExpiredReferenceUploadAttempts({}, {
      executor: createQueryExecutor(database.pool), now: () => new Date(now.getTime() + 16 * 60_000),
      async deleteStorageObjectKey(key) { deleted.push(key); throw new Error('temporary delete failure'); },
    }), { selected: 1, deleted: 0 });
    assert.deepEqual(deleted, [claimed.storageKey]);
    assert.equal((await database.pool.query<{ state: string }>(
      'SELECT state FROM mcp_reference_upload_attempts WHERE upload_id = $1', [uploadId],
    )).rows[0]?.state, 'aborted');
    assert.equal((await database.pool.query<{ state: string }>(
      'SELECT state FROM mcp_reference_upload_cleanup_objects WHERE object_key = $1', [claimed.storageKey],
    )).rows[0]?.state, 'pending');

    assert.deepEqual(await cleanupExpiredReferenceUploadAttempts({}, {
      executor: createQueryExecutor(database.pool), now: () => new Date(now.getTime() + 17 * 60_000),
      async deleteStorageObjectKey(key) { deleted.push(key); },
    }), { selected: 1, deleted: 1 });
    assert.equal((await database.pool.query<{ state: string }>(
      'SELECT state FROM mcp_reference_upload_cleanup_objects WHERE object_key = $1', [claimed.storageKey],
    )).rows[0]?.state, 'deleted');
  });

  await t.test('cleanup retains a pending object already referenced by a canonical winner', async () => {
    await reset(database.pool);
    const { attempt } = await createClaimedAttempt(database.pool);
    const thumbnailKey = `user-asset-thumbs/${'d'.repeat(32)}/winner.jpg`;
    await transaction(database.pool, (executor) => registerReferenceUploadCleanupObject(
      { attempt, objectKey: thumbnailKey, objectRole: 'thumbnail', safeToDelete: true }, { executor, now },
    ));
    await database.pool.query(
      'INSERT INTO media_assets (id, public_id, user_id, url, thumb_url) VALUES ($1,$2,$3,$4,$5)',
      ['winner', publicAssetId, 'user-a', 'https://assets.maxvideo.ai/video.mp4', `https://assets.maxvideo.ai/${thumbnailKey}`],
    );
    await transaction(database.pool, (executor) => abortReferenceUploadAttempt(
      { attempt }, { executor, abortedAt: new Date(now.getTime() + 1_000) },
    ));
    let deletes = 0;
    assert.deepEqual(await cleanupExpiredReferenceUploadAttempts({}, {
      executor: createQueryExecutor(database.pool), now: () => new Date(now.getTime() + 2_000),
      async deleteStorageObjectKey() { deletes += 1; },
    }), { selected: 0, deleted: 0 });
    assert.equal(deletes, 0);
    assert.equal((await database.pool.query<{ state: string }>(
      'SELECT state FROM mcp_reference_upload_cleanup_objects WHERE object_key = $1', [thumbnailKey],
    )).rows[0]?.state, 'retained');
  });
});
