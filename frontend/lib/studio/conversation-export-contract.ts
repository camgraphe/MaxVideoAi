import {z} from 'zod';
import type {TimelineExportBillingStatus,TimelineExportStatus} from '@/server/timeline-exports/contracts';

const id=z.string().trim().min(1).max(128).regex(/^[a-zA-Z0-9._:-]+$/);
export const studioExportPreparationSchema=z.object({
  projectId:id,sequenceId:id,expectedRevision:z.number().int().nonnegative(),
  idempotencyKey:id,qualityPreset:z.enum(['draft','standard','high']),includeAudio:z.boolean(),
}).strict();
export const studioExportConfirmationSchema=z.object({projectId:id,quoteId:z.string().uuid(),confirmed:z.literal(true)}).strict();
export const studioExportReadSchema=z.object({projectId:id,quoteId:z.string().uuid()}).strict();
export const studioPreparedExportSchema=z.object({
  quoteId:z.string().uuid(),exportId:z.string().regex(/^tlx_[a-f0-9]{64}$/),projectId:id,sequenceId:id,
  revision:z.number().int().nonnegative(),durationSec:z.number().finite().positive(),
  resolution:z.string(),aspectRatio:z.string(),fps:z.number().int().positive(),
  qualityPreset:z.enum(['draft','standard','high']),includeAudio:z.boolean(),
  price:z.object({amountCents:z.number().int().nonnegative(),currency:z.literal('USD'),billingKind:z.enum(['free','paid'])}).strict(),
  expiresAt:z.string().datetime(),confirmationRequired:z.literal(true),
}).strict();
export type StudioPreparedExport=z.infer<typeof studioPreparedExportSchema>;
/** Read-only render evidence for the director; no source, artifact or submission secrets. */
export type StudioConversationRender = {
  id:string;sequenceId:string;status:TimelineExportStatus;progress:number;message:string|null;
  createdAt:string;updatedAt:string;startedAt:string|null;completedAt:string|null;failedAt:string|null;
  durationSec:number;resolution:string|null;aspectRatio:string|null;fps:number|null;qualityPreset:string;
  includeAudio:boolean|null;artifactAvailable:boolean;billingStatus:TimelineExportBillingStatus;
  billing?:{amountCents:number;currency:string;billingKind:'free'|'paid'};
};
/** A confirmation reply must identify a real saved job before clearing a pending attempt. */
export const studioExportAcknowledgementSchema = z.object({
  ok: z.literal(true),
  result: z.object({
    ok: z.literal(true),
    reused: z.boolean(),
    export: z.object({
      id: studioPreparedExportSchema.shape.exportId,
      status: z.enum(['queued', 'rendering', 'completed', 'failed', 'canceled']),
      progress: z.number().finite().min(0).max(100),
      message: z.string().nullable(),
      artifact: z.object({
        outputUrl: z.string(),
        canonicalOriginalUrl: z.string().optional(),
        outputAssetId: z.string().nullable(),
        sizeBytes: z.number().finite().nonnegative().nullable(),
        mimeType: z.string().nullable(),
      }).nullable(),
      billing: studioPreparedExportSchema.shape.price.optional(),
    }),
  }),
});
export const studioExportPrepareActionSchema=z.object({
  action:z.literal('export.prepare'),reply:z.string().min(1).max(2400),
  sequenceId:id,expectedRevision:studioExportPreparationSchema.shape.expectedRevision,
  qualityPreset:studioExportPreparationSchema.shape.qualityPreset,includeAudio:z.boolean(),
}).strict();
const exportReadSelection={quoteId:z.string().uuid().nullish(),exportId:studioPreparedExportSchema.shape.exportId.nullish()};
export const studioConversationExportReadSchema=z.object({projectId:id,...exportReadSelection}).strict().refine(value=>!!value.quoteId!==!!value.exportId,'Choose one quoteId or exportId.');
export const studioExportReadActionSchema=z.object({action:z.literal('export.read'),...exportReadSelection}).strict();
export const STUDIO_EXPORT_DIRECTOR_TOOLS=[
  {action:'export.prepare',name:'export_prepare',description:'Prepare an exact non-spending MP4 quote for the owned saved sequence/revision read from timeline_read. Choose draft, standard or high and whether to include audio. Ends this turn: explain that the client reviews and confirms the quote in the chat. Does not export or charge.',properties:{reply:{type:'string'},sequenceId:{type:'string'},expectedRevision:{type:'integer',minimum:0},qualityPreset:{type:'string',enum:['draft','standard','high']},includeAudio:{type:'boolean'}}},
  {action:'export.read',name:'export_read',description:'Inspect an owned project render, including manual exports, by exportId from project_read renders; set quoteId null. An older export quoteId also works with exportId null. Choose exactly one ID. Returns recorded status, timing and billing without media URLs. Never starts, confirms or retries an export.',properties:{quoteId:{type:['string','null']},exportId:{type:['string','null']}}},
] as const;
