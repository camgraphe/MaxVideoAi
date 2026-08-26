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
import { AgentApiError, withMediaNeutralReferenceMessage } from './errors';
import {
  GenerationCapabilityError,
  validateCanonicalGenerationCapabilities,
} from './generation-capability-validation';
import { hashCanonicalGenerationRequest, stableJson } from './generation-normalization';
import {
  buildAgentGenerationRecovery,
  type AgentGenerationRecovery,
} from './generation-status';
import {
  assertCanonicalTrialRequest,
  isValidConfirmationMembership,
  requireTrialPrincipal,
  requireTrialRiskRequestContext,
  reserveIncludedTrialConfirmation,
  trialNotEligible,
} from './included-trial-confirmation';
import {
  priceCanonicalGenerationInExecutor,
  type GenerationPricingResult,
} from './generation-pricing';
import type { AgentPublicGenerationEngine } from './model-catalog';
import { listPublicAgentGenerationEnginesInExecutor } from './model-catalog';
import {
  reserveIncludedTrialGenerationInitialJob,
  reservePaidGenerationInitialJob,
  submitReservedIncludedTrialGeneration,
  submitReservedPaidGeneration,
  type IncludedTrialGenerationProviderOutcome,
  type IncludedTrialGenerationReservation,
  type PaidGenerationProviderOutcome,
  type PaidGenerationReservation,
} from './paid-generation-execution';
import { buildGenerationPricingSnapshot, type TrialRiskRequestContext } from './prepare-generation';
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
import { resolveOwnedReferenceAsset } from './reference-assets';
import { resolveGenerationReferences } from './resolve-generation-references';
import type { ResolvedReference } from './reference-types';
import {
  checkMcpConfirmationSpendingLimits,
  MCP_SPENDING_APPROVAL_PATH,
  type McpSpendingDecision,
} from './spending-limits';
import { isTrialEligibilityEnabled } from './trial-eligibility';
import {
  lockReservableEntitlement,
  reserveEntitlement,
  type LockedReservableEntitlement,
  type TrialEntitlement,
} from './trial-entitlement-repository';
import { acceptTrialRisk, type TrialRiskDecision, type TrialRiskInput } from './trial-risk';
import { applyTrialJobOutcome } from './trial-outcomes';

export type ConfirmGenerationInput = {
  quoteId: string;
  confirmed: true;
};

type ExecutorDependencies = { executor: TransactionQueryExecutor };
type SpendingDependencies = ExecutorDependencies;
type AccountRestriction = Awaited<ReturnType<typeof getActiveAccountRestrictionInExecutor>>;

export type ConfirmGenerationDependencies = {
  paidGenerationEnabled(): boolean;
  trialGenerationEnabled(): boolean;
  trialRiskContext: TrialRiskRequestContext;
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
    dependencies: ExecutorDependencies & {
      candidate: AgentPublicGenerationEngine;
      resolvedReferences?: readonly ResolvedReference[];
    },
  ): Promise<GenerationPricingResult>;
  checkSpendingLimits(
    input: { userId: string; priceCents: number; currency: string },
    dependencies: SpendingDependencies,
  ): Promise<McpSpendingDecision>;
  acceptTrialRisk(
    input: TrialRiskInput,
    dependencies: ExecutorDependencies,
  ): Promise<TrialRiskDecision>;
  lockReservableEntitlement(
    input: { userId: string },
    dependencies: ExecutorDependencies,
  ): Promise<LockedReservableEntitlement | null>;
  reserveEntitlement(
    input: {
      lockedEntitlement: LockedReservableEntitlement;
      quoteId: string;
      jobId: string;
      reasonCode: string;
    },
    dependencies: ExecutorDependencies,
  ): Promise<TrialEntitlement | null>;
  reserveInitialJob(
    input: {
      quote: McpGenerationQuote;
      candidate: AgentPublicGenerationEngine;
      pricingSnapshot: Record<string, unknown>;
      resolvedReferences?: ResolvedReference[];
    },
    dependencies: ExecutorDependencies,
  ): Promise<PaidGenerationReservation>;
  reserveTrialInitialJob(
    input: {
      quote: McpGenerationQuote;
      candidate: AgentPublicGenerationEngine;
      pricingSnapshot: Record<string, unknown>;
    },
    dependencies: ExecutorDependencies,
  ): Promise<IncludedTrialGenerationReservation>;
  claimPreparedQuote(
    input: OwnedQuoteJobInput,
    dependencies: ExecutorDependencies & { claimedAt: Date },
  ): Promise<McpGenerationQuote | null>;
  submitPaidGeneration(execution: PaidGenerationReservation['execution']): Promise<PaidGenerationProviderOutcome>;
  submitTrialGeneration(
    execution: IncludedTrialGenerationReservation['execution'],
  ): Promise<IncludedTrialGenerationProviderOutcome>;
  applyTrialJobOutcome: typeof applyTrialJobOutcome;
  markQuoteAccepted(input: OwnedQuoteJobInput): Promise<McpGenerationQuote | null>;
  markQuoteFailed(input: OwnedQuoteJobInput): Promise<McpGenerationQuote | null>;
  readGenerationStatus(input: { userId: string; jobId: string }): Promise<AgentGenerationStatus | null>;
  resolveGenerationReferences?(
    request: McpGenerationQuote['request'],
    principal: AgentPrincipal,
    dependencies: ExecutorDependencies,
  ): Promise<ResolvedReference[]>;
  accountUrl: string;
};

const defaultDependencies: Omit<ConfirmGenerationDependencies, 'trialRiskContext'> = {
  paidGenerationEnabled: () => false,
  trialGenerationEnabled: () => isTrialEligibilityEnabled(
    mcpPublication.trial,
    process.env.MCP_TRIAL_ENABLED,
  ),
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
  acceptTrialRisk: (input, { executor }) => acceptTrialRisk(input, { executor }),
  lockReservableEntitlement,
  reserveEntitlement,
  reserveInitialJob: reservePaidGenerationInitialJob,
  reserveTrialInitialJob: reserveIncludedTrialGenerationInitialJob,
  claimPreparedQuote,
  submitPaidGeneration: submitReservedPaidGeneration,
  submitTrialGeneration: submitReservedIncludedTrialGeneration,
  applyTrialJobOutcome,
  markQuoteAccepted,
  markQuoteFailed,
  readGenerationStatus: ({ userId, jobId }) => getGenerationStatus({ userId, jobId }),
  resolveGenerationReferences: (request, principal, { executor }) =>
    resolveGenerationReferences(request, principal, {
      resolveOwnedReferenceAsset: (currentPrincipal, assetId) =>
        resolveOwnedReferenceAsset(currentPrincipal, assetId, { executor }),
    }),
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

type TransactionResult =
  | { kind: 'expired' }
  | { kind: 'repeat'; jobId: string }
  | { kind: 'created_paid'; reservation: PaidGenerationReservation }
  | { kind: 'created_trial'; reservation: IncludedTrialGenerationReservation };

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

    const includedTrial = quote.fundingMode === 'trial';
    if (includedTrial) {
      if (!dependencies.trialGenerationEnabled()) trialNotEligible();
      requireTrialPrincipal(principal);
    } else if (!dependencies.paidGenerationEnabled()) {
      throw new AgentApiError('ENGINE_UNAVAILABLE', 'Paid generation is not available.');
    }

    if (await dependencies.getAccountRestriction(principal.userId, { executor })) {
      throw new AgentApiError(
        'ACCOUNT_RESTRICTED',
        'This account is temporarily restricted. Open MaxVideoAI for help.',
      );
    }
    if (hashCanonicalGenerationRequest(quote.request) !== quote.requestHash) {
      if (includedTrial) trialNotEligible();
      staleQuote();
    }

    const publicEngines = await dependencies.listPublicEngines({ executor });
    const candidate = publicEngines.find((entry) =>
      entry.engine.id === quote.request.engineId && entry.surface === quote.request.surface);
    if (!candidate || !candidate.publicModes.includes(quote.request.mode)) {
      if (includedTrial) trialNotEligible();
      staleQuote();
    }
    if (includedTrial) assertCanonicalTrialRequest(quote, candidate);
    try {
      validateCanonicalGenerationCapabilities(quote.request, candidate);
    } catch (error) {
      if (error instanceof GenerationCapabilityError) {
        if (includedTrial) trialNotEligible();
        staleQuote();
      }
      throw error;
    }
    let resolvedReferences: ResolvedReference[] = [];
    if (quote.request.references.some((reference) => reference.kind === 'asset')) {
      try {
        const resolveReferences = dependencies.resolveGenerationReferences
          ?? ((request, currentPrincipal, { executor: currentExecutor }) =>
            resolveGenerationReferences(request, currentPrincipal, {
              resolveOwnedReferenceAsset: (ownedPrincipal, assetId) =>
                resolveOwnedReferenceAsset(ownedPrincipal, assetId, { executor: currentExecutor }),
            }));
        resolvedReferences = await resolveReferences(quote.request, principal, { executor });
        validateCanonicalGenerationCapabilities(
          quote.request,
          candidate,
          { resolvedReferences },
        );
      } catch (error) {
        if (error instanceof GenerationCapabilityError) {
          if (includedTrial) trialNotEligible();
          staleQuote();
        }
        if (error instanceof AgentApiError) {
          throw quote.request.mode === 'v2v' || quote.request.mode === 'extend'
            ? withMediaNeutralReferenceMessage(error)
            : error;
        }
        throw new AgentApiError('INTERNAL_ERROR', 'The reference media could not be verified.');
      }
    }
    const catalogRevision = computeGenerationCatalogRevision(publicEngines);
    if (catalogRevision !== quote.catalogRevision) {
      if (includedTrial) trialNotEligible();
      staleQuote();
    }

    const membership = await dependencies.resolveMembershipPricing(principal.userId, { executor });
    if (!isValidConfirmationMembership(membership)) {
      if (includedTrial) trialNotEligible();
      staleQuote();
    }
    let pricing: GenerationPricingResult;
    try {
      pricing = await dependencies.priceGeneration(
        quote.request,
        membership.tier,
        { executor, candidate, resolvedReferences },
      );
    } catch (error) {
      if (error instanceof AgentApiError) throw error;
      if (includedTrial) trialNotEligible();
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
      if (includedTrial) trialNotEligible();
      staleQuote();
    }
    let reservation: PaidGenerationReservation | IncludedTrialGenerationReservation;
    if (includedTrial) {
      reservation = await reserveIncludedTrialConfirmation({
        quote,
        candidate,
        pricingSnapshot,
        pricing,
        principal,
        executor,
        dependencies,
      });
    } else {
      if (pricing.priceCents !== quote.priceCents
        || pricing.currency !== quote.currency
        || stableJson(pricingSnapshot) !== stableJson(quote.pricingSnapshot)) staleQuote();
      const spending = await dependencies.checkSpendingLimits(
        { userId: principal.userId, priceCents: quote.priceCents, currency: quote.currency },
        { executor },
      );
      if (!spending.allowed) throw spendingError(dependencies);
      try {
        reservation = await dependencies.reserveInitialJob(
          { quote, candidate, pricingSnapshot, resolvedReferences },
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
    return includedTrial
      ? { kind: 'created_trial', reservation: reservation as IncludedTrialGenerationReservation }
      : { kind: 'created_paid', reservation: reservation as PaidGenerationReservation };
  });
}

async function readSafeStatus(
  userId: string,
  jobId: string,
  dependencies: ConfirmGenerationDependencies,
): Promise<AgentGenerationRecovery> {
  const status = await dependencies.readGenerationStatus({ userId, jobId });
  if (!status || status.jobId !== jobId) {
    throw new AgentApiError('INTERNAL_ERROR', 'The confirmed generation status is unavailable.');
  }
  return buildAgentGenerationRecovery(status, dependencies.accountUrl);
}

export async function confirmGeneration(
  input: ConfirmGenerationInput,
  principal: AgentPrincipal,
  dependencies: ConfirmGenerationDependencies,
): Promise<AgentGenerationRecovery> {
  assertInput(input);
  requirePrincipal(principal);

  const transaction = await confirmationTransaction(input, principal, dependencies);
  if (transaction.kind === 'expired') staleQuote();
  if (transaction.kind === 'repeat') {
    return readSafeStatus(principal.userId, transaction.jobId, dependencies);
  }

  if (transaction.kind === 'created_trial') {
    let outcome: IncludedTrialGenerationProviderOutcome;
    try {
      outcome = await dependencies.submitTrialGeneration(transaction.reservation.execution);
    } catch {
      outcome = { kind: 'ambiguous', retryable: true };
    }
    try {
      await dependencies.applyTrialJobOutcome(
        transaction.reservation.jobId,
        { kind: outcome.kind === 'ambiguous' ? 'unknown' : outcome.kind },
      );
    } catch (error) {
      console.warn('[mcp-trial] outcome persistence deferred to reconciliation', {
        jobId: transaction.reservation.jobId,
        error: error instanceof Error ? error.message : 'unknown',
      });
    }
    return readSafeStatus(principal.userId, transaction.reservation.jobId, dependencies);
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
  trialRiskContext: TrialRiskRequestContext,
  dependencies: Partial<Omit<ConfirmGenerationDependencies, 'trialRiskContext'>> = {},
): (input: ConfirmGenerationInput, principal: AgentPrincipal) => Promise<AgentGenerationRecovery> {
  const requestContext = requireTrialRiskRequestContext(trialRiskContext);
  const resolved: ConfirmGenerationDependencies = {
    ...defaultDependencies,
    ...dependencies,
    trialRiskContext: requestContext,
    accountUrl,
  };
  return (input, principal) => confirmGeneration(input, principal, resolved);
}
