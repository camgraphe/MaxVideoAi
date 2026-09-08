import assert from 'node:assert/strict';
import test from 'node:test';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

import type { AgentPrincipal } from '../frontend/src/server/agent-api/principal';
import { createMaxVideoAiMcpServer, type MaxVideoAiMcpServices } from '../frontend/src/server/mcp/server';

const principal: AgentPrincipal = { userId: 'owner', clientId: 'client', emailVerified: true, authMethod: 'oauth' };
const firstId = `ma_${'1'.repeat(32)}`;
const secondId = `ma_${'2'.repeat(32)}`;

function services(calls: unknown[]): MaxVideoAiMcpServices {
  return {
    async getAccountStatus() { throw new Error('unused'); },
    async listModels() { return []; },
    async getModelDetails() { throw new Error('unused'); },
    async recommendModels() { return { recommendations: [], nextAction: 'clarify_requirements' }; },
    async prepareMontage(input) {
      return {
        schemaVersion: 1, status: 'edit_plan', persisted: false, title: input.title, settings: input.settings,
        clips: [], totalFrames: 0, totalSeconds: 0, orderingBasis: 'caller_supplied', nextAction: 'Review.',
      };
    },
    async createStudioMontage(input, currentPrincipal) {
      calls.push({ input, principal: currentPrincipal });
      return {
        schemaVersion: 1, status: 'studio_project', persisted: true, title: input.title,
        projectId: 'project-1', sequenceId: 'sequence-1', revision: 0,
        studioUrl: '/app/studio/workspace/project-1', clipCount: 2,
        totalFrames: 48, totalSeconds: 2, orderingBasis: 'caller_supplied',
      };
    },
  };
}

test('create_studio_montage is separately gated, strict, persisted and explicitly idempotent', async (t) => {
  const calls: unknown[] = [];
  const disabledServer = createMaxVideoAiMcpServer(principal, services(calls), {
    paidGeneration: false, referenceUploads: false, montagePreparation: true,
  });
  const enabledServer = createMaxVideoAiMcpServer(principal, services(calls), {
    paidGeneration: false, referenceUploads: false, montagePreparation: false, studioMontageCreation: true,
  });
  const [disabledClientTransport, disabledServerTransport] = InMemoryTransport.createLinkedPair();
  const [enabledClientTransport, enabledServerTransport] = InMemoryTransport.createLinkedPair();
  const disabledClient = new Client({ name: 'disabled', version: '1' });
  const enabledClient = new Client({ name: 'enabled', version: '1' });
  await disabledServer.connect(disabledServerTransport); await disabledClient.connect(disabledClientTransport);
  await enabledServer.connect(enabledServerTransport); await enabledClient.connect(enabledClientTransport);
  t.after(async () => {
    await disabledClient.close(); await enabledClient.close(); await disabledServer.close(); await enabledServer.close();
  });

  assert.equal((await disabledClient.listTools()).tools.some((tool) => tool.name === 'create_studio_montage'), false);
  assert.ok((await disabledClient.listTools()).tools.some((tool) => tool.name === 'prepare_montage'));
  assert.doesNotMatch(disabledClient.getInstructions() ?? '', /save.*editable Studio project/iu);
  const tool = (await enabledClient.listTools()).tools.find((candidate) => candidate.name === 'create_studio_montage');
  assert.ok(tool);
  assert.deepEqual(tool.annotations, {
    readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false,
  });
  assert.equal(tool.inputSchema.additionalProperties, false);
  assert.equal((tool.inputSchema.properties?.settings as { additionalProperties?: unknown }).additionalProperties, false);
  assert.equal((tool.inputSchema.properties?.clips as { items?: { additionalProperties?: unknown } }).items?.additionalProperties, false);
  assert.match(enabledClient.getInstructions() ?? '', /create_studio_montage.*editable Studio project.*exact same idempotencyKey/is);

  const input = {
    title: 'Two shots', settings: { fps: 24, aspectRatio: '16:9', resolution: '1080p', audioMode: 'preserve' },
    clips: [
      { assetId: firstId, sourceInFrame: 0, durationFrames: 24 },
      { assetId: secondId, sourceInFrame: 0, durationFrames: 24 },
    ],
    idempotencyKey: 'retry-1',
  };
  const result = await enabledClient.callTool({ name: 'create_studio_montage', arguments: input });
  assert.equal(result.isError, undefined, JSON.stringify(result));
  assert.deepEqual(result.structuredContent, {
    schemaVersion: 1, status: 'studio_project', persisted: true, title: input.title,
    projectId: 'project-1', sequenceId: 'sequence-1', revision: 0,
    studioUrl: '/app/studio/workspace/project-1', clipCount: 2,
    totalFrames: 48, totalSeconds: 2, orderingBasis: 'caller_supplied',
  });
  assert.deepEqual(calls, [{ input, principal }]);

  const rejected = await enabledClient.callTool({
    name: 'create_studio_montage', arguments: { ...input, owner: 'foreign' },
  });
  assert.equal(rejected.isError, true);
  assert.equal(calls.length, 1);
});
