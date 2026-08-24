import assert from 'node:assert/strict';
import test from 'node:test';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

import { AgentApiError } from '../frontend/src/server/agent-api/errors';
import type { AgentPrincipal } from '../frontend/src/server/agent-api/principal';
import type {
  AgentAccountStatus,
  AgentModel,
  AgentModelDetails,
  AgentModelFilter,
  AgentModelRecommendationInput,
} from '../frontend/src/server/agent-api/types';
import type {
  AgentProjectBudgetInput,
  AgentProjectBudgetResult,
} from '../frontend/src/server/agent-api/project-budget';
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

const modelDetails: AgentModelDetails = {
  id: 'minimax-h3',
  label: 'MiniMax H3',
  surface: 'video',
  availability: 'available',
  modes: [],
  guidance: null,
  links: {
    model: 'https://maxvideoai.com/models/minimax-h3',
    pricing: 'https://maxvideoai.com/pricing',
    examples: null,
  },
  catalogUpdatedAt: '2026-08-24T12:00:00.000Z',
};

const projectBudget: AgentProjectBudgetResult = {
  proposals: [{
    name: 'Consistent product film',
    lines: [{
      purpose: 'Opening hero shot',
      engineId: 'seedance-2-5',
      mode: 't2v',
      settings: { durationSec: 10, resolution: '720p', aspectRatio: '16:9' },
      referenceCount: 0,
      clipCount: 6,
      attemptsPerClip: 2,
      unitPrice: { amountCents: 120, currency: 'USD' },
      baseProduction: { amountCents: 720, currency: 'USD', attempts: 6 },
      creativeAttempts: { amountCents: 720, currency: 'USD', attempts: 6 },
      total: { amountCents: 1_440, currency: 'USD' },
      intendedOutputDurationSec: 60,
    }],
    baseProduction: { amountCents: 720, currency: 'USD' },
    creativeAttempts: { amountCents: 720, currency: 'USD' },
    total: { amountCents: 1_440, currency: 'USD' },
    intendedOutputDurationSec: 60,
  }],
  currency: 'USD',
  membershipTier: 'member',
  catalogRevision: 'mcp-catalog-v2:test',
  quoteRequired: true,
  nextAction: 'discuss_and_refine',
};

function services(overrides: Partial<MaxVideoAiMcpServices> = {}): MaxVideoAiMcpServices {
  return {
    async getAccountStatus() {
      return account;
    },
    async listModels() {
      return [model];
    },
    async getModelDetails() {
      return modelDetails;
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
    async calculateProjectBudget() {
      return projectBudget;
    },
    ...overrides,
  };
}

function record(value: unknown): Record<string, unknown> {
  assert.ok(value && typeof value === 'object' && !Array.isArray(value));
  return value as Record<string, unknown>;
}

function assertAccountStatus(value: unknown): asserts value is AgentAccountStatus {
  const status = record(value);
  assert.equal(typeof status.accountId, 'string');
  assert.equal(typeof status.emailVerified, 'boolean');
  assert.equal(typeof record(status.wallet).amountCents, 'number');
  assert.equal(record(status.trial).status, 'disabled');
  assert.equal(typeof status.accountUrl, 'string');
  assert.equal('email' in status, false);
}

function assertModel(value: unknown): asserts value is AgentModel {
  const candidate = record(value);
  assert.equal(typeof candidate.id, 'string');
  assert.ok(candidate.surface === 'video' || candidate.surface === 'image');
  assert.ok(Array.isArray(candidate.modes));
  assert.ok(Array.isArray(candidate.aspectRatios));
  assert.equal(typeof candidate.audio, 'boolean');
  assert.equal(typeof candidate.referenceImages, 'boolean');
  assert.equal('pricing' in candidate, false);
}

function assertRecommendationResult(value: unknown): void {
  const result = record(value);
  assert.ok(Array.isArray(result.recommendations));
  assert.ok(
    result.nextAction === 'calculate_project_budget'
      || result.nextAction === 'prepare_generation'
      || result.nextAction === 'clarify_requirements',
  );
  for (const recommendation of result.recommendations) {
    const entry = record(recommendation);
    assert.equal(typeof entry.rank, 'number');
    assertModel(entry.model);
    assert.ok(Array.isArray(entry.reasons));
    assert.ok(Array.isArray(entry.tradeoffs));
  }
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

test('server advertises only the five read-only discovery tools with narrow guidance', async (t) => {
  const connected = await connectedClient();
  t.after(() => connected.close());

  const result = await connected.client.listTools();
  assert.equal(connected.client.getServerVersion()?.name, 'maxvideoai');
  assert.deepEqual(result.tools.map((tool) => tool.name), [
    'get_account_status',
    'list_models',
    'get_model_details',
    'recommend_models',
    'calculate_project_budget',
  ]);

  for (const tool of result.tools) {
    assert.equal(tool.annotations?.readOnlyHint, true);
    assert.equal(tool.annotations?.destructiveHint, false);
    assert.equal(tool.annotations?.openWorldHint, false);
    assert.match(tool.description ?? '', /Use this when/i);
    assert.match(tool.description ?? '', /Do not use/i);
    assert.equal(tool.inputSchema.type, 'object');
  }
  const detailTool = result.tools.find((tool) => tool.name === 'get_model_details');
  assert.ok(detailTool);
  assert.equal(detailTool.inputSchema.additionalProperties, false);
  assert.deepEqual(Object.keys(detailTool.inputSchema.properties ?? {}), ['id']);
  const budgetTool = result.tools.find((tool) => tool.name === 'calculate_project_budget');
  assert.ok(budgetTool);
  assert.equal(budgetTool.inputSchema.additionalProperties, false);
  assert.match(budgetTool.description ?? '', /mixed models/i);
  assert.match(budgetTool.description ?? '', /explicit creative attempts/i);
  assert.match(connected.client.getInstructions() ?? '', /prompt drafting.*host agent/i);
  assert.match(connected.client.getInstructions() ?? '', /generation is not available/i);

  const recommendationTool = result.tools.find((tool) => tool.name === 'recommend_models');
  assert.ok(recommendationTool);
  assert.equal(recommendationTool.inputSchema.additionalProperties, false);
  const recommendationProperties = record(recommendationTool.inputSchema.properties);
  for (const field of ['useCase', 'priorities', 'preferredModelIds', 'excludedModelIds', 'budgetCeilingCents']) {
    assert.equal(typeof record(recommendationProperties[field]).description, 'string');
  }
});

test('tools return structured content and pass validated filters to facade services', async (t) => {
  let listFilter: AgentModelFilter | null = null;
  let modelDetailId: string | null = null;
  let recommendationInput: AgentModelRecommendationInput | null = null;
  let budgetInput: AgentProjectBudgetInput | null = null;
  const connected = await connectedClient({
    async listModels(filter) {
      listFilter = filter;
      return [model];
    },
    async getModelDetails(id) {
      modelDetailId = id;
      return modelDetails;
    },
    async recommendModels(input) {
      recommendationInput = input;
      return { recommendations: [], nextAction: 'clarify_requirements' };
    },
    async calculateProjectBudget(input) {
      budgetInput = input;
      return projectBudget;
    },
  });
  t.after(() => connected.close());

  const accountResult = await connected.client.callTool({ name: 'get_account_status', arguments: {} });
  const modelsResult = await connected.client.callTool({
    name: 'list_models',
    arguments: { surface: 'video', mode: 't2v', audio: true },
  });
  const detailsResult = await connected.client.callTool({
    name: 'get_model_details',
    arguments: { id: 'minimax-h3' },
  });
  const rejectedDetailResult = await connected.client.callTool({
    name: 'get_model_details',
    arguments: { id: 'minimax-h3', unexpected: true },
  });
  const recommendationResult = await connected.client.callTool({
    name: 'recommend_models',
    arguments: {
      mode: 't2v',
      useCase: 'product_video',
      priorities: ['speed', 'reference_control'],
      preferredModelIds: ['seedance-2-mini', 'seedance-2-mini'],
      excludedModelIds: ['minimax-h3'],
      budgetCeilingCents: 1_000,
    },
  });
  const rejectedRecommendationResults = await Promise.all([
    connected.client.callTool({
      name: 'recommend_models',
      arguments: { mode: 't2v', economy: true },
    }),
    connected.client.callTool({
      name: 'recommend_models',
      arguments: { preferredModelIds: Array.from({ length: 11 }, () => 'seedance-2-mini') },
    }),
    connected.client.callTool({
      name: 'recommend_models',
      arguments: { priorities: Array.from({ length: 7 }, () => 'speed') },
    }),
  ]);
  const budgetArguments = {
    proposals: [
      {
        name: 'Consistent product film',
        lines: [{
          purpose: 'Opening hero shot',
          engineId: 'seedance-2-5',
          mode: 't2v',
          settings: { durationSec: 10, resolution: '720p', aspectRatio: '16:9', audio: true },
          clipCount: 6,
          attemptsPerClip: 2,
        }],
      },
      {
        name: 'Mixed cutaway plan',
        lines: [{
          purpose: 'Reference product shot',
          engineId: 'minimax-h3',
          mode: 'ref2v',
          settings: { durationSec: 5, resolution: '2K', aspectRatio: '9:16', fps: 24, loop: false },
          referenceRoles: ['reference', 'reference'],
          clipCount: 3,
          attemptsPerClip: 1,
        }],
      },
    ],
  } satisfies AgentProjectBudgetInput;
  const budgetResult = await connected.client.callTool({
    name: 'calculate_project_budget',
    arguments: budgetArguments,
  });
  const rejectedBudgetResults = await Promise.all([
    connected.client.callTool({
      name: 'calculate_project_budget',
      arguments: { ...budgetArguments, unexpected: true },
    }),
    connected.client.callTool({
      name: 'calculate_project_budget',
      arguments: { proposals: Array.from({ length: 5 }, () => budgetArguments.proposals[0]) },
    }),
    connected.client.callTool({
      name: 'calculate_project_budget',
      arguments: { proposals: [{ ...budgetArguments.proposals[0], lines: Array.from({ length: 13 }, () => budgetArguments.proposals[0].lines[0]) }] },
    }),
    connected.client.callTool({
      name: 'calculate_project_budget',
      arguments: { proposals: [{ ...budgetArguments.proposals[0], lines: [{ ...budgetArguments.proposals[0].lines[0], clipCount: 101 }] }] },
    }),
    connected.client.callTool({
      name: 'calculate_project_budget',
      arguments: { proposals: [{ ...budgetArguments.proposals[0], lines: [{ ...budgetArguments.proposals[0].lines[0], mode: 't2i' }] }] },
    }),
    connected.client.callTool({
      name: 'calculate_project_budget',
      arguments: { proposals: [{ ...budgetArguments.proposals[0], lines: [{ ...budgetArguments.proposals[0].lines[0], settings: { ...budgetArguments.proposals[0].lines[0].settings, arbitrary: true } }] }] },
    }),
  ]);

  assert.deepEqual(accountResult.structuredContent, account);
  assert.deepEqual(modelsResult.structuredContent, { models: [model] });
  assert.deepEqual(detailsResult.structuredContent, modelDetails);
  assert.equal(rejectedDetailResult.isError, true);
  assert.deepEqual(recommendationResult.structuredContent, {
    recommendations: [],
    nextAction: 'clarify_requirements',
  });
  assert.deepEqual(budgetResult.structuredContent, projectBudget);
  assert.deepEqual(listFilter, { surface: 'video', mode: 't2v', audio: true });
  assert.equal(modelDetailId, 'minimax-h3');
  assert.deepEqual(recommendationInput, {
    mode: 't2v',
    useCase: 'product_video',
    priorities: ['speed', 'reference_control'],
    preferredModelIds: ['seedance-2-mini', 'seedance-2-mini'],
    excludedModelIds: ['minimax-h3'],
    budgetCeilingCents: 1_000,
  });
  assert.deepEqual(budgetInput, budgetArguments);
  rejectedBudgetResults.forEach((result) => assert.equal(result.isError, true));
  rejectedRecommendationResults.forEach((result) => assert.equal(result.isError, true));
  assertAccountStatus(accountResult.structuredContent);
  const listedModels = record(modelsResult.structuredContent).models;
  assert.ok(Array.isArray(listedModels));
  listedModels.forEach(assertModel);
  assertRecommendationResult(recommendationResult.structuredContent);
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
  const budgetFailure = await connectedClient({
    async calculateProjectBudget() {
      throw new AgentApiError(
        'PARAMETER_INVALID',
        'A setting is not supported by the selected model.',
        false,
        { type: 'edit_project_line', proposalIndex: 1, lineIndex: 2, field: 'resolution' },
      );
    },
  });
  t.after(async () => {
    await expected.close();
    await unexpected.close();
    await budgetFailure.close();
  });

  const expectedResult = await expected.client.callTool({ name: 'get_account_status', arguments: {} });
  const unexpectedResult = await unexpected.client.callTool({ name: 'get_account_status', arguments: {} });
  const budgetFailureResult = await budgetFailure.client.callTool({
    name: 'calculate_project_budget',
    arguments: {
      proposals: [{
        name: 'Alternative',
        lines: [{
          purpose: 'Hero shot',
          engineId: 'seedance-2-5',
          mode: 't2v',
          settings: { durationSec: 10, resolution: '720p', aspectRatio: '16:9' },
          clipCount: 1,
          attemptsPerClip: 1,
        }],
      }],
    },
  });

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
  assert.deepEqual(budgetFailureResult.structuredContent, {
    ok: false,
    error: {
      code: 'PARAMETER_INVALID',
      message: 'A setting is not supported by the selected model.',
      retryable: false,
      nextAction: { type: 'edit_project_line', proposalIndex: 1, lineIndex: 2, field: 'resolution' },
    },
  });
});
