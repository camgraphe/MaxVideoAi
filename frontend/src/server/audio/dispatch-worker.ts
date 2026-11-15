import { query, type QueryExecutor } from '@/lib/db';
import { audioQuoteRepositoryForActor } from '@/server/agent-api/audio-quote-repository';
import { parseAudioQuoteExecutionEvidence, sameAudioReferenceEvidence, type ResolvedAudioReference } from '@/server/agent-api/audio-quote-snapshot';
import { resolveOwnedAudioReferenceForActor } from '@/server/agent-api/audio-reference-assets';
import { promoteConfirmedAudioOutputs } from '@/server/agent-api/confirm-audio-generation';
import { getActiveAccountRestrictionStrict } from '@/server/fraud-cleanup/restrictions';
import type { CanonicalAudioRequest } from '@/server/agent-api/audio-normalization';
import type { GenerationActor } from '@/server/agent-api/generation-actor';
import { executeReservedAudioRun } from './generate-audio';
import { assertAudioProviderConfigured } from './prepare-audio';
import { failAudioJob } from './audio-generate-jobs';
import { refundAudioCharge } from './audio-generate-receipts';
import type { ReservedAudioRun } from './audio-run-reservation';
import { validateAudioDispatchExecution } from './dispatch-integrity';
import { audioDispatchActor, claimNextAudioDispatch, loadAudioDispatchContext, readAudioDispatchJob, settleAudioDispatch,
  type AudioDispatchRecord, type AudioDispatchContext, type AudioDispatchJob, type AudioDispatchState, type AudioDispatchFailureCode } from './dispatch-repository';

export type AudioGenerationWorkerDependencies = {
  claim(): Promise<AudioDispatchRecord | null>;
  loadContext(record: AudioDispatchRecord): Promise<AudioDispatchContext>;
  readJob(record: AudioDispatchRecord): Promise<AudioDispatchJob | null>;
  resolveReference(actor: GenerationActor, reference: CanonicalAudioRequest['references'][number]): Promise<ResolvedAudioReference>;
  getAccountRestriction(userId: string): Promise<unknown>;
  assertProviderConfigured: typeof assertAudioProviderConfigured;
  executeRun(run: ReservedAudioRun): Promise<unknown>;
  failJob: typeof failAudioJob;
  refundCharge: typeof refundAudioCharge;
  markQuoteAccepted(record: AudioDispatchRecord): Promise<unknown>;
  markQuoteFailed(record: AudioDispatchRecord): Promise<unknown>;
  promoteOutputs(input: { userId: string; jobId: string }): Promise<void>;
  settle(record: AudioDispatchRecord, state: Exclude<AudioDispatchState, 'queued' | 'processing'>, code?: AudioDispatchFailureCode | null): Promise<void>;
};

const owner = (record: AudioDispatchRecord) => ({ quoteId: record.quoteId, userId: record.userId,
  oauthClientId: record.oauthClientId, jobId: record.jobId });
const executor: QueryExecutor = { query };
const defaults: AudioGenerationWorkerDependencies = {
  claim: claimNextAudioDispatch,
  loadContext: loadAudioDispatchContext,
  readJob: readAudioDispatchJob,
  resolveReference: (actor, reference) => resolveOwnedAudioReferenceForActor(actor, reference),
  getAccountRestriction: userId => getActiveAccountRestrictionStrict(userId, { executor }),
  assertProviderConfigured: assertAudioProviderConfigured,
  executeRun: run => executeReservedAudioRun(run, { durableDispatch: true }),
  failJob: failAudioJob,
  refundCharge: refundAudioCharge,
  markQuoteAccepted: async record => {
    const quote = await audioQuoteRepositoryForActor(audioDispatchActor(record)).markQuoteAccepted(owner(record));
    if (!quote) throw new Error('Audio quote acceptance requires reconciliation.');
  },
  markQuoteFailed: async record => {
    const quote = await audioQuoteRepositoryForActor(audioDispatchActor(record)).markQuoteFailed(owner(record));
    if (!quote) throw new Error('Audio quote failure requires reconciliation.');
  },
  promoteOutputs: promoteConfirmedAudioOutputs,
  settle: settleAudioDispatch,
};

async function observeTerminal(record: AudioDispatchRecord, job: AudioDispatchJob, dependencies: AudioGenerationWorkerDependencies): Promise<boolean> {
  if (job.status === 'completed' && job.paymentStatus === 'paid_wallet') {
    await dependencies.markQuoteAccepted(record);
    await dependencies.promoteOutputs({ userId: record.userId, jobId: record.jobId });
    await dependencies.settle(record, 'completed');
    return true;
  }
  if (job.status === 'failed') {
    // Exact idempotent reconciliation also repairs an executor's interrupted refund.
    await dependencies.refundCharge({ userId: record.userId, jobId: record.jobId });
    await dependencies.markQuoteFailed(record);
    await dependencies.settle(record, 'failed');
    return true;
  }
  return false;
}

async function markAmbiguous(record: AudioDispatchRecord, dependencies: AudioGenerationWorkerDependencies, code: AudioDispatchFailureCode) {
  try { await dependencies.settle(record, 'ambiguous', code); }
  catch {
    // The durable processing fence survives a database outage; no provider retry follows.
    console.warn('[audio-worker] dispatch requires reconciliation', { jobId: record.jobId, code });
  }
}

/** Handles one accepted reservation. Purchase/publication flags never revoke already accepted work. */
export async function runAudioGenerationWorkerOnce(overrides: Partial<AudioGenerationWorkerDependencies> = {}): Promise<boolean> {
  const dependencies = { ...defaults, ...overrides };
  const record = await dependencies.claim();
  if (!record) return false;
  let execution: ReservedAudioRun;
  try {
    const { quote, job } = await dependencies.loadContext(record);
    if (await observeTerminal(record, job, dependencies)) return true;
    if (quote.state !== 'claimed' || !['pending', 'running'].includes(job.status) || job.paymentStatus !== 'paid_wallet') {
      throw new Error('Audio dispatch is no longer executable.');
    }
    if (await dependencies.getAccountRestriction(record.userId)) throw new Error('Audio account execution is restricted.');
    const evidence = parseAudioQuoteExecutionEvidence(quote.pricingSnapshot);
    const actor = audioDispatchActor(record);
    const references = await Promise.all(quote.request.references.map(reference => dependencies.resolveReference(actor, reference)));
    if (!sameAudioReferenceEvidence(evidence.references, references)) throw new Error('Audio references changed.');
    execution = validateAudioDispatchExecution({ ...record, quote, references });
    dependencies.assertProviderConfigured(execution.prepared.normalized);
  } catch {
    try {
      const job = await dependencies.readJob(record);
      if (!job) throw new Error('Audio dispatch job is unavailable.');
      if (await observeTerminal(record, job, dependencies)) return true;
      if (!['pending', 'running'].includes(job.status) || job.paymentStatus !== 'paid_wallet') throw new Error('Audio dispatch job requires review.');
      const won = await dependencies.failJob(record.jobId, { progress: 0,
        message: 'MaxVideoAI could not start this Audio attempt. Prepare a fresh quote after wallet reconciliation.' });
      if (!won) throw new Error('Audio dispatch failure transition lost.');
      await dependencies.refundCharge({ userId: record.userId, jobId: record.jobId });
      await dependencies.markQuoteFailed(record);
      await dependencies.settle(record, 'failed', 'validation_failed');
    } catch { await markAmbiguous(record, dependencies, 'reconciliation_required'); }
    return true;
  }
  try {
    await dependencies.executeRun({ ...execution, initialSettingsSnapshot: { ...execution.initialSettingsSnapshot,
      audioDispatch: { version: 1, state: 'processing', observedAt: record.observedAt } } } as ReservedAudioRun);
  } catch {
    // The existing executor owns provider failure transitions and exact refunds.
    // An active job after a throw means acceptance is unknown, never a retry signal.
  }
  try {
    const job = await dependencies.readJob(record);
    if (job && await observeTerminal(record, job, dependencies)) return true;
    await markAmbiguous(record, dependencies, 'execution_unknown');
  } catch { await markAmbiguous(record, dependencies, 'reconciliation_required'); }
  return true;
}
