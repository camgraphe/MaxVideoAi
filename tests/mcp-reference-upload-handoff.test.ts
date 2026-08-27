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
import { resolveProbedMediaMetadata } from '../frontend/server/media/detect-has-audio';
import { resolveSupportedReferenceMedia } from '../frontend/src/server/agent-api/reference-media-policy';

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

const producerFenceStubs = {
  async claimStorageObjectProducer(input: { objectKey: string }) {
    return {
      objectKey: input.objectKey,
      claimId: '00000000-0000-4000-8000-000000000779',
      leaseExpiresAt: new Date('2026-08-25T10:05:00.000Z'),
    };
  },
  async renewStorageObjectProducer(input: { claim: unknown }) { return input.claim; },
  async settleStorageObjectProducer() { return undefined; },
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
    destination: {
      type: 'open_url',
      purpose: 'reference_upload',
      label: 'Upload a private video reference to MaxVideoAI',
      url: `https://maxvideoai.com/mcp/reference-upload/${token}`,
    },
    expiresAt: expiresAt.toISOString(),
    mediaKind: 'video',
    accepted: ['video/mp4', 'video/quicktime'],
    maxBytes: 52_428_800,
    library: {
      type: 'open_url',
      purpose: 'media_library',
      label: 'Open the MaxVideoAI media library',
      url: 'https://maxvideoai.com/app/library',
    },
    nextAction: { tool: 'list_media', arguments: { kind: 'video' } },
  });
});

test('create_reference_upload_link is gated, strict, non-destructive, and open-world', async (t) => {
  const expected = {
    destination: {
      type: 'open_url' as const,
      purpose: 'reference_upload' as const,
      label: 'Upload a private audio reference to MaxVideoAI',
      url: `https://maxvideoai.com/mcp/reference-upload/${token}`,
    },
    expiresAt: expiresAt.toISOString(),
    mediaKind: 'audio' as const,
    accepted: ['audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/mp4'],
    maxBytes: 31_457_280,
    library: {
      type: 'open_url' as const,
      purpose: 'media_library' as const,
      label: 'Open the MaxVideoAI media library',
      url: 'https://maxvideoai.com/app/library',
    },
    nextAction: { tool: 'list_media' as const, arguments: { kind: 'audio' as const } },
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
  const server = createMaxVideoAiMcpServer(principal, services, {
    paidGeneration: false,
    referenceUploads: true,
  });
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
  assert.equal(tool.annotations?.openWorldHint, false);
  const result = await client.callTool({
    name: 'create_reference_upload_link',
    arguments: { kind: 'audio' },
  });
  assert.deepEqual(result.structuredContent, expected);
  assert.equal('uploadUrl' in (result.structuredContent ?? {}), false);

  for (const arguments_ of [{}, { kind: 'document' }, { kind: 'image', extra: true }]) {
    const invalid = await client.callTool({
      name: 'create_reference_upload_link',
      arguments: arguments_,
    });
    assert.equal(invalid.isError, true);
  }
});

test('reference handoffs keep staging uploads and library links on the same trusted origin', async () => {
  const createLink = createReferenceUploadLinkService({
    baseUrl: 'https://maxvideoai-mcp-staging.vercel.app/account/connections',
    createUploadSession: async () => ({ token, session }),
  });

  const result = await createLink({ kind: 'image' }, principal);
  assert.equal(
    result.destination.url,
    `https://maxvideoai-mcp-staging.vercel.app/mcp/reference-upload/${token}`,
  );
  assert.equal(result.library.url, 'https://maxvideoai-mcp-staging.vercel.app/app/library');
  assert.deepEqual(result.nextAction, { tool: 'list_media', arguments: { kind: 'image' } });
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
    { kind: 'video' as const, declaredMime: 'video/quicktime', canonicalMime: 'video/mp4' },
    { kind: 'audio' as const, declaredMime: 'audio/x-wav', canonicalMime: 'audio/wav' },
  ]) {
    const calls: Array<{ name: string; value: unknown }> = [];
    const dependencies = {
      ...producerFenceStubs,
      async probeMediaBuffer() {
        return { kind: candidate.kind, canonicalMime: candidate.canonicalMime, detectedMime: candidate.canonicalMime, durationSec: 4.25 };
      },
      async uploadFileBuffer(input: { beforeUpload?: (key: string) => Promise<void> }) {
        calls.push({ name: 'upload', value: input });
        const key = `user-assets/by-content/owner/${candidate.kind}-1`;
        await input.beforeUpload?.(key);
        return { key, url: `https://assets.maxvideo.ai/${candidate.kind}-1` };
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
        return { id: `canonical-${candidate.kind}-1`, publicId: `ma_${(candidate.kind === 'video' ? 'a' : 'b').repeat(32)}` };
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
      assetId: `ma_${(candidate.kind === 'video' ? 'a' : 'b').repeat(32)}`,
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
    const uploaded = calls.find((call) => call.name === 'upload')?.value as Record<string, unknown>;
    assert.equal(uploaded.contentAddressed, true);
    assert.equal(canonical.kind, candidate.kind);
    assert.equal(canonical.mimeType, candidate.canonicalMime);
    assert.equal(canonical.durationSec, 4.25);
    assert.equal(canonical.sizeBytes, 3);
  }
});

test('shared media storage rejects bytes whose server metadata cannot be verified before persistence', async () => {
  let uploadCalls = 0;
  const service = createStoreAudioUploadService({
    async probeMediaBuffer() { return null; },
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

test('shared media storage always probes bytes, rejects declared/detected disagreement for MCP, and keeps broad workspace MIME compatibility', async () => {
  let probes = 0;
  let uploads = 0;
  const dependencies = {
    ...producerFenceStubs,
    async probeMediaBuffer() {
      probes += 1;
      return { kind: 'video' as const, canonicalMime: 'video/webm', detectedMime: 'video/webm', durationSec: 2 };
    },
    async uploadFileBuffer(input: { beforeUpload?: (key: string) => Promise<void> }) {
      uploads += 1;
      const key = 'user-assets/by-content/owner/video.webm';
      await input.beforeUpload?.(key);
      return { key, url: 'https://assets.maxvideo.ai/video.webm' };
    },
    async createUploadVideoThumbnail() { return null; },
    async recordUserAsset() { return 'legacy'; },
    async ensureReusableAsset() { return { id: 'internal', publicId: 'ma_cccccccccccccccccccccccccccccccc' }; },
  };
  const service = createStoreVideoUploadService(dependencies as never);

  await assert.rejects(
    service({
      userId: 'user-a', fileName: 'disguised.mp4', declaredMime: 'video/mp4',
      bytes: Buffer.from([1]), referenceEligibility: 'mcp',
    }),
    (error: unknown) => error instanceof MediaUploadError && error.code === 'UNSUPPORTED_TYPE',
  );
  assert.equal(uploads, 0);

  const workspace = await service({
    userId: 'user-a', fileName: 'workspace.custom', declaredMime: 'video/x-workspace-container',
    bytes: Buffer.from([2]), referenceEligibility: 'workspace',
  });
  assert.equal(workspace.mimeType, 'video/webm');
  assert.equal(probes, 2);
  assert.equal(uploads, 1);

  const source = readFileSync('frontend/src/server/uploads/store-media-upload.ts', 'utf8');
  assert.doesNotMatch(source, /verifiedDurationSec/u);
});

test('shared media storage compensates its request-owned thumbnail on downstream record failure without deleting shared content-addressed media', async () => {
  const deleted: string[] = [];
  const service = createStoreVideoUploadService({
    ...producerFenceStubs,
    async probeMediaBuffer() { return { kind: 'video', canonicalMime: 'video/mp4', detectedMime: 'video/mp4', durationSec: 2 }; },
    async uploadFileBuffer(input: Record<string, unknown>) {
      assert.equal(input.contentAddressed, true);
      const key = 'user-assets/by-content/owner/shared.mp4';
      await (input.beforeUpload as ((key: string) => Promise<void>))(key);
      return { key, url: `https://assets.maxvideo.ai/${key}` };
    },
    async createUploadVideoThumbnail() { return 'https://assets.maxvideo.ai/request-owned-thumb.jpg'; },
    async recordUserAsset() { throw new Error('database unavailable'); },
    async ensureReusableAsset() { throw new Error('must not mirror'); },
    async deleteStorageObjectByUrl(url: string) { deleted.push(url); return true; },
  } as never);

  await assert.rejects(
    service({
      userId: 'user-a', fileName: 'reference.mp4', declaredMime: 'video/mp4',
      bytes: Buffer.from([1]), referenceEligibility: 'mcp',
    }),
    (error: unknown) => error instanceof MediaUploadError && error.code === 'STORE_FAILED',
  );
  assert.deepEqual(deleted, ['https://assets.maxvideo.ai/request-owned-thumb.jpg']);
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

test('primary stream probing ignores attached cover art and keeps broad workspace containers out of strict MCP eligibility', () => {
  assert.deepEqual(resolveProbedMediaMetadata({
    streams: [
      { codec_type: 'video', disposition: { attached_pic: 1 } },
      { codec_type: 'audio', duration: '3' },
    ],
    format: { format_name: 'mp3', duration: '3' },
  }), { kind: 'audio', canonicalMime: 'audio/mpeg', detectedMime: 'audio/mpeg', durationSec: 3 });
  assert.deepEqual(resolveProbedMediaMetadata({
    streams: [{ codec_type: 'video', duration: '2' }],
    format: { format_name: 'matroska,webm', duration: '2' },
  }), { kind: 'video', canonicalMime: 'video/webm', detectedMime: 'video/webm', durationSec: 2 });
  assert.deepEqual(resolveProbedMediaMetadata({
    streams: [{ codec_type: 'audio', duration: '2' }],
    format: { format_name: 'ogg', duration: '2' },
  }), { kind: 'audio', canonicalMime: 'audio/ogg', detectedMime: 'audio/ogg', durationSec: 2 });
  assert.equal(resolveSupportedReferenceMedia('video', 'video/webm'), null);
  assert.equal(resolveSupportedReferenceMedia('audio', 'audio/ogg'), null);
});

test('workspace probing safely persists broad verified containers while MCP remains closed', () => {
  const fixtures = [
    { format: 'flv', declared: 'video/x-flv', kind: 'video' as const, expected: 'video/x-flv' },
    { format: 'mxf', declared: 'video/mxf', kind: 'video' as const, expected: 'video/mxf' },
    { format: 'asf', declared: 'video/x-ms-asf', kind: 'video' as const, expected: 'video/x-ms-asf' },
    { format: 'aiff', declared: 'audio/aiff', kind: 'audio' as const, expected: 'audio/aiff' },
  ];
  for (const fixture of fixtures) {
    assert.deepEqual(resolveProbedMediaMetadata({
      streams: [{ codec_type: fixture.kind, duration: '2.5' }],
      format: { format_name: fixture.format, duration: '2.5' },
    }, { declaredMime: fixture.declared }), {
      kind: fixture.kind, canonicalMime: fixture.expected, detectedMime: fixture.expected, durationSec: 2.5,
    });
    assert.equal(resolveSupportedReferenceMedia(fixture.kind, fixture.expected), null);
  }
  assert.deepEqual(resolveProbedMediaMetadata({
    streams: [
      { codec_type: 'video', disposition: { attached_pic: 1 } },
      { codec_type: 'audio', duration: '3' },
    ],
    format: { format_name: 'aiff', duration: '3' },
  }, { declaredMime: 'audio/aiff' }), { kind: 'audio', canonicalMime: 'audio/aiff', detectedMime: 'audio/aiff', durationSec: 3 });
});

test('MCP rejects declared allowlist MIME when ffprobe verified only an unsupported container fallback', async () => {
  for (const fixture of [
    { kind: 'video' as const, declaredMime: 'video/mp4' },
    { kind: 'audio' as const, declaredMime: 'audio/mpeg' },
  ]) {
    let uploads = 0;
    const service = fixture.kind === 'video'
      ? createStoreVideoUploadService({
          async probeMediaBuffer() {
            return { kind: 'video', canonicalMime: 'video/mp4', detectedMime: null, durationSec: 2 };
          },
          async uploadFileBuffer() { uploads += 1; return { key: 'never', url: 'https://assets.maxvideo.ai/never' }; },
        } as never)
      : createStoreAudioUploadService({
          async probeMediaBuffer() {
            return { kind: 'audio', canonicalMime: 'audio/mpeg', detectedMime: null, durationSec: 2 };
          },
          async uploadFileBuffer() { uploads += 1; return { key: 'never', url: 'https://assets.maxvideo.ai/never' }; },
        } as never);
    await assert.rejects(() => service({
      userId: 'user-a', fileName: 'spoofed.bin', declaredMime: fixture.declaredMime,
      bytes: Buffer.from([1]), referenceEligibility: 'mcp',
    }), (error: unknown) => error instanceof MediaUploadError && error.code === 'UNSUPPORTED_TYPE');
    assert.equal(uploads, 0);
  }
});

test('workspace accepts a same-kind declared fallback while retaining missing detected MIME provenance', async () => {
  const persistedMimes: string[] = [];
  const service = createStoreVideoUploadService({
    ...producerFenceStubs,
    async probeMediaBuffer() {
      return { kind: 'video', canonicalMime: 'video/x-workspace-custom', detectedMime: null, durationSec: 2 };
    },
    async uploadFileBuffer(input: { mime: string; beforeUpload?: (key: string) => Promise<void> }) {
      persistedMimes.push(input.mime);
      const key = 'user-assets/by-content/owner/custom';
      await input.beforeUpload?.(key);
      return { key, url: 'https://assets.maxvideo.ai/custom' };
    },
    async createUploadVideoThumbnail() { return null; },
    async recordUserAsset() { return 'ua_custom'; },
    async ensureReusableAsset() { return { publicId: 'ma_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' } as never; },
  } as never);
  const stored = await service({
    userId: 'user-a', fileName: 'custom.bin', declaredMime: 'video/x-workspace-custom',
    bytes: Buffer.from([1]), referenceEligibility: 'workspace',
  });
  assert.equal(stored.mimeType, 'video/x-workspace-custom');
  assert.deepEqual(persistedMimes, ['video/x-workspace-custom']);
});

test('multimedia storage registers final and thumbnail keys before upload and retains winner keys', async () => {
  const events: string[] = [];
  const service = createStoreVideoUploadService({
    ...producerFenceStubs,
    async probeMediaBuffer() { return { kind: 'video', canonicalMime: 'video/mp4', detectedMime: 'video/mp4', durationSec: 2 }; },
    async uploadFileBuffer(input: Record<string, unknown>) {
      const key = 'user-assets/by-content/owner/content.mp4';
      await (input.beforeUpload as ((key: string) => Promise<void>))(key);
      events.push(`upload:${key}`);
      return { key, url: 'https://assets.maxvideo.ai/content.mp4' };
    },
    async createUploadVideoThumbnail(input: Record<string, unknown>) {
      const key = 'user-asset-thumbs/owner/thumb.jpg';
      await (input.beforeUpload as ((key: string) => Promise<void>))(key);
      events.push(`upload:${key}`);
      return 'https://assets.maxvideo.ai/thumb.jpg';
    },
    async recordUserAsset() { return 'ua_asset'; },
    async ensureReusableAsset() { return { publicId: 'ma_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' } as never; },
  } as never);
  await service({
    userId: 'user-a', fileName: 'clip.mp4', declaredMime: 'video/mp4', bytes: Buffer.from([1]),
    referenceEligibility: 'mcp',
    cleanupObjects: {
      async beforeUpload(entry) { events.push(`register:${entry.objectRole}:${entry.objectKey}:${entry.safeToDelete}`); },
      async retain(objectKey) { events.push(`retain:${objectKey}`); },
    },
  });
  assert.deepEqual(events, [
    'register:final:user-assets/by-content/owner/content.mp4:false',
    'upload:user-assets/by-content/owner/content.mp4',
    'register:thumbnail:user-asset-thumbs/owner/thumb.jpg:true',
    'upload:user-asset-thumbs/owner/thumb.jpg',
    'retain:user-assets/by-content/owner/content.mp4',
    'retain:user-asset-thumbs/owner/thumb.jpg',
  ]);
});

test('workspace media storage holds the shared object producer claim through both canonical writes', async () => {
  const events: string[] = [];
  let claimHeld = false;
  const key = 'user-assets/by-content/owner/content.mp4';
  const service = createStoreVideoUploadService({
    async probeMediaBuffer() {
      return { kind: 'video', durationSec: 1, canonicalMime: 'video/mp4', detectedMime: 'video/mp4' } as never;
    },
    async claimStorageObjectProducer(input: { objectKey: string }) {
      assert.equal(input.objectKey, key);
      claimHeld = true;
      events.push('claim');
      return { objectKey: key, claimId: '00000000-0000-4000-8000-000000000777', leaseExpiresAt: new Date() } as never;
    },
    async renewStorageObjectProducer(input: { claim: unknown }) { return input.claim; },
    async settleStorageObjectProducer(input: { outcome: string }) {
      events.push(`settle:${input.outcome}`);
      claimHeld = false;
    },
    async uploadFileBuffer(input) {
      await input.beforeUpload?.(key);
      assert.equal(claimHeld, true);
      events.push('upload');
      return { key, url: `https://assets.maxvideo.ai/${key}` };
    },
    async createUploadVideoThumbnail() { return null; },
    async recordUserAsset() {
      assert.equal(claimHeld, true);
      events.push('legacy');
      return 'ua_asset';
    },
    async ensureReusableAsset() {
      assert.equal(claimHeld, true);
      events.push('canonical');
      return { publicId: 'ma_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' } as never;
    },
  } as never);

  await service({ userId: 'user-a', fileName: 'clip.mp4', declaredMime: 'video/mp4', bytes: Buffer.from('video') });
  assert.deepEqual(events, ['claim', 'upload', 'legacy', 'canonical', 'settle:persisted']);
  assert.equal(claimHeld, false);
});

test('workspace media persistence failure durably abandons the producer claim for later cleanup', async () => {
  const events: string[] = [];
  const key = 'user-assets/by-content/owner/failed.mp4';
  const service = createStoreVideoUploadService({
    async probeMediaBuffer() {
      return { kind: 'video', durationSec: 1, canonicalMime: 'video/mp4', detectedMime: 'video/mp4' } as never;
    },
    async claimStorageObjectProducer() {
      events.push('claim');
      return { objectKey: key, claimId: '00000000-0000-4000-8000-000000000778', leaseExpiresAt: new Date() } as never;
    },
    async renewStorageObjectProducer(input: { claim: unknown }) { return input.claim; },
    async settleStorageObjectProducer(input: { outcome: string }) {
      events.push(`settle:${input.outcome}`);
    },
    async uploadFileBuffer(input) {
      await input.beforeUpload?.(key);
      events.push('upload');
      return { key, url: `https://assets.maxvideo.ai/${key}` };
    },
    async createUploadVideoThumbnail() { return null; },
    async recordUserAsset() { throw new Error('database unavailable'); },
  } as never);

  await assert.rejects(() => service({
    userId: 'user-a', fileName: 'clip.mp4', declaredMime: 'video/mp4', bytes: Buffer.from('video'),
  }), /could not be recorded/iu);
  assert.deepEqual(events, ['claim', 'upload', 'settle:abandoned']);
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
