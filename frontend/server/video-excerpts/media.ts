import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import ffmpeg from '@ffmpeg-installer/ffmpeg';
import ffprobe from 'ffprobe-static';
import { ensureExecutableFfmpegPath } from '@/server/ffmpeg-runtime';
import { resolveProbedMediaMetadata } from '@/server/media/detect-has-audio';
import { createBoundedMediaDownloader } from '@/server/bounded-media-download';
import { VIDEO_EXCERPT_PREPARATION_LIMITS, type VideoExcerptRange } from '@/lib/video-excerpt';
export { VIDEO_EXCERPT_PREPARATION_LIMITS } from '@/lib/video-excerpt';

export class VideoExcerptError extends Error {
  constructor(public readonly code: 'AUTH_REQUIRED' | 'PARAMETER_INVALID' | 'ENGINE_UNAVAILABLE' | 'SOURCE_UNAVAILABLE' | 'SOURCE_CHANGED' | 'PREPARATION_LIMIT' | 'PREPARATION_BUSY' | 'PREPARATION_FAILED', message: string) {
    super(message); this.name = 'VideoExcerptError';
  }
}
const exec = promisify(execFile);
export const downloadVideoExcerptMedia = createBoundedMediaDownloader({ accepted: ['video/mp4','video/quicktime','video/webm'], maxBytes: VIDEO_EXCERPT_PREPARATION_LIMITS.maxBytes });
const activeAccounts = new Set<string>();
export async function withVideoExcerptSlot<T>(userId: string, work: () => Promise<T>): Promise<T> {
  if (activeAccounts.has(userId) || activeAccounts.size >= 2) throw new VideoExcerptError('PREPARATION_BUSY', 'Video preparation is busy. Retry shortly.');
  activeAccounts.add(userId);
  try { return await work(); } finally { activeAccounts.delete(userId); }
}
async function workspace<T>(run: (directory: string) => Promise<T>): Promise<T> {
  const directory = await mkdtemp(join(tmpdir(), 'video-excerpt-'));
  try { return await run(directory); } finally { await rm(directory, { recursive: true, force: true }); }
}
export type VideoExcerptFacts = { kind: 'video'; width: number; height: number; durationSec: number; fps: number; hasAudio: boolean; sizeBytes: number; mimeType: string; containerFormat?: string; containerMajorBrand?: string | null; videoCodec: string; audioCodec: string | null; videoStreamIndex?: number; decodedFrameCount?: number; constantFrameRate?: boolean };
const limitError = () => new VideoExcerptError('PREPARATION_LIMIT', 'Excerpt preparation supports videos up to 100 MiB, 180 seconds, 16 megapixels and 120 fps. The full-video workflow remains available.');
export async function inspectVideoExcerptBytes(bytes: Uint8Array, mimeType: string, options: { decodedFrames?: boolean } = {}): Promise<VideoExcerptFacts> {
  const limits = VIDEO_EXCERPT_PREPARATION_LIMITS;
  if (!bytes.length || bytes.length > limits.maxBytes) throw limitError();
  return workspace(async directory => {
    const path = join(directory, 'source'); await writeFile(path, bytes);
    const { stdout } = await exec(ffprobe.path!, ['-v','error','-protocol_whitelist','file,pipe', ...(options.decodedFrames ? ['-count_frames','-show_frames'] : []), '-show_entries',`stream=index,codec_type,codec_name,width,height,avg_frame_rate,duration,nb_read_frames:stream_disposition=attached_pic:stream_side_data_list:stream_tags=rotate:format=format_name,duration:format_tags=major_brand${options.decodedFrames ? ':frame=media_type,stream_index,best_effort_timestamp_time' : ''}`,'-of','json',path], { timeout: options.decodedFrames ? 45_000 : 15_000, maxBuffer: 8 * 1024 * 1024 });
    return resolveVideoExcerptFacts(JSON.parse(stdout) as VideoExcerptProbeMetadata,mimeType,bytes.length);
  });
}
type VideoExcerptProbeMetadata = Omit<Parameters<typeof resolveProbedMediaMetadata>[0], 'streams' | 'format'> & {
  format?: {format_name?:string;duration?:string;tags?:{major_brand?:string}};
  streams: Array<NonNullable<Parameters<typeof resolveProbedMediaMetadata>[0]['streams']>[number] & {index?:number;codec_name?:string;avg_frame_rate?:string;nb_read_frames?:string}>;
  frames?: Array<{media_type?:string;stream_index?:number;best_effort_timestamp_time?:string}>;
};
/** Keep display orientation under the shared upload probe's rotation policy. */
export function resolveVideoExcerptFacts(data: VideoExcerptProbeMetadata, mimeType: string, sizeBytes: number): VideoExcerptFacts {
  const limits = VIDEO_EXCERPT_PREPARATION_LIMITS;
  const measured = resolveProbedMediaMetadata(data,{declaredMime:mimeType});
  const video = data.streams.find(stream=>stream.codec_type==='video'&&stream.disposition?.attached_pic!==1);
  const audio = data.streams.find(stream=>stream.codec_type==='audio');
  const streamDuration = Number(video?.duration);
  const durationSec = Number.isFinite(streamDuration)&&streamDuration>0 ? streamDuration : measured?.durationSec;
  const [n,d] = (video?.avg_frame_rate??'').split('/').map(Number), fps=n/d;
  if (!measured || measured.kind!=='video' || !measured.width || !measured.height || !video?.codec_name
    || !durationSec || !Number.isFinite(durationSec) || durationSec>limits.maxSourceSec
    || measured.width*measured.height>limits.maxPixels || !Number.isFinite(fps) || fps<=0 || fps>limits.maxFps) throw limitError();
  const frames = data.frames?.filter(frame=>frame.media_type==='video' && frame.stream_index===(video.index??0));
  const decodedFrameCount = Number(video.nb_read_frames);
  const times = frames?.map(frame=>Number(frame.best_effort_timestamp_time));
  const decoded = Number.isSafeInteger(decodedFrameCount) && decodedFrameCount > 0 && frames?.length === decodedFrameCount;
  const constantFrameRate = decoded && times!.every((time,index)=>Number.isFinite(time) && (index===0 || Math.abs(time-times![index-1]!-1/fps)<0.000002));
  return {...(decoded ? {decodedFrameCount,constantFrameRate} : {}),kind:'video',width:measured.width,height:measured.height,durationSec,fps,hasAudio:Boolean(audio),sizeBytes,
    mimeType:measured.canonicalMime,containerFormat:data.format?.format_name??'',containerMajorBrand:data.format?.tags?.major_brand??null,videoCodec:video.codec_name,audioCodec:audio?.codec_name??null,videoStreamIndex:video.index??0};
}

export function validateVideoExcerptOutput(source: VideoExcerptFacts, actual: VideoExcerptFacts, range: VideoExcerptRange): void {
  const tolerance = Math.max(0.001, 1 / source.fps, 1 / actual.fps);
  if (!Number.isFinite(actual.durationSec) || Math.abs(actual.durationSec - (range.endSec-range.startSec)) > tolerance + 0.000001
    || actual.width !== source.width || actual.height !== source.height || actual.hasAudio !== source.hasAudio
    || actual.videoCodec !== 'h264' || (source.hasAudio && actual.audioCodec !== 'aac')) {
    throw new VideoExcerptError('PREPARATION_FAILED', 'The prepared excerpt did not preserve the selected video timing, framing and audio.');
  }
}
/** Upload probing can round container timing differently from the selected video stream. */
export function validateStoredVideoExcerptFacts(facts: VideoExcerptFacts, stored: {durationSec:number;width:number|null;height:number|null;mediaFacts?:{hasAudio?:boolean}}): void {
  if (Math.abs(stored.durationSec-facts.durationSec)>Math.max(0.001,1/facts.fps)+0.000001
    || !Number.isFinite(stored.durationSec) || stored.width!==facts.width || stored.height!==facts.height
    || stored.mediaFacts?.hasAudio!==facts.hasAudio) {
    throw new VideoExcerptError('PREPARATION_FAILED','The stored excerpt could not be verified.');
  }
}

export async function trimVideoExcerptBytes(bytes: Uint8Array, facts: VideoExcerptFacts, range: VideoExcerptRange, maxDurationSec?: number): Promise<{bytes:Buffer;facts:VideoExcerptFacts}> {
  const length = range.endSec-range.startSec;
  if (!Number.isFinite(range.startSec) || !Number.isFinite(range.endSec) || range.startSec < 0 || length <= 0 || range.endSec > facts.durationSec) throw new VideoExcerptError('PARAMETER_INVALID','Choose a valid start and end within the source video.');
  if (length > VIDEO_EXCERPT_PREPARATION_LIMITS.maxExcerptSec) throw new VideoExcerptError('PREPARATION_LIMIT', 'Choose an excerpt of at most 60 seconds. The full-video workflow remains available.');
  // Fit complete frames to a millisecond-aligned interval instead of extending the last
  // source-rate frame across a tariff/model boundary. MP4 container duration is measured
  // in milliseconds. Rounding down here changes bytes, never declared/stored metadata;
  // exact integer minima remain exact. A rational cadence at or below the source fps
  // and matching track timescale represent every selected frame interval exactly.
  const durationMs = Math.floor(Math.min(length, maxDurationSec ?? length) * 1000 + 1e-8);
  const frameCount = Math.floor(durationMs / 1000 * facts.fps + 1e-8);
  if (frameCount < 1) throw new VideoExcerptError('PARAMETER_INVALID','Choose an excerpt containing at least one complete video frame.');
  const frameRate = `${frameCount * 1000}/${durationMs}`;
  // The bundled Linux AAC muxer includes its 1024-sample priming frame in the
  // container duration. Reserve that interval in the encoded audio, not in stored
  // metadata. Let -t finish both encoders: -frames:v can stop audio before flushing.
  const audioArgs = facts.hasAudio
    ? ['-ar','48000','-af',`atrim=end=${range.startSec + durationMs / 1000 - 1024 / 48000}`]
    : [];
  return workspace(async directory => {
    const source = join(directory,'source'), output = join(directory,'excerpt.mp4'); await writeFile(source,bytes);
    // FFmpeg autorotates the decoded image; stripping metadata avoids a second display rotation.
    await exec(await ensureExecutableFfmpegPath(ffmpeg.path), ['-hide_banner','-loglevel','error','-nostdin','-threads','2','-protocol_whitelist','file,pipe','-i',source,'-ss',String(range.startSec),'-t',String(durationMs / 1000),'-map',`0:${facts.videoStreamIndex ?? 0}`,'-map','0:a:0?','-map_metadata','-1','-c:v','libx264','-r',frameRate,'-video_track_timescale',String(frameCount * 1000),'-pix_fmt','yuv420p','-preset','veryfast','-crf','18','-threads','2','-c:a','aac','-b:a','192k',...audioArgs,'-movflags','+faststart','-fs',String(VIDEO_EXCERPT_PREPARATION_LIMITS.maxBytes),'-y',output], {timeout:90_000,maxBuffer:1024*1024});
    if ((await stat(output)).size > VIDEO_EXCERPT_PREPARATION_LIMITS.maxBytes) throw limitError();
    const result = await readFile(output), measured = await inspectVideoExcerptBytes(result,'video/mp4');
    validateVideoExcerptOutput(facts,measured,range);
    return {bytes:result,facts:measured};
  });
}
