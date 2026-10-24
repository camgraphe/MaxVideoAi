import { AgentApiError } from './errors';
import { resolveOwnedFluxDraftSource } from '@/server/flux-draft-cache-store';
import type { CanonicalGenerationRequest } from './generation-types';
import type { QueryExecutor } from '@/lib/db';
export async function resolveCanonicalFluxLineage(request:CanonicalGenerationRequest,actor:{userId:string},executor?:QueryExecutor) {
  if(request.operation!=='flux-draft-enhance') return undefined;
  if(!request.sourceJobId||request.references.length) throw new AgentApiError('REFERENCE_REQUIRED','Choose an owned Draft generation, not an imported source or cache URL.');
  return resolveOwnedFluxDraftSource({userId:actor.userId,sourceJobId:request.sourceJobId,sourceOutputId:request.sourceOutputId,executor});
}
