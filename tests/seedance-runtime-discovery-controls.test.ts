import assert from 'node:assert/strict';
import test from 'node:test';
import { ENV } from '../frontend/src/lib/env';
import { createAgentModelCatalogDeps, listPublicAgentGenerationEngines } from '../frontend/src/server/agent-api/model-catalog';
import { getAgentModelDetails } from '../frontend/src/server/agent-api/model-details';
import { studioVisualCapabilityDetails } from '../frontend/src/server/studio/conversation-capabilities';

test('read-only MCP and Studio discovery inherit ModelArk Edit timing and framing while LAS and Extend retain controls', async () => {
  const flags = { SEEDANCE_2_5_PROVIDER: 'byteplus_modelark', SEEDANCE_2_5_BYTEPLUS_MODES: 't2v,i2v,ref2v,v2v,extend',
    SEEDANCE_2_5_FLASH_PROVIDER: 'byteplus_modelark', SEEDANCE_2_5_FLASH_BYTEPLUS_MODES: 't2v,i2v,ref2v,v2v,extend',
    SEEDANCE_2_5_EDIT_TRANSPORT: 'modelark' };
  const previous = Object.fromEntries(Object.keys(flags).map(key => [key, (ENV as Record<string, unknown>)[key]]));
  Object.assign(ENV, flags);
  const deps = {
    ...createAgentModelCatalogDeps(undefined, {
      databaseConfigured: () => true,
      fetchSettings: async () => new Map(),
      fetchOverrides: async () => new Map(),
    }),
    isEngineExecutable: () => true,
    isModeExecutable: () => true,
  };
  try {
    for (const transport of ['modelark', 'las']) {
      ENV.SEEDANCE_2_5_EDIT_TRANSPORT = transport;
      const candidates = await listPublicAgentGenerationEngines(deps);
      for (const id of ['seedance-2-5', 'seedance-2-5-flash']) {
        const details = await getAgentModelDetails(id, deps);
        const candidate = candidates.find(entry => entry.engine.id === id)!;
        assert.ok(candidate);
        const studio = studioVisualCapabilityDetails(candidate);
        if (studio.surface === 'audio') assert.fail('Expected video capabilities');
        const inherited = id === 'seedance-2-5-flash' || transport === 'modelark';
        for (const projection of [details, studio]) {
          const edit = projection.modes.find(mode => mode.mode === 'v2v')!;
          assert.equal(edit.durationPolicy, inherited ? 'source_video' : 'requested', id + ' ' + transport);
          for (const key of ['durationSec', 'aspectRatio']) {
            assert.equal(edit.settings.some(setting => setting.key === key), !inherited, id + ' ' + key);
            assert.ok(projection.modes.find(mode => mode.mode === 'extend')!.settings.some(setting => setting.key === key));
          }
          assert.equal(projection.modes.find(mode => mode.mode === 'extend')!.durationPolicy, 'requested');
          assert.ok(edit.settings.some(setting => setting.key === 'audio'));
          assert.ok(edit.settings.some(setting => setting.key === 'outputFormat'));
        }
      }
    }
  } finally { Object.assign(ENV, previous); }
});
