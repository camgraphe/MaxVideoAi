import assert from 'node:assert/strict';
import test from 'node:test';
import { isWorkspaceModelCertifiedForBlock } from '../frontend/app/(core)/(workspace)/app/studio/_shared/_lib/models/workspace-model-certification';
import { buildAgentGenerationRecovery, buildGenerationResourceLinks } from '@/server/agent-api/generation-status';
import { validateCanonicalGenerationCapabilities } from '@/server/agent-api/generation-capability-validation';
import { normalizeGenerationRequest } from '@/server/agent-api/generation-normalization';
import { projectAgentModelModeDetails } from '@/server/agent-api/model-details';
import { mapGenerationStatusRecordToAgent, type GenerationStatusRecord } from '@/server/generations/generation-status';
import { imageRequestFromDraft } from '@/server/studio/conversation-image-request';
import type { AgentPublicGenerationEngine } from '@/server/agent-api/model-catalog';
import { qualifyKlingImageV4References } from '@/server/images/kling-image-v4-references';
import { persistFalWebhookImageOutputs } from '@/server/fal-webhook-image-output';
import sharp from 'sharp';
import { getFalEngineById } from '@/config/falEngines';
import { getRuntimeModelById } from '@/config/model-runtime';
import { getImageCountConstraints, getReferenceConstraints, getResolutionOptions } from '@/lib/image/inputSchema';
import { klingImageV4ReferenceFailure } from '@/lib/image/kling-image-v4';
import { buildFalImageGenerationInput } from '@/server/images/image-fal-generation';
import { extractImages } from '@/server/images/image-provider-payload';
import { studioImageReferenceLimit } from '@/lib/studio/conversation-creation-contract';

const id = 'kling-image-v4';
const source = 'https://media.example/product.png';
const guide = 'https://media.example/lighting.jpg';

function payload(mode: 't2i' | 'i2i', numImages: number, providerImageSize: string) {
  return buildFalImageGenerationInput({
    falModelId: mode === 't2i' ? 'kling/v4/text-to-image' : 'kling/v4/image-to-image',
    mode, effectivePrompt: 'Photograph a glazed ceramic lamp.', numImages, providerImageSize,
    resolvedReferenceUrls: mode === 'i2i' ? [source, guide] : [], falAspectRatio: '3:2',
    resolutionEngineParam: 'resolution', normalizedSeed: null, outputFormat: null, quality: null,
    maskUrl: null, enableWebSearch: false, thinkingLevel: null, limitGenerations: false,
  });
}

test('Kling Image is a separate image model with two schema-derived modes', () => {
  const model = getRuntimeModelById(id);
  const entry = getFalEngineById(id);
  assert.ok(model?.publication.app.published);
  assert.equal(model.category, 'image');
  assert.ok(entry);
  assert.deepEqual(entry.modes.map(({ mode, falModelId }) => [mode, falModelId]), [
    ['t2i', 'kling/v4/text-to-image'], ['i2i', 'kling/v4/image-to-image'],
  ]);
  for (const mode of ['t2i', 'i2i'] as const) {
    assert.deepEqual(getResolutionOptions(entry.engine, mode), ['2K', '4K', '8K']);
    assert.deepEqual(getImageCountConstraints(entry.engine, mode), {min: 1, max: 10, defaultValue: 1});
  }
  assert.equal(getReferenceConstraints(entry.engine, 't2i').max, 0);
  assert.equal(getReferenceConstraints(entry.engine, 'i2i').max, 10);
  assert.equal(studioImageReferenceLimit(id), 10);
});

test('Fal input maps one output and exact-count ordered sets without unsupported fields', () => {
  const prompt = 'Photograph a glazed ceramic lamp.';
  assert.deepEqual(payload('t2i', 1, '2K'), {
    prompt, result_type: 'single', num_images: 1, resolution: '2K', aspect_ratio: '3:2',
  });
  assert.deepEqual(payload('i2i', 10, '8K'), {
    prompt, result_type: 'series', series_amount: 10, resolution: '8K', aspect_ratio: '3:2',
    image_urls: [source, guide],
  });
  for (const mode of ['t2i', 'i2i'] as const) {
    assert.equal(payload(mode, 2, '4K').resolution, '4K');
    assert.throws(() => payload(mode, 11, '8K'));
    assert.throws(() => payload(mode, 1, '1K'));
  }
});

test('Fal ordered PNG outputs allow null provider dimensions for the storage reader to measure', () => {
  assert.deepEqual(extractImages({ images: [
    {url: source, content_type: 'image/png', width: null, height: null},
    {url: guide, content_type: 'image/png', width: 8192, height: 6144},
  ] }), [
    {url: source, width: null, height: null, mimeType: 'image/png'},
    {url: guide, width: 8192, height: 6144, mimeType: 'image/png'},
  ]);
});

test('reference limits use measured bytes and dimensions', () => {
  const image = {mimeType: 'image/png', width: 300, height: 750, sizeBytes: 30 * 1024 * 1024};
  assert.equal(klingImageV4ReferenceFailure(image), null);
  for (const changes of [{width: 299}, {height: 751}, {sizeBytes: image.sizeBytes + 1},
    {sizeBytes: null}, {mimeType: 'image/gif'}, {width: null}]) {
    assert.ok(klingImageV4ReferenceFailure({...image, ...changes}));
  }
});

test('MCP projects ten ordered outputs and Studio keeps its single-output workflow', () => {
  const entry = getFalEngineById(id)!;
  const candidate: AgentPublicGenerationEngine = {
    engine: entry.engine, surface: 'image', publicModes: ['t2i', 'i2i'],
    modeCaps: Object.fromEntries(entry.modes.map(mode => [mode.mode, mode.ui])),
  };
  for (const mode of ['t2i', 'i2i'] as const) {
    const modes = projectAgentModelModeDetails(candidate, mode);
    assert.equal(modes.outputCount.max, 10);
    assert.match(modes.outputCount.description ?? '', /Image Set/);
    assert.deepEqual(modes.resolutions, ['2K', '4K', '8K']);
    assert.equal(isWorkspaceModelCertifiedForBlock({
      modelId: id, presetId: mode === 't2i' ? 'generate-image' : 'modify-image',
      workflowType: mode === 't2i' ? 'text_to_image' : 'image_to_image',
    }), true);
    const refs = mode === 'i2i' ? Array.from({length: 10}, (_, index) => `ma_${String(9 - index).padStart(32, 'a')}`) : [];
    const fromStudio = imageRequestFromDraft({
      reply: 'Draft',
      image: {modelId: id, mode, prompt: 'Refine the lamp design', aspectRatio: 'auto', settings: [{name: 'resolution', value: '8K'}]},
    }, {requestId: '123e4567-e89b-42d3-a456-426614174000', message: 'Refine the lamp design', references: refs}, [candidate]);
    assert.equal(fromStudio.outputCount, 1);
    assert.equal(fromStudio.settings.resolution?.toString().toUpperCase(), '8K');
    assert.deepEqual(fromStudio.references.map(ref => ref.kind === 'asset' && ref.assetId), refs);
    assert.deepEqual(fromStudio.references.map(ref => ref.slot), refs.map((_, index) => index));
    const resolvedReferences = refs.map((assetId, slot) => ({
      assetId, slot, role: 'reference' as const, mediaKind: 'image' as const,
      storageUrl: 'https://media.maxvideoai.com/owned-reference.png', mimeType: 'image/png',
      width: 1024, height: 768, durationSec: null, sizeBytes: 98_000,
    }));
    const fromMcp = normalizeGenerationRequest({...fromStudio, outputCount: 10});
    validateCanonicalGenerationCapabilities(fromMcp, candidate, {resolvedReferences});
    assert.throws(() => validateCanonicalGenerationCapabilities({...fromMcp, outputCount: 11}, candidate));
    if (mode === 'i2i') {
      assert.throws(() => validateCanonicalGenerationCapabilities(fromMcp, candidate, {
        resolvedReferences: resolvedReferences.map(ref => ({...ref, width: 299})),
      }));
    }
  }
});

test('MCP recovery keeps every owned Image Set result in provider order', () => {
  const imageUrls = Array.from({length: 10}, (_, index) => `https://media.maxvideoai.com/output-${index + 1}.png`);
  const status = mapGenerationStatusRecordToAgent({
    job_id: 'img_series', engine_id: id, status: 'completed', progress: 100, surface: 'image',
    render_ids: imageUrls, payment_status: 'paid_wallet', final_price_cents: 288, currency: 'USD',
  } as GenerationStatusRecord);
  assert.ok(status);
  const recovery = buildAgentGenerationRecovery(status);
  assert.equal(recovery.result?.surface, 'image');
  assert.ok(recovery.result.orderedSet);
  assert.deepEqual(recovery.result.imageUrls, imageUrls);
  assert.deepEqual(buildGenerationResourceLinks(recovery).map(link => link.uri), imageUrls);
});

test('Kling references require an owned row and measured bytes, independent of client metadata', async () => {
  const picture = await sharp({create: {width: 600, height: 400, channels: 3, background: '#4f5e64'}}).png().toBuffer();
  const tooSmall = await sharp({create: {width: 299, height: 300, channels: 3, background: '#4f5e64'}}).png().toBuffer();
  let reads = 0;
  let measured = picture;
  const deps: Parameters<typeof qualifyKlingImageV4References>[2] = {
    storageKey: ({url, userId}) => userId === 'owner' && url === source ? 'owned/test' : null,
    queryFn: async <T = unknown>(sql: string, params?: ReadonlyArray<unknown>) => {
      assert.match(sql, /job_outputs o/);
      assert.deepEqual(params, ['owner', [source]]);
      return [{url: source, width: 5_000, height: 5_000}] as T[];
    },
    readOriginal: async (key, options) => {
      reads += 1;
      assert.equal(key, 'owned/test');
      assert.equal(options?.maxBytes, 30 * 1024 * 1024);
      return measured;
    },
  };
  assert.equal(await qualifyKlingImageV4References('owner', [source, source], deps), true);
  assert.equal(reads, 1);
  measured = tooSmall;
  assert.equal(await qualifyKlingImageV4References('owner', [source], deps), false);
  assert.equal(await qualifyKlingImageV4References('different-account', [source], deps), false);
  assert.equal(reads, 2);
});

test('Kling Fal recovery stores complete outputs and refuses to complete a short set', async () => {
  const job = {job_id: 'img_8k_set', user_id: 'owner', settings_snapshot: {outputCount: 2},
    render_ids: null, hero_render_id: null};
  const images = [source, guide].map(url => ({url, content_type: 'image/png', width: null, height: null}));
  let copies = 0;
  const run = (payload: unknown) => persistFalWebhookImageOutputs({
    job, engineId: id, status: 'completed', payload: {}, finalPayload: payload,
  }, async ({images, requireOwnedOutput, userId}) => {
    copies += 1;
    assert.equal(requireOwnedOutput, true);
    assert.equal(userId, 'owner');
    assert.deepEqual(images.map(image => image.url), [source, guide]);
    return images.map((image, index) => ({
      ...image, url: `https://media.maxvideoai.com/owned-${index}.png`,
      thumbUrl: `https://media.maxvideoai.com/owned-thumb-${index}.webp`, width: 8192, height: 6144,
    }));
  });
  const complete = await run({data: {images}});
  assert.equal(complete.incomplete, false);
  assert.equal(complete.renders?.length, 2);
  assert.equal(complete.renders?.[1].width, 8192);
  assert.equal(complete.hero, complete.urls[0]);
  assert.equal(complete.thumb, 'https://media.maxvideoai.com/owned-thumb-0.webp');
  assert.equal((await run({images: images.slice(0, 1)})).incomplete, true);
  await assert.rejects(run({status: 'COMPLETED'}), /not available for recovery/);
  assert.equal(copies, 1);
});
