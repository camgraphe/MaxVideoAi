import { getPlatformFeeCents } from '@maxvideoai/pricing';

import {
  createInitialVideoJobInExecutor,
  type CreateVideoInitialJobParams,
} from '@/app/api/generate/_lib/initial-video-job';
import { normalizeCurrencyCode, type Currency } from '@/lib/currency';
import type { TransactionQueryExecutor } from '@/lib/db';
import type { PricingSnapshot } from '@/types/engines';
import {
  createInitialImageJobInExecutor,
  type CreateImageInitialJobParams,
} from '@/server/images/image-initial-job';
import type { TrustedQuotedBilling } from '@/server/generations/initial-job-reservation';
import { paidProviderSubmissionDependencies } from '@/server/generations/paid-provider-execution';

import {
  reserveIncludedTrialGenerationInitialJob as reserveIncludedTrialGenerationWithPricing,
  submitReservedIncludedTrialGeneration,
  type IncludedTrialGenerationReservation,
  type IncludedTrialVideoContinuationOptions,
} from './included-trial-generation-execution';
import type { AgentPublicGenerationEngine } from './model-catalog';
import type { McpGenerationQuote } from './quote-repository';
import type { ResolvedReference } from './reference-types';
import { stableJson } from './generation-normalization';
import {
  buildPaidVideoRequestBody,
  resolvePaidMembershipTier,
} from './paid-video-request-body';

export { submitReservedIncludedTrialGeneration };
export type {
  IncludedTrialGenerationExecution,
  IncludedTrialGenerationProviderOutcome,
  IncludedTrialGenerationReservation,
  IncludedTrialVideoContinuationOptions,
} from './included-trial-generation-execution';

export type PaidGenerationExecution = {
  surface: 'video' | 'image';
  quoteId: string;
  userId: string;
  request: McpGenerationQuote['request'];
  resolvedReferences?: ResolvedReference[];
  engine: AgentPublicGenerationEngine['engine'];
  canonicalPricing: Record<string, unknown>;
  trustedInitialState:
    | { kind: 'created'; jobId: string; walletChargeReserved: true }
    | { kind: 'created'; jobId: string; recoveredCharge: true };
};

export type PaidGenerationReservation = {
  jobId: string;
  surface: 'video' | 'image';
  execution: PaidGenerationExecution;
};

export type PaidGenerationProviderOutcome =
  | { kind: 'accepted' }
  | { kind: 'completed' }
  | { kind: 'rejected'; refunded: true }
  | { kind: 'ambiguous'; retryable: true };

export type PaidVideoContinuationOptions = {
  userId: string;
  body: Record<string, unknown>;
  engine: AgentPublicGenerationEngine['engine'];
  walletReservation: 'already_reserved';
  preReservedInitialState: Extract<PaidGenerationExecution['trustedInitialState'], { walletChargeReserved: true }>;
  trustedQuotedBilling: TrustedQuotedBilling;
};

export type PaidImageContinuationOptions = {
  userId: string;
  body: Record<string, unknown>;
  walletReservation: 'already_reserved';
  preReservedInitialState: Extract<PaidGenerationExecution['trustedInitialState'], { recoveredCharge: true }>;
  trustedQuotedBilling: TrustedQuotedBilling;
  settingsSnapshot: unknown;
  jobSurface: 'image';
  billingProductKey: null;
};

export type PaidVideoExecutionResponse = {
  body: Record<string, unknown>;
  status?: number;
};

export type PaidImageExecutionResponse = {
  ok: boolean;
  paymentStatus?: string;
};

export type PaidGenerationSubmissionDependencies = {
  executeVideo(options: PaidVideoContinuationOptions | IncludedTrialVideoContinuationOptions): Promise<PaidVideoExecutionResponse>;
  executeImage(options: PaidImageContinuationOptions): Promise<PaidImageExecutionResponse>;
  ensureKnownRejectionRefund?(execution: PaidGenerationExecution): Promise<boolean>;
};

export type ReservePaidGenerationInput = {
  quote: McpGenerationQuote;
  candidate: AgentPublicGenerationEngine;
  pricingSnapshot: Record<string, unknown>;
  resolvedReferences?: ResolvedReference[];
};

type ReservePaidGenerationDependencies = {
  executor: TransactionQueryExecutor;
};

function record(value: unknown, message: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(message);
  return value as Record<string, unknown>;
}

function optionalSetting(
  quote: McpGenerationQuote,
  key: string,
): string | null {
  const value = quote.request.settings[key];
  if (value === undefined) return null;
  if (typeof value !== 'string' || !value) throw new Error('Invalid reserved generation setting.');
  return value;
}

function canonicalPricing(input: ReservePaidGenerationInput): Record<string, unknown> {
  const stored = record(input.quote.pricingSnapshot.canonicalPricing, 'Invalid stored generation pricing.');
  const authoritative = record(input.pricingSnapshot.canonicalPricing, 'Invalid authoritative generation pricing.');
  if (stableJson(stored) !== stableJson(authoritative)) {
    throw new Error('Stored generation pricing changed before reservation.');
  }
  return stored;
}

function platformFee(snapshot: Record<string, unknown>): number | null {
  const cents = getPlatformFeeCents(snapshot as unknown as PricingSnapshot);
  return Number.isSafeInteger(cents) && cents >= 0 ? cents : null;
}

function vendorAccount(snapshot: Record<string, unknown>): string | null {
  const value = snapshot.vendorAccountId;
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function preferredCurrency(currency: string): Currency {
  const normalized = normalizeCurrencyCode(currency);
  if (!normalized) throw new Error('Invalid reserved generation currency.');
  return normalized;
}

function videoInitialParams(
  input: ReservePaidGenerationInput,
  pricing: Record<string, unknown>,
): CreateVideoInitialJobParams {
  const { quote, candidate } = input;
  const durationSec = quote.request.settings.durationSec;
  if (!Number.isSafeInteger(durationSec) || (durationSec as number) < 1) {
    throw new Error('Invalid reserved video duration.');
  }
  const aspectRatio = optionalSetting(quote, 'aspectRatio');
  const placeholder = aspectRatio === '9:16'
    ? '/assets/frames/thumb-9x16.svg'
    : aspectRatio === '1:1'
      ? '/assets/frames/thumb-1x1.svg'
      : '/assets/frames/thumb-16x9.svg';
  const fee = platformFee(pricing);
  const vendorAccountId = vendorAccount(pricing);
  const pricingJson = JSON.stringify(pricing);
  return {
    jobId: quote.quoteId,
    userId: quote.userId,
    paymentMode: 'wallet',
    walletReservation: 'reserve',
    funding: { kind: 'wallet', reservation: 'reserve' },
    pendingReceipt: {
      userId: quote.userId,
      amountCents: quote.priceCents,
      currency: quote.currency,
      description: `MCP ${candidate.engine.label} - ${durationSec}s`,
      jobId: quote.quoteId,
      snapshot: pricing,
      applicationFeeCents: fee,
      vendorAccountId,
    },
    preferredCurrency: preferredCurrency(quote.currency),
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
      hasAudio: quote.request.settings.audio === true
        || quote.request.mode === 'a2v'
        || quote.request.mode === 'retake',
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
      finalPriceCents: quote.priceCents,
      pricingSnapshotJson: pricingJson,
      costBreakdownJson: null,
      settingsSnapshotJson: JSON.stringify(quote.request),
      currency: quote.currency,
      vendorAccountId,
      paymentStatus: 'paid_wallet',
      stripePaymentIntentId: null,
      stripeChargeId: null,
      visibility: 'private',
      indexable: false,
    },
  };
}

function imageInitialParams(
  input: ReservePaidGenerationInput,
  pricing: Record<string, unknown>,
): CreateImageInitialJobParams {
  const { quote, candidate } = input;
  const fee = platformFee(pricing);
  const vendorAccountId = vendorAccount(pricing);
  return {
    userId: quote.userId,
    mode: quote.request.mode === 'i2i' ? 'i2i' : 't2i',
    jobId: quote.quoteId,
    surface: 'image',
    billingProductKey: null,
    description: `MCP ${candidate.engine.label} image generation`,
    amountCents: quote.priceCents,
    currency: quote.currency,
    pricingSnapshotJson: JSON.stringify(pricing),
    applicationFeeCents: fee,
    vendorAccountId,
    engineId: quote.request.engineId,
    engineLabel: candidate.engine.label,
    durationSec: 0,
    prompt: quote.request.prompt,
    aspectRatio: optionalSetting(quote, 'aspectRatio'),
    canUpscale: Boolean(candidate.engine.upscale4k),
    finalPriceCents: quote.priceCents,
    costBreakdownJson: null,
    settingsSnapshotJson: JSON.stringify(quote.request),
    visibility: 'private',
    indexable: false,
    preferredCurrency: preferredCurrency(quote.currency),
    walletReservation: 'reserve',
    walletChargeMode: 'charge',
  };
}

export async function reservePaidGenerationInitialJob(
  input: ReservePaidGenerationInput,
  dependencies: ReservePaidGenerationDependencies,
): Promise<PaidGenerationReservation> {
  const pricing = canonicalPricing(input);
  if (input.quote.request.surface === 'video') {
    const created = await createInitialVideoJobInExecutor(
      dependencies.executor,
      videoInitialParams(input, pricing),
    );
    if (created.kind !== 'created'
      || !('walletChargeReserved' in created)
      || created.walletChargeReserved !== true) {
      throw new Error('Reserved video job already existed unexpectedly.');
    }
    return {
      jobId: input.quote.quoteId,
      surface: 'video',
      execution: {
        surface: 'video',
        quoteId: input.quote.quoteId,
        userId: input.quote.userId,
        request: input.quote.request,
        resolvedReferences: input.resolvedReferences ?? [],
        engine: input.candidate.engine,
        canonicalPricing: pricing,
        trustedInitialState: {
          kind: 'created',
          jobId: input.quote.quoteId,
          walletChargeReserved: true,
        },
      },
    };
  }

  const created = await createInitialImageJobInExecutor(
    dependencies.executor,
    imageInitialParams(input, pricing),
  );
  if (created.kind !== 'created') {
    throw new Error('Reserved image job already existed unexpectedly.');
  }
  return {
    jobId: input.quote.quoteId,
    surface: 'image',
    execution: {
      surface: 'image',
      quoteId: input.quote.quoteId,
      userId: input.quote.userId,
      request: input.quote.request,
      resolvedReferences: input.resolvedReferences ?? [],
      engine: input.candidate.engine,
      canonicalPricing: pricing,
      trustedInitialState: {
        kind: 'created',
        jobId: input.quote.quoteId,
        recoveredCharge: true,
      },
    },
  };
}

export async function reserveIncludedTrialGenerationInitialJob(
  input: ReservePaidGenerationInput,
  dependencies: ReservePaidGenerationDependencies,
): Promise<IncludedTrialGenerationReservation> {
  const pricing = canonicalPricing(input);
  return reserveIncludedTrialGenerationWithPricing(input, dependencies, pricing);
}

function materializedImageReferenceUrls(
  execution: PaidGenerationExecution,
  role: 'generation' | 'mask',
): string[] {
  return execution.request.references.flatMap((reference) => {
    if ((reference.role === 'mask') !== (role === 'mask')) return [];
    if (reference.kind === 'https') return [reference.url];
    const resolved = (execution.resolvedReferences ?? []).find((candidate) =>
      candidate.assetId === reference.assetId
      && candidate.role === reference.role
      && candidate.slot === reference.slot);
    if (!resolved) throw new Error('A verified resolved reference is required before provider submission.');
    return [resolved.storageUrl];
  });
}

function paidRequestBody(execution: PaidGenerationExecution): Record<string, unknown> {
  if (execution.surface === 'video') return buildPaidVideoRequestBody(execution);
  const settings = { ...execution.request.settings };
  const imageWidth = settings.imageWidth;
  const imageHeight = settings.imageHeight;
  delete settings.imageWidth;
  delete settings.imageHeight;
  const masks = materializedImageReferenceUrls(execution, 'mask');
  if (masks.length > 1) throw new Error('Only one verified image mask can be submitted.');
  return {
    engineId: execution.request.engineId,
    mode: execution.request.mode,
    prompt: execution.request.prompt,
    jobId: execution.quoteId,
    payment: { mode: 'wallet' },
    membershipTier: resolvePaidMembershipTier(execution.canonicalPricing),
    ...settings,
    numImages: execution.request.outputCount,
    imageUrls: materializedImageReferenceUrls(execution, 'generation'),
    ...(masks[0] ? { maskUrl: masks[0] } : {}),
    ...(typeof imageWidth === 'number' && typeof imageHeight === 'number'
      ? { customImageSize: { width: imageWidth, height: imageHeight } }
      : {}),
  };
}

function refunded(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const paymentStatus = (value as { paymentStatus?: unknown }).paymentStatus;
  return paymentStatus === 'refunded' || paymentStatus === 'refunded_wallet';
}

const defaultSubmissionDependencies: PaidGenerationSubmissionDependencies = {
  ...paidProviderSubmissionDependencies,
};

async function rejectedOutcome(
  execution: PaidGenerationExecution,
  dependencies: PaidGenerationSubmissionDependencies,
  hasRefundMarker: boolean,
): Promise<PaidGenerationProviderOutcome> {
  if (dependencies.ensureKnownRejectionRefund) {
    return await dependencies.ensureKnownRejectionRefund(execution)
      ? { kind: 'rejected', refunded: true }
      : { kind: 'ambiguous', retryable: true };
  }
  return hasRefundMarker
    ? { kind: 'rejected', refunded: true }
    : { kind: 'ambiguous', retryable: true };
}

export async function submitReservedPaidGeneration(
  execution: PaidGenerationExecution,
  dependencies: PaidGenerationSubmissionDependencies = defaultSubmissionDependencies,
): Promise<PaidGenerationProviderOutcome> {
  const trustedQuotedBilling: TrustedQuotedBilling = {
    pricing: execution.canonicalPricing as unknown as PricingSnapshot,
    membershipTier: resolvePaidMembershipTier(execution.canonicalPricing),
  };
  const body = paidRequestBody(execution);
  try {
    if (execution.surface === 'video') {
      if (!('walletChargeReserved' in execution.trustedInitialState)
        || execution.trustedInitialState.walletChargeReserved !== true) {
        throw new Error('Invalid paid video continuation state.');
      }
      const result = await dependencies.executeVideo({
        userId: execution.userId,
        body,
        engine: execution.engine,
        walletReservation: 'already_reserved',
        preReservedInitialState: execution.trustedInitialState,
        trustedQuotedBilling,
      });
      if (result.body.ok === true) {
        return typeof result.body.videoUrl === 'string'
          ? { kind: 'completed' }
          : { kind: 'accepted' };
      }
      const hasRefundMarker = refunded(result.body);
      if (hasRefundMarker || (typeof result.status === 'number' && result.status >= 400 && result.status < 500)) {
        return rejectedOutcome(execution, dependencies, hasRefundMarker);
      }
      return { kind: 'ambiguous', retryable: true };
    }

    if (!('recoveredCharge' in execution.trustedInitialState)
      || execution.trustedInitialState.recoveredCharge !== true) {
      throw new Error('Invalid paid image continuation state.');
    }
    const result = await dependencies.executeImage({
      userId: execution.userId,
      body: body as PaidImageContinuationOptions['body'],
      walletReservation: 'already_reserved',
      preReservedInitialState: execution.trustedInitialState,
      trustedQuotedBilling,
      settingsSnapshot: execution.request,
      jobSurface: 'image',
      billingProductKey: null,
    });
    if (result.ok) return { kind: 'completed' };
    return refunded(result)
      ? rejectedOutcome(execution, dependencies, true)
      : { kind: 'ambiguous', retryable: true };
  } catch (error) {
    const extras = error && typeof error === 'object' && 'extras' in error
      ? (error as { extras?: unknown }).extras
      : null;
    const status = error && typeof error === 'object' && 'status' in error
      ? Number((error as { status?: unknown }).status)
      : Number.NaN;
    const code = error && typeof error === 'object' && 'code' in error
      ? String((error as { code?: unknown }).code)
      : '';
    const hasRefundMarker = refunded(extras);
    if (hasRefundMarker || (Number.isFinite(status) && status >= 400 && status < 500 && code !== 'provider_outcome_ambiguous')) {
      return rejectedOutcome(execution, dependencies, hasRefundMarker);
    }
    return { kind: 'ambiguous', retryable: true };
  }
}
