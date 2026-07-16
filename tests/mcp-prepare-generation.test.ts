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
import type { AgentPublicGenerationEngine } from '../frontend/src/server/agent-api/model-catalog';
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
import type { EngineCaps, EngineInputField, EngineModeUiCaps } from '../frontend/types/engines';
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

function publicEngine(model: AgentModel): AgentPublicGenerationEngine {
  const isVideo = model.surface === 'video';
  const inputFields: EngineInputField[] = isVideo
    ? [
        { id: 'prompt', type: 'text', label: 'Prompt' },
        { id: 'duration', type: 'enum', label: 'Duration', values: ['5', '10'] },
        { id: 'resolution', type: 'enum', label: 'Resolution', values: model.resolutions },
        { id: 'aspect_ratio', type: 'enum', label: 'Ratio', values: model.aspectRatios },
        { id: 'generate_audio', type: 'boolean', label: 'Audio' },
        { id: 'image_url', type: 'image', label: 'Source', modes: ['i2v'], requiredInModes: ['i2v'], minCount: 1, maxCount: 1 },
        { id: 'image_urls', type: 'image', label: 'References', modes: ['ref2v'], requiredInModes: ['ref2v'], minCount: 1, maxCount: 2 },
      ]
    : [
        { id: 'prompt', type: 'text', label: 'Prompt' },
        { id: 'resolution', type: 'enum', label: 'Resolution', values: model.resolutions, modes: ['t2i', 'i2i'] },
        { id: 'aspect_ratio', type: 'enum', label: 'Ratio', values: model.aspectRatios, modes: ['t2i', 'i2i'] },
        { id: 'quality', type: 'enum', label: 'Quality', values: ['low', 'medium', 'high'] },
        { id: 'output_format', type: 'enum', label: 'Format', values: ['png', 'jpeg', 'webp'] },
        { id: 'enable_web_search', type: 'boolean', label: 'Web search' },
        { id: 'image_urls', type: 'image', label: 'References', modes: ['i2i'], requiredInModes: ['i2i'], minCount: 1, maxCount: 4 },
      ];
  const modeCaps = Object.fromEntries(model.modes.map((mode) => [mode, {
    modes: [mode],
    ...(isVideo ? { duration: { options: [5, 10], default: 5 }, fps: [24], audioToggle: model.audio } : {}),
    resolution: model.resolutions,
    aspectRatio: model.aspectRatios,
  } satisfies EngineModeUiCaps])) as AgentPublicGenerationEngine['modeCaps'];
  const caps: EngineCaps = {
    id: model.id,
    label: model.label,
    provider: 'test',
    status: 'live',
    latencyTier: 'standard',
    modes: model.modes,
    maxDurationSec: model.maxDurationSec ?? 0,
    resolutions: model.resolutions as EngineCaps['resolutions'],
    aspectRatios: model.aspectRatios as EngineCaps['aspectRatios'],
    fps: isVideo ? [24] : [1],
    audio: model.audio,
    upscale4k: false,
    extend: false,
    motionControls: false,
    keyframes: false,
    params: {},
    inputLimits: { promptMaxChars: 12_000 },
    inputSchema: { required: [inputFields[0]], optional: inputFields.slice(1) },
    updatedAt: '2026-07-16T00:00:00.000Z',
    ttlSec: 600,
    availability: 'available',
  };
  return { engine: caps, surface: model.surface, publicModes: model.modes, modeCaps };
}

const videoCapability = publicEngine(videoModel);
const imageCapability = publicEngine(imageModel);
const gptImageCapability = publicEngine(gptImageModel);

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
    listPublicEngines: async () => {
      captures.events.push('catalog');
      return [videoCapability, imageCapability];
    },
    resolveMembershipPricing: async () => {
      captures.events.push('membership');
      return {
        tier: 'member',
        source: 'app_receipts_rolling_30d',
        spent30Cents: 0,
        thresholdCents: 0,
        discountPercent: 0,
      };
    },
    priceGeneration: async (request, membershipTier) => {
      captures.events.push('pricing');
      captures.priced.push(request);
      return {
        priceCents: request.surface === 'video' ? 125 : 45,
        currency: 'USD',
        membershipTier,
        pricingSnapshot: {
          totalCents: request.surface === 'video' ? 125 : 45,
          currency: 'USD',
          membershipTier,
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
      'feature', 'restriction', 'catalog', 'membership', 'pricing', 'wallet',
      'transaction', 'spending', 'persistence',
    ]);
  }
});

test('authoritative Member, Plus, and Pro contexts set exact quotes and cannot be spoofed by MCP input', async () => {
  const exactPrices = { member: 125, plus: 119, pro: 113 } as const;
  for (const tier of ['member', 'plus', 'pro'] as const) {
    const membership = {
      tier,
      source: 'app_receipts_rolling_30d' as const,
      spent30Cents: tier === 'member' ? 0 : tier === 'plus' ? 5_000 : 20_000,
      thresholdCents: tier === 'member' ? 0 : tier === 'plus' ? 5_000 : 20_000,
      discountPercent: tier === 'member' ? 0 : tier === 'plus' ? 0.05 : 0.1,
    };
    const overrides = {
      resolveMembershipPricing: async () => membership,
      priceGeneration: async (_request: CanonicalGenerationRequest, received: string) => {
        assert.equal(received, membership.tier);
        return {
          priceCents: exactPrices[tier],
          currency: 'USD',
          membershipTier: tier,
          pricingSnapshot: {
            totalCents: exactPrices[tier],
            currency: 'USD',
            membershipTier: tier,
          },
        };
      },
    } as unknown as Partial<PrepareGenerationDependencies>;
    const { deps, captures } = baseDependencies(overrides);
    const prepared = await prepareGeneration(videoInput, principal, deps);
    assert.equal(prepared.price.amountCents, exactPrices[tier]);
    const stored = captures.inserted[0].pricingSnapshot as Record<string, unknown>;
    assert.deepEqual(stored.membership, membership);
  }

  for (const spoofed of [
    { ...videoInput, membershipTier: 'pro' },
    { ...videoInput, settings: { ...videoInput.settings, membershipTier: 'pro' } },
  ]) {
    const { deps, captures } = baseDependencies();
    await expectAgentError(prepareGeneration(spoofed as never, principal, deps), 'PARAMETER_INVALID');
    assert.equal(captures.events.includes('pricing'), false);
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

  const disabledEngine = baseDependencies({ listPublicEngines: async () => [] });
  await expectAgentError(prepareGeneration(videoInput, principal, disabledEngine.deps), 'ENGINE_UNAVAILABLE');

  const modeMismatch = baseDependencies();
  await expectAgentError(
    prepareGeneration({ ...videoInput, mode: 'i2v' }, principal, modeMismatch.deps),
    'REFERENCE_REQUIRED',
  );

  const unsupportedMode = baseDependencies({
    listPublicEngines: async () => [{ ...videoCapability, publicModes: ['t2v'] }],
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
  const unsafeCases: Array<{ input: PrepareGenerationInput; capability: AgentPublicGenerationEngine }> = [
    {
      input: {
        ...imageInput,
        settings: { ...imageInput.settings, enableWebSearch: true },
      },
      capability: imageCapability,
    },
    {
      input: {
        ...imageInput,
        engineId: gptImageModel.id,
        mode: 'i2i',
        settings: { ...imageInput.settings, resolution: 'auto' },
        references: [{ kind: 'asset', assetId: 'asset-1', role: 'source' }],
      },
      capability: gptImageCapability,
    },
    {
      input: {
        ...imageInput,
        engineId: gptImageModel.id,
        settings: { ...imageInput.settings, resolution: 'custom' },
      },
      capability: gptImageCapability,
    },
  ];

  for (const unsafe of unsafeCases) {
    const { deps, captures } = baseDependencies({
      listPublicEngines: async () => [unsafe.capability],
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

test('invalid authoritative membership output fails as an internal error before pricing', async () => {
  const { deps, captures } = baseDependencies({
    resolveMembershipPricing: async () => ({
      tier: 'vip',
      source: 'app_receipts_rolling_30d',
      spent30Cents: 0,
      thresholdCents: 0,
      discountPercent: 0,
    } as never),
  });
  await expectAgentError(prepareGeneration(videoInput, principal, deps), 'INTERNAL_ERROR');
  assert.equal(captures.events.includes('pricing'), false);
  assert.equal(captures.inserted.length, 0);
});

test('an inconsistent canonical pricing snapshot fails closed before wallet and persistence', async () => {
  const { deps, captures } = baseDependencies({
    priceGeneration: async () => ({
      priceCents: 125,
      currency: 'USD',
      membershipTier: 'member',
      pricingSnapshot: { totalCents: 124, currency: 'USD', membershipTier: 'member' },
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
  const first = computeGenerationCatalogRevision([videoCapability, imageCapability]);
  const reordered = computeGenerationCatalogRevision([imageCapability, videoCapability]);
  const changed = computeGenerationCatalogRevision([
    { ...videoCapability, engine: { ...videoCapability.engine, resolutions: ['480p'] } },
    imageCapability,
  ]);
  const relabelled = computeGenerationCatalogRevision([
    { ...videoCapability, engine: { ...videoCapability.engine, label: 'Renamed model' } },
    imageCapability,
  ]);
  assert.equal(first, reordered);
  assert.notEqual(first, changed);
  assert.notEqual(first, relabelled);
  assert.match(first, /^mcp-catalog-v2:[a-f0-9]{64}$/u);

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
    membershipTier: 'member',
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
        pricing: { totalCents: 125, currency: 'USD', membershipTier: 'member', marker: 'video-canonical' },
      };
    },
    estimateImage: async (payload: Record<string, unknown>) => {
      imagePayload = payload;
      return {
        pricing: { totalCents: 45, currency: 'USD', membershipTier: 'member', marker: 'image-canonical' },
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
  const videoPrice = await priceCanonicalGeneration(videoRequest, 'member', deps as never);
  const imagePrice = await priceCanonicalGeneration(imageRequest, 'member', deps as never);

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
    user: { memberTier: 'member' },
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
    membershipTier: 'member',
  });
});

test('generation pricing passes the authoritative tier to both canonical pricing owners', async () => {
  const videoRequest = { ...videoInput, schemaVersion: 1, prompt: videoInput.prompt.trim() } as CanonicalGenerationRequest;
  const imageRequest = { ...imageInput, schemaVersion: 1 } as CanonicalGenerationRequest;
  const seen: string[] = [];
  const deps = {
    computeVideoPreflight: async (payload: { user?: { memberTier?: string } }) => {
      seen.push(`video:${payload.user?.memberTier ?? 'missing'}`);
      return {
        ok: true,
        total: 113,
        currency: 'USD',
        pricing: { totalCents: 113, currency: 'USD', membershipTier: 'pro' },
      };
    },
    estimateImage: async (payload: { membershipTier?: string }) => {
      seen.push(`image:${payload.membershipTier ?? 'missing'}`);
      return {
        pricing: { totalCents: 18, currency: 'USD', membershipTier: 'pro' },
        normalized: {},
      };
    },
  };
  assert.equal((await priceCanonicalGeneration(videoRequest, 'pro' as never, deps as never)).priceCents, 113);
  assert.equal((await priceCanonicalGeneration(imageRequest, 'pro' as never, deps as never)).priceCents, 18);
  assert.deepEqual(seen, ['video:pro', 'image:pro']);
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
