import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

import { listFalEngines } from '../frontend/src/config/falEngines';
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
import {
  priceCanonicalGeneration,
  priceCanonicalGenerationInExecutor,
} from '../frontend/src/server/agent-api/generation-pricing';
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

test('confirmation pricing preserves the prepared Seedance video-input tier', async () => {
  const entry = listFalEngines().find((candidate) => candidate.id === 'seedance-2-5');
  assert.ok(entry);
  const candidate: AgentPublicGenerationEngine = {
    engine: entry.engine,
    surface: 'video',
    publicModes: ['t2v', 'i2v', 'ref2v', 'v2v', 'extend'],
    modeCaps: Object.fromEntries(entry.modes.map((mode) => [mode.mode, mode.ui])),
  };
  const request: CanonicalGenerationRequest = {
    schemaVersion: 1,
    surface: 'video',
    engineId: 'seedance-2-5',
    mode: 'v2v',
    prompt: 'Edit the source video.',
    settings: { durationSec: 4, resolution: '480p', aspectRatio: '16:9', audio: true },
    references: [{
      kind: 'https',
      url: 'https://cdn.example.com/source.mp4',
      role: 'source',
      mediaKind: 'video',
    }],
    outputCount: 1,
  };
  const prepared = await priceCanonicalGeneration(request, 'member');
  const confirmed = await priceCanonicalGenerationInExecutor(request, 'member', {
    candidate,
    executor: { async query() { return []; } } as TransactionQueryExecutor,
  });
  assert.equal(
    (prepared.pricingSnapshot.meta as Record<string, unknown>).byteplus_billing_input_type,
    'video_input',
  );
  assert.equal(
    (confirmed.pricingSnapshot.meta as Record<string, unknown>).byteplus_billing_input_type,
    'video_input',
  );
  assert.equal(confirmed.priceCents, prepared.priceCents);
  assert.equal(confirmed.currency, prepared.currency);
});

test('confirmation pricing distinguishes ref2v video, image, and DB-verified video references', async () => {
  const entry = listFalEngines().find((candidate) => candidate.id === 'seedance-2-5');
  assert.ok(entry);
  const candidate: AgentPublicGenerationEngine = {
    engine: entry.engine,
    surface: 'video',
    publicModes: ['t2v', 'i2v', 'ref2v', 'v2v', 'extend'],
    modeCaps: Object.fromEntries(entry.modes.map((mode) => [mode.mode, mode.ui])),
  };
  const baseRequest: CanonicalGenerationRequest = {
    schemaVersion: 1,
    surface: 'video',
    engineId: 'seedance-2-5',
    mode: 'ref2v',
    prompt: 'Follow the reference motion.',
    settings: { durationSec: 4, resolution: '480p', aspectRatio: '16:9', audio: true },
    references: [],
    outputCount: 1,
  };
  const cases = [
    {
      label: 'https video',
      references: [{
        kind: 'https' as const,
        url: 'https://cdn.example.com/reference.mp4',
        role: 'reference' as const,
        mediaKind: 'video' as const,
      }],
      resolvedReferences: [],
      expected: 'video_input',
    },
    {
      label: 'https image',
      references: [{
        kind: 'https' as const,
        url: 'https://cdn.example.com/reference.png',
        role: 'reference' as const,
        mediaKind: 'image' as const,
      }],
      resolvedReferences: [],
      expected: 'no_video_input',
    },
    {
      label: 'resolved asset video',
      references: [{ kind: 'asset' as const, assetId: 'video-asset', role: 'reference' as const }],
      resolvedReferences: [{
        assetId: 'video-asset',
        role: 'reference' as const,
        mediaKind: 'video' as const,
        storageUrl: 'https://assets.example.com/reference.mp4',
        width: 1920,
        height: 1080,
        mimeType: 'video/mp4',
      }],
      expected: 'video_input',
    },
  ];

  for (const scenario of cases) {
    const request = { ...baseRequest, references: scenario.references };
    const prepared = await priceCanonicalGeneration(
      request,
      'member',
      undefined,
      { resolvedReferences: scenario.resolvedReferences },
    );
    const confirmed = await priceCanonicalGenerationInExecutor(request, 'member', {
      candidate,
      executor: { async query() { return []; } } as TransactionQueryExecutor,
      resolvedReferences: scenario.resolvedReferences,
    });
    for (const pricing of [prepared, confirmed]) {
      assert.equal(
        (pricing.pricingSnapshot.meta as Record<string, unknown>).byteplus_billing_input_type,
        scenario.expected,
        scenario.label,
      );
    }
    assert.equal(confirmed.priceCents, prepared.priceCents, scenario.label);
  }
});

test('confirmation passes DB-verified ref2v video media into transactional pricing', async () => {
  const entry = listFalEngines().find((candidate) => candidate.id === 'seedance-2-5');
  assert.ok(entry);
  const candidate: AgentPublicGenerationEngine = {
    engine: entry.engine,
    surface: 'video',
    publicModes: ['t2v', 'i2v', 'ref2v', 'v2v', 'extend'],
    modeCaps: Object.fromEntries(entry.modes.map((mode) => [mode.mode, mode.ui])),
  };
  const request: CanonicalGenerationRequest = {
    schemaVersion: 1,
    surface: 'video',
    engineId: 'seedance-2-5',
    mode: 'ref2v',
    prompt: 'Follow the private reference motion.',
    settings: { durationSec: 4, resolution: '480p', aspectRatio: '16:9', audio: true },
    references: [{ kind: 'asset', assetId: 'video-asset', role: 'reference' }],
    outputCount: 1,
  };
  const resolvedReferences = [{
    assetId: 'video-asset',
    role: 'reference' as const,
    mediaKind: 'video' as const,
    storageUrl: 'https://assets.example.com/reference.mp4',
    width: 1920,
    height: 1080,
    mimeType: 'video/mp4',
  }];
  const catalogRevision = computeGenerationCatalogRevision([candidate]);
  const stored = quoteFor(request, { catalogRevision });
  let billingInputType: unknown;
  const { dependencies } = baseDependencies(request, {
    lockOwnedQuote: async () => ({ quote: stored, databaseNow: NOW }),
    listPublicEngines: async () => [candidate],
    resolveGenerationReferences: async () => resolvedReferences,
    priceGeneration: async (canonicalRequest, tier, input) => {
      const pricing = await priceCanonicalGenerationInExecutor(canonicalRequest, tier, {
        executor: { async query() { return []; } } as TransactionQueryExecutor,
        candidate,
        resolvedReferences: input.resolvedReferences,
      });
      billingInputType = (pricing.pricingSnapshot.meta as Record<string, unknown>)
        .byteplus_billing_input_type;
      return pricing;
    },
  });

  await expectAgentError(
    confirmGeneration({ quoteId: QUOTE_ID, confirmed: true }, principal, dependencies),
    'QUOTE_EXPIRED',
  );
  assert.equal(billingInputType, 'video_input');
});

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
    trialFunding: null,
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

function expectedRecovery(request: CanonicalGenerationRequest, state = 'accepted') {
  const raw = safeStatus(request, state);
  const { retryAfterSeconds: _retryAfterSeconds, ...safe } = raw;
  const path = request.surface === 'image' ? '/app/image' : '/app';
  return {
    ...safe,
    result: null,
    library: {
      type: 'open_url',
      purpose: 'media_library',
      label: 'Open the MaxVideoAI media library',
      url: 'https://maxvideoai.com/app/library',
    },
    workspace: {
      type: 'open_url',
      purpose: 'generation',
      label: `Open this ${request.surface} in MaxVideoAI`,
      url: `https://maxvideoai.com${path}?job=${QUOTE_ID}`,
    },
    savedToLibrary: state === 'completed',
    retry: state === 'accepted'
      ? {
          tool: 'get_generation_status',
          arguments: { jobId: QUOTE_ID },
          afterSeconds: 5,
        }
      : null,
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
  assert.deepEqual(result, expectedRecovery(videoRequest));
  assert.deepEqual(captures.events, [
    'transaction', 'lock_quote', 'feature', 'restriction', 'catalog', 'membership', 'pricing',
    'spending', 'reserve_video', 'claim_quote', 'provider', 'accepted_quote', 'status',
  ]);
  assert.equal(captures.providerCalls, 1);
  assert.equal(captures.acceptedMarks, 1);
});

test('image confirmation uses the same atomic path and returns only the safe job DTO', async () => {
  const { dependencies, captures } = baseDependencies(imageRequest);
  const result = await confirmGeneration({ quoteId: QUOTE_ID, confirmed: true }, principal, dependencies);
  assert.deepEqual(result, expectedRecovery(imageRequest));
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

test('confirmation preserves resolver error details but neutralizes extend asset wording', async () => {
  const candidateEntry = listFalEngines().find((entry) => entry.id === 'seedance-2-5');
  assert.ok(candidateEntry);
  const candidate: AgentPublicGenerationEngine = {
    engine: candidateEntry.engine,
    surface: 'video',
    publicModes: ['t2v', 'i2v', 'ref2v', 'v2v', 'extend'],
    modeCaps: Object.fromEntries(candidateEntry.modes.map((mode) => [mode.mode, mode.ui])),
  };
  const request: CanonicalGenerationRequest = {
    schemaVersion: 1,
    surface: 'video',
    engineId: 'seedance-2-5',
    mode: 'extend',
    prompt: 'Extend this private clip.',
    settings: { durationSec: 4, resolution: '480p', aspectRatio: '16:9', audio: true },
    references: [{ kind: 'asset', assetId: 'private-source', role: 'source' }],
    outputCount: 1,
  };
  const cases = [
    ['REFERENCE_NOT_FOUND', 'Reference image not found.', 'Reference media not found.'],
    ['REFERENCE_INVALID', 'Reference image is not usable.', 'Reference media is not usable.'],
  ] as const;

  for (const [code, privateMessage, publicMessage] of cases) {
    const nextAction = { type: 'select_reference_media', mode: 'extend' };
    const { dependencies, captures } = baseDependencies(request, {
      listPublicEngines: async () => [candidate],
      resolveGenerationReferences: async () => {
        throw new AgentApiError(code, privateMessage, true, nextAction);
      },
    });
    await assert.rejects(
      confirmGeneration({ quoteId: QUOTE_ID, confirmed: true }, principal, dependencies),
      (error: unknown) => {
        assert.ok(error instanceof AgentApiError);
        assert.equal(error.code, code);
        assert.equal(error.message, publicMessage);
        assert.equal(error.retryable, true);
        assert.deepEqual(error.nextAction, nextAction);
        assert.doesNotMatch(error.message, /image/iu);
        return true;
      },
    );
    assert.equal(captures.events.includes('pricing'), false);
    assert.equal(captures.providerCalls, 0);
  }
});

test('Seedance accepts one frame URL in distinct first and last roles through reservation and submission', async () => {
  const candidateEntry = listFalEngines().find((entry) => entry.id === 'seedance-2-5');
  assert.ok(candidateEntry);
  const candidate: AgentPublicGenerationEngine = {
    engine: candidateEntry.engine,
    surface: 'video',
    publicModes: ['t2v', 'i2v', 'ref2v', 'v2v', 'extend'],
    modeCaps: Object.fromEntries(candidateEntry.modes.map((mode) => [mode.mode, mode.ui])),
  };
  const duplicateUrl = 'https://cdn.maxvideoai.com/mcp/duplicate-frame.png';
  const request: CanonicalGenerationRequest = {
    schemaVersion: 1,
    surface: 'video',
    engineId: 'seedance-2-5',
    mode: 'i2v',
    prompt: 'Animate one intentionally repeated frame.',
    settings: { durationSec: 4, resolution: '480p', audio: true },
    references: [
      { kind: 'https', url: duplicateUrl, role: 'first_frame', mediaKind: 'image' },
      { kind: 'https', url: duplicateUrl, role: 'last_frame', mediaKind: 'image' },
    ],
    outputCount: 1,
  };
  const catalogRevision = computeGenerationCatalogRevision([candidate]);
  const baseStored = quoteFor(request, { catalogRevision });
  const stored = {
    ...baseStored,
    pricingSnapshot: { ...baseStored.pricingSnapshot, catalogRevision },
  };
  const { dependencies, captures } = baseDependencies(request, {
    lockOwnedQuote: async () => ({ quote: stored, databaseNow: NOW }),
    listPublicEngines: async () => [candidate],
  });

  const result = await confirmGeneration(
    { quoteId: QUOTE_ID, confirmed: true },
    principal,
    dependencies,
  );
  assert.deepEqual(result, expectedRecovery(request));
  assert.equal(captures.events.includes('pricing'), true);
  assert.equal(captures.events.includes('spending'), true);
  assert.equal(captures.events.includes('reserve_video'), true);
  assert.equal(captures.providerCalls, 1);
});

test('Seedance ref2v audio-only input fails before pricing, wallet reservation, or provider submission', async () => {
  const candidateEntry = listFalEngines().find((entry) => entry.id === 'seedance-2-5');
  assert.ok(candidateEntry);
  const candidate: AgentPublicGenerationEngine = {
    engine: candidateEntry.engine,
    surface: 'video',
    publicModes: ['t2v', 'i2v', 'ref2v', 'v2v', 'extend'],
    modeCaps: Object.fromEntries(candidateEntry.modes.map((mode) => [mode.mode, mode.ui])),
  };
  const request: CanonicalGenerationRequest = {
    schemaVersion: 1,
    surface: 'video',
    engineId: 'seedance-2-5',
    mode: 'ref2v',
    prompt: 'Use a voice reference without inventing visual input.',
    settings: { durationSec: 4, resolution: '480p', aspectRatio: '16:9', audio: true },
    references: [{
      kind: 'https',
      url: 'https://cdn.maxvideoai.com/mcp/voice-only.wav',
      role: 'reference',
      mediaKind: 'audio',
    }],
    outputCount: 1,
  };
  const catalogRevision = computeGenerationCatalogRevision([candidate]);
  const stored = quoteFor(request, { catalogRevision });
  const { dependencies, captures } = baseDependencies(request, {
    lockOwnedQuote: async () => ({ quote: stored, databaseNow: NOW }),
    listPublicEngines: async () => [candidate],
  });

  await expectAgentError(
    confirmGeneration({ quoteId: QUOTE_ID, confirmed: true }, principal, dependencies),
    'QUOTE_EXPIRED',
  );
  assert.equal(captures.events.includes('pricing'), false);
  assert.equal(captures.events.includes('spending'), false);
  assert.equal(captures.events.includes('reserve_video'), false);
  assert.equal(captures.providerCalls, 0);
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

test('account paid-generation kill switch stops confirmation before wallet, job, claim, or provider work', async () => {
  const { dependencies, captures } = baseDependencies(videoRequest, {
    checkSpendingLimits: async () => ({
      allowed: false,
      code: 'SPENDING_LIMIT_EXCEEDED',
      reason: 'paid_generation_disabled',
      message: 'Paid generation is disabled in MaxVideoAI.',
      approvalUrl: '/account/connections?focus=mcp-spending',
      acceptedTodayCents: 0,
      projectedTodayCents: 125,
      limits: {
        perGenerationCents: null,
        dailyCents: null,
        webApprovalAboveCents: null,
      },
    }),
  });

  await expectAgentError(
    confirmGeneration({ quoteId: QUOTE_ID, confirmed: true }, principal, dependencies),
    'SPENDING_LIMIT_EXCEEDED',
  );
  assert.equal(captures.events.includes('reserve_video'), false);
  assert.equal(captures.events.includes('claim_quote'), false);
  assert.equal(captures.providerCalls, 0);
  assert.equal(captures.acceptedMarks, 0);
  assert.equal(captures.failedMarks, 0);
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

test('default registry remains five discovery tools and the explicit paid gate exposes the full paid recovery set safely', async () => {
  const services = {
    getAccountStatus: async () => ({
      connected: true, userId: USER_ID, emailVerified: true, accountUrl: 'https://maxvideoai.com/account',
      wallet: { availableBalanceCents: 0, currency: 'USD', topupUrl: 'https://maxvideoai.com/pricing' },
    }),
    listModels: async () => [],
    recommendModels: async () => ({ recommendations: [], guidance: [] }),
    prepareGeneration: async () => { throw new Error('not called'); },
    confirmGeneration: async () => safeStatus(videoRequest),
    getGenerationStatus: async () => ({
      ...safeStatus(videoRequest),
      retry: { tool: 'get_generation_status', arguments: { jobId: QUOTE_ID }, afterSeconds: 5 },
    }),
    listRecentGenerations: async () => ({ items: [], nextCursor: null }),
    createTopupLink: async () => ({ topupRequired: false, nextAction: {
      tool: 'confirm_generation', arguments: { quoteId: QUOTE_ID, confirmed: true },
    } }),
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
    'get_account_status', 'list_models', 'get_model_details', 'recommend_models',
    'calculate_project_budget',
  ]);
  const tools = (await enabledClient.listTools()).tools;
  assert.deepEqual(tools.map((tool) => tool.name), [
    'get_account_status', 'list_models', 'get_model_details', 'recommend_models',
    'calculate_project_budget', 'prepare_generation', 'confirm_generation',
    'get_generation_status', 'list_recent_generations', 'present_generation', 'create_topup_link',
  ]);
  const confirm = tools.find((tool) => tool.name === 'confirm_generation');
  assert.deepEqual(confirm?.annotations, {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true,
  });
  assert.match(confirm?.description ?? '', /funding locked into the quote/i);
  assert.match(confirm?.description ?? '', /wallet quotes may spend/i);
  assert.match(confirm?.description ?? '', /included trial does not/i);
  assert.doesNotMatch(confirm?.description ?? '', /this spends wallet funds/i);
  assert.match(confirm?.description ?? '', /external generation provider/i);
  assert.deepEqual(Object.keys(confirm?.inputSchema.properties ?? {}).sort(), ['confirmed', 'quoteId']);
});
