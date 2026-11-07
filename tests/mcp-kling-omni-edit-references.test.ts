import assert from 'node:assert/strict';
import test from 'node:test';

import { processAndValidateGenerationAttachments } from '../frontend/app/api/generate/_lib/generation-attachment-processing';
import { getFalEngineById } from '../frontend/src/config/falEngines';
import { resolveVideoOperationEngine } from '../frontend/lib/video-operation';
import { normalizeGenerationRequest } from '../frontend/src/server/agent-api/generation-normalization';
import { buildPaidVideoRequestBody } from '../frontend/src/server/agent-api/paid-video-request-body';
import type { ResolvedReference } from '../frontend/src/server/agent-api/reference-types';

function editRequest(engineId: string, imageCount: number) {
  const resolvedReferences: ResolvedReference[] = [{
    assetId: `ma_${'a'.repeat(32)}`,
    role: 'source',
    mediaKind: 'video',
    storageUrl: 'https://media.maxvideoai.com/owned-source.mp4',
    width: 720,
    height: 1280,
    durationSec: 12,
    mimeType: 'video/mp4',
    sizeBytes: 26_068_759,
    originalName: 'owned-source.mp4',
  }, ...Array.from({ length: imageCount }, (_, slot): ResolvedReference => ({
    assetId: `ma_${String(slot + 1).repeat(32)}`,
    role: 'reference',
    slot,
    mediaKind: 'image',
    storageUrl: `https://media.maxvideoai.com/owned-portrait-${slot}.png`,
    width: 1254,
    height: 1254,
    durationSec: null,
    mimeType: 'image/png',
    sizeBytes: 3_177_351,
    originalName: `owned-portrait-${slot}.png`,
  }))];
  const request = normalizeGenerationRequest({
    schemaVersion: 1,
    surface: 'video',
    engineId,
    mode: 'v2v',
    operation: 'kling-edit',
    prompt: 'Remove the cap in @Video1 using the identity from @Image1.',
    settings: {
      resolution: engineId === 'kling-o3-standard' ? '720p' : engineId === 'kling-o3-pro' ? '1080p' : '4k',
      keepAudio: false,
    },
    references: resolvedReferences.map(({ assetId, role, slot }) => ({
      kind: 'asset', assetId, role, ...(slot === undefined ? {} : { slot }),
    })),
    outputCount: 1,
  });
  const engine = getFalEngineById(engineId)!.engine;
  const body = buildPaidVideoRequestBody({
    quoteId: 'offline-omni-edit',
    request,
    engine,
    resolvedReferences,
    canonicalPricing: { membershipTier: 'member' },
  });
  const operationEngine = resolveVideoOperationEngine(engine, 'v2v', 'kling-edit');
  const validate = (trustedResolvedReferences = resolvedReferences) => processAndValidateGenerationAttachments({
    engineId,
    mode: 'v2v',
    userId: 'owned-reference-test',
    inputSchema: operationEngine.inputSchema,
    rawInputs: body.inputs,
    referenceImages: body.referenceImages,
    trustedResolvedReferences,
    mediaConstraintDeps: {
      queryFn: async () => { throw new Error('Owned references must not fall back to a database lookup.'); },
      detectVideoDimensionsFn: async () => { throw new Error('Owned video dimensions are already measured.'); },
      detectMediaDurationFn: async () => { throw new Error('Owned video duration is already measured.'); },
    },
  });
  return { body, resolvedReferences, validate };
}

for (const engineId of ['kling-o3-standard', 'kling-o3-pro', 'kling-o3-4k']) {
  for (const imageCount of [1, 4]) {
    test(`${engineId} Edit keeps ${imageCount} owned image references valid through the paid attachment pipeline`, async () => {
      const { body, resolvedReferences, validate } = editRequest(engineId, imageCount);
      const result = await validate();
      assert.equal(result.ok, true, JSON.stringify(result));
      if (!result.ok) return;

      const images = result.attachments.filter(({ kind }) => kind === 'image');
      assert.deepEqual(images.map(({ assetId, slotId, width, height, type, size }) =>
        ({ assetId, slotId, width, height, type, size })),
      Array.from({ length: imageCount }, (_, slot) => ({
        assetId: `ma_${String(slot + 1).repeat(32)}`,
        slotId: 'image_urls',
        width: 1254,
        height: 1254,
        type: 'image/png',
        size: 3_177_351,
      })));
      const imageUrls = resolvedReferences.slice(1).map(({ storageUrl }) => storageUrl);
      assert.deepEqual(body.referenceImages, imageUrls);
      assert.deepEqual(result.references.normalizedReferenceImages, imageUrls);
      assert.deepEqual(result.references.referenceValuesByField.image_urls, imageUrls);
      assert.deepEqual(result.trustedDurationSecByField.video_url, [12]);
      assert.equal(result.trustedMediaReferences?.length, imageCount + 1);
    });
  }
}

test('Kling Omni Edit still validates a source without image guidance', async () => {
  const { validate } = editRequest('kling-o3-standard', 0);
  const result = await validate();
  assert.equal(result.ok, true);
});

for (const mismatch of ['missing', 'asset-id', 'url'] as const) {
  test(`Kling Omni Edit rejects image guidance with ${mismatch} trusted identity`, async () => {
    const { resolvedReferences, validate } = editRequest('kling-o3-standard', 1);
    const trusted = mismatch === 'missing' ? resolvedReferences.slice(0, 1)
      : resolvedReferences.map(reference => reference.mediaKind !== 'image' ? reference : {
        ...reference,
        ...(mismatch === 'asset-id' ? { assetId: `ma_${'b'.repeat(32)}` }
          : { storageUrl: 'https://media.maxvideoai.com/different-portrait.png' }),
      });
    const result = await validate(trusted);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.status, 422);
    assert.equal(result.body.error, 'MEDIA_METADATA_UNVERIFIED');
    assert.ok('field' in result.body);
    assert.equal(result.body.field, 'image_urls');
  });
}
