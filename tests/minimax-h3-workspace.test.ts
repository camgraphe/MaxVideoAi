import assert from 'node:assert/strict';
import test from 'node:test';

import {
  isUnifiedMinimaxH3EngineId,
  resolveMinimaxH3UnifiedMode,
} from '../frontend/app/(core)/(workspace)/app/_lib/minimax-h3-unified-workflow';
import { prepareGenerationInputs } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-generation-inputs';
import { buildWorkspaceGeneratePayload } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-generation-payload';
import type { FormState } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-form-state';
import type { ReferenceAsset } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-assets';
import { MINIMAX_H3_FAL_ENGINE_REGISTRY } from '../frontend/src/config/fal-engines/minimax-h3';

function asset(fieldId: string, kind: ReferenceAsset['kind']): ReferenceAsset {
  const extension = kind === 'image' ? 'jpg' : kind === 'video' ? 'mp4' : 'wav';
  return {
    id: `${fieldId}-${kind}`,
    fieldId,
    previewUrl: `https://media.maxvideoai.com/${fieldId}.${extension}`,
    kind,
    name: `${fieldId}.${extension}`,
    size: 100,
    type: kind === 'image' ? 'image/jpeg' : kind === 'video' ? 'video/mp4' : 'audio/wav',
    url: `https://media.maxvideoai.com/${fieldId}.${extension}`,
    durationSec: kind === 'image' ? null : 5,
    assetId: `${fieldId}-${kind}`,
    status: 'ready',
  };
}

function form(): FormState {
  return {
    engineId: 'minimax-h3',
    mode: 'ref2v',
    durationSec: 15,
    durationOption: 15,
    resolution: '4K',
    aspectRatio: 'auto',
    fps: 24,
    iterations: 1,
    seedLocked: false,
    loop: false,
    audio: false,
    extraInputValues: {},
  };
}

test('MiniMax H3 unified mode follows the loaded schema fields', () => {
  const image = asset('image_url', 'image');
  const end = asset('end_image_url', 'image');
  const referenceImage = asset('reference_image_urls', 'image');
  const referenceVideo = asset('reference_video_urls', 'video');
  const referenceAudio = asset('reference_audio_urls', 'audio');

  assert.equal(isUnifiedMinimaxH3EngineId('minimax-h3'), true);
  assert.equal(isUnifiedMinimaxH3EngineId('minimax-hailuo-02-text'), false);
  assert.equal(resolveMinimaxH3UnifiedMode({}), 't2v');
  assert.equal(resolveMinimaxH3UnifiedMode({ image_url: [image] }), 'i2v');
  assert.equal(resolveMinimaxH3UnifiedMode({ end_image_url: [end] }), 'i2v');
  assert.equal(resolveMinimaxH3UnifiedMode({ reference_image_urls: [referenceImage] }), 'ref2v');
  assert.equal(resolveMinimaxH3UnifiedMode({ reference_video_urls: [referenceVideo] }), 'ref2v');
  assert.equal(resolveMinimaxH3UnifiedMode({ reference_audio_urls: [referenceAudio] }), 'ref2v');
});

test('MiniMax H3 workspace retains exact multimodal slot IDs and omits an audio toggle', () => {
  const entry = MINIMAX_H3_FAL_ENGINE_REGISTRY[0];
  assert.ok(entry);
  const schema = entry.engine.inputSchema;
  assert.ok(schema);
  const fields = [...(schema.required ?? []), ...(schema.optional ?? [])];
  const referenceFields = fields.filter((field) => field.id.startsWith('reference_'));
  const inputAssets = {
    reference_image_urls: [asset('reference_image_urls', 'image')],
    reference_video_urls: [asset('reference_video_urls', 'video')],
    reference_audio_urls: [asset('reference_audio_urls', 'audio')],
  };
  const prepared = prepareGenerationInputs({
    selectedEngineId: 'minimax-h3',
    selectedEngineLabel: 'MiniMax H3',
    activeMode: 'ref2v',
    submissionMode: 'ref2v',
    form: form(),
    inputSchema: schema,
    inputSchemaSummary: {
      assetFields: referenceFields.map((field) => ({ field, required: false, role: 'reference' as const })),
    },
    extraInputFields: [],
    inputAssets,
    primaryAssetFieldIds: new Set(),
    referenceAssetFieldIds: new Set(['reference_image_urls']),
    genericImageFieldIds: new Set(['reference_image_urls']),
    frameAssetFieldIds: new Set(),
    referenceAudioFieldIds: new Set(['reference_audio_urls']),
    supportsKlingV3Controls: false,
    klingElements: [],
    multiPromptActive: false,
    multiPromptScenes: [],
  });
  assert.equal(prepared.ok, true);
  if (!prepared.ok) return;
  assert.deepEqual(prepared.inputsPayload?.map(({ slotId }) => slotId), [
    'reference_image_urls',
    'reference_video_urls',
    'reference_audio_urls',
  ]);

  const built = buildWorkspaceGeneratePayload({
    selectedEngineId: 'minimax-h3',
    activeMode: 'ref2v',
    submissionMode: 'ref2v',
    form: form(),
    trimmedPrompt: 'Two original explorers exchange a map.',
    trimmedNegativePrompt: '',
    effectiveDurationSec: 15,
    paymentMode: 'wallet',
    capability: entry.modes.find(({ mode }) => mode === 'ref2v')?.ui,
    inputSchema: schema,
    supportsNegativePrompt: false,
    supportsAudioToggle: false,
    isSeedance: false,
    supportsKlingV3Controls: false,
    supportsKlingV3VoiceControl: false,
    voiceIds: [],
    voiceControlEnabled: false,
    shotType: 'customize',
    localKey: 'local-h3',
    batchId: 'batch-h3',
    iterationIndex: 0,
    iterationCount: 1,
    friendlyMessage: 'Generating',
    lumaContext: { isLumaRay2GenerateWorkflow: false, lumaDuration: null, lumaResolution: null },
    inputsPayload: prepared.inputsPayload,
    referenceImageUrls: prepared.referenceImageUrls,
    endImageUrl: prepared.endImageUrl,
    extraInputValues: prepared.extraInputValues,
    multiPromptPayload: prepared.multiPromptPayload,
    klingElementsPayload: prepared.klingElementsPayload,
  });

  assert.equal('audio' in built.payload, false);
  assert.strictEqual(built.payload.inputs, prepared.inputsPayload);
  assert.equal(built.payload.durationOption, 15);
  assert.equal(built.payload.resolution, '4K');
  assert.equal(built.payload.aspectRatio, 'auto');
});
