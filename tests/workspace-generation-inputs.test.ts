import assert from 'node:assert/strict';
import test from 'node:test';

import type { MultiPromptScene } from '../frontend/components/Composer';
import type { KlingElementState } from '../frontend/components/KlingElementsBuilder';
import type { EngineInputField } from '../frontend/types/engines';
import type { ReferenceAsset } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-assets';
import type { FormState } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-form-state';
import {
  prepareGenerationInputs,
  type GenerationInputPreparationResult,
} from '../frontend/app/(core)/(workspace)/app/_lib/workspace-generation-inputs';

function field(id: string, type: EngineInputField['type'], label = id): EngineInputField {
  return { id, type, label };
}

function asset(overrides: Partial<ReferenceAsset> = {}): ReferenceAsset {
  const id = overrides.id ?? 'asset_1';
  const kind = overrides.kind ?? 'image';
  return {
    id,
    fieldId: overrides.fieldId ?? 'image_url',
    previewUrl: overrides.previewUrl ?? `https://cdn.example.com/${id}.jpg`,
    kind,
    name: overrides.name ?? `${id}.${kind === 'video' ? 'mp4' : kind === 'audio' ? 'mp3' : 'jpg'}`,
    size: overrides.size ?? 123,
    type: overrides.type ?? (kind === 'video' ? 'video/mp4' : kind === 'audio' ? 'audio/mpeg' : 'image/jpeg'),
    url: overrides.url ?? `https://cdn.example.com/${id}.${kind === 'video' ? 'mp4' : kind === 'audio' ? 'mp3' : 'jpg'}`,
    width: overrides.width ?? null,
    height: overrides.height ?? null,
    assetId: overrides.assetId ?? id,
    status: overrides.status ?? 'ready',
  };
}

function baseForm(overrides: Partial<FormState> = {}): FormState {
  return {
    engineId: 'seedance-2-0',
    mode: 'ref2v',
    durationSec: 5,
    resolution: '720p',
    aspectRatio: '16:9',
    fps: 24,
    iterations: 1,
    seedLocked: false,
    loop: false,
    audio: false,
    extraInputValues: {},
    ...overrides,
  };
}

function assertReady(
  result: GenerationInputPreparationResult
): asserts result is Extract<GenerationInputPreparationResult, { ok: true }> {
  assert.equal(result.ok, true, result.ok ? undefined : result.message);
}

test('prepareGenerationInputs orders attachments and derives generation URL groups', () => {
  const primary = field('image_url', 'image', 'Primary image');
  const references = field('image_urls', 'image', 'References');
  const video = field('reference_video_urls', 'video', 'Reference videos');
  const referenceAudio = field('reference_audio_urls', 'audio', 'Reference audio');
  const primaryAudio = field('audio_url', 'audio', 'Voice');
  const endImage = field('end_image_url', 'image', 'End frame');
  const style = field('style_strength', 'number', 'Style strength');
  const imageUrlAsset = asset({ id: 'primary', fieldId: 'image_url', url: 'https://cdn.example.com/primary.jpg' });
  const referenceOne = asset({ id: 'ref1', fieldId: 'image_urls', url: 'https://cdn.example.com/ref-1.jpg' });
  const referenceDuplicate = asset({ id: 'ref2', fieldId: 'image_urls', url: 'https://cdn.example.com/ref-1.jpg' });
  const videoAsset = asset({
    id: 'video1',
    fieldId: 'reference_video_urls',
    kind: 'video',
    url: 'https://cdn.example.com/ref.mp4',
  });
  const referenceAudioAsset = asset({
    id: 'audio_ref',
    fieldId: 'reference_audio_urls',
    kind: 'audio',
    url: 'https://cdn.example.com/ref.mp3',
  });
  const primaryAudioAsset = asset({
    id: 'audio_primary',
    fieldId: 'audio_url',
    kind: 'audio',
    url: 'https://cdn.example.com/voice.mp3',
  });
  const endImageAsset = asset({ id: 'end', fieldId: 'end_image_url', url: 'https://cdn.example.com/end.jpg' });

  const result = prepareGenerationInputs({
    selectedEngineId: 'seedance-2-0',
    activeMode: 'ref2v',
    submissionMode: 'ref2v',
    form: baseForm({ extraInputValues: { style_strength: '0.72' } }),
    inputSchema: {
      required: [primary, references],
      optional: [video, referenceAudio, primaryAudio, endImage, style],
    },
    inputSchemaSummary: {
      assetFields: [
        { field: primary, required: true, role: 'primary' },
        { field: references, required: true, role: 'reference' },
        { field: video, required: false, role: 'reference' },
        { field: referenceAudio, required: false, role: 'reference' },
        { field: primaryAudio, required: false, role: 'generic' },
        { field: endImage, required: false, role: 'frame' },
      ],
    },
    extraInputFields: [{ field: style, required: false }],
    inputAssets: {
      image_url: [imageUrlAsset],
      image_urls: [referenceOne, referenceDuplicate],
      reference_video_urls: [videoAsset],
      reference_audio_urls: [referenceAudioAsset],
      audio_url: [primaryAudioAsset],
      end_image_url: [endImageAsset],
    },
    primaryAssetFieldIds: new Set(['image_url']),
    referenceAssetFieldIds: new Set(['image_urls']),
    genericImageFieldIds: new Set(['image_urls']),
    frameAssetFieldIds: new Set(['end_image_url']),
    referenceAudioFieldIds: new Set(['reference_audio_urls']),
    supportsKlingV3Controls: false,
    klingElements: [],
    multiPromptActive: false,
    multiPromptScenes: [],
  });

  assertReady(result);
  assert.equal(result.inputsPayload?.[0]?.slotId, 'image_url');
  assert.equal(result.inputsPayload?.[1]?.slotId, 'image_urls');
  assert.equal(result.primaryAttachment?.url, 'https://cdn.example.com/primary.jpg');
  assert.deepEqual(result.referenceImageUrls, ['https://cdn.example.com/ref-1.jpg']);
  assert.deepEqual(result.referenceVideoUrls, ['https://cdn.example.com/ref.mp4']);
  assert.deepEqual(result.referenceAudioUrls, ['https://cdn.example.com/ref.mp3']);
  assert.equal(result.primaryImageUrl, 'https://cdn.example.com/primary.jpg');
  assert.equal(result.primaryAudioUrl, 'https://cdn.example.com/voice.mp3');
  assert.equal(result.endImageUrl, 'https://cdn.example.com/end.jpg');
  assert.deepEqual(result.extraInputValues, { style_strength: 0.72 });
});

test('prepareGenerationInputs preserves Happy Horse reference slot routing', () => {
  const imageUrls = field('image_urls', 'image', 'Happy Horse R2V refs');
  const referenceImageUrls = field('reference_image_urls', 'image', 'Happy Horse V2V refs');
  const result = prepareGenerationInputs({
    selectedEngineId: 'happy-horse-1-0',
    activeMode: 't2v',
    submissionMode: 'v2v',
    form: baseForm({ engineId: 'happy-horse-1-0', mode: 'v2v' }),
    inputSchema: { required: [], optional: [imageUrls, referenceImageUrls] },
    inputSchemaSummary: {
      assetFields: [
        { field: imageUrls, required: false, role: 'reference' },
        { field: referenceImageUrls, required: false, role: 'reference' },
      ],
    },
    extraInputFields: [],
    inputAssets: {
      image_urls: [asset({ id: 'r2v', fieldId: 'image_urls', url: 'https://cdn.example.com/r2v.jpg' })],
      reference_image_urls: [
        asset({ id: 'v2v', fieldId: 'reference_image_urls', url: 'https://cdn.example.com/v2v.jpg' }),
      ],
    },
    primaryAssetFieldIds: new Set(),
    referenceAssetFieldIds: new Set(['image_urls', 'reference_image_urls']),
    genericImageFieldIds: new Set(['image_urls', 'reference_image_urls']),
    frameAssetFieldIds: new Set(),
    referenceAudioFieldIds: new Set(),
    supportsKlingV3Controls: false,
    klingElements: [],
    multiPromptActive: false,
    multiPromptScenes: [],
  });

  assertReady(result);
  assert.deepEqual(result.referenceImageUrls, ['https://cdn.example.com/v2v.jpg']);
});

test('prepareGenerationInputs reports unavailable assets before generation', () => {
  const image = field('image_url', 'image', 'Primary image');
  const result = prepareGenerationInputs({
    selectedEngineId: 'seedance-2-0',
    activeMode: 'i2v',
    submissionMode: 'i2v',
    form: baseForm({ mode: 'i2v' }),
    inputSchema: { required: [image], optional: [] },
    inputSchemaSummary: { assetFields: [{ field: image, required: true, role: 'primary' }] },
    extraInputFields: [],
    inputAssets: { image_url: [asset({ fieldId: 'image_url', status: 'uploading' })] },
    primaryAssetFieldIds: new Set(['image_url']),
    referenceAssetFieldIds: new Set(),
    genericImageFieldIds: new Set(),
    frameAssetFieldIds: new Set(),
    referenceAudioFieldIds: new Set(),
    supportsKlingV3Controls: false,
    klingElements: [],
    multiPromptActive: false,
    multiPromptScenes: [],
  });

  assert.deepEqual(result, {
    ok: false,
    message: 'Please wait for uploads to finish before generating.',
  });
});

test('prepareGenerationInputs builds Kling element and multi-prompt payloads', () => {
  const klingElements: KlingElementState[] = [
    {
      id: 'element_1',
      frontal: {
        id: 'frontal',
        previewUrl: 'https://cdn.example.com/frontal.jpg',
        kind: 'image',
        name: 'frontal.jpg',
        status: 'ready',
        url: 'https://cdn.example.com/frontal.jpg',
      },
      references: [
        {
          id: 'ref',
          previewUrl: 'https://cdn.example.com/kling-ref.jpg',
          kind: 'image',
          name: 'ref.jpg',
          status: 'ready',
          url: 'https://cdn.example.com/kling-ref.jpg',
        },
        null,
      ],
      video: null,
    },
    {
      id: 'element_2',
      frontal: null,
      references: [null],
      video: {
        id: 'video',
        previewUrl: 'https://cdn.example.com/kling-video.mp4',
        kind: 'video',
        name: 'video.mp4',
        status: 'ready',
        url: 'https://cdn.example.com/kling-video.mp4',
      },
    },
  ];
  const scenes: MultiPromptScene[] = [
    { id: 'scene_1', prompt: ' Wide shot ', duration: 4.4 },
    { id: 'scene_2', prompt: '', duration: 5 },
    { id: 'scene_3', prompt: 'Close-up', duration: 6.6 },
  ];

  const result = prepareGenerationInputs({
    selectedEngineId: 'kling-3',
    activeMode: 'i2v',
    submissionMode: 'i2v',
    form: baseForm({ engineId: 'kling-3', mode: 'i2v' }),
    inputSchema: { required: [], optional: [] },
    inputSchemaSummary: { assetFields: [] },
    extraInputFields: [],
    inputAssets: {},
    primaryAssetFieldIds: new Set(),
    referenceAssetFieldIds: new Set(),
    genericImageFieldIds: new Set(),
    frameAssetFieldIds: new Set(),
    referenceAudioFieldIds: new Set(),
    supportsKlingV3Controls: true,
    klingElements,
    multiPromptActive: true,
    multiPromptScenes: scenes,
  });

  assertReady(result);
  assert.deepEqual(result.klingElementsPayload, [
    {
      frontalImageUrl: 'https://cdn.example.com/frontal.jpg',
      referenceImageUrls: ['https://cdn.example.com/kling-ref.jpg'],
      videoUrl: undefined,
    },
    {
      frontalImageUrl: undefined,
      referenceImageUrls: undefined,
      videoUrl: 'https://cdn.example.com/kling-video.mp4',
    },
  ]);
  assert.deepEqual(result.multiPromptPayload, [
    { prompt: 'Wide shot', duration: 4 },
    { prompt: 'Close-up', duration: 7 },
  ]);
});
