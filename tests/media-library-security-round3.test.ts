import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  resolveLibraryAssetDedupeKey,
  resolveLibraryAssetIdentity,
  type JobOutputRecord,
  type MediaAssetRecord,
} from '../frontend/server/media-library-records';
import { buildWorkspaceTimelineRenderManifest } from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-timeline-render';

const OWNED_USER = 'user-owned';
const OTHER_USER = 'user-other';

type RemoteResponse = {
  status: number;
  headers: Headers;
  body: AsyncIterable<Uint8Array>;
};

function body(...chunks: Array<string | Uint8Array>): AsyncIterable<Uint8Array> {
  return {
    async *[Symbol.asyncIterator]() {
      for (const chunk of chunks) {
        yield typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
      }
    },
  };
}

async function remoteDownloader() {
  const module = await import('../frontend/server/media-library/asset-media');
  const download = Reflect.get(module, 'downloadRemoteMediaWithDependencies');
  assert.equal(typeof download, 'function', 'asset media must expose the bounded pinned downloader boundary');
  return download as (
    params: { url: string; kind: 'image' | 'video' | 'audio'; maxBytes?: number; timeoutMs?: number },
    dependencies: {
      lookup: (hostname: string) => Promise<Array<{ address: string; family: number }>>;
      request: (params: { url: URL; address: string; family: number; signal: AbortSignal }) => Promise<RemoteResponse>;
    }
  ) => Promise<{ data: Buffer; mimeType: string; finalUrl: string }>;
}

test('remote media rejects private and reserved IPv4 and IPv6 before a request', async () => {
  const download = await remoteDownloader();
  for (const address of ['127.0.0.1', '10.0.0.8', '169.254.169.254', '::1', 'fd00::1', 'fe80::1']) {
    let requests = 0;
    await assert.rejects(() => download({
      url: 'https://provider.example/output.png',
      kind: 'image',
    }, {
      lookup: async () => [{ address, family: address.includes(':') ? 6 : 4 }],
      request: async () => {
        requests += 1;
        return { status: 200, headers: new Headers({ 'content-type': 'image/png' }), body: body('image') };
      },
    }), /REMOTE_MEDIA_ADDRESS_NOT_ALLOWED/);
    assert.equal(requests, 0, `${address} must be rejected before network I/O`);
  }
});

test('remote media pins a public address and revalidates every redirect target', async () => {
  const download = await remoteDownloader();
  const requested: Array<{ host: string; address: string }> = [];
  await assert.rejects(() => download({
    url: 'https://provider.example/output.png',
    kind: 'image',
  }, {
    lookup: async (hostname) => hostname === 'provider.example'
      ? [{ address: '93.184.216.34', family: 4 }]
      : [{ address: '169.254.169.254', family: 4 }],
    request: async ({ url, address }) => {
      requested.push({ host: url.hostname, address });
      return {
        status: 302,
        headers: new Headers({ location: 'https://metadata.internal/latest' }),
        body: body(),
      };
    },
  }), /REMOTE_MEDIA_ADDRESS_NOT_ALLOWED/);
  assert.deepEqual(requested, [{ host: 'provider.example', address: '93.184.216.34' }]);
});

test('remote media enforces declared and streamed size, MIME, and total timeout', async () => {
  const download = await remoteDownloader();
  const publicLookup = async () => [{ address: '93.184.216.34', family: 4 }];

  await assert.rejects(() => download({ url: 'https://provider.example/large.png', kind: 'image', maxBytes: 4 }, {
    lookup: publicLookup,
    request: async () => ({
      status: 200,
      headers: new Headers({ 'content-type': 'image/png', 'content-length': '5' }),
      body: body('12345'),
    }),
  }), /REMOTE_MEDIA_TOO_LARGE/);

  await assert.rejects(() => download({ url: 'https://provider.example/chunked.png', kind: 'image', maxBytes: 4 }, {
    lookup: publicLookup,
    request: async () => ({
      status: 200,
      headers: new Headers({ 'content-type': 'image/png' }),
      body: body('123', '45'),
    }),
  }), /REMOTE_MEDIA_TOO_LARGE/);

  await assert.rejects(() => download({ url: 'https://provider.example/not-image', kind: 'image' }, {
    lookup: publicLookup,
    request: async () => ({
      status: 200,
      headers: new Headers({ 'content-type': 'text/html' }),
      body: body('<html>'),
    }),
  }), /REMOTE_MEDIA_TYPE_MISMATCH/);

  await assert.rejects(() => download({
    url: 'https://provider.example/slow.png',
    kind: 'image',
    timeoutMs: 20,
  }, {
    lookup: publicLookup,
    request: ({ signal }) => new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
    }),
  }), /REMOTE_MEDIA_TIMEOUT/);
});

test('remote media preserves a legitimate trusted public provider response', async () => {
  const download = await remoteDownloader();
  const result = await download({
    url: 'https://provider.example/output.png',
    kind: 'image',
    maxBytes: 32,
  }, {
    lookup: async () => [{ address: '93.184.216.34', family: 4 }],
    request: async ({ url, address }) => {
      assert.equal(url.hostname, 'provider.example');
      assert.equal(address, '93.184.216.34');
      return {
        status: 200,
        headers: new Headers({ 'content-type': 'image/png', 'content-length': '5' }),
        body: body('image'),
      };
    },
  });
  assert.equal(result.data.toString(), 'image');
  assert.equal(result.mimeType, 'image/png');
  assert.equal(result.finalUrl, 'https://provider.example/output.png');
});

async function trustedClientBoundary() {
  const module = await import('../frontend/server/media-library/trusted-client-source');
  const ensure = Reflect.get(module, 'ensureClientReusableAssetWithDependencies');
  assert.equal(typeof ensure, 'function', 'client media registration must use a server-trusted source boundary');
  return ensure as (
    params: {
      userId: string;
      url: string;
      kind: 'image' | 'video' | 'audio';
      source?: unknown;
      sourceJobId?: string | null;
      sourceOutputId?: string | null;
      label?: string | null;
      width?: number | null;
      height?: number | null;
    },
    dependencies: {
      readOwnedJobOutput: (params: Record<string, unknown>) => Promise<JobOutputRecord | null>;
      ownedStorageKeyForUrl: (params: { url: string; userId: string }) => string | null;
      ensureReusableAsset: (params: Record<string, unknown>) => Promise<MediaAssetRecord>;
    }
  ) => Promise<MediaAssetRecord>;
}

function jobOutput(overrides: Partial<JobOutputRecord> = {}): JobOutputRecord {
  return {
    id: 'job-owned:image:0',
    jobId: 'job-owned',
    userId: OWNED_USER,
    kind: 'image',
    url: 'https://provider.example/owned.png',
    storageUrl: null,
    thumbUrl: null,
    previewUrl: null,
    mimeType: 'image/png',
    width: 1024,
    height: 1024,
    durationSec: null,
    position: 0,
    status: 'ready',
    metadata: {},
    ...overrides,
  };
}

function assetFromEnsure(params: Record<string, unknown>): MediaAssetRecord {
  return {
    id: resolveLibraryAssetIdentity({
      userId: String(params.userId),
      kind: params.kind as 'image' | 'video' | 'audio',
      url: String(params.url),
      source: 'saved_job_output',
      sourceOutputId: typeof params.sourceOutputId === 'string' ? params.sourceOutputId : null,
    }),
    userId: String(params.userId),
    kind: params.kind as 'image' | 'video' | 'audio',
    url: String(params.url),
    thumbUrl: null,
    previewUrl: null,
    mimeType: typeof params.mimeType === 'string' ? params.mimeType : null,
    width: typeof params.width === 'number' ? params.width : null,
    height: typeof params.height === 'number' ? params.height : null,
    sizeBytes: null,
    durationSec: null,
    source: 'saved_job_output',
    sourceJobId: typeof params.sourceJobId === 'string' ? params.sourceJobId : null,
    sourceOutputId: typeof params.sourceOutputId === 'string' ? params.sourceOutputId : null,
    status: 'ready',
    metadata: {},
  };
}

test('client registration rejects shared-host arbitrary URLs and trusts owned job identity over caller URL', async () => {
  const ensureClientAsset = await trustedClientBoundary();
  let ensured: Record<string, unknown> | null = null;
  const dependencies = {
    readOwnedJobOutput: async () => null,
    ownedStorageKeyForUrl: () => null,
    ensureReusableAsset: async (params: Record<string, unknown>) => {
      ensured = params;
      return assetFromEnsure(params);
    },
  };
  await assert.rejects(() => ensureClientAsset({
    userId: OWNED_USER,
    url: `https://cdn.maxvideoai.com/renders/images/${OTHER_USER}/known.png`,
    kind: 'image',
    source: 'saved_job_output',
    sourceJobId: 'job-victim',
    sourceOutputId: 'victim-output',
  }, dependencies), /MEDIA_SOURCE_NOT_OWNED/);
  assert.equal(ensured, null);

  const ownedOutput = jobOutput();
  const trustedAsset = await ensureClientAsset({
    userId: OWNED_USER,
    url: 'https://attacker.example/ignored.png',
    kind: 'image',
    source: 'generated',
    width: 1024,
    height: 1024,
    sourceJobId: ownedOutput.jobId,
    sourceOutputId: ownedOutput.id,
  }, {
    ...dependencies,
    readOwnedJobOutput: async () => ownedOutput,
  });
  assert.equal(trustedAsset.url, ownedOutput.url);
  assert.equal((ensured as Record<string, unknown>).sourceOutputId, ownedOutput.id);
  assert.equal((ensured as Record<string, unknown>).trustedRemoteSource, true);
});

test('media identities and conflict updates are tenant scoped', () => {
  const victimIdentity = resolveLibraryAssetIdentity({
    userId: OTHER_USER,
    kind: 'image',
    url: 'https://provider.example/victim.png',
    source: 'saved_job_output',
    sourceOutputId: 'shared-output-id',
  });
  const attackerIdentity = resolveLibraryAssetIdentity({
    userId: OWNED_USER,
    kind: 'image',
    url: 'https://provider.example/attacker.png',
    source: 'saved_job_output',
    sourceOutputId: 'shared-output-id',
  });
  assert.notEqual(attackerIdentity, victimIdentity);
  assert.notEqual(
    resolveLibraryAssetDedupeKey({ id: victimIdentity, userId: OTHER_USER, kind: 'image', url: 'x', sourceOutputId: 'shared-output-id' }),
    resolveLibraryAssetDedupeKey({ id: attackerIdentity, userId: OWNED_USER, kind: 'image', url: 'x', sourceOutputId: 'shared-output-id' })
  );

  const assetsSource = readFileSync('frontend/server/media-library/assets.ts', 'utf8');
  assert.match(assetsSource, /ON CONFLICT \(id\)[\s\S]*WHERE media_assets\.user_id = EXCLUDED\.user_id/);
});

test('canonical owned media key parser accepts current image video audio layouts and denies cross-user keys', async () => {
  const storage = await import('../frontend/server/storage');
  const isOwnedMediaStorageKey = Reflect.get(storage, 'isOwnedMediaStorageKey');
  assert.equal(typeof isOwnedMediaStorageKey, 'function');
  for (const key of [
    `renders/images/${OWNED_USER}/image.png`,
    `renders/${OWNED_USER}/video.mp4`,
    `media-assets/${OWNED_USER}/audio.m4a`,
    `user-assets/${OWNED_USER}/upload.mov`,
    `timeline-exports/${OWNED_USER}/export.mp4`,
  ]) {
    assert.equal(isOwnedMediaStorageKey({ key, userId: OWNED_USER }), true, key);
  }
  assert.equal(isOwnedMediaStorageKey({ key: `renders/images/${OTHER_USER}/image.png`, userId: OWNED_USER }), false);
  assert.equal(isOwnedMediaStorageKey({ key: `renders/${OTHER_USER}/video.mp4`, userId: OWNED_USER }), false);
});

function exportRequest(assetId: string, url: string) {
  return {
    version: 1,
    source: 'maxvideoai-editor',
    projectId: 'project-owned',
    idempotencyKey: 'round3-export-idempotency',
    createdAt: '2026-07-11T12:00:00.000Z',
    status: 'ready',
    manifest: {
      version: 1,
      source: 'maxvideoai-editor',
      projectName: 'Owned project',
      sequenceId: 'sequence-main',
      sequenceName: 'Main',
      projectSettings: { aspectRatio: '16:9', resolution: '1080p', fps: 30 },
      createdAt: '2026-07-11T12:00:00.000Z',
      status: 'ready',
      durationSec: 5,
      exportRange: { mode: 'sequence', startSec: 0, endSec: 5, durationSec: 5 },
      tracks: [{
        id: 'video',
        durationSec: 5,
        clips: [{
          id: 'clip-1', assetId, outputNodeId: 'output-1', title: 'Image', track: 'video', mediaKind: 'image', mediaUrl: url,
          startSec: 0, endSec: 5, durationSec: 5, sourceStartSec: 0, sourceEndSec: 5, sourceDurationSec: null,
        }],
      }],
      issues: [],
    },
    exportSettings: { format: 'mp4-h264', qualityPreset: 'standard', includeAudio: true, serverRenderMode: 'server' },
  };
}

test('generated image registration reaches export only through owned identity or nested scoped key', async () => {
  const ensureClientAsset = await trustedClientBoundary();
  const resolverModule = await import('../frontend/src/server/timeline-exports/manifest-resolver');
  const resolveOwnedRequest = Reflect.get(resolverModule, 'resolveOwnedTimelineExportRequestWithDependencies');
  assert.equal(typeof resolveOwnedRequest, 'function');
  const imageUrl = `https://media.maxvideoai.com/renders/images/${OWNED_USER}/generated.png`;
  const registered = await ensureClientAsset({
    userId: OWNED_USER,
    url: imageUrl,
    kind: 'image',
    source: 'generated',
    width: 1024,
    height: 1024,
  }, {
    readOwnedJobOutput: async () => null,
    ownedStorageKeyForUrl: ({ url, userId }) => url === imageUrl && userId === OWNED_USER
      ? `renders/images/${OWNED_USER}/generated.png`
      : null,
    ensureReusableAsset: async (params) => assetFromEnsure(params),
  });
  const project = {
    id: 'project-owned',
    name: 'Owned project',
    workspaceState: {
      nodes: [],
      projectAssets: [{ id: registered.id, kind: 'image', filename: 'generated.png', subtitle: '', url: imageUrl }],
    },
  };
  const sequence = {
    id: 'sequence-main',
    name: 'Main',
    settings: { aspectRatio: '16:9', resolution: '1080p', fps: 30 },
    timelineState: {
      timelineItems: [{
        id: 'clip-1', assetId: registered.id, outputNodeId: 'output-1', title: 'Image', track: 'video', mediaKind: 'image',
        mediaUrl: imageUrl, durationSec: 5, startSec: 0, sourceStartSec: 0,
      }],
    },
  };
  const request = {
    ...exportRequest(registered.id, imageUrl),
    manifest: buildWorkspaceTimelineRenderManifest({
      items: sequence.timelineState.timelineItems as never,
      nodes: [],
      projectName: project.name,
      sequenceId: sequence.id,
      sequenceName: sequence.name,
      projectSettings: sequence.settings as never,
      createdAt: '2026-07-11T12:00:00.000Z',
      exportRange: { mode: 'sequence', startSec: 0, endSec: 5 },
    }),
  };
  const resolved = await resolveOwnedRequest({
    userId: OWNED_USER,
    request,
    requestOrigin: 'https://maxvideoai.com',
  }, {
    readStudioProject: async () => project,
    readStudioSequence: async () => sequence,
    readOwnedLibraryAssetsByIds: async () => [registered],
    isOwnedStorageUrl: ({ url, userId }: { url: string; userId: string }) => url === imageUrl && userId === OWNED_USER,
    validateManifestMediaUrls: async ({ manifest }: { manifest: unknown }) => manifest,
  });
  assert.equal(resolved.manifest.tracks[0]?.clips[0]?.mediaUrl, imageUrl);

  await assert.rejects(() => resolveOwnedRequest({
    userId: OWNED_USER,
    request: exportRequest('asset-attacker', `https://cdn.maxvideoai.com/renders/images/${OTHER_USER}/known.png`),
    requestOrigin: 'https://maxvideoai.com',
  }, {
    readStudioProject: async () => ({
      ...project,
      workspaceState: {
        nodes: [],
        projectAssets: [{ id: 'asset-attacker', kind: 'image', filename: 'known.png', subtitle: '', url: `https://cdn.maxvideoai.com/renders/images/${OTHER_USER}/known.png` }],
      },
    }),
    readStudioSequence: async () => ({
      ...sequence,
      timelineState: { timelineItems: [{ ...sequence.timelineState.timelineItems[0], assetId: 'asset-attacker', mediaUrl: `https://cdn.maxvideoai.com/renders/images/${OTHER_USER}/known.png` }] },
    }),
    readOwnedLibraryAssetsByIds: async () => [{
      ...registered,
      id: 'asset-attacker',
      userId: OWNED_USER,
      url: `https://cdn.maxvideoai.com/renders/images/${OTHER_USER}/known.png`,
    }],
    isOwnedStorageUrl: () => false,
    validateManifestMediaUrls: async ({ manifest }: { manifest: unknown }) => manifest,
  }), /EXPORT_MEDIA_NOT_OWNED/);
});
