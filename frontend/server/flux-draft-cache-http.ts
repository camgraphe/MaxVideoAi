import { NextRequest, NextResponse } from 'next/server';
import { getRouteAuthContext } from '@/lib/supabase-ssr';
import { recoverOwnedFluxDraftCache } from './flux-draft-cache-recovery';
import { VideoExcerptError } from './video-excerpts/media';
const headers={'Cache-Control':'private, no-store'};
/** Explicit owner action after original delivery; never a mutation on a read/quote route. */
export function createFluxDraftCacheRecoveryHandler(dependencies={
  userId:async(request:NextRequest)=>(await getRouteAuthContext(request)).userId,
  recover:recoverOwnedFluxDraftCache,
}) {
  return async(request:NextRequest,context:{params:Promise<{jobId:string}>})=>{
    const failure=(code:string,message:string,status:number)=>NextResponse.json({ok:false,error:{code,message}},{status,headers});
    if(request.headers.get('origin')!==request.nextUrl.origin||request.headers.get('sec-fetch-site')==='cross-site') return failure('ORIGIN_INVALID','Use the same-origin Draft action.',403);
    const userId=await dependencies.userId(request);
    if(!userId)return failure('AUTH_REQUIRED','Authenticate before preparing this Draft.',401);
    const {jobId}=await context.params;
    if(!/^[a-zA-Z0-9_-]{1,128}$/.test(jobId))return failure('PARAMETER_INVALID','Invalid source generation.',422);
    try {return NextResponse.json({ok:true,...await dependencies.recover({userId,sourceJobId:jobId})},{headers});}
    catch(error){
      if(error instanceof VideoExcerptError&&error.code==='PREPARATION_BUSY')return failure(error.code,error.message,429);
      // Do not serialize provider URLs, raw errors, or distinguish foreign from absent sources.
      return failure('DRAFT_CACHE_UNAVAILABLE','This Draft cache could not be qualified. The original Draft remains available.',409);
    }
  };
}
