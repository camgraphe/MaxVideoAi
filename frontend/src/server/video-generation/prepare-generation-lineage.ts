import { validateExtraInputValues } from '@/app/api/generate/_lib/extra-input-values';
import { resolveOwnedFluxDraftSource } from '@/server/flux-draft-cache-store';
import { type QualifiedFluxDraftSource } from '@/server/flux-draft-cache';
import { query } from '@/lib/db';
import { buildResponseFromExistingVideoJob, type ExistingVideoJobRow } from '@/app/api/generate/_lib/initial-video-job';
import { resolveOwnedLumaGenerationSource, type OwnedLumaGenerationSource } from '@/server/agent-api/generation-luma-lineage';
import { buildLumaAgentsVideoPayload } from '@/server/video-providers/luma-agents/payload';
import type { ExecuteVideoGenerationOptions } from './execute-video-generation';
import type { VideoGenerationResponse } from './video-generation-contracts';

/** Owned provider lineage and accepted-job replay are resolved before attachment processing or spend. */
export async function prepareGenerationLineage(params: ExecuteVideoGenerationOptions): Promise<
  {response:VideoGenerationResponse} | {fluxDraftSource?:QualifiedFluxDraftSource;lumaGenerationSource?:OwnedLumaGenerationSource;validatedExtraInputValues:Record<string,unknown>}
> {
  const {body,userId,localKey,preReservedInitialState,trustedQuotedBilling}=params;
  const routeContext=params.routeContext;
  const {engine,mode,jobId}=routeContext;
  const {prompt,durationSec,rawDurationOption,effectiveResolution,loop,endImageUrl,rawExtraInputValues}=params.requestOptions;
  const extraInputValidation = validateExtraInputValues({
    engine,
    mode,
    rawExtraInputValues,
  });
  if (!extraInputValidation.ok) {
    return {response:{body:extraInputValidation.body,status:extraInputValidation.status}};
  }
  const validatedExtraInputValues = extraInputValidation.values;
  if (engine.id === 'luma-ray-3-2' && mode === 't2v' && Array.isArray(body.inputs)
    && body.inputs.some(input => input && typeof input === 'object' && input.slotId === 'keyframe_urls')
    && routeContext.providerRoutingPlan.kind !== 'luma_agents_direct_primary') {
    return {response:{ status: 400, body: { ok: false, error: 'LUMA_MODE_UNAVAILABLE', message: 'Creation keyframes require direct Luma access.' } }};
  }
  let fluxDraftSource:QualifiedFluxDraftSource|undefined;
  if(body.operation==='flux-draft-enhance' && !preReservedInitialState) {
    const existing=await query<ExistingVideoJobRow>(`SELECT * FROM app_jobs WHERE job_id=$1 AND user_id=$2 AND engine_id='flux-3-draft' AND provider='fal' AND provider_job_id IS NOT NULL LIMIT 1`,[jobId,userId]);
    if(existing[0])return {response:{body:buildResponseFromExistingVideoJob(existing[0],localKey)}};
  }
  if(body.operation==='flux-draft-enhance') {
    try {
      fluxDraftSource=await resolveOwnedFluxDraftSource({userId,sourceJobId:String(body.sourceJobId??validatedExtraInputValues.source_job_id??''),sourceOutputId:typeof body.sourceOutputId==='string'?body.sourceOutputId:undefined});
      if((body.inputs as unknown[]|undefined)?.length || (trustedQuotedBilling&&trustedQuotedBilling.fluxDraftFingerprint!==fluxDraftSource.fingerprint)) throw new Error('Source changed.');
    } catch {return {response:{status:400,body:{ok:false,error:'REFERENCE_INVALID',message:'The owned Draft cache is unavailable or changed.'}}};}
  }
  let lumaGenerationSource: OwnedLumaGenerationSource | undefined;
  if (engine.id === 'luma-ray-3-2' && mode === 'extend' && !preReservedInitialState) {
    const existing = await query<ExistingVideoJobRow>(`SELECT * FROM app_jobs WHERE job_id = $1 AND user_id = $2
      AND engine_id = 'luma-ray-3-2' AND provider = 'luma_agents_direct' AND provider_job_id IS NOT NULL LIMIT 1`, [jobId, userId]);
    if (existing[0]) return {response:{ body: buildResponseFromExistingVideoJob(existing[0], localKey) }};
  }
  if (engine.id === 'luma-ray-3-2' && mode === 'extend') {
    try {
      lumaGenerationSource = await resolveOwnedLumaGenerationSource({ actor: { userId },
        sourceJobId: String(body.sourceJobId ?? validatedExtraInputValues.source_job_id ?? ''),
        expectedOutputId: typeof body.sourceOutputId === 'string' ? body.sourceOutputId : undefined });
      if (trustedQuotedBilling && trustedQuotedBilling.lumaSourceFingerprint !== lumaGenerationSource.fingerprint) throw new Error('Source changed.');
      buildLumaAgentsVideoPayload({ engineId: engine.id, mode, prompt, durationSec, durationOption: rawDurationOption,
        resolution: effectiveResolution, loop, videoUrl: typeof body.videoUrl === 'string' ? body.videoUrl : undefined,
        imageUrl: typeof body.imageUrl === 'string' ? body.imageUrl : undefined, endImageUrl,
        referenceImageUrls: Array.isArray(body.inputs) && body.inputs.length ? ['unexpected-reference'] : [],
        extraInputValues: validatedExtraInputValues, trustedGenerationSource: lumaGenerationSource,
        extendDirection: validatedExtraInputValues.extend_direction as 'forward' | 'backward' | undefined });
    } catch { return {response:{ status: 400, body: { ok: false, error: 'REFERENCE_INVALID', message: 'The source generation or extension settings are not available.' } }}; }
  }


  return {fluxDraftSource,lumaGenerationSource,validatedExtraInputValues};
}
