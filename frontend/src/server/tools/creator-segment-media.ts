import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import ffmpeg from '@ffmpeg-installer/ffmpeg';
import ffprobe from 'ffprobe-static';
import sharp from 'sharp';
import { ensureExecutableFfmpegPath } from '@/server/ffmpeg-runtime';
import { createBoundedMediaDownloader } from '@/server/agent-api/reference-file-download';
import { creatorSegmentSchema, type CreatorSegment } from '@/lib/toolbox/creator-tools';
import type { CreatorMediaFacts } from './creator-profiles';
import { AgentApiError } from '@/server/agent-api/errors';
class CreatorMediaError extends AgentApiError { constructor(message:string){super('PARAMETER_INVALID',message);} }

const exec = promisify(execFile);
const MAX_BYTES = 100 * 1024 * 1024;
export const downloadCreatorMedia = createBoundedMediaDownloader({ accepted: ['image/png','image/jpeg','image/webp','video/mp4','video/quicktime','video/webm','audio/wav','audio/x-wav','audio/mpeg','audio/mp4','audio/aac','audio/ogg','audio/flac'], maxBytes: MAX_BYTES });
const activeAccounts = new Set<string>();
export async function withCreatorMediaSlot<T>(userId: string, work: () => Promise<T>): Promise<T> {
  if (activeAccounts.has(userId) || activeAccounts.size >= 2) throw new CreatorMediaError('Media preparation is busy. Retry shortly.');
  activeAccounts.add(userId);
  try { return await work(); } finally { activeAccounts.delete(userId); }
}
export function validateCreatorSegment(segment: CreatorSegment | undefined, duration: number): CreatorSegment | null {
  if (!Number.isFinite(duration) || duration <= 0) throw new CreatorMediaError('Source duration is unavailable.');
  if (!segment) return null;
  const parsed = creatorSegmentSchema.parse(segment);
  if (parsed.endSec > duration + 0.001) throw new CreatorMediaError('The segment exceeds the source duration.');
  return parsed;
}
/** One-frame container tolerance only; neither timing nor audio samples are stretched or cut. */
export function validateCreatorOutputTiming(expected: number, actual: number | null, fps: number | null): void {
  const tolerance = Math.max(0.025, 1 / (fps && fps >= 16 ? fps : 30));
  if (!Number.isFinite(expected) || expected <= 0 || actual == null || !Number.isFinite(actual) || Math.abs(actual - expected) > tolerance) throw new CreatorMediaError('Output duration differs from the selected source. No audio was cut or looped.');
}
async function workspace<T>(run: (directory: string) => Promise<T>): Promise<T> {
  const directory = await mkdtemp(join(tmpdir(), 'creator-media-'));
  try { return await run(directory); } finally { await rm(directory, { recursive: true, force: true }); }
}
export async function inspectCreatorBytes(bytes: Uint8Array, kind: CreatorMediaFacts['kind'], mimeType: string): Promise<CreatorMediaFacts> {
  if (!bytes.length || bytes.length > MAX_BYTES) throw new CreatorMediaError('Media exceeds the preparation limit.');
  if (kind === 'image') {
    const metadata = await sharp(bytes, { limitInputPixels: 40_000_000 }).metadata();
    if (!metadata.width || !metadata.height || (metadata.pages ?? 1) !== 1) throw new CreatorMediaError('Choose a still image.');
    return { kind, width: metadata.width, height: metadata.height, durationSec: null, fps: null, hasAudio: false, sizeBytes: bytes.length, mimeType };
  }
  return workspace(async directory => {
    const path = join(directory, 'source'); await writeFile(path, bytes);
    const { stdout } = await exec(ffprobe.path!, ['-v','error','-protocol_whitelist','file,pipe','-show_entries','stream=codec_type,width,height,avg_frame_rate,duration,start_time:format=duration','-of','json',path], { timeout: 15_000, maxBuffer: 1024 * 1024 });
    const data = JSON.parse(stdout) as { streams: Array<{codec_type:string;width?:number;height?:number;avg_frame_rate?:string;duration?:string;start_time?:string}>; format?:{duration?:string} };
    const video = data.streams.find(stream => stream.codec_type === 'video');
    const audio = data.streams.find(stream => stream.codec_type === 'audio');
    if ((kind === 'video' && !video) || (kind === 'audio' && (!audio || video))) throw new CreatorMediaError('The measured media kind does not match the selected source.');
    const durationSec = Number((kind === 'audio' ? audio?.duration : video?.duration) ?? data.format?.duration);
    const [n,d] = (video?.avg_frame_rate ?? '').split('/').map(Number);
    const fps = video ? n / d : null;
    if (!Number.isFinite(durationSec) || durationSec <= 0 || durationSec > 180 || (video && (!video.width || !video.height || video.width*video.height>16_777_216 || !fps || !Number.isFinite(fps) || fps>120))) throw new CreatorMediaError('Source metadata is invalid or exceeds the media preparation limits.');
    const audioDuration=Number(audio?.duration??(kind==='audio'?data.format?.duration:undefined));
    const audioStart=Number(audio?.start_time??(kind==='audio'?0:undefined));
    return { kind, width: video?.width ?? null, height: video?.height ?? null, durationSec, fps, hasAudio: Boolean(audio), sizeBytes: bytes.length, mimeType,
      audioDurationSec:audio&&Number.isFinite(audioDuration)?audioDuration:null,audioStartSec:audio&&Number.isFinite(audioStart)?audioStart:null };
  });
}
async function readOutput(path: string): Promise<Buffer> {
  if ((await stat(path)).size > MAX_BYTES) throw new CreatorMediaError('Prepared output exceeds 100 MB.');
  return readFile(path);
}
export async function trimCreatorBytes(bytes: Uint8Array, facts: CreatorMediaFacts, segment: CreatorSegment): Promise<{bytes:Buffer;facts:CreatorMediaFacts}> {
  validateCreatorSegment(segment, facts.durationSec ?? 0);
  if (facts.kind === 'image' || segment.endSec - segment.startSec > (facts.kind==='video'?30:20)) throw new CreatorMediaError('Choose a video segment of at most 30 seconds or an audio segment of at most 20 seconds.');
  return workspace(async directory => {
    const source = join(directory,'source'), output = join(directory, facts.kind === 'audio' ? 'segment.wav' : 'segment.mp4');
    await writeFile(source,bytes);
    const audio = facts.kind === 'audio';
    const args = ['-hide_banner','-loglevel','error','-nostdin','-threads','2','-protocol_whitelist','file,pipe','-i',source,'-ss',String(segment.startSec),'-t',String(segment.endSec-segment.startSec),...(audio ? ['-map','0:a:0','-c:a','pcm_s16le'] : ['-map','0:v:0','-map','0:a:0?','-c:v','libx264','-preset','veryfast','-crf','18','-threads','2','-c:a','aac','-b:a','192k','-movflags','+faststart']),'-fs',String(MAX_BYTES),'-y',output];
    await exec(await ensureExecutableFfmpegPath(ffmpeg.path),args,{timeout:90_000,maxBuffer:1024*1024});
    const result = await readOutput(output);
    const measured = await inspectCreatorBytes(result,facts.kind,audio ? 'audio/wav' : 'video/mp4');
    validateCreatorOutputTiming(segment.endSec-segment.startSec,measured.durationSec,measured.fps);
    if (facts.hasAudio !== measured.hasAudio) throw new CreatorMediaError('Segment audio could not be preserved.');
    return {bytes:result,facts:measured};
  });
}
export function buildCreatorMuxArgs(video: string, audio: string | null, output: string): string[] {
  return ['-hide_banner','-loglevel','error','-nostdin','-threads','2','-protocol_whitelist','file,pipe','-i',video,...(audio ? ['-protocol_whitelist','file,pipe','-i',audio] : []),'-map','0:v:0',...(audio ? ['-map','1:a:0','-c:a','aac','-b:a','192k'] : ['-an']),'-c:v','copy','-movflags','+faststart','-fs',String(MAX_BYTES),'-y',output];
}
export async function muxCreatorBytes(videoBytes: Uint8Array, audioBytes: Uint8Array | null): Promise<{bytes:Buffer;facts:CreatorMediaFacts}> {
  return workspace(async directory => {
    const video=join(directory,'video'), audio=audioBytes ? join(directory,'audio') : null, output=join(directory,'result.mp4');
    await writeFile(video,videoBytes); if(audio && audioBytes) await writeFile(audio,audioBytes);
    await exec(await ensureExecutableFfmpegPath(ffmpeg.path),buildCreatorMuxArgs(video,audio,output),{timeout:90_000,maxBuffer:1024*1024});
    const bytes=await readOutput(output);
    return {bytes,facts:await inspectCreatorBytes(bytes,'video','video/mp4')};
  });
}
