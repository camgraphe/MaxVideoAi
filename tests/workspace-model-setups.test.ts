import assert from 'node:assert/strict';
import test from 'node:test';
import { listFalEngines } from '../frontend/src/config/falEngines';
import { coerceFormState } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-engine-helpers';
import {
  serializeWorkspaceModelSetup,
  parseWorkspaceModelSetup,
  encodeWorkspaceModelSetups,
  decodeWorkspaceModelSetups,
  MAX_WORKSPACE_MODEL_SETUP_BYTES,
} from '../frontend/app/(core)/(workspace)/app/_lib/workspace-model-setups';
import type { WorkspaceModelSetup } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-model-candidate';
import { getBaseEnginesByCategory } from '../frontend/src/lib/engines';
import { buildInitialWorkspaceFormState } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-hydration';
import { parseStoredForm } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-form-state';
export function fixtureSetup(): WorkspaceModelSetup {
  const engine = listFalEngines().find((e) => e.id === 'seedance-2-0')!.engine;
  return {
    form: coerceFormState(engine, 't2v', null),
    prompt: 'A cinematic scene',
    negativePrompt: '',
    inputAssets: {},
    klingElements: [],
    multiPromptEnabled: false,
    multiPromptScenes: [],
    shotType: 'customize',
    voiceIdsInput: '',
    cfgScale: null,
  };
}
test('ready originals normalize temporary previews and snapshot arrays are isolated', () => {
  const setup = fixtureSetup();
  setup.inputAssets.image_url = [
    {
      id: 'a',
      fieldId: 'image_url',
      url: 'https://example.com/a',
      previewUrl: 'blob:temporary',
      name: 'a',
      kind: 'image',
      status: 'ready',
      type: 'image/png',
      size: 12,
    },
  ];
  const saved = serializeWorkspaceModelSetup(setup);
  assert.equal(saved.ok, true);
  if (!saved.ok) return;
  assert.equal(saved.setup.inputAssets.image_url[0]!.previewUrl, 'https://example.com/a');
  assert.equal(setup.inputAssets.image_url[0]!.previewUrl, 'blob:temporary');
  setup.form.extraInputValues.changed = ['later'];
  assert.deepEqual(saved.setup.form.extraInputValues, {});
  assert.deepEqual(parseWorkspaceModelSetup(saved.setup), saved.setup);
});
test('saved setups retain each explicit video operation without changing legacy Reference identity', () => {
  for (const { engine } of listFalEngines()) for (const operation of Object.values(engine.operationCaps ?? {})) {
    if (!operation) continue;
    const setup = fixtureSetup();
    setup.form = { ...coerceFormState(engine, operation.mode, null), operation: operation.operation };
    const saved = serializeWorkspaceModelSetup(setup);
    assert.ok(saved.ok, `${engine.id}/${operation.operation}`);
    assert.equal(saved.setup.form.operation, operation.operation, `${engine.id}/${operation.operation}`);
    assert.equal(parseWorkspaceModelSetup(saved.setup)?.form.operation, operation.operation);
  }
  const legacy = fixtureSetup();
  legacy.form = coerceFormState(listFalEngines().find(e => e.id === 'kling-o3-pro')!.engine, 'v2v', null);
  const saved = serializeWorkspaceModelSetup(legacy);
  assert.ok(saved.ok);
  assert.equal(Object.hasOwn(saved.setup.form, 'operation'), false, 'omitted Reference stays omitted');
});
test('invalid or cross-model operations cannot enter saved setups', () => {
  for (const operation of ['kling-edit', 'unknown', null]) {
    const setup = fixtureSetup();
    Object.assign(setup.form, { operation });
    assert.deepEqual(serializeWorkspaceModelSetup(setup), { ok: false, error: 'invalid' });
  }
});
test('every public video model preserves its selected Create, Modify and Extend settings through both draft formats', () => {
  for (const engine of getBaseEnginesByCategory('video')) for (const mode of engine.modes) {
    const setup = fixtureSetup();
    setup.form = coerceFormState(engine, mode, null);
    setup.form.extraInputValues = { remembered: 'authored setting', draft_mode: true };
    const saved = serializeWorkspaceModelSetup(setup);
    assert.ok(saved.ok, `${engine.id}/${mode}: active draft`);
    assert.deepEqual(saved.setup.form, JSON.parse(JSON.stringify(setup.form)), `${engine.id}/${mode}: active draft preserves all fields`);
    const restored = buildInitialWorkspaceFormState({ engines: [engine], storedFormRaw: parseStoredForm(JSON.stringify(setup.form)),
      effectiveRequestedEngineId: null, effectiveRequestedEngineToken: '', effectiveRequestedMode: null });
    assert.deepEqual(restored.form, setup.form, `${engine.id}/${mode}: legacy reload preserves all fields`);
  }
});
test('incomplete and oversized setups refuse serialization without dropping references', () => {
  const setup = fixtureSetup();
  setup.inputAssets.image_url = [
    {
      id: 'a',
      fieldId: 'image_url',
      previewUrl: 'blob:temporary',
      name: 'a',
      kind: 'image',
      status: 'uploading',
      type: 'image/png',
      size: 12,
    },
  ];
  assert.equal(serializeWorkspaceModelSetup(setup).ok, false);
  setup.inputAssets = {};
  setup.prompt = 'x'.repeat(MAX_WORKSPACE_MODEL_SETUP_BYTES);
  assert.equal(serializeWorkspaceModelSetup(setup).ok, false);
  assert.equal(parseWorkspaceModelSetup({ form: setup.form }), null);
});
test('store rejects account mismatch, preserves malformed entry for removal, and bounds records', () => {
  const saved = serializeWorkspaceModelSetup(fixtureSetup());
  assert.ok(saved.ok);
  if (!saved.ok) return;
  const entries = {
    'seedance-2-0': { modelId: 'seedance-2-0', updatedAt: 123, setup: saved.setup },
    broken: { nonsense: true },
  };
  const encoded = encodeWorkspaceModelSetups('account-a', entries);
  assert.ok(encoded.ok);
  if (!encoded.ok) return;
  assert.equal(decodeWorkspaceModelSetups(encoded.value, 'account-b').error, 'invalid');
  assert.equal(decodeWorkspaceModelSetups(encoded.value, 'account-a').entries.broken.nonsense, true);
  assert.equal(
    decodeWorkspaceModelSetups('x'.repeat(MAX_WORKSPACE_MODEL_SETUP_BYTES + 1), 'account-a').error,
    'oversized',
  );
});

test('all workspace modes and complete scene/subject values are validated without losing settings', () => {
  for (const mode of ['fl2v', 'reframe', 'retake'] as const) {
    const setup = fixtureSetup();
    setup.form.mode = mode;
    setup.multiPromptScenes = [{ id: 'scene', prompt: 'Scene text', duration: 3 }];
    setup.form.extraInputValues = { custom: [1, 'preserved', true, null] };
    assert.ok(serializeWorkspaceModelSetup(setup).ok);
  }
  const invalid = fixtureSetup();
  invalid.form.extraInputValues = { access_token: 'must-never-persist' };
  assert.equal(serializeWorkspaceModelSetup(invalid).ok, false);
  invalid.form.extraInputValues = { nested: new Date() };
  assert.equal(serializeWorkspaceModelSetup(invalid).ok, false);
  const subject = {
    id: 'frontal',
    name: 'face',
    kind: 'image' as const,
    status: 'ready' as const,
    url: 'https://example.com/front',
    previewUrl: 'blob:front',
  };
  const setup = fixtureSetup();
  setup.klingElements = [
    { id: 'subject', frontal: subject, references: [null, { ...subject, id: 'side' }], video: null },
  ];
  const result = serializeWorkspaceModelSetup(setup);
  assert.ok(result.ok);
  if (result.ok) {
    assert.equal(result.setup.klingElements[0].frontal!.previewUrl, subject.url);
    assert.equal(result.setup.klingElements[0].references[0], null);
  }
});


test('reference snapshots reject unsafe original excerpt metadata without storing partial recipes', () => {
  const setup=fixtureSetup();
  const source={id:'excerpt',assetId:'excerpt',fieldId:'video_url',kind:'video' as const,name:'Excerpt',type:'video/mp4',size:12,status:'ready' as const,url:'https://example.com/excerpt',previewUrl:'https://example.com/excerpt',durationSec:4,
    ref:{type:'asset' as const,assetId:'excerpt',kind:'video' as const},
    excerptSource:{id:'original',ref:{type:'job-output' as const,jobId:'owned-job',outputId:'owned-output',kind:'video' as const},name:'Original',type:'video/mp4',size:24,url:'https://example.com/original',previewUrl:'blob:temporary',durationSec:12},
    excerptRange:{startSec:2,endSec:6}};
  for(const patch of [
    {excerptRange:{startSec:-1,endSec:6}},
    {excerptRange:{startSec:2,endSec:13}},
    {excerptSource:{...source.excerptSource,url:'javascript:unsafe'}},
    {excerptSource:{...source.excerptSource,ref:{...source.excerptSource.ref,access_token:'must-not-persist'}}},
    {excerptEditing:true},
  ]) {
    setup.inputAssets={video_url:[{...source,...patch} as any]};
    assert.equal(serializeWorkspaceModelSetup(setup).ok,false);
  }
});
