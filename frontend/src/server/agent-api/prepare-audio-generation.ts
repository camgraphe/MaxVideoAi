import { withDbTransaction, type QueryExecutor, type TransactionQueryExecutor } from '@/lib/db';
import { getActiveAccountRestriction } from '@/server/fraud-cleanup';
import { getWalletSummary, type WalletSummary } from '@/server/wallet-summary';
import { prepareAudioRun } from '@/server/audio/prepare-audio';
import type { PreparedAudioRun } from '@/server/audio/audio-run-reservation';

import { isAudioRunCapabilityAvailable, listAudioCapabilities } from './audio-capabilities';
import {
  hashCanonicalAudioRequest,
  normalizeAudioGenerationRequest,
  audioRequestToGenerationBody,
  type CanonicalAudioRequest,
} from './audio-normalization';
import { audioQuoteRepository } from './audio-quote-repository';
import {
  buildAudioQuotePricingSnapshot,
  type ResolvedAudioReference,
} from './audio-quote-snapshot';
import { resolveOwnedAudioReference } from './audio-reference-assets';
import { AgentApiError } from './errors';
import type { AgentPrincipal } from './principal';
import {
  checkMcpSpendingLimits,
  MCP_SPENDING_APPROVAL_PATH,
  type McpSpendingDecision,
} from './spending-limits';
import type { InsertPreparedQuoteInput, McpGenerationQuote } from './quote-repository';

export type PrepareAudioGenerationInput = Omit<CanonicalAudioRequest, 'schemaVersion' | 'settings' | 'references' | 'outputCount'> & {
  schemaVersion?: 1;
  settings?: CanonicalAudioRequest['settings'];
  references?: CanonicalAudioRequest['references'];
  outputCount?: 1;
};

export type PreparedAudioGeneration = {
  quoteId: string;
  expiresAt: string;
  requestHash: string;
  summary: CanonicalAudioRequest;
  price: { amountCents: number; currency: string };
  balance: { beforeCents: number; afterCents: number };
  fundingMode: 'wallet';
  confirmationRequired: true;
  topupRequired: boolean;
};

type AccountRestriction = Awaited<ReturnType<typeof getActiveAccountRestriction>>;
type AudioCapabilities = ReturnType<typeof listAudioCapabilities>;

export type PrepareAudioGenerationDependencies = {
  paidGenerationEnabled(): boolean;
  getAccountRestriction(userId: string): Promise<AccountRestriction>;
  listCapabilities(): AudioCapabilities;
  resolveReference(
    principal: AgentPrincipal,
    reference: CanonicalAudioRequest['references'][number],
  ): Promise<ResolvedAudioReference>;
  prepareRun(body: ReturnType<typeof audioRequestToGenerationBody>, userId: string): Promise<PreparedAudioRun>;
  getWalletSummary(userId: string): Promise<WalletSummary>;
  withTransaction<TResult>(callback: (executor: TransactionQueryExecutor) => Promise<TResult>): Promise<TResult>;
  checkSpendingLimits(
    input: { userId: string; priceCents: number; currency: string },
    dependencies: { executor: TransactionQueryExecutor },
  ): Promise<McpSpendingDecision>;
  insertPreparedQuote(
    input: InsertPreparedQuoteInput<CanonicalAudioRequest>,
    dependencies: { executor: QueryExecutor; now?: () => Date },
  ): Promise<McpGenerationQuote<CanonicalAudioRequest>>;
  accountUrl: string;
  now(): Date;
};

function requirePrincipal(principal: AgentPrincipal): void {
  if (!principal
    || principal.authMethod !== 'oauth'
    || typeof principal.userId !== 'string'
    || !principal.userId.trim()
    || principal.userId !== principal.userId.trim()
    || principal.userId.length > 128
    || typeof principal.clientId !== 'string'
    || !principal.clientId.trim()
    || principal.clientId !== principal.clientId.trim()
    || principal.clientId.length > 256) {
    throw new AgentApiError('AUTH_REQUIRED', 'Connect MaxVideoAI before preparing Audio.');
  }
}

function spendingError(dependencies: PrepareAudioGenerationDependencies): AgentApiError {
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

function mapPreparationError(error: unknown): never {
  if (error instanceof AgentApiError) throw error;
  const status = error && typeof error === 'object' && 'status' in error
    ? Number((error as { status?: unknown }).status)
    : 0;
  if (status === 503) {
    throw new AgentApiError('ENGINE_UNAVAILABLE', 'The selected Audio mode is unavailable.');
  }
  throw new AgentApiError('PARAMETER_INVALID', 'The Audio generation request is invalid.');
}

const defaultDependencies: PrepareAudioGenerationDependencies = {
  paidGenerationEnabled: () => false,
  getAccountRestriction: getActiveAccountRestriction,
  listCapabilities: () => listAudioCapabilities(),
  resolveReference: (principal, reference) => resolveOwnedAudioReference(principal, reference),
  prepareRun: (body, userId) => prepareAudioRun(body, userId),
  getWalletSummary,
  withTransaction: callback => withDbTransaction(executor => callback(executor)),
  checkSpendingLimits: checkMcpSpendingLimits,
  insertPreparedQuote: audioQuoteRepository.insertPreparedQuote,
  accountUrl: 'https://maxvideoai.com',
  now: () => new Date(),
};

export async function prepareAudioGeneration(
  input: PrepareAudioGenerationInput,
  principal: AgentPrincipal,
  dependencies: PrepareAudioGenerationDependencies = defaultDependencies,
): Promise<PreparedAudioGeneration> {
  requirePrincipal(principal);
  if (!dependencies.paidGenerationEnabled()) {
    throw new AgentApiError('ENGINE_UNAVAILABLE', 'Paid Audio generation is not available.');
  }
  if (await dependencies.getAccountRestriction(principal.userId)) {
    throw new AgentApiError('ACCOUNT_RESTRICTED', 'This account is temporarily restricted. Open MaxVideoAI for help.');
  }

  let request: CanonicalAudioRequest;
  try {
    request = normalizeAudioGenerationRequest({
      schemaVersion: 1,
      settings: {},
      references: [],
      outputCount: 1,
      ...input,
    });
  } catch (error) {
    mapPreparationError(error);
  }

  const capabilities = dependencies.listCapabilities();
  const capability = capabilities.modes.find(mode => mode.mode === request.mode && mode.engineId === request.engineId);
  if (!capability?.available) {
    throw new AgentApiError('ENGINE_UNAVAILABLE', 'The selected Audio mode is unavailable.');
  }

  let references: ResolvedAudioReference[];
  try {
    references = await Promise.all(request.references.map(reference => dependencies.resolveReference(principal, reference)));
  } catch (error) {
    if (error instanceof AgentApiError) throw error;
    throw new AgentApiError('REFERENCE_INVALID', 'Reference media is not usable.');
  }
  const resolvedUrls = Object.fromEntries(references.map(reference => [
    reference.role === 'source_video' ? 'sourceVideoUrl' : 'voiceSampleUrl',
    reference.originalUrl,
  ]));

  let prepared: PreparedAudioRun;
  try {
    prepared = await dependencies.prepareRun(audioRequestToGenerationBody(request, resolvedUrls), principal.userId);
  } catch (error) {
    mapPreparationError(error);
  }
  if (!isAudioRunCapabilityAvailable(capabilities, prepared.normalized)) {
    throw new AgentApiError('ENGINE_UNAVAILABLE', 'The selected Audio configuration is unavailable.');
  }
  const requestHash = hashCanonicalAudioRequest(request);
  const pricingSnapshot = buildAudioQuotePricingSnapshot({ requestHash, references, prepared });
  const priceCents = prepared.pricingSnapshot.totalCents;
  const currency = prepared.pricingSnapshot.currency;
  if (!Number.isSafeInteger(priceCents) || priceCents <= 0 || typeof currency !== 'string' || !/^[A-Z]{3}$/u.test(currency)) {
    throw new AgentApiError('INTERNAL_ERROR', 'The current Audio price is unavailable.');
  }

  const wallet = await dependencies.getWalletSummary(principal.userId);
  if (wallet.currency.toUpperCase() !== currency) {
    throw new AgentApiError('PARAMETER_INVALID', 'The wallet currency does not match this Audio quote.');
  }
  const quote = await dependencies.withTransaction(async executor => {
    const spending = await dependencies.checkSpendingLimits(
      { userId: principal.userId, priceCents, currency },
      { executor },
    );
    if (!spending.allowed) throw spendingError(dependencies);
    return dependencies.insertPreparedQuote({
      userId: principal.userId,
      oauthClientId: principal.clientId,
      request,
      requestHash,
      catalogRevision: capabilities.revision,
      pricingSnapshot,
      priceCents,
      currency,
      fundingMode: 'wallet',
    }, { executor, now: dependencies.now });
  });

  return {
    quoteId: quote.quoteId,
    expiresAt: quote.expiresAt.toISOString(),
    requestHash,
    summary: request,
    price: { amountCents: priceCents, currency },
    balance: {
      beforeCents: wallet.balanceCents,
      afterCents: Math.max(0, wallet.balanceCents - priceCents),
    },
    fundingMode: 'wallet',
    confirmationRequired: true,
    topupRequired: wallet.balanceCents < priceCents,
  };
}

export function createPrepareAudioGenerationService(
  accountUrl: string,
  dependencies: Partial<PrepareAudioGenerationDependencies> = {},
) {
  const resolved: PrepareAudioGenerationDependencies = {
    ...defaultDependencies,
    ...dependencies,
    accountUrl,
  };
  return (input: PrepareAudioGenerationInput, principal: AgentPrincipal) =>
    prepareAudioGeneration(input, principal, resolved);
}
