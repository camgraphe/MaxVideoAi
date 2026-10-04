import * as z from 'zod/v4';
import {studioExportPreparationSchema,studioExportConfirmationSchema,studioExportReadSchema,type StudioPreparedExport} from '@/lib/studio/conversation-export-contract';
import {prepareStudioTimelineExport,confirmStudioTimelineExport,readStudioTimelineExport,asStudioExportAgentError,type StudioExportDependencies} from '@/server/studio/conversation-export-command';
import {canonicalTimelineExportMediaUrl,createTimelineExportReadUrl} from '@/server/timeline-exports/media-security';
import type {TimelineExportJobResponse} from '@/server/timeline-exports/contracts';
import {requireOAuthGenerationActor} from './generation-actor';
import {AgentApiError} from './errors';
import type {AgentPrincipal} from './principal';

const identifier = z.string().trim().min(1).max(128).regex(/^[a-zA-Z0-9._:-]+$/u);
const qualityPreset = z.enum(['draft','standard','high']);
export const prepareStudioExportInputSchema = z.object({projectId:identifier,sequenceId:identifier,expectedRevision:z.number().int().nonnegative(),idempotencyKey:identifier,qualityPreset,includeAudio:z.boolean()}).strict();
export const confirmStudioExportInputSchema = z.object({projectId:identifier,quoteId:z.string().uuid(),confirmed:z.literal(true)}).strict();
export const getStudioExportInputSchema = z.object({projectId:identifier,quoteId:z.string().uuid()}).strict();
export type PrepareAgentStudioExportInput = z.infer<typeof prepareStudioExportInputSchema>;
export type ConfirmAgentStudioExportInput = z.infer<typeof confirmStudioExportInputSchema>;
export type GetAgentStudioExportInput = z.infer<typeof getStudioExportInputSchema>;

const money = z.object({amountCents:z.number().int().nonnegative(),currency:z.string().regex(/^[A-Z]{3}$/u),billingKind:z.enum(['free','paid'])}).strict();
export const preparedStudioExportOutputSchema = z.object({
  quoteId:z.string().uuid(),exportId:z.string().regex(/^tlx_[a-f0-9]{64}$/u),projectId:identifier,sequenceId:identifier,
  revision:z.number().int().nonnegative(),durationSec:z.number().positive(),resolution:z.string(),aspectRatio:z.string(),fps:z.number().int().positive(),qualityPreset,includeAudio:z.boolean(),
  price:z.object({amountCents:z.number().int().nonnegative(),currency:z.literal('USD'),billingKind:z.enum(['free','paid'])}).strict(),expiresAt:z.string().datetime(),confirmationRequired:z.literal(true),
}).strict();
export const agentStudioExportJobSchema = z.object({
  id:z.string().min(1),status:z.enum(['queued','rendering','completed','failed','canceled']),progress:z.number(),message:z.string().nullable(),billing:money.optional(),
  artifact:z.object({outputUrl:z.string().url(),outputAssetId:z.string().nullable(),sizeBytes:z.number().nullable(),mimeType:z.string().nullable()}).strict().nullable(),
  artifactDelivery:z.literal('unavailable').optional(),
}).strict();
export const confirmStudioExportOutputSchema = z.object({ok:z.literal(true),export:agentStudioExportJobSchema,reused:z.boolean()}).strict();
export const getStudioExportOutputSchema = z.object({quoteId:z.string().uuid(),export:agentStudioExportJobSchema.nullable()}).strict();
export type AgentStudioExportJob = z.infer<typeof agentStudioExportJobSchema>;
export type AgentStudioExportConfirmation = z.infer<typeof confirmStudioExportOutputSchema>;
export type AgentStudioExportObservation = z.infer<typeof getStudioExportOutputSchema>;
export type AgentStudioExportDependencies = StudioExportDependencies & {readGrant?:typeof createTimelineExportReadUrl};

/** Transient OAuth-host delivery only. Canonical originals, grants and worker fields never enter a saved receipt. */
export async function projectAgentStudioExportJob(job:TimelineExportJobResponse,userId:string,dependencies:Pick<AgentStudioExportDependencies,'requestOrigin'|'readGrant'>):Promise<AgentStudioExportJob>{
  const result = {id:job.id,status:job.status,progress:job.progress,message:job.message,...(job.billing?{billing:{...job.billing}}:{}),artifact:null};
  if(job.status!=='completed')return result;
  if(!job.artifact)return job.status==='completed'?{...result,artifactDelivery:'unavailable'}:result;
  try{
    const source = job.artifact.canonicalOriginalUrl??job.artifact.outputUrl;
    const canonical = canonicalTimelineExportMediaUrl({url:source,userId,requestOrigin:dependencies.requestOrigin});
    // This authenticated Studio route cannot deliver bytes to a remote OAuth host.
    if(new URL(canonical).pathname.startsWith('/api/studio/timeline-exports/'))throw new Error('EXPORT_MEDIA_UNAVAILABLE');
    const outputUrl = await (dependencies.readGrant??createTimelineExportReadUrl)({url:canonical,userId,requestOrigin:dependencies.requestOrigin,method:'GET',expiresInSeconds:300});
    if(!/^https?:\/\//u.test(outputUrl))throw new Error('EXPORT_MEDIA_UNAVAILABLE');
    return {...result,artifact:{outputUrl,outputAssetId:job.artifact.outputAssetId,sizeBytes:job.artifact.sizeBytes,mimeType:job.artifact.mimeType}};
  }catch{return {...result,artifactDelivery:'unavailable'};}
}

/** Thin OAuth adapter; canonical export owners retain snapshot, quote, authorization, billing and recovery. */
export function createAgentStudioExportService(dependencies:AgentStudioExportDependencies){
  function actor(principal:AgentPrincipal){
    requireOAuthGenerationActor(principal);
    if(!principal.clientId)throw new AgentApiError('AUTH_REQUIRED','Connect MaxVideoAI before using Studio exports.');
    if(!dependencies.enabled)throw new AgentApiError('ENGINE_UNAVAILABLE','Studio export is not available in this environment.');
    return {userId:principal.userId,authOrigin:'oauth' as const,clientId:principal.clientId};
  }
  return {
    async prepare(rawInput:PrepareAgentStudioExportInput,principal:AgentPrincipal):Promise<StudioPreparedExport>{
      const currentActor = actor(principal);
      const input = studioExportPreparationSchema.safeParse(rawInput);
      if(!input.success)throw new AgentApiError('PARAMETER_INVALID','Provide the saved project, sequence, revision, quality, audio choice and an idempotencyKey.');
      try{return await prepareStudioTimelineExport(currentActor,input.data,dependencies);}
      catch(error){throw asStudioExportAgentError(error);}
    },
    async confirm(rawInput:ConfirmAgentStudioExportInput,principal:AgentPrincipal):Promise<AgentStudioExportConfirmation>{
      const currentActor = actor(principal);
      const input = studioExportConfirmationSchema.safeParse(rawInput);
      if(!input.success)throw new AgentApiError('CONFIRMATION_REQUIRED','Confirm the exact scoped export quote before starting a render.');
      try{
        const result = await confirmStudioTimelineExport(currentActor,input.data,dependencies);
        return {ok:true,export:await projectAgentStudioExportJob(result.export,currentActor.userId,dependencies),reused:result.reused};
      }catch(error){throw asStudioExportAgentError(error);}
    },
    async read(rawInput:GetAgentStudioExportInput,principal:AgentPrincipal):Promise<AgentStudioExportObservation>{
      const currentActor = actor(principal);
      const input = studioExportReadSchema.safeParse(rawInput);
      if(!input.success)throw new AgentApiError('PARAMETER_INVALID','Provide the owned project and exact export quoteId.');
      try{
        const job = await readStudioTimelineExport(currentActor,input.data,dependencies);
        return {quoteId:input.data.quoteId,export:job?await projectAgentStudioExportJob(job,currentActor.userId,dependencies):null};
      }catch(error){throw asStudioExportAgentError(error);}
    },
  };
}
