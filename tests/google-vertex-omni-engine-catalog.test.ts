import assert from 'node:assert/strict';
import test from 'node:test';

import { getModelFamilyDefinition } from '../frontend/config/model-families';
import { listFalEngines } from '../frontend/src/config/falEngines';
import { getBaseEngines } from '../frontend/src/lib/engines';
import { summarizeWorkspaceInputSchema } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-input-schema';
import { prepareGenerationInputs } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-generation-inputs';
import type { FormState } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-form-state';

test('Gemini Omni Flash 1.1 is exposed as a publication-gated Vertex-backed Google video engine', () => {
  const entry = listFalEngines().find((candidate) => candidate.id === 'gemini-omni-flash');
  assert.ok(entry, 'Gemini Omni Flash catalog entry should exist');
  assert.equal(entry.marketingName, 'Gemini Omni Flash 1.1');
  assert.equal(entry.engine.label, 'Gemini Omni Flash 1.1');
  assert.equal(entry.provider, 'Google');
  assert.equal(entry.family, 'veo');
  assert.equal(entry.defaultFalModelId, 'gemini-omni-1.1-flash-preview');
  assert.equal(entry.engine.providerMeta?.provider, 'google_vertex_omni');
  assert.equal(entry.engine.providerMeta?.modelSlug, 'gemini-omni-1.1-flash-preview');
  assert.equal(entry.versionLabel, '1.1 Preview');
  assert.equal(entry.availability, 'limited');
  assert.equal(entry.engine.inputLimits?.imageMaxMB, 30);
  assert.equal(entry.engine.inputSchema?.constraints?.maxImageSizeMB, 30);
  assert.deepEqual(entry.engine.modes, ['t2v', 'i2v', 'ref2v', 'fl2v', 'v2v', 'extend', 'retake']);
  assert.deepEqual(entry.engine.aspectRatios, ['16:9', '9:16']);
  assert.deepEqual(entry.engine.resolutions, ['360p', '720p', '1080p', '4k']);
  assert.equal(entry.engine.extend, true);

  const allFields = [
    ...(entry.engine.inputSchema?.required ?? []),
    ...(entry.engine.inputSchema?.optional ?? []),
  ];
  const fieldById = new Map(allFields.map((field) => [field.id, field]));
  assert.deepEqual(fieldById.get('duration')?.values, ['3s', '4s', '5s', '6s', '7s', '8s', '9s', '10s']);
  assert.deepEqual(fieldById.get('resolution')?.values, ['360p', '720p', '1080p', '4k']);
  assert.deepEqual(fieldById.get('end_image_url')?.requiredInModes, ['fl2v']);
  assert.deepEqual(fieldById.get('video_url')?.requiredInModes, ['v2v', 'extend']);
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

test('Gemini Omni Flash catalog keeps unsupported Veo/Fal-only controls out of the schema', () => {
  const engine = getBaseEngines().find((candidate) => candidate.id === 'gemini-omni-flash');
  assert.ok(engine, 'Gemini Omni Flash should be available in the app engine list');

  const allFieldIds = [
    ...(engine.inputSchema?.required ?? []),
    ...(engine.inputSchema?.optional ?? []),
  ].map((field) => field.id);
  assert.equal(allFieldIds.includes('negative_prompt'), false);
  assert.equal(allFieldIds.includes('seed'), false);
  assert.equal(allFieldIds.includes('end_image_url'), true);
  assert.equal(allFieldIds.includes('audio_url'), false);
  assert.equal(allFieldIds.includes('store_interaction'), false);
  assert.equal(allFieldIds.includes('previous_interaction_id'), true);
  assert.equal(allFieldIds.includes('prompt_audio_direction'), true);
  assert.equal(allFieldIds.includes('prompt_camera_direction'), true);
  assert.equal(allFieldIds.includes('prompt_edit_instruction'), true);
  const fieldById = new Map([...(engine.inputSchema?.required ?? []), ...(engine.inputSchema?.optional ?? [])].map((field) => [field.id, field]));
  assert.equal(fieldById.get('prompt_audio_direction')?.type, 'enum');
  assert.deepEqual(fieldById.get('prompt_audio_direction')?.values, []);
  assert.equal(fieldById.get('prompt_camera_direction')?.type, 'enum');
  assert.deepEqual(fieldById.get('prompt_camera_direction')?.values, []);
  assert.equal(fieldById.get('prompt_edit_instruction')?.type, 'enum');
  assert.deepEqual(fieldById.get('prompt_edit_instruction')?.values, []);
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
    isUnifiedGeminiOmni: true,
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
    previous_interaction_id: 'interactions/abc123',
    prompt_audio_direction: 'soft cafe ambience',
    prompt_camera_direction: 'slow dolly in',
    prompt_edit_instruction: 'tighten the product reveal',
  });
});
