import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import ffprobe from 'ffprobe-static';
import { factsFromProbe, readGeneratedVideoFacts, type GeneratedVideoFacts, type VideoProbeResult } from '@/lib/generated-video-media-facts';

const execute = promisify(execFile);
const MAX_BUFFER_BYTES = 80 * 1024 * 1024;
export async function probeGeneratedVideoFile(filePath: string): Promise<VideoProbeResult | null> {
  try {
    // Local generated temporary files only. Prevent ffprobe from following network references.
    const { stdout } = await execute(ffprobe.path, ['-v', 'error', '-protocol_whitelist', 'file,pipe',
      '-show_entries', 'stream=codec_type,duration:stream_disposition=attached_pic:format=duration',
      '-of', 'json', filePath], { timeout: 12_000, maxBuffer: 1024 * 1024 });
    return JSON.parse(stdout) as VideoProbeResult;
  } catch { return null; }
}
export function publishVideoFacts(probe: VideoProbeResult | null, original: GeneratedVideoFacts['original'],
  callback?: (facts: GeneratedVideoFacts) => void): void {
  try {
    if (!probe || !callback) return;
    const facts = factsFromProbe(probe, original);
    if (facts) callback(facts);
  } catch { /* Optional measurements cannot invalidate a successful copy. */ }
}
export async function measureGeneratedVideoBuffer(buffer: Buffer, url: string,
  previous?: GeneratedVideoFacts | null, probe = probeGeneratedVideoFile): Promise<GeneratedVideoFacts | null> {
  if (!buffer.length) return null;
  const sha256 = createHash('sha256').update(buffer).digest('hex');
  const original = { url, sha256, sizeBytes: buffer.length };
  if (previous && readGeneratedVideoFacts(previous, previous.original.url)
    && previous.original.sha256 === sha256 && previous.original.sizeBytes === buffer.length) {
    return { ...previous, original }; // Verified byte-for-byte copy; avoid probing twice.
  }
  if (buffer.length > MAX_BUFFER_BYTES) return null;
  let directory: string | null = null;
  try {
    directory = await mkdtemp(join(tmpdir(), 'generated-video-facts-'));
    const file = join(directory, 'original.mp4');
    await writeFile(file, buffer);
    const result = await probe(file);
    return result ? factsFromProbe(result, original) : null;
  } catch { return null; }
  finally { if (directory) await rm(directory, { recursive: true, force: true }).catch(() => undefined); }
}
