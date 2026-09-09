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
