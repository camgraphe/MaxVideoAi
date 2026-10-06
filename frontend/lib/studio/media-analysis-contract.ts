import {z} from 'zod';
import {toolAssetRefSchema} from '@/lib/toolbox/contract';
import type {StudioAssistantModel} from '@/lib/studio/assistance-contract';

export const STUDIO_ANALYSIS_LIMITS={videoSeconds:60,audioSeconds:30,frames:12,sourceBytes:100*1024*1024,decodeMs:60_000} as const;
export function studioAnalysisCapabilities(model:StudioAssistantModel,available:{video:boolean;audio:boolean}) {
  return {imageVision:true,simpleEditing:true,videoAnalysis:model==='gpt-6.1-sol'&&available.video,audioAnalysis:model==='gpt-6.1-sol'&&available.audio};
}
export const studioAnalysisPrepareBaseSchema=z.object({
  ref:toolAssetRefSchema.refine(ref=>ref.kind==='video'||ref.kind==='audio','Select video or audio.'),
  goal:z.string().trim().min(1).max(1000),
  reason:z.enum(['requested','required_for_request']),
  startSec:z.number().finite().min(0).max(86_400),
  endSec:z.number().finite().positive().max(86_400),
}).strict();
export const studioAnalysisPrepareSchema=studioAnalysisPrepareBaseSchema.superRefine((input,context)=>{
  const limit=input.ref.kind==='audio'?STUDIO_ANALYSIS_LIMITS.audioSeconds:STUDIO_ANALYSIS_LIMITS.videoSeconds;
  if(input.endSec<=input.startSec||input.endSec-input.startSec>limit)context.addIssue({code:z.ZodIssueCode.custom,path:['endSec'],message:`Select a positive interval of at most ${limit} seconds.`});
});
export type StudioAnalysisRequest=z.infer<typeof studioAnalysisPrepareSchema>;
export const studioAnalysisConfirmSchema=z.object({analysisId:z.string().uuid(),maxCredits:z.number().int().positive().max(100_000),policyVersion:z.string().min(1).max(128),confirmed:z.literal(true)}).strict();
const safeText=(max:number)=>z.string().trim().min(1).max(max).refine(value=>!/(?:https?:\/\/|data:|[?&](?:token|signature|credential)=)/i.test(value),'Private URLs are not observation text.');
export const studioAnalysisResultSchema=z.object({
  summary:safeText(2400),
  observations:z.array(z.object({startSec:z.number().finite().nonnegative(),endSec:z.number().finite().nonnegative(),text:safeText(800),kind:z.enum(['observed','inferred'])}).strict().refine(value=>value.endSec>=value.startSec)).max(24),
  coverage:z.object({startSec:z.number().finite().nonnegative(),endSec:z.number().finite().positive(),sampledAtSec:z.array(z.number().finite().nonnegative()).max(12),complete:z.literal(false)}).strict(),
}).strict();
export type StudioAnalysisResult=z.infer<typeof studioAnalysisResultSchema>;
export const studioPreparedAnalysisSchema=z.object({
  analysisId:z.string().uuid(),ref:toolAssetRefSchema,goal:z.string().min(1).max(1000),reason:z.enum(['requested','required_for_request']),
  startSec:z.number().nonnegative(),endSec:z.number().positive(),maxCredits:z.number().int().positive(),policyVersion:z.string(),expiresAt:z.string().datetime(),
  profile:z.enum(['video-frames-v1','audio-window-v1']),model:z.literal('gpt-6.1-sol'),confirmationRequired:z.literal(true),
}).strict();
export type StudioPreparedAnalysis=z.infer<typeof studioPreparedAnalysisSchema>;
export const studioAnalysisStatusSchema=z.object({quote:studioPreparedAnalysisSchema,state:z.enum(['prepared','queued','running','completed','failed','unknown']),result:studioAnalysisResultSchema.nullable(),chargedCredits:z.number().int().nonnegative().nullable(),error:z.string().nullable()}).strict();
export type StudioAnalysisStatus=z.infer<typeof studioAnalysisStatusSchema>;
export const studioAnalysisPrepareActionSchema=studioAnalysisPrepareBaseSchema.extend({action:z.literal('analysis.prepare'),reply:z.string().min(1).max(2400)}).strict();
export const studioAnalysisReadActionSchema=z.object({action:z.literal('analysis.read'),analysisId:z.string().uuid()}).strict();
const variant=(properties:Record<string,unknown>)=>({type:'object',additionalProperties:false,properties,required:Object.keys(properties)});
const reference={anyOf:(['video','audio'] as const).flatMap(kind=>[
  variant({type:{type:'string',enum:['asset']},assetId:{type:'string'},kind:{type:'string',enum:[kind]}}),
  variant({type:{type:'string',enum:['job-output']},jobId:{type:'string'},outputId:{type:'string'},kind:{type:'string',enum:[kind]}}),
])};
export const STUDIO_ANALYSIS_DIRECTOR_TOOLS=[
  {action:'analysis.prepare',name:'analysis_prepare',description:'Prepare a bounded content analysis quote only when requested or necessary for unfinished requested work. No analysis, provider call or credit reservation. Luna may prepare this handoff; the client explicitly selects Sol and approves the ceiling. Use exact attached video/audio or ready project output. Never call on generation completion or for an unsolicited review. Success ends the turn with a review card.',properties:{ref:reference,goal:{type:'string'},reason:{type:'string',enum:['requested','required_for_request']},startSec:{type:'number',minimum:0},endSec:{type:'number',exclusiveMinimum:0},reply:{type:'string'}}},
  {action:'analysis.read',name:'analysis_read',description:'Read this project’s exact saved analysis status and timestamped observations, including on Luna. Does not start, retry, extend or charge an analysis. Sparse coverage and approximate timing are not full inspection or exact beats.',properties:{analysisId:{type:'string'}}},
] as const;
