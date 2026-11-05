import assert from 'node:assert/strict';
import test from 'node:test';
import { getRuntimeModelById } from '../frontend/config/model-runtime';
import { getFalEngineById } from '../frontend/src/config/falEngines';
import { listAgentModels } from '../frontend/src/server/agent-api/model-catalog';
import { getAgentModelDetails } from '../frontend/src/server/agent-api/model-details';
import { resolveAgentGenerationModeExecutability } from '../frontend/src/server/agent-runtime/model-executability';
import { isKlingV4ReleaseBlocked } from '../frontend/src/server/video-generation/kling-v4-release-policy';

const environment = { bytePlusEnabled: false, bytePlusApiKey: undefined, falApiKey: 'offline-fixture',
  openaiApiKey: 'offline-fixture', providerEnv: { OPENAI_API_KEY: 'offline-fixture', S3_BUCKET: 'fixture',
    S3_REGION: 'fixture', S3_ACCESS_KEY_ID: 'fixture', S3_SECRET_ACCESS_KEY: 'fixture' } };

for (const id of ['kling-v4-flash', 'gpt-image-2-6-flare', 'gpt-image-2-6-sunburst']) {
  test(`${id} exposes only its qualified modes and closes discovery on rollback`, async () => {
    const runtime = getRuntimeModelById(id)!;
    const entry = getFalEngineById(id)!;
    assert.equal(runtime.publication.app.published, true);
    assert.equal(entry.surfaces.app.enabled, true);
    const expectedModes = id === 'kling-v4-flash' ? ['i2v', 'ref2v', 't2v'] : ['i2i', 't2i'];
    const deps = { listEngines: async () => [entry.engine],
      surfaceByEngineId: () => id === 'kling-v4-flash' ? 'video' as const : 'image' as const,
      isModeExecutable: (engine: typeof entry.engine, mode: Parameters<typeof resolveAgentGenerationModeExecutability>[1]) =>
        resolveAgentGenerationModeExecutability(engine, mode, environment).executable };
    const details = await getAgentModelDetails(id, deps);
    assert.equal(details.generationEnabled, true);
    assert.deepEqual(details.modes.map(mode => mode.mode).sort(), expectedModes);
    assert.equal((await listAgentModels({}, deps)).some(model => model.id === id), true);
    for (const mode of entry.engine.modes) {
      assert.deepEqual(resolveAgentGenerationModeExecutability(entry.engine, mode, environment), { executable: true, reason: 'available' });
    }
    if (id === 'kling-v4-flash') {
      assert.equal(entry.engine.extend, false);
      assert.equal(isKlingV4ReleaseBlocked(id), false);
    }
    // Credentials and marketing must not defeat a functional rollback.
    try {
      runtime.publication.app.published = false;
      assert.deepEqual(await listAgentModels({}, deps), []);
      for (const mode of entry.engine.modes)
        assert.equal(resolveAgentGenerationModeExecutability(entry.engine, mode, environment).executable, false);
      if (id === 'kling-v4-flash') assert.equal(isKlingV4ReleaseBlocked(id), true);
    } finally { runtime.publication.app.published = true; }
  });
}
