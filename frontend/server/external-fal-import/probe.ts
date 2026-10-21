import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { factsFromProbe } from '@/lib/generated-video-media-facts';

/** Operator CLI probe, using installed ffprobe. Local bytes only; never follow network inputs. */
export async function probeExternalImportVideo(bytes: Buffer, original: { url: string; sha256: string; sizeBytes: number }) {
  const directory = await mkdtemp(join(tmpdir(), 'external-fal-import-'));
  try {
    const file = join(directory, 'original.mp4');
    await writeFile(file, bytes, { mode: 0o600 });
    const { stdout } = await promisify(execFile)('ffprobe', ['-v','error','-protocol_whitelist','file,pipe',
      '-show_entries','stream=codec_type,duration,width,height:stream_disposition=attached_pic:format=duration', '-of','json',file],
      { timeout: 30_000, maxBuffer: 1024 * 1024 });
    const probe = JSON.parse(stdout);
    const stream = probe.streams?.find((stream: { codec_type?: string; disposition?: { attached_pic?: number } }) => stream.codec_type === 'video' && stream.disposition?.attached_pic !== 1);
    const mediaFacts = factsFromProbe(probe, original);
    if (!mediaFacts || !Number.isSafeInteger(stream?.width) || stream.width <= 0 || !Number.isSafeInteger(stream?.height) || stream.height <= 0) throw new Error('IMPORT_VIDEO_PROBE_REQUIRED');
    return { width: stream.width as number, height: stream.height as number,
      hasAudio: probe.streams.some((stream: { codec_type?: string }) => stream.codec_type === 'audio') as boolean, mediaFacts };
  } finally { await rm(directory, { recursive: true, force: true }); }
}
