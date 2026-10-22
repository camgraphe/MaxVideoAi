import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { ensureExecutableFfmpegPath } from '@/server/ffmpeg-runtime';

const run = promisify(execFile);
const requireForRuntime = createRequire(import.meta.url);

/** Fulfil an explicit silent-output request; video packets are copied, never re-encoded.
 * Call only on a downloaded generated output, never on the user's source asset. */
export async function removeGeneratedVideoAudio(data: Buffer): Promise<Buffer> {
  if (!data.length) throw new Error('Generated video is empty.');
  const binary = requireForRuntime('@ffmpeg-installer/ffmpeg') as { path: string };
  const executable = await ensureExecutableFfmpegPath(binary.path);
  const dir = await mkdtemp(join(tmpdir(), 'mv-silent-output-'));
  try {
    const input = join(dir, 'input.mp4');
    const output = join(dir, 'output.mp4');
    await writeFile(input, data, { mode: 0o600 });
    await run(executable, ['-hide_banner', '-loglevel', 'error', '-nostdin',
      '-protocol_whitelist', 'file,pipe', '-i', input, '-map', '0:v:0', '-c:v', 'copy',
      '-an', '-sn', '-dn', '-movflags', '+faststart', output], { timeout: 30_000, maxBuffer: 1024 * 1024 });
    const silent = await readFile(output);
    if (!silent.length) throw new Error('Silent generated video is empty.');
    return silent;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
