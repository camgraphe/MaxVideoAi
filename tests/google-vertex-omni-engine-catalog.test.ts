import assert from 'node:assert/strict';
import test from 'node:test';

import { getModelFamilyDefinition } from '../frontend/config/model-families';
import { listFalEngines } from '../frontend/src/config/falEngines';
import { getBaseEngines } from '../frontend/src/lib/engines';
import { summarizeWorkspaceInputSchema } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-input-schema';
import { prepareGenerationInputs } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-generation-inputs';
import type { FormState } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-form-state';

test('Gemini Omni Flash is exposed as a Vertex-backed Google video engine', () => {
  const entry = listFalEngines().find((candidate) => candidate.id === 'gemini-omni-flash');
  assert.ok(entry, 'Gemini Omni Flash catalog entry should exist');
  assert.equal(entry.provider, 'Google');
  assert.equal(entry.family, 'veo');
  assert.equal(entry.defaultFalModelId, 'gemini-omni-flash-preview');
  assert.equal(entry.engine.providerMeta?.provider, 'google_vertex_omni');
  assert.equal(entry.engine.providerMeta?.modelSlug, 'gemini-omni-flash-preview');
  assert.deepEqual(entry.engine.modes, ['t2v', 'i2v', 'ref2v', 'v2v', 'retake']);
  assert.deepEqual(entry.engine.aspectRatios, ['16:9', '9:16']);
  assert.deepEqual(entry.engine.resolutions, ['720p']);
  assert.equal(entry.engine.pricingDetails?.perSecondCents?.default, 10);
  assert.equal(entry.engine.pricingDetails?.perSecondCents?.byResolution?.['720p'], 10);
  assert.equal(entry.engine.pricing?.base, 0.1);
  assert.equal(entry.pricingHint?.amountCents, 100);
});

test('Gemini Omni Flash shares the Veo model family instead of creating a Gemini family', () => {
  const veoFamily = getModelFamilyDefinition('veo');
  assert.ok(veoFamily, 'Veo family should exist');
  assert.equal(getModelFamilyDefinition('gemini'), null);
  assert.ok(veoFamily.routeAliases?.includes('gemini-omni-flash'));
  assert.ok(veoFamily.aliases?.includes('gemini-omni-flash-preview'));
  assert.ok(veoFamily.aliases?.includes('omni-flash'));
  assert.ok(veoFamily.prefixes?.includes('gemini-omni'));
  assert.equal(veoFamily.examplesPage?.publishedModelSlugs?.includes('gemini-omni-flash'), false);
});

test('Gemini Omni Flash catalog keeps Veo/Fal-only controls out of the schema', () => {
  const engine = getBaseEngines().find((candidate) => candidate.id === 'gemini-omni-flash');
  assert.ok(engine, 'Gemini Omni Flash should be available in the app engine list');

  const allFieldIds = [
    ...(engine.inputSchema?.required ?? []),
    ...(engine.inputSchema?.optional ?? []),
  ].map((field) => field.id);
  assert.equal(allFieldIds.includes('negative_prompt'), false);
  assert.equal(allFieldIds.includes('seed'), false);
  assert.equal(allFieldIds.includes('end_image_url'), false);
  assert.equal(allFieldIds.includes('audio_url'), false);
  assert.equal(allFieldIds.includes('store_interaction'), true);
  assert.equal(allFieldIds.includes('previous_interaction_id'), true);
  assert.equal(allFieldIds.includes('prompt_audio_direction'), true);
  assert.equal(allFieldIds.includes('prompt_camera_direction'), true);
  assert.equal(allFieldIds.includes('prompt_edit_instruction'), true);
});

test('Gemini Omni Flash workspace schema preserves Omni extra controls for payload building', () => {
  const engine = getBaseEngines().find((candidate) => candidate.id === 'gemini-omni-flash');
  assert.ok(engine);

  const summary = summarizeWorkspaceInputSchema({
    selectedEngine: engine,
    activeMode: 'retake',
    allowsUnifiedVeoFirstLast: false,
    isUnifiedHappyHorse: false,
    isUnifiedSeedance: false,
    uiLocale: 'en',
  });
  const extraFields = [...summary.promotedFields, ...summary.secondaryFields];
  const extraFieldIds = extraFields.map(({ field }) => field.id);
  assert.ok(extraFieldIds.includes('previous_interaction_id'));
  assert.ok(extraFieldIds.includes('prompt_audio_direction'));
  assert.ok(extraFieldIds.includes('prompt_camera_direction'));
  assert.ok(extraFieldIds.includes('prompt_edit_instruction'));

  const form: FormState = {
    engineId: 'gemini-omni-flash',
    mode: 'retake',
    durationSec: 8,
    resolution: '720p',
    aspectRatio: '16:9',
    fps: 24,
    iterations: 1,
    seedLocked: false,
    loop: false,
    audio: true,
    extraInputValues: {
      previous_interaction_id: 'interactions/abc123',
      prompt_audio_direction: 'soft cafe ambience',
      prompt_camera_direction: 'slow dolly in',
      prompt_edit_instruction: 'tighten the product reveal',
      store_interaction: true,
      unrelated: 'drop me',
    },
  };

  const result = prepareGenerationInputs({
    selectedEngineId: 'gemini-omni-flash',
    activeMode: 'retake',
    submissionMode: 'retake',
    form,
    inputSchema: engine.inputSchema ?? {},
    inputSchemaSummary: summary,
    extraInputFields: extraFields,
    inputAssets: {},
    primaryAssetFieldIds: new Set(),
    referenceAssetFieldIds: new Set(),
    genericImageFieldIds: new Set(),
    frameAssetFieldIds: new Set(),
    referenceAudioFieldIds: new Set(),
    supportsKlingV3Controls: false,
    klingElements: [],
    multiPromptActive: false,
    multiPromptScenes: [],
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.extraInputValues, {
    store_interaction: true,
    previous_interaction_id: 'interactions/abc123',
    prompt_audio_direction: 'soft cafe ambience',
    prompt_camera_direction: 'slow dolly in',
    prompt_edit_instruction: 'tighten the product reveal',
  });
});
