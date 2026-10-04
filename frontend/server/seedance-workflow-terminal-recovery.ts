import { query } from '@/lib/db';
import type { GenerationStatusRecord } from '@/server/generations/generation-status';
import { isRecord } from './byteplus-record-utils';
import { reconcileSeedanceWorkflowOutcome } from './seedance-workflow-outcome';

type QueryFn = <T = unknown>(sql: string, params?: readonly unknown[]) => Promise<T[]>;
type TerminalJob = Pick<GenerationStatusRecord, 'job_id' | 'user_id' | 'engine_id' | 'provider' | 'provider_job_id' | 'status' | 'video_url' | 'settings_snapshot'>;

/** Bounded repair of one owned, durable terminal job; no provider call or schema work. */
export async function recoverTerminalSeedanceWorkflow(job: TerminalJob, queryFn: QueryFn = query): Promise<void> {
  if (job.provider !== 'byteplus_modelark' || job.engine_id !== 'seedance-2-5' || !job.user_id
    || (job.status !== 'completed' && job.status !== 'failed') || (job.status === 'completed' && !job.video_url)) return;
  const settings = isRecord(job.settings_snapshot) ? job.settings_snapshot : {};
  const workflow = isRecord(settings.seedanceWorkflow) ? settings.seedanceWorkflow : {};
  if (workflow.step !== 'draft' && workflow.step !== 'final') return;
  await reconcileSeedanceWorkflowOutcome({ ...job, provider_job_id: job.provider_job_id ?? '' }, job.status, queryFn);
}
