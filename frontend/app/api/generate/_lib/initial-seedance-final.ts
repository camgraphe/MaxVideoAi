import type { TransactionQueryExecutor } from '@/lib/db';
import { reserveSeedanceDraftFinal } from '@/server/seedance-draft-links';
import type { CreateVideoInitialJobParams } from './initial-video-job';
import { seedanceDraftBillingFingerprint } from '@/server/seedance-workflow-facts';

export type SeedanceFinalReservation = {
  draftJobId: string;
  providerTaskId: string;
  providerModelId: string;
  parentSnapshotFingerprint?: string;
};

/** Runs in the same transaction as the job and wallet debit. */
export async function reserveInitialSeedanceFinal(
  executor: TransactionQueryExecutor,
  params: CreateVideoInitialJobParams,
): Promise<void> {
  const workflow = JSON.parse(params.jobInsert.settingsSnapshotJson).seedanceWorkflow;
  const final = params.seedanceFinal;
  if (!final && workflow?.step !== 'final') return;
  if (!final || workflow?.step !== 'final' || workflow.draftJobId !== final.draftJobId
    || params.jobInsert.engineId !== 'seedance-2-5' || params.jobInsert.provider !== 'byteplus_modelark'
    || params.paymentMode !== 'wallet' || params.walletReservation !== 'reserve'
    || params.jobInsert.iterationCount !== 1) throw new Error('Invalid Draft finalization reservation.');
  if (final.parentSnapshotFingerprint) {
    const parents = await executor.query<{ prompt: string; audio: boolean; settings: unknown }>(`
      SELECT prompt, has_audio AS audio, settings_snapshot AS settings FROM app_jobs
      WHERE job_id=$1 AND user_id=$2 AND engine_id='seedance-2-5' AND provider='byteplus_modelark' AND status='completed'
      FOR SHARE`, [final.draftJobId, params.userId]);
    if (parents.length !== 1 || seedanceDraftBillingFingerprint(parents[0]) !== final.parentSnapshotFingerprint) {
      throw new Error('The owned Draft media facts changed before finalization.');
    }
  }
  const reserved = await reserveSeedanceDraftFinal({ userId: params.userId,
    draftJobId: final.draftJobId, finalJobId: params.jobId }, executor.query.bind(executor));
  if (!reserved || reserved.providerTaskId !== final.providerTaskId || reserved.providerModelId !== final.providerModelId) {
    throw new Error('This Draft is unavailable, expired or already finalizing.');
  }
}
