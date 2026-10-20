import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import ffprobe from 'ffprobe-static';
import {ensureExecutableFfmpegPath} from '@/server/ffmpeg-runtime';
const execute=promisify(execFile);
type MediaTiming={streams?:{codec_type:string;duration?:string;start_time?:string}[];format?:{duration?:string;start_time?:string}};
/** Stream presentation times exclude container/AAC padding that older ffprobe builds include. */
export function subtitlePresentationDuration(data:MediaTiming){
  const streams=data.streams?.filter(stream=>stream.codec_type==='video'||stream.codec_type==='audio')??[];
  const origin=Number(data.format?.start_time??0);
  if(streams.length&&Number.isFinite(origin)&&streams.every(stream=>Number.isFinite(Number(stream.duration))&&Number(stream.duration)>0&&Number.isFinite(Number(stream.start_time??origin)))){
    return Math.round(Math.max(...streams.map(stream=>Number(stream.start_time??origin)-origin+Number(stream.duration)))*1000);
  }
  return Math.round(Number(data.format?.duration)*1000);
}
export async function subtitleFileFingerprint(path:string):Promise<string>{const hash=createHash('sha256');for await(const chunk of createReadStream(path))hash.update(chunk);return hash.digest('hex');}
export async function probeSubtitleMedia(sourcePath:string){
  const {stdout}=await execute(ffprobe.path!,['-v','error','-protocol_whitelist','file,pipe','-show_entries','stream=codec_type,width,height,avg_frame_rate,start_time,duration:format=start_time,duration','-of','json',sourcePath],{timeout:15_000,maxBuffer:1024*1024});
  const data=JSON.parse(stdout),video=data.streams?.find((stream:{codec_type:string})=>stream.codec_type==='video');
  const durationMs=subtitlePresentationDuration(data),hasAudio=Boolean(data.streams?.some((stream:{codec_type:string})=>stream.codec_type==='audio'));
  const [numerator,denominator]=String(video?.avg_frame_rate??'0/1').split('/').map(Number);
  if(!Number.isSafeInteger(durationMs)||durationMs<=0||durationMs>1_800_000)throw new Error('SUBTITLE_SOURCE_DURATION_INVALID');
  return {durationMs,hasAudio,width:Number(video?.width??0),height:Number(video?.height??0),fps:denominator?numerator/denominator:0};
}
export async function extractSubtitleAudio({sourcePath,outputPath,signal}:{sourcePath:string;outputPath:string;signal?:AbortSignal}){
  const facts=await probeSubtitleMedia(sourcePath);if(!facts.hasAudio)throw new Error('SUBTITLE_SOURCE_HAS_NO_AUDIO');
  signal?.throwIfAborted();const installer=await import('@ffmpeg-installer/ffmpeg');const executable=await ensureExecutableFfmpegPath(installer.path);
  // Scribe timestamps belong to the original presentation clock. Normalize the
  // container origin while retaining delayed audio and gaps as actual silence.
  await execute(executable,['-nostdin','-loglevel','error','-y','-copyts','-start_at_zero','-protocol_whitelist','file,pipe','-i',sourcePath,'-map','0:a:0','-vn','-af','aresample=async=1:first_pts=0','-ac','1','-ar','16000','-c:a','pcm_s16le',outputPath],{timeout:120_000,signal,maxBuffer:64*1024});
  return facts;
}

export function assertSubtitleRenderFacts(facts:Awaited<ReturnType<typeof probeSubtitleMedia>>){
  if(facts.width<=0||facts.height<=0||facts.width%2||facts.height%2||facts.width*facts.height>8_500_000||facts.fps<=0||facts.fps>60)throw new Error('SUBTITLE_RENDER_SOURCE_INVALID');
}
