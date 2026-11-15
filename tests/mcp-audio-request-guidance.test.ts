import assert from 'node:assert/strict';
import test from 'node:test';
import { listMcpAudioCapabilities } from '../frontend/src/server/agent-api/audio-capabilities';
import { normalizeAudioGenerationRequest } from '../frontend/src/server/agent-api/audio-normalization';
import { prepareAudioGeneration } from '../frontend/src/server/agent-api/prepare-audio-generation';
import { AgentApiError } from '../frontend/src/server/agent-api/errors';
import { listAudioCapabilitiesOutputSchema } from '../frontend/src/server/mcp/output-schemas/audio-montage';

const source = { role: 'source_video' as const, asset: { type: 'asset' as const, assetId: 'owned-source', kind: 'video' as const } };
const request = { schemaVersion: 1 as const, surface: 'audio' as const, engineId: 'audio-cinematic', mode: 'cinematic' as const,
  prompt: 'Soft keyboard typing', references: [source], settings: { musicEnabled: false, exportAudioFile: true }, outputCount: 1 as const };

test('the serialized Audio catalogue supplies the mandatory mood needed to build a valid cinematic request', () => {
  const catalog = listAudioCapabilitiesOutputSchema.parse(listMcpAudioCapabilities({ FAL_KEY: 'fixture', MCP_AUDIO_EXECUTION_MODE: 'site', MCP_AUDIO_EXTENDED_ENABLED: 'true' }));
  const mode = catalog.modes.find(mode => mode.mode === 'cinematic')!;
  const mood = mode.mood as { required: boolean; values: string[] } | undefined;
  const settings = { ...request.settings, ...(mood?.required ? { mood: mood.values.find(value => value === 'documentary') } : {}) };
  assert.doesNotThrow(() => normalizeAudioGenerationRequest({ ...request, settings }));
  assert.equal(mood?.required, true);
  assert.equal((catalog.modes.find(mode => mode.mode === 'sfx_only')!.mood as { required: boolean }).required, false);
});

test('missing Audio mood identifies the correct field before media access, quote insertion or provider work', async () => {
  await assert.rejects(prepareAudioGeneration(request,
    { userId: 'owner', clientId: 'client', emailVerified: true, authMethod: 'oauth' },
    { paidGenerationEnabled: () => true, getAccountRestriction: async () => null } as never),
  error => error instanceof AgentApiError && error.code === 'PARAMETER_INVALID'
    && error.message === 'Audio mood is required.'
    && error.nextAction?.field === 'settings.mood'
    && error.nextAction?.type === 'revise_request');
});
