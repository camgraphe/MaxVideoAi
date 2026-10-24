import { FLUX_FAST_PROMPT_MAX_CHARS, FLUX_LTX_ENDPOINTS, isFluxLtxSourceOperation } from '../../lib/flux-ltx-operations';
import type { GeneratePayload } from './fal-types';
import { parseFlux3MaxKeyframeIndexes } from './flux-3-max';

/** Exact new endpoint projections. Existing Create/Extend dispatch stays untouched. */
export function buildFluxLtxRequest(payload: GeneratePayload) {
  const operation = payload.operation, extras=payload.extraInputValues??{};
  const source=payload.videoUrl ?? payload.inputs?.find(input=>input.kind==='video')?.url;
  if (isFluxLtxSourceOperation(operation)) {
    if (operation==='flux-draft-enhance') {
      const safety=extras.safety_tolerance??2;
      if(!Number.isInteger(safety)||Number(safety)<0||Number(safety)>4) throw new Error('Safety tolerance must be an integer from 0 through 4.');
      if(!payload.trustedFluxDraftCache?.url||!payload.trustedFluxDraftCache.fingerprint) throw new Error('Draft Enhance requires server-resolved paired cache submission.');
      return {model:FLUX_LTX_ENDPOINTS[operation],requestBody:{draft_cache_url:payload.trustedFluxDraftCache.url,safety_tolerance:safety}};
    }
    if (!source) throw new Error('Owned source video is required.');
    if (operation==='ltx23-reframe') {
      const resolution=payload.resolution??'1080p', aspect=payload.aspectRatio??'16:9';
      if (!['720p','1080p'].includes(resolution)||!['1:1','4:5','5:4','9:16','16:9'].includes(aspect)) throw new Error('Unsupported LTX 2.3 Reframe settings.');
      return {model:FLUX_LTX_ENDPOINTS[operation],requestBody:{video_url:source,resolution,aspect_ratio:aspect,enable_safety_checker:payload.safetyChecker??extras.enable_safety_checker??true}};
    }
    if(!payload.prompt.trim()||payload.prompt.length>FLUX_FAST_PROMPT_MAX_CHARS) throw new Error('FAST Edit requires an instruction up to 4096 characters.');
    const safety=extras.safety_tolerance??2;
    if(!Number.isInteger(safety)||Number(safety)<0||Number(safety)>4) throw new Error('Safety tolerance must be an integer from 0 through 4.');
    return {model:FLUX_LTX_ENDPOINTS[operation],requestBody:{prompt:payload.prompt.trim(),video_url:source,safety_tolerance:safety}};
  }
  if (!['flux-3','flux-3-draft'].includes(payload.engineId)||payload.mode!=='ref2v') return undefined;
  const duration=Number(payload.durationOption??payload.durationSec??5);
  const images=payload.referenceImages??payload.inputs?.filter(input=>input.slotId==='reference_image_urls').map(input=>input.url??input.dataUrl);
  const indexes=parseFlux3MaxKeyframeIndexes(extras.keyframe_indexes);
  if(!payload.prompt.trim()||!Number.isSafeInteger(duration)||duration<5||duration>20) throw new Error('Keyframes require a prompt and explicit integer duration from 5 through 20 seconds.');
  if(!images?.length||images.length>10||images.some(url=>!url?.trim())||!indexes||indexes.length!==images.length||new Set(indexes).size!==indexes.length||indexes.some(index=>index>duration*24)) throw new Error('Use 1–10 keyframes with unique indexes from 0 through duration × 24.');
  const draft=payload.engineId==='flux-3-draft',resolution=payload.resolution??'720p';
  if (!(draft?['720p']:['720p','1080p']).includes(resolution)) throw new Error('Unsupported priced keyframe resolution.');
  const safety=extras.safety_tolerance??2;
  if(!Number.isInteger(safety)||Number(safety)<0||Number(safety)>4) throw new Error('Safety tolerance must be an integer from 0 through 4.');
  return {model:`blackforestlabs/flux-3/keyframes-to-video${draft?'/draft':''}`,requestBody:{prompt:payload.prompt.trim(),duration,aspect_ratio:payload.aspectRatio??'auto',generate_audio:payload.audio??true,safety_tolerance:safety,
    ...(!draft?{resolution}:{}),keyframes:images.map((image_url,index)=>({image_url,frame_index:indexes[index]}))}};
}
