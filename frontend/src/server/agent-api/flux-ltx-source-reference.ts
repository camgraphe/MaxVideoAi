import { isFluxLtxSourceOperation } from '@/lib/flux-ltx-operations';
import { inspectOwnedFluxLtxSource } from '@/server/video-excerpts/flux-ltx-source';
import type { ResolvedReference } from './reference-types';
/** Same measured comparison shape for read-only prices, promotion and canonical execution. */
export async function qualifyFluxLtxSourceReference(reference:ResolvedReference,operation:unknown,userId:string,inspect=inspectOwnedFluxLtxSource):Promise<ResolvedReference> {
  if(!isFluxLtxSourceOperation(operation)||operation==='flux-draft-enhance'||reference.role!=='source'||reference.mediaKind!=='video')return reference;
  const measured=await inspect(reference.storageUrl,operation,userId);
  return {...reference,durationSec:measured.durationSec,mimeType:measured.mimeType,sizeBytes:measured.sizeBytes,width:measured.width,height:measured.height,sourceSha256:measured.sourceSha256};
}
