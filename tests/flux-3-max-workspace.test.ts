import assert from 'node:assert/strict';
import test from 'node:test';
import React, { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { getFalEngineById } from '../frontend/src/config/falEngines';
import { coerceFormState, getEngineModeLabel } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-engine-helpers';
import { summarizeWorkspaceInputSchema } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-input-schema';
import { prepareGenerationInputs } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-generation-inputs';
import type { FormState } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-form-state';
import type { ReferenceAsset } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-assets';
import { LumaRay32KeyframeEditor } from '../frontend/app/(core)/(workspace)/app/_components/LumaRay32KeyframeEditor';
import { resolveWorkspaceWorkflow } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-workflow-projection';

const engine = getFalEngineById('flux-3-max')!.engine;
function summary(activeMode: 't2v' | 'ref2v', uiLocale = 'en') {
  return summarizeWorkspaceInputSchema({ selectedEngine: engine, activeMode, uiLocale,
    allowsUnifiedVeoFirstLast: false, isUnifiedHappyHorse: false, isUnifiedSeedance: false, isUnifiedGeminiOmni: false });
}
test('Max workspace defaults audio on and auto framing and infers opening/final-frame modes', () => {
  const form = coerceFormState(engine, 't2v', null);
  assert.equal(form.durationSec, 5);
  assert.equal(form.resolution, '720p');
  assert.equal(form.aspectRatio, 'auto');
  assert.equal(form.audio, true);
  const asset = (fieldId: string): ReferenceAsset => ({ id: fieldId, fieldId, kind: 'image', name: 'frame.png', type: 'image/png', size: 1,
    previewUrl: `https://media.example/${fieldId}.png`, url: `https://media.example/${fieldId}.png`, status: 'ready' });
  const workflow = resolveWorkspaceWorkflow({ engine, form, inputAssets: {}, klingElements: [] });
  const inputs = summarizeWorkspaceInputSchema({ selectedEngine: engine, activeMode: workflow.activeMode, allowsUnifiedVeoFirstLast: workflow.allowsUnifiedVeoFirstLast,
    isUnifiedHappyHorse: false, isUnifiedSeedance: false, isUnifiedGeminiOmni: false, uiLocale: 'en' });
  assert.deepEqual(inputs.assetFields.map(({ field }) => field.id), ['start_image_url', 'end_image_url']);
  const opening = { start_image_url: [asset('start_image_url')] };
  assert.equal(resolveWorkspaceWorkflow({ engine, form, inputAssets: opening, klingElements: [] }).submissionMode, 'i2v');
  assert.equal(resolveWorkspaceWorkflow({ engine, form, inputAssets: { ...opening, end_image_url: [asset('end_image_url')] }, klingElements: [] }).submissionMode, 'fl2v');
});
test('Max workspace identifies keyframes clearly and localizes its controls', () => {
  for (const [locale, label] of [['en', 'Keyframes'], ['fr', 'Images clés'], ['es', 'Fotogramas clave']]) {
    assert.equal(getEngineModeLabel(engine.id, 'ref2v', locale), label);
  }
  const french = summary('ref2v', 'fr');
  assert.equal(french.assetFields.find(({ field }) => field.id === 'reference_image_urls')?.field.label, 'Images clés');
  assert.equal(french.secondaryFields.find(({ field }) => field.id === 'reasoning_level')?.field.label, 'Niveau de raisonnement');
  const opening = summary('t2v');
  assert.ok(opening.assetFields.some(({ field }) => field.id === 'image_url'));
  assert.ok(opening.assetFields.some(({ field }) => field.id === 'end_image_url'));
});

test('Max keyframe editor renders without a video source and uses the full inclusive 20-second timeline', () => {
  Object.assign(globalThis, { React });
  const form: FormState = { engineId: engine.id, mode: 'ref2v', durationSec: 20, durationOption: '20', resolution: '720p', aspectRatio: 'auto', fps: 30,
    iterations: 1, seedLocked: false, loop: false, audio: true, extraInputValues: {} };
  const markup = renderToStaticMarkup(createElement(LumaRay32KeyframeEditor, {
    engine, form, setForm: () => undefined, assetFields: summary('ref2v').assetFields, inputAssets: {},
    onAssetAdd: () => undefined, onAssetRemove: () => undefined, onOpenLibrary: () => undefined, onNotice: () => undefined, uiLocale: 'fr',
  }));
  assert.match(markup, /FLUX 3 Max · Images clés/);
  assert.match(markup, /20s @ 24fps/);
  assert.match(markup, /f0-f480/);
  assert.match(markup, /10 max/);
  assert.doesNotMatch(markup, /Ray 3.2 Modify/);
  assert.match(markup, /Ajouter une image clé/);
  assert.equal(resolveWorkspaceWorkflow({ engine, form, inputAssets: {}, klingElements: [] }).submissionMode, 'ref2v');
});

test('Max workspace submits ordered populated timeline slots and keeps only schema settings', () => {
  const makeAsset = (name: string): ReferenceAsset => ({ id: name, fieldId: 'reference_image_urls', previewUrl: `https://media.example/${name}.png`,
    url: `https://media.example/${name}.png`, kind: 'image', name, size: 100, type: 'image/png', status: 'ready' });
  const form: FormState = { engineId: engine.id, mode: 'ref2v', durationSec: 20, durationOption: '20', resolution: '1080p', aspectRatio: '2:1', fps: 24,
    iterations: 1, seedLocked: false, loop: false, audio: false, extraInputValues: { reasoning_level: 'low', keyframe_indexes: '480,0', keyframe_slot_indexes: '0:480,2:0' } };
  const schemaSummary = summary('ref2v');
  const prepared = prepareGenerationInputs({ selectedEngineId: engine.id, selectedEngineLabel: engine.label, activeMode: 'ref2v', submissionMode: 'ref2v',
    form, inputSchema: engine.inputSchema, inputSchemaSummary: schemaSummary,
    extraInputFields: [...schemaSummary.secondaryFields, ...schemaSummary.promotedFields],
    inputAssets: { reference_image_urls: [makeAsset('z'), null, makeAsset('a')] },
    primaryAssetFieldIds: new Set(), referenceAssetFieldIds: new Set(['reference_image_urls']), genericImageFieldIds: new Set(['reference_image_urls']),
    frameAssetFieldIds: new Set(), referenceAudioFieldIds: new Set(), supportsKlingV3Controls: false, klingElements: [], multiPromptActive: false, multiPromptScenes: [] });
  assert.equal(prepared.ok, true);
  if (!prepared.ok) return;
  assert.deepEqual(prepared.referenceImageUrls, ['https://media.example/z.png', 'https://media.example/a.png']);
  assert.equal(prepared.extraInputValues.keyframe_indexes, '480,0');
  assert.equal(prepared.extraInputValues.reasoning_level, 'low');
  assert.equal(prepared.extraInputValues.keyframe_slot_indexes, undefined);
});
