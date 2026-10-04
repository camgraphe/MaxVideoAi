import { BytePlusModelArkError } from '@/server/video-providers/byteplus-modelark-error';
import { buildSeedance25DraftRequest, buildSeedance25FinalRequest } from '@/server/video-providers/byteplus-modelark-draft';
import { captureSeedanceDraftValidityStart, markSeedanceFinalState, registerSeedanceDraftLink } from './seedance-draft-links';

export type SeedanceSubmissionWorkflow = { step: 'draft' } | { step: 'final'; draftJobId: string };
type QueryFn = (sql: string, params?: unknown[]) => Promise<unknown>;

function repositoryQuery(queryFn: QueryFn) {
  return async <T,>(sql: string, params?: readonly unknown[]): Promise<T[]> => {
    const result = await queryFn(sql, params ? [...params] : undefined);
    if (!Array.isArray(result)) throw new Error('Draft persistence returned no rows.');
    return result as T[];
  };
}

export async function prepareSeedanceWorkflowSubmission(input: {
  workflow: SeedanceSubmissionWorkflow; jobId: string; userId: string; engineId: string;
  iterationCount: number | null; paymentMode: string;
  payloadInput: Parameters<typeof buildSeedance25DraftRequest>[0];
}, queryFn: QueryFn) {
  const invalid = () => new BytePlusModelArkError('Invalid owned Draft workflow.', { status: 400, code: 'SEEDANCE_DRAFT_UNAVAILABLE' });
  if (input.engineId !== 'seedance-2-5' || input.payloadInput.mode !== 't2v'
    || input.iterationCount !== 1 || input.paymentMode !== 'wallet') throw invalid();
  const read = repositoryQuery(queryFn);
  const jobs = await read<{ settings_snapshot: { seedanceWorkflow?: SeedanceSubmissionWorkflow } }>(`
    SELECT settings_snapshot FROM app_jobs
    WHERE job_id = $1 AND user_id = $2 AND engine_id = 'seedance-2-5'
      AND provider = 'byteplus_modelark' AND status = 'pending' AND provider_job_id IS NULL
  `, [input.jobId, input.userId]);
  const stored = jobs[0]?.settings_snapshot?.seedanceWorkflow;
  if (!stored || stored.step !== input.workflow.step) throw invalid();
  if (input.workflow.step === 'final') {
    if (stored.step !== 'final' || stored.draftJobId !== input.workflow.draftJobId || input.payloadInput.resolution !== '1080p') throw invalid();
    const links = await read<{ provider_task_id: string; provider_model_id: string }>(`
      SELECT d.provider_task_id, d.provider_model_id FROM seedance_draft_links d
      JOIN app_jobs j ON j.job_id = d.draft_job_id AND j.user_id = d.user_id
      WHERE d.user_id = $1 AND d.draft_job_id = $2 AND d.final_job_id = $3
        AND d.draft_state = 'ready' AND d.final_state = 'reserved' AND d.expires_at > now()
        AND j.engine_id = 'seedance-2-5' AND j.provider = 'byteplus_modelark'
        AND j.status = 'completed' AND j.provider_job_id = d.provider_task_id
    `, [input.userId, input.workflow.draftJobId, input.jobId]);
    const link = links[0];
    if (!link) throw invalid();
    return { payload: buildSeedance25FinalRequest({ modelId: link.provider_model_id, draftProviderTaskId: link.provider_task_id }),
      recordAccepted: async () => {
        if (!await markSeedanceFinalState(input.userId, input.jobId, 'submitted', read)) throw new Error('Could not persist final lineage.');
      } };
  }
  const payload = buildSeedance25DraftRequest(input.payloadInput);
  const validityStart = captureSeedanceDraftValidityStart();
  await read(`UPDATE app_jobs SET settings_snapshot = jsonb_set(jsonb_set(settings_snapshot,
    '{seedanceWorkflow,validityStartedAt}', to_jsonb($3::text), true),
    '{seedanceWorkflow,providerModelId}', to_jsonb($4::text), true)
    WHERE job_id = $1 AND user_id = $2 AND status = 'pending'`, [input.jobId, input.userId, validityStart.at, payload.model]);
  return { payload, recordAccepted: async (providerTaskId: string) => {
    if (!await registerSeedanceDraftLink({ userId: input.userId, draftJobId: input.jobId,
      providerTaskId, providerModelId: payload.model, validityStart }, read)) throw new Error('Could not persist Draft lineage.');
  } };
}
