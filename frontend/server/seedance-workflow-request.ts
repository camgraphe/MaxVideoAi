import { query } from '@/lib/db';
import { isRecord } from './byteplus-record-utils';
import { getOwnedReadySeedanceDraftLink } from './seedance-draft-links';
import type { SeedanceFinalReservation } from '@/app/api/generate/_lib/initial-seedance-final';
import type { SeedanceSubmissionWorkflow } from './seedance-workflow-submission';

type Parent = { prompt: string; durationSec: number; aspectRatio: string; audio: boolean; settings: Record<string, unknown> };
export type PreparedSeedanceWorkflow = { body: Record<string, unknown>; workflow: SeedanceSubmissionWorkflow; seedanceFinal?: SeedanceFinalReservation };

export class SeedanceWorkflowRequestError extends Error {
  readonly code = 'SEEDANCE_DRAFT_UNAVAILABLE';
  readonly status = 409;
}

export function localSeedanceWorkflowEnabled(url: string): boolean {
  const host = new URL(url).hostname;
  return process.env.NODE_ENV === 'development' && process.env.PRICING_SANDBOX === '1'
    && process.env.SEEDANCE_2_5_DRAFT_ENABLED === '1' && ['localhost', '127.0.0.1', '[::1]'].includes(host);
}

async function readParent(userId: string, jobId: string): Promise<Parent | null> {
  const rows = await query<Parent>(`SELECT prompt, duration_sec AS "durationSec", aspect_ratio AS "aspectRatio",
    has_audio AS audio, settings_snapshot AS settings FROM app_jobs
    WHERE job_id = $1 AND user_id = $2 AND engine_id = 'seedance-2-5' AND provider = 'byteplus_modelark' AND status = 'completed'`, [jobId, userId]);
  return rows[0] ?? null;
}

/** Resolve owner and inherited facts before quotation, then recheck under the debit lock. */
export async function resolveSeedanceWorkflowRequest(input: {
  body: Record<string, unknown>; userId: string; engineId: string; enabled: boolean;
}, deps: { getOwnedReadyFn?: typeof getOwnedReadySeedanceDraftLink; readParentFn?: typeof readParent } = {}): Promise<PreparedSeedanceWorkflow | null> {
  const { body } = input;
  const raw = body.seedanceWorkflow;
  const invalid = (message = 'Unsupported Draft workflow.') => new SeedanceWorkflowRequestError(message);
  if (raw === undefined) {
    if ('draft' in body || 'draftTaskId' in body || 'draft_task_id' in body) throw invalid();
    return null;
  }
  if (!input.enabled || !input.userId) throw invalid('Draft workflow is unavailable.');
  if (input.engineId !== 'seedance-2-5' || body.mode !== 't2v' || !isRecord(raw)
    || !['draft', 'final'].includes(String(raw.step))
    || Object.keys(raw).some(key => !(raw.step === 'final' ? ['step', 'draftJobId'] : ['step']).includes(key))
    || (body.iterationCount !== undefined && body.iterationCount !== 1)
    || (isRecord(body.payment) && body.payment.mode && body.payment.mode !== 'wallet')
    || (Array.isArray(body.inputs) && body.inputs.length > 0)) throw invalid();
  if (raw.step === 'draft') {
    if (body.resolution !== undefined && body.resolution !== '480p') throw invalid();
    return { body: { ...body, resolution: '480p', iterationCount: 1, audio: body.audio !== false }, workflow: { step: 'draft' } };
  }
  const draftJobId = raw.draftJobId;
  if (typeof draftJobId !== 'string' || !draftJobId || draftJobId.length > 255 || /\s|\0/u.test(draftJobId)) throw invalid();
  const link = await (deps.getOwnedReadyFn ?? getOwnedReadySeedanceDraftLink)(input.userId, draftJobId);
  if (!link) throw invalid('This Draft is unavailable, expired or already finalizing.');
  const parent = await (deps.readParentFn ?? readParent)(input.userId, draftJobId);
  const settings = isRecord(parent?.settings) ? parent.settings : {};
  const core = isRecord(settings.core) ? settings.core : {};
  const workflow = isRecord(settings.seedanceWorkflow) ? settings.seedanceWorkflow : {};
  if (!parent || settings.inputMode !== 't2v' || workflow.step !== 'draft' || core.resolution !== '480p'
    || core.iterationCount !== 1 || !Number.isInteger(parent.durationSec) || parent.durationSec < 4 || parent.durationSec > 30
    || typeof parent.prompt !== 'string' || typeof parent.audio !== 'boolean') throw invalid();
  return { workflow: { step: 'final', draftJobId },
    seedanceFinal: { draftJobId, providerTaskId: link.providerTaskId, providerModelId: link.providerModelId },
    body: { ...body, prompt: parent.prompt, durationSec: parent.durationSec, duration: parent.durationSec,
      resolution: '1080p', aspectRatio: parent.aspectRatio, audio: parent.audio, iterationCount: 1,
      inputs: [], referenceImages: [], reference_images: [], imageUrl: undefined, image_url: undefined,
      audioUrl: undefined, videoUrls: [], audioUrls: [], endImageUrl: undefined, extraInputValues: {} } };
}
