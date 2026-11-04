import {z} from 'zod';
import {toolAssetRefSchema} from '@/lib/toolbox/contract';
import {STUDIO_ANALYSIS_LIMITS} from '@/lib/studio/media-analysis-contract';

export const promptReferenceLocationSchema=z.object({
  fieldId:z.string().regex(/^[a-zA-Z][a-zA-Z0-9_]*$/).max(80),
  slot:z.number().int().min(0).max(99),
}).strict();
const interval={modality:z.enum(['visual','audio']),startSec:z.number().finite().min(0).max(86400),endSec:z.number().finite().positive().max(86400).optional()};
/** A suggestion only. The server supplies the owned identity; preparation and confirmation remain explicit. */
export const promptAnalysisRequestSchema=promptReferenceLocationSchema.extend({...interval,ref:toolAssetRefSchema}).strict().superRefine((request,context)=>{
  if(request.ref.kind==='image'||request.modality==='visual'&&request.ref.kind!=='video')context.addIssue({code:z.ZodIssueCode.custom,path:['ref'],message:'Select video frames or sound from video/audio.'});
  const limit=request.modality==='audio'?STUDIO_ANALYSIS_LIMITS.audioSeconds:STUDIO_ANALYSIS_LIMITS.videoSeconds;
  if(request.endSec!==undefined&&(request.endSec<=request.startSec||request.endSec-request.startSec>limit))context.addIssue({code:z.ZodIssueCode.custom,path:['endSec'],message:'Select a positive bounded analysis interval.'});
});
export type PromptAnalysisRequest=z.infer<typeof promptAnalysisRequestSchema>;

/** A swapped reference in the same composer slot must never inherit an earlier recommendation. */
export function isCurrentPromptAnalysisRequest(action:PromptAnalysisRequest,references:ReadonlyArray<{fieldId:string;slot:number;ref:unknown}>) {
  const current=toolAssetRefSchema.safeParse(references.find(item=>item.fieldId===action.fieldId&&item.slot===action.slot)?.ref);
  if(!current.success||current.data.kind!==action.ref.kind||current.data.type!==action.ref.type)return false;
  return current.data.type==='asset'&&action.ref.type==='asset'?current.data.assetId===action.ref.assetId
    :current.data.type==='job-output'&&action.ref.type==='job-output'&&current.data.jobId===action.ref.jobId&&current.data.outputId===action.ref.outputId;
}
