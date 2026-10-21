import {z} from 'zod';
import {studioShotPlanSchema} from '@/lib/studio/conversation-media-contract';
/** Client-authored direction only. Every revision still creates a fresh owned quote. */
export const studioShotPlanRevisionSchema=z.object({
  modelId:z.literal('kling-v4'),mode:z.enum(['t2v','i2v','ref2v']),durationSec:z.number().int().min(3).max(30),shots:studioShotPlanSchema,
}).strict().superRefine((revision,context)=>{
  if(revision.shots.reduce((sum,shot)=>sum+shot.durationSec,0)!==revision.durationSec)
    context.addIssue({code:z.ZodIssueCode.custom,path:['durationSec'],message:'The shot durations must equal the requested total.'});
});
export type StudioShotPlanRevision=z.infer<typeof studioShotPlanRevisionSchema>;
