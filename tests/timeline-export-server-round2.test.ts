import assert from 'node:assert/strict';
import test from 'node:test';

import {
  parseTimelineExportRequest,
} from '../frontend/src/server/timeline-exports/render-request';
import {
  validateLegacyTimelineExportMediaUrl,
  validateTimelineExportManifestMediaUrls,
} from '../frontend/src/server/timeline-exports/media-security';

function requestFixture() {
  return {
    version: 1,
    source: 'maxvideoai-editor',
    projectId: 'project-owned',
    idempotencyKey: 'export-idempotency-round2',
    createdAt: '2026-07-11T08:00:00.000Z',
    status: 'ready',
    manifest: {
      version: 1,
      source: 'maxvideoai-editor',
      projectName: 'Owned project',
      sequenceId: 'sequence-main',
      sequenceName: 'Main sequence',
      projectSettings: { aspectRatio: '16:9', resolution: '1080p', fps: 30 },
      createdAt: '2026-07-11T08:00:00.000Z',
      status: 'ready',
      durationSec: 5,
      exportRange: { mode: 'sequence', startSec: 0, endSec: 5, durationSec: 5 },
      tracks: [{
        id: 'video',
        durationSec: 5,
        clips: [{
          id: 'clip-1',
          outputNodeId: 'output-1',
          assetId: 'asset-1',
          title: 'Clip 1',
          track: 'video',
          mediaKind: 'video',
          mediaUrl: 'https://cdn.maxvideoai.com/media-assets/user-owned/clip-1.mp4',
          startSec: 0,
          endSec: 5,
          durationSec: 5,
          sourceStartSec: 0,
          sourceEndSec: 5,
          sourceDurationSec: null,
          sourceWidth: 9000,
          sourceHeight: 9000,
        }],
      }, {
        id: 'audio',
        durationSec: 0,
        clips: [],
      }],
      issues: [],
    },
    exportSettings: {
      format: 'mp4-h264',
      qualityPreset: 'standard',
      includeAudio: true,
      serverRenderMode: 'server',
    },
  };
}

function persistedProject(url: string, dimensions = '1920x1080') {
  return {
    id: 'project-owned',
    name: 'Owned project',
    workspaceState: {
      nodes: [],
      projectAssets: [{
        id: 'asset-1',
        kind: 'video',
        filename: 'clip-1.mp4',
        subtitle: '',
        url,
        dimensions,
      }],
    },
  };
}

function persistedSequence(url: string, sourceWidth = 1920, sourceHeight = 1080) {
  return {
    id: 'sequence-main',
    name: 'Main sequence',
    settings: { aspectRatio: '16:9', resolution: '1080p', fps: 30 },
    timelineState: {
      timelineItems: [{
        id: 'clip-1',
        outputNodeId: 'output-1',
        assetId: 'asset-1',
        track: 'video',
        title: 'Clip 1',
        mediaKind: 'video',
        mediaUrl: url,
        durationSec: 5,
        startSec: 0,
        sourceStartSec: 0,
        sourceWidth,
        sourceHeight,
      }],
    },
  };
}

type ResolverDependencies = {
  readStudioProject: () => Promise<ReturnType<typeof persistedProject> | null>;
  readStudioSequence: () => Promise<ReturnType<typeof persistedSequence> | null>;
  readOwnedLibraryAssetsByIds: () => Promise<Array<Record<string, unknown>>>;
  isOwnedStorageUrl: (params: { url: string; userId: string; projectId: string }) => boolean;
  validateManifestMediaUrls: <T>(params: { manifest: T }) => Promise<T>;
};

async function round2Resolver() {
  const module = await import('../frontend/src/server/timeline-exports/manifest-resolver');
  const resolver = Reflect.get(module, 'resolveOwnedTimelineExportRequestWithDependencies');
  assert.equal(typeof resolver, 'function', 'manifest resolver must expose an injected behavioral boundary');
  return resolver as (
    params: { userId: string; request: ReturnType<typeof requestFixture>; requestOrigin: string },
    dependencies: ResolverDependencies
  ) => Promise<ReturnType<typeof requestFixture>>;
}

test('shared approved hosts do not prove export media ownership', async () => {
  const resolveOwnedRequest = await round2Resolver();
  const attackerUrl = 'https://cdn.maxvideoai.com/media-assets/user-other/private.mp4';
  let validationCalls = 0;

  await assert.rejects(() => resolveOwnedRequest({
    userId: 'user-owned',
    request: requestFixture(),
    requestOrigin: 'https://maxvideoai.com',
  }, {
    readStudioProject: async () => persistedProject(attackerUrl),
    readStudioSequence: async () => persistedSequence(attackerUrl),
    readOwnedLibraryAssetsByIds: async () => [],
    isOwnedStorageUrl: () => false,
    validateManifestMediaUrls: async ({ manifest }) => {
      validationCalls += 1;
      return manifest;
    },
  }), /EXPORT_MEDIA_NOT_OWNED/);
  assert.equal(validationCalls, 0, 'unowned URLs must be rejected before host/network validation');
});

test('authenticated media identity wins over persisted source dimensions', async () => {
  const resolveOwnedRequest = await round2Resolver();
  const ownedUrl = 'https://cdn.maxvideoai.com/media-assets/user-owned/clip-1.mp4';
  const request = requestFixture();

  const resolved = await resolveOwnedRequest({
    userId: 'user-owned',
    request,
    requestOrigin: 'https://maxvideoai.com',
  }, {
    readStudioProject: async () => persistedProject(ownedUrl, '9000x9000'),
    readStudioSequence: async () => persistedSequence(ownedUrl, 9000, 9000),
    readOwnedLibraryAssetsByIds: async () => [{
      id: 'asset-1',
      userId: 'user-owned',
      kind: 'video',
      url: ownedUrl,
      width: 1280,
      height: 720,
      durationSec: null,
      sizeBytes: 20 * 1024 * 1024,
      mimeType: 'video/mp4',
      metadata: {},
    }],
    isOwnedStorageUrl: ({ url, userId }) => url === ownedUrl && userId === 'user-owned',
    validateManifestMediaUrls: async ({ manifest }) => manifest,
  });

  const clip = resolved.manifest.tracks[0]?.clips[0];
  assert.equal(clip?.mediaUrl, ownedUrl);
  assert.equal(clip?.sourceWidth, 1280);
  assert.equal(clip?.sourceHeight, 720);
});

test('legacy persisted URLs remain compatible only through a user-scoped storage key', async () => {
  const resolveOwnedRequest = await round2Resolver();
  const ownedUrl = 'https://cdn.maxvideoai.com/media-assets/user-owned/clip-1.mp4';

  const resolved = await resolveOwnedRequest({
    userId: 'user-owned',
    request: requestFixture(),
    requestOrigin: 'https://maxvideoai.com',
  }, {
    readStudioProject: async () => persistedProject(ownedUrl),
    readStudioSequence: async () => persistedSequence(ownedUrl),
    readOwnedLibraryAssetsByIds: async () => [],
    isOwnedStorageUrl: ({ url, userId }) => url.includes(`/media-assets/${userId}/`),
    validateManifestMediaUrls: async ({ manifest }) => manifest,
  });

  assert.equal(resolved.manifest.tracks[0]?.clips[0]?.mediaUrl, ownedUrl);
});

test('server export hydration discards legacy request-derived source metadata', async () => {
  const resolveOwnedRequest = await round2Resolver();
  const ownedUrl = 'https://cdn.maxvideoai.com/media-assets/user-owned/legacy-request.mp4';
  const sequence = persistedSequence(ownedUrl, 3840, 2160);
  sequence.timelineState.timelineItems[0] = {
    ...sequence.timelineState.timelineItems[0],
    sourceDurationSec: 12,
  };

  const resolved = await resolveOwnedRequest({
    userId: 'user-owned',
    request: requestFixture(),
    requestOrigin: 'https://maxvideoai.com',
  }, {
    readStudioProject: async () => persistedProject(ownedUrl, '3840x2160'),
    readStudioSequence: async () => sequence,
    readOwnedLibraryAssetsByIds: async () => [],
    isOwnedStorageUrl: ({ url, userId }) => url.includes(`/media-assets/${userId}/`),
    validateManifestMediaUrls: async ({ manifest }) => manifest,
  });

  const clip = resolved.manifest.tracks[0]?.clips[0];
  assert.equal(clip?.sourceDurationSec, null);
  assert.equal(clip?.sourceWidth, null);
  assert.equal(clip?.sourceHeight, null);
});

function linkedAudioResolverFixtures(params: {
  primaryUrl: string;
  audioUrl?: string;
  audioProvenance: 'embedded' | 'external';
}) {
  const project = persistedProject(params.primaryUrl);
  project.workspaceState.projectAssets[0] = {
    ...project.workspaceState.projectAssets[0],
    ...(params.audioUrl ? { audioUrl: params.audioUrl } : {}),
  } as never;
  const sequence = persistedSequence(params.primaryUrl);
  sequence.timelineState.timelineItems[0] = {
    ...sequence.timelineState.timelineItems[0],
    linkedGroupId: 'linked-media-1',
  } as never;
  sequence.timelineState.timelineItems.push({
    id: 'clip-audio',
    outputNodeId: 'output-1',
    assetId: 'asset-1',
    track: 'audio',
    title: 'Clip Audio',
    mediaKind: 'audio',
    mediaUrl: params.audioUrl ?? params.primaryUrl,
    durationSec: 5,
    startSec: 0,
    sourceStartSec: 0,
    linkedGroupId: 'linked-media-1',
    audioProvenance: params.audioProvenance,
  } as never);
  const request = requestFixture();
  request.manifest.tracks[0].clips[0].linkedGroupId = 'linked-media-1';
  request.manifest.tracks[1] = {
    id: 'audio',
    durationSec: 5,
    clips: [{
      id: 'clip-audio',
      outputNodeId: 'output-1',
      assetId: 'asset-1',
      title: 'Clip Audio',
      track: 'audio',
      mediaKind: 'audio',
      mediaUrl: params.audioUrl ?? params.primaryUrl,
      startSec: 0,
      endSec: 5,
      durationSec: 5,
      sourceStartSec: 0,
      sourceEndSec: 5,
      sourceDurationSec: null,
      linkedGroupId: 'linked-media-1',
      audioProvenance: params.audioProvenance,
    }],
  } as never;
  return { project, sequence, request };
}

test('audio export prefers dedicated owned audio and accepts owned embedded MP4 containers', async () => {
  const resolveOwnedRequest = await round2Resolver();
  const primaryUrl = 'https://cdn.maxvideoai.com/media-assets/user-owned/clip-1.mp4';
  const dedicatedAudioUrl = 'https://cdn.maxvideoai.com/media-assets/user-owned/clip-1.m4a';
  const ownedVideoAsset = {
    id: 'asset-1',
    userId: 'user-owned',
    kind: 'video',
    url: primaryUrl,
    width: 1920,
    height: 1080,
    durationSec: null,
    sizeBytes: 20 * 1024 * 1024,
    mimeType: 'video/mp4',
    metadata: {},
  };

  const dedicated = linkedAudioResolverFixtures({
    primaryUrl,
    audioUrl: dedicatedAudioUrl,
    audioProvenance: 'external',
  });
  const dedicatedResolved = await resolveOwnedRequest({
    userId: 'user-owned',
    request: dedicated.request,
    requestOrigin: 'https://maxvideoai.com',
  }, {
    readStudioProject: async () => dedicated.project,
    readStudioSequence: async () => dedicated.sequence,
    readOwnedLibraryAssetsByIds: async () => [ownedVideoAsset],
    isOwnedStorageUrl: ({ url }) => url === dedicatedAudioUrl || url === primaryUrl,
    validateManifestMediaUrls: async ({ manifest }) => manifest,
  });
  assert.equal(
    dedicatedResolved.manifest.tracks.find((track) => track.id === 'audio')?.clips[0]?.mediaUrl,
    dedicatedAudioUrl
  );

  const embedded = linkedAudioResolverFixtures({ primaryUrl, audioProvenance: 'embedded' });
  const embeddedResolved = await resolveOwnedRequest({
    userId: 'user-owned',
    request: embedded.request,
    requestOrigin: 'https://maxvideoai.com',
  }, {
    readStudioProject: async () => embedded.project,
    readStudioSequence: async () => embedded.sequence,
    readOwnedLibraryAssetsByIds: async () => [ownedVideoAsset],
    isOwnedStorageUrl: ({ url }) => url === primaryUrl,
    validateManifestMediaUrls: async ({ manifest }) => manifest,
  });
  assert.equal(
    embeddedResolved.manifest.tracks.find((track) => track.id === 'audio')?.clips[0]?.mediaUrl,
    primaryUrl
  );

  const embeddedManifest = validationManifest([primaryUrl]) as any;
  embeddedManifest.tracks[0].clips[0].mediaKind = 'audio';
  embeddedManifest.tracks[0].clips[0].audioProvenance = 'embedded';
  await assert.doesNotReject(() => validateTimelineExportManifestMediaUrls({
    manifest: embeddedManifest,
    requestOrigin: 'https://maxvideoai.com',
    fetchImpl: async () => new Response(null, {
      status: 200,
      headers: { 'content-length': String(20 * 1024 * 1024), 'content-type': 'video/mp4' },
    }),
  }));

  const externalManifest = structuredClone(embeddedManifest);
  externalManifest.tracks[0].clips[0].audioProvenance = 'external';
  await assert.rejects(() => validateTimelineExportManifestMediaUrls({
    manifest: externalManifest,
    requestOrigin: 'https://maxvideoai.com',
    fetchImpl: async () => new Response(null, {
      status: 200,
      headers: { 'content-length': String(20 * 1024 * 1024), 'content-type': 'video/mp4' },
    }),
  }), /EXPORT_MEDIA_TYPE_MISMATCH/);
});

test('export requests reject sequences beyond the 30 minute product limit', () => {
  const request = requestFixture();
  const durationSec = 30 * 60 + 1;
  request.manifest.durationSec = durationSec;
  request.manifest.exportRange.endSec = durationSec;
  request.manifest.exportRange.durationSec = durationSec;
  request.manifest.tracks[0].durationSec = durationSec;
  request.manifest.tracks[0].clips[0].endSec = durationSec;
  request.manifest.tracks[0].clips[0].durationSec = durationSec;
  request.manifest.tracks[0].clips[0].sourceEndSec = durationSec;

  assert.throws(() => parseTimelineExportRequest(request), /INVALID_EXPORT_REQUEST|EXPORT_RESOURCE_LIMIT/);
});

test('export requests reject more than 120 clips', () => {
  const request = requestFixture();
  request.manifest.durationSec = 121;
  request.manifest.exportRange.endSec = 121;
  request.manifest.exportRange.durationSec = 121;
  request.manifest.tracks[0].durationSec = 121;
  request.manifest.tracks[0].clips = Array.from({ length: 121 }, (_, index) => ({
    ...request.manifest.tracks[0].clips[0],
    id: `clip-${index + 1}`,
    startSec: index,
    endSec: index + 1,
    durationSec: 1,
    sourceStartSec: 0,
    sourceEndSec: 1,
  }));

  assert.throws(() => parseTimelineExportRequest(request), /INVALID_EXPORT_REQUEST|EXPORT_RESOURCE_LIMIT/);
});

test('export requests reject excessive source pixel area', () => {
  const request = requestFixture();
  request.manifest.tracks[0].clips[0].sourceWidth = 10_000;
  request.manifest.tracks[0].clips[0].sourceHeight = 10_000;

  assert.throws(() => parseTimelineExportRequest(request), /INVALID_EXPORT_REQUEST|EXPORT_RESOURCE_LIMIT/);
});

function validationManifest(urls: string[]) {
  return {
    version: 1,
    source: 'maxvideoai-editor',
    projectName: 'Limits',
    sequenceId: 'sequence-main',
    sequenceName: 'Main',
    createdAt: '2026-07-11T08:00:00.000Z',
    status: 'ready',
    durationSec: urls.length,
    exportRange: { mode: 'sequence', startSec: 0, endSec: urls.length, durationSec: urls.length },
    tracks: [{
      id: 'video',
      durationSec: urls.length,
      clips: urls.map((url, index) => ({
        id: `clip-${index}`,
        outputNodeId: `output-${index}`,
        title: `Clip ${index}`,
        track: 'video',
        mediaKind: 'video',
        mediaUrl: url,
        startSec: index,
        endSec: index + 1,
        durationSec: 1,
        sourceStartSec: 0,
        sourceEndSec: 1,
        sourceDurationSec: null,
      })),
    }],
    issues: [],
  } as never;
}

test('media validation limits probe concurrency to four', async () => {
  let active = 0;
  let maximumActive = 0;
  const urls = Array.from({ length: 8 }, (_, index) => `https://cdn.maxvideoai.com/media-assets/user-owned/${index}.mp4`);

  await validateTimelineExportManifestMediaUrls({
    manifest: validationManifest(urls),
    requestOrigin: 'https://maxvideoai.com',
    fetchImpl: async () => {
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      await new Promise((resolve) => setTimeout(resolve, 20));
      active -= 1;
      return new Response(null, {
        status: 200,
        headers: { 'content-length': String(10 * 1024 * 1024), 'content-type': 'video/mp4' },
      });
    },
  });

  assert.ok(maximumActive <= 4, `expected no more than four probes, saw ${maximumActive}`);
});

test('media validation rejects per-source and aggregate input byte excess', async () => {
  await assert.rejects(() => validateLegacyTimelineExportMediaUrl({
    url: 'https://cdn.maxvideoai.com/media-assets/user-owned/large.mp4',
    mediaKind: 'video',
    requestOrigin: 'https://maxvideoai.com',
    fetchImpl: async () => new Response(null, {
      status: 200,
      headers: { 'content-length': String(513 * 1024 * 1024), 'content-type': 'video/mp4' },
    }),
  }), /EXPORT_MEDIA_TOO_LARGE/);

  const urls = Array.from({ length: 5 }, (_, index) => `https://cdn.maxvideoai.com/media-assets/user-owned/aggregate-${index}.mp4`);
  await assert.rejects(() => validateTimelineExportManifestMediaUrls({
    manifest: validationManifest(urls),
    requestOrigin: 'https://maxvideoai.com',
    fetchImpl: async () => new Response(null, {
      status: 200,
      headers: { 'content-length': String(450 * 1024 * 1024), 'content-type': 'video/mp4' },
    }),
  }), /EXPORT_MEDIA_AGGREGATE_TOO_LARGE/);
});

test('renderer timeout cancels Remotion and output size is capped', async () => {
  const module = await import('../frontend/src/server/timeline-exports/renderer');
  const runWithTimeout = Reflect.get(module, 'runTimelineExportRenderWithTimeout');
  const assertOutputSize = Reflect.get(module, 'assertTimelineExportOutputSize');
  assert.equal(typeof runWithTimeout, 'function', 'renderer must expose its timeout boundary for behavioral testing');
  assert.equal(typeof assertOutputSize, 'function', 'renderer must expose its output-size guard for behavioral testing');

  let cancelled = 0;
  await assert.rejects(() => runWithTimeout({
    render: () => new Promise(() => undefined),
    cancel: () => { cancelled += 1; },
    timeoutMs: 20,
  }), /TIMELINE_EXPORT_RENDER_TIMEOUT/);
  assert.equal(cancelled, 1);
  assert.doesNotThrow(() => assertOutputSize(512 * 1024 * 1024));
  assert.throws(() => assertOutputSize(1024 * 1024 * 1024 + 1), /TIMELINE_EXPORT_OUTPUT_TOO_LARGE/);
});
