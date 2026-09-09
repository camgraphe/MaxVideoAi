import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import ffprobe from 'ffprobe-static';
import { createBoundedMediaDownloader } from '@/server/agent-api/reference-file-download';
import { videoUploadLimitBytes } from '@/app/api/uploads/video/_lib/video-upload-limits';

const execFileAsync = promisify(execFile);
export const downloadAudioSourceVideo = createBoundedMediaDownloader({
  accepted: ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v'],
  maxBytes: videoUploadLimitBytes(),
});

async function probeFile(file: string) {
  if (!ffprobe.path) throw new Error('Video inspection is unavailable.');
  const { stdout } = await execFileAsync(ffprobe.path, [
    '-v', 'error', '-protocol_whitelist', 'file,pipe', '-format_whitelist', 'mov,matroska,webm',
    '-show_entries', 'stream=codec_type,width,height,duration:stream_disposition=attached_pic:format=duration',
    '-of', 'json', file,
  ], { timeout: 15_000, maxBuffer: 1024 * 1024 });
  return JSON.parse(stdout) as {
    streams?: Array<{ codec_type?: string; width?: number; height?: number; duration?: string; disposition?: { attached_pic?: number } }>;
    format?: { duration?: string };
  };
}

/** Resolve public DNS and bound redirects/bytes before inspecting a local file. Original signed URLs remain untouched. */
export async function inspectSourceVideo(videoUrl: string, dependencies = { download: downloadAudioSourceVideo, probe: probeFile }) {
  const file = await dependencies.download({ file_id: 'audio-source-probe', download_url: videoUrl });
  const directory = await mkdtemp(join(tmpdir(), 'audio-source-probe-'));
  try {
    const source = join(directory, 'source');
    await writeFile(source, file.bytes);
    const metadata = await dependencies.probe(source);
    const video = metadata.streams?.find(stream => stream.codec_type === 'video' && stream.disposition?.attached_pic !== 1);
    const durationSec = Number(metadata.format?.duration ?? video?.duration);
    if (!video || ![durationSec, video.width, video.height].every(value => typeof value === 'number' && Number.isFinite(value) && value > 0)) {
      throw new Error('Video metadata is unavailable.');
    }
    return { durationSec, width: video.width!, height: video.height!, hasAudio: Boolean(metadata.streams?.some(stream => stream.codec_type === 'audio')) };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
