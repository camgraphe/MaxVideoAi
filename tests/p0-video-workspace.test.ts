import assert from 'node:assert/strict';
import test from 'node:test';

import { listFalEngines } from '../frontend/src/config/falEngines';
import { summarizeWorkspaceInputSchema } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-input-schema';
import { prepareGenerationInputs } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-generation-inputs';
import { getGenerationIterationGuardMessage } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-generation-guards';
import { buildWorkspaceGeneratePayload } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-generation-payload';
import type { ReferenceAsset } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-assets';
import type { FormState } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-form-state';

test('FLUX first/last fields are visible from the default workspace mode for automatic fl2v', () => {
  for (const engineId of ['flux-3', 'flux-3-draft']) {
    const entry = listFalEngines().find((candidate) => candidate.id === engineId);
    assert.ok(entry);
    const schema = summarizeWorkspaceInputSchema({
      selectedEngine: entry.engine,
      activeMode: 't2v',
      allowsUnifiedVeoFirstLast: true,
      isUnifiedHappyHorse: false,
      isUnifiedSeedance: false,
      isUnifiedGeminiOmni: false,
      uiLocale: 'en',
    });
    assert.deepEqual(
      schema.assetFields.map(({ field }) => field.id),
      ['start_image_url', 'end_image_url'],
      engineId,
    );
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
  const asset = (id: string, fieldId: string): ReferenceAsset => ({
    id, fieldId, name: `${id}.png`, kind: 'image', type: 'image/png', size: 1,
    previewUrl: `https://cdn.example.com/${id}.png`, url: `https://cdn.example.com/${id}.png`,
    assetId: id, status: 'ready',
  });

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
