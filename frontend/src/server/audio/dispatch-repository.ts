import { randomUUID } from 'node:crypto';
import { getAudioPackConfig } from '@/lib/audio-generation';

import { isTransactionQueryExecutor, query, withDbTransaction, type QueryExecutor, type TransactionQueryExecutor } from '@/lib/db';
import { audioQuoteRepositoryForActor } from '@/server/agent-api/audio-quote-repository';
import { parseAudioQuoteExecutionEvidence } from '@/server/agent-api/audio-quote-snapshot';
import { quoteMatchesActor, requireAudioGenerationActor, type GenerationActor } from '@/server/agent-api/generation-actor';
import { stableJson } from '@/server/agent-api/generation-normalization';
import type { CanonicalAudioRequest } from '@/server/agent-api/audio-normalization';
import type { McpGenerationQuote } from '@/server/agent-api/quote-repository';
import type { ReservedAudioRun } from './audio-run-reservation';
import { audioDispatchExecutionHash, validateAudioDispatchExecution } from './dispatch-integrity';

export type AudioDispatchState = 'queued' | 'processing' | 'completed' | 'failed' | 'ambiguous';
export type AudioDispatchFailureCode = 'validation_failed' | 'execution_unknown' | 'reconciliation_required';
export type AudioDispatchRecord = {
  quoteId: string; jobId: string; userId: string; oauthClientId: string | null;
  authOrigin: GenerationActor['authMethod']; studioProjectId: string | null;
  requestHash: string; executionHash: string; execution: unknown;
  state: AudioDispatchState; claimId: string | null; observedAt: string;
};
export type AudioDispatchJob = {
  jobId: string; userId: string; status: string; paymentStatus: string; priceCents: number;
  currency: string; engineId: string; billingProductKey: string; pricingSnapshot: Record<string, unknown>;
};
export type AudioDispatchContext = { quote: McpGenerationQuote<CanonicalAudioRequest>; job: AudioDispatchJob };

type DispatchRow = {
  quote_id: string; job_id: string; user_id: string; oauth_client_id: string | null;
  auth_origin: GenerationActor['authMethod']; studio_project_id: string | null;
  request_hash: string; execution_hash: string; execution_json: unknown;
  state: AudioDispatchState; claim_id: string | null; observed_at: Date;
};
function fromRow(row: DispatchRow): AudioDispatchRecord {
  return { quoteId: row.quote_id, jobId: row.job_id, userId: row.user_id, oauthClientId: row.oauth_client_id,
    authOrigin: row.auth_origin, studioProjectId: row.studio_project_id, requestHash: row.request_hash,
    executionHash: row.execution_hash, execution: row.execution_json, state: row.state,
    claimId: row.claim_id, observedAt: row.observed_at.toISOString() };
}
function invalid(): never { throw new Error('Audio dispatch reservation binding is invalid.'); }

export function audioDispatchActor(record: Pick<AudioDispatchRecord, 'authOrigin' | 'userId' | 'oauthClientId' | 'studioProjectId'>): GenerationActor {
  const actor: GenerationActor = record.authOrigin === 'oauth'
    ? { authMethod: 'oauth', userId: record.userId, clientId: record.oauthClientId, emailVerified: true }
    : record.authOrigin === 'studio-session'
      ? { authMethod: 'studio-session', userId: record.userId, clientId: null, projectId: record.studioProjectId! }
      : { authMethod: 'toolbox-session', userId: record.userId, clientId: null };
  if (!['oauth', 'studio-session', 'toolbox-session'].includes(record.authOrigin)
    || (record.authOrigin !== 'oauth' && record.oauthClientId !== null)
    || (record.authOrigin !== 'studio-session' && record.studioProjectId !== null)) invalid();
  requireAudioGenerationActor(actor);
  return actor;
}

/** Independently checks the job's exact owner and charge before any failure/refund transition. */
export async function readAudioDispatchJob(
  record: Pick<AudioDispatchRecord, 'jobId' | 'userId'>,
  dependencies: { executor?: QueryExecutor } = {},
): Promise<AudioDispatchJob | null> {
  const executor = dependencies.executor ?? { query };
  const jobs = await executor.query<{
    job_id: string; user_id: string; status: string; payment_status: string; final_price_cents: number;
    currency: string; engine_id: string; billing_product_key: string; pricing_snapshot: Record<string, unknown>;
  }>(`SELECT job_id,user_id,status,payment_status,final_price_cents,currency,engine_id,billing_product_key,pricing_snapshot
        FROM app_jobs WHERE job_id=$1 AND user_id=$2 AND surface='audio'`, [record.jobId, record.userId]);
  const job = jobs[0];
  if (!job) return null;
  const charges = await executor.query<{
    user_id: string; surface: string; amount_cents: number; currency: string;
    billing_product_key: string; pricing_snapshot: unknown;
  }>(`SELECT user_id,surface,amount_cents,currency,billing_product_key,pricing_snapshot
        FROM app_receipts WHERE job_id=$1 AND type='charge' LIMIT 2`, [record.jobId]);
  const charge = charges[0];
  if (charges.length !== 1 || !charge || charge.user_id !== job.user_id || charge.surface !== 'audio'
    || !Number.isSafeInteger(job.final_price_cents) || job.final_price_cents <= 0
    || charge.amount_cents !== job.final_price_cents || charge.currency !== job.currency
    || charge.billing_product_key !== job.billing_product_key
    || stableJson(charge.pricing_snapshot) !== stableJson(job.pricing_snapshot)) invalid();
  return { jobId: job.job_id, userId: job.user_id, status: job.status, paymentStatus: job.payment_status,
    priceCents: job.final_price_cents, currency: job.currency, engineId: job.engine_id,
    billingProductKey: job.billing_product_key, pricingSnapshot: job.pricing_snapshot };
}

export async function loadAudioDispatchContext(record: AudioDispatchRecord, dependencies: { executor?: QueryExecutor } = {}): Promise<AudioDispatchContext> {
  const executor = dependencies.executor ?? { query };
  const actor = audioDispatchActor(record);
  const quote = await audioQuoteRepositoryForActor(actor).getOwnedQuote({ quoteId: record.quoteId,
    userId: record.userId, oauthClientId: record.oauthClientId }, { executor });
  const job = await readAudioDispatchJob(record, { executor });
  if (!quote || !job || !quoteMatchesActor(quote, actor) || quote.jobId !== record.jobId
    || !['claimed', 'accepted', 'failed'].includes(quote.state) || quote.fundingMode !== 'wallet'
    || quote.requestHash !== record.requestHash || quote.priceCents !== job.priceCents || quote.currency !== job.currency
    || quote.request.engineId !== job.engineId
    || getAudioPackConfig(quote.request.mode).billingProductKey !== job.billingProductKey) invalid();
  const pricing = { ...quote.pricingSnapshot }; delete pricing.mcpAudio;
  if (stableJson(pricing) !== stableJson(job.pricingSnapshot)) invalid();
  return { quote, job };
}

/** Must run after quote claim inside the same wallet/job reservation transaction. */
export async function enqueueAudioDispatch(
  input: { quoteId: string; principal: GenerationActor; execution: ReservedAudioRun },
  { executor }: { executor: TransactionQueryExecutor },
): Promise<void> {
  if (!isTransactionQueryExecutor(executor)) throw new Error('Audio dispatch requires an active reservation transaction.');
  requireAudioGenerationActor(input.principal);
  const actor = input.principal;
  const execution = JSON.parse(JSON.stringify(input.execution)) as unknown;
  const quote = await audioQuoteRepositoryForActor(actor).getOwnedQuote({ quoteId: input.quoteId,
    userId: actor.userId, oauthClientId: actor.clientId }, { executor });
  if (!quote || !quoteMatchesActor(quote, actor) || quote.state !== 'claimed' || quote.jobId !== input.execution.jobId) invalid();
  const record: AudioDispatchRecord = {
    quoteId: input.quoteId, jobId: input.execution.jobId, userId: actor.userId, oauthClientId: actor.clientId,
    authOrigin: actor.authMethod, studioProjectId: actor.authMethod === 'studio-session' ? actor.projectId : null,
    requestHash: quote.requestHash, executionHash: audioDispatchExecutionHash(execution), execution,
    state: 'queued', claimId: null, observedAt: '',
  };
  const context = await loadAudioDispatchContext(record, { executor });
  if (context.job.status !== 'pending' || context.job.paymentStatus !== 'paid_wallet') invalid();
  validateAudioDispatchExecution({ ...record, quote, references: parseAudioQuoteExecutionEvidence(quote.pricingSnapshot).references });
  const rows = await executor.query<DispatchRow>(`INSERT INTO audio_generation_dispatch
      (quote_id,job_id,user_id,oauth_client_id,auth_origin,studio_project_id,request_hash,execution_json,execution_hash)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9) RETURNING *`, [record.quoteId, record.jobId, record.userId,
    record.oauthClientId, record.authOrigin, record.studioProjectId, record.requestHash, JSON.stringify(execution), record.executionHash]);
  if (!rows[0]) invalid();
  await projectAudioDispatch(fromRow(rows[0]), executor);
}

async function projectAudioDispatch(record: AudioDispatchRecord, executor: QueryExecutor): Promise<void> {
  await executor.query(`UPDATE app_jobs SET settings_snapshot=jsonb_set(COALESCE(settings_snapshot,'{}'::jsonb),
      '{audioDispatch}',$3::jsonb,true),updated_at=clock_timestamp()
    WHERE job_id=$1 AND user_id=$2 AND surface='audio'`, [record.jobId, record.userId,
    JSON.stringify({ version: 1, state: record.state, observedAt: record.observedAt })]);
}

/** Processing is a durable one-way fence. There is deliberately no lease expiration or processing retry. */
export function claimNextAudioDispatch(): Promise<AudioDispatchRecord | null> {
  return withDbTransaction(async executor => {
    const rows = await executor.query<DispatchRow>(`WITH candidate AS (
      SELECT quote_id FROM audio_generation_dispatch WHERE state='queued'
      ORDER BY queued_at,quote_id LIMIT 1 FOR UPDATE SKIP LOCKED
    ) UPDATE audio_generation_dispatch d SET state='processing',claim_id=$1,observed_at=clock_timestamp()
      FROM candidate c WHERE d.quote_id=c.quote_id AND d.state='queued' RETURNING d.*`, [randomUUID()]);
    if (!rows[0]) return null;
    const record = fromRow(rows[0]);
    await projectAudioDispatch(record, executor);
    return record;
  });
}

export function settleAudioDispatch(record: AudioDispatchRecord, state: Exclude<AudioDispatchState, 'queued' | 'processing'>,
  failureCode: AudioDispatchFailureCode | null = null): Promise<void> {
  return withDbTransaction(async executor => {
    const rows = await executor.query<DispatchRow>(`UPDATE audio_generation_dispatch
      SET state=$3,failure_code=$4,observed_at=clock_timestamp()
      WHERE quote_id=$1 AND claim_id=$2 AND state='processing' RETURNING *`, [record.quoteId, record.claimId, state, failureCode]);
    if (!rows[0]) throw new Error('Audio dispatch terminal transition requires reconciliation.');
    await projectAudioDispatch(fromRow(rows[0]), executor);
  });
}
