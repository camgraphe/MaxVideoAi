import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { NextRequest } from 'next/server';

import type { TransactionQueryExecutor } from '../frontend/src/lib/db';
import {
  createReferenceUploadCompleteHandler,
  createReferenceUploadStartHandler,
} from '../frontend/src/server/uploads/create-reference-direct-upload-handlers';

const token = `mru_${'A'.repeat(43)}`;
const uploadId = '00000000-0000-4000-8000-000000000044';
const claimId = '00000000-0000-4000-8000-000000000033';
const sessionId = '00000000-0000-4000-8000-000000000032';
const publicAssetId = 'ma_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const executor = { async query<T>() { return [] as T[]; } } as TransactionQueryExecutor;

function request(path: string, body: unknown): NextRequest {
  return new NextRequest(`https://app.maxvideo.ai${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'https://app.maxvideo.ai' },
    body: JSON.stringify(body),
  });
}

function session(overrides: Record<string, unknown> = {}) {
  const now = new Date('2026-08-25T10:00:00.000Z');
  return {
    sessionId, userId: 'user-a', oauthClientId: 'codex-client', mediaKind: 'video' as const,
    state: 'created' as const, claimId, assetId: null, expiresAt: new Date('2026-08-25T10:15:00.000Z'),
    claimedAt: now, uploadedAt: null, createdAt: now, updatedAt: now, ...overrides,
  };
}

test('direct start binds owner, kind, exact file boundary and returns only a short-lived signed PUT capability', async () => {
  const events: string[] = [];
  const handler = createReferenceUploadStartHandler({
    isEnabled: () => true,
    isSameOriginRequest: () => true,
    async getRouteAuthContext() { events.push('auth'); return { userId: 'user-a' } as never; },
    async getOwnedUploadSession() { events.push('session'); return session({ claimId: null, claimedAt: null }); },
    async createSignedUploadUrl() {
      events.push('sign');
      return {
        key: 'private/staging/key.mp4', publicUrl: 'https://cdn.example/private/staging/key.mp4',
        url: 'https://storage.example/signed-put?X-Amz-Expires=300', headers: { 'Content-Type': 'video/mp4' },
      };
    },
    async withTransaction<T>(callback: (tx: TransactionQueryExecutor) => Promise<T>) { return callback(executor); },
    async claimUploadSessionForUpload() { events.push('claim'); return session(); },
    async createReferenceUploadAttempt(input) {
      events.push('attempt');
      assert.equal(input.storageKey, 'private/staging/key.mp4');
      assert.equal(input.declaredSize, 50 * 1024 * 1024);
      assert.equal(input.mediaKind, 'video');
      return { uploadId } as never;
    },
  } as never);

  const response = await handler(
    request(`/api/mcp/reference-upload/${token}/start`, {
      fileName: 'reference.mp4', declaredMime: 'video/mp4', sizeBytes: 50 * 1024 * 1024,
    }),
    { params: Promise.resolve({ token }) },
  );
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(body, {
    ok: true, uploadId, uploadUrl: 'https://storage.example/signed-put?X-Amz-Expires=300',
    headers: { 'Content-Type': 'video/mp4' }, expiresInSeconds: 300,
  });
  assert.doesNotMatch(JSON.stringify(body), /private\/staging|publicUrl|storageKey|user-a/u);
  assert.deepEqual(events, ['auth', 'session', 'sign', 'claim', 'attempt']);
});

test('direct start rejects oversized request metadata before JSON parsing and an over-boundary file before signing', async () => {
  let parsed = 0;
  let signed = 0;
  const handler = createReferenceUploadStartHandler({
    isEnabled: () => true,
    isSameOriginRequest: () => true,
    async getRouteAuthContext() { return { userId: 'user-a' } as never; },
    async getOwnedUploadSession() { return session({ claimId: null, claimedAt: null }); },
    async createSignedUploadUrl() { signed += 1; throw new Error('must not sign'); },
  } as never);
  const huge = request(`/api/mcp/reference-upload/${token}/start`, {});
  Object.defineProperty(huge, 'json', { value: async () => { parsed += 1; return {}; } });
  huge.headers.set('content-length', '16385');
  assert.equal((await handler(huge, { params: Promise.resolve({ token }) })).status, 413);
  assert.equal(parsed, 0);

  const over = request(`/api/mcp/reference-upload/${token}/start`, {
    fileName: 'over.mp4', declaredMime: 'video/mp4', sizeBytes: 50 * 1024 * 1024 + 1,
  });
  assert.equal((await handler(over, { params: Promise.resolve({ token }) })).status, 413);
  assert.equal(signed, 0);
});

test('direct completion verifies storage metadata and actual bytes at the exact boundary, stages durably, then consumes once', async () => {
  const bytes = Buffer.alloc(50 * 1024 * 1024);
  const events: string[] = [];
  const handler = createReferenceUploadCompleteHandler({
    isEnabled: () => true,
    isSameOriginRequest: () => true,
    async getRouteAuthContext() { events.push('auth'); return { userId: 'user-a' } as never; },
    async getOwnedReferenceUploadAttempt() {
      return {
        uploadId, session: session(), storageKey: 'private/staging/key.mp4', fileName: 'reference.mp4',
        declaredMime: 'video/mp4', declaredSize: bytes.length, contentSha256: null, stagedAssetId: null,
      } as never;
    },
    async getStorageObjectMetadata() { events.push('head'); return { size: bytes.length, mime: 'video/mp4' }; },
    async getStorageObjectBuffer() { events.push('read'); return bytes; },
    async storeVideoUpload(input) {
      events.push('store');
      assert.equal(input.referenceEligibility, 'mcp');
      return { assetId: publicAssetId } as never;
    },
    async withTransaction<T>(callback: (tx: TransactionQueryExecutor) => Promise<T>) { return callback(executor); },
    async stageReferenceUploadAttempt(input) {
      events.push('stage');
      assert.match(input.contentSha256, /^[a-f0-9]{64}$/u);
      return { stagedAssetId: publicAssetId } as never;
    },
    async completeUploadSession() { events.push('complete'); return session({ state: 'uploaded', assetId: publicAssetId }) as never; },
    async deleteStorageObjectKey() { events.push('cleanup'); },
  } as never);
  const response = await handler(
    request(`/api/mcp/reference-upload/${token}/complete`, { uploadId }),
    { params: Promise.resolve({ token }) },
  );
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, assetId: publicAssetId, mediaKind: 'video' });
  assert.deepEqual(events, ['auth', 'head', 'read', 'store', 'stage', 'complete', 'cleanup']);
});

test('completion retry uses the durably staged asset, and invalid staging objects are safely cleaned', async () => {
  let stores = 0;
  let deletes = 0;
  const common = {
    isEnabled: () => true,
    isSameOriginRequest: () => true,
    async getRouteAuthContext() { return { userId: 'user-a' } as never; },
    async withTransaction<T>(callback: (tx: TransactionQueryExecutor) => Promise<T>) { return callback(executor); },
    async completeUploadSession() { return session({ state: 'uploaded', assetId: publicAssetId }) as never; },
    async deleteStorageObjectKey() { deletes += 1; },
    async storeVideoUpload() { stores += 1; throw new Error('must not restore staged asset'); },
  };
  const retry = createReferenceUploadCompleteHandler({
    ...common,
    async getOwnedReferenceUploadAttempt() {
      return {
        uploadId, session: session(), storageKey: 'private/staging/key.mp4', fileName: 'reference.mp4',
        declaredMime: 'video/mp4', declaredSize: 10, contentSha256: 'a'.repeat(64), stagedAssetId: publicAssetId,
      } as never;
    },
  } as never);
  assert.equal((await retry(request('/complete', { uploadId }), { params: Promise.resolve({ token }) })).status, 200);
  assert.equal(stores, 0);
  assert.equal(deletes, 1);

  const invalid = createReferenceUploadCompleteHandler({
    ...common,
    async getOwnedReferenceUploadAttempt() {
      return {
        uploadId, session: session(), storageKey: 'private/staging/other.mp4', fileName: 'reference.mp4',
        declaredMime: 'video/mp4', declaredSize: 10, contentSha256: null, stagedAssetId: null,
      } as never;
    },
    async getStorageObjectMetadata() { return { size: 11, mime: 'video/mp4' }; },
    async discardReferenceUploadAttempt() { return true; },
  } as never);
  assert.equal((await invalid(request('/complete', { uploadId }), { params: Promise.resolve({ token }) })).status, 413);
  assert.equal(deletes, 2);
});

test('browser and deployed routes use the signed start/PUT/complete protocol without the legacy multipart body path', () => {
  const client = readFileSync('frontend/app/(core)/mcp/reference-upload/[token]/_components/ReferenceUploadClient.tsx', 'utf8');
  const baseRoute = readFileSync('frontend/app/api/mcp/reference-upload/[token]/route.ts', 'utf8');
  const startRoute = readFileSync('frontend/app/api/mcp/reference-upload/[token]/start/route.ts', 'utf8');
  const completeRoute = readFileSync('frontend/app/api/mcp/reference-upload/[token]/complete/route.ts', 'utf8');

  assert.match(client, /\/start/u);
  assert.match(client, /method:\s*'PUT'/u);
  assert.match(client, /\/complete/u);
  assert.doesNotMatch(client, /new FormData|body:\s*form/u);
  assert.doesNotMatch(baseRoute, /createReferenceUploadPostHandler/u);
  for (const source of [startRoute, completeRoute]) {
    assert.match(source, /resolveMcpRuntimeCapabilities/u);
    assert.match(source, /getMcpRequestHost/u);
  }
});
