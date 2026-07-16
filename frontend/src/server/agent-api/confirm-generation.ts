import mcpPublication from '@/config/mcp-publication.json';
import { withDbTransaction, type TransactionQueryExecutor } from '@/lib/db';
import { loadMembershipTiersWithExecutor } from '@/lib/membership';
import { getActiveAccountRestrictionInExecutor } from '@/server/fraud-cleanup';
import {
  getGenerationStatus,
  type AgentGenerationStatus,
} from '@/server/generations/generation-status';
import { getUserMembershipStatus, type MembershipPricingContext } from '@/server/membership/user-membership-status';

import { computeGenerationCatalogRevision } from './catalog-revision';
import { AgentApiError } from './errors';
import {
  GenerationCapabilityError,
  validateCanonicalGenerationCapabilities,
} from './generation-capability-validation';
import { hashCanonicalGenerationRequest } from './generation-normalization';
import {
  priceCanonicalGenerationInExecutor,
  type GenerationPricingResult,
} from './generation-pricing';
import type { AgentPublicGenerationEngine } from './model-catalog';
import { listPublicAgentGenerationEnginesInExecutor } from './model-catalog';
import {
  reservePaidGenerationInitialJob,
  submitReservedPaidGeneration,
  type PaidGenerationProviderOutcome,
  type PaidGenerationReservation,
} from './paid-generation-execution';
import { buildGenerationPricingSnapshot } from './prepare-generation';
import type { AgentPrincipal } from './principal';
import {
  claimPreparedQuote,
  lockOwnedQuote,
  markQuoteAccepted,
  markQuoteExpired,
  markQuoteFailed,
  type LockedOwnedQuote,
  type McpGenerationQuote,
  type OwnedQuoteInput,
  type OwnedQuoteJobInput,
} from './quote-repository';
import {
  checkMcpConfirmationSpendingLimits,
  MCP_SPENDING_APPROVAL_PATH,
  type McpSpendingDecision,
} from './spending-limits';

export type ConfirmGenerationInput = {
  quoteId: string;
  confirmed: true;
};

type ExecutorDependencies = { executor: TransactionQueryExecutor };
type SpendingDependencies = ExecutorDependencies & { now?: () => Date };
type AccountRestriction = Awaited<ReturnType<typeof getActiveAccountRestrictionInExecutor>>;

export type ConfirmGenerationDependencies = {
  paidGenerationEnabled(): boolean;
  withTransaction<TResult>(
    callback: (executor: TransactionQueryExecutor) => Promise<TResult>,
  ): Promise<TResult>;
  lockOwnedQuote(input: OwnedQuoteInput, dependencies: ExecutorDependencies): Promise<LockedOwnedQuote | null>;
  markQuoteExpired(
    input: OwnedQuoteInput,
    dependencies: ExecutorDependencies & { expiredAt: Date },
  ): Promise<McpGenerationQuote | null>;
  getAccountRestriction(userId: string, dependencies: ExecutorDependencies): Promise<AccountRestriction>;
  listPublicEngines(dependencies: ExecutorDependencies): Promise<AgentPublicGenerationEngine[]>;
  resolveMembershipPricing(
    userId: string,
    dependencies: ExecutorDependencies,
  ): Promise<MembershipPricingContext>;
  priceGeneration(
    request: McpGenerationQuote['request'],
    membershipTier: MembershipPricingContext['tier'],
    dependencies: ExecutorDependencies & { candidate: AgentPublicGenerationEngine },
  ): Promise<GenerationPricingResult>;
  checkSpendingLimits(
    input: { userId: string; priceCents: number; currency: string },
    dependencies: SpendingDependencies,
  ): Promise<McpSpendingDecision>;
  reserveInitialJob(
    input: {
      quote: McpGenerationQuote;
      candidate: AgentPublicGenerationEngine;
      pricingSnapshot: Record<string, unknown>;
    },
    dependencies: ExecutorDependencies,
  ): Promise<PaidGenerationReservation>;
  claimPreparedQuote(
    input: OwnedQuoteJobInput,
    dependencies: ExecutorDependencies & { claimedAt: Date },
  ): Promise<McpGenerationQuote | null>;
  submitPaidGeneration(execution: PaidGenerationReservation['execution']): Promise<PaidGenerationProviderOutcome>;
  markQuoteAccepted(input: OwnedQuoteJobInput): Promise<McpGenerationQuote | null>;
  markQuoteFailed(input: OwnedQuoteJobInput): Promise<McpGenerationQuote | null>;
  readGenerationStatus(input: { userId: string; jobId: string }): Promise<AgentGenerationStatus | null>;
  accountUrl: string;
};

const defaultDependencies: ConfirmGenerationDependencies = {
  paidGenerationEnabled: () => mcpPublication.paidGeneration,
  withTransaction: (callback) => withDbTransaction((executor) => callback(executor)),
  lockOwnedQuote,
  markQuoteExpired,
  getAccountRestriction: (userId, { executor }) =>
    getActiveAccountRestrictionInExecutor(userId, executor),
  listPublicEngines: ({ executor }) => listPublicAgentGenerationEnginesInExecutor(executor),
  resolveMembershipPricing: async (userId, { executor }) => (
    await getUserMembershipStatus(userId, {
      executor,
      getMembershipTiers: () => loadMembershipTiersWithExecutor(executor, { lock: true }),
    })
  ).pricing,
  priceGeneration: (request, membershipTier, dependencies) =>
    priceCanonicalGenerationInExecutor(request, membershipTier, dependencies),
  checkSpendingLimits: checkMcpConfirmationSpendingLimits,
  reserveInitialJob: reservePaidGenerationInitialJob,
  claimPreparedQuote,
  submitPaidGeneration: submitReservedPaidGeneration,
  markQuoteAccepted,
  markQuoteFailed,
  readGenerationStatus: ({ userId, jobId }) => getGenerationStatus({ userId, jobId }),
  accountUrl: 'https://maxvideoai.com/account/connections',
};

const INPUT_KEYS = new Set(['quoteId', 'confirmed']);
const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function isRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function assertInput(value: unknown): asserts value is ConfirmGenerationInput {
  if (!isRecord(value)) throw new AgentApiError('PARAMETER_INVALID', 'The confirmation request is invalid.');
  const keys = Reflect.ownKeys(value);
  if (
    keys.length !== INPUT_KEYS.size
    || keys.some((key) => typeof key !== 'string' || !INPUT_KEYS.has(key))
    || value.confirmed !== true
    || typeof value.quoteId !== 'string'
    || !UUID_V4_PATTERN.test(value.quoteId)
  ) {
    throw new AgentApiError('PARAMETER_INVALID', 'The confirmation request is invalid.');
  }
  for (const key of INPUT_KEYS) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) {
      throw new AgentApiError('PARAMETER_INVALID', 'The confirmation request is invalid.');
    }
  }
}

function requirePrincipal(principal: AgentPrincipal): void {
  if (
    !principal
    || principal.authMethod !== 'oauth'
    || typeof principal.userId !== 'string'
    || !principal.userId.trim()
    || principal.userId !== principal.userId.trim()
    || principal.userId.length > 128
    || (principal.clientId !== null
      && (typeof principal.clientId !== 'string'
        || !principal.clientId.trim()
        || principal.clientId !== principal.clientId.trim()
        || principal.clientId.length > 256))
  ) {
    throw new AgentApiError('AUTH_REQUIRED', 'Connect MaxVideoAI before confirming a generation.');
  }
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  return `{${Object.keys(value as Record<string, unknown>)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableJson((value as Record<string, unknown>)[key])}`)
    .join(',')}}`;
}

function staleQuote(): never {
  throw new AgentApiError(
    'QUOTE_EXPIRED',
    'This quote is no longer current. Prepare the generation again before confirming.',
  );
}

function spendingError(dependencies: ConfirmGenerationDependencies): AgentApiError {
  let url: string;
  try {
    url = new URL(MCP_SPENDING_APPROVAL_PATH, dependencies.accountUrl).toString();
  } catch {
    throw new AgentApiError('INTERNAL_ERROR', 'The spending approval handoff is unavailable.');
  }
  return new AgentApiError(
    'SPENDING_LIMIT_EXCEEDED',
    'This generation is above the spending controls configured in MaxVideoAI.',
    false,
    { type: 'open_url', url },
  );
}

function validateMembership(value: MembershipPricingContext): MembershipPricingContext {
  if (
    !value
    || !['member', 'plus', 'pro'].includes(value.tier)
    || value.source !== 'app_receipts_rolling_30d'
    || !Number.isSafeInteger(value.spent30Cents)
    || value.spent30Cents < 0
    || !Number.isSafeInteger(value.thresholdCents)
    || value.thresholdCents < 0
    || typeof value.discountPercent !== 'number'
    || !Number.isFinite(value.discountPercent)
    || value.discountPercent < 0
    || value.discountPercent > 1
  ) staleQuote();
  return value;
}

type TransactionResult =
  | { kind: 'expired' }
  | { kind: 'repeat'; jobId: string }
  | { kind: 'created'; reservation: PaidGenerationReservation };

async function confirmationTransaction(
  input: ConfirmGenerationInput,
  principal: AgentPrincipal,
  dependencies: ConfirmGenerationDependencies,
): Promise<TransactionResult> {
  return dependencies.withTransaction(async (executor) => {
    const owner = {
      quoteId: input.quoteId,
      userId: principal.userId,
      oauthClientId: principal.clientId,
    };
    const locked = await dependencies.lockOwnedQuote(owner, { executor });
    if (!locked) staleQuote();
    const { quote, databaseNow } = locked;

    if (quote.state === 'claimed' || quote.state === 'accepted' || quote.state === 'failed') {
      if (!quote.jobId) staleQuote();
      return { kind: 'repeat', jobId: quote.jobId };
    }
    if (quote.state === 'expired') return { kind: 'expired' };
    if (quote.state !== 'prepared') staleQuote();
    if (quote.expiresAt <= databaseNow) {
      await dependencies.markQuoteExpired(owner, { executor, expiredAt: databaseNow });
      return { kind: 'expired' };
    }

    if (await dependencies.getAccountRestriction(principal.userId, { executor })) {
      throw new AgentApiError(
        'ACCOUNT_RESTRICTED',
        'This account is temporarily restricted. Open MaxVideoAI for help.',
      );
    }
    if (hashCanonicalGenerationRequest(quote.request) !== quote.requestHash) staleQuote();

    const publicEngines = await dependencies.listPublicEngines({ executor });
    const candidate = publicEngines.find((entry) =>
      entry.engine.id === quote.request.engineId && entry.surface === quote.request.surface);
    if (!candidate || !candidate.publicModes.includes(quote.request.mode)) staleQuote();
    try {
      validateCanonicalGenerationCapabilities(quote.request, candidate);
    } catch (error) {
      if (error instanceof GenerationCapabilityError) staleQuote();
      throw error;
    }
    const catalogRevision = computeGenerationCatalogRevision(publicEngines);
    if (catalogRevision !== quote.catalogRevision) staleQuote();

    const membership = validateMembership(
      await dependencies.resolveMembershipPricing(principal.userId, { executor }),
    );
    let pricing: GenerationPricingResult;
    try {
      pricing = await dependencies.priceGeneration(
        quote.request,
        membership.tier,
        { executor, candidate },
      );
    } catch (error) {
      if (error instanceof AgentApiError) throw error;
      staleQuote();
    }
    let pricingSnapshot: Record<string, unknown>;
    try {
      pricingSnapshot = buildGenerationPricingSnapshot(
        pricing,
        quote.request,
        catalogRevision,
        membership,
      );
    } catch {
      staleQuote();
    }
    if (
      pricing.priceCents !== quote.priceCents
      || pricing.currency !== quote.currency
      || stableJson(pricingSnapshot) !== stableJson(quote.pricingSnapshot)
    ) staleQuote();

    const spending = await dependencies.checkSpendingLimits(
      { userId: principal.userId, priceCents: quote.priceCents, currency: quote.currency },
      { executor, now: () => databaseNow },
    );
    if (!spending.allowed) throw spendingError(dependencies);

    let reservation: PaidGenerationReservation;
    try {
      reservation = await dependencies.reserveInitialJob(
        { quote, candidate, pricingSnapshot },
        { executor },
      );
    } catch (error) {
      if (error instanceof AgentApiError) throw error;
      const code = error && typeof error === 'object' && 'code' in error
        ? String((error as { code?: unknown }).code)
        : '';
      const status = error && typeof error === 'object' && 'status' in error
        ? Number((error as { status?: unknown }).status)
        : 0;
      if (status === 402 || /insufficient/i.test(code)) {
        throw new AgentApiError('INSUFFICIENT_FUNDS', 'Add funds before confirming this generation.');
      }
      throw error;
    }
    if (reservation.jobId !== quote.quoteId || reservation.surface !== quote.request.surface) {
      throw new AgentApiError('INTERNAL_ERROR', 'The generation reservation is inconsistent.');
    }
    const claimed = await dependencies.claimPreparedQuote(
      { ...owner, jobId: reservation.jobId },
      { executor, claimedAt: databaseNow },
    );
    if (!claimed || claimed.state !== 'claimed' || claimed.jobId !== reservation.jobId) {
      throw new AgentApiError('INTERNAL_ERROR', 'The generation quote could not be claimed.');
    }
    return { kind: 'created', reservation };
  });
}

async function readSafeStatus(
  userId: string,
  jobId: string,
  dependencies: ConfirmGenerationDependencies,
): Promise<AgentGenerationStatus> {
  const status = await dependencies.readGenerationStatus({ userId, jobId });
  if (!status || status.jobId !== jobId) {
    throw new AgentApiError('INTERNAL_ERROR', 'The confirmed generation status is unavailable.');
  }
  return status;
}

export async function confirmGeneration(
  input: ConfirmGenerationInput,
  principal: AgentPrincipal,
  dependencies: ConfirmGenerationDependencies = defaultDependencies,
): Promise<AgentGenerationStatus> {
  assertInput(input);
  requirePrincipal(principal);
  if (!dependencies.paidGenerationEnabled()) {
    throw new AgentApiError('ENGINE_UNAVAILABLE', 'Paid generation is not available.');
  }

  const transaction = await confirmationTransaction(input, principal, dependencies);
  if (transaction.kind === 'expired') staleQuote();
  if (transaction.kind === 'repeat') {
    return readSafeStatus(principal.userId, transaction.jobId, dependencies);
  }

  const mutation = {
    quoteId: input.quoteId,
    userId: principal.userId,
    oauthClientId: principal.clientId,
    jobId: transaction.reservation.jobId,
  };
  let outcome: PaidGenerationProviderOutcome;
  try {
    outcome = await dependencies.submitPaidGeneration(transaction.reservation.execution);
  } catch {
    outcome = { kind: 'ambiguous', retryable: true };
  }
  if (outcome.kind === 'accepted' || outcome.kind === 'completed') {
    await dependencies.markQuoteAccepted(mutation);
  } else if (outcome.kind === 'rejected' && outcome.refunded === true) {
    await dependencies.markQuoteFailed(mutation);
  }
  return readSafeStatus(principal.userId, transaction.reservation.jobId, dependencies);
}

export function createConfirmGenerationService(
  accountUrl: string,
  dependencies: Partial<ConfirmGenerationDependencies> = {},
): (input: ConfirmGenerationInput, principal: AgentPrincipal) => Promise<AgentGenerationStatus> {
  const resolved = { ...defaultDependencies, ...dependencies, accountUrl };
  return (input, principal) => confirmGeneration(input, principal, resolved);
}
