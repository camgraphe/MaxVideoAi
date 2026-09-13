import assert from 'node:assert/strict';
import test from 'node:test';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

import type { AgentPrincipal } from '../frontend/src/server/agent-api/principal';
import {
  createMaxVideoAiMcpServer,
  type MaxVideoAiMcpServices,
} from '../frontend/src/server/mcp/server';

const principal: AgentPrincipal = {
  userId: 'audio-owner',
  clientId: 'audio-client',
  emailVerified: true,
  authMethod: 'oauth',
};

function services(calls: string[]): MaxVideoAiMcpServices {
  return {
    async getAccountStatus() { return {} as never; },
    async listModels() { return []; },
    async getModelDetails() { return {} as never; },
    async recommendModels() { return { recommendations: [], nextAction: 'clarify_requirements' }; },
    async calculateProjectBudget() { return {} as never; },
    async prepareGeneration() { return {} as never; },
    async confirmGeneration() { return {} as never; },
    async getGenerationStatus() { return {} as never; },
    async listRecentGenerations() { return { items: [], nextCursor: null }; },
    async createTopupLink() { return {} as never; },
    async listAudioCapabilities() {
      calls.push('list_audio_capabilities');
      return { schemaVersion: 1, surface: 'audio', modes: [], revision: 'audio-revision' } as never;
    },
    async prepareAudioGeneration(input, receivedPrincipal) {
      calls.push(`prepare_audio_generation:${receivedPrincipal.userId}:${receivedPrincipal.clientId}:${input.mode}`);
      return { quoteId: '00000000-0000-4000-8000-000000000001' } as never;
    },
    async confirmAudioGeneration(input, receivedPrincipal) {
      calls.push(`confirm_audio_generation:${receivedPrincipal.userId}:${receivedPrincipal.clientId}:${input.quoteId}`);
      return { jobId: 'audio-job', surface: 'audio', status: 'accepted' } as never;
    },
  };
}

async function connected(audioGeneration: boolean, paidGeneration = true) {
  const calls: string[] = [];
  const server = createMaxVideoAiMcpServer(principal, services(calls), {
    paidGeneration,
    referenceUploads: false,
    audioGeneration,
  });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: 'audio-public-tools', version: '1.0.0' });
  await client.connect(clientTransport);
  return { calls, client, server };
}

test('Audio publication flag defaults closed and independently exposes three strict tools', async (t) => {
  const disabled = await connected(false);
  t.after(async () => { await disabled.client.close(); await disabled.server.close(); });
  const disabledNames = (await disabled.client.listTools()).tools.map((tool) => tool.name);
  assert.equal(disabledNames.some((name) => name.includes('audio_generation') || name === 'list_audio_capabilities'), false);

  const unpaid = await connected(true, false);
  t.after(async () => { await unpaid.client.close(); await unpaid.server.close(); });
  const unpaidNames = (await unpaid.client.listTools()).tools.map((tool) => tool.name);
  assert.equal(unpaidNames.some((name) => name.includes('audio_generation') || name === 'list_audio_capabilities'), false);

  const enabled = await connected(true);
  t.after(async () => { await enabled.client.close(); await enabled.server.close(); });
  const tools = new Map((await enabled.client.listTools()).tools.map((tool) => [tool.name, tool]));
  assert.deepEqual(
    ['list_audio_capabilities', 'prepare_audio_generation', 'confirm_audio_generation']
      .filter((name) => tools.has(name)),
    ['list_audio_capabilities', 'prepare_audio_generation', 'confirm_audio_generation'],
  );
  assert.deepEqual(tools.get('list_audio_capabilities')?.annotations, {
    readOnlyHint: true, destructiveHint: false, openWorldHint: false,
  });
  assert.deepEqual(tools.get('prepare_audio_generation')?.annotations, {
    readOnlyHint: false, destructiveHint: false, openWorldHint: false,
  });
  assert.deepEqual(tools.get('confirm_audio_generation')?.annotations, {
    readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true,
  });
  for (const name of ['list_audio_capabilities', 'prepare_audio_generation', 'confirm_audio_generation']) {
    assert.equal(tools.get(name)?.inputSchema.additionalProperties, false);
  }
});

test('Audio tools pass only schema-validated inputs and the exact OAuth principal', async (t) => {
  const session = await connected(true);
  t.after(async () => { await session.client.close(); await session.server.close(); });

  const capability = await session.client.callTool({ name: 'list_audio_capabilities', arguments: {} });
  const prepared = await session.client.callTool({
    name: 'prepare_audio_generation',
    arguments: {
      schemaVersion: 1,
      surface: 'audio',
      engineId: 'audio-music',
      mode: 'music_only',
      prompt: 'A calm instrumental score',
      settings: { durationSec: 30, musicModel: 'clip' },
      references: [],
      outputCount: 1,
    },
  });
  const confirmed = await session.client.callTool({
    name: 'confirm_audio_generation',
    arguments: { quoteId: '00000000-0000-4000-8000-000000000001', confirmed: true },
  });
  const invalid = await session.client.callTool({
    name: 'confirm_audio_generation',
    arguments: { quoteId: '00000000-0000-4000-8000-000000000001', confirmed: true, retry: true },
  });

  assert.notEqual(capability.isError, true);
  assert.notEqual(prepared.isError, true);
  assert.notEqual(confirmed.isError, true);
  assert.equal(invalid.isError, true);
  assert.deepEqual(session.calls, [
    'list_audio_capabilities',
    'prepare_audio_generation:audio-owner:audio-client:music_only',
    'confirm_audio_generation:audio-owner:audio-client:00000000-0000-4000-8000-000000000001',
  ]);
});
