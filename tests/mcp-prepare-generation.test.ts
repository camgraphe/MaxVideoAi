import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

import { listFalEngines } from '../frontend/src/config/falEngines';
import type { TransactionQueryExecutor } from '../frontend/src/lib/db';
import { AgentApiError } from '../frontend/src/server/agent-api/errors';
import type { CanonicalGenerationRequest } from '../frontend/src/server/agent-api/generation-types';
import {
  computeGenerationCatalogRevision,
} from '../frontend/src/server/agent-api/catalog-revision';
import type { AgentPublicGenerationEngine } from '../frontend/src/server/agent-api/model-catalog';
import {
  priceCanonicalGeneration,
  priceCanonicalGenerationInExecutor,
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
        ...(model.id === 'gpt-image-2' ? [
          { id: 'image_width', type: 'number', label: 'Width', modes: ['t2i', 'i2i'], min: 16, max: 3840, step: 16 },
          { id: 'image_height', type: 'number', label: 'Height', modes: ['t2i', 'i2i'], min: 16, max: 3840, step: 16 },
          { id: 'mask_url', type: 'image', label: 'Mask', modes: ['i2i'], minCount: 0, maxCount: 1 },
        ] satisfies EngineInputField[] : []),
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

function registryCapability(engineId: string): AgentPublicGenerationEngine {
  const entry = listFalEngines().find((candidate) => candidate.id === engineId);
  assert.ok(entry, `Missing registry engine ${engineId}`);
  const publicModes = entry.modes
    .map((mode) => mode.mode)
    .filter((mode): mode is AgentPublicGenerationEngine['publicModes'][number] =>
      ['t2v', 'i2v', 'ref2v', 'fl2v', 'v2v', 'r2v', 'extend', 'a2v', 't2i', 'i2i'].includes(mode));
  return {
    engine: entry.engine,
    surface: entry.category === 'image' ? 'image' : 'video',
    publicModes,
    modeCaps: Object.fromEntries(entry.modes.map((mode) => [mode.mode, mode.ui])),
  };
}

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
        fundingMode: input.fundingMode,
        trialFunding: null,
        state: 'prepared',
        jobId: null,
        expiresAt,
        claimedAt: null,
        createdAt: now,
        updatedAt: now,
      };
    },
    getTrialEligibility: async () => {
      throw new Error('non-candidate paid tests must not check trial eligibility');
    },
    checkTrialRisk: async () => {
      throw new Error('non-candidate paid tests must not check trial risk');
    },
    recordTrialQuotePreparedAudit: async () => {
      throw new Error('non-candidate paid tests must not write trial audit');
    },
    trialRiskContext: { clientIp: null, userAgent: null },
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

  const retiredEngine = baseDependencies({ listPublicEngines: async () => [] });
  await expectAgentError(prepareGeneration({
    ...videoInput,
    engineId: 'retired-video-fixture',
  }, principal, retiredEngine.deps), 'ENGINE_UNAVAILABLE');
  assert.deepEqual(retiredEngine.captures.events, ['feature', 'restriction']);
  assert.equal(retiredEngine.captures.priced.length, 0);
  assert.equal(retiredEngine.captures.inserted.length, 0);

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

test('prepare rejects non-default HTTPS reference ports before catalog, pricing, quote, or reservation work', async () => {
  const invalidUrl = baseDependencies({
    listPublicEngines: async () => [registryCapability('seedance-2-5')],
  });
  await expectAgentError(prepareGeneration({
    surface: 'video',
    engineId: 'seedance-2-5',
    mode: 'i2v',
    prompt: 'Animate this controlled source.',
    settings: { durationSec: 4, resolution: '480p', audio: true },
    references: [{
      kind: 'https',
      url: 'https://host:8443/source',
      role: 'source',
      mediaKind: 'image',
    }],
    outputCount: 1,
  }, principal, invalidUrl.deps), 'PARAMETER_INVALID');

  assert.deepEqual(invalidUrl.captures.events, ['feature', 'restriction']);
  assert.equal(invalidUrl.captures.inserted.length, 0);
  assert.equal(invalidUrl.captures.priced.length, 0);
  assert.equal(invalidUrl.captures.spendingExecutors.length, 0);
});

test('prepare rejects a DB-verified image asset in a source-video slot with neutral wording', async () => {
  const candidate = registryCapability('seedance-2-5');
  const input: PrepareGenerationInput = {
    surface: 'video',
    engineId: 'seedance-2-5',
    mode: 'v2v',
    prompt: 'Edit this source clip.',
    settings: { durationSec: 4, resolution: '480p', aspectRatio: '16:9', audio: true },
    references: [{ kind: 'asset', assetId: 'image-asset', role: 'source' }],
    outputCount: 1,
  };
  const { deps, captures } = baseDependencies({
    listPublicEngines: async () => [candidate],
    resolveGenerationReferences: async () => [{
      assetId: 'image-asset',
      role: 'source',
      mediaKind: 'image',
      storageUrl: 'https://assets.example.com/image.png',
      width: 1024,
      height: 1024,
      mimeType: 'image/png',
    }],
  });

  await assert.rejects(prepareGeneration(input, principal, deps), (error: unknown) => {
    assert.ok(error instanceof AgentApiError);
    assert.equal(error.code, 'REFERENCE_INVALID');
    assert.match(error.message, /reference media/i);
    assert.doesNotMatch(error.message, /image reference/i);
    return true;
  });
  assert.equal(captures.events.includes('pricing'), false);
});

test('prepare preserves resolver error details but neutralizes v2v asset wording', async () => {
  const candidate = registryCapability('seedance-2-5');
  const input: PrepareGenerationInput = {
    surface: 'video',
    engineId: 'seedance-2-5',
    mode: 'v2v',
    prompt: 'Edit this source clip.',
    settings: { durationSec: 4, resolution: '480p', aspectRatio: '16:9', audio: true },
    references: [{ kind: 'asset', assetId: 'private-source', role: 'source' }],
    outputCount: 1,
  };
  const cases = [
    ['missing', 'REFERENCE_NOT_FOUND', 'Reference image not found.', 'Reference media not found.'],
    ['wrong-kind', 'REFERENCE_INVALID', 'Reference image is not usable.', 'Reference media is not usable.'],
    ['not-ready', 'REFERENCE_INVALID', 'Reference image is not ready.', 'Reference media is not usable.'],
  ] as const;

  for (const [label, code, privateMessage, publicMessage] of cases) {
    const nextAction = { type: 'select_reference_media', label };
    const { deps, captures } = baseDependencies({
      listPublicEngines: async () => [candidate],
      resolveGenerationReferences: async () => {
        throw new AgentApiError(code, privateMessage, true, nextAction);
      },
    });
    await assert.rejects(prepareGeneration(input, principal, deps), (error: unknown) => {
      assert.ok(error instanceof AgentApiError);
      assert.equal(error.code, code);
      assert.equal(error.message, publicMessage);
      assert.equal(error.retryable, true);
      assert.deepEqual(error.nextAction, nextAction);
      assert.doesNotMatch(error.message, /image/iu);
      return true;
    });
    assert.equal(captures.events.includes('pricing'), false, label);
  }
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
        engineId: gptImageModel.id,
        mode: 'i2i',
        settings: { ...imageInput.settings, resolution: 'auto' },
        references: [{
          kind: 'https',
          url: 'https://assets.example.com/source.png',
          role: 'source',
          mediaKind: 'image',
        }],
      },
      capability: gptImageCapability,
    },
    {
      input: {
        ...imageInput,
        engineId: gptImageModel.id,
        settings: { ...imageInput.settings, resolution: 'custom', imageWidth: 1280 },
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

test('GPT Image 2 custom dimensions and owned-reference auto sizing are exact and quotable', async () => {
  const cases: PrepareGenerationInput[] = [
    {
      ...imageInput,
      engineId: gptImageModel.id,
      settings: {
        ...imageInput.settings,
        resolution: 'custom',
        imageWidth: 1280,
        imageHeight: 768,
      },
    },
    {
      ...imageInput,
      engineId: gptImageModel.id,
      mode: 'i2i',
      settings: { ...imageInput.settings, resolution: 'auto' },
      references: [{ kind: 'asset', assetId: 'asset-1', role: 'source' }],
    },
  ];
  for (const input of cases) {
    const { deps, captures } = baseDependencies({
      listPublicEngines: async () => [gptImageCapability],
      resolveGenerationReferences: async () => [{
        assetId: 'asset-1', role: 'source', mediaKind: 'image',
        storageUrl: 'https://assets.example.com/source.png',
        width: 1536, height: 1024, mimeType: 'image/png',
      }],
    });
    const prepared = await prepareGeneration(input, principal, deps);
    assert.equal(prepared.confirmationRequired, true);
    assert.equal(captures.inserted.length, 1);
  }
});

test('real provider cross-field constraints reject Hailuo end-frame 512P and Luma 10s loop before pricing', async () => {
  const cases: Array<{ capability: AgentPublicGenerationEngine; input: PrepareGenerationInput }> = [
    {
      capability: registryCapability('minimax-hailuo-02-text'),
      input: {
        surface: 'video',
        engineId: 'minimax-hailuo-02-text',
        mode: 'i2v',
        prompt: 'Land on the final frame',
        settings: { durationSec: 6, resolution: '512P', aspectRatio: '16:9', fps: 25 },
        references: [
          { kind: 'asset', assetId: 'start-asset', role: 'source' },
          { kind: 'asset', assetId: 'end-asset', role: 'last_frame' },
        ],
        outputCount: 1,
      },
    },
    {
      capability: registryCapability('luma-ray-3-2'),
      input: {
        surface: 'video',
        engineId: 'luma-ray-3-2',
        mode: 't2v',
        prompt: 'Loop this ten second shot',
        settings: { durationSec: 10, resolution: '720p', aspectRatio: '16:9', loop: true },
        references: [],
        outputCount: 1,
      },
    },
  ];

  for (const item of cases) {
    const { deps, captures } = baseDependencies({
      listPublicEngines: async () => [item.capability],
    });
    await expectAgentError(prepareGeneration(item.input, principal, deps), 'PARAMETER_INVALID');
    assert.equal(captures.events.includes('pricing'), false);
    assert.equal(captures.inserted.length, 0);
  }
});

test('request-aware provider readiness rejects an unavailable routed provider before pricing', async () => {
  const candidate = registryCapability('luma-ray-3-2');
  const input: PrepareGenerationInput = {
    surface: 'video',
    engineId: 'luma-ray-3-2',
    mode: 'i2v',
    prompt: 'Animate this still image for ten seconds.',
    settings: { durationSec: 10, resolution: '720p', aspectRatio: '16:9', loop: false },
    references: [{
      kind: 'https',
      url: 'https://cdn.maxvideoai.com/source.png',
      mediaKind: 'image',
      role: 'source',
    }],
    outputCount: 1,
  };
  const { deps, captures } = baseDependencies({
    listPublicEngines: async () => [candidate],
    resolveRequestExecutability: () => ({
      executable: false,
      reason: 'provider_credentials_missing',
    }),
  } as Partial<PrepareGenerationDependencies>);

  await expectAgentError(prepareGeneration(input, principal, deps), 'ENGINE_UNAVAILABLE');
  assert.equal(captures.events.includes('pricing'), false);
  assert.equal(captures.inserted.length, 0);
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
  let videoOptions: Record<string, unknown> | null = null;
  let imagePayload: Record<string, unknown> | null = null;
  const videoRequest = { ...videoInput, schemaVersion: 1, prompt: videoInput.prompt.trim() } as CanonicalGenerationRequest;
  const imageRequest = {
    ...imageInput,
    schemaVersion: 1,
    settings: { ...imageInput.settings, enableWebSearch: true },
  } as CanonicalGenerationRequest;
  const deps = {
    computeVideoPreflight: async (payload: Record<string, unknown>, options: Record<string, unknown>) => {
      videoPayload = payload;
      videoOptions = options;
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
    hasVideoInput: false,
    user: { memberTier: 'member' },
  });
  assert.deepEqual(videoOptions, {
    trustedMediaPricingFacts: { referenceImageCount: 0 },
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
    enableWebSearch: true,
    membershipTier: 'member',
  });
});

test('transaction image pricing preserves the canonical web-search addon', async () => {
  const candidate = registryCapability('nano-banana-2');
  const request: CanonicalGenerationRequest = {
    schemaVersion: 1,
    surface: 'image',
    engineId: 'nano-banana-2',
    mode: 't2i',
    prompt: 'Use current web context for an editorial visual.',
    settings: { resolution: '1k', aspectRatio: '1:1', enableWebSearch: true },
    references: [],
    outputCount: 1,
  };
  let captured: Record<string, unknown> | null = null;
  await priceCanonicalGenerationInExecutor(request, 'member', {
    executor: {
      async query() { return []; },
    } as TransactionQueryExecutor,
    candidate,
    computeBillingSnapshot: async (context) => {
      captured = context as unknown as Record<string, unknown>;
      return { totalCents: 100, currency: 'USD', membershipTier: 'member' } as never;
    },
  });
  assert.deepEqual(captured?.addons, { enable_web_search: true });
});

test('Luma HDR and EXR addons reach both canonical video pricing paths', async () => {
  const candidate = registryCapability('luma-ray-3-2');
  const request: CanonicalGenerationRequest = {
    schemaVersion: 1,
    surface: 'video',
    engineId: 'luma-ray-3-2',
    mode: 't2v',
    prompt: 'A high-dynamic-range cinematic landscape.',
    settings: {
      durationSec: 5,
      resolution: '720p',
      aspectRatio: '16:9',
      hdr: true,
      exrExport: true,
    },
    references: [],
    outputCount: 1,
  };

  let preflight: Record<string, unknown> | null = null;
  await priceCanonicalGeneration(request, 'member', {
    computeVideoPreflight: async (payload: Record<string, unknown>) => {
      preflight = payload;
      return {
        ok: true,
        total: 100,
        currency: 'USD',
        pricing: { totalCents: 100, currency: 'USD', membershipTier: 'member' },
      };
    },
    estimateImage: async () => { throw new Error('unused'); },
  });
  assert.deepEqual(preflight?.extraInputValues, {
    hdr: true,
    exr_export: true,
  });

  let transaction: Record<string, unknown> | null = null;
  await priceCanonicalGenerationInExecutor(request, 'member', {
    executor: { async query() { return []; } } as TransactionQueryExecutor,
    candidate,
    computeBillingSnapshot: async (context) => {
      transaction = context as unknown as Record<string, unknown>;
      return { totalCents: 100, currency: 'USD', membershipTier: 'member' } as never;
    },
  });
  assert.deepEqual(transaction?.addons, { hdr: true, exr_export: true });
});

test('GPT Image 2 auto edit pricing keeps the same owned-reference size at confirmation', async () => {
  const candidate = registryCapability('gpt-image-2');
  const request: CanonicalGenerationRequest = {
    schemaVersion: 1,
    surface: 'image',
    engineId: 'gpt-image-2',
    mode: 'i2i',
    prompt: 'Edit this source image without changing its framing.',
    settings: { resolution: 'auto', quality: 'high' },
    references: [{ kind: 'asset', assetId: 'owned-source', role: 'source' }],
    outputCount: 1,
  };
  const resolvedReferences = [{
    assetId: 'owned-source',
    role: 'source' as const,
    mediaKind: 'image' as const,
    storageUrl: 'https://assets.example.com/owned-source.png',
    width: 1536,
    height: 1024,
    mimeType: 'image/png',
  }];

  let prepared: Record<string, unknown> | null = null;
  await priceCanonicalGeneration(request, 'member', {
    computeVideoPreflight: async () => { throw new Error('unused'); },
    estimateImage: async (payload: Record<string, unknown>) => {
      prepared = payload;
      return {
        pricing: { totalCents: 100, currency: 'USD', membershipTier: 'member' },
        normalized: {},
      };
    },
  }, { resolvedReferences });

  let confirmed: Record<string, unknown> | null = null;
  await priceCanonicalGenerationInExecutor(request, 'member', {
    executor: { async query() { return []; } } as TransactionQueryExecutor,
    candidate,
    resolvedReferences,
    computeBillingSnapshot: async (context) => {
      confirmed = context as unknown as Record<string, unknown>;
      return { totalCents: 100, currency: 'USD', membershipTier: 'member' } as never;
    },
  });
  assert.deepEqual(prepared?.customImageSize, { width: 1536, height: 1024 });
  assert.deepEqual(confirmed?.customImageSize, prepared?.customImageSize);
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

test('generation pricing forwards MiniMax H3 reference counts to both canonical pricing paths', async () => {
  const candidate = registryCapability('minimax-h3');
  const references: CanonicalGenerationRequest['references'] = [
    { kind: 'https', url: 'https://cdn.example.com/image-a.png', role: 'reference', mediaKind: 'image' },
    { kind: 'https', url: 'https://cdn.example.com/image-b.png', role: 'reference', mediaKind: 'image' },
    { kind: 'https', url: 'https://cdn.example.com/video-a.mp4', role: 'reference', mediaKind: 'video' },
    { kind: 'https', url: 'https://cdn.example.com/audio-a.wav', role: 'reference', mediaKind: 'audio' },
    { kind: 'asset', assetId: 'private-image', role: 'reference' },
    { kind: 'asset', assetId: 'private-video', role: 'reference' },
  ];
  const resolvedReferences = [
    {
      assetId: 'private-image',
      role: 'reference' as const,
      mediaKind: 'image' as const,
      storageUrl: 'https://assets.example.com/private-image.png',
      width: 1024,
      height: 1024,
      mimeType: 'image/png',
    },
    {
      assetId: 'private-video',
      role: 'reference' as const,
      mediaKind: 'video' as const,
      storageUrl: 'https://assets.example.com/private-video.mp4',
      width: 1920,
      height: 1080,
      mimeType: 'video/mp4',
    },
  ];
  const ref2vRequest: CanonicalGenerationRequest = {
    schemaVersion: 1,
    surface: 'video',
    engineId: candidate.engine.id,
    mode: 'ref2v',
    prompt: 'A reference-led character moment',
    settings: { durationSec: 5, resolution: '2K', aspectRatio: '16:9' },
    references,
    outputCount: 1,
  };
  let capturedPreflight: Record<string, unknown> | null = null;
  await priceCanonicalGeneration(ref2vRequest, 'member', {
    computeVideoPreflight: async (payload: Record<string, unknown>, options: Record<string, unknown>) => {
      capturedPreflight = payload;
      capturedPreflight.options = options;
      return {
        ok: true,
        total: 100,
        currency: 'USD',
        pricing: { totalCents: 100, currency: 'USD', membershipTier: 'member' },
      };
    },
    estimateImage: async () => {
      throw new Error('unused');
    },
  }, { resolvedReferences });
  assert.equal(
    ((capturedPreflight?.options as { trustedMediaPricingFacts?: { referenceImageCount?: number } } | undefined)
      ?.trustedMediaPricingFacts?.referenceImageCount),
    3,
  );
  assert.equal(capturedPreflight?.extraInputValues, undefined);

  let capturedBillingContext: Record<string, unknown> | null = null;
  const pricingExecutor = {
    async query(sql: string) {
      if (sql.includes('app_membership_tiers')) return [];
      return [];
    },
  } as TransactionQueryExecutor;
  await priceCanonicalGenerationInExecutor(ref2vRequest, 'member', {
    executor: pricingExecutor,
    candidate,
    resolvedReferences,
    computeBillingSnapshot: async (context) => {
      capturedBillingContext = context as unknown as Record<string, unknown>;
      return { totalCents: 100, currency: 'USD', membershipTier: 'member' } as never;
    },
  });
  assert.equal(capturedBillingContext?.referenceImageCount, 3);

  for (const mode of ['t2v', 'ref2v'] as const) {
    const request: CanonicalGenerationRequest = {
      ...ref2vRequest,
      mode,
      references: mode === 'ref2v' ? references : [],
    };
    let count: number | undefined;
    await priceCanonicalGeneration(request, 'member', {
      computeVideoPreflight: async (_payload: Record<string, unknown>, options: Record<string, unknown>) => {
        count = ((options.trustedMediaPricingFacts as { referenceImageCount?: number } | undefined)
          ?.referenceImageCount);
        return {
          ok: true,
          total: 100,
          currency: 'USD',
          pricing: { totalCents: 100, currency: 'USD', membershipTier: 'member' },
        };
      },
      estimateImage: async () => {
        throw new Error('unused');
      },
    }, mode === 'ref2v' ? { resolvedReferences } : {});
    assert.equal(count, mode === 'ref2v' ? 3 : 0);
  }
});

test('generation pricing forwards resolved LTX source-audio duration to prepare and confirmation pricing', async () => {
  const candidate = registryCapability('ltx-2-5-fast');
  const request: CanonicalGenerationRequest = {
    schemaVersion: 1,
    surface: 'video',
    engineId: candidate.engine.id,
    mode: 'a2v',
    prompt: 'A source-audio-led character beat',
    settings: { durationSec: 6, resolution: '1080p' },
    references: [{ kind: 'asset', assetId: 'private-audio', role: 'source' }],
    outputCount: 1,
  };
  const resolvedReferences = [{
    assetId: 'private-audio',
    role: 'source' as const,
    mediaKind: 'audio' as const,
    storageUrl: 'https://assets.example.com/private-audio.wav',
    width: null,
    height: null,
    durationSec: 9.25,
    mimeType: 'audio/wav',
  }];

  let capturedPreflight: Record<string, unknown> | null = null;
  await priceCanonicalGeneration(request, 'member', {
    computeVideoPreflight: async (payload: Record<string, unknown>, options: Record<string, unknown>) => {
      capturedPreflight = payload;
      capturedPreflight.options = options;
      return {
        ok: true,
        total: 100,
        currency: 'USD',
        pricing: { totalCents: 100, currency: 'USD', membershipTier: 'member' },
      };
    },
    estimateImage: async () => { throw new Error('unused'); },
  }, { resolvedReferences });
  assert.equal(
    ((capturedPreflight?.options as { trustedMediaPricingFacts?: { inputAudioDurationSec?: number } } | undefined)
      ?.trustedMediaPricingFacts?.inputAudioDurationSec),
    9.25,
  );
  assert.equal(capturedPreflight?.extraInputValues, undefined);

  let capturedBillingContext: Record<string, unknown> | null = null;
  await priceCanonicalGenerationInExecutor(request, 'member', {
    executor: { async query() { return []; } } as TransactionQueryExecutor,
    candidate,
    resolvedReferences,
    computeBillingSnapshot: async (context) => {
      capturedBillingContext = context as unknown as Record<string, unknown>;
      return { totalCents: 100, currency: 'USD', membershipTier: 'member' } as never;
    },
  });
  assert.equal(capturedBillingContext?.inputAudioDurationSec, 9.25);
});

test('prepare pricing uses the real Seedance video-input tier for source-video modes', async () => {
  for (const mode of ['v2v', 'extend'] as const) {
    const request: CanonicalGenerationRequest = {
      schemaVersion: 1,
      surface: 'video',
      engineId: 'seedance-2-5',
      mode,
      prompt: 'Continue the source video.',
      settings: { durationSec: 4, resolution: '480p', aspectRatio: '16:9', audio: true },
      references: [{
        kind: 'https',
        url: `https://cdn.example.com/${mode}-source.mp4`,
        role: 'source',
        mediaKind: 'video',
      }],
      outputCount: 1,
    };
    const pricing = await priceCanonicalGeneration(request, 'member');
    const meta = pricing.pricingSnapshot.meta as Record<string, unknown>;
    assert.equal(meta.byteplus_billing_input_type, 'video_input');
  }
});

test('prepare pricing classifies canonical ref2v video references without trusting asset input', async () => {
  const candidate = registryCapability('seedance-2-5');
  const request: PrepareGenerationInput = {
    surface: 'video',
    engineId: 'seedance-2-5',
    mode: 'ref2v',
    prompt: 'Follow the reference motion.',
    settings: { durationSec: 4, resolution: '480p', aspectRatio: '16:9', audio: true },
    references: [{ kind: 'asset', assetId: 'verified-video', role: 'reference' }],
    outputCount: 1,
  };
  let billingInputType: unknown;
  const { deps } = baseDependencies({
    listPublicEngines: async () => [candidate],
    resolveGenerationReferences: async () => [{
      assetId: 'verified-video',
      role: 'reference',
      mediaKind: 'video',
      storageUrl: 'https://assets.example.com/reference.mp4',
      width: 1920,
      height: 1080,
      mimeType: 'video/mp4',
    }],
    priceGeneration: async (canonicalRequest, membershipTier, referenceContext) => {
      const pricing = await priceCanonicalGeneration(
        canonicalRequest,
        membershipTier,
        undefined,
        referenceContext,
      );
      billingInputType = (pricing.pricingSnapshot.meta as Record<string, unknown>)
        .byteplus_billing_input_type;
      return pricing;
    },
  });

  await prepareGeneration(request, principal, deps);
  assert.equal(billingInputType, 'video_input');
});

test('prepare pricing receives the selected prelaunch engine snapshot', async () => {
  const candidate = registryCapability('wan-3');
  const request: PrepareGenerationInput = {
    surface: 'video',
    engineId: 'wan-3',
    mode: 't2v',
    prompt: 'A controlled product-film motion diagnostic.',
    settings: { durationSec: 5, resolution: '720p', aspectRatio: '16:9', audio: true },
    references: [],
    outputCount: 1,
  };
  const { deps } = baseDependencies({
    listPublicEngines: async () => [candidate],
    priceGeneration: async (_canonicalRequest, _membershipTier, referenceContext) => {
      assert.equal(referenceContext.resolvedEngine, candidate.engine);
      return {
        priceCents: 60,
        currency: 'USD',
        membershipTier: 'member',
        pricingSnapshot: { totalCents: 60, currency: 'USD', membershipTier: 'member' },
      };
    },
  });

  await prepareGeneration(request, principal, deps);
});

test('canonical video pricing leaves source-derived i2v framing unset', async () => {
  const request: CanonicalGenerationRequest = {
    schemaVersion: 1,
    surface: 'video',
    engineId: 'minimax-h3',
    mode: 'i2v',
    prompt: 'Animate the source framing',
    settings: { durationSec: 5, resolution: '2K' },
    references: [{ kind: 'asset', assetId: 'h3-source', role: 'source' }],
    outputCount: 1,
  };
  let captured: Record<string, unknown> | null = null;
  await priceCanonicalGeneration(request, 'member', {
    computeVideoPreflight: async (payload: Record<string, unknown>) => {
      captured = payload;
      return {
        ok: true,
        total: 100,
        currency: 'USD',
        pricing: { totalCents: 100, currency: 'USD', membershipTier: 'member' },
      };
    },
    estimateImage: async () => { throw new Error('unused'); },
  });
  assert.equal(Object.hasOwn(captured!, 'aspectRatio'), false);
});

test('paid generation tools can be gated out and prepare is accurately annotated when injected on', async (t) => {
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
    async confirmGeneration() {
      return {
        jobId: quoteId,
        surface: 'video',
        status: 'accepted',
        progress: 0,
        message: 'Generation accepted.',
        priceCents: 125,
        currency: 'USD',
        paymentStatus: 'paid_wallet',
        result: null,
        retryAfterSeconds: 5,
      };
    },
    async getGenerationStatus() {
      return {
        jobId: quoteId,
        surface: 'video' as const,
        status: 'accepted' as const,
        progress: 0,
        message: 'Generation accepted.',
        priceCents: 125,
        currency: 'USD',
        paymentStatus: 'paid_wallet',
        result: null,
        retry: { tool: 'get_generation_status' as const, arguments: { jobId: quoteId }, afterSeconds: 5 },
      };
    },
    async listRecentGenerations() {
      return { items: [], nextCursor: null };
    },
    async createTopupLink() {
      return {
        topupRequired: false as const,
        nextAction: { tool: 'confirm_generation' as const, arguments: { quoteId, confirmed: true as const } },
      };
    },
  };
  const defaultServer = createMaxVideoAiMcpServer(principal, services, {
    paidGeneration: false,
    referenceUploads: false,
  });
  const enabledServer = createMaxVideoAiMcpServer(principal, services, {
    paidGeneration: true,
    referenceUploads: false,
  });
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
    'get_account_status', 'list_models', 'get_model_details', 'recommend_models', 'calculate_project_budget',
  ]);
  const tools = (await enabledClient.listTools()).tools;
  assert.deepEqual(tools.map((tool) => tool.name), [
    'get_account_status', 'list_models', 'get_model_details', 'recommend_models', 'calculate_project_budget', 'prepare_generation', 'confirm_generation',
    'get_generation_status', 'list_recent_generations', 'get_generation_download', 'present_generation', 'create_topup_link',
  ]);
  const prepareTool = tools.find((tool) => tool.name === 'prepare_generation');
  assert.equal(prepareTool?.annotations?.readOnlyHint, false);
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
  assert.match(source, /readOnlyHint:\s*false/);
  assert.match(source, /destructiveHint:\s*false/);
  assert.match(source, /openWorldHint:\s*false/);
});
