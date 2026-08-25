import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { NextRequest } from 'next/server';

import type { TransactionQueryExecutor } from '../frontend/src/lib/db';
import { AgentApiError } from '../frontend/src/server/agent-api/errors';
import type { AgentPrincipal } from '../frontend/src/server/agent-api/principal';
import { createReferenceUploadLinkService } from '../frontend/src/server/agent-api/create-reference-upload-link';
import { createMaxVideoAiMcpServer, type MaxVideoAiMcpServices } from '../frontend/src/server/mcp/server';
import { ImageUploadError } from '../frontend/src/server/uploads/store-image-upload';
import { createReferenceUploadPostHandler } from '../frontend/src/server/uploads/create-reference-upload-post-handler';
import {
  MediaUploadError,
  createStoreAudioUploadService,
  createStoreVideoUploadService,
} from '../frontend/src/server/uploads/store-media-upload';

const principal: AgentPrincipal = {
  userId: 'user-a',
  clientId: 'claude-client',
  emailVerified: true,
  authMethod: 'oauth',
};
const token = `mru_${'C'.repeat(43)}`;
const expiresAt = new Date('2026-08-24T10:15:00.000Z');
const session = {
  sessionId: '00000000-0000-4000-8000-000000000032',
  userId: 'user-a',
  oauthClientId: 'claude-client',
  mediaKind: 'image' as const,
  state: 'created' as const,
  claimId: null,
  assetId: null,
  expiresAt,
  claimedAt: null,
  uploadedAt: null,
  createdAt: new Date('2026-08-24T10:00:00.000Z'),
  updatedAt: new Date('2026-08-24T10:00:00.000Z'),
};

test('link service creates one private 15-minute browser handoff for the OAuth principal', async () => {
  const createLink = createReferenceUploadLinkService({
    baseUrl: 'https://maxvideoai.com/account/connections',
    createUploadSession: async (input) => {
      assert.deepEqual(input, {
        userId: 'user-a',
        oauthClientId: 'claude-client',
        mediaKind: 'video',
      });
      return { token, session: { ...session, mediaKind: 'video' } };
    },
  });

  assert.deepEqual(await createLink({ kind: 'video' }, principal), {
    uploadUrl: `https://maxvideoai.com/mcp/reference-upload/${token}`,
    expiresAt: expiresAt.toISOString(),
    mediaKind: 'video',
    accepted: ['video/mp4', 'video/quicktime'],
    maxBytes: 52_428_800,
    nextAction: 'Open the URL, upload one video, then call list_media.',
  });
});

test('create_reference_upload_link is gated, strict, non-destructive, and open-world', async (t) => {
  const expected = {
    uploadUrl: `https://maxvideoai.com/mcp/reference-upload/${token}`,
    expiresAt: expiresAt.toISOString(),
    mediaKind: 'audio' as const,
    accepted: ['audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/mp4'],
    maxBytes: 31_457_280,
    nextAction: 'Open the URL, upload one audio file, then call list_media.',
  };
  const services: MaxVideoAiMcpServices = {
    async getAccountStatus() { throw new Error('unused'); },
    async listModels() { return []; },
    async recommendModels() { return { recommendations: [], nextAction: 'clarify_requirements' }; },
    async listMedia() { return { items: [], nextCursor: null, hasMore: false }; },
    async createReferenceUploadLink(input, receivedPrincipal) {
      assert.deepEqual(input, { kind: 'audio' });
      assert.equal(receivedPrincipal, principal);
      return expected;
    },
  };
  const server = createMaxVideoAiMcpServer(principal, services, { referenceUploads: true });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: 'reference-upload-contract', version: '1.0.0' });
  await client.connect(clientTransport);
  t.after(async () => {
    await client.close();
    await server.close();
  });

  const tool = (await client.listTools()).tools.find((candidate) => candidate.name === 'create_reference_upload_link');
  assert.ok(tool);
  assert.equal(tool.inputSchema.type, 'object');
  assert.deepEqual((tool.inputSchema.properties?.kind as Record<string, unknown>)?.enum, [
    'image', 'video', 'audio',
  ]);
  assert.deepEqual(tool.inputSchema.required, ['kind']);
  assert.equal(tool.inputSchema.additionalProperties, false);
  assert.equal(tool.annotations?.readOnlyHint, false);
  assert.equal(tool.annotations?.destructiveHint, false);
  assert.equal(tool.annotations?.openWorldHint, true);
  const result = await client.callTool({
    name: 'create_reference_upload_link',
    arguments: { kind: 'audio' },
  });
  assert.deepEqual(result.structuredContent, expected);

  for (const arguments_ of [{}, { kind: 'document' }, { kind: 'image', extra: true }]) {
    const invalid = await client.callTool({
      name: 'create_reference_upload_link',
      arguments: arguments_,
    });
    assert.equal(invalid.isError, true);
  }
});

function uploadRequest(overrides: {
  contentLength?: number;
  origin?: string;
  name?: string;
  mime?: string;
  bytes?: Uint8Array;
} = {}): NextRequest {
  const form = new FormData();
  form.set('file', new File(
    [overrides.bytes ?? new Uint8Array([1, 2, 3])],
    overrides.name ?? 'reference.png',
    { type: overrides.mime ?? 'image/png' },
  ));
  const request = new NextRequest(`https://maxvideoai.com/api/mcp/reference-upload/${token}`, {
    method: 'POST',
    headers: {
      origin: overrides.origin ?? 'https://maxvideoai.com',
      ...(overrides.contentLength === undefined ? {} : { 'content-length': String(overrides.contentLength) }),
    },
    body: form,
  });
  return request;
}

test('browser handoff authenticates, claims once, stores, binds, and returns private noindex output', async () => {
  const events: string[] = [];
  const executor = { async query<T>() { return [] as T[]; } } as TransactionQueryExecutor;
  const handler = createReferenceUploadPostHandler({
    isEnabled: () => true,
    isSameOriginRequest: () => true,
    async getRouteAuthContext() {
      events.push('auth');
      return { userId: 'user-a' } as never;
    },
    async withTransaction(callback) {
      events.push('transaction');
      return callback(executor);
    },
    async claimUploadSessionForUpload(input) {
      events.push('claim');
      assert.deepEqual(input, { token, userId: 'user-a' });
      return { ...session, claimId: '00000000-0000-4000-8000-000000000033', claimedAt: session.createdAt };
    },
    async storeImageUpload(input) {
      events.push('store');
      assert.equal(input.userId, 'user-a');
      assert.equal(input.fileName, 'reference.png');
      return {
        assetId: 'asset-image-1', width: 100, height: 100,
        mimeType: 'image/png', sizeBytes: 3, previewUrl: null,
      };
    },
    async resolveStoredImageReferenceAsset(input) {
      events.push('mirror');
      assert.deepEqual(input, { userId: 'user-a', assetId: 'asset-image-1' });
      return { assetId: 'url:user-a:image:stored-image' };
    },
    async completeUploadSession(input) {
      events.push('complete');
      assert.equal(input.mediaKind, 'image');
      assert.equal(input.assetId, 'url:user-a:image:stored-image');
      return { ...session, state: 'uploaded', assetId: input.assetId } as never;
    },
    async releaseUploadSessionClaim() {
      events.push('release');
      return null;
    },
  });

  const response = await handler(uploadRequest(), { params: Promise.resolve({ token }) });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    ok: true,
    assetId: 'url:user-a:image:stored-image',
    mediaKind: 'image',
  });
  assert.deepEqual(events, [
    'auth', 'transaction', 'claim', 'store', 'mirror', 'transaction', 'complete',
  ]);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow');
  assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
});

test('browser handoff binds the claimed kind before parsing and stores canonical video/audio assets', async () => {
  for (const candidate of [
    {
      mediaKind: 'video' as const,
      name: 'reference.mov',
      mime: 'video/quicktime',
      canonicalAssetId: 'url:user-a:video:stored-video',
    },
    {
      mediaKind: 'audio' as const,
      name: 'reference.wav',
      mime: 'audio/x-wav',
      canonicalAssetId: 'url:user-a:audio:stored-audio',
    },
  ]) {
    const events: string[] = [];
    const executor = { async query<T>() { return [] as T[]; } } as TransactionQueryExecutor;
    const request = uploadRequest({ name: candidate.name, mime: candidate.mime });
    const originalFormData = request.formData.bind(request);
    Object.defineProperty(request, 'formData', {
      value: async () => {
        events.push('parse');
        return originalFormData();
      },
    });
    const handler = createReferenceUploadPostHandler({
      isEnabled: () => true,
      isSameOriginRequest: () => true,
      async getRouteAuthContext() { events.push('auth'); return { userId: 'user-a' } as never; },
      async withTransaction<T>(callback: (tx: TransactionQueryExecutor) => Promise<T>) {
        events.push('transaction');
        return callback(executor);
      },
      async claimUploadSessionForUpload() {
        events.push('claim');
        return {
          ...session,
          mediaKind: candidate.mediaKind,
          claimId: '00000000-0000-4000-8000-000000000033',
          claimedAt: session.createdAt,
        };
      },
      async storeImageUpload() { throw new Error('wrong image storage branch'); },
      async storeVideoUpload(input) {
        assert.equal(candidate.mediaKind, 'video');
        assert.equal(input.declaredMime, candidate.mime);
        events.push('store-video');
        return { assetId: candidate.canonicalAssetId } as never;
      },
      async storeAudioUpload(input) {
        assert.equal(candidate.mediaKind, 'audio');
        assert.equal(input.declaredMime, candidate.mime);
        events.push('store-audio');
        return { assetId: candidate.canonicalAssetId } as never;
      },
      async completeUploadSession(input) {
        events.push('complete');
        assert.equal(input.mediaKind, candidate.mediaKind);
        assert.equal(input.assetId, candidate.canonicalAssetId);
        return { ...session, state: 'uploaded', assetId: input.assetId } as never;
      },
      async releaseUploadSessionClaim() { events.push('release'); return null; },
    });

    const response = await handler(request, { params: Promise.resolve({ token }) });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      ok: true,
      assetId: candidate.canonicalAssetId,
      mediaKind: candidate.mediaKind,
    });
    assert.deepEqual(events.slice(0, 4), ['auth', 'transaction', 'claim', 'parse']);
    assert.equal(events.includes(candidate.mediaKind === 'video' ? 'store-video' : 'store-audio'), true);
    assert.equal(events.includes('release'), false);
  }
});

test('browser handoff rejects a MIME from another media kind and releases the unconsumed claim', async () => {
  const events: string[] = [];
  const executor = { async query<T>() { return [] as T[]; } } as TransactionQueryExecutor;
  const handler = createReferenceUploadPostHandler({
    isEnabled: () => true,
    isSameOriginRequest: () => true,
    async getRouteAuthContext() { return { userId: 'user-a' } as never; },
    async withTransaction<T>(callback: (tx: TransactionQueryExecutor) => Promise<T>) { return callback(executor); },
    async claimUploadSessionForUpload() {
      events.push('claim');
      return {
        ...session,
        mediaKind: 'video',
        claimId: '00000000-0000-4000-8000-000000000033',
        claimedAt: session.createdAt,
      };
    },
    async storeImageUpload() { events.push('store'); throw new Error('must not store'); },
    async storeVideoUpload() { events.push('store'); throw new Error('must not store'); },
    async storeAudioUpload() { events.push('store'); throw new Error('must not store'); },
    async completeUploadSession() { throw new Error('must not complete'); },
    async releaseUploadSessionClaim() { events.push('release'); return session; },
  });

  const response = await handler(
    uploadRequest({ name: 'wrong.mp3', mime: 'audio/mpeg' }),
    { params: Promise.resolve({ token }) },
  );
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { ok: false, error: 'REFERENCE_INVALID' });
  assert.deepEqual(events, ['claim', 'release']);
});

test('shared video and audio storage owners verify metadata and return the canonical media mirror ID', async () => {
  for (const candidate of [
    { kind: 'video' as const, declaredMime: 'video/quicktime', canonicalMime: 'video/quicktime' },
    { kind: 'audio' as const, declaredMime: 'audio/x-wav', canonicalMime: 'audio/wav' },
  ]) {
    const calls: Array<{ name: string; value: unknown }> = [];
    const dependencies = {
      async detectMediaBufferDuration() { return 4.25; },
      async uploadFileBuffer(input: unknown) {
        calls.push({ name: 'upload', value: input });
        return { key: 'private-key', url: `https://assets.maxvideo.ai/${candidate.kind}-1` };
      },
      async createUploadVideoThumbnail() {
        calls.push({ name: 'thumbnail', value: null });
        return candidate.kind === 'video' ? 'https://assets.maxvideo.ai/video-thumb.jpg' : null;
      },
      async recordUserAsset(input: unknown) {
        calls.push({ name: 'legacy', value: input });
        return `legacy-${candidate.kind}-1`;
      },
      async ensureReusableAsset(input: unknown) {
        calls.push({ name: 'canonical', value: input });
        return { id: `canonical-${candidate.kind}-1` };
      },
    };
    const service = candidate.kind === 'video'
      ? createStoreVideoUploadService(dependencies as never)
      : createStoreAudioUploadService(dependencies as never);

    const stored = await service({
      userId: 'user-a',
      fileName: candidate.kind === 'video' ? 'reference.mov' : 'reference.wav',
      declaredMime: candidate.declaredMime,
      bytes: Buffer.from([1, 2, 3]),
    });

    assert.deepEqual(stored, {
      assetId: `canonical-${candidate.kind}-1`,
      legacyAssetId: `legacy-${candidate.kind}-1`,
      width: null,
      height: null,
      durationSec: 4.25,
      mimeType: candidate.canonicalMime,
      sizeBytes: 3,
      previewUrl: candidate.kind === 'video'
        ? 'https://assets.maxvideo.ai/video-thumb.jpg'
        : null,
      storageUrl: `https://assets.maxvideo.ai/${candidate.kind}-1`,
    });
    const canonical = calls.find((call) => call.name === 'canonical')?.value as Record<string, unknown>;
    assert.equal(canonical.kind, candidate.kind);
    assert.equal(canonical.mimeType, candidate.canonicalMime);
    assert.equal(canonical.durationSec, 4.25);
    assert.equal(canonical.sizeBytes, 3);
  }
});

test('shared media storage rejects bytes whose server metadata cannot be verified before persistence', async () => {
  let uploadCalls = 0;
  const service = createStoreAudioUploadService({
    async detectMediaBufferDuration() { return null; },
    async uploadFileBuffer() { uploadCalls += 1; throw new Error('must not upload'); },
    async createUploadVideoThumbnail() { return null; },
    async recordUserAsset() { throw new Error('must not record'); },
    async ensureReusableAsset() { throw new Error('must not mirror'); },
  } as never);

  await assert.rejects(
    service({
      userId: 'user-a',
      fileName: 'invalid.wav',
      declaredMime: 'audio/wav',
      bytes: Buffer.from([1, 2, 3]),
    }),
    (error: unknown) => error instanceof MediaUploadError && error.code === 'METADATA_UNVERIFIED',
  );
  assert.equal(uploadCalls, 0);
});

test('server metadata rejects audio-only bytes mislabeled as a video before persistence', async () => {
  const sampleRate = 8_000;
  const dataSize = sampleRate * 2;
  const wav = Buffer.alloc(44 + dataSize);
  wav.write('RIFF', 0);
  wav.writeUInt32LE(36 + dataSize, 4);
  wav.write('WAVE', 8);
  wav.write('fmt ', 12);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(sampleRate, 24);
  wav.writeUInt32LE(sampleRate * 2, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write('data', 36);
  wav.writeUInt32LE(dataSize, 40);

  let uploadCalls = 0;
  const service = createStoreVideoUploadService({
    async uploadFileBuffer() { uploadCalls += 1; throw new Error('must not upload'); },
    async createUploadVideoThumbnail() { return null; },
    async recordUserAsset() { throw new Error('must not record'); },
    async ensureReusableAsset() { throw new Error('must not mirror'); },
  } as never);

  await assert.rejects(
    service({
      userId: 'user-a',
      fileName: 'mislabeled.mp4',
      declaredMime: 'video/mp4',
      bytes: wav,
    }),
    (error: unknown) => error instanceof MediaUploadError && error.code === 'METADATA_UNVERIFIED',
  );
  assert.equal(uploadCalls, 0);
});

test('browser handoff rejects cross-origin, oversized, expired, and replayed requests before storage', async () => {
  let authCalls = 0;
  let storeCalls = 0;
  let releasedCalls = 0;
  const executor = { async query<T>() { return [] as T[]; } } as TransactionQueryExecutor;
  const base = {
    isEnabled: () => true,
    isSameOriginRequest: () => true,
    async getRouteAuthContext() { authCalls += 1; return { userId: 'user-a' } as never; },
    async withTransaction<T>(callback: (tx: TransactionQueryExecutor) => Promise<T>) { return callback(executor); },
    async storeImageUpload() { storeCalls += 1; throw new Error('must not store'); },
    async completeUploadSession() { throw new Error('must not complete'); },
    async releaseUploadSessionClaim() { releasedCalls += 1; return null; },
  };

  const crossOrigin = createReferenceUploadPostHandler({ ...base, isSameOriginRequest: () => false });
  assert.equal((await crossOrigin(uploadRequest({ origin: 'https://evil.example' }), { params: Promise.resolve({ token }) })).status, 403);
  assert.equal(authCalls, 0);

  const oversized = createReferenceUploadPostHandler({
    ...base,
    async claimUploadSessionForUpload() {
      return {
        ...session,
        claimId: '00000000-0000-4000-8000-000000000033',
        claimedAt: session.createdAt,
      };
    },
  });
  assert.equal((await oversized(uploadRequest({ contentLength: 26_214_401 }), { params: Promise.resolve({ token }) })).status, 413);
  assert.equal(releasedCalls, 1);

  for (const [code, status] of [['UPLOAD_EXPIRED', 410], ['UPLOAD_ALREADY_USED', 409]] as const) {
    const handler = createReferenceUploadPostHandler({
      ...base,
      async claimUploadSessionForUpload() { throw new AgentApiError(code, 'safe'); },
    });
    assert.equal((await handler(uploadRequest(), { params: Promise.resolve({ token }) })).status, status);
  }
  assert.equal(storeCalls, 0);
});

test('known image failures safely release the exact claim for retry without leaking details', async () => {
  let releasedClaim: string | null = null;
  const executor = { async query<T>() { return [] as T[]; } } as TransactionQueryExecutor;
  const handler = createReferenceUploadPostHandler({
    isEnabled: () => true,
    isSameOriginRequest: () => true,
    async getRouteAuthContext() { return { userId: 'user-a' } as never; },
    async withTransaction<T>(callback: (tx: TransactionQueryExecutor) => Promise<T>) { return callback(executor); },
    async claimUploadSessionForUpload() {
      return { ...session, claimId: '00000000-0000-4000-8000-000000000033', claimedAt: session.createdAt };
    },
    async storeImageUpload() { throw new ImageUploadError('UNSUPPORTED_TYPE', 'secret decoder detail'); },
    async completeUploadSession() { throw new Error('must not complete'); },
    async releaseUploadSessionClaim(input) { releasedClaim = input.claimId; return session; },
  });

  const response = await handler(uploadRequest(), { params: Promise.resolve({ token }) });
  assert.equal(response.status, 415);
  assert.equal(releasedClaim, '00000000-0000-4000-8000-000000000033');
  assert.doesNotMatch(await response.text(), /secret decoder detail/i);
});

test('private upload page has login return, noindex metadata, private cache, and restrictive headers', () => {
  const page = readFileSync('frontend/app/(core)/mcp/reference-upload/[token]/page.tsx', 'utf8');
  const route = readFileSync('frontend/app/api/mcp/reference-upload/[token]/route.ts', 'utf8');
  const nextConfig = readFileSync('frontend/next.config.js', 'utf8');
  assert.match(page, /robots:\s*\{\s*index:\s*false,\s*follow:\s*false/i);
  assert.match(page, /\/login\?next=/i);
  assert.match(page, /getOwnedUploadSession/);
  assert.match(nextConfig, /\/mcp\/reference-upload\/:path\*/);
  assert.match(nextConfig, /X-Robots-Tag[\s\S]*noindex, nofollow/i);
  assert.match(nextConfig, /Cache-Control[\s\S]*private, no-store/i);
  assert.match(nextConfig, /Content-Security-Policy/i);
  assert.match(nextConfig, /frame-ancestors 'none'/i);
  assert.match(page, /resolveMcpRuntimeCapabilities/);
  assert.match(page, /getMcpRequestHost/);
  assert.match(route, /resolveMcpRuntimeCapabilities/);
  assert.match(route, /getMcpRequestHost/);
  assert.doesNotMatch(`${page}\n${route}`, /MCP_STAGING_OPERATIONAL_ENABLED/);
});
