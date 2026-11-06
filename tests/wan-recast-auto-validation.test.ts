import assert from 'node:assert/strict';
import test from 'node:test';
import { getFalEngineById } from '../frontend/src/config/falEngines';
import { listPublicAgentGenerationEngines } from '../frontend/src/server/agent-api/model-catalog';
import { normalizeGenerationRequest } from '../frontend/src/server/agent-api/generation-normalization';
import { validateCanonicalGenerationCapabilities } from '../frontend/src/server/agent-api/generation-capability-validation';
import { getReadOnlyConfiguredEngine } from '../frontend/src/server/agent-api/read-only-engine-catalog';
import { RECAST_FRAMINGS } from '../frontend/src/lib/character-studio-recast-format';
import { projectConfiguredEngine } from '../frontend/src/server/engine-configuration-projection';

test('Wan Prime catalog accepts Recast Auto in image, reference and source-video requests', async () => {
  const engine = await getReadOnlyConfiguredEngine('wan-3-prime', false, {
    databaseConfigured: () => true,
    fetchSettings: async () => new Map(),
    fetchOverrides: async () => new Map(),
  });
  assert.ok(engine);
  const providerField = engine.inputSchema?.optional?.find(field => field.id === 'aspect_ratio');
  assert.equal(providerField?.default, 'adaptive');
  assert.ok(providerField?.values?.includes('adaptive'));
  const [candidate] = await listPublicAgentGenerationEngines({
    listEngines: async () => [engine], surfaceByEngineId: () => 'video',
    isEngineExecutable: () => true, isModeExecutable: () => true,
  });
  assert.ok(candidate);
  for (const mode of ['i2v', 'ref2v', 'v2v'] as const) {
    for (const aspectRatio of RECAST_FRAMINGS) {
      const request = normalizeGenerationRequest({
        surface: 'video', engineId: engine.id, mode,
        prompt: 'Walk toward the camera and smile.',
        references: [{ kind: 'asset', assetId: 'ma_11111111111111111111111111111111', role: mode === 'i2v' ? 'first_frame' : mode === 'v2v' ? 'source' : 'reference' }],
        settings: { durationSec: 6, resolution: '720p', aspectRatio, audio: false },
      });
      assert.doesNotThrow(() => validateCanonicalGenerationCapabilities(request, candidate), `${mode} ${aspectRatio}`);
    }
  }
});

test('an explicit configured format restriction still excludes Auto without mutating the registry', () => {
  const base = getFalEngineById('wan-3-prime')!.engine;
  const configured = projectConfiguredEngine(base, new Map([[base.id, {
    engine_id: base.id, options: { aspectRatios: ['9:16'] }, pricing: null,
    updated_by: 'admin', updated_at: '',
  }]]), new Map()).engine;
  assert.deepEqual(configured.inputSchema?.optional?.find(field => field.id === 'aspect_ratio')?.values, ['9:16']);
  assert.ok(base.inputSchema?.optional?.find(field => field.id === 'aspect_ratio')?.values?.includes('adaptive'));
  const request = normalizeGenerationRequest({
    surface: 'video', engineId: base.id, mode: 'i2v', prompt: 'Walk toward the camera and smile.',
    references: [{ kind: 'asset', assetId: 'ma_11111111111111111111111111111111', role: 'first_frame' }],
    settings: { durationSec: 6, resolution: '720p', aspectRatio: 'auto', audio: false },
  });
  assert.throws(() => validateCanonicalGenerationCapabilities(request, {
    engine: configured, surface: 'video', publicModes: ['i2v'], modeCaps: configured.modeCaps!,
  }));
});
