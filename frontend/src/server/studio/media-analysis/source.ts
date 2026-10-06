import {createHash} from 'node:crypto';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {STUDIO_ANALYSIS_LIMITS,studioAnalysisKind,type StudioAnalysisRequest} from '@/lib/studio/media-analysis-contract';
import {createSignedDownloadUrl} from '@/server/storage';
import {ensureExecutableFfmpegPath} from '../../../../server/ffmpeg-runtime';
import type {StudioResolvedMedia} from '../media-resolver';

export type AnalysisFrame={atSec:number;imageUrl:string};
export type AnalysisSource={frames:AnalysisFrame[];audioBase64?:string;sourceHash:string};
export function analysisSourceFingerprint(source:{ref:unknown;url:string;durationSec?:number|null;sizeBytes?:number|null}) {
  return createHash('sha256').update(JSON.stringify({ref:source.ref,url:source.url,durationSec:source.durationSec??null,sizeBytes:source.sizeBytes??null})).digest('hex');
}
export function analysisSampleTimes(startSec:number,endSec:number) {
  if(!Number.isFinite(startSec)||!Number.isFinite(endSec)||startSec<0||endSec<=startSec||endSec-startSec>60)throw new Error('INVALID_ANALYSIS_INTERVAL');
  return Array.from({length:STUDIO_ANALYSIS_LIMITS.frames},(_,index)=>startSec+(endSec-startSec)*index/STUDIO_ANALYSIS_LIMITS.frames);
}
export async function readBoundedAnalysisBody(response:Response,maxBytes=STUDIO_ANALYSIS_LIMITS.sourceBytes) {
  if(!response.ok||!response.body)throw new Error('ANALYSIS_SOURCE_UNAVAILABLE');
  const length=Number(response.headers.get('content-length'));
  if(length>maxBytes){await response.body.cancel();throw new Error('ANALYSIS_SOURCE_TOO_LARGE');}
  const reader=response.body.getReader();const chunks:Uint8Array[]=[];let size=0;
  try{while(true){const next=await reader.read();if(next.done)break;size+=next.value.byteLength;if(size>maxBytes){await reader.cancel();throw new Error('ANALYSIS_SOURCE_TOO_LARGE');}chunks.push(next.value);}}finally{reader.releaseLock();}
  if(!size)throw new Error('ANALYSIS_SOURCE_EMPTY');return Buffer.concat(chunks);
}
/** Only a server-resolved owned original enters this worker; local files never escape it. */
export async function extractStudioAnalysisSource(media:StudioResolvedMedia,request:StudioAnalysisRequest,signal:AbortSignal,dependencies:{fetchSource?:typeof fetch}={}):Promise<AnalysisSource> {
  if(media.kind!==request.ref.kind||!media.durationSec||request.endSec>media.durationSec||media.sizeBytes&&media.sizeBytes>STUDIO_ANALYSIS_LIMITS.sourceBytes)throw new Error('ANALYSIS_SOURCE_BOUNDS');
  const url=media.originalAccess.type==='owned-storage'?await createSignedDownloadUrl(media.originalAccess.storageKey,{expiresInSeconds:120}):media.url;
  const bytes=await readBoundedAnalysisBody(await (dependencies.fetchSource??fetch)(url,{cache:'no-store',redirect:'error',signal}));
  const sourceHash=createHash('sha256').update(bytes).digest('hex');
  const directory=await mkdtemp(path.join(tmpdir(),'studio-analysis-'));
  const source=path.join(directory,'source');
  try {
    await writeFile(source,bytes,{mode:0o600});
    const installer=await import('@ffmpeg-installer/ffmpeg');
    const executable=await ensureExecutableFfmpegPath(installer.path);
    const started=Date.now();
    const run=async(args:string[])=>{
      const remaining=STUDIO_ANALYSIS_LIMITS.decodeMs-(Date.now()-started);if(remaining<=0)throw new Error('ANALYSIS_DECODE_TIMEOUT');
      await promisify(execFile)(executable,['-nostdin','-loglevel','error','-protocol_whitelist','file,pipe',...args],{timeout:remaining,signal,maxBuffer:64*1024});
    };
    if(studioAnalysisKind(request)==='audio') {
      const output=path.join(directory,'window.wav');
      await run(['-ss',String(request.startSec),'-i',source,'-t',String(request.endSec-request.startSec),'-vn','-ac','1','-ar','16000','-c:a','pcm_s16le',output]);
      const audio=await readFile(output);if(audio.length>2_000_000)throw new Error('ANALYSIS_AUDIO_TOO_LARGE');
      return {frames:[],audioBase64:audio.toString('base64'),sourceHash};
    }
    const frames:AnalysisFrame[]=[];
    for(const [index,atSec] of analysisSampleTimes(request.startSec,request.endSec).entries()){
      const output=path.join(directory,`${index}.jpg`);
      await run(['-ss',String(atSec),'-i',source,'-frames:v','1','-vf','scale=768:768:force_original_aspect_ratio=decrease','-q:v','3',output]);
      const jpeg=await readFile(output);if(jpeg.length>1_000_000)throw new Error('ANALYSIS_FRAME_TOO_LARGE');
      frames.push({atSec,imageUrl:'data:image/jpeg;base64,'+jpeg.toString('base64')});
    }
    return {frames,sourceHash};
  } finally {await rm(directory,{recursive:true,force:true});}
}
