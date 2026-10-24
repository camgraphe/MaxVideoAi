import type { VideoExcerptRange } from '@/lib/video-excerpt';
import { AgentApiError } from '@/server/agent-api/errors';
import { createOwnedMediaReadUrl } from '@/server/owned-media-read-access';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import ffmpeg from '@ffmpeg-installer/ffmpeg';
import { ensureExecutableFfmpegPath } from '@/server/ffmpeg-runtime';
import { planH3RelightCopy, validateH3Source, type H3SourceOperation } from '@/lib/h3-source-operations';
import { downloadVideoExcerptMedia, inspectVideoExcerptBytes, withVideoExcerptSlot, VideoExcerptError, type VideoExcerptFacts } from './media';

/** Caller must first resolve this exact storage URL through account-owned assets. */
export async function inspectOwnedH3Source(url: string, operation: H3SourceOperation, userId: string, dependencies = {createReadUrl:createOwnedMediaReadUrl,download:downloadVideoExcerptMedia,inspect:inspectVideoExcerptBytes}) {
 try { return await withVideoExcerptSlot(userId, async () => {
  const accessUrl = await dependencies.createReadUrl({url,userId,expiresInSeconds:300});
  const downloaded = await dependencies.download({file_id:'owned-h3-source',download_url:accessUrl});
  const facts = await dependencies.inspect(downloaded.bytes, downloaded.mimeType, {decodedFrames: operation === 'h3-relight'});
  const error = validateH3Source(operation,facts);
  if (error) throw new Error(error);
  return {...facts, ...(operation === 'h3-relight' ? {durationSec:facts.decodedFrameCount!/24} : {}), sourceSha256:createHash('sha256').update(downloaded.bytes).digest('hex')};
 }); } catch (error) {
  if (error instanceof VideoExcerptError && error.code === 'PREPARATION_BUSY') throw new AgentApiError('RATE_LIMITED', error.message, true);
  throw error;
 }
}
/** Explicit opt-in compatible copy; never changes the original or the generic excerpt profile.
 * Present plan.actual duration BEFORE calling. Task6 routes/persists the resulting owned copy. */
export async function prepareH3RelightCopy(bytes: Uint8Array, mimeType: string, range?: VideoExcerptRange): Promise<{bytes:Buffer;facts:VideoExcerptFacts; plan:ReturnType<typeof planH3RelightCopy>;sourceSha256:string}> {
  const source = await inspectVideoExcerptBytes(bytes,mimeType,{decodedFrames:true});
  const selected = range ?? { startSec: 0, endSec: source.durationSec };
  if (selected.startSec < 0 || selected.endSec > source.durationSec || selected.endSec <= selected.startSec) throw new Error('Choose a valid source range.');
  const plan = planH3RelightCopy(selected.endSec - selected.startSec);
  const directory = await mkdtemp(join(tmpdir(),'h3-relight-'));
  try {
    const input = join(directory,'source'), output = join(directory,'relight.mp4');
    await writeFile(input,bytes);
    await promisify(execFile)(await ensureExecutableFfmpegPath(ffmpeg.path),[
      '-hide_banner','-loglevel','error','-nostdin','-threads','2','-protocol_whitelist','file,pipe','-ss',String(selected.startSec),'-i',input,
      '-map',`0:${source.videoStreamIndex??0}`,'-map','0:a:0?','-map_metadata','-1',
      '-vf',`fps=24,trim=end_frame=${plan.frameCount},setpts=PTS-STARTPTS`,
      '-t',String(plan.durationSec),'-c:v','libx264','-pix_fmt','yuv420p','-preset','veryfast','-crf','18','-threads','2',
      '-c:a','aac','-ar','48000', ...(source.hasAudio ? ['-af',`atrim=end=${plan.durationSec-1024/48000},asetpts=PTS-STARTPTS`] : []),
      '-movflags','+faststart','-y',output,
    ],{timeout:90_000,maxBuffer:1024*1024});
    const result = await readFile(output);
    const facts = await inspectVideoExcerptBytes(result,'video/mp4',{decodedFrames:true});
    const error = validateH3Source('h3-relight',facts);
    if (error || facts.decodedFrameCount!==plan.frameCount || facts.width!==source.width || facts.height!==source.height || facts.hasAudio!==source.hasAudio) throw new Error(error??'Compatible copy failed timing, geometry or audio verification.');
    return {bytes:result,facts:{...facts,durationSec:facts.decodedFrameCount!/24},plan,sourceSha256:createHash('sha256').update(bytes).digest('hex')};
  } finally { await rm(directory,{recursive:true,force:true}); }
}
