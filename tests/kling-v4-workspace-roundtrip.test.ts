import assert from 'node:assert/strict';
import test from 'node:test';
import { KLING_V4_ENGINE } from '../frontend/src/config/fal-engines/kling-v4';
import { buildKlingV4FalRequest } from '../frontend/src/lib/kling-v4';
import { deriveGenerationAttachmentReferences } from '../frontend/app/api/generate/_lib/attachment-references';
import { buildGenerateRequestOptions } from '../frontend/app/api/generate/_lib/request-options';
import { buildFalRequestParts } from '../frontend/app/api/generate/_lib/fal-request';
import { coerceFormState } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-engine-helpers';
import { summarizeWorkspaceInputSchema } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-input-schema';
import { resolveWorkspaceWorkflow } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-workflow-projection';
import { prepareGenerationInputs } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-generation-inputs';
import { buildWorkspaceGeneratePayload } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-generation-payload';
import { buildAssetFieldIdSet, type ReferenceAsset } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-assets';

function ownedAsset(fieldId: string, assetId: string, kind: 'image' | 'video'): ReferenceAsset {
  return {
    id: assetId, assetId, fieldId, kind, name: assetId, status: 'ready',
    url: `https://owned.test/original/${assetId}.${kind === 'image' ? 'png' : 'mp4'}`,
    previewUrl: `https://owned.test/preview/${assetId}.jpg`,
    size: 4096, type: kind === 'image' ? 'image/png' : 'video/mp4', width: 1280, height: 720,
    ...(kind === 'video' ? { durationSec: 4 } : {}),
  };
}

for (const mode of ['ref2v', 'v2v'] as const) {
  test(`V4 ${mode} carries repeated ordered images through the real workspace and server fal request builders`, () => {
    const engine = KLING_V4_ENGINE;
    const form = coerceFormState(engine, mode, null);
    const images = ['z-look', 'z-look', 'a-look'].map(id => ownedAsset('image_urls', id, 'image'));
    const inputAssets = {
      image_urls: images,
      ...(mode === 'v2v' ? { video_url: [ownedAsset('video_url', 'source', 'video')] } : {}),
    };
    const workflow = resolveWorkspaceWorkflow({ engine, form, inputAssets, klingElements: [] });
    const schema = summarizeWorkspaceInputSchema({ selectedEngine: engine, ...workflow, uiLocale: 'en' });
    const prepared = prepareGenerationInputs({
      selectedEngineId: engine.id, activeMode: mode, submissionMode: mode, form,
      inputSchema: engine.inputSchema, inputSchemaSummary: schema,
      extraInputFields: [...schema.promotedFields, ...schema.secondaryFields], inputAssets,
      primaryAssetFieldIds: buildAssetFieldIdSet(schema.assetFields, entry => entry.role === 'primary'),
      referenceAssetFieldIds: buildAssetFieldIdSet(schema.assetFields, entry => entry.role === 'reference'),
      genericImageFieldIds: buildAssetFieldIdSet(schema.assetFields, entry => entry.role === 'generic' && entry.field.type === 'image'),
      frameAssetFieldIds: buildAssetFieldIdSet(schema.assetFields, entry => entry.role === 'frame'),
      referenceAudioFieldIds: new Set(), supportsKlingV3Controls: false, klingElements: [],
      multiPromptActive: false, multiPromptScenes: [],
    });
    assert.ok(prepared.ok, prepared.ok ? undefined : prepared.message);
    if (!prepared.ok) return;
    const clientPayload = buildWorkspaceGeneratePayload({
      ...prepared, selectedEngineId: engine.id, activeMode: mode, submissionMode: mode, form,
      trimmedPrompt: 'Keep @Image2 before @Image3 in the authored reference sequence.', trimmedNegativePrompt: '',
      effectiveDurationSec: 5, paymentMode: 'wallet', capability: engine.modeCaps?.[mode], inputSchema: engine.inputSchema,
      supportsNegativePrompt: false, supportsAudioToggle: false, isSeedance: false,
      supportsKlingV3Controls: false, supportsKlingV3VoiceControl: false,
      voiceIds: [], voiceControlEnabled: false, shotType: 'customize',
      localKey: 'offline-roundtrip', batchId: 'offline-roundtrip', iterationIndex: 0, iterationCount: 1,
      friendlyMessage: '', lumaContext: { isLumaRay2GenerateWorkflow: false, lumaDuration: null, lumaResolution: null },
    }).payload;
    // Simulate the JSON boundary without a network request, authenticated action or paid quote.
    const body = JSON.parse(JSON.stringify(clientPayload)) as typeof clientPayload;
    const attachments = body.inputs ?? [];
    const normalized = buildGenerateRequestOptions({ body, engine, mode, isBytePlusV1a: false });
    assert.ok(normalized.ok, normalized.ok ? undefined : JSON.stringify(normalized.body));
    if (!normalized.ok) return;
    const options = normalized.options;
    const references = deriveGenerationAttachmentReferences({
      attachments, engineId: engine.id, mode, inputSchema: engine.inputSchema,
      imageUrl: body.imageUrl, referenceImages: body.referenceImages,
      endImageUrl: options.endImageUrl, rawAudioUrl: options.rawAudioUrl,
    });
    const { falPayload } = buildFalRequestParts({
      ...options, ...references, attachments, engineId: engine.id, mode,
      apiKey: undefined, jobId: 'offline-roundtrip', localKey: body.localKey ?? null,
      needsImage: false, needsFirstLastFrames: false,
      durationOption: options.rawDurationOption, resolution: options.effectiveResolution,
      extraInputValues: body.extraInputValues ?? {}, fps: body.fps, cfgScale: body.cfgScale,
    });
    const provider = buildKlingV4FalRequest(falPayload);
    const expected = images.map(image => image.url);
    assert.deepEqual(provider.requestBody.image_urls, expected, 'Repeated @Image2 must not move behind @Image3 during the two-projection merge.');
    assert.deepEqual(prepared.referenceImageUrls, expected);
    assert.deepEqual(body.referenceImages, expected);
    assert.deepEqual(references.normalizedReferenceImages, expected);
    assert.deepEqual(falPayload.referenceImages, expected);
    assert.deepEqual(attachments.filter(item => item.slotId === 'image_urls').map(item => item.assetId), ['z-look', 'z-look', 'a-look']);
    assert.deepEqual(attachments.filter(item => item.slotId === 'image_urls').map(item => [item.width, item.height, item.size]), Array(3).fill([1280, 720, 4096]));
    assert.equal(provider.model, mode === 'ref2v' ? 'kling/v4/reference-to-video' : 'kling/v4/video-to-video/edit');
    if (mode === 'v2v') assert.equal(provider.requestBody.video_url, inputAssets.video_url?.[0].url);
  });
}
