import {
  createInitialVideoJobInExecutor,
  type CreateVideoInitialJobParams,
  type GenerationFunding,
} from '@/app/api/generate/_lib/initial-video-job';
import { normalizeCurrencyCode, type Currency } from '@/lib/currency';
import type { TransactionQueryExecutor } from '@/lib/db';
import type { TrustedIncludedTrialBilling } from '@/server/generations/initial-job-reservation';
import { paidProviderSubmissionDependencies } from '@/server/generations/paid-provider-execution';

import { stableJson } from './generation-normalization';
import type { AgentPublicGenerationEngine } from './model-catalog';
import type {
  PaidGenerationSubmissionDependencies,
  PaidVideoExecutionResponse,
  ReservePaidGenerationInput,
} from './paid-generation-execution';
import type { McpGenerationQuote } from './quote-repository';

export type McpTrialFunding = Extract<GenerationFunding, { kind: 'mcp_trial' }>;

export type IncludedTrialGenerationExecution = {
  surface: 'video';
  quoteId: string;
  userId: string;
  request: McpGenerationQuote['request'];
  engine: AgentPublicGenerationEngine['engine'];
  canonicalPricing: Record<string, unknown>;
  pricingSnapshot: Record<string, unknown>;
  funding: McpTrialFunding;
  trustedInitialState: {
    kind: 'created';
    jobId: string;
    funding: McpTrialFunding;
  };
};

export type IncludedTrialGenerationReservation = {
  jobId: string;
  surface: 'video';
  execution: IncludedTrialGenerationExecution;
};

export type IncludedTrialGenerationProviderOutcome =
  | { kind: 'accepted' }
  | { kind: 'completed' }
  | { kind: 'rejected' }
  | { kind: 'ambiguous'; retryable: true };

export type IncludedTrialVideoContinuationOptions = {
  userId: string;
  body: Record<string, unknown>;
  engine: AgentPublicGenerationEngine['engine'];
  funding: McpTrialFunding;
  preReservedInitialState: IncludedTrialGenerationExecution['trustedInitialState'];
  trustedIncludedTrialBilling: TrustedIncludedTrialBilling;
};

function requiredSetting(quote: McpGenerationQuote, key: string): string {
  const value = quote.request.settings[key];
  if (typeof value !== 'string' || !value) throw new Error('Invalid reserved generation setting.');
  return value;
}

function preferredCurrency(currency: string): Currency {
  const normalized = normalizeCurrencyCode(currency);
  if (!normalized) throw new Error('Invalid reserved generation currency.');
  return normalized;
}

function vendorAccount(snapshot: Record<string, unknown>): string | null {
  const value = snapshot.vendorAccountId;
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function includedTrialVideoInitialParams(
  input: ReservePaidGenerationInput,
  pricing: Record<string, unknown>,
): CreateVideoInitialJobParams {
  const { quote, candidate } = input;
  if (quote.fundingMode !== 'trial'
    || quote.request.surface !== 'video'
    || quote.request.mode !== 't2v'
    || quote.priceCents !== 0
    || !quote.trialFunding
    || quote.trialFunding.kind !== 'included_trial') {
    throw new Error('Invalid included trial reservation.');
  }
  const durationSec = quote.request.settings.durationSec;
  if (!Number.isSafeInteger(durationSec) || (durationSec as number) < 1) {
    throw new Error('Invalid included trial duration.');
  }
  const aspectRatio = requiredSetting(quote, 'aspectRatio');
  const placeholder = aspectRatio === '9:16'
    ? '/assets/frames/thumb-9x16.svg'
    : aspectRatio === '1:1'
      ? '/assets/frames/thumb-1x1.svg'
      : '/assets/frames/thumb-16x9.svg';
  const funding: McpTrialFunding = {
    kind: 'mcp_trial',
    entitlementUserId: quote.userId,
    quoteId: quote.quoteId,
  };
  return {
    jobId: quote.quoteId,
    userId: quote.userId,
    funding,
    pendingReceipt: null,
    preferredCurrency: null,
    resolvedCurrencyLower: preferredCurrency(quote.currency),
    jobInsert: {
      jobId: quote.quoteId,
      userId: quote.userId,
      engineId: quote.request.engineId,
      engineLabel: candidate.engine.label,
      durationSec: durationSec as number,
      prompt: quote.request.prompt,
      thumbUrl: placeholder,
      aspectRatio,
      hasAudio: quote.request.settings.audio === true,
      canUpscale: Boolean(candidate.engine.upscale4k),
      previewFrame: placeholder,
      batchId: null,
      groupId: null,
      iterationIndex: null,
      iterationCount: null,
      renderIdsJson: null,
      heroRenderId: null,
      localKey: null,
      message: null,
      etaSeconds: null,
      etaLabel: null,
      provider: candidate.engine.provider,
      finalPriceCents: 0,
      pricingSnapshotJson: JSON.stringify(input.pricingSnapshot),
      costBreakdownJson: null,
      settingsSnapshotJson: JSON.stringify(quote.request),
      currency: quote.currency,
      vendorAccountId: vendorAccount(pricing),
      paymentStatus: 'included_mcp_trial',
      stripePaymentIntentId: null,
      stripeChargeId: null,
      visibility: 'private',
      indexable: false,
    },
  };
}

export async function reserveIncludedTrialGenerationInitialJob(
  input: ReservePaidGenerationInput,
  dependencies: { executor: TransactionQueryExecutor },
  canonicalPricing: Record<string, unknown>,
): Promise<IncludedTrialGenerationReservation> {
  const created = await createInitialVideoJobInExecutor(
    dependencies.executor,
    includedTrialVideoInitialParams(input, canonicalPricing),
  );
  if (created.kind !== 'created'
    || !('funding' in created)
    || created.funding.kind !== 'mcp_trial') {
    throw new Error('Reserved included trial job already existed unexpectedly.');
  }
  const trustedInitialState = {
    kind: 'created' as const,
    jobId: input.quote.quoteId,
    funding: created.funding,
  };
  return {
    jobId: input.quote.quoteId,
    surface: 'video',
    execution: {
      surface: 'video',
      quoteId: input.quote.quoteId,
      userId: input.quote.userId,
      request: input.quote.request,
      engine: input.candidate.engine,
      canonicalPricing,
      pricingSnapshot: input.pricingSnapshot,
      funding: created.funding,
      trustedInitialState,
    },
  };
}

function membershipTier(pricing: Record<string, unknown>): 'member' | 'plus' | 'pro' {
  const value = pricing.membershipTier;
  if (value !== 'member' && value !== 'plus' && value !== 'pro') {
    throw new Error('Invalid paid generation membership tier.');
  }
  return value;
}

function includedTrialRequestBody(execution: IncludedTrialGenerationExecution): Record<string, unknown> {
  const settings = { ...execution.request.settings };
  return {
    engineId: execution.request.engineId,
    mode: execution.request.mode,
    prompt: execution.request.prompt,
    jobId: execution.quoteId,
    membershipTier: membershipTier(execution.canonicalPricing),
    ...settings,
    inputs: [],
    referenceImages: [],
  };
}

const defaultSubmissionDependencies: PaidGenerationSubmissionDependencies = {
  ...paidProviderSubmissionDependencies,
};

export async function submitReservedIncludedTrialGeneration(
  execution: IncludedTrialGenerationExecution,
  dependencies: PaidGenerationSubmissionDependencies = defaultSubmissionDependencies,
): Promise<IncludedTrialGenerationProviderOutcome> {
  if (execution.surface !== 'video'
    || execution.request.surface !== 'video'
    || execution.request.mode !== 't2v'
    || execution.funding.kind !== 'mcp_trial'
    || execution.funding.entitlementUserId !== execution.userId
    || execution.funding.quoteId !== execution.quoteId
    || execution.trustedInitialState.jobId !== execution.quoteId
    || stableJson(execution.trustedInitialState.funding) !== stableJson(execution.funding)) {
    throw new Error('Invalid included trial continuation state.');
  }
  const body = includedTrialRequestBody(execution);
  try {
    const result: PaidVideoExecutionResponse = await dependencies.executeVideo({
      userId: execution.userId,
      body,
      engine: execution.engine,
      funding: execution.funding,
      preReservedInitialState: execution.trustedInitialState,
      trustedIncludedTrialBilling: {
        customerChargeCents: 0,
        paymentStatus: 'included_mcp_trial',
        membershipTier: membershipTier(execution.canonicalPricing),
        normalPricing: execution.canonicalPricing,
        pricingSnapshot: execution.pricingSnapshot,
      },
    });
    if (result.body.ok === true) {
      return typeof result.body.videoUrl === 'string'
        ? { kind: 'completed' }
        : { kind: 'accepted' };
    }
    if (typeof result.status === 'number' && result.status >= 400 && result.status < 500) {
      return { kind: 'rejected' };
    }
    return { kind: 'ambiguous', retryable: true };
  } catch (error) {
    const status = error && typeof error === 'object' && 'status' in error
      ? Number((error as { status?: unknown }).status)
      : Number.NaN;
    const code = error && typeof error === 'object' && 'code' in error
      ? String((error as { code?: unknown }).code)
      : '';
    if (Number.isFinite(status) && status >= 400 && status < 500 && code !== 'provider_outcome_ambiguous') {
      return { kind: 'rejected' };
    }
    return { kind: 'ambiguous', retryable: true };
  }
}
