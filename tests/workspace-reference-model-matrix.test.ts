import assert from 'node:assert/strict';
import test from 'node:test';
import { listFalEngines } from '../frontend/src/config/falEngines';
import { getUnifiedSeedanceMode } from '../frontend/lib/seedance-workflow';
import {
  getKlingO3AssetState,
  resolveKlingO3UnifiedMode,
  supportsKlingO3VideoToVideo,
} from '../frontend/app/(core)/(workspace)/app/_lib/kling-o3-unified-workflow';
import { summarizeWorkspaceInputSchema } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-input-schema';
import {
  getWorkspaceReferenceFields,
  type WorkspaceReferenceAvailability,
} from '../frontend/app/(core)/(workspace)/app/_lib/workspace-reference-fields';
import type { ReferenceAsset } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-assets';
import type { EngineCaps, EngineInputField, Mode } from '../frontend/types/engines';

const image: ReferenceAsset = { id: 'image', kind: 'image', name: 'image.png', type: 'image/png', size: 1, previewUrl: '/image.png' };
const video: ReferenceAsset = { id: 'video', kind: 'video', name: 'video.mp4', type: 'video/mp4', size: 1, previewUrl: '/video.mp4' };
const audio: ReferenceAsset = { id: 'audio', kind: 'audio', name: 'audio.wav', type: 'audio/wav', size: 1, previewUrl: '/audio.wav' };

function engine(id: string): EngineCaps {
  const value = listFalEngines().find((entry) => entry.id === id)?.engine;
  assert.ok(value, `missing runtime engine ${id}`);
  return value;
}

function schemaFields(value: EngineCaps): EngineInputField[] {
  return [...(value.inputSchema?.required ?? []), ...(value.inputSchema?.optional ?? [])];
}

function summary(value: EngineCaps, activeMode: Mode, options: Partial<Parameters<typeof summarizeWorkspaceInputSchema>[0]> = {}) {
  return summarizeWorkspaceInputSchema({
    selectedEngine: value,
    activeMode,
    allowsUnifiedVeoFirstLast: false,
    isUnifiedHappyHorse: false,
    isUnifiedSeedance: false,
    isUnifiedGeminiOmni: false,
    uiLocale: 'en',
    ...options,
  });
}

function referenceOptions(inputAssets: Record<string, (ReferenceAsset | null)[]> = {}): WorkspaceReferenceAvailability {
  return {
    inputAssets,
    isUnifiedSeedance: false,
    isUnifiedKlingO3: false,
    klingO3VideoToVideoSupported: true,
    hasAnyVideoInput: false,
    guestUploadLockedReason: null,
    workflowCopy: { clearReferencesToUseStartEnd: 'clear references', clearStartEndToUseReferences: 'clear frames' },
    showOmniStudioPanel: false,
    showLumaRay32KeyframeEditor: false,
  };
}

function assertExactFieldOwners(value: EngineCaps, fields: ReturnType<typeof summary>['assetFields']) {
  const realFields = schemaFields(value);
  for (const entry of fields) {
    assert.equal(entry.field, realFields.find((field) => field.id === entry.field.id), `${value.id}:${entry.field.id} keeps the runtime field object`);
  }
}

test('unified Seedance variants expose their real cross-mode fields and delegate workflow choice', () => {
  for (const id of ['seedance-2-5', 'seedance-2-0', 'seedance-2-0-fast', 'seedance-2-0-mini']) {
    const value = engine(id);
    const fields = summary(value, 't2v', { isUnifiedSeedance: true }).assetFields;
    assert.deepEqual(fields.map(({ field }) => field.id), [
      'image_url', 'end_image_url', 'video_url', 'image_urls', 'video_urls', 'audio_urls',
    ], id);
    assertExactFieldOwners(value, fields);
    for (const [assets, mode] of [
      [{}, 't2v'],
      [{ image_url: [image] }, 'i2v'],
      [{ end_image_url: [image] }, 'i2v'],
      [{ image_urls: [image] }, 'ref2v'],
      [{ video_urls: [video] }, 'ref2v'],
      [{ audio_urls: [audio] }, 'ref2v'],
      [{ video_url: [video] }, 'v2v'],
    ] as const) assert.equal(getUnifiedSeedanceMode(assets), mode, `${id}:${mode}`);
    const budget = value.inputSchema?.referenceBudget;
    if (id === 'seedance-2-5') {
      assert.deepEqual(budget, {
        fieldIds: ['image_url', 'end_image_url', 'image_urls', 'video_url', 'video_urls', 'extension_source_videos', 'audio_urls'],
        maxTotal: 50,
        countUniqueUrls: true,
        modes: ['i2v', 'ref2v', 'v2v', 'extend'],
      });
    } else {
      assert.equal(budget, undefined, `${id} does not inherit Seedance 2.5's budget`);
    }
  }
});

test('Seedance compatibility is directional and does not invent a universal start/reference exclusion', () => {
  const fields = summary(engine('seedance-2-0'), 't2v', { isUnifiedSeedance: true }).assetFields;
  const empty = getWorkspaceReferenceFields(fields, { ...referenceOptions(), isUnifiedSeedance: true });
  assert.ok(empty.every((entry) => !entry.disabled));
  const withStart = getWorkspaceReferenceFields(fields, { ...referenceOptions({ image_url: [image] }), isUnifiedSeedance: true });
  assert.equal(withStart.find(({ field }) => field.id === 'image_url')?.disabled, false);
  assert.ok(withStart.filter(({ field }) => ['image_urls', 'video_url', 'video_urls', 'audio_urls'].includes(field.id)).every((entry) => entry.disabled));
  const withReference = getWorkspaceReferenceFields(fields, { ...referenceOptions({ image_urls: [image] }), isUnifiedSeedance: true });
  assert.equal(withReference.find(({ field }) => field.id === 'image_urls')?.disabled, false);
  assert.equal(withReference.find(({ field }) => field.id === 'image_url')?.disabled, true);
  assert.equal(withReference.find(({ field }) => field.id === 'end_image_url')?.disabled, true);
  assert.ok(withReference.filter(({ field }) => ['video_url', 'video_urls', 'audio_urls'].includes(field.id)).every((entry) => !entry.disabled));
});

test('Kling O3 keeps supported reference and frame combinations while source video locks only frames', () => {
  for (const id of ['kling-o3-standard', 'kling-o3-pro']) {
    const value = engine(id);
    assert.equal(supportsKlingO3VideoToVideo(value), true);
    const fields = summary(value, 't2v').assetFields;
    assert.deepEqual(fields.map(({ field }) => field.id), ['image_urls', 'image_url', 'end_image_url', 'video_url']);
    assertExactFieldOwners(value, fields);
    const combinedAssets = { image_urls: [image], image_url: [image], end_image_url: [image] };
    const combined = getWorkspaceReferenceFields(fields, {
      ...referenceOptions(combinedAssets), isUnifiedKlingO3: true,
    });
    assert.ok(combined.every((entry) => !entry.disabled));
    assert.equal(resolveKlingO3UnifiedMode({ engine: value, inputAssets: combinedAssets, klingElements: [] }), 'ref2v');
    const videoState = getKlingO3AssetState({ inputAssets: { video_url: [video] }, klingElements: [] });
    const videoFields = getWorkspaceReferenceFields(fields, {
      ...referenceOptions({ video_url: [video] }), isUnifiedKlingO3: true, hasAnyVideoInput: videoState.hasAnyVideoInput,
    });
    assert.ok(videoFields.filter(({ field }) => ['image_url', 'end_image_url'].includes(field.id)).every((entry) => entry.disabled));
    assert.ok(videoFields.filter(({ field }) => ['image_urls', 'video_url'].includes(field.id)).every((entry) => !entry.disabled));
    assert.equal(resolveKlingO3UnifiedMode({ engine: value, inputAssets: { video_url: [video] }, klingElements: [] }), 'v2v');
  }
  const fourK = engine('kling-o3-4k');
  assert.equal(supportsKlingO3VideoToVideo(fourK), false);
  assert.deepEqual(summary(fourK, 't2v').assetFields.map(({ field }) => field.id), ['image_urls', 'image_url', 'end_image_url']);
});

test('Veo exposes first/last controls in unified mode and reference fields only in reference mode', () => {
  const value = engine('veo-3-1');
  const unified = summary(value, 't2v', { allowsUnifiedVeoFirstLast: true }).assetFields;
  assert.deepEqual(unified.map(({ field }) => field.id), ['image_url', 'last_frame_url']);
  assertExactFieldOwners(value, unified);
  const references = summary(value, 'ref2v').assetFields;
  assert.deepEqual(references.map(({ field }) => field.id), ['image_urls']);
  assert.equal(references[0].required, true);
  assertExactFieldOwners(value, references);
});

test('Happy Horse and Omni expose shared references while Luma keeps its editor', () => {
  const happyHorse = engine('happy-horse-1-1');
  const horseFields = summary(happyHorse, 't2v', { isUnifiedHappyHorse: true }).assetFields;
  assert.deepEqual(horseFields.map(({ field }) => [field.id, field.maxCount]), [['image_url', 1], ['image_urls', 9]]);
  assertExactFieldOwners(happyHorse, horseFields);

  const omni = engine('gemini-omni-flash');
  const omniFields = summary(omni, 't2v', { isUnifiedGeminiOmni: true }).assetFields;
  assert.deepEqual(omniFields.map(({ field }) => field.id), ['image_url', 'reference_images', 'video_url']);
  const sharedOmni = getWorkspaceReferenceFields(omniFields, { ...referenceOptions(), showOmniStudioPanel: true });
  assert.deepEqual(sharedOmni.map(({ field }) => field.id), ['image_url', 'reference_images', 'video_url']);
  assert.ok(sharedOmni.every((entry) => !entry.disabled));
  for (const [fieldId, media] of [['image_url', image], ['reference_images', image], ['video_url', video]] as const) {
    const selected = getWorkspaceReferenceFields(omniFields, { ...referenceOptions({ [fieldId]: [media] }), showOmniStudioPanel: true });
    assert.deepEqual(selected.filter((entry) => !entry.disabled).map(({ field }) => field.id), [fieldId]);
  }
  const refining = getWorkspaceReferenceFields(omniFields, { ...referenceOptions(), showOmniStudioPanel: true, previousInteractionId: 'interactions/test' });
  assert.ok(refining.every((entry) => entry.disabled && /previous interaction/i.test(entry.disabledReason ?? '')));
  const guest = getWorkspaceReferenceFields(omniFields, { ...referenceOptions(), showOmniStudioPanel: true, guestUploadLockedReason: 'Sign in' });
  assert.ok(guest.every((entry) => entry.disabled && entry.disabledPresentation === 'auth-lock'));

  const luma = engine('luma-ray-3-2');
  const modifyFields = summary(luma, 'v2v').assetFields;
  assert.deepEqual(modifyFields.map(({ field }) => field.id), ['video_url', 'start_image_url', 'edit_keyframe_urls']);
  assert.equal(getWorkspaceReferenceFields(modifyFields, { ...referenceOptions(), showLumaRay32KeyframeEditor: true }).length, 0);
  const imageFields = summary(luma, 'i2v').assetFields;
  assert.deepEqual(imageFields.map(({ field }) => field.id), ['image_url', 'end_image_url']);
  assertExactFieldOwners(luma, imageFields);
});

test('required audio and image source/mask fields retain exact schema identity and requirement state', () => {
  const ltx = engine('ltx-2-3');
  const audioFields = summary(ltx, 'a2v').assetFields;
  assert.deepEqual(audioFields.map(({ field, required }) => [field.id, required]), [['audio_url', true], ['image_url', false]]);
  assert.deepEqual(audioFields.map(({ field }) => [field.type, field.minCount, field.maxCount, field.modes]), [
    ['audio', 1, 1, ['a2v']],
    ['image', 1, 1, ['a2v']],
  ]);

  const gptImage = engine('gpt-image-2');
  const editFields = summary(gptImage, 'i2i').assetFields;
  assert.deepEqual(editFields.map(({ field, required }) => [field.id, required]), [['image_urls', true], ['mask_url', false]]);
  assertExactFieldOwners(gptImage, editFields);
});
