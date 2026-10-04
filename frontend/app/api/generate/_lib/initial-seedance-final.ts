import type { TransactionQueryExecutor } from '@/lib/db';
import { reserveSeedanceDraftFinal } from '@/server/seedance-draft-links';
import type { CreateVideoInitialJobParams } from './initial-video-job';

export type SeedanceFinalReservation = {
  draftJobId: string;
  providerTaskId: string;
  providerModelId: string;
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
  const reserved = await reserveSeedanceDraftFinal({ userId: params.userId,
    draftJobId: final.draftJobId, finalJobId: params.jobId }, executor.query.bind(executor));
  if (!reserved || reserved.providerTaskId !== final.providerTaskId || reserved.providerModelId !== final.providerModelId) {
    throw new Error('This Draft is unavailable, expired or already finalizing.');
  }
}
