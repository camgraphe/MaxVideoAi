import {z} from 'zod';
import {toolAssetRefSchema} from '@/lib/toolbox/contract';
import {studioAssistantModelSchema,type StudioAssistanceStatus,type AssistanceNextAction} from '@/lib/studio/assistance-contract';

const setting = z.union([z.string().max(5000),z.number().finite(),z.boolean(),z.null()]);
export const promptAssistanceDraftSchema = z.object({
  surface:z.enum(['video','image','audio']), engineId:z.string().min(1).max(100), mode:z.string().min(1).max(60),
  target:z.enum(['prompt','script','lyrics']), text:z.string().max(50000),
  settings:z.record(z.string().regex(/^[a-zA-Z][a-zA-Z0-9_]*$/).max(80),setting).refine(value=>Object.keys(value).length<=60),
  readOnlyText:z.object({negativePrompt:z.string().max(5000).optional(),lyrics:z.string().max(3500).optional()}).strict().optional(),
  references:z.array(z.object({fieldId:z.string().regex(/^[a-zA-Z][a-zA-Z0-9_]*$/).max(80),slot:z.number().int().min(0).max(99),label:z.string().max(40),ref:toolAssetRefSchema.nullable()}).strict()).max(60),
}).strict();
export const promptAssistanceRequestSchema = z.object({
  sessionId:z.string().uuid(),requestId:z.string().uuid(),draftRevision:z.number().int().nonnegative(),
  assistanceModel:studioAssistantModelSchema.optional(),assistanceRevision:z.number().int().nonnegative().optional(),
  locale:z.enum(['en','fr','es']),message:z.string().trim().min(1).max(8000),draft:promptAssistanceDraftSchema,
  activeSuggestion:z.string().trim().min(1).max(50000).optional(),
}).strict().refine(value=>(value.assistanceModel===undefined)===(value.assistanceRevision===undefined),'Model and assistance revision must be provided together.');
export type PromptAssistanceDraftContext = Omit<z.infer<typeof promptAssistanceDraftSchema>,'text'|'target'>;
export type PromptAssistanceRequest = z.infer<typeof promptAssistanceRequestSchema>;
export const promptAssistanceReplySchema = z.object({reply:z.string().trim().min(1).max(6000),text:z.string().trim().min(1).max(50000).nullable()}).strict();
export type PromptAssistanceReply = z.infer<typeof promptAssistanceReplySchema>;
export type PromptAssistanceResult = {
  sessionId:string;requestId:string;draftRevision:number;target:PromptAssistanceRequest['draft']['target'];message:string;
  state:'pending'|'unknown'|'complete'|'failed'; reply?:PromptAssistanceReply; error?:string;
  assistance:StudioAssistanceStatus; safeToRetry?:boolean; nextAction?:AssistanceNextAction;
};
export const PROMPT_ASSISTANCE_LIVE = process.env.NEXT_PUBLIC_PROMPT_ASSISTANCE_LIVE === '1';
