import assert from 'node:assert/strict';
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
    input: { cursor?: string | null; limit?: number },
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
  return {
    id: 'asset-upload',
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
    ...overrides,
  } as MaxVideoAiMcpServices;
}

test('listAgentMedia delegates image-only pagination and returns safe normalized DTOs', async () => {
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
          asset({ id: 'asset-video', kind: 'video', mimeType: 'video/mp4' }),
          asset({ id: 'asset-audio', kind: 'audio', mimeType: 'audio/mpeg' }),
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
      if (candidate.id === 'asset-generated') {
        return 'https://private-provider.example/generated.png?X-Amz-Signature=leak';
      }
      return 'https://cdn.maxvideoai.com/unsigned.png';
    },
  });

  assert.deepEqual(calls, [{ userId: principal.userId, kind: 'image', cursor, limit: 50 }]);
  assert.deepEqual(page, {
    items: [
      {
        assetId: 'asset-upload',
        kind: 'image',
        label: 'Uploaded reference',
        width: 1280,
        height: 720,
        mimeType: 'image/png',
        previewUrl: 'https://cdn.maxvideoai.com/private/upload.png?X-Amz-Signature=test',
        source: 'upload',
        createdAt: '2026-07-17T08:00:00.000Z',
      },
      {
        assetId: 'asset-generated',
        kind: 'image',
        label: 'Generated',
        width: 1280,
        height: 720,
        mimeType: 'image/png',
        previewUrl: null,
        source: 'generated',
        createdAt: '2026-07-17T08:00:00.000Z',
      },
      {
        assetId: 'asset-imported',
        kind: 'image',
        label: 'Imported',
        width: 1280,
        height: 720,
        mimeType: 'image/png',
        previewUrl: null,
        source: 'imported',
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

test('listAgentMedia allowlists exact raster MIME types before invoking the private signer', async () => {
  const { listAgentMedia } = await loadMediaLibrary();
  const supported = [
    ['jpeg', 'image/jpeg', 'image/jpeg'],
    ['jpg-alias', 'image/jpg', 'image/jpeg'],
    ['pjpeg-alias', 'image/pjpeg; charset=binary', 'image/jpeg'],
    ['png', 'image/png', 'image/png'],
    ['webp', 'image/webp', 'image/webp'],
    ['gif', 'image/gif', 'image/gif'],
    ['avif', 'image/avif', 'image/avif'],
  ] as const;
  const rejected = [
    ['pdf', 'application/pdf'],
    ['binary', 'application/octet-stream'],
    ['html', 'text/html'],
    ['svg', 'image/svg+xml'],
    ['missing', null],
    ['empty', ''],
    ['unsupported-raster', 'image/tiff'],
  ] as const;
  const signerCalls: string[] = [];
  const page = await listAgentMedia({}, principal, {
    async listAssetPage() {
      return {
        items: [
          ...supported.map(([id, mimeType]) => asset({ id, mimeType })),
          ...rejected.map(([id, mimeType]) => asset({ id, mimeType })),
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
    supported.map(([id, , canonicalMime]) => [id, canonicalMime]),
  );
  assert.deepEqual(signerCalls, supported.map(([id]) => id));
  assert.doesNotMatch(JSON.stringify(page), /pdf|binary|html|svg|missing|empty|unsupported-raster/u);
});

test('listAgentMedia accepts only existing cursor envelopes and bounded page sizes', async () => {
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

test('agent listing relies on the canonical non-deleted library owner', () => {
  assert.equal(existsSync(mediaLibraryPath), true, `${mediaLibraryPath} must exist`);
  const facadeSource = readFileSync(mediaLibraryPath, 'utf8');
  const canonicalSource = readFileSync(canonicalListingPath, 'utf8');
  assert.match(facadeSource, /listLibraryAssetPage/u);
  assert.match(facadeSource, /kind:\s*['"]image['"]/u);
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
  const disabled = createMaxVideoAiMcpServer(principal, services, { referenceUploads: false } as never);
  const enabled = createMaxVideoAiMcpServer(principal, services, { referenceUploads: true } as never);
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
  assert.match(tool.description ?? '', /Use this when/iu);
  assert.match(tool.description ?? '', /Do not use/iu);

  const cursor = encodeMediaLibraryCursor({
    createdAt: '2026-07-17T09:00:00.000Z',
    id: 'cursor-asset',
  });
  const result = await enabledClient.callTool({
    name: 'list_media',
    arguments: { cursor, limit: 50 },
  });
  assert.deepEqual(result.structuredContent, { items: [], nextCursor: null, hasMore: false });
  assert.deepEqual(calls, [{ input: { cursor, limit: 50 }, principal }]);

  const invalid = await enabledClient.callTool({
    name: 'list_media',
    arguments: { limit: 51, originUrl: 'https://private.example/image.png' },
  });
  assert.equal(invalid.isError, true);
  assert.equal(calls.length, 1);
});
