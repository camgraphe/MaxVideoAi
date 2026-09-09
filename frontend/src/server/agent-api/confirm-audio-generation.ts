import { getAudioPackConfig } from '@/lib/audio-generation';
import { query, withDbTransaction, type QueryExecutor, type TransactionQueryExecutor } from '@/lib/db';
import { loadPricingPolicyOverridesWithExecutor } from '@/lib/pricing-rule-store';
import { getActiveAccountRestrictionInExecutor } from '@/server/fraud-cleanup';
import { createInitialAudioJobInExecutor } from '@/server/audio/audio-generate-jobs';
import { audioQuoteInputKey } from '@/server/audio/prepare-audio';
import { buildAudioRunReservation, type PreparedAudioRun, type ReservedAudioRun } from '@/server/audio/audio-run-reservation';
import { validateAudioGenerateRequest } from '@/server/audio/audio-generate-validation';
import { executeReservedAudioRun } from '@/server/audio/generate-audio';
import { computeCanonicalAudioBillingSnapshot } from '@/server/pricing/quote-billing';

import { isAudioRunCapabilityAvailable, listAudioCapabilities } from './audio-capabilities';
import { audioRequestToGenerationBody, hashCanonicalAudioRequest, type CanonicalAudioRequest } from './audio-normalization';
import { audioQuoteRepository } from './audio-quote-repository';
import {
  parseAudioQuoteExecutionEvidence,
  sameAudioReferenceEvidence,
  type AudioQuoteExecutionEvidence,
  type ResolvedAudioReference,
} from './audio-quote-snapshot';
import { resolveOwnedAudioReference } from './audio-reference-assets';
import { AgentApiError } from './errors';
import { stableJson } from './generation-normalization';
import type { AgentPrincipal } from './principal';
import type { LockedOwnedQuote, McpGenerationQuote, OwnedQuoteInput, OwnedQuoteJobInput } from './quote-repository';
import { checkMcpConfirmationSpendingLimits, MCP_SPENDING_APPROVAL_PATH, type McpSpendingDecision } from './spending-limits';

export type ConfirmAudioGenerationInput = { quoteId: string; confirmed: true };
export type AudioGenerationConfirmation = {
  jobId: string;
  surface: 'audio';
  status: 'accepted' | 'running' | 'completed' | 'failed';
  progress: number | null;
  message: string | null;
  priceCents: number | null;
  currency: string | null;
  paymentStatus: string | null;
  retryAfterSeconds: number | null;
};

type AudioQuote = McpGenerationQuote<CanonicalAudioRequest>;
type AccountRestriction = Awaited<ReturnType<typeof getActiveAccountRestrictionInExecutor>>;
type AudioCapabilities = ReturnType<typeof listAudioCapabilities>;
type Reservation = ReturnType<typeof buildAudioRunReservation>;

export type ConfirmAudioGenerationDependencies = {
  paidGenerationEnabled(): boolean;
  withTransaction<TResult>(callback: (executor: TransactionQueryExecutor) => Promise<TResult>): Promise<TResult>;
  lockOwnedQuote(input: OwnedQuoteInput, dependencies: { executor: TransactionQueryExecutor }): Promise<LockedOwnedQuote<CanonicalAudioRequest> | null>;
  markQuoteExpired(input: OwnedQuoteInput, dependencies: { executor: TransactionQueryExecutor; expiredAt: Date }): Promise<AudioQuote | null>;
  getAccountRestriction(userId: string, dependencies: { executor: TransactionQueryExecutor }): Promise<AccountRestriction>;
  listCapabilities(): AudioCapabilities;
  resolveReference(principal: AgentPrincipal, reference: CanonicalAudioRequest['references'][number], dependencies: { executor: QueryExecutor }): Promise<ResolvedAudioReference>;
  priceCurrentRun(request: CanonicalAudioRequest, evidence: AudioQuoteExecutionEvidence, references: ResolvedAudioReference[], dependencies: { executor: TransactionQueryExecutor; userId: string }): Promise<PreparedAudioRun>;
  checkSpendingLimits(input: { userId: string; priceCents: number; currency: string }, dependencies: { executor: TransactionQueryExecutor }): Promise<McpSpendingDecision>;
  buildReservation(prepared: PreparedAudioRun, userId: string): Reservation;
  reserveInitialJob(input: Reservation['initialJob'], dependencies: { executor: TransactionQueryExecutor }): Promise<void>;
  claimPreparedQuote(input: OwnedQuoteJobInput, dependencies: { executor: TransactionQueryExecutor; claimedAt: Date }): Promise<AudioQuote | null>;
  executeRun(input: ReservedAudioRun): Promise<unknown>;
  markQuoteAccepted(input: OwnedQuoteJobInput): Promise<AudioQuote | null>;
  markQuoteFailed(input: OwnedQuoteJobInput): Promise<AudioQuote | null>;
  readAudioStatus(input: { userId: string; jobId: string }): Promise<AudioGenerationConfirmation | null>;
  accountUrl: string;
};

const INPUT_KEYS = new Set(['quoteId', 'confirmed']);
const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function assertInput(value: unknown): asserts value is ConfirmAudioGenerationInput {
  const keys = isRecord(value) ? Reflect.ownKeys(value) : [];
  if (!isRecord(value)
    || keys.length !== INPUT_KEYS.size
    || !keys.every(key => typeof key === 'string' && INPUT_KEYS.has(key))
    || value.confirmed !== true
    || typeof value.quoteId !== 'string'
    || !UUID_V4_PATTERN.test(value.quoteId)
    || ![...INPUT_KEYS].every(key => {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      return Boolean(descriptor?.enumerable && 'value' in descriptor);
    })) {
    throw new AgentApiError('PARAMETER_INVALID', 'The Audio confirmation request is invalid.');
  }
}

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
    throw new AgentApiError('AUTH_REQUIRED', 'Connect MaxVideoAI before confirming Audio.');
  }
}

function staleQuote(): never {
  throw new AgentApiError('QUOTE_EXPIRED', 'This Audio quote is no longer current. Prepare Audio again before confirming.');
}

function spendingError(dependencies: ConfirmAudioGenerationDependencies): AgentApiError {
  let url: string;
  try {
    url = new URL(MCP_SPENDING_APPROVAL_PATH, dependencies.accountUrl).toString();
  } catch {
    throw new AgentApiError('INTERNAL_ERROR', 'The spending approval handoff is unavailable.');
  }
  return new AgentApiError('SPENDING_LIMIT_EXCEEDED', 'This generation is above the spending controls configured in MaxVideoAI.', false, { type: 'open_url', url });
}

function pricingWithoutEvidence(snapshot: Record<string, unknown>): Record<string, unknown> {
  const pricing = { ...snapshot };
  delete pricing.mcpAudio;
  return pricing;
}

function persistedJson(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value)) as unknown;
}

async function defaultPriceCurrentRun(
  request: CanonicalAudioRequest,
  evidence: AudioQuoteExecutionEvidence,
  references: ResolvedAudioReference[],
  { executor, userId }: { executor: TransactionQueryExecutor; userId: string },
): Promise<PreparedAudioRun> {
  const resolvedUrls = Object.fromEntries(references.map(reference => [
    reference.role === 'source_video' ? 'sourceVideoUrl' : 'voiceSampleUrl',
    reference.originalUrl,
  ]));
  const normalized = validateAudioGenerateRequest(audioRequestToGenerationBody(request, resolvedUrls));
  const pricingSnapshot = await computeCanonicalAudioBillingSnapshot({
    pack: normalized.pack,
    durationSec: evidence.durationSec,
    mood: normalized.mood,
    voiceMode: normalized.voiceMode,
    script: normalized.script,
    voiceModel: normalized.voiceModel,
    musicModel: normalized.musicModel,
    musicBpm: normalized.musicBpm,
    musicEnabled: normalized.musicEnabled,
  }, { pricingPolicy: { loadOverrides: () => loadPricingPolicyOverridesWithExecutor(executor, { lock: true }) } });
  const sourceVideoUrl = resolvedUrls.sourceVideoUrl ?? null;
  return {
    normalized,
    packConfig: getAudioPackConfig(normalized.pack),
    sourceJob: null,
    sourceVideoUrl,
    sourceProbe: evidence.sourceProbe,
    durationSec: evidence.durationSec,
    aspectRatio: evidence.aspectRatio,
    pricingSnapshot,
    inputKey: audioQuoteInputKey(userId, normalized, evidence.durationSec),
  };
}

type AudioStatusRow = {
  job_id: unknown; surface: unknown; status: unknown; progress: unknown;
  message: unknown; final_price_cents: unknown; currency: unknown; payment_status: unknown;
};

async function readAudioStatus(
  input: { userId: string; jobId: string },
  executor: QueryExecutor = { query },
): Promise<AudioGenerationConfirmation | null> {
  const rows = await executor.query<AudioStatusRow>(
    `SELECT job_id, surface, status, progress, message, final_price_cents, currency, payment_status
       FROM app_jobs
      WHERE job_id = $1 AND user_id = $2 AND surface = 'audio'
      LIMIT 1`,
    [input.jobId, input.userId],
  );
  const row = rows[0];
  if (!row || row.job_id !== input.jobId || row.surface !== 'audio') return null;
  const rawStatus = typeof row.status === 'string' ? row.status : '';
  const status: AudioGenerationConfirmation['status'] = rawStatus === 'completed' ? 'completed'
    : rawStatus === 'failed' ? 'failed'
      : rawStatus === 'running' ? 'running'
        : 'accepted';
  const progress = typeof row.progress === 'number' && Number.isFinite(row.progress)
    ? Math.max(0, Math.min(100, Math.round(row.progress)))
    : null;
  const paymentStatus = typeof row.payment_status === 'string' ? row.payment_status : null;
  const message = status === 'failed'
    ? paymentStatus === 'refunded_wallet'
      ? 'MaxVideoAI could not complete this Audio attempt. The wallet charge was refunded. Prepare a fresh quote before trying again.'
      : 'MaxVideoAI could not complete this Audio attempt. Wallet reconciliation may require review. Do not resubmit this quote.'
    : typeof row.message === 'string' ? row.message : null;
  return {
    jobId: input.jobId,
    surface: 'audio',
    status,
    progress: status === 'completed' ? 100 : progress,
    message,
    priceCents: Number.isSafeInteger(row.final_price_cents) ? Number(row.final_price_cents) : null,
    currency: typeof row.currency === 'string' && /^[A-Z]{3}$/u.test(row.currency.toUpperCase()) ? row.currency.toUpperCase() : null,
    paymentStatus,
    retryAfterSeconds: status === 'accepted' || status === 'running' ? 5 : null,
  };
}

const defaultDependencies: ConfirmAudioGenerationDependencies = {
  paidGenerationEnabled: () => false,
  withTransaction: callback => withDbTransaction(executor => callback(executor)),
  lockOwnedQuote: audioQuoteRepository.lockOwnedQuote,
  markQuoteExpired: audioQuoteRepository.markQuoteExpired,
  getAccountRestriction: (userId, { executor }) => getActiveAccountRestrictionInExecutor(userId, executor),
  listCapabilities: () => listAudioCapabilities(),
  resolveReference: (principal, reference, { executor }) => resolveOwnedAudioReference(principal, reference, { executor }),
  priceCurrentRun: defaultPriceCurrentRun,
  checkSpendingLimits: checkMcpConfirmationSpendingLimits,
  buildReservation: buildAudioRunReservation,
  reserveInitialJob: (initialJob, { executor }) => createInitialAudioJobInExecutor(executor, initialJob),
  claimPreparedQuote: audioQuoteRepository.claimPreparedQuote,
  executeRun: executeReservedAudioRun,
  markQuoteAccepted: audioQuoteRepository.markQuoteAccepted,
  markQuoteFailed: audioQuoteRepository.markQuoteFailed,
  readAudioStatus,
  accountUrl: 'https://maxvideoai.com',
};

type TransactionResult = { kind: 'repeat'; jobId: string } | { kind: 'created'; reservation: Reservation } | { kind: 'expired' };

async function confirmationTransaction(
  input: ConfirmAudioGenerationInput,
  principal: AgentPrincipal,
  dependencies: ConfirmAudioGenerationDependencies,
): Promise<TransactionResult> {
  return dependencies.withTransaction(async executor => {
    const owner = { quoteId: input.quoteId, userId: principal.userId, oauthClientId: principal.clientId };
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
    if (!dependencies.paidGenerationEnabled()) {
      throw new AgentApiError('ENGINE_UNAVAILABLE', 'Paid Audio generation is not available.');
    }
    if (await dependencies.getAccountRestriction(principal.userId, { executor })) {
      throw new AgentApiError('ACCOUNT_RESTRICTED', 'This account is temporarily restricted. Open MaxVideoAI for help.');
    }
    if (hashCanonicalAudioRequest(quote.request) !== quote.requestHash) staleQuote();
    const capability = dependencies.listCapabilities();
    const mode = capability.modes.find(candidate => candidate.mode === quote.request.mode && candidate.engineId === quote.request.engineId);
    if (!mode?.available || capability.revision !== quote.catalogRevision) staleQuote();
    let evidence: AudioQuoteExecutionEvidence;
    try {
      evidence = parseAudioQuoteExecutionEvidence(quote.pricingSnapshot);
    } catch {
      staleQuote();
    }
    if (evidence.requestHash !== quote.requestHash) staleQuote();
    let references: ResolvedAudioReference[];
    try {
      references = await Promise.all(quote.request.references.map(reference =>
        dependencies.resolveReference(principal, reference, { executor })));
    } catch (error) {
      if (error instanceof AgentApiError && error.code === 'AUTH_REQUIRED') throw error;
      staleQuote();
    }
    if (!sameAudioReferenceEvidence(evidence.references, references)) staleQuote();
    let prepared: PreparedAudioRun;
    try {
      prepared = await dependencies.priceCurrentRun(quote.request, evidence, references, {
        executor,
        userId: principal.userId,
      });
    } catch {
      staleQuote();
    }
    if (!isAudioRunCapabilityAvailable(capability, prepared.normalized)) staleQuote();
    if (prepared.durationSec !== evidence.durationSec
      || prepared.inputKey !== evidence.inputKey
      || prepared.pricingSnapshot.totalCents !== quote.priceCents
      || prepared.pricingSnapshot.currency !== quote.currency
      || stableJson(persistedJson(prepared.pricingSnapshot))
        !== stableJson(persistedJson(pricingWithoutEvidence(quote.pricingSnapshot)))) {
      staleQuote();
    }
    const spending = await dependencies.checkSpendingLimits(
      { userId: principal.userId, priceCents: quote.priceCents, currency: quote.currency },
      { executor },
    );
    if (!spending.allowed) throw spendingError(dependencies);
    const reservation = dependencies.buildReservation(prepared, principal.userId);
    try {
      await dependencies.reserveInitialJob(reservation.initialJob, { executor });
    } catch (error) {
      const code = error && typeof error === 'object' && 'code' in error ? String((error as { code?: unknown }).code) : '';
      const status = error && typeof error === 'object' && 'status' in error ? Number((error as { status?: unknown }).status) : 0;
      if (status === 402 || /insufficient/i.test(code)) {
        throw new AgentApiError('INSUFFICIENT_FUNDS', 'Add funds before confirming this Audio generation.');
      }
      throw error;
    }
    const claimed = await dependencies.claimPreparedQuote(
      { ...owner, jobId: reservation.initialJob.jobId },
      { executor, claimedAt: databaseNow },
    );
    if (!claimed || claimed.state !== 'claimed' || claimed.jobId !== reservation.initialJob.jobId) {
      throw new AgentApiError('INTERNAL_ERROR', 'The Audio quote could not be claimed.');
    }
    return { kind: 'created', reservation };
  });
}

async function requireStatus(userId: string, jobId: string, dependencies: ConfirmAudioGenerationDependencies) {
  const status = await dependencies.readAudioStatus({ userId, jobId });
  if (!status || status.jobId !== jobId || status.surface !== 'audio') {
    throw new AgentApiError('INTERNAL_ERROR', 'The confirmed Audio status is unavailable.');
  }
  return status;
}

export async function confirmAudioGeneration(
  input: ConfirmAudioGenerationInput,
  principal: AgentPrincipal,
  dependencies: ConfirmAudioGenerationDependencies = defaultDependencies,
): Promise<AudioGenerationConfirmation> {
  assertInput(input);
  requirePrincipal(principal);
  const transaction = await confirmationTransaction(input, principal, dependencies);
  if (transaction.kind === 'expired') staleQuote();
  if (transaction.kind === 'repeat') return requireStatus(principal.userId, transaction.jobId, dependencies);
  const mutation = {
    quoteId: input.quoteId,
    userId: principal.userId,
    oauthClientId: principal.clientId,
    jobId: transaction.reservation.initialJob.jobId,
  };
  let executionFailed = false;
  try {
    await dependencies.executeRun(transaction.reservation.execution);
  } catch {
    executionFailed = true;
  }
  if (executionFailed) {
    await dependencies.markQuoteFailed(mutation).catch(() => null);
  } else {
    await dependencies.markQuoteAccepted(mutation).catch(() => {
      console.warn('[mcp-audio] completed job quote acceptance awaits reconciliation', {
        jobId: mutation.jobId,
      });
      return null;
    });
  }
  return requireStatus(principal.userId, mutation.jobId, dependencies);
}

export function createConfirmAudioGenerationService(
  accountUrl: string,
  dependencies: Partial<ConfirmAudioGenerationDependencies> = {},
) {
  const resolved = { ...defaultDependencies, ...dependencies, accountUrl };
  return (input: ConfirmAudioGenerationInput, principal: AgentPrincipal) =>
    confirmAudioGeneration(input, principal, resolved);
}
