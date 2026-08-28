import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

import { AgentApiError } from '../frontend/src/server/agent-api/errors';
import type { AgentPrincipal } from '../frontend/src/server/agent-api/principal';
import { encodeMediaLibraryCursor } from '../frontend/server/media-library/pagination';
import {
  createMaxVideoAiMcpServer,
  type MaxVideoAiMcpServices,
} from '../frontend/src/server/mcp/server';

const mediaLibraryPath = 'frontend/src/server/agent-api/media-library.ts';
const listMediaToolPath = 'frontend/src/server/mcp/tools/list-media.ts';
const serverPath = 'frontend/src/server/mcp/server.ts';
const canonicalListingPath = 'frontend/server/media-library/asset-listing.ts';
const mediaLibraryModule = '../frontend/src/server/agent-api/media-library';

const principal: AgentPrincipal = {
  userId: 'owner-user',
  clientId: 'codex-client',
  emailVerified: true,
  authMethod: 'oauth',
};

type AssetRecord = {
  id: string;
  publicId: string;
  userId: string | null;
  kind: 'image' | 'video' | 'audio';
  url: string;
  thumbUrl: string | null;
  previewUrl: string | null;
  mimeType: string | null;
  width: number | null;
  height: number | null;
  sizeBytes: number | null;
  durationSec: number | null;
  source: string;
  sourceJobId: string | null;
  sourceOutputId: string | null;
  status: string;
  metadata: Record<string, unknown>;
  createdAt?: string;
};

type AgentMediaPage = {
  items: Array<Record<string, unknown>>;
  nextCursor: string | null;
  hasMore: boolean;
};

type MediaLibraryModule = {
  listAgentMedia(
    input: { kind?: 'image' | 'video' | 'audio'; cursor?: string | null; limit?: number },
    currentPrincipal: AgentPrincipal,
    dependencies: {
      listAssetPage(params: Record<string, unknown>): Promise<{
        items: AssetRecord[];
        nextCursor: string | null;
        hasMore: boolean;
      }>;
      createPrivatePreviewUrl(asset: AssetRecord): Promise<string | null>;
    },
  ): Promise<AgentMediaPage>;
};

async function loadMediaLibrary(): Promise<MediaLibraryModule> {
  assert.equal(existsSync(mediaLibraryPath), true, `${mediaLibraryPath} must exist`);
  return import(mediaLibraryModule) as Promise<MediaLibraryModule>;
}

function asset(overrides: Partial<AssetRecord> = {}): AssetRecord {
  const id = overrides.id ?? 'asset-upload';
  return {
    id,
    publicId: publicIdFor(id),
    userId: principal.userId,
    kind: 'image',
    url: 'https://provider.example/private-origin.png',
    thumbUrl: 'https://provider.example/private-thumb.png',
    previewUrl: 'https://provider.example/private-preview.png',
    mimeType: 'image/png',
    width: 1280,
    height: 720,
    sizeBytes: 1234,
    durationSec: null,
    source: 'upload',
    sourceJobId: null,
    sourceOutputId: null,
    status: 'ready',
    metadata: {
      label: 'Uploaded reference',
      originUrl: 'https://private.example/do-not-return.png',
      providerPayload: 'secret-provider-metadata',
    },
    createdAt: '2026-07-17T08:00:00.000Z',
    ...overrides,
  };
}

function publicIdFor(id: string): string {
  return `ma_${createHash('sha256').update(id).digest('hex').slice(0, 32)}`;
}

function baseServices(overrides: Record<string, unknown> = {}): MaxVideoAiMcpServices {
  return {
    async getAccountStatus() {
      return {
        accountId: principal.userId,
        emailVerified: true,
        clientId: principal.clientId,
        wallet: { amountCents: 0, currency: 'USD', pendingCents: 0 },
        trial: { status: 'disabled' },
        spendingLimits: { perGenerationCents: null, dailyCents: null, webApprovalAboveCents: null },
        accountUrl: 'https://maxvideoai.com/account/connections',
      };
    },
    async listModels() { return []; },
    async recommendModels() { return { recommendations: [], nextAction: 'clarify_requirements' }; },
    async createReferenceUploadLink() { throw new Error('unused'); },
    async importReferenceFiles() { return { assets: [], failures: [] }; },
    ...overrides,
  } as MaxVideoAiMcpServices;
}

test('listAgentMedia performs one unfiltered owner page read and returns safe multimodal DTOs', async () => {
  const { listAgentMedia } = await loadMediaLibrary();
  const cursor = encodeMediaLibraryCursor({
    createdAt: '2026-07-17T09:00:00.000Z',
    id: 'cursor-asset',
  });
  const calls: Array<Record<string, unknown>> = [];
  const page = await listAgentMedia({ cursor, limit: 50 }, principal, {
    async listAssetPage(params) {
      calls.push(params);
      return {
        items: [
          asset(),
          asset({ id: 'asset-generated', source: 'saved_job_output', metadata: { label: 'Generated' } }),
          asset({ id: 'asset-imported', source: 'character', metadata: { label: 'Imported' } }),
          asset({
            id: 'asset-video',
            kind: 'video',
            mimeType: 'VIDEO/MP4; charset=binary',
            durationSec: 4,
            metadata: { label: 'Opening shot', providerPayload: 'do-not-return' },
          }),
          asset({
            id: 'asset-audio',
            kind: 'audio',
            mimeType: 'audio/x-wav',
            width: null,
            height: null,
            durationSec: 12.5,
            metadata: { label: 'Sound bed', sourceUrl: 'https://private.example/audio.wav' },
          }),
          asset({ id: 'asset-image-video-mime', kind: 'image', mimeType: 'video/mp4' }),
          asset({ id: 'asset-image-audio-mime', kind: 'image', mimeType: 'audio/mpeg' }),
          asset({ id: 'asset-deleted', status: 'deleted' }),
          asset({ id: 'asset-processing', status: 'processing' }),
        ],
        nextCursor: cursor,
        hasMore: true,
      };
    },
    async createPrivatePreviewUrl(candidate) {
      if (candidate.id === 'asset-upload') {
        return 'https://cdn.maxvideoai.com/private/upload.png?X-Amz-Signature=test';
      }
      if (candidate.id === 'asset-video') {
        return 'https://cdn.maxvideoai.com/private/video.mp4?X-Amz-Signature=test';
      }
      if (candidate.id === 'asset-generated') {
        return 'https://private-provider.example/generated.png?X-Amz-Signature=leak';
      }
      return 'https://cdn.maxvideoai.com/unsigned.png';
    },
  });

  assert.deepEqual(calls, [{ userId: principal.userId, kind: null, cursor, limit: 50 }]);
  assert.deepEqual(page, {
    items: [
      {
        assetId: publicIdFor('asset-upload'),
        kind: 'image',
        label: 'Uploaded reference',
        width: 1280,
        height: 720,
        durationSec: null,
        mimeType: 'image/png',
        previewUrl: 'https://cdn.maxvideoai.com/private/upload.png?X-Amz-Signature=test',
        source: 'upload',
        createdAt: '2026-07-17T08:00:00.000Z',
      },
      {
        assetId: publicIdFor('asset-generated'),
        kind: 'image',
        label: 'Generated',
        width: 1280,
        height: 720,
        durationSec: null,
        mimeType: 'image/png',
        previewUrl: null,
        source: 'generated',
        createdAt: '2026-07-17T08:00:00.000Z',
      },
      {
        assetId: publicIdFor('asset-imported'),
        kind: 'image',
        label: 'Imported',
        width: 1280,
        height: 720,
        durationSec: null,
        mimeType: 'image/png',
        previewUrl: null,
        source: 'imported',
        createdAt: '2026-07-17T08:00:00.000Z',
      },
      {
        assetId: publicIdFor('asset-video'),
        kind: 'video',
        label: 'Opening shot',
        width: 1280,
        height: 720,
        durationSec: 4,
        mimeType: 'video/mp4',
        previewUrl: 'https://cdn.maxvideoai.com/private/video.mp4?X-Amz-Signature=test',
        source: 'upload',
        createdAt: '2026-07-17T08:00:00.000Z',
      },
      {
        assetId: publicIdFor('asset-audio'),
        kind: 'audio',
        label: 'Sound bed',
        width: null,
        height: null,
        durationSec: 12.5,
        mimeType: 'audio/wav',
        previewUrl: null,
        source: 'upload',
        createdAt: '2026-07-17T08:00:00.000Z',
      },
    ],
    nextCursor: cursor,
    hasMore: true,
  });
  assert.deepEqual(Object.keys(page.items[0] ?? {}), [
    'assetId',
    'kind',
    'label',
    'width',
    'height',
    'durationSec',
    'mimeType',
    'previewUrl',
    'source',
    'createdAt',
  ]);
  assert.doesNotMatch(
    JSON.stringify(page),
    /provider\.example|private\.example|originUrl|providerPayload|secret-provider|thumbUrl|metadata|sizeBytes/u,
  );
});

test('listAgentMedia allowlists and canonicalizes exact media MIME types before signing', async () => {
  const { listAgentMedia } = await loadMediaLibrary();
  const supported = [
    ['jpeg', 'image/jpeg', 'image/jpeg'],
    ['jpg-alias', 'image/jpg', 'image/jpeg'],
    ['pjpeg-alias', 'image/pjpeg; charset=binary', 'image/jpeg'],
    ['png', 'image/png', 'image/png'],
    ['webp', 'image/webp', 'image/webp'],
    ['gif', 'image/gif', 'image/gif'],
    ['avif', 'image/avif', 'image/avif'],
    ['mp4', 'video/mp4', 'video/mp4', 'video'],
    ['mov', 'video/quicktime; charset=binary', 'video/quicktime', 'video'],
    ['mp3', 'audio/mpeg', 'audio/mpeg', 'audio'],
    ['wav', 'audio/wav', 'audio/wav', 'audio'],
    ['x-wav', 'audio/x-wav', 'audio/wav', 'audio'],
    ['m4a', 'audio/mp4', 'audio/mp4', 'audio'],
  ] as const;
  const rejected = [
    ['pdf', 'application/pdf'],
    ['binary', 'application/octet-stream'],
    ['html', 'text/html'],
    ['svg', 'image/svg+xml'],
    ['missing', null],
    ['empty', ''],
    ['unsupported-raster', 'image/tiff'],
    ['unsupported-video', 'video/webm', 'video'],
    ['unsupported-audio', 'audio/ogg', 'audio'],
    ['video-with-audio-mime', 'audio/mpeg', 'video'],
    ['audio-with-video-mime', 'video/mp4', 'audio'],
  ] as const;
  const signerCalls: string[] = [];
  const page = await listAgentMedia({}, principal, {
    async listAssetPage() {
      return {
        items: [
          ...supported.map(([id, mimeType, , kind = 'image']) => asset({ id, mimeType, kind })),
          ...rejected.map(([id, mimeType, kind = 'image']) => asset({ id, mimeType, kind })),
        ],
        nextCursor: null,
        hasMore: false,
      };
    },
    async createPrivatePreviewUrl(candidate) {
      signerCalls.push(candidate.id);
      return `https://cdn.maxvideoai.com/private/${candidate.id}?X-Amz-Signature=test`;
    },
  });

  assert.deepEqual(
    page.items.map((item) => [item.assetId, item.mimeType]),
    supported.map(([id, , canonicalMime]) => [publicIdFor(id), canonicalMime]),
  );
  assert.deepEqual(signerCalls, supported.map(([id]) => id));
  assert.doesNotMatch(JSON.stringify(page), /pdf|binary|html|svg|missing|empty|unsupported-raster/u);
});

test('listAgentMedia accepts only exact kind filters, existing cursors, and bounded page sizes', async () => {
  const { listAgentMedia } = await loadMediaLibrary();
  let reads = 0;
  const dependencies = {
    async listAssetPage() {
      reads += 1;
      return { items: [], nextCursor: null, hasMore: false };
    },
    async createPrivatePreviewUrl() { return null; },
  };
  for (const input of [
    { cursor: 'not-a-library-cursor', limit: 10 },
    { limit: 0 },
    { limit: 51 },
    { limit: 1.5 },
    { kind: 'document' },
  ]) {
    await assert.rejects(
      listAgentMedia(input, principal, dependencies),
      (error: unknown) => error instanceof AgentApiError && error.code === 'PARAMETER_INVALID',
    );
  }
  assert.equal(reads, 0);

  await listAgentMedia({}, principal, dependencies);
  assert.equal(reads, 1);
});

test('listAgentMedia passes an exact optional kind filter through one owner query', async () => {
  const { listAgentMedia } = await loadMediaLibrary();
  const calls: Array<Record<string, unknown>> = [];
  const page = await listAgentMedia({ kind: 'video', limit: 10 }, principal, {
    async listAssetPage(params) {
      calls.push(params);
      return {
        items: [
          asset({ id: 'video-ready', kind: 'video', mimeType: 'video/mp4', durationSec: 4 }),
          asset({ id: 'wrong-kind', kind: 'audio', mimeType: 'audio/mpeg', durationSec: 4 }),
          asset({ id: 'wrong-owner', userId: 'other-user', kind: 'video', mimeType: 'video/mp4', durationSec: 4 }),
          asset({ id: 'not-ready', kind: 'video', mimeType: 'video/mp4', durationSec: 4, status: 'processing' }),
          asset({ id: 'oversized-duration', kind: 'video', mimeType: 'video/mp4', durationSec: 86_401 }),
        ],
        nextCursor: null,
        hasMore: false,
      };
    },
    async createPrivatePreviewUrl() { return null; },
  });

  assert.deepEqual(calls, [{ userId: principal.userId, kind: 'video', cursor: null, limit: 10 }]);
  assert.deepEqual(page.items.map((item) => item.assetId), [publicIdFor('video-ready')]);
});

test('agent listing relies on the canonical non-deleted library owner', () => {
  assert.equal(existsSync(mediaLibraryPath), true, `${mediaLibraryPath} must exist`);
  const facadeSource = readFileSync(mediaLibraryPath, 'utf8');
  const canonicalSource = readFileSync(canonicalListingPath, 'utf8');
  assert.match(facadeSource, /listLibraryAssetPage/u);
  assert.match(facadeSource, /kind:\s*normalized\.kind/u);
  assert.match(canonicalSource, /FROM media_assets[\s\S]*?deleted_at IS NULL/u);
});

test('list_media is feature-gated, strict, read-only, non-destructive, and closed-world', async (t) => {
  assert.equal(existsSync(listMediaToolPath), true, `${listMediaToolPath} must exist`);
  const serverSource = readFileSync(serverPath, 'utf8');
  assert.match(serverSource, /FEATURES\.mcp\.referenceUploads/u);

  const calls: unknown[] = [];
  const services = baseServices({
    async listMedia(input: unknown, currentPrincipal: AgentPrincipal) {
      calls.push({ input, principal: currentPrincipal });
      return { items: [], nextCursor: null, hasMore: false };
    },
  });
  const disabled = createMaxVideoAiMcpServer(principal, services, {
    paidGeneration: false,
    referenceUploads: false,
  });
  const enabled = createMaxVideoAiMcpServer(principal, services, {
    paidGeneration: false,
    referenceUploads: true,
  });
  const [disabledClientTransport, disabledServerTransport] = InMemoryTransport.createLinkedPair();
  const [enabledClientTransport, enabledServerTransport] = InMemoryTransport.createLinkedPair();
  const disabledClient = new Client({ name: 'r2-disabled', version: '1.0.0' });
  const enabledClient = new Client({ name: 'r2-enabled', version: '1.0.0' });
  await disabled.connect(disabledServerTransport);
  await enabled.connect(enabledServerTransport);
  await disabledClient.connect(disabledClientTransport);
  await enabledClient.connect(enabledClientTransport);
  t.after(async () => {
    await disabledClient.close();
    await enabledClient.close();
    await disabled.close();
    await enabled.close();
  });

  assert.equal((await disabledClient.listTools()).tools.some((tool) => tool.name === 'list_media'), false);
  const tool = (await enabledClient.listTools()).tools.find((candidate) => candidate.name === 'list_media');
  assert.ok(tool);
  assert.equal(tool.annotations?.readOnlyHint, true);
  assert.equal(tool.annotations?.destructiveHint, false);
  assert.equal(tool.annotations?.openWorldHint, false);
  assert.equal(tool.inputSchema.additionalProperties, false);
  assert.equal((tool.inputSchema.properties?.limit as Record<string, unknown>)?.maximum, 50);
  assert.deepEqual((tool.inputSchema.properties?.kind as Record<string, unknown>)?.enum, ['image', 'video', 'audio']);
  assert.match(tool.description ?? '', /Use this when/iu);
  assert.match(tool.description ?? '', /Do not use/iu);

  const cursor = encodeMediaLibraryCursor({
    createdAt: '2026-07-17T09:00:00.000Z',
    id: 'cursor-asset',
  });
  const result = await enabledClient.callTool({
    name: 'list_media',
    arguments: { kind: 'video', cursor, limit: 50 },
  });
  assert.deepEqual(result.structuredContent, { items: [], nextCursor: null, hasMore: false });
  assert.deepEqual(calls, [{ input: { kind: 'video', cursor, limit: 50 }, principal }]);

  const invalid = await enabledClient.callTool({
    name: 'list_media',
    arguments: { limit: 51, originUrl: 'https://private.example/image.png' },
  });
  assert.equal(invalid.isError, true);
  assert.equal(calls.length, 1);
});
