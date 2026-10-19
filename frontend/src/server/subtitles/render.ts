import {existsSync,statSync} from 'node:fs';
import {copyFile,mkdtemp,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,basename} from 'node:path';
import {bundle} from '@remotion/bundler';
import {makeCancelSignal,renderMedia,selectComposition} from '@remotion/renderer';
import {parseSubtitleDocument,type SubtitleDocument} from '../../lib/subtitles/document';
import {subtitleFileFingerprint,probeSubtitleMedia,assertSubtitleRenderFacts} from './media';
export {subtitleFileFingerprint,probeSubtitleMedia,extractSubtitleAudio} from './media';
/** Local-file worker boundary. The caller resolves owned originals; exact bytes must match the frozen document. */
export async function renderSubtitleVideo(params:{document:SubtitleDocument;sourcePath:string;outputPath:string;browserExecutable?:string;signal?:AbortSignal}){
  const document=parseSubtitleDocument(params.document);params.signal?.throwIfAborted();
  if(document.source.ref.kind!=='video')throw new Error('SUBTITLE_VISUAL_BACKGROUND_REQUIRED');
  if(!document.segments.length)throw new Error('SUBTITLE_DOCUMENT_EMPTY');
  if(statSync(params.sourcePath).size>512*1024*1024)throw new Error('SUBTITLE_SOURCE_TOO_LARGE');
  if(await subtitleFileFingerprint(params.sourcePath)!==document.source.fingerprint)throw new Error('SUBTITLE_SOURCE_CHANGED');
  const facts=await probeSubtitleMedia(params.sourcePath);
  assertSubtitleRenderFacts(facts);
  if(Math.abs(facts.durationMs-document.source.durationMs)>50)throw new Error('SUBTITLE_RENDER_SOURCE_INVALID');
  const browserExecutable=params.browserExecutable??process.env.CHROME_BIN??process.env.PUPPETEER_EXECUTABLE_PATH;
  if(!browserExecutable||!existsSync(browserExecutable))throw new Error('SUBTITLE_RENDER_BROWSER_UNAVAILABLE');
  const directory=await mkdtemp(join(tmpdir(),'subtitle-render-'));const publicDir=join(directory,'public');await mkdir(publicDir);
  const {cancel,cancelSignal}=makeCancelSignal();const abort=()=>cancel();params.signal?.addEventListener('abort',abort,{once:true});
  const deadline=setTimeout(cancel,30*60_000);
  const sizeCheck=setInterval(()=>{if(existsSync(params.outputPath)&&statSync(params.outputPath).size>512*1024*1024)cancel();},1000);
  try{
    await copyFile(params.sourcePath,join(publicDir,'source.mp4'));
    if(await subtitleFileFingerprint(join(publicDir,'source.mp4'))!==document.source.fingerprint)throw new Error('SUBTITLE_SOURCE_CHANGED');
    const frontendRoot=basename(process.cwd())==='frontend'?process.cwd():join(process.cwd(),'frontend');
    const serveUrl=await bundle({entryPoint:resolve(frontendRoot,'src/server/subtitles/remotion-entry.tsx'),publicDir,outDir:join(directory,'bundle')});
    const inputProps={document,width:facts.width,height:facts.height,fps:facts.fps,durationInFrames:Math.round(document.source.durationMs*facts.fps/1000)};
    const composition=await selectComposition({serveUrl,id:'MaxVideoAISubtitles',inputProps,browserExecutable});
    params.signal?.throwIfAborted();
    await renderMedia({composition,serveUrl,inputProps,outputLocation:params.outputPath,browserExecutable,codec:'h264',imageFormat:'png',colorSpace:'bt709',concurrency:2,offthreadVideoCacheSizeInBytes:256*1024*1024,timeoutInMilliseconds:60_000,cancelSignal});
    params.signal?.throwIfAborted();const sizeBytes=statSync(params.outputPath).size;
    if(sizeBytes<=0||sizeBytes>512*1024*1024)throw new Error('SUBTITLE_RENDER_OUTPUT_INVALID');
    const actual=await probeSubtitleMedia(params.outputPath);
    if(actual.width!==facts.width||actual.height!==facts.height||Math.abs(actual.durationMs-document.source.durationMs)>Math.ceil(1000/facts.fps)+10||actual.hasAudio!==facts.hasAudio)throw new Error('SUBTITLE_RENDER_OUTPUT_INVALID');
    return {...actual,sizeBytes};
  }catch(error){await rm(params.outputPath,{force:true});throw error;}
  finally{clearTimeout(deadline);clearInterval(sizeCheck);params.signal?.removeEventListener('abort',abort);await rm(directory,{recursive:true,force:true});}
}
