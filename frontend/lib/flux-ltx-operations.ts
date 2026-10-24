import type { VideoOperationCaps } from './video-operation';

export const FLUX_LTX_ENDPOINTS = {
  'flux-fast-edit': 'blackforestlabs/flux-3/edit-video',
  'flux-draft-enhance': 'blackforestlabs/flux-3/draft-enhance',
  'ltx23-reframe': 'fal-ai/ltx-2.3/reframe',
} as const;
export type FluxLtxSourceOperation = keyof typeof FLUX_LTX_ENDPOINTS;
export function isFluxLtxSourceOperation(value: unknown): value is FluxLtxSourceOperation {
  return typeof value === 'string' && Object.hasOwn(FLUX_LTX_ENDPOINTS, value);
}
/** Explicit application/customer admission bound, not a provider maximum or invoice rule.
 * Native Draft requests end at 20s; measured outputs up to 21s qualify individually. */
export const FLUX_DRAFT_MEASURED_MAX_SEC = 21;
export const FLUX_FAST_PROMPT_MAX_CHARS = 4096;
export function fluxLtxDurationBounds(operation: FluxLtxSourceOperation) {
  return { min: 0, max: operation === 'flux-fast-edit' ? 15 : operation === 'ltx23-reframe' ? 60 : FLUX_DRAFT_MEASURED_MAX_SEC,
    maxExclusive: operation === 'flux-fast-edit' };
}
export function validateFluxLtxSource(operation: FluxLtxSourceOperation, facts?: {
  durationSec?: number | null; mimeType?: string | null; sizeBytes?: number | null;
}): string | undefined {
  const duration = facts?.durationSec, bounds = fluxLtxDurationBounds(operation);
  if (typeof duration !== 'number' || !Number.isFinite(duration) || duration <= 0 || (bounds.maxExclusive ? duration >= bounds.max : duration > bounds.max)) {
    return `This operation requires verified positive source timing ${bounds.maxExclusive ? 'under' : 'up to'} ${bounds.max} seconds.`;
  }
  if (operation === 'flux-fast-edit' && (facts?.mimeType !== 'video/mp4' || typeof facts.sizeBytes !== 'number'
    || !Number.isSafeInteger(facts.sizeBytes) || facts.sizeBytes <= 0 || facts.sizeBytes >= 50_000_000)) {
    return 'FAST Edit requires an MP4 smaller than 50 MB. Prepare a compatible copy; the original is retained.';
  }
}
export function fluxLtxReferenceRate(operation: FluxLtxSourceOperation, resolution: string): number {
  const rates: Record<string, number> = operation === 'flux-fast-edit' ? {'720p':3}
    : operation === 'flux-draft-enhance' ? {'1080p':29} : {'720p':10,'1080p':20};
  if (!Object.hasOwn(rates,resolution)) throw new Error('Unsupported operation resolution.');
  return rates[resolution]!;
}
export function buildFluxLtxOperationCaps(operation: FluxLtxSourceOperation): VideoOperationCaps {
  const enhance = operation === 'flux-draft-enhance', fast = operation === 'flux-fast-edit';
  const mode: 'v2v' | 'reframe' = operation === 'ltx23-reframe' ? 'reframe' : 'v2v';
  const resolutions = fast ? ['720p'] : enhance ? ['1080p'] : ['720p','1080p'];
  return {operation,mode,label:fast?'FAST Edit':enhance?'Enhance Draft':'Reframe (LTX 2.3)',defaultForMode:true,
    promptRequired:fast,...(fast?{promptMaxChars:FLUX_FAST_PROMPT_MAX_CHARS}:{}),transport:'fal',endpoint:FLUX_LTX_ENDPOINTS[operation],
    inputSchema:{required:[
      ...(fast ? [{id:'prompt',type:'text' as const,label:'Edit instruction',modes:[mode],requiredInModes:[mode]}] : []),
      ...(enhance ? [{id:'source_job_id',type:'text' as const,label:'Owned Draft generation',modes:[mode],requiredInModes:[],description:'Successful owned native Draft with a qualified paired provider cache. Imported videos and Draft Extend caches are not eligible.'}]
        : [{id:'video_url',type:'video' as const,label:'Source video',modes:[mode],requiredInModes:[mode],source:'either' as const,minCount:1,maxCount:1,maxDurationSec:fast?15:60,
          ...(fast ? {maxSizeMB:50,acceptedMimeTypes:['video/mp4'],acceptedFileExtensions:['mp4'],description:'MP4 strictly shorter than 15 seconds and smaller than 50 MB. MOV/HEVC requires a compatible copy.'} : {})}]),
    ],optional:[
      ...(!fast&&!enhance ? [{id:'resolution',type:'enum' as const,label:'Resolution',modes:[mode],values:resolutions,default:'1080p'},
        {id:'aspect_ratio',type:'enum' as const,label:'Aspect ratio',modes:[mode],values:['1:1','4:5','5:4','9:16','16:9'],default:'16:9'},
        {id:'enable_safety_checker',type:'boolean' as const,label:'Safety checker',modes:[mode],default:true}]
        : [{id:'safety_tolerance',type:'number' as const,label:'Safety tolerance',modes:[mode],min:0,max:4,step:1,default:2}]),
    ],constraints:{ownedAssetModes:[mode],...(fast?{videoSizeExclusiveMaxBytes:50_000_000,videoDurationExclusiveMaxSec:15}:{}),...(enhance?{ownedProviderDraftCache:true}: {})}},
    ui:{modes:[mode],durationPolicy:'source_video',resolution:resolutions,resolutionLocked:fast||enhance,audioToggle:false,
      ...(!fast&&!enhance?{aspectRatio:['1:1','4:5','5:4','9:16','16:9']} : {}),
      notes:fast?'FAST quality, 720p. Preserves source timing and framing.':enhance?'Re-renders the same paired Draft motion at 1080p with synchronized audio. Earlier Draft charge remains separate.':'Reframe up to 60 seconds with LTX 2.3; retains source timing.'}};
}
