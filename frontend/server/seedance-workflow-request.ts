import { withoutRetiredOutputControls } from '@/lib/generation-output-policy';
import { query, type QueryExecutor } from '@/lib/db';
import { isRecord } from './byteplus-record-utils';
import { getOwnedReadySeedanceDraftLink } from './seedance-draft-links';
import type { SeedanceFinalReservation } from '@/app/api/generate/_lib/initial-seedance-final';
import type { SeedanceSubmissionWorkflow } from './seedance-workflow-submission';
import { readSeedanceWorkflowMediaFacts, seedanceDraftBillingFingerprint, SEEDANCE_WORKFLOW_MODES, type SeedanceWorkflowMediaFacts, type SeedanceWorkflowMode } from './seedance-workflow-facts';

type Parent = { prompt: string; durationSec: number; aspectRatio: string | null; audio: boolean; settings: Record<string, unknown> };
export type PreparedSeedanceWorkflow = { body: Record<string, unknown>; workflow: SeedanceSubmissionWorkflow; seedanceFinal?: SeedanceFinalReservation;
  finalFacts?: SeedanceWorkflowMediaFacts };

export class SeedanceWorkflowRequestError extends Error {
  readonly code = 'SEEDANCE_DRAFT_UNAVAILABLE';
  readonly status = 409;
}

export function seedanceWorkflowEnabled(url: string): boolean {
  if (process.env.SEEDANCE_2_5_DRAFT_ENABLED !== '1') return false;
  if (process.env.NODE_ENV === 'production') return process.env.PRICING_SANDBOX !== '1';
  if (process.env.NODE_ENV !== 'development' || process.env.PRICING_SANDBOX !== '1') return false;
  try {
    return ['localhost', '127.0.0.1', '[::1]'].includes(new URL(url).hostname);
  } catch {
    return false;
  }
}

async function readParent(userId: string, jobId: string, queryFn: QueryExecutor['query'] = query): Promise<Parent | null> {
  const rows = await queryFn<Parent>(`SELECT prompt, duration_sec AS "durationSec", aspect_ratio AS "aspectRatio",
    has_audio AS audio, settings_snapshot AS settings FROM app_jobs
    WHERE job_id = $1 AND user_id = $2 AND engine_id = 'seedance-2-5' AND provider = 'byteplus_modelark' AND status = 'completed'`, [jobId, userId]);
  return rows[0] ?? null;
}

/** Resolve owner and inherited facts before quotation, then recheck under the debit lock. */
export async function resolveSeedanceWorkflowRequest(input: {
  body: Record<string, unknown>; userId: string; engineId: string; enabled: boolean;
}, deps: { getOwnedReadyFn?: typeof getOwnedReadySeedanceDraftLink; readParentFn?: typeof readParent; queryFn?: QueryExecutor['query'] } = {}): Promise<PreparedSeedanceWorkflow | null> {
  const { body } = input;
  const raw = body.seedanceWorkflow;
  const invalid = (message = 'Unsupported Draft workflow.') => new SeedanceWorkflowRequestError(message);
  if (raw === undefined) {
    if ('draft' in body || 'draftTaskId' in body || 'draft_task_id' in body) throw invalid();
    return null;
  }
  if (!input.enabled || !input.userId) throw invalid('Draft workflow is unavailable.');
  if (input.engineId !== 'seedance-2-5' || !SEEDANCE_WORKFLOW_MODES.includes(body.mode as SeedanceWorkflowMode) || !isRecord(raw)
    || !['draft', 'final'].includes(String(raw.step))
    || Object.keys(raw).some(key => !(raw.step === 'final' ? ['step', 'draftJobId'] : ['step']).includes(key))
    || (body.iterationCount !== undefined && body.iterationCount !== 1)
    || (isRecord(body.payment) && body.payment.mode && body.payment.mode !== 'wallet')) throw invalid();
  if (raw.step === 'draft') {
    if (body.resolution !== undefined && body.resolution !== '480p') throw invalid();
    return { body: { ...body, ...(isRecord(body.extraInputValues) ? { extraInputValues: withoutRetiredOutputControls(body.extraInputValues) } : {}), resolution: '480p', iterationCount: 1, audio: body.audio !== false }, workflow: { step: 'draft' } };
  }
  const draftJobId = raw.draftJobId;
  if (typeof draftJobId !== 'string' || !draftJobId || draftJobId.length > 255 || /\s|\0/u.test(draftJobId)) throw invalid();
  const link = await (deps.getOwnedReadyFn ?? getOwnedReadySeedanceDraftLink)(input.userId, draftJobId, deps.queryFn);
  if (!link) throw invalid('This Draft is unavailable, expired or already finalizing.');
  const parent = await (deps.readParentFn ?? readParent)(input.userId, draftJobId, deps.queryFn);
  const settings = isRecord(parent?.settings) ? parent.settings : {};
  const core = isRecord(settings.core) ? settings.core : {};
  const workflow = isRecord(settings.seedanceWorkflow) ? settings.seedanceWorkflow : {};
  const mediaFacts = readSeedanceWorkflowMediaFacts(workflow.mediaFacts);
  const durationSec = mediaFacts?.durationSec ?? core.durationSec ?? parent?.durationSec;
  if (!parent || !SEEDANCE_WORKFLOW_MODES.includes(settings.inputMode as SeedanceWorkflowMode) || workflow.step !== 'draft' || core.resolution !== '480p'
    || core.iterationCount !== 1 || !Number.isInteger(durationSec) || Number(durationSec) < 4 || Number(durationSec) > 30
    || (settings.inputMode !== 't2v' && !mediaFacts) || (mediaFacts && mediaFacts.mode !== settings.inputMode)
    || ('mediaFacts' in workflow && !mediaFacts)
    || typeof parent.prompt !== 'string' || typeof parent.audio !== 'boolean') throw invalid();
  const refs = isRecord(settings.refs) ? settings.refs : {};
  const advanced = isRecord(settings.advanced) ? settings.advanced : {};
  const finalFacts = mediaFacts ?? { schemaVersion: 1 as const, mode: 't2v' as const, durationSec: Number(durationSec),
    aspectRatio: parent.aspectRatio, hasVideoInput: false, attachments: [], trustedMediaReferences: [] };
  return { workflow: { step: 'final', draftJobId },
    seedanceFinal: { draftJobId, providerTaskId: link.providerTaskId, providerModelId: link.providerModelId,
      parentSnapshotFingerprint: seedanceDraftBillingFingerprint(parent) },
    finalFacts,
    body: { ...body, mode: settings.inputMode, prompt: parent.prompt, durationSec, duration: durationSec,
      durationOption: mediaFacts?.durationOption ?? core.durationOption,
      resolution: '1080p', aspectRatio: finalFacts.aspectRatio, audio: parent.audio, iterationCount: 1,
      inputs: finalFacts.attachments, referenceImages: refs.referenceImages ?? [], reference_images: [],
      imageUrl: refs.imageUrl ?? refs.firstFrameUrl, image_url: undefined,
      audioUrl: refs.audioUrl, audio_url: undefined, videoUrls: refs.videoUrls ?? [], audioUrls: [], endImageUrl: refs.endImageUrl,
      fps: core.fps ?? 24, numFrames: core.numFrames, negativePrompt: settings.negativePrompt,
      cfgScale: advanced.cfgScale, loop: advanced.loop, multiPrompt: advanced.multiPrompt,
      shotType: advanced.shotType, voiceIds: advanced.voiceIds ?? [], voiceControl: advanced.voiceControl === true,
      elements: refs.elements,
      seed: advanced.seed, cameraFixed: advanced.cameraFixed, safetyChecker: advanced.safetyChecker,
      extraInputValues: isRecord(advanced.extraInputValues) ? withoutRetiredOutputControls(advanced.extraInputValues) : {} } };
}
