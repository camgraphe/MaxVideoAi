import { z } from 'zod';
import { type QueryExecutor } from '@/lib/db';
import { creatorOperationInputSchema } from '@/lib/toolbox/creator-tools';
import { requireGenerationActor, studioReferenceFingerprint, type GenerationActor } from '@/server/agent-api/generation-actor';
import { hashCanonicalGenerationRequest } from '@/server/agent-api/generation-normalization';
import { resolveOwnedReferenceAssetForActor } from '@/server/agent-api/reference-assets';
import { AgentApiError } from '@/server/agent-api/errors';
import { resolveStudioMedia } from '@/server/studio/media-resolver';
import { createCreatorGenerationService, type CreatorGenerationOptions } from './creator-generation-service';
import { prepareCreatorOperation, revalidateCreatorSources, creatorSourceFingerprint } from './creator-sources';
import { CREATOR_PROFILES, prepareCreatorProfile } from './creator-profiles';
import { finalizeCreatorOperation, CreatorFinalizationError } from './creator-finalize';
import * as store from './creator-operations-store';
import { prepareCreatorSpecialistQuote,confirmCreatorSpecialist } from './creator-operations-specialist';
import { refreshCreatorSpecialist } from './creator-operations-specialist-provider';
export { creatorOperationInputSchema, prepareCreatorOperation };

const defaults={prepare:prepareCreatorOperation,revalidate:revalidateCreatorSources,finalize:finalizeCreatorOperation,generation:createCreatorGenerationService,
  read:store.readCreatorOperation,insert:store.insertCreatorOperation,claim:store.claimCreatorFinalization,settle:store.settleCreatorFinalization,markRunning:store.markCreatorRunning,markFailed:store.markCreatorFailed};
export type CreatorOperationsOptions={enabled:boolean;generationOptions?:Omit<CreatorGenerationOptions,'enabled'|'expectedReferenceFingerprint'|'onQuotePrepared'|'onQuoteLocked'>;dependencies?:Partial<typeof defaults>};
function validateSnapshot(row:store.StoredCreatorOperation):void {
  const profile=CREATOR_PROFILES.find(entry=>entry.id===row.profile_id);
  if(!profile||profile.qualification==='closed'||profile.revision!==row.profile_revision||row.snapshot.profile.id!==profile.id) throw new AgentApiError('ENGINE_UNAVAILABLE','This tool profile requires a new qualification.');
  const validated=prepareCreatorProfile(creatorOperationInputSchema.parse(row.snapshot.input),row.snapshot.sources);
  if(hashCanonicalGenerationRequest(validated.request)!==row.request_hash) throw new AgentApiError('QUOTE_EXPIRED','The operation profile changed. Prepare a new quote.');
}
export function createCreatorOperationsService(actor:GenerationActor,options:CreatorOperationsOptions) {
  requireGenerationActor(actor);
  const deps={...defaults,...options.dependencies};
  const idSchema=z.string().uuid();
  const service=(extra:Partial<CreatorGenerationOptions>={})=>deps.generation(actor,{...options.generationOptions,enabled:options.enabled,...extra});
  async function status(operationId:string) {
    let row=await deps.read(actor,idSchema.parse(operationId));
    // The immutable operation remains completed after a delivered media asset is removed.
    // Presentation resolves delivery access separately and can report an unavailable artifact.
    if(row.status==='completed') return store.creatorOperationView(row);
    if(row.status==='failed') return store.creatorOperationView(row);
    if(!row.job_id) {
      if(['failed','expired'].includes(row.quote_state)) {await deps.markFailed(actor,row.id,'The quote is no longer available. Prepare a new quote.');row=await deps.read(actor,row.id);}
      return store.creatorOperationView(row);
    }
    if(row.snapshot.profile.qualification==='tool-specific') {
      await refreshCreatorSpecialist(actor,row);
      row=await deps.read(actor,row.id);
      if(row.status==='failed')return store.creatorOperationView(row);
    }
    if(!row.job_id) throw new Error('The operation job is unavailable.');
    const generation=await service().status(row.job_id);
    if(!generation) throw new Error('The original generation is unavailable.');
    if(generation.status==='failed') {await deps.markFailed(actor,row.id,'Generation failed. Check the original job for payment recovery.');return store.creatorOperationView(await deps.read(actor,row.id));}
    if(generation.status!=='completed') return {...store.creatorOperationView(row),status:'running' as const,retryAfterSeconds:5};
    const lease=await deps.claim(actor,row.id);
    if(lease) {
      let result:Awaited<ReturnType<typeof deps.finalize>>;
      try {
        result=await deps.finalize(actor.userId,row.job_id,row.snapshot);
      } catch(error) {
        const permanent=error instanceof CreatorFinalizationError||row.finalize_attempts>=4;
        await deps.settle(actor,row.id,lease,{permanent,error:error instanceof CreatorFinalizationError?error.message:permanent?'Finalization could not complete. The original generation remains available in your library.':'Finalization will retry. The original generation is preserved.'});
        return store.creatorOperationView(await deps.read(actor,row.id));
      }
      // Publication succeeded. A database error here preserves the lease for recovery and cannot request a refund.
      await deps.settle(actor,row.id,lease,{result});
    }
    return store.creatorOperationView(await deps.read(actor,row.id));
  }
  return {
    async prepare(value:unknown) {
      if(!options.enabled) throw new AgentApiError('ENGINE_UNAVAILABLE','This tool is currently unavailable.');
      const prepared=await deps.prepare(value,actor.userId);
      const references=[];
      for(const ref of prepared.request.references) {
        if(ref.kind!=='asset') throw new Error('Owned references are required.');
        references.push({...await resolveOwnedReferenceAssetForActor(actor,ref.assetId),role:ref.role,...(ref.slot===undefined?{}:{slot:ref.slot})});
      }
      const snapshot={...prepared,referenceFingerprint:studioReferenceFingerprint(references)};
      const quote=prepared.profile.qualification==='tool-specific'
        ? await prepareCreatorSpecialistQuote(actor,snapshot,options.enabled)
        : await service({expectedReferenceFingerprint:snapshot.referenceFingerprint,onQuotePrepared:(stored,tx)=>deps.insert(actor,stored,snapshot,tx)}).prepare(prepared.request);
      return {operationId:quote.quoteId,quoteId:quote.quoteId,quote,operation:{toolId:prepared.input.toolId,profile:prepared.profile,expectedDurationSec:prepared.expectedDurationSec,audioPolicy:prepared.audioPolicy,sourceAssets:prepared.input.inputs.map(entry=>entry.source)}};
    },
    async confirm(value:unknown) {
      const input=z.object({operationId:idSchema,confirmed:z.literal(true)}).strict().parse(value);
      const row=await deps.read(actor,input.operationId);
      if(row.status==='completed'||row.status==='failed'||row.job_id) return status(row.id);
      if(row.snapshot.profile.qualification==='tool-specific') {
        await confirmCreatorSpecialist(actor,row.id,options.enabled);
        return status(row.id);
      }
      validateSnapshot(row);
      await deps.revalidate(actor.userId,row.snapshot.sources);
      const onLocked=async(quote:{quoteId:string;requestHash:string;state:string},tx:QueryExecutor)=>{
        const current=await deps.read(actor,quote.quoteId,tx,true);
        if(quote.state!=='prepared') return;
        validateSnapshot(current);
        if(current.request_hash!==quote.requestHash) throw new AgentApiError('QUOTE_EXPIRED','The operation quote changed.');
        for(const source of current.snapshot.sources) {
          const original=await resolveStudioMedia(actor.userId,source.input.source,(sql,params)=>tx.query(sql,params),{lockAsset:true});
          if(creatorSourceFingerprint(original)!==source.fingerprint) throw new AgentApiError('REFERENCE_INVALID','An original source changed. Prepare a new quote.');
        }
      };
      await service({expectedReferenceFingerprint:row.snapshot.referenceFingerprint,onQuoteLocked:onLocked}).confirm({quoteId:row.id,confirmed:true});
      await deps.markRunning(actor,row.id);
      return status(row.id);
    },
    status,
  };
}
/** Invoke from the authenticated worker/cron owner; no provider submission is possible here. */
export async function refreshCreatorOperations(limit=5) {
  const candidates=await store.listCreatorRefreshCandidates(limit);
  const results=[];
  for(const candidate of candidates) {
    try {const result=await createCreatorOperationsService(candidate.actor,{enabled:false,dependencies:{read:(actor,id,db,lock)=>store.readCreatorOperation(actor,id,db,lock,true)}}).status(candidate.id);results.push({operationId:candidate.id,status:result.status});}
    catch {results.push({operationId:candidate.id,status:'retryable' as const});}
  }
  return results;
}
