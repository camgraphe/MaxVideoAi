import assert from 'node:assert/strict';
import test from 'node:test';
import { listFalEngines } from '../frontend/src/config/falEngines';
import { summarizeWorkspaceInputSchema } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-input-schema';

const models = listFalEngines().filter(({ engine }) => engine.modes.some(mode => mode === 'v2v' || mode === 'reframe'));
assert.ok(models.length >= 9);
for (const { engine, id } of models) {
  for (const mode of engine.modes.filter(mode => mode === 'v2v' || mode === 'reframe')) {
    test(`${id} ${mode}: every displayed input belongs to this workflow and every supported input remains available`, () => {
      const expected = [...(engine.inputSchema?.required ?? []), ...(engine.inputSchema?.optional ?? [])]
        .filter(field => ['image', 'video', 'audio'].includes(field.type) && (!field.modes?.length || field.modes.includes(mode)));
      const summary = summarizeWorkspaceInputSchema({ selectedEngine: engine, activeMode: mode,
        allowsUnifiedVeoFirstLast: false, isUnifiedHappyHorse: id.startsWith('happyhorse'),
        isUnifiedSeedance: id.startsWith('seedance-2'), isUnifiedGeminiOmni: id === 'gemini-omni-flash', uiLocale: 'en' });
      assert.deepEqual(summary.assetFields.map(({ field }) => field.id).sort(), [...new Set(expected.map(field => field.id))].sort());
      for (const { field } of summary.assetFields) {
        const original = expected.find(value => value.id === field.id)!;
        assert.equal(field.maxCount, original.maxCount);
        assert.equal(field.maxDurationSec, original.maxDurationSec);
      }
    });
  }
}
