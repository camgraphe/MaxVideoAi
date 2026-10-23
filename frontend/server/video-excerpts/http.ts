import { NextRequest, NextResponse } from 'next/server';
import { getRouteAuthContext } from '@/lib/supabase-ssr';
import { prepareVideoExcerpt } from './prepare';
import { VideoExcerptError } from './media';
const headers = { 'Cache-Control':'private, no-store' };
const failure = (code:string,message:string,status:number) => NextResponse.json({ok:false,error:{code,message}},{status,headers});
const MAX_JSON_BYTES = 16 * 1024;
async function readExcerptJson(request: NextRequest): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) throw new SyntaxError('Missing JSON body.');
  const chunks: Uint8Array[] = [];
  let length = 0, timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_,reject) => { timer=setTimeout(()=>reject(new SyntaxError('JSON body timed out.')),5000); });
  try {
    for (;;) {
      const {value,done} = await Promise.race([reader.read(),deadline]);
      if (done) break;
      length += value.byteLength;
      if (length > MAX_JSON_BYTES) throw new RangeError('JSON body is too large.');
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch(error) { void reader.cancel().catch(()=>undefined); throw error; }
  finally { clearTimeout(timer); reader.releaseLock(); }
}
/** Kept separate from Creator/paid-tool gates: excerpt preparation is an upload action. */
export function createVideoExcerptPostHandler(dependencies: {
  userId(request:NextRequest):Promise<string|null>;
  prepare:(userId:string,value:unknown)=>Promise<object>;
} = { userId:async request=>(await getRouteAuthContext(request)).userId,prepare:prepareVideoExcerpt }) {
  return async (request:NextRequest):Promise<NextResponse> => {
    if (request.headers.get('origin') !== request.nextUrl.origin || request.headers.get('sec-fetch-site') === 'cross-site') return failure('ORIGIN_INVALID','Use the same-origin upload action.',403);
    try {
      const userId=await dependencies.userId(request);
      if(!userId)return failure('AUTH_REQUIRED','Authenticate before preparing an excerpt.',401);
      if(request.headers.get('content-type')?.split(';',1)[0]?.trim().toLowerCase() !== 'application/json')return failure('JSON_REQUIRED','Send a JSON request.',415);
      if(Number(request.headers.get('content-length')) > MAX_JSON_BYTES)return failure('REQUEST_TOO_LARGE','The excerpt request is too large.',413);
      const result=await dependencies.prepare(userId,await readExcerptJson(request));
      return NextResponse.json({ok:true,...result},{headers});
    } catch(error) {
      if(error instanceof RangeError)return failure('REQUEST_TOO_LARGE','The excerpt request is too large.',413);
      if(error instanceof SyntaxError)return failure('PARAMETER_INVALID','Send a complete valid JSON request.',400);
      if(error instanceof VideoExcerptError) {
        const status={AUTH_REQUIRED:401,PARAMETER_INVALID:422,ENGINE_UNAVAILABLE:409,SOURCE_UNAVAILABLE:404,SOURCE_CHANGED:409,PREPARATION_LIMIT:422,PREPARATION_BUSY:429,PREPARATION_FAILED:500}[error.code];
        return failure(error.code,error.message,status);
      }
      return failure('PREPARATION_FAILED','The excerpt could not be prepared. Retry shortly.',500);
    }
  };
}
