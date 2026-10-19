import {createHash} from 'node:crypto';
import {mkdtemp,writeFile,rm,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import type {ToolAssetRef} from '../../lib/toolbox/contract';
import {toolAssetRefSchema} from '../../lib/toolbox/contract';
import type {SubtitleSource} from '../../lib/subtitles/document';
import type {StudioResolvedMedia} from '../studio/media-resolver';
import {probeSubtitleMedia,extractSubtitleAudio} from './media';
export const SUBTITLE_MAX_SOURCE_BYTES=200*1024*1024;
export type SubtitleSourceDependencies={
  resolve:(userId:string,ref:ToolAssetRef)=>Promise<StudioResolvedMedia>;
  sign:(key:string)=>Promise<string>;
  download:(url:string)=>Promise<Buffer>;
};
const defaults:SubtitleSourceDependencies={
  resolve:async(userId,ref)=>(await import('../studio/media-resolver')).resolveStudioMedia(userId,ref),
  sign:async key=>(await import('@/server/storage')).createSignedDownloadUrl(key,{expiresInSeconds:600}),
  download:async url=>{
    const {createBoundedMediaDownloader}=await import('../agent-api/reference-file-download');
    const file=await createBoundedMediaDownloader({accepted:['video/mp4','video/quicktime','video/webm','audio/mpeg','audio/mp3','audio/wav','audio/x-wav','audio/mp4','audio/aac','audio/ogg','audio/flac'],maxBytes:SUBTITLE_MAX_SOURCE_BYTES})({file_id:'subtitle-owned-source',download_url:url});return file.bytes;
  },
};
export type LoadedSubtitleSource={path:string;source:SubtitleSource;facts:Awaited<ReturnType<typeof probeSubtitleMedia>>};
/** The callback alone can use the temporary original. Quotes may retain facts and identity, never a grant. */
export async function withOwnedSubtitleSource<T>(userId:string,input:ToolAssetRef,consume:(source:LoadedSubtitleSource)=>Promise<T>,options:{signal?:AbortSignal;expectedFingerprint?:string}={},dependencies:SubtitleSourceDependencies=defaults):Promise<T>{
  if(!userId)throw new Error('UNAUTHORIZED');const ref=toolAssetRefSchema.parse(input);
  if(ref.kind!=='video'&&ref.kind!=='audio')throw new Error('SUBTITLE_SOURCE_KIND_INVALID');options.signal?.throwIfAborted();
  const media=await dependencies.resolve(userId,ref);
  if(media.kind!==ref.kind)throw new Error('SUBTITLE_SOURCE_KIND_INVALID');
  if(media.sizeBytes&&media.sizeBytes>SUBTITLE_MAX_SOURCE_BYTES)throw new Error('SUBTITLE_SOURCE_TOO_LARGE');
  const url=media.originalAccess.type==='owned-storage'?await dependencies.sign(media.originalAccess.storageKey):media.url;
  const bytes=await dependencies.download(url);options.signal?.throwIfAborted();
  if(bytes.length===0||bytes.length>SUBTITLE_MAX_SOURCE_BYTES)throw new Error('SUBTITLE_SOURCE_TOO_LARGE');
  const fingerprint=createHash('sha256').update(bytes).digest('hex');
  if(options.expectedFingerprint&&options.expectedFingerprint!==fingerprint)throw new Error('SUBTITLE_SOURCE_CHANGED');
  const directory=await mkdtemp(join(tmpdir(),'subtitle-source-'));const path=join(directory,'original');
  try{await writeFile(path,bytes,{mode:0o600});const facts=await probeSubtitleMedia(path);options.signal?.throwIfAborted();return await consume({path,source:{ref,fingerprint,durationMs:facts.durationMs},facts});}
  finally{await rm(directory,{recursive:true,force:true});}
}
export async function readOwnedSubtitleSourceFacts(userId:string,ref:ToolAssetRef){return withOwnedSubtitleSource(userId,ref,async({source,facts})=>({source,facts}));}
/** Call only after a paid operation is reserved. Its key is retained until the provider no longer needs it. */
export async function prepareScribeAudio(userId:string,source:SubtitleSource,signal?:AbortSignal){
  return withOwnedSubtitleSource(userId,source.ref,async loaded=>{
    const outputPath=join(loaded.path,'..','transcription.wav');
    await extractSubtitleAudio({sourcePath:loaded.path,outputPath,signal});
    const storage=await import('@/server/storage');
    const upload=await storage.uploadFilePath({path:outputPath,sizeBytes:(await stat(outputPath)).size,mime:'audio/wav',userId,prefix:'renders',fileName:'subtitle-transcription.wav',cacheControl:'private, max-age=0'});
    try{return {audioUrl:await storage.createSignedDownloadUrl(upload.key,{expiresInSeconds:3600}),storageKey:upload.key,storageUrl:upload.url};}
    catch(error){await storage.deleteStorageObjectByUrl(upload.url).catch(()=>false);throw error;}
  },{expectedFingerprint:source.fingerprint,signal});
}
