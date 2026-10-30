import {z} from 'zod';
import {promptAssistanceDraftSchema} from './contract';
import {studioAnalysisConfirmSchema} from '@/lib/studio/media-analysis-contract';
export const promptAnalysisPrepareSchema=z.object({
  action:z.literal('prepare'),sessionId:z.string().uuid(),requestId:z.string().uuid(),draft:promptAssistanceDraftSchema,
  fieldId:z.string().max(80),slot:z.number().int().min(0).max(99),modality:z.enum(['visual','audio']),
  startSec:z.number().finite().min(0).max(86400).default(0),endSec:z.number().finite().positive().max(86400).optional(),
}).strict();
export const promptAnalysisActionSchema=z.discriminatedUnion('action',[
  promptAnalysisPrepareSchema,
  z.object({action:z.literal('confirm'),sessionId:z.string().uuid(),confirmation:studioAnalysisConfirmSchema}).strict(),
]);
export const PROMPT_REFERENCE_PERCEPTION=process.env.NEXT_PUBLIC_PROMPT_ASSISTANCE_PERCEPTION==='1';
