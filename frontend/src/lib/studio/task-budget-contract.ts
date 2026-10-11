import {z} from 'zod';
import type {StudioAssistantModel} from './assistance-contract';

export const STUDIO_TASK_LEGACY_POLICY_VERSION='studio-task-budget-2026-10-06-v1';
export const STUDIO_TASK_POLICY_VERSION='studio-task-budget-2026-10-11-v2';
const policyVersion=z.enum([STUDIO_TASK_LEGACY_POLICY_VERSION,STUDIO_TASK_POLICY_VERSION]);
export type StudioTaskPolicyVersion=z.infer<typeof policyVersion>;
export const STUDIO_TASK_MAX_CALLS=24;
export const STUDIO_TASK_MAX_CREDITS=2000;
export const STUDIO_TASK_PROFILES={
  quick:{maxCredits:100,maxCalls:2,maxOutputTokens:2200,maxInputTokens:12000,deadlineSec:180,historyTurns:4,reasoning:'low' as const},
  standard:{maxCredits:250,maxCalls:4,maxOutputTokens:2200,maxInputTokens:24000,deadlineSec:300,historyTurns:8,reasoning:'medium' as const},
  complex:{maxCredits:500,maxCalls:8,maxOutputTokens:6000,maxInputTokens:48000,deadlineSec:600,historyTurns:12,reasoning:'high' as const},
} as const;
export const studioTaskProfileSchema=z.enum(['quick','standard','complex']);
const credits=z.number().int().min(0).max(STUDIO_TASK_MAX_CREDITS).multipleOf(10);
export const studioTaskSelectionSchema=z.object({profile:studioTaskProfileSchema,maxCredits:credits,policyVersion,confirmedComplex:z.literal(true).optional(),model:z.enum(['gpt-6.1-sol','gpt-6-luna']).optional(),assistanceRevision:z.number().int().nonnegative().optional()}).strict().superRefine((value,ctx)=>{
  if(value.maxCredits!==STUDIO_TASK_PROFILES[value.profile].maxCredits)ctx.addIssue({code:'custom',message:'Review the exact profile ceiling.'});
  if(value.profile==='complex'&&!value.confirmedComplex)ctx.addIssue({code:'custom',message:'Confirm the complex Sol ceiling before sending.'});
});
export type StudioTaskSelection=z.infer<typeof studioTaskSelectionSchema>;
export type StudioTaskProfile=keyof typeof STUDIO_TASK_PROFILES;
export function studioTaskProfileForModel(selection:StudioTaskSelection,model:StudioAssistantModel) {
  const reviewed=studioTaskSelectionSchema.parse(selection);
  if(reviewed.profile==='complex'&&model!=='gpt-6.1-sol')throw new Error('Select Sol before confirming a complex task.');
  const profile=STUDIO_TASK_PROFILES[reviewed.profile];
  return model==='gpt-6-luna'&&reviewed.policyVersion===STUDIO_TASK_POLICY_VERSION
    ? {...profile,reasoning:'high' as const,maxOutputTokens:6000 as const}
    : profile;
}
export type StudioTaskResourceProfile=ReturnType<typeof studioTaskProfileForModel>;
export const studioTaskResumeSchema=z.object({requestId:z.string().uuid(),approvalId:z.string().uuid(),expectedRevision:z.number().int().nonnegative(),action:z.enum(['continue','extend']),maxCredits:credits,policyVersion,confirmed:z.literal(true)}).strict();
export const studioTaskMaintenanceSchema=z.object({requestId:z.string().uuid(),expectedRevision:z.number().int().nonnegative(),action:z.enum(['recover','cancel']),policyVersion,confirmed:z.literal(true)}).strict();
export type StudioTaskResume=z.infer<typeof studioTaskResumeSchema>;
export const studioTaskStatusSchema=z.object({
  requestId:z.string().uuid(),profile:studioTaskProfileSchema,policyVersion,model:z.enum(['gpt-6.1-sol','gpt-6-luna']),
  state:z.enum(['queued','running','paused','completed','failed','unknown']),phase:z.enum(['queued','thinking','reading','preparing','editing','recovering','done','paused','unknown']),
  maxCredits:credits,consumedCredits:credits,reservedCredits:credits,
  completedCalls:z.number().int().min(0).max(STUDIO_TASK_MAX_CALLS),allowedCalls:z.number().int().min(1).max(STUDIO_TASK_MAX_CALLS),revision:z.number().int().nonnegative(),canContinue:z.boolean(),
  error:z.enum(['budget','steps','output','deadline','context','funding','provider','usage','permission','unavailable','cancelled','closed']).nullable().optional(),
}).strict();
export type StudioTaskStatus=z.infer<typeof studioTaskStatusSchema>;
