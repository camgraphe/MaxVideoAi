import { AgentApiError } from '@/server/agent-api/errors';
import { createHash } from 'node:crypto';
import { createOwnedMediaReadUrl } from '@/server/owned-media-read-access';
import { validateFluxLtxSource, type FluxLtxSourceOperation } from '@/lib/flux-ltx-operations';
import { downloadVideoExcerptMedia, inspectVideoExcerptBytes, withVideoExcerptSlot, VideoExcerptError } from './media';

/** Exact URL ownership is resolved by the caller before any private read. */
export async function inspectOwnedFluxLtxSource(url:string,operation:FluxLtxSourceOperation,userId:string,
  dependencies={createReadUrl:createOwnedMediaReadUrl,download:downloadVideoExcerptMedia,inspect:inspectVideoExcerptBytes}) {
  try { return await withVideoExcerptSlot(userId,async()=>{
    const access=await dependencies.createReadUrl({url,userId,expiresInSeconds:300});
    const downloaded=await dependencies.download({file_id:'owned-operation-source',download_url:access});
    const facts=await dependencies.inspect(downloaded.bytes,downloaded.mimeType);
    // The shared display MIME intentionally maps QuickTime to video/mp4. FAST needs
    // positive byte-probed MP4 evidence; unknown/QuickTime brands require preparation.
    const mp4Brand = /^(?:isom|iso[2-9]|mp4[12]|avc1|M4V |MSNV|dash|cmf[cs])$/;
    if (operation==='flux-fast-edit' && (!facts.containerFormat?.split(',').includes('mp4')
      || !mp4Brand.test(facts.containerMajorBrand??''))) throw new Error('Prepare an MP4 source.');
    const error=validateFluxLtxSource(operation,facts);
    if(error) throw new Error(error);
    return {...facts,sourceSha256:createHash('sha256').update(downloaded.bytes).digest('hex')};
  }); } catch(error) {
    if(error instanceof VideoExcerptError&&error.code==='PREPARATION_BUSY')throw new AgentApiError('RATE_LIMITED',error.message,true);
    throw new AgentApiError('REFERENCE_INVALID','This source does not satisfy the selected operation. Prepare a compatible copy and review its measured timing.');
  }
}
