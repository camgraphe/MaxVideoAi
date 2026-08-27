import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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
  destinations: {
    connections: {
      type: 'open_url',
      purpose: 'account_connections',
      label: 'Manage the MaxVideoAI connection',
      url: 'https://maxvideoai.com/account/connections',
    },
    billing: {
      type: 'open_url',
      purpose: 'billing',
      label: 'Add MaxVideoAI credits',
      url: 'https://maxvideoai.com/billing',
    },
    library: {
      type: 'open_url',
      purpose: 'media_library',
      label: 'Open the MaxVideoAI media library',
      url: 'https://maxvideoai.com/app/library',
    },
    videoWorkspace: {
      type: 'open_url',
      purpose: 'video_workspace',
      label: 'Open the MaxVideoAI video workspace',
      url: 'https://maxvideoai.com/app',
    },
    imageWorkspace: {
      type: 'open_url',
      purpose: 'image_workspace',
      label: 'Open the MaxVideoAI image workspace',
      url: 'https://maxvideoai.com/app/image',
    },
    support: {
      type: 'open_url',
      purpose: 'support',
      label: 'Contact MaxVideoAI support',
      url: 'https://maxvideoai.com/contact',
    },
  },
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
  generationEnabled: true,
};

const modelDetails: AgentModelDetails = {
  id: 'minimax-h3',
  label: 'MiniMax H3',
  surface: 'video',
  availability: 'available',
  generationEnabled: true,
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
  pricingScope: 'connected_environment',
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
  const destinations = record(status.destinations);
  assert.equal(record(destinations.billing).url, 'https://maxvideoai.com/billing');
  assert.equal(record(destinations.library).url, 'https://maxvideoai.com/app/library');
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
  assert.equal(typeof candidate.generationEnabled, 'boolean');
  assert.equal('pricing' in candidate, false);
}

function assertRecommendationResult(value: unknown): void {
  const result = record(value);
  assert.ok(Array.isArray(result.recommendations));
  assert.ok(
    result.nextAction === 'calculate_project_budget'
      || result.nextAction === 'discuss_and_choose'
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
  const server = createMaxVideoAiMcpServer(principal, services(serviceOverrides), {
    paidGeneration: false,
    referenceUploads: false,
  });
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
    assert.equal(tool.inputSchema.type, 'object');
  }
  const accountTool = result.tools.find((tool) => tool.name === 'get_account_status');
  assert.ok(accountTool);
  assert.equal(
    accountTool.description,
    'Use this when the user asks which MaxVideoAI account is connected, its current credit balance, trial state, spending limits, or safe account destinations. Do not use it to reveal a private email, collect payment details, charge credits, change the wallet, or generate media.',
  );
  for (const tool of result.tools.filter((candidate) => candidate.name !== 'get_account_status')) {
    assert.match(tool.description ?? '', /Use this when/i);
    assert.match(tool.description ?? '', /Do not use/i);
  }
  const detailTool = result.tools.find((tool) => tool.name === 'get_model_details');
  assert.ok(detailTool);
  assert.equal(detailTool.inputSchema.additionalProperties, false);
  assert.deepEqual(Object.keys(detailTool.inputSchema.properties ?? {}), ['id']);
  const listTool = result.tools.find((tool) => tool.name === 'list_models');
  assert.ok(listTool);
  const listProperties = record(listTool.inputSchema.properties);
  assert.equal(record(listProperties.limit).minimum, 1);
  assert.equal(record(listProperties.limit).maximum, 50);
  const budgetTool = result.tools.find((tool) => tool.name === 'calculate_project_budget');
  assert.ok(budgetTool);
  assert.equal(budgetTool.inputSchema.additionalProperties, false);
  assert.match(budgetTool.description ?? '', /mixed models/i);
  assert.match(budgetTool.description ?? '', /explicit creative attempts/i);
  const proposalSchema = record(record(budgetTool.inputSchema).properties).proposals;
  const proposalItem = record(record(proposalSchema).items);
  const lineSchema = record(record(record(proposalItem.properties).lines).items);
  const settingsSchema = record(record(lineSchema.properties).settings);
  const aspectRatioSchema = record(record(settingsSchema.properties).aspectRatio);
  const audioSchema = record(record(settingsSchema.properties).audio);
  assert.match(String(aspectRatioSchema.description), /aspectRatios.*non-empty.*include/i);
  assert.match(String(aspectRatioSchema.description), /empty.*omit/i);
  assert.match(String(audioSchema.description), /omit.*always_generated/i);
  assert.match(connected.client.getInstructions() ?? '', /prompt drafting.*host agent/i);
  assert.match(connected.client.getInstructions() ?? '', /generation is not available/i);

  const recommendationTool = result.tools.find((tool) => tool.name === 'recommend_models');
  assert.ok(recommendationTool);
  assert.match(recommendationTool.description ?? '', /undecided|asks.*advice/i);
  assert.match(recommendationTool.description ?? '', /already chose.*do not use|do not use.*already chose/i);
  assert.equal(recommendationTool.inputSchema.additionalProperties, false);
  const recommendationProperties = record(recommendationTool.inputSchema.properties);
  for (const field of ['useCase', 'priorities', 'preferredModelIds', 'excludedModelIds', 'budgetCeilingCents']) {
    assert.equal(typeof record(recommendationProperties[field]).description, 'string');
  }
  assert.match(String(record(recommendationProperties.priorities).description), /ordered/i);
  assert.match(String(record(recommendationProperties.priorities).description), /not.*proxy.*quality/i);
});

test('paid prepare schema exposes canonical settings and accepts full video reference modes', async (t) => {
  const preparedInputs: unknown[] = [];
  const operationalServices = services({
    prepareGeneration: async (input) => {
      preparedInputs.push(input);
      return { prepared: true } as never;
    },
    confirmGeneration: async () => ({}) as never,
    getGenerationStatus: async () => ({}) as never,
    listRecentGenerations: async () => ({ items: [], nextCursor: null }) as never,
    createTopupLink: async () => ({}) as never,
  });
  const server = createMaxVideoAiMcpServer(principal, operationalServices, {
    paidGeneration: true,
    referenceUploads: false,
  });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: 'paid-schema-contract', version: '1.0.0' });
  await client.connect(clientTransport);
  t.after(async () => {
    await client.close();
    await server.close();
  });

  for (const mode of ['v2v', 'extend'] as const) {
    const result = await client.callTool({
      name: 'prepare_generation',
      arguments: {
        schemaVersion: 1,
        surface: 'video',
        engineId: 'seedance-2-5',
        mode,
        prompt: 'Continue the scene.',
        settings: { durationSec: 4, resolution: '480p', audio: true },
        references: [{
          kind: 'https',
          url: 'https://cdn.example.com/source',
          role: 'source',
          mediaKind: 'video',
        }],
        outputCount: 1,
      },
    });
    assert.notEqual(result.isError, true);
  }

  const handlerCallsBeforeAlias = preparedInputs.length;
  const durationAliasResult = await client.callTool({
    name: 'prepare_generation',
    arguments: {
      surface: 'video',
      engineId: 'seedance-2-5',
      mode: 'v2v',
      prompt: 'Continue the scene.',
      settings: { duration: 4, resolution: '480p', aspectRatio: '16:9', audio: false },
      references: [{ kind: 'asset', assetId: 'source-asset', role: 'source' }],
    },
  });
  assert.equal(durationAliasResult.isError, true);
  assert.equal(preparedInputs.length, handlerCallsBeforeAlias, 'duration must be rejected before the handler');

  const prepareTool = (await client.listTools()).tools.find((tool) => tool.name === 'prepare_generation');
  assert.ok(prepareTool);
  const prepareProperties = record(prepareTool.inputSchema.properties);
  const settingsSchema = record(prepareProperties.settings);
  assert.equal(settingsSchema.additionalProperties, false);
  const settingsProperties = record(settingsSchema.properties);
  assert.equal('duration' in settingsProperties, false);
  const durationSecSchema = record(settingsProperties.durationSec);
  assert.equal(durationSecSchema.type, 'integer');
  assert.match(String(durationSecSchema.description), /durationSec.*seconds.*never.*duration/is);

  const invalidReferences = [
    { kind: 'https', url: 'https://cdn.example.com/source', role: 'source' },
    { kind: 'https', url: 'https://cdn.example.com/source', role: 'source', mediaKind: 'document' },
    { kind: 'asset', assetId: 'source-asset', role: 'source', mediaKind: 'video' },
  ];
  for (const reference of invalidReferences) {
    const result = await client.callTool({
      name: 'prepare_generation',
      arguments: {
        surface: 'video',
        engineId: 'seedance-2-5',
        mode: 'v2v',
        prompt: 'Continue the scene.',
        references: [reference],
      },
    });
    assert.equal(result.isError, true);
  }
  assert.deepEqual(preparedInputs.map((input) => record(input).mode), ['v2v', 'extend']);
});

test('all fourteen operational tools expose strict schemas and reject unknown keys before handlers', async (t) => {
  const calls = new Map<string, number>();
  const called = (name: string) => calls.set(name, (calls.get(name) ?? 0) + 1);
  const operationalServices = services({
    getAccountStatus: async () => { called('get_account_status'); return account; },
    listModels: async () => { called('list_models'); return [model]; },
    getModelDetails: async () => { called('get_model_details'); return modelDetails; },
    recommendModels: async () => { called('recommend_models'); return { recommendations: [], nextAction: 'clarify_requirements' }; },
    calculateProjectBudget: async () => { called('calculate_project_budget'); return projectBudget; },
    listMedia: async () => { called('list_media'); return { items: [], nextCursor: null, hasMore: false }; },
    createReferenceUploadLink: async () => { called('create_reference_upload_link'); return {} as never; },
    prepareGeneration: async () => { called('prepare_generation'); return {} as never; },
    confirmGeneration: async () => { called('confirm_generation'); return {} as never; },
    getGenerationStatus: async () => { called('get_generation_status'); return {} as never; },
    listRecentGenerations: async () => { called('list_recent_generations'); return { items: [], nextCursor: null }; },
    createTopupLink: async () => { called('create_topup_link'); return {} as never; },
  });
  const server = createMaxVideoAiMcpServer(principal, operationalServices, {
    paidGeneration: true,
    referenceUploads: true,
  });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: 'operational-metadata-contract', version: '1.0.0' });
  await client.connect(clientTransport);
  t.after(async () => {
    await client.close();
    await server.close();
  });

  const tools = new Map((await client.listTools()).tools.map((tool) => [tool.name, tool]));
  assert.deepEqual(tools.get('list_media')?.annotations, {
    readOnlyHint: true,
    destructiveHint: false,
    openWorldHint: false,
  });
  assert.deepEqual(tools.get('create_reference_upload_link')?.annotations, {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: false,
  });
  assert.deepEqual(tools.get('prepare_generation')?.annotations, {
    readOnlyHint: false,
    destructiveHint: false,
    openWorldHint: false,
  });
  assert.deepEqual(tools.get('create_topup_link')?.annotations, {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: false,
  });
  assert.deepEqual(tools.get('confirm_generation')?.annotations, {
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: true,
    openWorldHint: true,
  });
  assert.match(tools.get('list_media')?.description ?? '', /image, video, or audio.*filter.*kind/is);
  assert.match(tools.get('create_reference_upload_link')?.description ?? '', /requested.*media kind/i);
  assert.match(tools.get('prepare_generation')?.description ?? '', /t2v.*i2v.*ref2v.*v2v.*extend/is);
  const validArguments: Record<string, Record<string, unknown>> = {
    get_account_status: {},
    list_models: {},
    get_model_details: { id: 'seedance-2-5' },
    recommend_models: {},
    calculate_project_budget: {
      proposals: [{
        name: 'One clip',
        lines: [{
          purpose: 'Opening',
          engineId: 'seedance-2-5',
          mode: 't2v',
          settings: { durationSec: 4, resolution: '480p', aspectRatio: '16:9' },
          clipCount: 1,
          attemptsPerClip: 1,
        }],
      }],
    },
    list_media: {},
    create_reference_upload_link: { kind: 'image' },
    prepare_generation: {
      surface: 'video',
      engineId: 'seedance-2-5',
      mode: 't2v',
      prompt: 'A cinematic opening shot.',
    },
    confirm_generation: {
      quoteId: '00000000-0000-4000-8000-000000000001',
      confirmed: true,
    },
    get_generation_status: { jobId: 'job-1' },
    list_recent_generations: {},
    get_generation_download: { jobId: 'job-1' },
    present_generation: { jobId: 'job-1' },
    create_topup_link: { quoteId: '00000000-0000-4000-8000-000000000001' },
  };
  assert.deepEqual([...tools.keys()], Object.keys(validArguments));
  for (const [name, arguments_] of Object.entries(validArguments)) {
    assert.equal(tools.get(name)?.inputSchema.additionalProperties, false);
    const result = await client.callTool({
      name,
      arguments: { ...arguments_, unexpected: true },
    });
    assert.equal(result.isError, true, `${name} must reject an unknown key`);
    assert.equal(calls.get(name) ?? 0, 0, `${name} handler must not run`);
  }

  const curatedPolicyBundle = JSON.parse(
    readFileSync('tests/fixtures/mcp-tool-selection-curated-policy.json', 'utf8')
  ) as {
    decisions: Array<{
      toolCalls: Array<{ name: string; arguments: Record<string, unknown> }>;
    }>;
  };
  for (const decision of curatedPolicyBundle.decisions) {
    for (const toolCall of decision.toolCalls) {
      const before = calls.get(toolCall.name) ?? 0;
      await client.callTool({ name: toolCall.name, arguments: toolCall.arguments });
      assert.equal(
        calls.get(toolCall.name),
        before + 1,
        `${toolCall.name} curated policy arguments must pass its runtime schema`
      );
    }
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
    arguments: { surface: 'video', mode: 'v2v', audio: true, limit: 3 },
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
      mode: 'extend',
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
        }, {
          purpose: 'Source-framed animation',
          engineId: 'minimax-h3',
          mode: 'i2v',
          settings: { durationSec: 5, resolution: '2K' },
          referenceRoles: ['source'],
          clipCount: 1,
          attemptsPerClip: 1,
        }, {
          purpose: 'Source video edit',
          engineId: 'seedance-2-5',
          mode: 'v2v',
          settings: { durationSec: 4, resolution: '480p', aspectRatio: '16:9', audio: true },
          referenceRoles: ['source'],
          clipCount: 1,
          attemptsPerClip: 1,
        }, {
          purpose: 'Clip extension',
          engineId: 'seedance-2-5',
          mode: 'extend',
          settings: { durationSec: 4, resolution: '480p', aspectRatio: '16:9', audio: true },
          referenceRoles: ['source', 'source'],
          clipCount: 1,
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
  assert.deepEqual(listFilter, { surface: 'video', mode: 'v2v', audio: true, limit: 3 });
  assert.equal(modelDetailId, 'minimax-h3');
  assert.deepEqual(recommendationInput, {
    mode: 'extend',
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
