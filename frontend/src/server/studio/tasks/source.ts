import {createHash} from 'node:crypto';
import {query,type QueryExecutor} from '@/lib/db';
import type {StudioGenerationActor} from '@/server/agent-api/generation-actor';
import type {ImageTurnInput} from '@/lib/studio/image-conversation-contract';
import {STUDIO_TASK_POLICY_VERSION} from '@/lib/studio/task-budget-contract';
import {stableJson} from '@/server/agent-api/generation-normalization';
import {resolveStudioMedia} from '../media-resolver';
/** Private source URLs are hashed, never copied into task status/memory. */
export async function studioTaskSourceFingerprint(actor:StudioGenerationActor,input:ImageTurnInput,db:QueryExecutor={query},lock=false) {
  const refs=[...input.references.map(assetId=>({type:'asset' as const,assetId,kind:'image' as const})),...(input.attachments??[])];
  const facts=[];
  for(const ref of refs){
    const media=await resolveStudioMedia(actor.userId,ref,(sql,values)=>db.query(sql,values),{lockAsset:lock});
    // V2 video qualification measures this same original; derived timing and
    // dimensions can change without changing its identity or approval. Keep
    // resolving ownership/readiness on every check and preserve the V1 recipe.
    if(input.taskBudget?.policyVersion===STUDIO_TASK_POLICY_VERSION&&ref.kind==='video')
      facts.push({ref,url:media.url,mime:media.mime,sizeBytes:media.sizeBytes});
    else facts.push({ref,url:media.url,mime:media.mime,durationSec:media.durationSec,sizeBytes:media.sizeBytes,width:media.width,height:media.height});
  }
  return createHash('sha256').update(stableJson(facts)).digest('hex');
}
