import mcpPublication from '@/config/mcp-publication.json';
import { withDbTransaction, type QueryExecutor, type TransactionQueryExecutor } from '@/lib/db';
import { getActiveAccountRestriction } from '@/server/fraud-cleanup';
import {
  getUserMembershipStatus,
  type MembershipPricingContext,
} from '@/server/membership/user-membership-status';
import { getWalletSummary, type WalletSummary } from '@/server/wallet-summary';

import { computeGenerationCatalogRevision } from './catalog-revision';
import { AgentApiError } from './errors';
import {
  GenerationCapabilityError,
  validateCanonicalGenerationCapabilities,
} from './generation-capability-validation';
import {
  hashCanonicalGenerationRequest,
  normalizeGenerationRequest,
} from './generation-normalization';
import {
  priceCanonicalGeneration,
  type GenerationPricingResult,
} from './generation-pricing';
import type { CanonicalGenerationRequest } from './generation-types';
import {
  listPublicAgentGenerationEngines,
  type AgentPublicGenerationEngine,
} from './model-catalog';
import type { AgentPrincipal } from './principal';
import {
  insertPreparedQuote,
  type InsertPreparedQuoteInput,
  type McpGenerationQuote,
} from './quote-repository';
import {
  checkMcpSpendingLimits,
  MCP_SPENDING_APPROVAL_PATH,
  type McpSpendingDecision,
} from './spending-limits';

export type PrepareGenerationInput = Omit<
  CanonicalGenerationRequest,
  'schemaVersion' | 'settings' | 'references' | 'outputCount'
> & {
  schemaVersion?: 1;
  settings?: CanonicalGenerationRequest['settings'];
  references?: CanonicalGenerationRequest['references'];
  outputCount?: 1;
};

export type PreparedGeneration = {
  quoteId: string;
  expiresAt: string;
  requestHash: string;
  summary: CanonicalGenerationRequest;
  price: { amountCents: number; currency: string };
  balance: { beforeCents: number; afterCents: number };
  fundingMode: 'wallet';
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
  accountUrl: string;
  now(): Date;
};

const defaultDependencies: PrepareGenerationDependencies = {
  paidGenerationEnabled: () => mcpPublication.paidGeneration,
  getAccountRestriction: getActiveAccountRestriction,
  listPublicEngines: () => listPublicAgentGenerationEngines(),
  resolveMembershipPricing: async (userId) => (await getUserMembershipStatus(userId)).pricing,
  priceGeneration: priceCanonicalGeneration,
  getWalletSummary,
  withTransaction: (callback) => withDbTransaction((executor) => callback(executor)),
  checkSpendingLimits: checkMcpSpendingLimits,
  insertPreparedQuote,
  accountUrl: 'https://maxvideoai.com/account/connections',
  now: () => new Date(),
};

function isSafeIdentifier(value: unknown, maxLength: number): value is string {
  return typeof value === 'string'
    && value.length > 0
    && value.length <= maxLength
    && value === value.trim();
}

function requirePrincipal(principal: AgentPrincipal): void {
  if (
    !principal
    || principal.authMethod !== 'oauth'
    || !isSafeIdentifier(principal.userId, 128)
    || (principal.clientId !== null && !isSafeIdentifier(principal.clientId, 256))
  ) {
    throw new AgentApiError('AUTH_REQUIRED', 'Connect MaxVideoAI before preparing a generation.');
  }
}

function invalidParameter(): never {
  throw new AgentApiError(
    'PARAMETER_INVALID',
    'One or more generation settings are invalid for the selected model.',
  );
}

function validateRepresentablePricingFacts(request: CanonicalGenerationRequest): void {
  const resolution = request.settings.resolution;
  if (
    request.surface === 'image'
    && (
      request.settings.enableWebSearch === true
      || resolution === 'custom'
      || (request.engineId === 'gpt-image-2' && request.mode === 'i2i' && resolution === 'auto')
    )
  ) {
    invalidParameter();
  }
}

function requireMembershipPricing(value: MembershipPricingContext): MembershipPricingContext {
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
  ) {
    throw new AgentApiError('INTERNAL_ERROR', 'The account membership price is unavailable.');
  }
  return value;
}

export function buildGenerationPricingSnapshot(
  pricing: GenerationPricingResult,
  request: CanonicalGenerationRequest,
  catalogRevision: string,
  membership: MembershipPricingContext,
): Record<string, unknown> {
  if (
    !Number.isSafeInteger(pricing.priceCents)
    || pricing.priceCents < 0
    || typeof pricing.currency !== 'string'
    || !/^[A-Z]{3}$/u.test(pricing.currency)
    || !pricing.pricingSnapshot
    || typeof pricing.pricingSnapshot !== 'object'
    || Array.isArray(pricing.pricingSnapshot)
    || pricing.membershipTier !== membership.tier
  ) {
    throw new AgentApiError('INTERNAL_ERROR', 'The current generation price is unavailable.');
  }
  let canonicalPricing: unknown;
  try {
    canonicalPricing = JSON.parse(JSON.stringify(pricing.pricingSnapshot));
  } catch {
    throw new AgentApiError('INTERNAL_ERROR', 'The current generation price is unavailable.');
  }
  if (!canonicalPricing || typeof canonicalPricing !== 'object' || Array.isArray(canonicalPricing)) {
    throw new AgentApiError('INTERNAL_ERROR', 'The current generation price is unavailable.');
  }
  const canonicalRecord = canonicalPricing as Record<string, unknown>;
  if (
    canonicalRecord.totalCents !== pricing.priceCents
    || canonicalRecord.currency !== pricing.currency
    || canonicalRecord.membershipTier !== membership.tier
  ) {
    throw new AgentApiError('INTERNAL_ERROR', 'The current generation price is unavailable.');
  }
  return {
    schemaVersion: 1,
    catalogRevision,
    surface: request.surface,
    engineId: request.engineId,
    membership,
    canonicalPricing: canonicalRecord,
  };
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

export async function prepareGeneration(
  input: PrepareGenerationInput,
  principal: AgentPrincipal,
  dependencies: PrepareGenerationDependencies = defaultDependencies,
): Promise<PreparedGeneration> {
  requirePrincipal(principal);
  if (!dependencies.paidGenerationEnabled()) {
    throw new AgentApiError('ENGINE_UNAVAILABLE', 'Paid generation is not available.');
  }
  if (await dependencies.getAccountRestriction(principal.userId)) {
    throw new AgentApiError(
      'ACCOUNT_RESTRICTED',
      'This account is temporarily restricted. Open MaxVideoAI for help.',
    );
  }

  let request: CanonicalGenerationRequest;
  try {
    request = normalizeGenerationRequest(input);
  } catch {
    throw new AgentApiError('PARAMETER_INVALID', 'The generation request is invalid.');
  }

  const publicEngines = await dependencies.listPublicEngines();
  const candidate = publicEngines.find((entry) => entry.engine.id === request.engineId);
  if (!candidate || candidate.surface !== request.surface) {
    throw new AgentApiError('ENGINE_UNAVAILABLE', 'The selected model is not publicly available.');
  }
  if (!candidate.publicModes.includes(request.mode)) {
    throw new AgentApiError('MODE_UNSUPPORTED', 'The selected model does not support this mode.');
  }
  try {
    validateCanonicalGenerationCapabilities(request, candidate);
  } catch (error) {
    if (error instanceof GenerationCapabilityError) {
      if (error.kind === 'reference_required') {
        throw new AgentApiError('REFERENCE_REQUIRED', 'This generation mode requires an image reference.');
      }
      if (error.kind === 'reference_invalid') {
        throw new AgentApiError('REFERENCE_INVALID', 'The image references are invalid for this model mode.');
      }
      invalidParameter();
    }
    throw error;
  }
  validateRepresentablePricingFacts(request);

  const catalogRevision = computeGenerationCatalogRevision(publicEngines);
  let membership: MembershipPricingContext;
  try {
    membership = requireMembershipPricing(
      await dependencies.resolveMembershipPricing(principal.userId),
    );
  } catch (error) {
    if (error instanceof AgentApiError) throw error;
    throw new AgentApiError('INTERNAL_ERROR', 'The account membership price is unavailable.');
  }
  let pricing: GenerationPricingResult;
  try {
    pricing = await dependencies.priceGeneration(request, membership.tier);
  } catch {
    throw new AgentApiError(
      'PARAMETER_INVALID',
      'The selected settings cannot be priced for this model.',
    );
  }
  const pricingSnapshot = buildGenerationPricingSnapshot(pricing, request, catalogRevision, membership);
  const wallet = await dependencies.getWalletSummary(principal.userId);
  const balanceBefore = requireWallet(wallet, pricing.currency);
  const requestHash = hashCanonicalGenerationRequest(request);
  const clock = dependencies.now;

  const quote = await dependencies.withTransaction(async (executor) => {
    const spending = await dependencies.checkSpendingLimits(
      { userId: principal.userId, priceCents: pricing.priceCents, currency: pricing.currency },
      { executor, now: clock },
    );
    if (!spending.allowed) throw spendingLimitError(dependencies);
    return dependencies.insertPreparedQuote(
      {
        userId: principal.userId,
        oauthClientId: principal.clientId,
        request,
        requestHash,
        catalogRevision,
        pricingSnapshot,
        priceCents: pricing.priceCents,
        currency: pricing.currency,
      },
      { executor, now: clock },
    );
  });

  const topupRequired = balanceBefore < pricing.priceCents;
  return {
    quoteId: quote.quoteId,
    expiresAt: quote.expiresAt.toISOString(),
    requestHash,
    summary: request,
    price: { amountCents: pricing.priceCents, currency: pricing.currency },
    balance: {
      beforeCents: balanceBefore,
      afterCents: Math.max(0, balanceBefore - pricing.priceCents),
    },
    fundingMode: 'wallet',
    confirmationRequired: true,
    topupRequired,
  };
}

export function createPrepareGenerationService(
  accountUrl: string,
  dependencies: Partial<PrepareGenerationDependencies> = {},
): (input: PrepareGenerationInput, principal: AgentPrincipal) => Promise<PreparedGeneration> {
  const resolved: PrepareGenerationDependencies = {
    ...defaultDependencies,
    ...dependencies,
    accountUrl,
  };
  return (input, principal) => prepareGeneration(input, principal, resolved);
}
