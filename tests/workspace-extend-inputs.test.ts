import assert from 'node:assert/strict';
import test from 'node:test';
import { listFalEngines } from '../frontend/src/config/falEngines';
import { summarizeWorkspaceInputSchema } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-input-schema';
import { getVideoExtensionSourceField, getVideoExtensionSourceState } from '../frontend/lib/video-extension';

const extensions = listFalEngines().filter(({ modes }) => modes.some(({ mode }) => mode === 'extend'));
assert.ok(extensions.length >= 10);

for (const { engine, id } of extensions) {
  test(`${id}: Extend only exposes fields supported by that mode, including optional references`, () => {
    const schema = engine.inputSchema!;
    const expected = [...(schema.required ?? []), ...(schema.optional ?? [])]
      .filter(field => ['image', 'video', 'audio'].includes(field.type) && (!field.modes?.length || field.modes.includes('extend')));
    const summary = summarizeWorkspaceInputSchema({
      selectedEngine: engine, activeMode: 'extend',
      allowsUnifiedVeoFirstLast: id.startsWith('veo-3'),
      isUnifiedHappyHorse: false, isUnifiedSeedance: id.startsWith('seedance-2'),
      isUnifiedGeminiOmni: id === 'gemini-omni-flash', uiLocale: 'en',
    });
    assert.deepEqual(summary.assetFields.map(({ field }) => field.id).sort(), [...new Set(expected.map(field => field.id))].sort());
    if (id === 'luma-ray-3-2') {
      assert.deepEqual(summary.assetFields, [], 'owned Luma lineage cannot be substituted with an upload');
      assert.equal(getVideoExtensionSourceField(schema), null);
      assert.ok([...(schema.required??[]),...(schema.optional??[])].some(field => field.id === 'source_job_id' && field.modes?.includes('extend')));
      return;
    }
    assert.ok(summary.assetFields.some(({ field, required }) => field.type === 'video' && required));
    const source = getVideoExtensionSourceField(schema)!;
    assert.ok(summary.assetFields.some(({ field, required }) => field.id === source.id && required));
    assert.equal(getVideoExtensionSourceState(schema, {}), 'missing');
    assert.equal(getVideoExtensionSourceState(schema, { [source.id]: [{ kind: 'video', status: 'uploading' }] }), 'uploading');
    assert.equal(getVideoExtensionSourceState(schema, { [source.id]: [{ kind: 'video', status: 'error' }] }), 'error');
    assert.equal(getVideoExtensionSourceState(schema, { [source.id]: [{ kind: 'image', status: 'ready' }] }), 'missing');
    assert.equal(getVideoExtensionSourceState(schema, { [source.id]: [null, { kind: 'video', status: 'ready' }] }), 'ready');
  });
}
