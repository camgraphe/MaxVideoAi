import {existsSync,statSync} from 'node:fs';
import {mkdtemp,rm} from 'node:fs/promises';
import {join,resolve,basename} from 'node:path';
import {tmpdir} from 'node:os';
import {bundle} from '@remotion/bundler';
import {makeCancelSignal,renderMedia,selectComposition} from '@remotion/renderer';
import type {WorkspaceTimelineRenderManifest} from '@/app/(core)/(workspace)/app/studio/_shared/_lib/workspace-timeline-render';
import type {TimelineExportRenderProps} from '@/remotion/timeline-export/types';
import {parseTimelineExportManifest} from '../timeline-exports/render-request';
import {probeSubtitleMedia} from './media';
const defaults={prepareMedia:async(manifest:WorkspaceTimelineRenderManifest,userId:string)=>{
  const security=await import('../timeline-exports/media-security');const requestOrigin=process.env.NEXT_PUBLIC_SITE_URL?.trim()||'https://maxvideoai.com';
  // The audio composition never requests still images. Validate only the exact audible sources.
  const audioManifest={...manifest,tracks:manifest.tracks.map(track=>({...track,clips:track.clips.filter(clip=>clip.mediaKind!=='image')}))};
  const validated=await security.validateTimelineExportManifestMediaUrls({manifest:audioManifest,userId,requestOrigin});
  return security.prepareTimelineExportRenderMedia({manifest:validated,userId,requestOrigin});
}};
/** A genuine WAV render of the canonical composition; no frame encoding or Studio MP4 activation. */
export async function renderSubtitleSequenceAudio(params:{manifest:WorkspaceTimelineRenderManifest;userId:string;outputPath:string;browserExecutable?:string;signal?:AbortSignal},overrides:Partial<typeof defaults>={}){
  const manifest=parseTimelineExportManifest(params.manifest);params.signal?.throwIfAborted();
  if(manifest.tracks.some(track=>track.clips.some(clip=>clip.transitionOut)))throw new Error('SUBTITLE_MIX_TRANSITION_UNSUPPORTED');
  const browserExecutable=params.browserExecutable??process.env.CHROME_BIN??process.env.PUPPETEER_EXECUTABLE_PATH;
  if(!browserExecutable||!existsSync(browserExecutable))throw new Error('SUBTITLE_RENDER_BROWSER_UNAVAILABLE');
  const directory=await mkdtemp(join(tmpdir(),'subtitle-mix-render-')),{cancel,cancelSignal}=makeCancelSignal(),abort=()=>cancel();
  const deadline=setTimeout(cancel,30*60_000),sizeCheck=setInterval(()=>{if(existsSync(params.outputPath)&&statSync(params.outputPath).size>512*1024*1024)cancel();},1000);params.signal?.addEventListener('abort',abort,{once:true});
  try{
    const prepared=await {...defaults,...overrides}.prepareMedia(manifest,params.userId);params.signal?.throwIfAborted();
    const frontendRoot=basename(process.cwd())==='frontend'?process.cwd():join(process.cwd(),'frontend');
    const serveUrl=await bundle({entryPoint:resolve(frontendRoot,'src/remotion/timeline-export/index.ts'),outDir:join(directory,'bundle')});
    const inputProps:TimelineExportRenderProps={manifest:prepared,width:320,height:180,fps:manifest.projectSettings?.fps??30,includeAudio:true,audioOnly:true,mediaTrust:'server-validated'};
    const composition=await selectComposition({serveUrl,id:'MaxVideoAITimelineExport',inputProps,browserExecutable});
    await renderMedia({composition,serveUrl,inputProps,outputLocation:params.outputPath,browserExecutable,codec:'wav',audioCodec:'pcm-16',enforceAudioTrack:true,sampleRate:48000,concurrency:2,timeoutInMilliseconds:60_000,cancelSignal});
    params.signal?.throwIfAborted();const facts=await probeSubtitleMedia(params.outputPath);
    if(!facts.hasAudio||Math.abs(facts.durationMs-manifest.durationSec*1000)>Math.ceil(1000/inputProps.fps)+2||statSync(params.outputPath).size>512*1024*1024)throw new Error('SUBTITLE_MIX_OUTPUT_INVALID');
    return facts;
  }catch(error){await rm(params.outputPath,{force:true});throw error;}
  finally{clearTimeout(deadline);clearInterval(sizeCheck);params.signal?.removeEventListener('abort',abort);await rm(directory,{recursive:true,force:true});}
}
