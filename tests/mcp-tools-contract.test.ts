import assert from 'node:assert/strict';
import test from 'node:test';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

import { AgentApiError } from '../frontend/src/server/agent-api/errors';
import type { AgentPrincipal } from '../frontend/src/server/agent-api/principal';
import type {
  AgentAccountStatus,
  AgentModel,
  AgentModelFilter,
  AgentModelRecommendationInput,
} from '../frontend/src/server/agent-api/types';
import {
  createMaxVideoAiMcpServer,
  type MaxVideoAiMcpServices,
} from '../frontend/src/server/mcp/server';

const principal: AgentPrincipal = {
  userId: 'user-1',
  clientId: 'codex-client',
  emailVerified: true,
  authMethod: 'oauth',
};

const account: AgentAccountStatus = {
  accountId: 'user-1',
  emailVerified: true,
  clientId: 'codex-client',
  wallet: { amountCents: 500, currency: 'USD', pendingCents: 0 },
  trial: { status: 'disabled' },
  spendingLimits: { perGenerationCents: null, dailyCents: null, webApprovalAboveCents: null },
  accountUrl: 'https://maxvideoai.com/account/connections',
};

const model: AgentModel = {
  id: 'seedance-2-mini',
  label: 'Seedance 2 Mini',
  surface: 'video',
  modes: ['t2v'],
  aspectRatios: ['16:9'],
  resolutions: ['1080p'],
  maxDurationSec: 10,
  audio: true,
  referenceImages: false,
  availability: 'available',
};

function services(overrides: Partial<MaxVideoAiMcpServices> = {}): MaxVideoAiMcpServices {
  return {
    async getAccountStatus() {
      return account;
    },
    async listModels() {
      return [model];
    },
    async recommendModels() {
      return {
        recommendations: [
          {
            rank: 1,
            model,
            reasons: ['Supports text-to-video.'],
            tradeoffs: [],
            nextAction: 'prepare_generation',
          },
        ],
        nextAction: 'prepare_generation',
      };
    },
    ...overrides,
  };
}

async function connectedClient(serviceOverrides: Partial<MaxVideoAiMcpServices> = {}) {
  const server = createMaxVideoAiMcpServer(principal, services(serviceOverrides));
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: 'contract-client', version: '1.0.0' });
  await client.connect(clientTransport);
  return {
    client,
    server,
    async close() {
      await client.close();
      await server.close();
    },
  };
}

test('server advertises only the three read-only discovery tools with narrow guidance', async (t) => {
  const connected = await connectedClient();
  t.after(() => connected.close());

  const result = await connected.client.listTools();
  assert.deepEqual(result.tools.map((tool) => tool.name), [
    'get_account_status',
    'list_models',
    'recommend_models',
  ]);

  for (const tool of result.tools) {
    assert.equal(tool.annotations?.readOnlyHint, true);
    assert.equal(tool.annotations?.destructiveHint, false);
    assert.equal(tool.annotations?.openWorldHint, false);
    assert.match(tool.description ?? '', /Use this when/i);
    assert.match(tool.description ?? '', /Do not use/i);
    assert.equal(tool.inputSchema.type, 'object');
  }
  assert.match(connected.client.getInstructions() ?? '', /prompt drafting.*host agent/i);
  assert.match(connected.client.getInstructions() ?? '', /generation is not available/i);
});

test('tools return structured content and pass validated filters to facade services', async (t) => {
  let listFilter: AgentModelFilter | null = null;
  let recommendationInput: AgentModelRecommendationInput | null = null;
  const connected = await connectedClient({
    async listModels(filter) {
      listFilter = filter;
      return [model];
    },
    async recommendModels(input) {
      recommendationInput = input;
      return { recommendations: [], nextAction: 'clarify_requirements' };
    },
  });
  t.after(() => connected.close());

  const accountResult = await connected.client.callTool({ name: 'get_account_status', arguments: {} });
  const modelsResult = await connected.client.callTool({
    name: 'list_models',
    arguments: { surface: 'video', mode: 't2v', audio: true },
  });
  const recommendationResult = await connected.client.callTool({
    name: 'recommend_models',
    arguments: { mode: 't2v', speedPreference: 'fastest', qualityPreference: 'balanced' },
  });

  assert.deepEqual(accountResult.structuredContent, account);
  assert.deepEqual(modelsResult.structuredContent, { models: [model] });
  assert.deepEqual(recommendationResult.structuredContent, {
    recommendations: [],
    nextAction: 'clarify_requirements',
  });
  assert.deepEqual(listFilter, { surface: 'video', mode: 't2v', audio: true });
  assert.deepEqual(recommendationInput, {
    mode: 't2v',
    speedPreference: 'fastest',
    qualityPreference: 'balanced',
  });
});

test('tool errors are stable and unexpected failures never expose secrets or stacks', async (t) => {
  const expected = await connectedClient({
    async getAccountStatus() {
      throw new AgentApiError('RATE_LIMITED', 'Try again shortly.', true, { retryAfterSeconds: 30 });
    },
  });
  const unexpected = await connectedClient({
    async getAccountStatus() {
      throw new Error('database password super-secret');
    },
  });
  t.after(async () => {
    await expected.close();
    await unexpected.close();
  });

  const expectedResult = await expected.client.callTool({ name: 'get_account_status', arguments: {} });
  const unexpectedResult = await unexpected.client.callTool({ name: 'get_account_status', arguments: {} });

  assert.equal(expectedResult.isError, true);
  assert.deepEqual(expectedResult.structuredContent, {
    ok: false,
    error: {
      code: 'RATE_LIMITED',
      message: 'Try again shortly.',
      retryable: true,
      nextAction: { retryAfterSeconds: 30 },
    },
  });
  assert.equal(unexpectedResult.isError, true);
  assert.match(JSON.stringify(unexpectedResult.structuredContent), /"code":"INTERNAL_ERROR"/);
  assert.match(JSON.stringify(unexpectedResult.structuredContent), /"correlationId":"[^"]+"/);
  assert.doesNotMatch(JSON.stringify(unexpectedResult), /super-secret|database password|at .*\.ts/);
});
