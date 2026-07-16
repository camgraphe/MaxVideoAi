import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

import type { TransactionQueryExecutor } from '../frontend/src/lib/db';
import { AgentApiError } from '../frontend/src/server/agent-api/errors';
import type { CanonicalGenerationRequest } from '../frontend/src/server/agent-api/generation-types';
import {
  computeGenerationCatalogRevision,
} from '../frontend/src/server/agent-api/catalog-revision';
import {
  priceCanonicalGeneration,
} from '../frontend/src/server/agent-api/generation-pricing';
import {
  prepareGeneration,
  type PrepareGenerationDependencies,
  type PrepareGenerationInput,
} from '../frontend/src/server/agent-api/prepare-generation';
import type { AgentPrincipal } from '../frontend/src/server/agent-api/principal';
import type { AgentModel } from '../frontend/src/server/agent-api/types';
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
const now = new Date('2026-07-16T12:00:00.000Z');
const quoteId = '123e4567-e89b-42d3-a456-426614174000';
const expiresAt = new Date('2026-07-16T12:10:00.000Z');
const transactionExecutor = {
  async query() {
    throw new Error('the injected prepare test executor does not execute SQL');
  },
} as TransactionQueryExecutor;

const videoModel: AgentModel = {
  id: 'seedance-2-0-mini',
  label: 'Seedance 2.0 Mini',
  surface: 'video',
  modes: ['t2v', 'i2v', 'ref2v'],
  aspectRatios: ['16:9', '9:16', '1:1'],
  resolutions: ['480p', '720p', '1080p'],
  maxDurationSec: 10,
  audio: true,
  referenceImages: true,
  availability: 'available',
};
const imageModel: AgentModel = {
  id: 'flux-pro',
  label: 'Flux Pro',
  surface: 'image',
  modes: ['t2i', 'i2i'],
  aspectRatios: ['16:9', '1:1'],
  resolutions: ['1024x1024', '2048x2048'],
  maxDurationSec: null,
  audio: false,
  referenceImages: true,
  availability: 'available',
};
const gptImageModel: AgentModel = {
  ...imageModel,
  id: 'gpt-image-2',
  label: 'GPT Image 2',
  resolutions: ['auto', 'custom', '1024x1024'],
};

const videoInput: PrepareGenerationInput = {
  surface: 'video',
  engineId: videoModel.id,
  mode: 't2v',
  prompt: '  A quiet paper city at sunrise  ',
  settings: {
    durationSec: 5,
    resolution: '720p',
    aspectRatio: '16:9',
    audio: true,
  },
  references: [],
  outputCount: 1,
};
const imageInput: PrepareGenerationInput = {
  surface: 'image',
  engineId: imageModel.id,
  mode: 't2i',
  prompt: 'A precise paper city keyframe',
  settings: {
    resolution: '1024x1024',
    aspectRatio: '1:1',
    quality: 'high',
  },
  references: [],
  outputCount: 1,
};

type Captures = {
  events: string[];
  inserted: Array<Record<string, unknown>>;
  priced: CanonicalGenerationRequest[];
  spendingExecutors: TransactionQueryExecutor[];
};

function baseDependencies(
  overrides: Partial<PrepareGenerationDependencies> = {},
): { deps: PrepareGenerationDependencies; captures: Captures } {
  const captures: Captures = { events: [], inserted: [], priced: [], spendingExecutors: [] };
  const deps: PrepareGenerationDependencies = {
    paidGenerationEnabled: () => {
      captures.events.push('feature');
      return true;
    },
    getAccountRestriction: async () => {
      captures.events.push('restriction');
      return null;
    },
    listPublicModels: async () => {
      captures.events.push('catalog');
      return [videoModel, imageModel];
    },
    priceGeneration: async (request) => {
      captures.events.push('pricing');
      captures.priced.push(request);
      return {
        priceCents: request.surface === 'video' ? 125 : 45,
        currency: 'USD',
        pricingSnapshot: {
          totalCents: request.surface === 'video' ? 125 : 45,
          currency: 'USD',
          provenance: { source: 'canonical-test' },
        },
      };
    },
    getWalletSummary: async () => {
      captures.events.push('wallet');
      return { balanceCents: 500, currency: 'USD', pendingCents: 0, hasCompletedTopUp: true };
    },
    withTransaction: async (callback) => {
      captures.events.push('transaction');
      return callback(transactionExecutor);
    },
    checkSpendingLimits: async (_input, dependencies) => {
      captures.events.push('spending');
      captures.spendingExecutors.push(dependencies.executor);
      return {
        allowed: true,
        acceptedTodayCents: 0,
        projectedTodayCents: 125,
        limits: {
          perGenerationCents: null,
          dailyCents: null,
          webApprovalAboveCents: null,
        },
      };
    },
    insertPreparedQuote: async (input, dependencies) => {
      captures.events.push('persistence');
      captures.inserted.push({ ...input, executor: dependencies.executor });
      return {
        quoteId,
        userId: input.userId,
        oauthClientId: input.oauthClientId,
        request: input.request,
        requestHash: input.requestHash,
        catalogRevision: input.catalogRevision,
        pricingSnapshot: input.pricingSnapshot,
        priceCents: input.priceCents,
        currency: input.currency,
        fundingMode: 'wallet',
        state: 'prepared',
        jobId: null,
        expiresAt,
        claimedAt: null,
        createdAt: now,
        updatedAt: now,
      };
    },
    accountUrl: 'https://maxvideoai.com/account/connections',
    now: () => now,
    ...overrides,
  };
  return { deps, captures };
}

async function expectAgentError(
  operation: Promise<unknown>,
  code: AgentApiError['code'],
): Promise<void> {
  await assert.rejects(operation, (error: unknown) => {
    assert.ok(error instanceof AgentApiError);
    assert.equal(error.code, code);
    return true;
  });
}

test('valid video and image requests persist immutable exact quotes before returning', async () => {
  for (const [input, expectedPrice] of [[videoInput, 125], [imageInput, 45]] as const) {
    const { deps, captures } = baseDependencies();
    const prepared = await prepareGeneration(input, principal, deps);

    assert.equal(prepared.quoteId, quoteId);
    assert.equal(prepared.expiresAt, expiresAt.toISOString());
    assert.equal(prepared.price.amountCents, expectedPrice);
    assert.equal(prepared.price.currency, 'USD');
    assert.deepEqual(prepared.balance, {
      beforeCents: 500,
      afterCents: 500 - expectedPrice,
    });
    assert.equal(prepared.fundingMode, 'wallet');
    assert.equal(prepared.confirmationRequired, true);
    assert.equal(prepared.topupRequired, false);
    assert.equal(prepared.summary.prompt, input.prompt.trim());
    assert.match(prepared.requestHash, /^[a-f0-9]{64}$/u);
    assert.equal(captures.inserted.length, 1);
    assert.equal(captures.inserted[0].requestHash, prepared.requestHash);
    assert.deepEqual(captures.inserted[0].request, prepared.summary);
    assert.equal(captures.inserted[0].executor, transactionExecutor);
    assert.deepEqual(captures.spendingExecutors, [transactionExecutor]);
    assert.deepEqual(captures.events, [
      'feature', 'restriction', 'catalog', 'pricing', 'wallet',
      'transaction', 'spending', 'persistence',
    ]);
  }
});

test('principal, feature flag, and account restriction fail in the required order', async () => {
  const missingPrincipal = baseDependencies();
  await expectAgentError(
    prepareGeneration(videoInput, null as never, missingPrincipal.deps),
    'AUTH_REQUIRED',
  );
  assert.deepEqual(missingPrincipal.captures.events, []);

  const disabled = baseDependencies({ paidGenerationEnabled: () => false });
  await expectAgentError(prepareGeneration(videoInput, principal, disabled.deps), 'ENGINE_UNAVAILABLE');
  assert.deepEqual(disabled.captures.events, []);

  const restricted = baseDependencies({
    getAccountRestriction: async () => ({
      userId: principal.userId,
      reason: 'security',
      message: 'private detail must not escape',
      restrictedAt: now.toISOString(),
    }),
  });
  const invalidInput = { ...videoInput, settings: { provider_secret: 'hidden' } } as never;
  await expectAgentError(prepareGeneration(invalidInput, principal, restricted.deps), 'ACCOUNT_RESTRICTED');
  assert.deepEqual(restricted.captures.events, ['feature']);
});

test('canonical, public-engine, mode, surface, and reference validation fail closed before pricing', async () => {
  const invalidCanonical = baseDependencies();
  await expectAgentError(
    prepareGeneration({ ...videoInput, settings: { provider_secret: 'hidden' } } as never, principal, invalidCanonical.deps),
    'PARAMETER_INVALID',
  );
  assert.deepEqual(invalidCanonical.captures.events, ['feature', 'restriction']);

  const disabledEngine = baseDependencies({ listPublicModels: async () => [] });
  await expectAgentError(prepareGeneration(videoInput, principal, disabledEngine.deps), 'ENGINE_UNAVAILABLE');

  const modeMismatch = baseDependencies();
  await expectAgentError(
    prepareGeneration({ ...videoInput, mode: 'i2v' }, principal, modeMismatch.deps),
    'REFERENCE_REQUIRED',
  );

  const unsupportedMode = baseDependencies({
    listPublicModels: async () => [{ ...videoModel, modes: ['t2v'] }],
  });
  await expectAgentError(
    prepareGeneration({ ...videoInput, mode: 'i2v' }, principal, unsupportedMode.deps),
    'MODE_UNSUPPORTED',
  );

  const invalidSettings = baseDependencies();
  await expectAgentError(
    prepareGeneration({
      ...videoInput,
      settings: { ...videoInput.settings, durationSec: 11 },
    }, principal, invalidSettings.deps),
    'PARAMETER_INVALID',
  );
  assert.equal(invalidSettings.captures.events.includes('pricing'), false);

  const forbiddenReference = baseDependencies();
  await expectAgentError(
    prepareGeneration({
      ...videoInput,
      references: [{ kind: 'asset', assetId: 'asset-1', role: 'source' }],
    }, principal, forbiddenReference.deps),
    'REFERENCE_INVALID',
  );
  assert.equal(forbiddenReference.captures.events.includes('pricing'), false);
});

test('surface validation rejects semantically mistyped canonical settings before pricing', async () => {
  for (const settings of [
    { ...videoInput.settings, cameraFixed: 'yes' },
    { ...videoInput.settings, negativePrompt: 42 },
    { ...videoInput.settings, safetyChecker: null },
  ]) {
    const { deps, captures } = baseDependencies();
    await expectAgentError(
      prepareGeneration({ ...videoInput, settings }, principal, deps),
      'PARAMETER_INVALID',
    );
    assert.equal(captures.events.includes('pricing'), false);
  }
});

test('image requests fail closed when canonical input cannot represent exact pricing facts', async () => {
  const unsafeCases: Array<{ input: PrepareGenerationInput; model: AgentModel }> = [
    {
      input: {
        ...imageInput,
        settings: { ...imageInput.settings, enableWebSearch: true },
      },
      model: imageModel,
    },
    {
      input: {
        ...imageInput,
        engineId: gptImageModel.id,
        mode: 'i2i',
        settings: { ...imageInput.settings, resolution: 'auto' },
        references: [{ kind: 'asset', assetId: 'asset-1', role: 'source' }],
      },
      model: gptImageModel,
    },
    {
      input: {
        ...imageInput,
        engineId: gptImageModel.id,
        settings: { ...imageInput.settings, resolution: 'custom' },
      },
      model: gptImageModel,
    },
  ];

  for (const unsafe of unsafeCases) {
    const { deps, captures } = baseDependencies({
      listPublicModels: async () => [unsafe.model],
    });
    await expectAgentError(prepareGeneration(unsafe.input, principal, deps), 'PARAMETER_INVALID');
    assert.equal(captures.events.includes('pricing'), false);
    assert.equal(captures.inserted.length, 0);
  }
});

test('insufficient funds still persist a quote and expose a non-negative projected balance', async () => {
  const { deps, captures } = baseDependencies({
    getWalletSummary: async () => ({
      balanceCents: 20,
      currency: 'USD',
      pendingCents: 0,
      hasCompletedTopUp: false,
    }),
  });
  const prepared = await prepareGeneration(videoInput, principal, deps);
  assert.equal(prepared.topupRequired, true);
  assert.deepEqual(prepared.balance, { beforeCents: 20, afterCents: 0 });
  assert.equal(captures.inserted.length, 1);
});

test('wallet currency mismatch fails before spending and quote persistence', async () => {
  const { deps, captures } = baseDependencies({
    getWalletSummary: async () => ({
      balanceCents: 500,
      currency: 'EUR',
      pendingCents: 0,
      hasCompletedTopUp: true,
    }),
  });
  await expectAgentError(prepareGeneration(videoInput, principal, deps), 'INTERNAL_ERROR');
  assert.equal(captures.events.includes('spending'), false);
  assert.equal(captures.inserted.length, 0);
});

test('an inconsistent canonical pricing snapshot fails closed before wallet and persistence', async () => {
  const { deps, captures } = baseDependencies({
    priceGeneration: async () => ({
      priceCents: 125,
      currency: 'USD',
      pricingSnapshot: { totalCents: 124, currency: 'USD' },
    }),
  });
  await expectAgentError(prepareGeneration(videoInput, principal, deps), 'INTERNAL_ERROR');
  assert.equal(captures.events.includes('wallet'), false);
  assert.equal(captures.inserted.length, 0);
});

test('spending-limit denial returns a safe web handoff and never persists a quote', async () => {
  const { deps, captures } = baseDependencies({
    checkSpendingLimits: async () => ({
      allowed: false,
      code: 'SPENDING_LIMIT_EXCEEDED',
      reason: 'web_approval',
      message: 'private spending internals must not escape',
      approvalUrl: '/account/connections?focus=mcp-spending',
      acceptedTodayCents: 0,
      projectedTodayCents: 125,
      limits: { perGenerationCents: null, dailyCents: null, webApprovalAboveCents: 100 },
    }),
  });
  await assert.rejects(prepareGeneration(videoInput, principal, deps), (error: unknown) => {
    assert.ok(error instanceof AgentApiError);
    assert.equal(error.code, 'SPENDING_LIMIT_EXCEEDED');
    assert.equal(error.message.includes('private'), false);
    assert.deepEqual(error.nextAction, {
      type: 'open_url',
      url: 'https://maxvideoai.com/account/connections?focus=mcp-spending',
    });
    return true;
  });
  assert.deepEqual(captures.spendingExecutors, []);
  assert.equal(captures.inserted.length, 0);
});

test('catalog revision and full versioned pricing snapshot are deterministic and persisted', async () => {
  const first = computeGenerationCatalogRevision([videoModel, imageModel]);
  const reordered = computeGenerationCatalogRevision([imageModel, videoModel]);
  const changed = computeGenerationCatalogRevision([{ ...videoModel, resolutions: ['480p'] }, imageModel]);
  const relabelled = computeGenerationCatalogRevision([{ ...videoModel, label: 'Renamed model' }, imageModel]);
  assert.equal(first, reordered);
  assert.notEqual(first, changed);
  assert.notEqual(first, relabelled);
  assert.match(first, /^mcp-catalog-v1:[a-f0-9]{64}$/u);

  const { deps, captures } = baseDependencies();
  await prepareGeneration(videoInput, principal, deps);
  assert.equal(captures.inserted[0].catalogRevision, first);
  const snapshot = captures.inserted[0].pricingSnapshot as Record<string, unknown>;
  assert.equal(snapshot.schemaVersion, 1);
  assert.equal(snapshot.catalogRevision, first);
  assert.equal(snapshot.surface, 'video');
  assert.equal(snapshot.engineId, videoModel.id);
  assert.deepEqual(snapshot.canonicalPricing, {
    totalCents: 125,
    currency: 'USD',
    provenance: { source: 'canonical-test' },
  });
});

test('generation pricing delegates video and image formulas to the existing canonical owners', async () => {
  let videoPayload: Record<string, unknown> | null = null;
  let imagePayload: Record<string, unknown> | null = null;
  const videoRequest = { ...videoInput, schemaVersion: 1, prompt: videoInput.prompt.trim() } as CanonicalGenerationRequest;
  const imageRequest = { ...imageInput, schemaVersion: 1 } as CanonicalGenerationRequest;
  const deps = {
    computeVideoPreflight: async (payload: Record<string, unknown>) => {
      videoPayload = payload;
      return {
        ok: true,
        total: 125,
        currency: 'USD',
        pricing: { totalCents: 125, currency: 'USD', marker: 'video-canonical' },
      };
    },
    estimateImage: async (payload: Record<string, unknown>) => {
      imagePayload = payload;
      return {
        pricing: { totalCents: 45, currency: 'USD', marker: 'image-canonical' },
        normalized: {
          engineId: imageModel.id,
          mode: 't2i',
          numImages: 1,
          resolution: '1024x1024',
          quality: 'high',
          aspectRatio: '1:1',
          customImageSize: null,
          referenceImageCount: 0,
          referenceImageSizes: [],
        },
      };
    },
  };
  const videoPrice = await priceCanonicalGeneration(videoRequest, deps as never);
  const imagePrice = await priceCanonicalGeneration(imageRequest, deps as never);

  assert.equal(videoPrice.priceCents, 125);
  assert.equal(imagePrice.priceCents, 45);
  assert.equal((videoPrice.pricingSnapshot.marker as string), 'video-canonical');
  assert.equal((imagePrice.pricingSnapshot.marker as string), 'image-canonical');
  assert.deepEqual(videoPayload, {
    engine: videoModel.id,
    mode: 't2v',
    durationSec: 5,
    resolution: '720p',
    aspectRatio: '16:9',
    fps: 24,
    audio: true,
  });
  assert.deepEqual(imagePayload, {
    engineId: imageModel.id,
    mode: 't2i',
    numImages: 1,
    resolution: '1024x1024',
    quality: 'high',
    aspectRatio: '1:1',
    referenceImageCount: 0,
    referenceImageSizes: [],
  });
});

test('prepare_generation is gated out by default and accurately annotated when explicitly injected on', async (t) => {
  const prepared = {
    quoteId,
    expiresAt: expiresAt.toISOString(),
    requestHash: 'a'.repeat(64),
    summary: { ...videoInput, schemaVersion: 1, prompt: videoInput.prompt.trim() },
    price: { amountCents: 125, currency: 'USD' },
    balance: { beforeCents: 500, afterCents: 375 },
    fundingMode: 'wallet' as const,
    confirmationRequired: true as const,
    topupRequired: false,
  };
  const services: MaxVideoAiMcpServices = {
    async getAccountStatus() {
      throw new Error('unused');
    },
    async listModels() {
      return [];
    },
    async recommendModels() {
      return { recommendations: [], nextAction: 'clarify_requirements' };
    },
    async prepareGeneration(input, receivedPrincipal) {
      assert.equal(receivedPrincipal, principal);
      assert.equal(input.engineId, videoModel.id);
      return prepared;
    },
  };
  const defaultServer = createMaxVideoAiMcpServer(principal, services);
  const enabledServer = createMaxVideoAiMcpServer(principal, services, { paidGeneration: true });
  const [defaultClientTransport, defaultServerTransport] = InMemoryTransport.createLinkedPair();
  const [enabledClientTransport, enabledServerTransport] = InMemoryTransport.createLinkedPair();
  await defaultServer.connect(defaultServerTransport);
  await enabledServer.connect(enabledServerTransport);
  const defaultClient = new Client({ name: 'default-contract', version: '1.0.0' });
  const enabledClient = new Client({ name: 'enabled-contract', version: '1.0.0' });
  await defaultClient.connect(defaultClientTransport);
  await enabledClient.connect(enabledClientTransport);
  t.after(async () => {
    await defaultClient.close();
    await enabledClient.close();
    await defaultServer.close();
    await enabledServer.close();
  });

  assert.deepEqual((await defaultClient.listTools()).tools.map((tool) => tool.name), [
    'get_account_status', 'list_models', 'recommend_models',
  ]);
  const tools = (await enabledClient.listTools()).tools;
  assert.deepEqual(tools.map((tool) => tool.name), [
    'get_account_status', 'list_models', 'recommend_models', 'prepare_generation',
  ]);
  const prepareTool = tools.at(-1);
  assert.equal(prepareTool?.annotations?.readOnlyHint, true);
  assert.equal(prepareTool?.annotations?.destructiveHint, false);
  assert.equal(prepareTool?.annotations?.openWorldHint, false);
  assert.match(prepareTool?.description ?? '', /does not spend or generate/i);
  const result = await enabledClient.callTool({
    name: 'prepare_generation',
    arguments: videoInput,
  });
  assert.deepEqual(result.structuredContent, prepared);
});

test('MCP tool adapter cannot import providers, wallet mutation, or job creation', () => {
  const source = readFileSync('frontend/src/server/mcp/tools/prepare-generation.ts', 'utf8');
  assert.doesNotMatch(source, /video-providers|image-providers|provider|reserveWallet|app_receipts|create.*Job/i);
  assert.match(source, /readOnlyHint:\s*true/);
  assert.match(source, /destructiveHint:\s*false/);
  assert.match(source, /openWorldHint:\s*false/);
});
