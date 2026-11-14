import assert from 'node:assert/strict';
import test from 'node:test';
import { AUDIO_PACK_VALUES } from '../frontend/src/lib/audio-generation';
import { listAudioCapabilities, listMcpAudioCapabilities } from '../frontend/src/server/agent-api/audio-capabilities';

const provider = { FAL_KEY: 'fixture-audio-provider' };

test('extended MCP Audio requires both reviewed publication and worker execution configuration', () => {
  for (const env of [provider, {...provider,MCP_AUDIO_EXTENDED_ENABLED:'true'}, {...provider,AUDIO_GENERATION_WORKER_ENABLED:'true'}]) {
    const catalog = listMcpAudioCapabilities(env);
    assert.deepEqual(catalog.modes.map(mode=>mode.mode), ['voice_only']);
    assert.deepEqual(catalog.modes[0].variants.map(variant=>variant.settings.voiceModel), ['eleven-v4']);
    assert.equal(catalog.modes[0].references.voiceSample, 'unsupported');
  }
});

test('worker-backed MCP Audio retains the seven real app packs, exact variants and owned references', () => {
  const env = {...provider,MCP_AUDIO_EXTENDED_ENABLED:'true',AUDIO_GENERATION_WORKER_ENABLED:'true'};
  const full = listAudioCapabilities(env);
  const catalog = listMcpAudioCapabilities(env);
  assert.deepEqual(catalog.modes.map(mode=>mode.mode), [...AUDIO_PACK_VALUES]);
  assert.deepEqual(catalog.modes, full.modes);
  assert.deepEqual(catalog.options, full.options);
  assert.equal(catalog.modes.find(mode=>mode.mode==='sfx_only')?.available,true);
  assert.equal(catalog.modes.find(mode=>mode.mode==='music_only')?.available,false,'publication cannot invent missing Google credentials');
  assert.equal(catalog.modes.find(mode=>mode.mode==='cinematic_voice')?.references.sourceVideo,'required');
  assert.equal(catalog.modes.find(mode=>mode.mode==='voice_only')?.references.voiceSample,'optional_seed_only');
  assert.notEqual(catalog.revision,listMcpAudioCapabilities(provider).revision,'old synchronous quotes must not cross release projections');
});
