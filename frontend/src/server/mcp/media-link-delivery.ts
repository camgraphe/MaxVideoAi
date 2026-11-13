import {getGenerationStatus} from '@/server/generations/generation-status';
import {query} from '@/lib/db';
import {resolveStudioMedia} from '@/server/studio/media-resolver';
import {readOwnedCompletedTimelineExport} from '@/server/timeline-exports/media-access';
import {createSignedDownloadUrl,ownedMediaStorageKeyForUrl} from '@/server/storage';
import {MCP_MEDIA_LINK_PATH,mcpMediaHash,primaryGenerationMediaUrl,verifyMcpMediaToken,type McpMediaClaims} from './media-link';

async function readSource(claims:McpMediaClaims):Promise<string|null> {
  const {source,userId} = claims;
  if(source.type==='generation') {
    const visible = await query<{job_id:string}>(
      'SELECT job_id FROM app_jobs WHERE job_id = $1 AND user_id = $2 AND hidden IS NOT TRUE LIMIT 1',
      [source.jobId,userId],
    );
    if(visible[0]?.job_id!==source.jobId)return null;
    const status = await getGenerationStatus({userId,jobId:source.jobId});
    return status?.status==='completed' ? primaryGenerationMediaUrl(status.result) : null;
  }
  if(source.type==='export')return (await readOwnedCompletedTimelineExport({userId,exportId:source.exportId}))?.output_url??null;
  return (await resolveStudioMedia(userId,source)).url;
}

/** Cookie-free, exact-media capability, with the same bearer semantics as a presigned S3 read. */
export async function deliverMcpMediaLink(request:Request,dependencies:{
  now?:()=>number;readSource?:(claims:McpMediaClaims)=>Promise<string|null>;sign?:typeof createSignedDownloadUrl;
}={}):Promise<Response> {
  const headers = {'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'};
  const denied = () => new Response(null,{status:404,headers});
  try {
    if(!['GET','HEAD'].includes(request.method) || request.url.length>8192)return denied();
    const url = new URL(request.url);
    if(url.pathname!==MCP_MEDIA_LINK_PATH || url.searchParams.getAll('token').length!==1)return denied();
    for(const [key,value] of url.searchParams) {
      if(key!=='token' && (!/^utm_[a-z0-9_]{1,32}$/i.test(key) || value.length>256))return denied();
    }
    const now = dependencies.now??Date.now;
    const claims = verifyMcpMediaToken(url.searchParams.get('token')??'',url.origin,now());
    if(!claims)return denied();
    const source = await (dependencies.readSource??readSource)(claims);
    const key = source && ownedMediaStorageKeyForUrl({url:source,userId:claims.userId});
    if(!key || mcpMediaHash(key)!==claims.mediaHash)return denied();
    // Recheck after the lookup; repeated opens cannot extend the original grant's deadline.
    const signingTime = now();
    const ttl = claims.exp-Math.ceil(signingTime/1000);
    if(ttl<1)return denied();
    const location = await (dependencies.sign??createSignedDownloadUrl)(key,{
      method:request.method as 'GET'|'HEAD',expiresInSeconds:ttl,signingDate:new Date(signingTime),
    });
    if(now()>=claims.exp*1000)return denied();
    // Never append the incoming query to S3. 307 retains HEAD and Range semantics.
    return new Response(null,{status:307,headers:{...headers,Location:location}});
  } catch {return denied();}
}
