import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { NextRequest } from 'next/server';

import type { TransactionQueryExecutor } from '../frontend/src/lib/db';
import { AgentApiError } from '../frontend/src/server/agent-api/errors';
import { cleanupExpiredReferenceUploadAttempts } from '../frontend/src/server/agent-api/reference-upload-attempts';
import {
  MCP_REFERENCE_UPLOAD_CHUNK_BYTES,
  createReferenceUploadAbortHandler,
  createReferenceUploadCompleteHandler,
  createReferenceUploadPartHandler,
  createReferenceUploadStartHandler,
} from '../frontend/src/server/uploads/create-reference-direct-upload-handlers';

const token = `mru_${'A'.repeat(43)}`;
const uploadId = '00000000-0000-4000-8000-000000000044';
const claimId = '00000000-0000-4000-8000-000000000033';
const leaseId = '00000000-0000-4000-8000-000000000055';
const sessionId = '00000000-0000-4000-8000-000000000032';
const publicAssetId = 'ma_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const executor = { async query<T>() { return [] as T[]; } } as TransactionQueryExecutor;
const now = new Date('2026-08-25T10:00:00.000Z');

function jsonRequest(path: string, body: unknown, contentLength?: string): NextRequest {
  const request = new NextRequest(`https://app.maxvideo.ai${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'https://app.maxvideo.ai' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
  if (contentLength === undefined) request.headers.delete('content-length');
  else request.headers.set('content-length', contentLength);
  return request;
}

function rawRequest(bytes: Buffer, headers: Record<string, string>): NextRequest {
  return new NextRequest(`https://app.maxvideo.ai/api/mcp/reference-upload/${token}/part`, {
    method: 'POST', body: bytes,
    headers: { origin: 'https://app.maxvideo.ai', 'content-type': 'application/octet-stream', ...headers },
  });
}

function session(overrides: Record<string, unknown> = {}) {
  return {
    sessionId, userId: 'user-a', oauthClientId: 'codex-client', mediaKind: 'video' as const,
    state: 'created' as const, claimId, assetId: null, expiresAt: new Date('2026-08-25T10:15:00.000Z'),
    claimedAt: now, uploadedAt: null, createdAt: now, updatedAt: now, ...overrides,
  };
}

function attempt(overrides: Record<string, unknown> = {}) {
  return {
    protocolVersion: 2, uploadId, session: session(), storageKey: 'mcp-reference-staging/private-prefix',
    fileName: 'reference.mp4', declaredMime: 'video/mp4', declaredSize: 5,
    fileSha256: createHash('sha256').update('abcde').digest('hex'),
    chunkBytes: 4, totalParts: 2, state: 'pending', version: 0,
    leaseId: null, leaseExpiresAt: null, contentSha256: null, stagedAssetId: null,
    ...overrides,
  };
}

const common = {
  isEnabled: () => true,
  isSameOriginRequest: () => true,
  async getRouteAuthContext() { return { userId: 'user-a' } as never; },
  async withTransaction<T>(callback: (tx: TransactionQueryExecutor) => Promise<T>) { return callback(executor); },
  now: () => now,
};

test('start accepts the exact maximum, rejects one byte over, and returns no replayable storage capability', async () => {
  let attempts = 0;
  const handler = createReferenceUploadStartHandler({
    ...common,
    async getOwnedUploadSession() { return session({ claimId: null, claimedAt: null }); },
    async claimUploadSessionForUpload() { return session(); },
    async createReferenceUploadAttempt(input) {
      attempts += 1;
      assert.equal(input.declaredSize, 50 * 1024 * 1024);
      assert.equal(input.totalParts, Math.ceil(input.declaredSize / MCP_REFERENCE_UPLOAD_CHUNK_BYTES));
      assert.match(input.fileSha256, /^[a-f0-9]{64}$/u);
      return attempt({ uploadId: input.uploadId, declaredSize: input.declaredSize, chunkBytes: input.chunkBytes, totalParts: input.totalParts });
    },
  } as never);
  const exact = await handler(jsonRequest('/start', {
    fileName: 'reference.mp4', declaredMime: 'video/mp4', sizeBytes: 50 * 1024 * 1024,
    fileSha256: 'a'.repeat(64),
  }), { params: Promise.resolve({ token }) });
  assert.equal(exact.status, 200);
  const body = await exact.json();
  assert.equal(body.ok, true);
  assert.match(body.uploadId, /^[0-9a-f-]{36}$/u);
  assert.equal(body.chunkBytes, MCP_REFERENCE_UPLOAD_CHUNK_BYTES);
  assert.equal(body.totalParts, Math.ceil(50 * 1024 * 1024 / MCP_REFERENCE_UPLOAD_CHUNK_BYTES));
  assert.doesNotMatch(JSON.stringify(body), /url|key|credential|user-a/i);

  const over = await handler(jsonRequest('/start', {
    fileName: 'over.mp4', declaredMime: 'video/mp4', sizeBytes: 50 * 1024 * 1024 + 1,
    fileSha256: 'b'.repeat(64),
  }), { params: Promise.resolve({ token }) });
  assert.equal(over.status, 413);
  assert.equal(attempts, 1);
});

test('JSON metadata is bounded from actual bytes with missing or malformed Content-Length', async () => {
  let claims = 0;
  const handler = createReferenceUploadStartHandler({
    ...common,
    async getOwnedUploadSession() { return session({ claimId: null, claimedAt: null }); },
    async claimUploadSessionForUpload() { claims += 1; return session(); },
    async createReferenceUploadAttempt(input) { return attempt({ uploadId: input.uploadId }); },
  } as never);
  const valid = {
    fileName: 'reference.mp4', declaredMime: 'video/mp4', sizeBytes: 1, fileSha256: 'a'.repeat(64),
  };
  for (const length of [undefined, 'not-a-number']) {
    const response = await handler(jsonRequest('/start', valid, length), { params: Promise.resolve({ token }) });
    assert.equal(response.status, 200);
  }
  const huge = `{"padding":"${'x'.repeat(17 * 1024)}"}`;
  const oversized = await handler(jsonRequest('/start', huge), { params: Promise.resolve({ token }) });
  assert.equal(oversized.status, 413);
  const malformed = await handler(jsonRequest('/start', '{broken'), { params: Promise.resolve({ token }) });
  assert.equal(malformed.status, 400);
  assert.equal(claims, 2);
});

test('part relay enforces exact server-owned part length and SHA-256 before private storage', async () => {
  const stored: Array<Record<string, unknown>> = [];
  const completed: Array<Record<string, unknown>> = [];
  const handler = createReferenceUploadPartHandler({
    ...common,
    async getOwnedReferenceUploadAttempt() { return attempt(); },
    async claimReferenceUploadPart(input) {
      assert.equal(input.partNumber, 1);
      return { leaseId, storageKey: 'server-owned/part-1', alreadyStored: false };
    },
    async uploadFileBufferToKey(input) { stored.push(input); return { key: 'server-owned/part-1', url: 'private' }; },
    async completeReferenceUploadPart(input) { completed.push(input); return { partNumber: 1 } as never; },
  } as never);
  const bytes = Buffer.from('abcd');
  const sha = createHash('sha256').update(bytes).digest('hex');
  const response = await handler(rawRequest(bytes, {
    'x-upload-id': uploadId, 'x-part-number': '1', 'x-content-sha256': sha,
  }), { params: Promise.resolve({ token }) });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, partNumber: 1 });
  assert.equal(stored.length, 1);
  assert.equal(stored[0].key, 'server-owned/part-1');
  assert.equal(stored[0].acl, null);
  assert.equal(completed[0].sizeBytes, 4);
  assert.equal(completed[0].contentSha256, sha);

  const oversized = await handler(rawRequest(Buffer.from('abcde'), {
    'x-upload-id': uploadId, 'x-part-number': '1',
    'x-content-sha256': createHash('sha256').update('abcde').digest('hex'),
  }), { params: Promise.resolve({ token }) });
  assert.equal(oversized.status, 413);
  assert.equal(stored.length, 1);
});

test('part storage failure releases the exact lease and consumes only its durable cleanup tombstone', async () => {
  const failed: Array<Record<string, unknown>> = [];
  const deleted: string[] = [];
  const handler = createReferenceUploadPartHandler({
    ...common,
    async getOwnedReferenceUploadAttempt() { return attempt(); },
    async claimReferenceUploadPart() { return { leaseId, storageKey: 'server-owned/unique-part', alreadyStored: false }; },
    async uploadFileBufferToKey() { throw new Error('storage failed'); },
    async failReferenceUploadPart(input) { failed.push(input); return true; },
    async cleanupReferenceUploadObject(input) { deleted.push(input.objectKey); return true; },
    async deleteStorageObjectKey() { throw new Error('must delete through durable ledger'); },
  } as never);
  const bytes = Buffer.from('abcd');
  const response = await handler(rawRequest(bytes, {
    'x-upload-id': uploadId, 'x-part-number': '1',
    'x-content-sha256': createHash('sha256').update(bytes).digest('hex'),
  }), { params: Promise.resolve({ token }) });
  assert.equal(response.status, 500);
  assert.equal(failed[0]?.leaseId, leaseId);
  assert.deepEqual(deleted, ['server-owned/unique-part']);
});

test('completed uploadId and old part requests are unusable after successful finalization', async () => {
  let stores = 0;
  const partHandler = createReferenceUploadPartHandler({
    ...common,
    async getOwnedReferenceUploadAttempt() { return attempt({ state: 'completed' }); },
    async uploadFileBufferToKey() { stores += 1; throw new Error('must not store'); },
  } as never);
  const partResponse = await partHandler(rawRequest(Buffer.from('abcd'), {
    'x-upload-id': uploadId, 'x-part-number': '1', 'x-content-sha256': 'a'.repeat(64),
  }), { params: Promise.resolve({ token }) });
  assert.equal(partResponse.status, 409);

  const completeHandler = createReferenceUploadCompleteHandler({
    ...common,
    async getOwnedReferenceUploadAttempt() { return attempt({ state: 'completed', stagedAssetId: publicAssetId, contentSha256: 'a'.repeat(64) }); },
  } as never);
  const completeResponse = await completeHandler(jsonRequest('/complete', { uploadId }), { params: Promise.resolve({ token }) });
  assert.equal(completeResponse.status, 409);
  assert.equal(stores, 0);
});

test('rolling v1 attempts fail closed with restart semantics before reading parts or storing media', async () => {
  let effects = 0;
  const legacy = attempt({
    protocolVersion: 1, fileSha256: null, chunkBytes: null, totalParts: null,
  });
  const complete = createReferenceUploadCompleteHandler({
    ...common,
    async getOwnedReferenceUploadAttempt() { return legacy; },
    async abortReferenceUploadAttempt() { return attempt({ ...legacy, state: 'aborted' }); },
    async cleanupReferenceUploadParts() { return 0; },
    async deleteStorageObjectKey() { return undefined; },
    async acquireReferenceUploadCompletionLease() { effects += 1; throw new Error('must not lease v1'); },
    async storeVideoUpload() { effects += 1; throw new Error('must not store v1'); },
  } as never);
  const response = await complete(jsonRequest('/complete', { uploadId }), { params: Promise.resolve({ token }) });
  assert.equal(response.status, 410);
  assert.equal(effects, 0);
});

test('completion lease allows one persister and recovery reuses the staged canonical asset', async () => {
  let leases = 0;
  let stores = 0;
  let renewals = 0;
  const dependencies = {
    ...common,
    async getOwnedReferenceUploadAttempt() { return attempt(); },
    async acquireReferenceUploadCompletionLease() {
      leases += 1;
      if (leases === 2) throw new AgentApiError('UPLOAD_ALREADY_USED', 'Upload is already processing.');
      return attempt({ state: 'processing', leaseId });
    },
    async renewReferenceUploadCompletionLease(input) {
      renewals += 1;
      return { ...input.attempt, leaseExpiresAt: new Date(now.getTime() + 5 * 60_000) };
    },
    async listReferenceUploadParts() {
      return [
        { partNumber: 1, storageKey: 'part-1', sizeBytes: 4, contentSha256: createHash('sha256').update('abcd').digest('hex') },
        { partNumber: 2, storageKey: 'part-2', sizeBytes: 1, contentSha256: createHash('sha256').update('e').digest('hex') },
      ];
    },
    async getStorageObjectBuffer(key: string) { return Buffer.from(key === 'part-1' ? 'abcd' : 'e'); },
    async storeVideoUpload() { stores += 1; return { assetId: publicAssetId } as never; },
    async stageReferenceUploadAttempt() { return attempt({ state: 'staged', leaseId, stagedAssetId: publicAssetId, contentSha256: attempt().fileSha256 }); },
    async completeUploadSession() { return session({ state: 'uploaded', assetId: publicAssetId }) as never; },
    async completeReferenceUploadAttempt() { return attempt({ state: 'completed', stagedAssetId: publicAssetId }); },
    async cleanupReferenceUploadParts() { return 2; },
  };
  const handler = createReferenceUploadCompleteHandler(dependencies as never);
  const [first, second] = await Promise.all([
    handler(jsonRequest('/complete', { uploadId }), { params: Promise.resolve({ token }) }),
    handler(jsonRequest('/complete', { uploadId }), { params: Promise.resolve({ token }) }),
  ]);
  assert.deepEqual([first.status, second.status].sort(), [200, 409]);
  assert.equal(stores, 1);
  assert.equal(renewals, 6);

  const recovery = createReferenceUploadCompleteHandler({
    ...dependencies,
    async getOwnedReferenceUploadAttempt() {
      return attempt({ state: 'staged', stagedAssetId: publicAssetId, contentSha256: attempt().fileSha256 });
    },
    async acquireReferenceUploadCompletionLease() {
      return attempt({ state: 'processing', leaseId, stagedAssetId: publicAssetId, contentSha256: attempt().fileSha256 });
    },
    async storeVideoUpload() { throw new Error('must reuse staged asset'); },
  } as never);
  assert.equal((await recovery(jsonRequest('/complete', { uploadId }), { params: Promise.resolve({ token }) })).status, 200);
  assert.equal(stores, 1);
  assert.equal(renewals, 7);
});

test('failure after durable staging records retry state and the next lease does not persist twice', async () => {
  let stores = 0;
  let failures = 0;
  const staged = attempt({ state: 'staged', leaseId, stagedAssetId: publicAssetId, contentSha256: attempt().fileSha256 });
  const first = createReferenceUploadCompleteHandler({
    ...common,
    async getOwnedReferenceUploadAttempt() { return attempt(); },
    async acquireReferenceUploadCompletionLease() { return attempt({ state: 'processing', leaseId }); },
    async renewReferenceUploadCompletionLease(input) { return input.attempt; },
    async listReferenceUploadParts() {
      return [
        { partNumber: 1, storageKey: 'part-1', sizeBytes: 4, contentSha256: createHash('sha256').update('abcd').digest('hex') },
        { partNumber: 2, storageKey: 'part-2', sizeBytes: 1, contentSha256: createHash('sha256').update('e').digest('hex') },
      ];
    },
    async getStorageObjectBuffer(key: string) { return Buffer.from(key === 'part-1' ? 'abcd' : 'e'); },
    async storeVideoUpload() { stores += 1; return { assetId: publicAssetId } as never; },
    async stageReferenceUploadAttempt() { return staged; },
    async completeUploadSession() { throw new Error('transaction failed'); },
    async failReferenceUploadAttempt() { failures += 1; return true; },
  } as never);
  assert.equal((await first(jsonRequest('/complete', { uploadId }), { params: Promise.resolve({ token }) })).status, 500);
  assert.equal(stores, 1);
  assert.equal(failures, 1);

  const retry = createReferenceUploadCompleteHandler({
    ...common,
    async getOwnedReferenceUploadAttempt() { return attempt({ state: 'failed', stagedAssetId: publicAssetId, contentSha256: attempt().fileSha256 }); },
    async acquireReferenceUploadCompletionLease() { return attempt({ state: 'processing', leaseId, version: 2, stagedAssetId: publicAssetId, contentSha256: attempt().fileSha256 }); },
    async renewReferenceUploadCompletionLease(input) { return input.attempt; },
    async storeVideoUpload() { stores += 1; throw new Error('must not persist twice'); },
    async completeUploadSession() { return session({ state: 'uploaded', assetId: publicAssetId }) as never; },
    async completeReferenceUploadAttempt() { return attempt({ state: 'completed', stagedAssetId: publicAssetId, contentSha256: attempt().fileSha256 }); },
    async cleanupReferenceUploadParts() { return 2; },
  } as never);
  assert.equal((await retry(jsonRequest('/complete', { uploadId }), { params: Promise.resolve({ token }) })).status, 200);
  assert.equal(stores, 1);
});

test('duplicate MCP image returns the existing opaque asset without inventing cleanup transitions', async () => {
  let cleanupTransitions = 0;
  const imageSession = session({ mediaKind: 'image' });
  const imageAttempt = attempt({
    session: imageSession,
    fileName: 'reference.png',
    declaredMime: 'image/png',
  });
  const handler = createReferenceUploadCompleteHandler({
    ...common,
    async getOwnedReferenceUploadAttempt() { return imageAttempt; },
    async acquireReferenceUploadCompletionLease() {
      return { ...imageAttempt, state: 'processing', leaseId };
    },
    async renewReferenceUploadCompletionLease(input) { return input.attempt; },
    async listReferenceUploadParts() {
      return [
        { partNumber: 1, storageKey: 'part-1', sizeBytes: 4, contentSha256: createHash('sha256').update('abcd').digest('hex') },
        { partNumber: 2, storageKey: 'part-2', sizeBytes: 1, contentSha256: createHash('sha256').update('e').digest('hex') },
      ];
    },
    async getStorageObjectBuffer(key: string) { return Buffer.from(key === 'part-1' ? 'abcd' : 'e'); },
    async storeImageUpload() {
      return { assetId: 'existing-image-row' } as never;
    },
    async loadStoredImageUploadRouteAsset() {
      return {
        assetId: 'existing-image-row',
        url: 'https://assets.maxvideo.ai/existing.webp',
        width: 1,
        height: 1,
        mimeType: 'image/webp',
        sizeBytes: 5,
        thumbUrl: null,
      } as never;
    },
    async ensureReusableAsset() { return { publicId: publicAssetId } as never; },
    async registerReferenceUploadCleanupObject() { cleanupTransitions += 1; throw new Error('duplicate must not register cleanup'); },
    async retainReferenceUploadCleanupObject() { cleanupTransitions += 1; throw new Error('duplicate must not retain absent cleanup'); },
    async stageReferenceUploadAttempt() {
      return { ...imageAttempt, state: 'staged', leaseId, stagedAssetId: publicAssetId };
    },
    async completeUploadSession() { return { ...imageSession, state: 'uploaded', assetId: publicAssetId } as never; },
    async completeReferenceUploadAttempt() {
      return { ...imageAttempt, state: 'completed', stagedAssetId: publicAssetId };
    },
    async cleanupReferenceUploadParts() { return 2; },
  } as never);

  const response = await handler(jsonRequest('/complete', { uploadId }), { params: Promise.resolve({ token }) });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, assetId: publicAssetId, mediaKind: 'image' });
  assert.equal(cleanupTransitions, 0);
});

test('one finalization budget and AbortSignal cover part downloads before media side effects', async () => {
  let downloadSignal: AbortSignal | undefined;
  let stores = 0;
  let failures = 0;
  const handler = createReferenceUploadCompleteHandler({
    ...common,
    finalizationTimeoutMs: 10,
    async getOwnedReferenceUploadAttempt() { return attempt(); },
    async acquireReferenceUploadCompletionLease() { return attempt({ state: 'processing', leaseId }); },
    async renewReferenceUploadCompletionLease(input) { return input.attempt; },
    async listReferenceUploadParts() {
      return [
        { partNumber: 1, storageKey: 'part-1', sizeBytes: 4, contentSha256: createHash('sha256').update('abcd').digest('hex') },
        { partNumber: 2, storageKey: 'part-2', sizeBytes: 1, contentSha256: createHash('sha256').update('e').digest('hex') },
      ];
    },
    async getStorageObjectBuffer(key: string, options?: { signal?: AbortSignal }) {
      downloadSignal = options?.signal;
      await new Promise((resolve) => setTimeout(resolve, 25));
      options?.signal?.throwIfAborted();
      return Buffer.from(key === 'part-1' ? 'abcd' : 'e');
    },
    async storeVideoUpload() { stores += 1; return { assetId: publicAssetId } as never; },
    async failReferenceUploadAttempt() { failures += 1; return true; },
  } as never);

  const response = await handler(jsonRequest('/complete', { uploadId }), { params: Promise.resolve({ token }) });
  assert.equal(response.status, 500);
  assert.equal(downloadSignal instanceof AbortSignal, true);
  assert.equal(downloadSignal?.aborted, true);
  assert.equal(stores, 0);
  assert.equal(failures, 1);
});

test('bounded finalization aborts timed-out media work and leaves the lease retryable', async () => {
  let observedAbort = false;
  let compensationSettled = false;
  let failureBeforeSettlement = false;
  let failures = 0;
  const handler = createReferenceUploadCompleteHandler({
    ...common,
    finalizationTimeoutMs: 10,
    async getOwnedReferenceUploadAttempt() { return attempt(); },
    async acquireReferenceUploadCompletionLease() { return attempt({ state: 'processing', leaseId }); },
    async renewReferenceUploadCompletionLease(input) { return input.attempt; },
    async listReferenceUploadParts() {
      return [
        { partNumber: 1, storageKey: 'part-1', sizeBytes: 4, contentSha256: createHash('sha256').update('abcd').digest('hex') },
        { partNumber: 2, storageKey: 'part-2', sizeBytes: 1, contentSha256: createHash('sha256').update('e').digest('hex') },
      ];
    },
    async getStorageObjectBuffer(key: string) { return Buffer.from(key === 'part-1' ? 'abcd' : 'e'); },
    async storeVideoUpload(input) {
      const signal = (input as { signal?: AbortSignal }).signal;
      await new Promise<never>((_resolve, reject) => {
        const fallback = setTimeout(() => reject(new Error('media work was not bounded')), 100);
        signal?.addEventListener('abort', async () => {
          clearTimeout(fallback);
          observedAbort = true;
          await new Promise((resolve) => setTimeout(resolve, 20));
          compensationSettled = true;
          reject(new Error('media finalization aborted'));
        }, { once: true });
      });
      throw new Error('unreachable');
    },
    async failReferenceUploadAttempt() {
      failures += 1;
      failureBeforeSettlement = !compensationSettled;
      return true;
    },
  } as never);
  const response = await handler(jsonRequest('/complete', { uploadId }), { params: Promise.resolve({ token }) });
  assert.equal(response.status, 500);
  assert.equal(observedAbort, true);
  assert.equal(compensationSettled, true);
  assert.equal(failureBeforeSettlement, false);
  assert.equal(failures, 1);
});

test('completion heartbeat renews the durable lease while a database-backed store is stalled beyond the base lease', async () => {
  let fakeNow = now;
  let heartbeat: (() => Promise<void>) | undefined;
  let releaseStore: (() => void) | undefined;
  let markStoreStarted: (() => void) | undefined;
  const storeStarted = new Promise<void>((resolve) => { markStoreStarted = resolve; });
  const storeReleased = new Promise<void>((resolve) => { releaseStore = resolve; });
  const renewalTimes: number[] = [];
  let completed = 0;
  const handler = createReferenceUploadCompleteHandler({
    ...common,
    now: () => fakeNow,
    scheduleLeaseHeartbeat(callback) {
      heartbeat = callback;
      return () => undefined;
    },
    async getOwnedReferenceUploadAttempt() { return attempt(); },
    async acquireReferenceUploadCompletionLease() {
      return attempt({ state: 'processing', leaseId, leaseExpiresAt: new Date(fakeNow.getTime() + 5 * 60_000) });
    },
    async renewReferenceUploadCompletionLease(input) {
      renewalTimes.push(fakeNow.getTime());
      return { ...input.attempt, leaseExpiresAt: new Date(fakeNow.getTime() + 5 * 60_000) };
    },
    async listReferenceUploadParts() {
      return [
        { partNumber: 1, storageKey: 'part-1', sizeBytes: 4, contentSha256: createHash('sha256').update('abcd').digest('hex') },
        { partNumber: 2, storageKey: 'part-2', sizeBytes: 1, contentSha256: createHash('sha256').update('e').digest('hex') },
      ];
    },
    async getStorageObjectBuffer(key: string) { return Buffer.from(key === 'part-1' ? 'abcd' : 'e'); },
    async storeVideoUpload(input) {
      markStoreStarted?.();
      await storeReleased;
      input.signal?.throwIfAborted();
      return { assetId: publicAssetId } as never;
    },
    async stageReferenceUploadAttempt() {
      return attempt({ state: 'staged', leaseId, stagedAssetId: publicAssetId, contentSha256: attempt().fileSha256 });
    },
    async completeUploadSession() { return session({ state: 'uploaded', assetId: publicAssetId }) as never; },
    async completeReferenceUploadAttempt() {
      completed += 1;
      return attempt({ state: 'completed', stagedAssetId: publicAssetId });
    },
    async cleanupReferenceUploadParts() { return 2; },
  } as never);

  const responsePromise = handler(jsonRequest('/complete', { uploadId }), { params: Promise.resolve({ token }) });
  await storeStarted;
  const scheduledHeartbeat = heartbeat;
  if (scheduledHeartbeat) {
    fakeNow = new Date(now.getTime() + 4 * 60_000);
    await scheduledHeartbeat();
    fakeNow = new Date(now.getTime() + 8 * 60_000);
    await scheduledHeartbeat();
  }
  releaseStore?.();
  const response = await responsePromise;
  assert.ok(scheduledHeartbeat, 'the lease heartbeat must remain scheduled while persistence is stalled');
  assert.equal(response.status, 200);
  assert.deepEqual(renewalTimes, [now.getTime() + 4 * 60_000, now.getTime() + 8 * 60_000]);
  assert.equal(completed, 1);
});

test('timeout keeps heartbeating through delayed compensation and fence loss aborts before later persistence effects', async () => {
  let fakeNow = now;
  let heartbeat: (() => Promise<void>) | undefined;
  let markAborted: (() => void) | undefined;
  let releaseCompensation: (() => void) | undefined;
  const aborted = new Promise<void>((resolve) => { markAborted = resolve; });
  const compensationReleased = new Promise<void>((resolve) => { releaseCompensation = resolve; });
  let heartbeatLost = false;
  let stages = 0;
  let completions = 0;
  let failures = 0;
  const handler = createReferenceUploadCompleteHandler({
    ...common,
    now: () => fakeNow,
    finalizationTimeoutMs: 10,
    scheduleLeaseHeartbeat(callback) {
      heartbeat = callback;
      return () => undefined;
    },
    async getOwnedReferenceUploadAttempt() { return attempt(); },
    async acquireReferenceUploadCompletionLease() {
      return attempt({ state: 'processing', leaseId, leaseExpiresAt: new Date(fakeNow.getTime() + 5 * 60_000) });
    },
    async renewReferenceUploadCompletionLease(input) {
      if (heartbeatLost) throw new AgentApiError('UPLOAD_ALREADY_USED', 'Reference upload lease was lost.');
      return { ...input.attempt, leaseExpiresAt: new Date(fakeNow.getTime() + 5 * 60_000) };
    },
    async listReferenceUploadParts() {
      return [
        { partNumber: 1, storageKey: 'part-1', sizeBytes: 4, contentSha256: createHash('sha256').update('abcd').digest('hex') },
        { partNumber: 2, storageKey: 'part-2', sizeBytes: 1, contentSha256: createHash('sha256').update('e').digest('hex') },
      ];
    },
    async getStorageObjectBuffer(key: string) { return Buffer.from(key === 'part-1' ? 'abcd' : 'e'); },
    async storeVideoUpload(input) {
      await new Promise<void>((resolve) => input.signal?.addEventListener('abort', () => {
        markAborted?.();
        resolve();
      }, { once: true }));
      await compensationReleased;
      input.signal?.throwIfAborted();
      throw new Error('unreachable');
    },
    async stageReferenceUploadAttempt() { stages += 1; throw new Error('must not stage after fence loss'); },
    async completeUploadSession() { completions += 1; throw new Error('must not complete after fence loss'); },
    async completeReferenceUploadAttempt() { completions += 1; throw new Error('must not complete after fence loss'); },
    async failReferenceUploadAttempt() { failures += 1; return true; },
  } as never);

  const responsePromise = handler(jsonRequest('/complete', { uploadId }), { params: Promise.resolve({ token }) });
  await aborted;
  const scheduledHeartbeat = heartbeat;
  if (scheduledHeartbeat) {
    fakeNow = new Date(now.getTime() + 4 * 60_000);
    await scheduledHeartbeat();
    heartbeatLost = true;
    fakeNow = new Date(now.getTime() + 8 * 60_000);
    await assert.rejects(() => scheduledHeartbeat(), /lease was lost/iu);
  }
  assert.equal(failures, 0, 'the completion lease must not release before compensation settles');
  releaseCompensation?.();
  const response = await responsePromise;
  assert.ok(scheduledHeartbeat, 'timeout compensation must retain an active heartbeat owner');
  assert.equal(response.status, 500);
  assert.equal(stages, 0);
  assert.equal(completions, 0);
  assert.equal(failures, 1);
});

test('abort and expired attempts clean all server-owned parts and make the upload unusable', async () => {
  const deleted: string[] = [];
  const handler = createReferenceUploadAbortHandler({
    ...common,
    async getOwnedReferenceUploadAttempt() { return attempt(); },
    async abortReferenceUploadAttempt() { return attempt({ state: 'aborted' }); },
    async cleanupReferenceUploadParts(_input, dependencies) {
      await dependencies.deleteStorageObjectKey('part-1');
      await dependencies.deleteStorageObjectKey('part-2');
      return 2;
    },
    async deleteStorageObjectKey(key: string) { deleted.push(key); },
  } as never);
  const response = await handler(jsonRequest('/abort', { uploadId }), { params: Promise.resolve({ token }) });
  assert.equal(response.status, 200);
  assert.deepEqual(deleted, ['part-1', 'part-2']);

  const expiredPart = createReferenceUploadPartHandler({
    ...common,
    async getOwnedReferenceUploadAttempt() {
      return attempt({ session: session({ expiresAt: new Date(now.getTime() - 1) }) });
    },
    async abortReferenceUploadAttempt() { return attempt({ state: 'aborted' }); },
    async cleanupReferenceUploadParts() { return 2; },
  } as never);
  const expired = await expiredPart(rawRequest(Buffer.from('abcd'), {
    'x-upload-id': uploadId, 'x-part-number': '1', 'x-content-sha256': 'a'.repeat(64),
  }), { params: Promise.resolve({ token }) });
  assert.equal(expired.status, 410);

  let racedCleanup = 0;
  const racedAbort = createReferenceUploadAbortHandler({
    ...common,
    async getOwnedReferenceUploadAttempt() { return attempt(); },
    async abortReferenceUploadAttempt() {
      throw new AgentApiError('UPLOAD_ALREADY_USED', 'A concurrent finalizer completed first.');
    },
    async cleanupReferenceUploadParts() { racedCleanup += 1; return 0; },
  } as never);
  const raced = await racedAbort(jsonRequest('/abort', { uploadId }), { params: Promise.resolve({ token }) });
  assert.equal(raced.status, 409);
  assert.equal(racedCleanup, 0);
});

test('durable cleanup aborts never-finalized expired attempts and retains failed deletions for retry', async () => {
  const calls: string[] = [];
  const cleanupExecutor = {
    async query<T>(sql: string, values?: readonly unknown[]) {
      calls.push(sql);
      if (calls.length === 1) {
        assert.equal(values?.[1], 100);
        return [
          { cleanup_id: '00000000-0000-4000-8000-000000000201', object_key: 'attempt/parts/part-ok', owner_prefix: 'attempt/parts/', object_role: 'part', attempt_storage_key: 'attempt' },
          { cleanup_id: '00000000-0000-4000-8000-000000000202', object_key: 'attempt/parts/part-retry', owner_prefix: 'attempt/parts/', object_role: 'part', attempt_storage_key: 'attempt' },
        ] as T[];
      }
      assert.deepEqual(values?.[0], ['00000000-0000-4000-8000-000000000201']);
      return [] as T[];
    },
  } as TransactionQueryExecutor;
  const deleted: string[] = [];
  const result = await cleanupExpiredReferenceUploadAttempts({ limit: 100 }, {
    executor: cleanupExecutor,
    now: () => now,
    async deleteStorageObjectKey(key) {
      deleted.push(key);
      if (key.endsWith('part-retry')) throw new Error('temporary storage outage');
    },
  });
  assert.deepEqual(result, { selected: 2, deleted: 1 });
  assert.deepEqual(deleted, ['attempt/parts/part-ok', 'attempt/parts/part-retry']);
  assert.match(calls[0] ?? '', /FOR UPDATE(?:\s+OF\s+attempts)?\s+SKIP LOCKED/iu);
  assert.match(calls[0] ?? '', /state\s*=\s*'aborted'/iu);
});

test('browser and deployed routes use chunk relay and expose no signed PUT capability', () => {
  const client = readFileSync('frontend/app/(core)/mcp/reference-upload/[token]/_components/ReferenceUploadClient.tsx', 'utf8');
  const handlers = readFileSync('frontend/src/server/uploads/create-reference-direct-upload-handlers.ts', 'utf8');
  for (const route of ['start', 'part', 'complete', 'abort']) {
    const source = readFileSync(`frontend/app/api/mcp/reference-upload/[token]/${route}/route.ts`, 'utf8');
    assert.match(source, /resolveMcpRuntimeCapabilities/u);
    assert.match(source, /getMcpRequestHost/u);
  }
  assert.match(client, /\/part/u);
  assert.match(client, /x-content-sha256/iu);
  assert.match(client, /\/complete/u);
  assert.doesNotMatch(client, /method:\s*'PUT'|uploadUrl/u);
  assert.doesNotMatch(handlers, /createSignedUploadUrl|signed-put/iu);

  const cleanupCron = readFileSync('frontend/app/api/cron/mcp-reference-upload-cleanup/route.ts', 'utf8');
  assert.match(cleanupCron, /if\s*\(!cronSecret\)\s*return[\s\S]*503/iu);
  assert.doesNotMatch(cleanupCron, /x-vercel-cron|user-agent/iu);
});
