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
  claimStorageObjectProducer,
  settleStorageObjectProducer,
} from '../frontend/src/server/storage-object-producer-claims';
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
const secondAttemptIds = {
  sessionId: '00000000-0000-4000-8000-000000000121',
  claimId: '00000000-0000-4000-8000-000000000122',
  uploadId: '00000000-0000-4000-8000-000000000123',
  tokenChar: 'B',
};
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
  await pool.query('TRUNCATE mcp_reference_upload_sessions, mcp_reference_upload_object_fences, media_assets, user_assets CASCADE');
}

async function createClaimedAttempt(pool: Pool, createdAt = now, ids: {
  sessionId: string; claimId: string; uploadId: string; tokenChar: string;
} = { sessionId, claimId, uploadId, tokenChar: 'A' }) {
  const created = await createUploadSession({ userId: 'user-a', oauthClientId: 'client-a', mediaKind: 'video' }, {
    executor: createQueryExecutor(pool), now: () => createdAt,
    randomUUID: () => ids.sessionId, randomToken: () => `mru_${ids.tokenChar.repeat(43)}`,
  });
  const claimed = await transaction(pool, (executor) => claimUploadSessionForUpload(
    { token: created.token, userId: 'user-a' }, { executor, randomUUID: () => ids.claimId },
  ));
  const attempt = await transaction(pool, (executor) => createReferenceUploadAttempt({
    session: claimed, uploadId: ids.uploadId, storageKey: `mcp-reference-staging/${'b'.repeat(32)}/${ids.uploadId}`,
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

  await t.test('completion lease refuses a session too close to expiry before any finalize effects', async () => {
    await reset(database.pool);
    const { created } = await createClaimedAttempt(database.pool, new Date(now.getTime() - 14.5 * 60_000));
    const nearExpiry = await getOwnedReferenceUploadAttempt({ token: created.token, userId: 'user-a', uploadId }, {
      executor: createQueryExecutor(database.pool),
    });
    await assert.rejects(() => transaction(database.pool, (executor) => acquireReferenceUploadCompletionLease(
      { attempt: nearExpiry }, { executor, now, leaseId: firstLeaseId },
    )), (error: unknown) => error instanceof Error && /expired|window|restart/iu.test(error.message));
    assert.equal((await database.pool.query<{ state: string }>(
      'SELECT state FROM mcp_reference_upload_attempts WHERE upload_id = $1', [uploadId],
    )).rows[0]?.state, 'pending');
  });

  await t.test('a valid completion lease crosses link expiry and remains renewable before cleanup takeover', async () => {
    await reset(database.pool);
    const createdAt = new Date(now.getTime() - 12.5 * 60_000);
    const { attempt } = await createClaimedAttempt(database.pool, createdAt);
    const leased = await transaction(database.pool, (executor) => acquireReferenceUploadCompletionLease(
      { attempt }, { executor, now, leaseId: firstLeaseId },
    ));
    assert.equal(leased.leaseExpiresAt?.getTime(), now.getTime() + 5 * 60_000);

    const afterLinkExpiry = new Date(now.getTime() + 3 * 60_000);
    assert.deepEqual(await cleanupExpiredReferenceUploadAttempts({}, {
      executor: createQueryExecutor(database.pool), now: () => afterLinkExpiry,
      async deleteStorageObjectKey() { throw new Error('active lease must prevent cleanup'); },
    }), { selected: 0, deleted: 0 });
    assert.equal((await database.pool.query<{ state: string }>(
      'SELECT state FROM mcp_reference_upload_attempts WHERE upload_id = $1', [uploadId],
    )).rows[0]?.state, 'processing');

    const renewed = await transaction(database.pool, (executor) => renewReferenceUploadCompletionLease(
      { attempt: leased, leaseId: firstLeaseId, version: leased.version },
      { executor, now: afterLinkExpiry },
    ));
    assert.equal(renewed.leaseExpiresAt?.getTime(), afterLinkExpiry.getTime() + 5 * 60_000);
    const staged = await transaction(database.pool, (executor) => stageReferenceUploadAttempt({
      attempt: renewed, leaseId: firstLeaseId, version: renewed.version,
      contentSha256: fileSha256, assetId: publicAssetId,
    }, { executor, updatedAt: new Date(afterLinkExpiry.getTime() + 1_000) }));
    await transaction(database.pool, async (executor) => {
      await completeUploadSession({
        sessionId: staged.session.sessionId, userId: 'user-a', claimId,
        mediaKind: 'video', assetId: publicAssetId,
        completionLease: { uploadId, leaseId: firstLeaseId, version: staged.version },
      }, { executor, uploadedAt: new Date(afterLinkExpiry.getTime() + 2_000) });
      await completeReferenceUploadAttempt(
        { attempt: staged, leaseId: firstLeaseId, version: staged.version },
        { executor, completedAt: new Date(afterLinkExpiry.getTime() + 2_000) },
      );
    });
    assert.equal((await database.pool.query<{ state: string }>(
      'SELECT state FROM mcp_reference_upload_sessions WHERE session_id = $1', [sessionId],
    )).rows[0]?.state, 'uploaded');
  });

  await t.test('expiry cleanup does not delete while a completion lease remains active', async () => {
    await reset(database.pool);
    const { attempt } = await createClaimedAttempt(database.pool, new Date(now.getTime() - 12 * 60_000));
    const claimed = await transaction(database.pool, (executor) => claimReferenceUploadPart({
      attempt, partNumber: 1, contentSha256: fileSha256, sizeBytes: 4,
    }, { executor, now, leaseId: partLeaseId }));
    await transaction(database.pool, (executor) => completeReferenceUploadPart({
      attempt, partNumber: 1, leaseId: partLeaseId, contentSha256: fileSha256, sizeBytes: 4,
    }, { executor, now: new Date(now.getTime() + 1_000) }));
    await transaction(database.pool, (executor) => acquireReferenceUploadCompletionLease(
      { attempt }, { executor, now: new Date(now.getTime() + 2_000), leaseId: firstLeaseId },
    ));
    let deletes = 0;
    assert.deepEqual(await cleanupExpiredReferenceUploadAttempts({}, {
      executor: createQueryExecutor(database.pool), now: () => new Date(now.getTime() + 2 * 60_000),
      async deleteStorageObjectKey() { deletes += 1; },
    }), { selected: 0, deleted: 0 });
    assert.equal(deletes, 0);
    assert.equal((await database.pool.query<{ state: string }>(
      'SELECT state FROM mcp_reference_upload_attempts WHERE upload_id = $1', [uploadId],
    )).rows[0]?.state, 'processing');
    assert.equal(claimed.storageKey.includes('/parts/'), true);
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
    });
    assert.deepEqual((await database.pool.query<{ object_key: string; object_role: string; state: string }>(
      'SELECT object_key, object_role, state FROM mcp_reference_upload_cleanup_objects ORDER BY object_role',
    )).rows, [
      { object_key: finalKey, object_role: 'final', state: 'pending' },
      { object_key: thumbnailKey, object_role: 'thumbnail', state: 'pending' },
    ]);
    await transaction(database.pool, async (executor) => {
      await retainReferenceUploadCleanupObject({ attempt, objectKey: finalKey }, { executor, now: new Date(now.getTime() + 1_000) });
      await retainReferenceUploadCleanupObject({ attempt, objectKey: thumbnailKey }, { executor, now: new Date(now.getTime() + 1_000) });
    });
    assert.deepEqual((await database.pool.query<{ object_key: string; object_role: string; state: string }>(
      'SELECT object_key, object_role, state FROM mcp_reference_upload_cleanup_objects ORDER BY object_role',
    )).rows, [
      { object_key: finalKey, object_role: 'final', state: 'retained' },
      { object_key: thumbnailKey, object_role: 'thumbnail', state: 'retained' },
    ]);
  });

  await t.test('unreferenced final upload candidate is deleted after persistence failure and expiry', async () => {
    await reset(database.pool);
    const { attempt } = await createClaimedAttempt(database.pool);
    const finalKey = `user-assets/by-content/${'c'.repeat(32)}/${fileSha256}.mp4`;
    await transaction(database.pool, (executor) => registerReferenceUploadCleanupObject(
      { attempt, objectKey: finalKey, objectRole: 'final', safeToDelete: false }, { executor, now },
    ));
    await transaction(database.pool, (executor) => abortReferenceUploadAttempt(
      { attempt }, { executor, abortedAt: new Date(now.getTime() + 1_000) },
    ));
    const deleted: string[] = [];
    assert.deepEqual(await cleanupExpiredReferenceUploadAttempts({}, {
      executor: createQueryExecutor(database.pool), now: () => new Date(now.getTime() + 2 * 60_000),
      async deleteStorageObjectKey(key) { deleted.push(key); },
    }), { selected: 1, deleted: 1 });
    assert.deepEqual(deleted, [finalKey]);
  });

  await t.test('expired attempt cannot delete a shared final while another attempt is between upload and persistence', async () => {
    await reset(database.pool);
    const { attempt: expiredAttempt } = await createClaimedAttempt(
      database.pool, new Date(now.getTime() - 14 * 60_000),
    );
    const { attempt: activeAttempt } = await createClaimedAttempt(database.pool, now, secondAttemptIds);
    const finalKey = `user-assets/by-content/${'e'.repeat(32)}/${fileSha256}.mp4`;
    await transaction(database.pool, (executor) => registerReferenceUploadCleanupObject(
      { attempt: expiredAttempt, objectKey: finalKey, objectRole: 'final', safeToDelete: false }, { executor, now },
    ));
    await transaction(database.pool, (executor) => registerReferenceUploadCleanupObject(
      { attempt: activeAttempt, objectKey: finalKey, objectRole: 'final', safeToDelete: false }, { executor, now },
    ));
    let deletes = 0;
    assert.deepEqual(await cleanupExpiredReferenceUploadAttempts({}, {
      executor: createQueryExecutor(database.pool), now: () => new Date(now.getTime() + 2 * 60_000),
      async deleteStorageObjectKey() { deletes += 1; },
    }), { selected: 0, deleted: 0 });
    assert.equal(deletes, 0);
    assert.equal((await database.pool.query<{ state: string }>(
      'SELECT state FROM mcp_reference_upload_attempts WHERE upload_id = $1', [secondAttemptIds.uploadId],
    )).rows[0]?.state, 'pending');
  });

  await t.test('deleting and deleted fences reject legacy registration and canonical persistence', async () => {
    await reset(database.pool);
    const { attempt: expiredAttempt } = await createClaimedAttempt(
      database.pool, new Date(now.getTime() - 14 * 60_000),
    );
    const { attempt: retryAttempt } = await createClaimedAttempt(database.pool, now, secondAttemptIds);
    const finalKey = `user-assets/by-content/${'f'.repeat(32)}/${fileSha256}.mp4`;
    await transaction(database.pool, (executor) => registerReferenceUploadCleanupObject(
      { attempt: expiredAttempt, objectKey: finalKey, objectRole: 'final', safeToDelete: false }, { executor, now },
    ));
    let releaseDelete: (() => void) | undefined;
    let markDeleteStarted: (() => void) | undefined;
    const deleteStarted = new Promise<void>((resolve) => { markDeleteStarted = resolve; });
    const deleteReleased = new Promise<void>((resolve) => { releaseDelete = resolve; });
    const cleanup = cleanupExpiredReferenceUploadAttempts({}, {
      executor: createQueryExecutor(database.pool), now: () => new Date(now.getTime() + 2 * 60_000),
      async deleteStorageObjectKey() { markDeleteStarted?.(); await deleteReleased; },
    });
    await deleteStarted;
    const concurrentRegistration = await transaction(database.pool, (executor) => registerReferenceUploadCleanupObject(
      { attempt: retryAttempt, objectKey: finalKey, objectRole: 'final', safeToDelete: false }, { executor, now },
    )).then(() => 'registered', () => 'blocked');
    releaseDelete?.();
    assert.deepEqual(await cleanup, { selected: 1, deleted: 1 });
    assert.equal(concurrentRegistration, 'blocked');
    assert.deepEqual((await database.pool.query<{ state: string }>(
      'SELECT state FROM mcp_reference_upload_object_fences WHERE object_key = $1', [finalKey],
    )).rows, [{ state: 'deleted' }]);

    await assert.rejects(() => transaction(database.pool, (executor) => registerReferenceUploadCleanupObject(
      { attempt: retryAttempt, objectKey: finalKey, objectRole: 'final', safeToDelete: false },
      { executor, now: new Date(now.getTime() + 1_000) },
    )), /delet|retry/iu);
    await assert.rejects(() => database.pool.query(
      'INSERT INTO user_assets (asset_id, user_id, url) VALUES ($1,$2,$3)',
      ['legacy-late-winner', 'user-a', `https://assets.maxvideo.ai/${finalKey}`],
    ), /delet|retry/iu);
  });

  await t.test('failed final deletion releases its durable key fence for cleanup retry', async () => {
    await reset(database.pool);
    const { attempt } = await createClaimedAttempt(database.pool, new Date(now.getTime() - 14 * 60_000));
    const finalKey = `user-assets/by-content/${'9'.repeat(32)}/${fileSha256}.mp4`;
    await transaction(database.pool, (executor) => registerReferenceUploadCleanupObject(
      { attempt, objectKey: finalKey, objectRole: 'final', safeToDelete: false }, { executor, now },
    ));
    assert.deepEqual(await cleanupExpiredReferenceUploadAttempts({}, {
      executor: createQueryExecutor(database.pool), now: () => new Date(now.getTime() + 2 * 60_000),
      async deleteStorageObjectKey() { throw new Error('temporary delete failure'); },
    }), { selected: 1, deleted: 0 });
    assert.deepEqual((await database.pool.query<{ state: string }>(
      'SELECT state FROM mcp_reference_upload_object_fences WHERE object_key = $1', [finalKey],
    )).rows, [{ state: 'available' }]);
    assert.equal((await database.pool.query<{ state: string }>(
      'SELECT state FROM mcp_reference_upload_cleanup_objects WHERE object_key = $1', [finalKey],
    )).rows[0]?.state, 'pending');
  });

  await t.test('shared content-addressed final candidate is retained when another canonical row references it', async () => {
    await reset(database.pool);
    const { attempt } = await createClaimedAttempt(database.pool);
    const finalKey = `user-assets/by-content/${'c'.repeat(32)}/${fileSha256}.mp4`;
    await transaction(database.pool, (executor) => registerReferenceUploadCleanupObject(
      { attempt, objectKey: finalKey, objectRole: 'final', safeToDelete: false }, { executor, now },
    ));
    await database.pool.query(
      'INSERT INTO media_assets (id, public_id, user_id, url) VALUES ($1,$2,$3,$4)',
      ['winner', publicAssetId, 'user-a', `https://assets.maxvideo.ai/${finalKey}`],
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
      'SELECT state FROM mcp_reference_upload_cleanup_objects WHERE object_key = $1', [finalKey],
    )).rows[0]?.state, 'retained');
    assert.deepEqual((await database.pool.query<{ state: string }>(
      'SELECT state FROM mcp_reference_upload_object_fences WHERE object_key = $1', [finalKey],
    )).rows, [{ state: 'referenced' }]);
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

  await t.test('workspace producer claim closes the PUT-to-canonical-row cleanup gap', async () => {
    await reset(database.pool);
    const { attempt: expiredAttempt } = await createClaimedAttempt(
      database.pool, new Date(now.getTime() - 14 * 60_000),
    );
    const finalKey = `user-assets/by-content/${'7'.repeat(32)}/${fileSha256}.mp4`;
    await transaction(database.pool, (executor) => registerReferenceUploadCleanupObject(
      { attempt: expiredAttempt, objectKey: finalKey, objectRole: 'final', safeToDelete: false }, { executor, now },
    ));
    const producer = await transaction(database.pool, (executor) => claimStorageObjectProducer(
      { objectKey: finalKey }, {
        executor, now, claimId: '00000000-0000-4000-8000-000000000701',
      },
    ));
    let deletes = 0;
    assert.deepEqual(await cleanupExpiredReferenceUploadAttempts({}, {
      executor: createQueryExecutor(database.pool), now: () => new Date(now.getTime() + 2_000),
      async deleteStorageObjectKey() { deletes += 1; },
    }), { selected: 0, deleted: 0 });
    assert.equal(deletes, 0);

    await database.pool.query(
      'INSERT INTO user_assets (asset_id, user_id, url) VALUES ($1,$2,$3)',
      ['workspace-winner', 'user-a', `https://assets.maxvideo.ai/${finalKey}`],
    );
    await transaction(database.pool, (executor) => settleStorageObjectProducer(
      { claim: producer, outcome: 'persisted' }, { executor, now: new Date(now.getTime() + 2 * 60_000 + 1_000) },
    ));
    assert.deepEqual(await cleanupExpiredReferenceUploadAttempts({}, {
      executor: createQueryExecutor(database.pool), now: () => new Date(now.getTime() + 2 * 60_000 + 2_000),
      async deleteStorageObjectKey() { deletes += 1; },
    }), { selected: 0, deleted: 0 });
    assert.equal(deletes, 0);
    assert.deepEqual((await database.pool.query<{ state: string; producer_claim_id: string | null }>(
      'SELECT state, producer_claim_id FROM mcp_reference_upload_object_fences WHERE object_key = $1', [finalKey],
    )).rows, [{ state: 'referenced', producer_claim_id: null }]);
  });

  await t.test('canonical-first persistence locks ownership until commit and defeats cleanup', async () => {
    await reset(database.pool);
    const { attempt } = await createClaimedAttempt(
      database.pool, new Date(now.getTime() - 14 * 60_000),
    );
    const finalKey = `user-assets/by-content/${'5'.repeat(32)}/${fileSha256}.mp4`;
    await transaction(database.pool, (executor) => registerReferenceUploadCleanupObject(
      { attempt, objectKey: finalKey, objectRole: 'final', safeToDelete: false }, { executor, now },
    ));
    const canonical = await database.pool.connect();
    let committed = false;
    try {
      await canonical.query('BEGIN');
      await canonical.query(
        'INSERT INTO user_assets (asset_id, user_id, url) VALUES ($1,$2,$3)',
        ['canonical-first', 'user-a', `https://assets.maxvideo.ai/${finalKey}`],
      );
      const cleanup = cleanupExpiredReferenceUploadAttempts({}, {
        executor: createQueryExecutor(database.pool), now: () => new Date(now.getTime() + 2 * 60_000),
        async deleteStorageObjectKey() {},
      });
      const beforeCommit = await Promise.race([
        cleanup.then(() => 'settled' as const),
        new Promise<'blocked'>((resolve) => setTimeout(() => resolve('blocked'), 50)),
      ]);
      assert.equal(beforeCommit, 'blocked');
      await canonical.query('COMMIT');
      committed = true;
      assert.deepEqual(await cleanup, { selected: 0, deleted: 0 });
    } finally {
      if (!committed) await canonical.query('ROLLBACK');
      canonical.release();
    }
    assert.deepEqual((await database.pool.query<{ state: string }>(
      'SELECT state FROM mcp_reference_upload_object_fences WHERE object_key = $1', [finalKey],
    )).rows, [{ state: 'referenced' }]);
  });

  await t.test('deleting rejects new workspace producers and canonical inserts until deletion settles', async () => {
    await reset(database.pool);
    const { attempt: expiredAttempt } = await createClaimedAttempt(
      database.pool, new Date(now.getTime() - 14 * 60_000),
    );
    const finalKey = `user-assets/by-content/${'8'.repeat(32)}/${fileSha256}.mp4`;
    await transaction(database.pool, (executor) => registerReferenceUploadCleanupObject(
      { attempt: expiredAttempt, objectKey: finalKey, objectRole: 'final', safeToDelete: false }, { executor, now },
    ));
    let releaseDelete: (() => void) | undefined;
    let markDeleteStarted: (() => void) | undefined;
    const deleteStarted = new Promise<void>((resolve) => { markDeleteStarted = resolve; });
    const deleteReleased = new Promise<void>((resolve) => { releaseDelete = resolve; });
    const cleanup = cleanupExpiredReferenceUploadAttempts({}, {
      executor: createQueryExecutor(database.pool), now: () => new Date(now.getTime() + 2 * 60_000),
      async deleteStorageObjectKey() { markDeleteStarted?.(); await deleteReleased; },
    });
    await deleteStarted;
    const contender = await database.pool.connect();
    try {
      await contender.query(`SET statement_timeout = '1000ms'`);
      await assert.rejects(() => claimStorageObjectProducer(
        { objectKey: finalKey }, {
          executor: createQueryExecutor(contender), now: new Date(now.getTime() + 2 * 60_000 + 1),
          claimId: '00000000-0000-4000-8000-000000000702',
        },
      ), /delet|retry/iu);
      await assert.rejects(() => contender.query(
        'INSERT INTO media_assets (id, public_id, user_id, url) VALUES ($1,$2,$3,$4)',
        ['late-winner', 'ma_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', 'user-a', `https://assets.maxvideo.ai/${finalKey}`],
      ), /delet|retry/iu);
    } finally {
      contender.release();
      releaseDelete?.();
    }
    assert.deepEqual(await cleanup, { selected: 1, deleted: 1 });
    await assert.rejects(() => database.pool.query(
      'INSERT INTO media_assets (id, public_id, user_id, url) VALUES ($1,$2,$3,$4)',
      ['post-delete-winner', 'ma_cccccccccccccccccccccccccccccccc', 'user-a', `https://assets.maxvideo.ai/${finalKey}`],
    ), /delet|retry/iu);
  });

  await t.test('a current producer reclaims a deleted key before reupload and settles referenced ownership', async () => {
    await reset(database.pool);
    const { attempt } = await createClaimedAttempt(
      database.pool, new Date(now.getTime() - 14 * 60_000),
    );
    const finalKey = `user-assets/by-content/${'4'.repeat(32)}/${fileSha256}.mp4`;
    await transaction(database.pool, (executor) => registerReferenceUploadCleanupObject(
      { attempt, objectKey: finalKey, objectRole: 'final', safeToDelete: false }, { executor, now },
    ));
    assert.deepEqual(await cleanupExpiredReferenceUploadAttempts({}, {
      executor: createQueryExecutor(database.pool), now: () => new Date(now.getTime() + 2 * 60_000),
      async deleteStorageObjectKey() {},
    }), { selected: 1, deleted: 1 });

    const producer = await transaction(database.pool, (executor) => claimStorageObjectProducer(
      { objectKey: finalKey }, {
        executor, now: new Date(now.getTime() + 2 * 60_000 + 1),
        claimId: '00000000-0000-4000-8000-000000000704',
      },
    ));
    await database.pool.query(
      'INSERT INTO user_assets (asset_id, user_id, url) VALUES ($1,$2,$3)',
      ['reuploaded-winner', 'user-a', `https://assets.maxvideo.ai/${finalKey}`],
    );
    assert.deepEqual((await database.pool.query<{ state: string; producer_claim_id: string | null }>(
      'SELECT state, producer_claim_id FROM mcp_reference_upload_object_fences WHERE object_key = $1', [finalKey],
    )).rows, [{ state: 'referenced', producer_claim_id: producer.claimId }]);
    await transaction(database.pool, (executor) => settleStorageObjectProducer(
      { claim: producer, outcome: 'persisted' },
      { executor, now: new Date(now.getTime() + 2 * 60_000 + 2) },
    ));
    assert.deepEqual((await database.pool.query<{ state: string; producer_claim_id: string | null }>(
      'SELECT state, producer_claim_id FROM mcp_reference_upload_object_fences WHERE object_key = $1', [finalKey],
    )).rows, [{ state: 'referenced', producer_claim_id: null }]);

    await database.pool.query('DELETE FROM user_assets WHERE asset_id = $1', ['reuploaded-winner']);
    assert.deepEqual((await database.pool.query<{ state: string }>(
      'SELECT state FROM mcp_reference_upload_object_fences WHERE object_key = $1', [finalKey],
    )).rows, [{ state: 'orphaned' }]);
  });

  await t.test('failed workspace persistence leaves an orphaned producer fence for durable cleanup', async () => {
    await reset(database.pool);
    const finalKey = `user-assets/by-content/${'6'.repeat(32)}/${fileSha256}.mp4`;
    const producer = await transaction(database.pool, (executor) => claimStorageObjectProducer(
      { objectKey: finalKey }, {
        executor, now, claimId: '00000000-0000-4000-8000-000000000703',
      },
    ));
    await transaction(database.pool, (executor) => settleStorageObjectProducer(
      { claim: producer, outcome: 'abandoned' }, { executor, now: new Date(now.getTime() + 1_000) },
    ));
    const deleted: string[] = [];
    assert.deepEqual(await cleanupExpiredReferenceUploadAttempts({}, {
      executor: createQueryExecutor(database.pool), now: () => new Date(now.getTime() + 2_000),
      async deleteStorageObjectKey(key) { deleted.push(key); },
    }), { selected: 1, deleted: 1 });
    assert.deepEqual(deleted, [finalKey]);
  });
});

test('migration 37 upgrades and continuously ledgers the immediately previous chunk protocol', async (t) => {
  const missing = missingDisposablePostgresCommand();
  if (missing) {
    t.skip(`${missing} is unavailable`);
    return;
  }
  const database = await startDisposablePostgres('mru37');
  t.after(() => database.cleanup());
  await database.pool.query(`CREATE TABLE media_assets (
    id text PRIMARY KEY, public_id text, user_id text, url text, thumb_url text, deleted_at timestamptz
  )`);
  await database.pool.query(`CREATE TABLE user_assets (
    asset_id text PRIMARY KEY, user_id text, url text, metadata jsonb
  )`);
  for (const migration of [32, 34, 35, 36]) {
    const name = migration === 32 ? '32_mcp_reference_uploads.sql'
      : migration === 34 ? '34_mcp_reference_upload_media_kind.sql'
        : migration === 35 ? '35_mcp_reference_upload_hardening.sql'
          : '36_mcp_reference_upload_replay_safety.sql';
    await database.pool.query(readFileSync(`neon/migrations/${name}`, 'utf8'));
  }

  async function insertPreviousBinaryUpload(ids: { sessionId: string; uploadId: string; claimId: string; partLeaseId: string }) {
    const createdAt = new Date(now.getTime() + Number(ids.sessionId.slice(-2)));
    await database.pool.query(`INSERT INTO mcp_reference_upload_sessions (
      session_id, token_hash, user_id, oauth_client_id, media_kind, state, claim_id,
      expires_at, claimed_at, created_at, updated_at
    ) VALUES ($1,$2,'user-a','client-a','video','created',$3,$4,$5,$5,$5)`, [
      ids.sessionId, ids.sessionId.replaceAll('-', '').repeat(2), ids.claimId,
      new Date(createdAt.getTime() + 15 * 60_000), createdAt,
    ]);
    const rootKey = `mcp-reference-staging/${'b'.repeat(32)}/${ids.uploadId}`;
    await database.pool.query(`INSERT INTO mcp_reference_upload_attempts (
      session_id, upload_id, user_id, media_kind, storage_key, file_name, declared_mime,
      declared_size, file_sha256, chunk_bytes, total_parts, state, created_at, updated_at
    ) VALUES ($1,$2,'user-a','video',$3,'legacy-chunk.mp4','video/mp4',4,$4,4,1,'pending',$5,$5)`, [
      ids.sessionId, ids.uploadId, rootKey, fileSha256, createdAt,
    ]);
    const partKey = `${rootKey}/parts/1-${ids.partLeaseId}`;
    await database.pool.query(`INSERT INTO mcp_reference_upload_parts (
      session_id, upload_id, user_id, media_kind, part_number, state, lease_id,
      lease_expires_at, storage_key, size_bytes, content_sha256, created_at, updated_at
    ) VALUES ($1,$2,'user-a','video',1,'ready',$3,$4,$5,4,$6,$7,$7)`, [
      ids.sessionId, ids.uploadId, ids.partLeaseId, new Date(createdAt.getTime() + 5 * 60_000),
      partKey, fileSha256, createdAt,
    ]);
    return partKey;
  }

  const migratedIds = {
    sessionId: '00000000-0000-4000-8000-000000000301', uploadId: '00000000-0000-4000-8000-000000000302',
    claimId: '00000000-0000-4000-8000-000000000303', partLeaseId: '00000000-0000-4000-8000-000000000304',
  };
  const migratedPartKey = await insertPreviousBinaryUpload(migratedIds);
  const slashlessPartKey = 'legacy-part-without-slash';
  await database.pool.query(`INSERT INTO mcp_reference_upload_parts (
    session_id, upload_id, user_id, media_kind, part_number, state, lease_id,
    lease_expires_at, storage_key, size_bytes, content_sha256, created_at, updated_at
  ) SELECT session_id, upload_id, user_id, media_kind, 2, state, $2,
      lease_expires_at, $3, size_bytes, content_sha256, created_at, updated_at
      FROM mcp_reference_upload_parts WHERE upload_id = $1`, [
    migratedIds.uploadId, '00000000-0000-4000-8000-000000000305', slashlessPartKey,
  ]);
  await database.pool.query(readFileSync('neon/migrations/37_mcp_reference_upload_recovery_state.sql', 'utf8'));
  assert.equal((await database.pool.query<{ protocol_version: number }>(
    'SELECT protocol_version FROM mcp_reference_upload_attempts WHERE upload_id = $1', [migratedIds.uploadId],
  )).rows[0]?.protocol_version, 2);
  assert.deepEqual((await database.pool.query<{ object_key: string; object_role: string; state: string }>(
    'SELECT object_key, object_role, state FROM mcp_reference_upload_cleanup_objects WHERE upload_id = $1 ORDER BY object_key', [migratedIds.uploadId],
  )).rows, [
    { object_key: slashlessPartKey, object_role: 'part', state: 'pending' },
    { object_key: migratedPartKey, object_role: 'part', state: 'pending' },
  ]);

  const overlapIds = {
    sessionId: '00000000-0000-4000-8000-000000000311', uploadId: '00000000-0000-4000-8000-000000000312',
    claimId: '00000000-0000-4000-8000-000000000313', partLeaseId: '00000000-0000-4000-8000-000000000314',
  };
  const overlapPartKey = await insertPreviousBinaryUpload(overlapIds);
  assert.equal((await database.pool.query<{ protocol_version: number }>(
    'SELECT protocol_version FROM mcp_reference_upload_attempts WHERE upload_id = $1', [overlapIds.uploadId],
  )).rows[0]?.protocol_version, 2);
  assert.deepEqual((await database.pool.query<{ object_key: string; object_role: string; state: string }>(
    'SELECT object_key, object_role, state FROM mcp_reference_upload_cleanup_objects WHERE upload_id = $1', [overlapIds.uploadId],
  )).rows, [{ object_key: overlapPartKey, object_role: 'part', state: 'pending' }]);
});
