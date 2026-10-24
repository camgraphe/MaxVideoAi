import type { EngineCaps, EngineInputField } from '../../../types/engines';
import { buildFluxLtxOperationCaps } from '../../../lib/flux-ltx-operations';
import { FLUX_3_ASPECT_RATIOS, FLUX_3_EXPLICIT_DURATIONS } from './flux-3-shared';

export function withFlux3Coverage(base: EngineCaps): EngineCaps {
  const draft=base.id==='flux-3-draft';
  const operation=buildFluxLtxOperationCaps(draft?'flux-draft-enhance':'flux-fast-edit');
  const keyframes: EngineInputField[]=[
    {id:'prompt',type:'text',label:'Prompt',modes:['ref2v'],requiredInModes:['ref2v']},
    {id:'reference_image_urls',type:'image',label:'Ordered keyframe images',modes:['ref2v'],requiredInModes:['ref2v'],source:'either',minCount:1,maxCount:10},
    {id:'keyframe_indexes',type:'text',label:'Keyframe positions',modes:['ref2v'],requiredInModes:['ref2v'],description:'Unique integer frame positions, in image order, from 0 through duration × 24 inclusive.'},
  ];
  const optional: EngineInputField[]=[
    {id:'duration',type:'enum',label:'Duration',modes:['ref2v'],values:FLUX_3_EXPLICIT_DURATIONS,default:'5'},
    {id:'aspect_ratio',type:'enum',label:'Aspect ratio',modes:['ref2v'],values:[...FLUX_3_ASPECT_RATIOS],default:'auto'},
    {id:'generate_audio',type:'boolean',label:'Generate audio',modes:['ref2v'],default:true},
    {id:'safety_tolerance',type:'number',label:'Safety tolerance',modes:['ref2v'],min:0,max:4,step:1,default:2},
    ...(!draft?[{id:'resolution',type:'enum' as const,label:'Resolution',modes:['ref2v' as const],values:['720p','1080p'],default:'720p'}]:[]),
  ];
  return {...base,modes:[...base.modes,'ref2v','v2v'],keyframes:true,
    inputSchema:{...base.inputSchema!,required:[...(base.inputSchema!.required??[]),...keyframes],optional:[...(base.inputSchema!.optional??[]),...optional]},
    operationCaps:{[operation.operation]:operation},
    modeCaps:{...base.modeCaps,v2v:operation.ui,ref2v:{modes:['ref2v'],duration:{options:FLUX_3_EXPLICIT_DURATIONS,default:'5'},resolution:draft?['720p']:['720p','1080p'],resolutionLocked:draft,aspectRatio:[...FLUX_3_ASPECT_RATIOS],audioToggle:true,notes:'1–10 ordered keyframes with unique frame indexes, bounded by duration × 24.'}}};
}
