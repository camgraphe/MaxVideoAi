import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { listFalEngines } from '../frontend/src/config/falEngines';
import { buildFalGenerationRequest } from '../frontend/src/lib/fal-request-body';
import { summarizeWorkspaceInputSchema } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-input-schema';
import { prepareGenerationInputs } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-generation-inputs';
import { getGenerationIterationGuardMessage } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-generation-guards';
import { buildWorkspaceGeneratePayload } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-generation-payload';
import type { ReferenceAsset } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-assets';
import type { FormState } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-form-state';
import { useWorkspaceEngineModeState } from '../frontend/app/(core)/(workspace)/app/_hooks/useWorkspaceEngineModeState';

function renderEngineModeState(
  engine: NonNullable<ReturnType<typeof listFalEngines>[number]>['engine'],
  inputAssets: Record<string, (ReferenceAsset | null)[]>,
) {
  let captured: ReturnType<typeof useWorkspaceEngineModeState> | null = null;
  const form = {
    engineId: engine.id, mode: 't2v', durationSec: 5, durationOption: 5,
    resolution: '720p', aspectRatio: '2:1', fps: 24, iterations: 1,
    seedLocked: false, loop: false, audio: true, extraInputValues: {},
  } as FormState;
  function Harness() {
    captured = useWorkspaceEngineModeState({
      engines: [engine], form, setForm: () => undefined, inputAssets, klingElements: [],
      shotType: 'customize', setShotType: () => undefined, effectiveRequestedEngineToken: null,
      authChecked: true, hydratedForScope: 'test', storageScope: 'test',
      preserveStoredDraftRef: { current: false }, requestedEngineOverrideIdRef: { current: null },
      requestedEngineOverrideTokenRef: { current: null }, requestedModeOverrideRef: { current: null },
      writeStorage: () => undefined, uiLocale: 'en', showNotice: () => undefined,
      workflowCopy: {
        generateVideo: 'Generate video', removeAudioToUnlock: 'Remove audio',
        audioUnsupported: 'Audio unsupported', audioLocked: 'Audio locked',
        audioLockedFallback: 'Audio locked', removeAudioToUseEdit: 'Remove audio',
      },
    });
    return null;
  }
  renderToStaticMarkup(createElement(Harness));
  assert.ok(captured);
  return captured;
}

function imageAsset(id: string, fieldId: string): ReferenceAsset {
  return {
    id, fieldId, name: `${id}.png`, kind: 'image', type: 'image/png', size: 1,
    previewUrl: `https://cdn.example.com/${id}.png`, url: `https://cdn.example.com/${id}.png`,
    assetId: id, status: 'ready',
  };
}

function summarizeFluxWorkspace(
  engine: NonNullable<ReturnType<typeof listFalEngines>[number]>['engine'],
  modeState: ReturnType<typeof useWorkspaceEngineModeState>,
) {
  return summarizeWorkspaceInputSchema({
    selectedEngine: engine,
    activeMode: modeState.activeMode,
    allowsUnifiedVeoFirstLast: modeState.allowsUnifiedVeoFirstLast,
    isUnifiedHappyHorse: false,
    isUnifiedSeedance: false,
    isUnifiedGeminiOmni: false,
    uiLocale: 'en',
  });
}

function prepareFluxWorkspaceInputs(
  engine: NonNullable<ReturnType<typeof listFalEngines>[number]>['engine'],
  modeState: ReturnType<typeof useWorkspaceEngineModeState>,
  inputAssets: Record<string, (ReferenceAsset | null)[]>,
) {
  const summary = summarizeFluxWorkspace(engine, modeState);
  const form = {
    engineId: engine.id, mode: modeState.activeMode, durationSec: 5, durationOption: 5,
    resolution: '720p', aspectRatio: '2:1', fps: 24, iterations: 1,
    seedLocked: false, loop: false, audio: true, extraInputValues: {},
  } as FormState;
  return {
    form,
    summary,
    prepared: prepareGenerationInputs({
      selectedEngineId: engine.id, selectedEngineLabel: engine.label,
      activeMode: modeState.activeMode, submissionMode: modeState.submissionMode,
      form, inputSchema: engine.inputSchema, inputSchemaSummary: summary, extraInputFields: [], inputAssets,
      primaryAssetFieldIds: new Set(summary.assetFields.filter(({ role }) => role === 'primary').map(({ field }) => field.id)),
      referenceAssetFieldIds: new Set(summary.assetFields.filter(({ role }) => role === 'reference').map(({ field }) => field.id)),
      genericImageFieldIds: new Set(summary.assetFields.filter(({ field }) => field.type === 'image').map(({ field }) => field.id)),
      frameAssetFieldIds: new Set(summary.assetFields.filter(({ role }) => role === 'frame').map(({ field }) => field.id)),
      referenceAudioFieldIds: new Set(), supportsKlingV3Controls: false, klingElements: [],
      multiPromptActive: false, multiPromptScenes: [],
    }),
  };
}

test('FLUX automatic frame routing promotes a start-only upload to executable i2v then restores exact fl2v slots', () => {
  for (const engineId of ['flux-3', 'flux-3-draft']) {
    const entry = listFalEngines().find((candidate) => candidate.id === engineId);
    assert.ok(entry);
    const initialState = renderEngineModeState(entry.engine, {});
    assert.equal(initialState.activeMode, 't2v', engineId);
    assert.equal(initialState.submissionMode, 't2v', engineId);
    assert.deepEqual(
      summarizeFluxWorkspace(entry.engine, initialState).assetFields.map(({ field }) => field.id),
      ['start_image_url', 'end_image_url'],
      engineId,
    );

    const startOnly = { start_image_url: [imageAsset('start', 'start_image_url')] };
    const afterStart = renderEngineModeState(entry.engine, startOnly);
    assert.equal(afterStart.activeMode, 'i2v', engineId);
    assert.equal(afterStart.submissionMode, 'i2v', engineId);
    const startPreparation = prepareFluxWorkspaceInputs(entry.engine, afterStart, startOnly);
    const schema = startPreparation.summary;
    assert.deepEqual(
      schema.assetFields.map(({ field }) => field.id),
      ['start_image_url', 'end_image_url'],
      engineId,
    );
    assert.equal(startPreparation.prepared.ok, true, engineId);
    if (!startPreparation.prepared.ok) continue;
    assert.equal(startPreparation.prepared.primaryImageUrl, 'https://cdn.example.com/start.png', engineId);
    assert.deepEqual(
      startPreparation.prepared.inputsPayload?.map(({ slotId, url }) => ({ slotId, url })),
      [{ slotId: 'image_url', url: 'https://cdn.example.com/start.png' }],
      engineId,
    );
    assert.equal(getGenerationIterationGuardMessage({
      selectedEngineId: entry.engine.id, submissionMode: afterStart.submissionMode,
      allowsUnifiedVeoFirstLast: afterStart.allowsUnifiedVeoFirstLast, hasLastFrameInput: false,
      isUnifiedSeedance: false, primaryImageUrl: startPreparation.prepared.primaryImageUrl,
      primaryAudioUrl: startPreparation.prepared.primaryAudioUrl, primaryAssetFieldLabel: 'Start image',
      referenceImageUrls: startPreparation.prepared.referenceImageUrls,
      referenceVideoUrls: startPreparation.prepared.referenceVideoUrls,
      referenceAudioUrls: startPreparation.prepared.referenceAudioUrls,
      inputsPayload: startPreparation.prepared.inputsPayload,
      primaryAttachment: startPreparation.prepared.primaryAttachment,
      extendOrRetakeSourceVideoMessage: 'Add video',
    }), null, engineId);
    const i2vPayload = buildWorkspaceGeneratePayload({
      selectedEngineId: entry.engine.id, activeMode: afterStart.activeMode,
      submissionMode: afterStart.submissionMode, form: startPreparation.form,
      trimmedPrompt: 'P', trimmedNegativePrompt: '', effectiveDurationSec: 5,
      paymentMode: 'wallet', capability: entry.engine.modeCaps?.i2v, inputSchema: entry.engine.inputSchema,
      supportsNegativePrompt: false, supportsAudioToggle: true, isSeedance: false,
      supportsKlingV3Controls: false, supportsKlingV3VoiceControl: false, voiceIds: [],
      voiceControlEnabled: false, shotType: 'customize', localKey: `local-${engineId}-i2v`,
      batchId: `batch-${engineId}-i2v`, iterationIndex: 0, iterationCount: 1, friendlyMessage: 'Generating',
      lumaContext: { isLumaRay2GenerateWorkflow: false, lumaDuration: null, lumaResolution: null },
      inputsPayload: startPreparation.prepared.inputsPayload,
      primaryImageUrl: startPreparation.prepared.primaryImageUrl,
      primaryAudioUrl: startPreparation.prepared.primaryAudioUrl,
      referenceImageUrls: startPreparation.prepared.referenceImageUrls,
      endImageUrl: startPreparation.prepared.endImageUrl,
      extraInputValues: startPreparation.prepared.extraInputValues,
    });
    const i2vModel = engineId === 'flux-3'
      ? 'blackforestlabs/flux-3/image-to-video'
      : 'blackforestlabs/flux-3/image-to-video/draft';
    assert.deepEqual(buildFalGenerationRequest(i2vPayload.payload, i2vModel), {
      model: i2vModel,
      requestBody: {
        prompt: 'P', duration: 5,
        ...(engineId === 'flux-3' ? { resolution: '720p' } : {}),
        aspect_ratio: '2:1', generate_audio: true,
        image_url: 'https://cdn.example.com/start.png',
        metadata: { app_local_key: `local-${engineId}-i2v` },
      },
    }, engineId);

    const withEnd = {
      ...startOnly,
      end_image_url: [imageAsset('end', 'end_image_url')],
    };
    const afterEnd = renderEngineModeState(entry.engine, withEnd);
    assert.equal(afterEnd.activeMode, 'i2v', engineId);
    assert.equal(afterEnd.submissionMode, 'fl2v', engineId);
    const framePreparation = prepareFluxWorkspaceInputs(entry.engine, afterEnd, withEnd);
    assert.equal(framePreparation.prepared.ok, true, engineId);
    if (!framePreparation.prepared.ok) continue;
    assert.equal(getGenerationIterationGuardMessage({
      selectedEngineId: entry.engine.id, submissionMode: afterEnd.submissionMode,
      allowsUnifiedVeoFirstLast: afterEnd.allowsUnifiedVeoFirstLast, hasLastFrameInput: true,
      isUnifiedSeedance: false, primaryImageUrl: framePreparation.prepared.primaryImageUrl,
      primaryAudioUrl: framePreparation.prepared.primaryAudioUrl, primaryAssetFieldLabel: 'Start image',
      referenceImageUrls: framePreparation.prepared.referenceImageUrls,
      referenceVideoUrls: framePreparation.prepared.referenceVideoUrls,
      referenceAudioUrls: framePreparation.prepared.referenceAudioUrls,
      inputsPayload: framePreparation.prepared.inputsPayload,
      primaryAttachment: framePreparation.prepared.primaryAttachment,
      extendOrRetakeSourceVideoMessage: 'Add video',
    }), null, engineId);
    const fl2vPayload = buildWorkspaceGeneratePayload({
      selectedEngineId: entry.engine.id, activeMode: afterEnd.activeMode,
      submissionMode: afterEnd.submissionMode, form: framePreparation.form,
      trimmedPrompt: 'P', trimmedNegativePrompt: '', effectiveDurationSec: 5,
      paymentMode: 'wallet', capability: entry.engine.modeCaps?.fl2v, inputSchema: entry.engine.inputSchema,
      supportsNegativePrompt: false, supportsAudioToggle: true, isSeedance: false,
      supportsKlingV3Controls: false, supportsKlingV3VoiceControl: false, voiceIds: [],
      voiceControlEnabled: false, shotType: 'customize', localKey: `local-${engineId}-fl2v`,
      batchId: `batch-${engineId}-fl2v`, iterationIndex: 0, iterationCount: 1, friendlyMessage: 'Generating',
      lumaContext: { isLumaRay2GenerateWorkflow: false, lumaDuration: null, lumaResolution: null },
      inputsPayload: framePreparation.prepared.inputsPayload,
      primaryImageUrl: framePreparation.prepared.primaryImageUrl,
      primaryAudioUrl: framePreparation.prepared.primaryAudioUrl,
      referenceImageUrls: framePreparation.prepared.referenceImageUrls,
      endImageUrl: framePreparation.prepared.endImageUrl,
      extraInputValues: framePreparation.prepared.extraInputValues,
    });
    const fl2vModel = engineId === 'flux-3'
      ? 'blackforestlabs/flux-3/first-last-frame-to-video'
      : 'blackforestlabs/flux-3/first-last-frame-to-video/draft';
    assert.deepEqual(buildFalGenerationRequest(fl2vPayload.payload, fl2vModel), {
      model: fl2vModel,
      requestBody: {
        prompt: 'P', duration: 5,
        ...(engineId === 'flux-3' ? { resolution: '720p' } : {}),
        aspect_ratio: '2:1', generate_audio: true,
        start_image_url: 'https://cdn.example.com/start.png',
        end_image_url: 'https://cdn.example.com/end.png',
        metadata: { app_local_key: `local-${engineId}-fl2v` },
      },
    }, engineId);

    const normalI2v = renderEngineModeState(entry.engine, {
      image_url: [imageAsset('image', 'image_url')],
    });
    assert.equal(normalI2v.activeMode, 'i2v', engineId);
    const normalSchema = summarizeWorkspaceInputSchema({
      selectedEngine: entry.engine,
      activeMode: normalI2v.activeMode,
      allowsUnifiedVeoFirstLast: normalI2v.allowsUnifiedVeoFirstLast,
      isUnifiedHappyHorse: false,
      isUnifiedSeedance: false,
      isUnifiedGeminiOmni: false,
      uiLocale: 'en',
    });
    assert.deepEqual(normalSchema.assetFields.map(({ field }) => field.id), ['image_url'], engineId);
  }
});

test('FLUX manual and automatic fl2v run preparation, guards, and payload with exact frame slots', () => {
  const engine = listFalEngines().find((candidate) => candidate.id === 'flux-3')?.engine;
  assert.ok(engine);
  const form = {
    engineId: engine.id, mode: 't2v', durationSec: 5, durationOption: 5,
    resolution: '720p', aspectRatio: '2:1', fps: 24, iterations: 1,
    seedLocked: false, loop: false, audio: true, extraInputValues: {},
  } as FormState;
  const asset = imageAsset;

  for (const activeMode of ['t2v', 'fl2v'] as const) {
    const allowsUnifiedVeoFirstLast = activeMode === 't2v';
    const summary = summarizeWorkspaceInputSchema({
      selectedEngine: engine, activeMode, allowsUnifiedVeoFirstLast,
      isUnifiedHappyHorse: false, isUnifiedSeedance: false, isUnifiedGeminiOmni: false,
      uiLocale: 'en',
    });
    const prepared = prepareGenerationInputs({
      selectedEngineId: engine.id, selectedEngineLabel: engine.label, activeMode,
      submissionMode: 'fl2v', form: { ...form, mode: activeMode }, inputSchema: engine.inputSchema,
      inputSchemaSummary: summary, extraInputFields: [],
      inputAssets: {
        start_image_url: [asset('start', 'start_image_url')],
        end_image_url: [asset('end', 'end_image_url')],
      },
      primaryAssetFieldIds: new Set(summary.assetFields.filter(({ role }) => role === 'primary').map(({ field }) => field.id)),
      referenceAssetFieldIds: new Set(summary.assetFields.filter(({ role }) => role === 'reference').map(({ field }) => field.id)),
      genericImageFieldIds: new Set(summary.assetFields.filter(({ field }) => field.type === 'image').map(({ field }) => field.id)),
      frameAssetFieldIds: new Set(summary.assetFields.filter(({ role }) => role === 'frame').map(({ field }) => field.id)),
      referenceAudioFieldIds: new Set(), supportsKlingV3Controls: false, klingElements: [],
      multiPromptActive: false, multiPromptScenes: [],
    });
    assert.equal(prepared.ok, true);
    if (!prepared.ok) continue;
    assert.equal(getGenerationIterationGuardMessage({
      selectedEngineId: engine.id, submissionMode: 'fl2v', allowsUnifiedVeoFirstLast,
      hasLastFrameInput: true, isUnifiedSeedance: false, primaryImageUrl: prepared.primaryImageUrl,
      primaryAudioUrl: prepared.primaryAudioUrl, primaryAssetFieldLabel: 'Start image',
      referenceImageUrls: prepared.referenceImageUrls, referenceVideoUrls: prepared.referenceVideoUrls,
      referenceAudioUrls: prepared.referenceAudioUrls, inputsPayload: prepared.inputsPayload,
      primaryAttachment: prepared.primaryAttachment, extendOrRetakeSourceVideoMessage: 'Add video',
    }), null, activeMode);
    const built = buildWorkspaceGeneratePayload({
      selectedEngineId: engine.id, activeMode, submissionMode: 'fl2v', form: { ...form, mode: activeMode },
      trimmedPrompt: 'P', trimmedNegativePrompt: '', effectiveDurationSec: 5,
      paymentMode: 'wallet', capability: engine.modeCaps?.fl2v, inputSchema: engine.inputSchema,
      supportsNegativePrompt: false, supportsAudioToggle: true, isSeedance: false,
      supportsKlingV3Controls: false, supportsKlingV3VoiceControl: false, voiceIds: [],
      voiceControlEnabled: false, shotType: 'customize', localKey: `local-${activeMode}`,
      batchId: `batch-${activeMode}`, iterationIndex: 0, iterationCount: 1, friendlyMessage: 'Generating',
      lumaContext: { isLumaRay2GenerateWorkflow: false, lumaDuration: null, lumaResolution: null },
      inputsPayload: prepared.inputsPayload, primaryImageUrl: prepared.primaryImageUrl,
      primaryAudioUrl: prepared.primaryAudioUrl, referenceImageUrls: prepared.referenceImageUrls,
      endImageUrl: prepared.endImageUrl, extraInputValues: prepared.extraInputValues,
    });
    assert.deepEqual(built.payload.inputs?.map(({ slotId, url }) => ({ slotId, url })), [
      { slotId: 'start_image_url', url: 'https://cdn.example.com/start.png' },
      { slotId: 'end_image_url', url: 'https://cdn.example.com/end.png' },
    ]);
    assert.equal('imageUrl' in built.payload, false);
    assert.equal('endImageUrl' in built.payload, false);
  }
});
