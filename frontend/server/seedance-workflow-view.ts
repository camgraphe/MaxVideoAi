import type { AspectRatio } from '@/types/engines';
import { query } from '@/lib/db';
import type { SeedanceWorkflowJob, SeedanceWorkflowView } from '@/lib/seedance-workflow-contract';
import { SEEDANCE_WORKFLOW_ASPECT_RATIOS } from '@/lib/seedance-workflow-contract';
import { getKnownGenerationFailureMessage } from '@/lib/generation-failure-messages';
import { getVideoFailureCodeFromSettingsSnapshot } from '@/lib/video-failure-codes';
import { isRecord } from './byteplus-record-utils';
import { readSeedanceWorkflowMediaFacts, SEEDANCE_WORKFLOW_MODES, type SeedanceWorkflowMode } from './seedance-workflow-facts';

type QueryFn = <T = unknown>(sql: string, values?: readonly unknown[]) => Promise<T[]>;
type Row = { draft: SeedanceWorkflowJob; final: SeedanceWorkflowJob | null; expiresAt: Date | string | null;
  draftState: string | null; finalState: string | null; finalJobId: string | null; expired: boolean;
  taskMatches: boolean; durationSec: number; aspectRatio: AspectRatio; audio: boolean;
  draftMessage: string | null; draftSettingsSnapshot: unknown };

/** Read-only, account-bound projection. Provider identifiers never leave the server. */
export async function readOwnedSeedanceWorkflowView(userId: string, draftJobId: string, queryFn: QueryFn = query): Promise<SeedanceWorkflowView | null> {
  const rows = await queryFn<Row>(`
    SELECT jsonb_build_object('jobId',j.job_id,'status',j.status,'amountCents',j.final_price_cents,
      'currency',j.currency,'paymentStatus',j.payment_status,'videoUrl',j.video_url,'thumbUrl',j.thumb_url) AS draft,
      CASE WHEN f.job_id IS NOT NULL THEN jsonb_build_object('jobId',f.job_id,'status',f.status,'amountCents',f.final_price_cents,
        'currency',f.currency,'paymentStatus',f.payment_status,'videoUrl',f.video_url,'thumbUrl',f.thumb_url) END AS final,
      d.expires_at AS "expiresAt", d.draft_state AS "draftState", d.final_state AS "finalState", d.final_job_id AS "finalJobId",
      d.expires_at <= now() AS expired, j.provider_job_id = d.provider_task_id AS "taskMatches",
      j.duration_sec AS "durationSec", j.aspect_ratio AS "aspectRatio", j.has_audio AS audio,
      j.message AS "draftMessage", j.settings_snapshot AS "draftSettingsSnapshot"
    FROM app_jobs j
    LEFT JOIN seedance_draft_links d ON d.draft_job_id = j.job_id AND d.user_id = j.user_id
    LEFT JOIN app_jobs f ON f.job_id = d.final_job_id AND f.user_id = j.user_id
      AND f.engine_id = 'seedance-2-5' AND f.provider = 'byteplus_modelark'
      AND f.settings_snapshot #>> '{seedanceWorkflow,step}' = 'final'
      AND f.settings_snapshot #>> '{seedanceWorkflow,draftJobId}' = j.job_id
    WHERE j.user_id = $1 AND j.job_id = $2 AND j.engine_id = 'seedance-2-5' AND j.provider = 'byteplus_modelark'
      AND j.settings_snapshot #>> '{seedanceWorkflow,step}' = 'draft'
      AND j.settings_snapshot ->> 'inputMode' IN ('t2v','i2v','ref2v','v2v','extend')
      AND j.settings_snapshot #>> '{core,resolution}' = '480p'
      AND j.settings_snapshot #>> '{core,iterationCount}' = '1'
    LIMIT 1`, [userId, draftJobId]);
  const row = rows[0];
  const snapshot = isRecord(row?.draftSettingsSnapshot) ? row.draftSettingsSnapshot : {};
  const core = isRecord(snapshot.core) ? snapshot.core : {};
  const workflow = isRecord(snapshot.seedanceWorkflow) ? snapshot.seedanceWorkflow : {};
  const facts = readSeedanceWorkflowMediaFacts(workflow.mediaFacts);
  const mode = snapshot.inputMode as SeedanceWorkflowMode;
  const durationSec = facts?.durationSec ?? core.durationSec ?? row?.durationSec;
  const aspectRatio = facts?.aspectRatio ?? row?.aspectRatio ?? null;
  if (!row || !Number.isInteger(durationSec) || Number(durationSec) < 4 || Number(durationSec) > 30
    || !SEEDANCE_WORKFLOW_MODES.includes(mode) || (mode !== 't2v' && !facts) || (facts && facts.mode !== mode)
    || ('mediaFacts' in workflow && !facts) || typeof row.audio !== 'boolean'
    || (aspectRatio !== null && aspectRatio !== 'auto' && !SEEDANCE_WORKFLOW_ASPECT_RATIOS.includes(aspectRatio as AspectRatio))) return null;
  let eligibility: SeedanceWorkflowView['eligibility'] = 'unavailable';
  if (row.draft.status === 'failed') eligibility = 'failed';
  else if (row.draft.status !== 'completed') eligibility = 'pending';
  else if (row.finalJobId && row.final) {
    eligibility = row.finalState === 'completed' && row.final.status === 'completed' ? 'finalized'
      : ['reserved', 'submitted'].includes(row.finalState ?? '') ? 'finalizing' : 'unavailable';
  } else if (!row.finalJobId && row.taskMatches && row.draftState === 'ready' && row.finalState === 'none') {
    eligibility = row.expired ? 'expired' : 'ready';
  }
  // Only fixed customer guidance crosses this boundary, never provider bodies or identifiers.
  const message = eligibility === 'failed' ? getKnownGenerationFailureMessage({
    failureCode: getVideoFailureCodeFromSettingsSnapshot(row.draftSettingsSnapshot), message: row.draftMessage,
  }) : null;
  return { draft: { ...row.draft, message }, final: row.final, eligibility,
    expiresAt: row.expiresAt ? new Date(row.expiresAt).toISOString() : null,
    settings: { mode, durationSec: Number(durationSec), ...(facts?.durationOption !== undefined ? { durationOption: facts.durationOption } : {}),
      aspectRatio: aspectRatio as AspectRatio | null, audio: row.audio, resolution: '480p' } };
}
