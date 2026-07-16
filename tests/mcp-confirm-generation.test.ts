import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

import type { TransactionQueryExecutor } from '../frontend/src/lib/db';
import {
  computeGenerationCatalogRevision,
} from '../frontend/src/server/agent-api/catalog-revision';
import {
  confirmGeneration,
  type ConfirmGenerationDependencies,
} from '../frontend/src/server/agent-api/confirm-generation';
import { AgentApiError } from '../frontend/src/server/agent-api/errors';
import {
  hashCanonicalGenerationRequest,
} from '../frontend/src/server/agent-api/generation-normalization';
import type { CanonicalGenerationRequest } from '../frontend/src/server/agent-api/generation-types';
import type { AgentPublicGenerationEngine } from '../frontend/src/server/agent-api/model-catalog';
import type { AgentPrincipal } from '../frontend/src/server/agent-api/principal';
import {
  submitReservedPaidGeneration,
  type PaidGenerationExecution,
} from '../frontend/src/server/agent-api/paid-generation-execution';
import type { McpGenerationQuote } from '../frontend/src/server/agent-api/quote-repository';
import type { AgentGenerationStatus } from '../frontend/src/server/generations/generation-status';
import {
  createMaxVideoAiMcpServer,
  type MaxVideoAiMcpServices,
} from '../frontend/src/server/mcp/server';
import type { EngineCaps, EngineModeUiCaps } from '../frontend/types/engines';

const QUOTE_ID = '123e4567-e89b-42d3-a456-426614174000';
const USER_ID = 'user-confirm';
const CLIENT_ID = 'codex-client';
const NOW = new Date('2026-07-16T12:00:00.000Z');
const EXPIRES_AT = new Date('2026-07-16T12:10:00.000Z');

const principal: AgentPrincipal = {
  userId: USER_ID,
  clientId: CLIENT_ID,
  emailVerified: true,
  authMethod: 'oauth',
};

const videoRequest: CanonicalGenerationRequest = {
  schemaVersion: 1,
  surface: 'video',
  engineId: 'seedance-2-0-mini',
  mode: 't2v',
  prompt: 'A private cinematic paper city',
  settings: {
    durationSec: 5,
    resolution: '720p',
    aspectRatio: '16:9',
    audio: true,
  },
  references: [],
  outputCount: 1,
};

const imageRequest: CanonicalGenerationRequest = {
  schemaVersion: 1,
  surface: 'image',
  engineId: 'flux-pro',
  mode: 't2i',
  prompt: 'A private paper city keyframe',
  settings: {
    resolution: '1024x1024',
    aspectRatio: '1:1',
    quality: 'high',
  },
  references: [],
  outputCount: 1,
};

function capability(request: CanonicalGenerationRequest): AgentPublicGenerationEngine {
  const video = request.surface === 'video';
  const modeCaps: EngineModeUiCaps = {
    modes: [request.mode],
    ...(video ? { duration: { options: [5, 10], default: 5 }, fps: [24], audioToggle: true } : {}),
    resolution: video ? ['720p', '1080p'] : ['1024x1024'],
    aspectRatio: video ? ['16:9', '9:16'] : ['1:1'],
  };
  const engine: EngineCaps = {
    id: request.engineId,
    label: video ? 'Seedance 2.0 Mini' : 'Flux Pro',
    provider: 'test-provider',
    status: 'live',
    latencyTier: 'standard',
    modes: [request.mode],
    maxDurationSec: video ? 10 : 0,
    resolutions: (video ? ['720p', '1080p'] : ['1024x1024']) as EngineCaps['resolutions'],
    aspectRatios: (video ? ['16:9', '9:16'] : ['1:1']) as EngineCaps['aspectRatios'],
    fps: video ? [24] : [1],
    audio: video,
    upscale4k: false,
    extend: false,
    motionControls: false,
    keyframes: false,
    params: {},
    inputLimits: { promptMaxChars: 12_000 },
    inputSchema: {
      required: [{ id: 'prompt', type: 'text', label: 'Prompt' }],
      optional: [
        ...(video
          ? [
              { id: 'duration', type: 'enum', label: 'Duration', values: ['5', '10'] } as const,
              { id: 'resolution', type: 'enum', label: 'Resolution', values: ['720p', '1080p'] } as const,
              { id: 'aspect_ratio', type: 'enum', label: 'Ratio', values: ['16:9', '9:16'] } as const,
              { id: 'generate_audio', type: 'boolean', label: 'Audio' } as const,
            ]
          : [
              { id: 'resolution', type: 'enum', label: 'Resolution', values: ['1024x1024'] } as const,
              { id: 'aspect_ratio', type: 'enum', label: 'Ratio', values: ['1:1'] } as const,
              { id: 'quality', type: 'enum', label: 'Quality', values: ['high'] } as const,
            ]),
      ],
    },
    updatedAt: '2026-07-16T00:00:00.000Z',
    ttlSec: 600,
    availability: 'available',
    modeCaps: { [request.mode]: modeCaps },
  };
  return {
    engine,
    surface: request.surface,
    publicModes: [request.mode],
    modeCaps: { [request.mode]: modeCaps },
  };
}

const membership = {
  tier: 'member' as const,
  source: 'app_receipts_rolling_30d' as const,
  spent30Cents: 0,
  thresholdCents: 0,
  discountPercent: 0,
};

function canonicalPricing(priceCents: number, currency = 'USD') {
  return {
    totalCents: priceCents,
    currency,
    membershipTier: membership.tier,
    platformRevenueCents: 20,
    provenance: { source: 'canonical-test' },
  };
}

function quoteFor(
  request: CanonicalGenerationRequest = videoRequest,
  options: Partial<McpGenerationQuote> = {},
): McpGenerationQuote {
  const publicCapability = capability(request);
  const catalogRevision = computeGenerationCatalogRevision([publicCapability]);
  const priceCents = request.surface === 'video' ? 125 : 45;
  return {
    quoteId: QUOTE_ID,
    userId: USER_ID,
    oauthClientId: CLIENT_ID,
    request,
    requestHash: hashCanonicalGenerationRequest(request),
    catalogRevision,
    pricingSnapshot: {
      schemaVersion: 1,
      catalogRevision,
      surface: request.surface,
      engineId: request.engineId,
      membership,
      canonicalPricing: canonicalPricing(priceCents),
    },
    priceCents,
    currency: 'USD',
    fundingMode: 'wallet',
    state: 'prepared',
    jobId: null,
    expiresAt: EXPIRES_AT,
    claimedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...options,
  };
}

function safeStatus(request: CanonicalGenerationRequest, state = 'accepted'): AgentGenerationStatus {
  return {
    jobId: QUOTE_ID,
    surface: request.surface,
    status: state === 'completed' ? 'completed' : state === 'failed' ? 'failed' : 'accepted',
    progress: state === 'completed' ? 100 : 0,
    message: null,
    priceCents: request.surface === 'video' ? 125 : 45,
    currency: 'USD',
    paymentStatus: state === 'failed' ? 'refunded_wallet' : 'paid_wallet',
    result: null,
    retryAfterSeconds: state === 'accepted' ? 5 : null,
  };
}

type Captures = {
  events: string[];
  providerCalls: number;
  acceptedMarks: number;
  failedMarks: number;
  expiredMarks: number;
};

function baseDependencies(
  request: CanonicalGenerationRequest = videoRequest,
  overrides: Partial<ConfirmGenerationDependencies> = {},
): { dependencies: ConfirmGenerationDependencies; captures: Captures } {
  const captures: Captures = {
    events: [], providerCalls: 0, acceptedMarks: 0, failedMarks: 0, expiredMarks: 0,
  };
  const publicCapability = capability(request);
  const storedQuote = quoteFor(request);
  const executor = {
    async query() {
      throw new Error('unit confirmation executor must be injected into dependencies');
    },
  } as TransactionQueryExecutor;
  const dependencies: ConfirmGenerationDependencies = {
    paidGenerationEnabled: () => {
      captures.events.push('feature');
      return true;
    },
    withTransaction: async (callback) => {
      captures.events.push('transaction');
      return callback(executor);
    },
    lockOwnedQuote: async (_owner, input) => {
      captures.events.push('lock_quote');
      assert.equal(input.executor, executor);
      return { quote: storedQuote, databaseNow: NOW };
    },
    markQuoteExpired: async () => {
      captures.events.push('expire_quote');
      captures.expiredMarks += 1;
      return null;
    },
    getAccountRestriction: async (_userId, input) => {
      captures.events.push('restriction');
      assert.equal(input.executor, executor);
      return null;
    },
    listPublicEngines: async (input) => {
      captures.events.push('catalog');
      assert.equal(input.executor, executor);
      return [publicCapability];
    },
    resolveMembershipPricing: async (_userId, input) => {
      captures.events.push('membership');
      assert.equal(input.executor, executor);
      return membership;
    },
    priceGeneration: async (_canonical, tier, input) => {
      captures.events.push('pricing');
      assert.equal(tier, membership.tier);
      assert.equal(input.executor, executor);
      return {
        priceCents: storedQuote.priceCents,
        currency: storedQuote.currency,
        membershipTier: membership.tier,
        pricingSnapshot: canonicalPricing(storedQuote.priceCents, storedQuote.currency),
      };
    },
    checkSpendingLimits: async (_input, deps) => {
      captures.events.push('spending');
      assert.equal(deps.executor, executor);
      return {
        allowed: true,
        acceptedTodayCents: 0,
        projectedTodayCents: storedQuote.priceCents,
        limits: {
          perGenerationCents: null,
          dailyCents: null,
          webApprovalAboveCents: null,
        },
      };
    },
    reserveInitialJob: async (input, deps) => {
      captures.events.push(`reserve_${request.surface}`);
      assert.equal(deps.executor, executor);
      assert.equal(input.quote.quoteId, QUOTE_ID);
      return {
        jobId: QUOTE_ID,
        surface: request.surface,
        execution: { surface: request.surface, quoteId: QUOTE_ID },
      } as never;
    },
    claimPreparedQuote: async (input, deps) => {
      captures.events.push('claim_quote');
      assert.equal(deps.executor, executor);
      return quoteFor(request, {
        state: 'claimed',
        jobId: input.jobId,
        claimedAt: NOW,
        updatedAt: NOW,
      });
    },
    submitPaidGeneration: async () => {
      captures.events.push('provider');
      captures.providerCalls += 1;
      return { kind: 'accepted' };
    },
    markQuoteAccepted: async () => {
      captures.events.push('accepted_quote');
      captures.acceptedMarks += 1;
      return null;
    },
    markQuoteFailed: async () => {
      captures.events.push('failed_quote');
      captures.failedMarks += 1;
      return null;
    },
    readGenerationStatus: async (input) => {
      captures.events.push('status');
      assert.equal(input.userId, USER_ID);
      assert.equal(input.jobId, QUOTE_ID);
      return safeStatus(request);
    },
    accountUrl: 'https://maxvideoai.com/account/connections',
    ...overrides,
  };
  return { dependencies, captures };
}

async function expectAgentError(operation: Promise<unknown>, code: AgentApiError['code']) {
  await assert.rejects(operation, (error: unknown) => {
    assert.ok(error instanceof AgentApiError);
    assert.equal(error.code, code);
    return true;
  });
}

test('P8 confirmation owners exist and MCP tool imports no provider owner', () => {
  for (const path of [
    'frontend/src/server/agent-api/confirm-generation.ts',
    'frontend/src/server/agent-api/paid-generation-execution.ts',
    'frontend/src/server/mcp/tools/confirm-generation.ts',
  ]) {
    assert.equal(existsSync(path), true, `${path} must exist`);
  }
  const tool = readFileSync('frontend/src/server/mcp/tools/confirm-generation.ts', 'utf8');
  assert.doesNotMatch(tool, /video-provider|fal-submission|byteplus-submission|luma-agents-execution|execute-(?:image|video)-generation/);
});

test('default confirmation revalidates catalog and canonical pricing through the caller transaction executor', () => {
  const confirm = readFileSync('frontend/src/server/agent-api/confirm-generation.ts', 'utf8');
  const catalog = readFileSync('frontend/src/server/agent-api/model-catalog.ts', 'utf8');
  const pricing = readFileSync('frontend/src/server/agent-api/generation-pricing.ts', 'utf8');
  const engines = readFileSync('frontend/src/server/engines.ts', 'utf8');
  assert.match(confirm, /listPublicAgentGenerationEnginesInExecutor/);
  assert.match(confirm, /priceCanonicalGenerationInExecutor/);
  assert.match(catalog, /export async function listPublicAgentGenerationEnginesInExecutor/);
  assert.match(pricing, /export async function priceCanonicalGenerationInExecutor/);
  assert.match(engines, /LOCK TABLE engine_settings, engine_overrides IN SHARE MODE/i);
  assert.doesNotMatch(
    confirm,
    /listPublicEngines:\s*\(\)\s*=>\s*listPublicAgentGenerationEngines\(\)/,
  );
});

test('confirmed must be literal true and input exact before auth, transaction, wallet, job, or provider work', async () => {
  let transactions = 0;
  let providers = 0;
  const dependencies = {
    paidGenerationEnabled: () => true,
    withTransaction: async () => {
      transactions += 1;
      throw new Error('must not run');
    },
    submitPaidGeneration: async () => {
      providers += 1;
      throw new Error('must not run');
    },
  } as unknown as ConfirmGenerationDependencies;

  for (const input of [
    {},
    { confirmed: true },
    { quoteId: QUOTE_ID },
    { quoteId: QUOTE_ID, confirmed: false },
    { quoteId: QUOTE_ID, confirmed: 'true' },
    { quoteId: 'not-a-uuid', confirmed: true },
    { quoteId: QUOTE_ID, confirmed: true, userId: USER_ID },
    { quoteId: QUOTE_ID, confirmed: true, clientId: CLIENT_ID },
    { quoteId: QUOTE_ID, confirmed: true, priceCents: 1 },
    { quoteId: QUOTE_ID, confirmed: true, jobId: 'chosen' },
  ]) {
    await expectAgentError(confirmGeneration(input as never, principal, dependencies), 'PARAMETER_INVALID');
  }
  assert.equal(transactions, 0);
  assert.equal(providers, 0);
});

test('confirmation performs the binding transaction order and submits video only after commit', async () => {
  const { dependencies, captures } = baseDependencies(videoRequest);
  const result = await confirmGeneration({ quoteId: QUOTE_ID, confirmed: true }, principal, dependencies);
  assert.deepEqual(result, safeStatus(videoRequest));
  assert.deepEqual(captures.events, [
    'feature', 'transaction', 'lock_quote', 'restriction', 'catalog', 'membership', 'pricing',
    'spending', 'reserve_video', 'claim_quote', 'provider', 'accepted_quote', 'status',
  ]);
  assert.equal(captures.providerCalls, 1);
  assert.equal(captures.acceptedMarks, 1);
});

test('image confirmation uses the same atomic path and returns only the safe job DTO', async () => {
  const { dependencies, captures } = baseDependencies(imageRequest);
  const result = await confirmGeneration({ quoteId: QUOTE_ID, confirmed: true }, principal, dependencies);
  assert.deepEqual(result, safeStatus(imageRequest));
  assert.equal(captures.events.includes('reserve_image'), true);
  const serialized = JSON.stringify(result);
  for (const forbidden of [
    imageRequest.prompt, 'referenceUrl', 'providerBody', 'vendorAccountId', 'accessToken', 'requestHash', 'pricingSnapshot',
  ]) {
    assert.equal(serialized.includes(forbidden), false, `safe output leaked ${forbidden}`);
  }
});

test('missing ownership, current restriction, and post-lock expiry fail before spending or provider', async () => {
  {
    const { dependencies, captures } = baseDependencies(videoRequest, {
      lockOwnedQuote: async () => null,
    });
    await expectAgentError(
      confirmGeneration({ quoteId: QUOTE_ID, confirmed: true }, principal, dependencies),
      'QUOTE_EXPIRED',
    );
    assert.equal(captures.providerCalls, 0);
  }
  {
    const { dependencies, captures } = baseDependencies(videoRequest, {
      getAccountRestriction: async () => ({
        userId: USER_ID, reason: 'risk', message: 'private', restrictedAt: NOW.toISOString(),
      }),
    });
    await expectAgentError(
      confirmGeneration({ quoteId: QUOTE_ID, confirmed: true }, principal, dependencies),
      'ACCOUNT_RESTRICTED',
    );
    assert.equal(captures.events.includes('catalog'), false);
  }
  {
    const expired = quoteFor(videoRequest, { expiresAt: new Date('2026-07-16T12:00:01.000Z') });
    const { dependencies, captures } = baseDependencies(videoRequest, {
      lockOwnedQuote: async () => ({ quote: expired, databaseNow: new Date('2026-07-16T12:00:02.000Z') }),
    });
    await expectAgentError(
      confirmGeneration({ quoteId: QUOTE_ID, confirmed: true }, principal, dependencies),
      'QUOTE_EXPIRED',
    );
    assert.equal(captures.expiredMarks, 1);
    assert.equal(captures.providerCalls, 0);
  }
});

test('claimed, accepted, and failed repeats return their linked job without revalidation, charge, or submission', async () => {
  for (const state of ['claimed', 'accepted', 'failed'] as const) {
    const repeatQuote = quoteFor(videoRequest, {
      state,
      jobId: QUOTE_ID,
      claimedAt: NOW,
      updatedAt: NOW,
    });
    const { dependencies, captures } = baseDependencies(videoRequest, {
      lockOwnedQuote: async () => ({ quote: repeatQuote, databaseNow: NOW }),
      readGenerationStatus: async () => safeStatus(videoRequest, state === 'failed' ? 'failed' : 'accepted'),
    });
    const result = await confirmGeneration({ quoteId: QUOTE_ID, confirmed: true }, principal, dependencies);
    assert.equal(result.jobId, QUOTE_ID);
    assert.equal(captures.events.includes('restriction'), false, state);
    assert.equal(captures.events.includes('spending'), false, state);
    assert.equal(captures.events.includes('claim_quote'), false, state);
    assert.equal(captures.providerCalls, 0, state);
  }
});

test('stale request/catalog/membership/price/currency/snapshot fail closed before wallet reservation', async () => {
  const cases: Array<[string, Partial<ConfirmGenerationDependencies>]> = [
    ['request hash', {
      lockOwnedQuote: async () => ({
        quote: quoteFor(videoRequest, { requestHash: 'f'.repeat(64) }), databaseNow: NOW,
      }),
    }],
    ['catalog', {
      lockOwnedQuote: async () => ({
        quote: quoteFor(videoRequest, { catalogRevision: 'mcp-catalog-v2:stale' }), databaseNow: NOW,
      }),
    }],
    ['membership', {
      resolveMembershipPricing: async () => ({
        tier: 'plus', source: 'app_receipts_rolling_30d', spent30Cents: 5_000,
        thresholdCents: 5_000, discountPercent: 0.05,
      }),
    }],
    ['price', {
      priceGeneration: async () => ({
        priceCents: 126, currency: 'USD', membershipTier: 'member', pricingSnapshot: canonicalPricing(126),
      }),
    }],
    ['currency', {
      priceGeneration: async () => ({
        priceCents: 125, currency: 'EUR', membershipTier: 'member', pricingSnapshot: canonicalPricing(125, 'EUR'),
      }),
    }],
    ['snapshot', {
      lockOwnedQuote: async () => {
        const stored = quoteFor(videoRequest);
        stored.pricingSnapshot = {
          ...stored.pricingSnapshot,
          canonicalPricing: { ...canonicalPricing(125), provenance: { source: 'stale-owner' } },
        };
        return { quote: stored, databaseNow: NOW };
      },
    }],
  ];
  for (const [label, overrides] of cases) {
    const { dependencies, captures } = baseDependencies(videoRequest, overrides);
    await expectAgentError(
      confirmGeneration({ quoteId: QUOTE_ID, confirmed: true }, principal, dependencies),
      'QUOTE_EXPIRED',
    );
    assert.equal(captures.events.includes('reserve_video'), false, label);
    assert.equal(captures.providerCalls, 0, label);
  }
});

test('spending denial and insufficient balance roll back without claim or provider', async () => {
  {
    const { dependencies, captures } = baseDependencies(videoRequest, {
      checkSpendingLimits: async () => ({
        allowed: false,
        code: 'SPENDING_LIMIT_EXCEEDED',
        reason: 'daily',
        message: 'private policy message',
        approvalUrl: '/account/connections?focus=mcp-spending',
        acceptedTodayCents: 100,
        projectedTodayCents: 225,
        limits: { perGenerationCents: null, dailyCents: 200, webApprovalAboveCents: null },
      }),
    });
    await expectAgentError(
      confirmGeneration({ quoteId: QUOTE_ID, confirmed: true }, principal, dependencies),
      'SPENDING_LIMIT_EXCEEDED',
    );
    assert.equal(captures.events.includes('claim_quote'), false);
  }
  {
    const { dependencies, captures } = baseDependencies(videoRequest, {
      reserveInitialJob: async () => {
        throw new AgentApiError('INSUFFICIENT_FUNDS', 'Add funds before confirming.');
      },
    });
    await expectAgentError(
      confirmGeneration({ quoteId: QUOTE_ID, confirmed: true }, principal, dependencies),
      'INSUFFICIENT_FUNDS',
    );
    assert.equal(captures.events.includes('claim_quote'), false);
    assert.equal(captures.providerCalls, 0);
  }
});

test('known rejection is refunded then failed, while ambiguous timeout remains charged and claimed', async () => {
  {
    const { dependencies, captures } = baseDependencies(videoRequest, {
      submitPaidGeneration: async () => ({ kind: 'rejected', refunded: true }),
      readGenerationStatus: async () => safeStatus(videoRequest, 'failed'),
    });
    const result = await confirmGeneration({ quoteId: QUOTE_ID, confirmed: true }, principal, dependencies);
    assert.equal(result.status, 'failed');
    assert.equal(captures.failedMarks, 1);
    assert.equal(captures.acceptedMarks, 0);
  }
  {
    const { dependencies, captures } = baseDependencies(videoRequest, {
      submitPaidGeneration: async () => ({ kind: 'ambiguous', retryable: true }),
    });
    const result = await confirmGeneration({ quoteId: QUOTE_ID, confirmed: true }, principal, dependencies);
    assert.equal(result.status, 'accepted');
    assert.equal(captures.failedMarks, 0);
    assert.equal(captures.acceptedMarks, 0);
  }
});

test('P7 paid continuation receives quoteId idempotency and immutable quoted billing without repricing', async () => {
  const videoQuote = quoteFor(videoRequest);
  const imageQuote = quoteFor(imageRequest);
  const execution = (
    request: CanonicalGenerationRequest,
    quote: McpGenerationQuote,
  ): PaidGenerationExecution => ({
    surface: request.surface,
    quoteId: quote.quoteId,
    userId: quote.userId,
    request,
    engine: capability(request).engine,
    canonicalPricing: quote.pricingSnapshot.canonicalPricing as Record<string, unknown>,
    trustedInitialState: request.surface === 'video'
      ? { kind: 'created', jobId: quote.quoteId, walletChargeReserved: true }
      : { kind: 'created', jobId: quote.quoteId, recoveredCharge: true },
  });

  let videoCalls = 0;
  const videoOutcome = await submitReservedPaidGeneration(execution(videoRequest, videoQuote), {
    executeVideo: async (options) => {
      videoCalls += 1;
      assert.equal(options.body.jobId, QUOTE_ID);
      assert.deepEqual(options.body.payment, { mode: 'wallet' });
      assert.equal(options.walletReservation, 'already_reserved');
      assert.equal(options.preReservedInitialState.jobId, QUOTE_ID);
      assert.equal(options.trustedQuotedBilling.pricing, videoQuote.pricingSnapshot.canonicalPricing);
      return { body: { ok: true, jobId: QUOTE_ID, status: 'pending' } };
    },
    executeImage: async () => assert.fail('video must not enter image execution'),
  });
  assert.deepEqual(videoOutcome, { kind: 'accepted' });
  assert.equal(videoCalls, 1);

  let imageCalls = 0;
  const imageOutcome = await submitReservedPaidGeneration(execution(imageRequest, imageQuote), {
    executeVideo: async () => assert.fail('image must not enter video execution'),
    executeImage: async (options) => {
      imageCalls += 1;
      assert.equal(options.body.jobId, QUOTE_ID);
      assert.equal(options.walletReservation, 'already_reserved');
      assert.equal(options.preReservedInitialState.jobId, QUOTE_ID);
      assert.equal(options.trustedQuotedBilling.pricing, imageQuote.pricingSnapshot.canonicalPricing);
      return { ok: true, mode: 't2i', jobId: QUOTE_ID, images: [{ url: 'https://cdn.maxvideoai.com/image.png' }] };
    },
  });
  assert.deepEqual(imageOutcome, { kind: 'completed' });
  assert.equal(imageCalls, 1);
});

test('paid continuation classifies refunded rejection and unrefunded timeout without unsafe refund', async () => {
  const quote = quoteFor(videoRequest);
  const execution: PaidGenerationExecution = {
    surface: 'video', quoteId: quote.quoteId, userId: quote.userId, request: videoRequest,
    engine: capability(videoRequest).engine,
    canonicalPricing: quote.pricingSnapshot.canonicalPricing as Record<string, unknown>,
    trustedInitialState: { kind: 'created', jobId: quote.quoteId, walletChargeReserved: true },
  };
  const rejected = await submitReservedPaidGeneration(execution, {
    executeVideo: async () => ({
      status: 422,
      body: { ok: false, paymentStatus: 'refunded_wallet' },
    }),
    executeImage: async () => assert.fail('unexpected image'),
  });
  assert.deepEqual(rejected, { kind: 'rejected', refunded: true });
  const ambiguous = await submitReservedPaidGeneration(execution, {
    executeVideo: async () => ({ status: 504, body: { ok: false, error: 'timeout' } }),
    executeImage: async () => assert.fail('unexpected image'),
  });
  assert.deepEqual(ambiguous, { kind: 'ambiguous', retryable: true });

  let refundChecks = 0;
  const verifiedKnownRejection = await submitReservedPaidGeneration(execution, {
    executeVideo: async () => ({ status: 422, body: { ok: false, error: 'invalid input' } }),
    executeImage: async () => assert.fail('unexpected image'),
    ensureKnownRejectionRefund: async (received) => {
      refundChecks += 1;
      assert.equal(received.quoteId, QUOTE_ID);
      return true;
    },
  });
  assert.deepEqual(verifiedKnownRejection, { kind: 'rejected', refunded: true });
  assert.equal(refundChecks, 1);
});

test('invalid image already-reserved runtime state fails before database or provider work', async () => {
  const { executeImageGeneration } = await import('../frontend/src/server/images/execute-image-generation');
  const previousDatabaseUrl = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  try {
    await assert.rejects(
      executeImageGeneration({
        userId: USER_ID,
        body: { engineId: imageRequest.engineId, mode: 't2i', prompt: imageRequest.prompt, jobId: QUOTE_ID },
        walletReservation: 'already_reserved',
        preReservedInitialState: { kind: 'created', jobId: QUOTE_ID, recoveredCharge: false },
        trustedQuotedBilling: { pricing: canonicalPricing(45), membershipTier: 'member' },
      } as never),
      (error: unknown) => {
        assert.ok(error && typeof error === 'object' && 'code' in error);
        assert.equal((error as { code: unknown }).code, 'job_charge_conflict');
        return true;
      },
    );
  } finally {
    if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousDatabaseUrl;
  }
});

test('default registry remains three tools and the explicit paid gate exposes prepare plus confirm safely', async () => {
  const services = {
    getAccountStatus: async () => ({
      connected: true, userId: USER_ID, emailVerified: true, accountUrl: 'https://maxvideoai.com/account',
      wallet: { availableBalanceCents: 0, currency: 'USD', topupUrl: 'https://maxvideoai.com/pricing' },
    }),
    listModels: async () => [],
    recommendModels: async () => ({ recommendations: [], guidance: [] }),
    prepareGeneration: async () => { throw new Error('not called'); },
    confirmGeneration: async () => safeStatus(videoRequest),
  } as unknown as MaxVideoAiMcpServices;
  const defaultServer = createMaxVideoAiMcpServer(principal, services);
  const enabledServer = createMaxVideoAiMcpServer(principal, services, { paidGeneration: true });
  const defaultClient = new Client({ name: 'default-confirm-test', version: '1.0.0' });
  const enabledClient = new Client({ name: 'enabled-confirm-test', version: '1.0.0' });
  const [defaultClientTransport, defaultServerTransport] = InMemoryTransport.createLinkedPair();
  const [enabledClientTransport, enabledServerTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([
    defaultServer.connect(defaultServerTransport),
    defaultClient.connect(defaultClientTransport),
    enabledServer.connect(enabledServerTransport),
    enabledClient.connect(enabledClientTransport),
  ]);
  test.after(async () => Promise.allSettled([
    defaultClient.close(), defaultServer.close(), enabledClient.close(), enabledServer.close(),
  ]));

  assert.deepEqual((await defaultClient.listTools()).tools.map((tool) => tool.name), [
    'get_account_status', 'list_models', 'recommend_models',
  ]);
  const tools = (await enabledClient.listTools()).tools;
  assert.deepEqual(tools.map((tool) => tool.name), [
    'get_account_status', 'list_models', 'recommend_models', 'prepare_generation', 'confirm_generation',
  ]);
  const confirm = tools.find((tool) => tool.name === 'confirm_generation');
  assert.deepEqual(confirm?.annotations, {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true,
  });
  assert.match(confirm?.description ?? '', /spends wallet funds/i);
  assert.match(confirm?.description ?? '', /external generation provider/i);
  assert.deepEqual(Object.keys(confirm?.inputSchema.properties ?? {}).sort(), ['confirmed', 'quoteId']);
});
