import { withDbTransaction, type QueryExecutor, type TransactionQueryExecutor } from '@/lib/db';
import {customerDisplayPrice,type CustomerDisplayPrice} from '@/lib/customer-price-presentation';
import { getActiveAccountRestriction } from '@/server/fraud-cleanup';
import {
  getUserMembershipStatus,
  type MembershipPricingContext,
} from '@/server/membership/user-membership-status';
import { getWalletSummary, type WalletSummary } from '@/server/wallet-summary';

import { AgentApiError } from './errors';
import {readGenerationPricing} from './generation-pricing-read';
export {buildGenerationPricingSnapshot} from './generation-pricing-read';
import {
  hashCanonicalGenerationRequest,
  normalizeGenerationRequest,
} from './generation-normalization';
import {
  priceCanonicalGeneration,
  type GenerationPricingReferenceContext,
  type GenerationPricingResult,
} from './generation-pricing';
import type {
  CanonicalGenerationRequest,
  GenerationFundingMode,
  IncludedTrialFundingSnapshot,
} from './generation-types';
import {
  listPublicAgentGenerationEngines,
  type AgentPublicGenerationEngine,
} from './model-catalog';
import type { AgentPrincipal } from './principal';
import { requireGenerationActor, requireOAuthGenerationActor, requireStudioGenerationRequest, quoteMatchesActor, bindStudioReferenceSnapshot, type GenerationActor } from './generation-actor';
import {
  insertPreparedQuote,
  type InsertPreparedQuoteInput,
  type McpGenerationQuote,
} from './quote-repository';
import { resolveGenerationReferencesForActor } from './resolve-generation-references';
import type { ResolvedReference } from './reference-types';
import {
  checkMcpSpendingLimits,
  MCP_SPENDING_APPROVAL_PATH,
  type McpSpendingDecision,
} from './spending-limits';
import { getTrialEligibility } from './trial-eligibility';
import {
  resolveAgentGenerationRequestExecutability,
  type AgentGenerationExecutabilityDecision,
} from '../agent-runtime/model-executability';
import {
  normalizeTrialCandidate,
  TrialCandidateError,
} from './trial-preset';
import {
  checkTrialRisk,
  type TrialRiskDecision,
  type TrialRiskInput,
} from './trial-risk';
import {
  recordTrialQuotePreparedAudit,
  type TrialQuotePreparedAuditInput,
} from './trial-quote-audit-repository';
import { requireTrialProviderCostCents } from './trial-provider-cost';
import type { TrialStatus } from './types';

export type PrepareGenerationInput = Omit<
  CanonicalGenerationRequest,
  'schemaVersion' | 'settings' | 'references' | 'outputCount'
> & {
  schemaVersion?: 1;
  settings?: CanonicalGenerationRequest['settings'];
  references?: CanonicalGenerationRequest['references'];
  outputCount?: number;
};

export type PreparedGeneration = {
  quoteId: string;
  expiresAt: string;
  requestHash: string;
  summary: CanonicalGenerationRequest;
  price: CustomerDisplayPrice;
  balance: { beforeCents: number; afterCents: number };
  fundingMode: GenerationFundingMode;
  confirmationRequired: true;
  topupRequired: boolean;
};

type AccountRestriction = Awaited<ReturnType<typeof getActiveAccountRestriction>>;
type SpendingCheckDependencies = { executor: TransactionQueryExecutor; now?: () => Date };
type QuoteInsertDependencies = {
  executor: QueryExecutor;
  now?: () => Date;
  randomUUID?: () => string;
};

export type PrepareGenerationDependencies = {
  paidGenerationEnabled(): boolean;
  getAccountRestriction(userId: string): Promise<AccountRestriction>;
  listPublicEngines(): Promise<AgentPublicGenerationEngine[]>;
  resolveMembershipPricing(userId: string): Promise<MembershipPricingContext>;
  priceGeneration(
    request: CanonicalGenerationRequest,
    membershipTier: MembershipPricingContext['tier'],
    referenceContext: GenerationPricingReferenceContext,
  ): Promise<GenerationPricingResult>;
  getWalletSummary(userId: string): Promise<WalletSummary>;
  withTransaction<TResult>(
    callback: (executor: TransactionQueryExecutor) => Promise<TResult>,
  ): Promise<TResult>;
  checkSpendingLimits(
    input: { userId: string; priceCents: number; currency: string },
    dependencies: SpendingCheckDependencies,
  ): Promise<McpSpendingDecision>;
  insertPreparedQuote(
    input: InsertPreparedQuoteInput,
    dependencies: QuoteInsertDependencies,
  ): Promise<McpGenerationQuote>;
  getTrialEligibility(principal: AgentPrincipal): Promise<TrialStatus>;
  checkTrialRisk(input: TrialRiskInput): Promise<TrialRiskDecision>;
  recordTrialQuotePreparedAudit(
    input: TrialQuotePreparedAuditInput,
    dependencies: { executor: QueryExecutor },
  ): Promise<boolean>;
  resolveGenerationReferences?(
    request: CanonicalGenerationRequest,
    principal: GenerationActor,
  ): Promise<ResolvedReference[]>;
  resolveRequestExecutability?(
    request: CanonicalGenerationRequest,
    candidate: AgentPublicGenerationEngine,
    resolvedReferences: readonly ResolvedReference[],
  ): AgentGenerationExecutabilityDecision;
  trialRiskContext: TrialRiskRequestContext;
  accountUrl: string;
  now(): Date;
};

export type TrialRiskRequestContext = Readonly<{
  clientIp: string | null;
  userAgent: string | null;
}>;

const TRIAL_RISK_CONTEXT_KEYS = new Set(['clientIp', 'userAgent']);

const defaultDependencies: Omit<PrepareGenerationDependencies, 'trialRiskContext'> = {
  paidGenerationEnabled: () => false,
  getAccountRestriction: getActiveAccountRestriction,
  listPublicEngines: () => listPublicAgentGenerationEngines(),
  resolveMembershipPricing: async (userId) => (await getUserMembershipStatus(userId)).pricing,
  priceGeneration: (request, membershipTier, referenceContext) =>
    priceCanonicalGeneration(request, membershipTier, undefined, referenceContext),
  getWalletSummary,
  withTransaction: (callback) => withDbTransaction((executor) => callback(executor)),
  checkSpendingLimits: checkMcpSpendingLimits,
  insertPreparedQuote,
  getTrialEligibility: (principal) => getTrialEligibility(principal),
  checkTrialRisk: (input) => checkTrialRisk(input),
  recordTrialQuotePreparedAudit,
  resolveGenerationReferences: (request, principal) => resolveGenerationReferencesForActor(request, principal),
  resolveRequestExecutability: (request, candidate, resolvedReferences) =>
    resolveAgentGenerationRequestExecutability(
      request,
      candidate.engine,
      resolvedReferences,
    ),
  accountUrl: 'https://maxvideoai.com/account/connections',
  now: () => new Date(),
};


function requireTrialRiskRequestContext(value: unknown): TrialRiskRequestContext {
  if (!value
    || typeof value !== 'object'
    || Array.isArray(value)
    || Object.getPrototypeOf(value) !== Object.prototype) {
    throw new Error('Invalid trial risk request context.');
  }
  const context = Object.create(null) as Record<string, unknown>;
  const ownKeys = Reflect.ownKeys(value);
  if (ownKeys.length !== TRIAL_RISK_CONTEXT_KEYS.size) {
    throw new Error('Invalid trial risk request context.');
  }
  for (const key of ownKeys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (typeof key !== 'string'
      || !TRIAL_RISK_CONTEXT_KEYS.has(key)
      || !descriptor?.enumerable
      || !Object.hasOwn(descriptor, 'value')) {
      throw new Error('Invalid trial risk request context.');
    }
    context[key] = descriptor.value;
  }
  const clientIp = context.clientIp;
  const userAgent = context.userAgent;
  if (!(clientIp === null
      || (typeof clientIp === 'string' && clientIp.length <= 64))
    || !(userAgent === null
      || (typeof userAgent === 'string'
        && userAgent.length <= 2_048
        && !/[\u0000\r\n]/u.test(userAgent)))) {
    throw new Error('Invalid trial risk request context.');
  }
  return Object.freeze({
    clientIp,
    userAgent,
  }) as TrialRiskRequestContext;
}


function invalidParameter(): never {
  throw new AgentApiError(
    'PARAMETER_INVALID',
    'One or more generation settings are invalid for the selected model.',
  );
}

function requireWallet(wallet: WalletSummary, currency: string): number {
  if (
    !Number.isSafeInteger(wallet.balanceCents)
    || wallet.balanceCents < 0
    || typeof wallet.currency !== 'string'
    || wallet.currency !== currency
  ) {
    throw new AgentApiError('INTERNAL_ERROR', 'The wallet balance is unavailable.');
  }
  return wallet.balanceCents;
}

function trialCandidateFromOriginal(input: PrepareGenerationInput): CanonicalGenerationRequest | null {
  try {
    return normalizeTrialCandidate(input);
  } catch (error) {
    if (error instanceof TrialCandidateError) return null;
    throw error;
  }
}

function requirePaidGeneration(dependencies: PrepareGenerationDependencies): void {
  if (!dependencies.paidGenerationEnabled()) {
    throw new AgentApiError('ENGINE_UNAVAILABLE', 'Paid generation is not available.');
  }
}

function includedTrialPricingSnapshot(
  pricingSnapshot: Record<string, unknown>,
  normalPriceCents: number,
  providerCostCents: number,
): Record<string, unknown> {
  const funding: IncludedTrialFundingSnapshot = {
    kind: 'included_trial',
    customerChargeCents: 0,
    normalPriceCents,
    providerCostCents,
  };
  return { ...pricingSnapshot, funding };
}

function spendingLimitError(dependencies: PrepareGenerationDependencies): AgentApiError {
  let approvalUrl: string;
  try {
    approvalUrl = new URL(MCP_SPENDING_APPROVAL_PATH, dependencies.accountUrl).toString();
  } catch {
    throw new AgentApiError('INTERNAL_ERROR', 'The spending approval handoff is unavailable.');
  }
  return new AgentApiError(
    'SPENDING_LIMIT_EXCEEDED',
    'This generation is above the spending controls configured in MaxVideoAI.',
    false,
    { type: 'open_url', url: approvalUrl },
  );
}

export async function prepareGenerationForActor(
  input: PrepareGenerationInput,
  principal: GenerationActor,
  dependencies: PrepareGenerationDependencies,
): Promise<PreparedGeneration> {
  requireGenerationActor(principal);
  if (principal.authMethod === 'studio-session') {
    let pilotRequest: CanonicalGenerationRequest;
    try { pilotRequest = normalizeGenerationRequest(input); } catch { invalidParameter(); }
    requireStudioGenerationRequest(pilotRequest);
  }
  const originalTrialCandidate = principal.authMethod === 'oauth' ? trialCandidateFromOriginal(input) : null;
  if (!originalTrialCandidate) requirePaidGeneration(dependencies);
  if (await dependencies.getAccountRestriction(principal.userId)) {
    throw new AgentApiError(
      'ACCOUNT_RESTRICTED',
      'This account is temporarily restricted. Open MaxVideoAI for help.',
    );
  }

  let request = originalTrialCandidate;
  if (!request) {
    try {
      request = normalizeGenerationRequest(input);
    } catch {
      throw new AgentApiError('PARAMETER_INVALID', 'The generation request is invalid.');
    }
  }

  let prospectiveTrial = false;
  if (originalTrialCandidate && principal.authMethod === 'oauth' && principal.clientId !== null) {
    try {
      prospectiveTrial = (await dependencies.getTrialEligibility(principal)).status === 'available';
    } catch {
      prospectiveTrial = false;
    }
  }
  if (originalTrialCandidate && !prospectiveTrial) requirePaidGeneration(dependencies);

  const {pricing, pricingSnapshot: verifiedPricingSnapshot, resolvedReferences, catalogRevision} = await readGenerationPricing(request, principal, dependencies);
  const pricingSnapshot = bindStudioReferenceSnapshot(verifiedPricingSnapshot, principal, resolvedReferences);
  const requestHash = hashCanonicalGenerationRequest(request);
  const clock = dependencies.now;

  let fundingMode: GenerationFundingMode = 'wallet';
  let persistedPricingSnapshot = pricingSnapshot;
  if (prospectiveTrial) {
    if (pricing.priceCents <= 0) {
      throw new AgentApiError('INTERNAL_ERROR', 'The current generation price is unavailable.');
    }
    let providerCostCents: number;
    try {
      providerCostCents = requireTrialProviderCostCents(request);
    } catch {
      throw new AgentApiError('INTERNAL_ERROR', 'The included trial cost is unavailable.');
    }
    let risk: TrialRiskDecision;
    try {
      risk = await dependencies.checkTrialRisk({
        userId: principal.userId,
        oauthClientId: principal.clientId!,
        clientIp: dependencies.trialRiskContext.clientIp,
        userAgent: dependencies.trialRiskContext.userAgent,
        providerCostCents,
      });
    } catch {
      risk = {
        allowed: false,
        code: 'TRIAL_NOT_ELIGIBLE',
        nextAction: { type: 'use_paid_generation' },
      };
    }
    if (!risk.allowed && risk.code === 'RATE_LIMITED') {
      throw new AgentApiError(
        'RATE_LIMITED',
        'Trial quote preparation is temporarily limited. Try again later.',
        true,
        { type: 'retry_later' },
      );
    }
    if (risk.allowed) {
      fundingMode = 'trial';
      persistedPricingSnapshot = includedTrialPricingSnapshot(
        pricingSnapshot,
        pricing.priceCents,
        providerCostCents,
      );
    } else {
      requirePaidGeneration(dependencies);
    }
  }

  const wallet = await dependencies.getWalletSummary(principal.userId);
  const balanceBefore = requireWallet(wallet, pricing.currency);

  const quote = await dependencies.withTransaction(async (executor) => {
    if (fundingMode === 'wallet') {
      const spending = await dependencies.checkSpendingLimits(
        { userId: principal.userId, priceCents: pricing.priceCents, currency: pricing.currency },
        { executor, now: clock },
      );
      if (!spending.allowed) throw spendingLimitError(dependencies);
    }
    const inserted = await dependencies.insertPreparedQuote(
      {
        userId: principal.userId,
        oauthClientId: principal.clientId,
        request,
        requestHash,
        catalogRevision,
        pricingSnapshot: persistedPricingSnapshot,
        priceCents: fundingMode === 'trial' ? 0 : pricing.priceCents,
        currency: pricing.currency,
        fundingMode,
      },
      { executor, now: clock },
    );
    if (!quoteMatchesActor(inserted, principal)) {
      throw new AgentApiError('INTERNAL_ERROR', 'The generation quote scope is inconsistent.');
    }
    if (fundingMode === 'trial') {
      const aspectRatio = request.settings.aspectRatio;
      const audio = request.settings.audio;
      if (typeof aspectRatio !== 'string'
        || !['16:9', '9:16', '1:1'].includes(aspectRatio)
        || typeof audio !== 'boolean'
        || principal.clientId === null
        || !await dependencies.recordTrialQuotePreparedAudit({
          quoteId: inserted.quoteId,
          engineId: 'seedance-2-0-mini',
          aspectRatio: aspectRatio as TrialQuotePreparedAuditInput['aspectRatio'],
          audio,
          oauthClientId: principal.clientId,
          outcome: 'success',
        }, { executor })) {
        throw new AgentApiError('INTERNAL_ERROR', 'The trial quote could not be prepared.');
      }
    }
    return inserted;
  });

  const customerChargeCents = fundingMode === 'trial' ? 0 : pricing.priceCents;
  const topupRequired = fundingMode === 'wallet' && balanceBefore < pricing.priceCents;
  return {
    quoteId: quote.quoteId,
    expiresAt: quote.expiresAt.toISOString(),
    requestHash,
    summary: request,
    price: customerDisplayPrice(customerChargeCents,pricing.currency),
    balance: {
      beforeCents: balanceBefore,
      afterCents: Math.max(0, balanceBefore - customerChargeCents),
    },
    fundingMode,
    confirmationRequired: true,
    topupRequired,
  };
}

export function createPrepareGenerationForActorService(
  accountUrl: string,
  trialRiskContext: TrialRiskRequestContext,
  dependencies: Partial<Omit<PrepareGenerationDependencies, 'trialRiskContext'>> = {},
): (input: PrepareGenerationInput, principal: GenerationActor) => Promise<PreparedGeneration> {
  const requestContext = requireTrialRiskRequestContext(trialRiskContext);
  const resolved: PrepareGenerationDependencies = {
    ...defaultDependencies,
    ...dependencies,
    trialRiskContext: requestContext,
    accountUrl,
  };
  return (input, principal) => prepareGenerationForActor(input, principal, resolved);
}

export async function prepareGeneration(input: PrepareGenerationInput, principal: AgentPrincipal, dependencies: PrepareGenerationDependencies): Promise<PreparedGeneration> {
  requireOAuthGenerationActor(principal);
  return prepareGenerationForActor(input, principal, dependencies);
}

export function createPrepareGenerationService(accountUrl: string, trialRiskContext: TrialRiskRequestContext, dependencies: Partial<Omit<PrepareGenerationDependencies, "trialRiskContext">> = {}): (input: PrepareGenerationInput, principal: AgentPrincipal) => Promise<PreparedGeneration> {
  const service = createPrepareGenerationForActorService(accountUrl, trialRiskContext, dependencies);
  return async (input, principal) => { requireOAuthGenerationActor(principal); return service(input, principal); };
}
