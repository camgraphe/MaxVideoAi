import assert from 'node:assert/strict';
import test from 'node:test';
import { listAudioCapabilities, listMcpAudioCapabilities } from '../frontend/src/server/agent-api/audio-capabilities';
import { executeReservedAudioRun } from '../frontend/src/server/audio/generate-audio';
import { enqueueAudioDispatch } from '../frontend/src/server/audio/dispatch-repository';

const site = { FAL_KEY: 'fixture-provider', MCP_AUDIO_EXTENDED_ENABLED: 'true', MCP_AUDIO_EXECUTION_MODE: 'site' };
const worker = { ...site, MCP_AUDIO_EXECUTION_MODE: 'worker', AUDIO_GENERATION_WORKER_ENABLED: 'true' };

test('explicit site runtime exposes the same native packs and prices without an external worker', () => {
  const native = listAudioCapabilities(site);
  const catalogue = listMcpAudioCapabilities(site);
  assert.deepEqual(catalogue.modes, native.modes);
  assert.deepEqual(catalogue.options, native.options);
  assert.equal(catalogue.pricingPolicyRevision, native.pricingPolicyRevision);
  assert.notEqual(catalogue.revision, listMcpAudioCapabilities(worker).revision);
  assert.equal(catalogue.modes.find(mode => mode.mode === 'music_only')?.available, false);
});

test('site selection does not open publication and invalid runtime cannot open extended Audio', () => {
  for (const env of [
    { ...site, MCP_AUDIO_EXTENDED_ENABLED: 'false' },
    { ...worker, MCP_AUDIO_EXECUTION_MODE: 'typo' },
    { ...worker, MCP_AUDIO_EXECUTION_MODE: '' },
    { ...site, MCP_AUDIO_EXECUTION_MODE: 'worker' },
  ]) assert.deepEqual(listMcpAudioCapabilities(env).modes.map(mode => mode.mode), ['voice_only']);
});

test('site adapter uses the website executor and never enqueues even if the legacy worker gate is present', async () => {
  const adapter = await import('../frontend/src/server/agent-api/audio-execution').catch(() => null);
  assert.ok(adapter, 'Audio execution selection is implemented');
  for (const env of [site, { ...site, AUDIO_GENERATION_WORKER_ENABLED: 'true' }]) {
    const selected = adapter.createMcpAudioExecutionDependencies(env);
    assert.equal(selected.executeRun, executeReservedAudioRun);
    assert.equal(selected.enqueueRun, undefined);
  }
  const queued = adapter.createMcpAudioExecutionDependencies(worker);
  assert.equal(queued.enqueueRun, enqueueAudioDispatch);
  const legacy = adapter.createMcpAudioExecutionDependencies({ ...worker, MCP_AUDIO_EXECUTION_MODE: undefined });
  assert.equal(legacy.enqueueRun, enqueueAudioDispatch);
});
