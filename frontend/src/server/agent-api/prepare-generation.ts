import mcpPublication from '@/config/mcp-publication.json';
import { withDbTransaction, type QueryExecutor, type TransactionQueryExecutor } from '@/lib/db';
import { getActiveAccountRestriction } from '@/server/fraud-cleanup';
import { getWalletSummary, type WalletSummary } from '@/server/wallet-summary';

import { computeGenerationCatalogRevision } from './catalog-revision';
import { AgentApiError } from './errors';
import {
  hashCanonicalGenerationRequest,
  normalizeGenerationRequest,
} from './generation-normalization';
import {
  priceCanonicalGeneration,
  type GenerationPricingResult,
} from './generation-pricing';
import type {
  CanonicalGenerationReference,
  CanonicalGenerationRequest,
} from './generation-types';
import { listAgentModels } from './model-catalog';
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
import type { AgentModel } from './types';

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
  listPublicModels(): Promise<AgentModel[]>;
  priceGeneration(request: CanonicalGenerationRequest): Promise<GenerationPricingResult>;
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
  listPublicModels: () => listAgentModels(),
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

function requireStringSetting(
  request: CanonicalGenerationRequest,
  key: string,
): string {
  const value = request.settings[key];
  if (typeof value !== 'string' || value.length === 0) invalidParameter();
  return value;
}

function validateCommonSettings(request: CanonicalGenerationRequest): void {
  const integerKeys = ['seed', 'fps', 'numFrames'];
  for (const key of integerKeys) {
    const value = request.settings[key];
    if (value !== undefined && (!Number.isSafeInteger(value) || (value as number) < 0)) {
      invalidParameter();
    }
  }
  if (typeof request.settings.fps === 'number' && request.settings.fps < 1) invalidParameter();
}

function requireOptionalSettingsType(
  request: CanonicalGenerationRequest,
  keys: readonly string[],
  expectedType: 'boolean' | 'number' | 'string',
): void {
  for (const key of keys) {
    const value = request.settings[key];
    if (value !== undefined && typeof value !== expectedType) invalidParameter();
  }
}

function validateSurfaceRequest(request: CanonicalGenerationRequest, model: AgentModel): void {
  validateCommonSettings(request);
  const resolution = requireStringSetting(request, 'resolution');
  if (!model.resolutions.includes(resolution)) invalidParameter();

  const aspectRatio = request.settings.aspectRatio;
  if (
    aspectRatio !== undefined
    && (typeof aspectRatio !== 'string' || !model.aspectRatios.includes(aspectRatio))
  ) {
    invalidParameter();
  }

  if (request.surface === 'video') {
    requireOptionalSettingsType(
      request,
      ['audio', 'cameraFixed', 'loop', 'safetyChecker'],
      'boolean',
    );
    requireOptionalSettingsType(request, ['cfgScale'], 'number');
    requireOptionalSettingsType(request, ['negativePrompt', 'shotType'], 'string');
    const duration = request.settings.durationSec;
    if (
      !Number.isSafeInteger(duration)
      || (duration as number) < 1
      || model.maxDurationSec === null
      || (duration as number) > model.maxDurationSec
      || typeof aspectRatio !== 'string'
    ) {
      invalidParameter();
    }
    const audio = request.settings.audio;
    if (audio === true && !model.audio) invalidParameter();
    const cfgScale = request.settings.cfgScale;
    if (cfgScale !== undefined && (typeof cfgScale !== 'number' || cfgScale < 0 || cfgScale > 100)) {
      invalidParameter();
    }
  } else {
    requireOptionalSettingsType(
      request,
      ['enableWebSearch', 'limitGenerations', 'watermark'],
      'boolean',
    );
    for (const key of ['quality', 'style', 'thinkingLevel', 'outputFormat']) {
      const value = request.settings[key];
      if (value !== undefined && (typeof value !== 'string' || value.length === 0)) {
        invalidParameter();
      }
    }
    const quality = request.settings.quality;
    if (quality !== undefined && !['low', 'medium', 'high'].includes(quality as string)) {
      invalidParameter();
    }
    const outputFormat = request.settings.outputFormat;
    if (outputFormat !== undefined && !['jpeg', 'png', 'webp'].includes(outputFormat as string)) {
      invalidParameter();
    }
    const thinkingLevel = request.settings.thinkingLevel;
    if (thinkingLevel !== undefined && !['minimal', 'high'].includes(thinkingLevel as string)) {
      invalidParameter();
    }
    // The transport-neutral image estimator intentionally excludes web-only addons,
    // and the canonical P6 contract has no custom/reference dimension fields. Reject
    // those cases instead of persisting a quote that could be lower than execution.
    if (
      request.settings.enableWebSearch === true
      || resolution === 'custom'
      || (
        request.engineId === 'gpt-image-2'
        && request.mode === 'i2i'
        && resolution === 'auto'
      )
    ) {
      invalidParameter();
    }
  }
}

function referencesWithRole(
  references: readonly CanonicalGenerationReference[],
  role: CanonicalGenerationReference['role'],
): number {
  return references.filter((reference) => reference.role === role).length;
}

function validateReferences(request: CanonicalGenerationRequest, model: AgentModel): void {
  if (request.mode === 't2v' || request.mode === 't2i') {
    if (request.references.length > 0) {
      throw new AgentApiError('REFERENCE_INVALID', 'This generation mode does not accept references.');
    }
    return;
  }
  if (!model.referenceImages) {
    throw new AgentApiError('REFERENCE_INVALID', 'The selected model does not accept image references.');
  }
  const requiredRole = request.mode === 'ref2v' ? 'reference' : 'source';
  if (referencesWithRole(request.references, requiredRole) < 1) {
    throw new AgentApiError('REFERENCE_REQUIRED', 'This generation mode requires an image reference.');
  }
}

function safePricingSnapshot(
  pricing: GenerationPricingResult,
  request: CanonicalGenerationRequest,
  catalogRevision: string,
): Record<string, unknown> {
  if (
    !Number.isSafeInteger(pricing.priceCents)
    || pricing.priceCents < 0
    || typeof pricing.currency !== 'string'
    || !/^[A-Z]{3}$/u.test(pricing.currency)
    || !pricing.pricingSnapshot
    || typeof pricing.pricingSnapshot !== 'object'
    || Array.isArray(pricing.pricingSnapshot)
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
  ) {
    throw new AgentApiError('INTERNAL_ERROR', 'The current generation price is unavailable.');
  }
  return {
    schemaVersion: 1,
    catalogRevision,
    surface: request.surface,
    engineId: request.engineId,
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

  const publicModels = await dependencies.listPublicModels();
  const model = publicModels.find((candidate) => candidate.id === request.engineId);
  if (!model || model.surface !== request.surface) {
    throw new AgentApiError('ENGINE_UNAVAILABLE', 'The selected model is not publicly available.');
  }
  if (!model.modes.includes(request.mode)) {
    throw new AgentApiError('MODE_UNSUPPORTED', 'The selected model does not support this mode.');
  }
  validateSurfaceRequest(request, model);
  validateReferences(request, model);

  const catalogRevision = computeGenerationCatalogRevision(publicModels);
  let pricing: GenerationPricingResult;
  try {
    pricing = await dependencies.priceGeneration(request);
  } catch {
    throw new AgentApiError(
      'PARAMETER_INVALID',
      'The selected settings cannot be priced for this model.',
    );
  }
  const pricingSnapshot = safePricingSnapshot(pricing, request, catalogRevision);
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
