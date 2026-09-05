import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';

import { ensureExecutableFfmpegPath } from '../../server/ffmpeg-runtime';

const execFileAsync = promisify(execFile);

async function verifyScaleSupport(candidate: string): Promise<string> {
  const executable = path.isAbsolute(candidate) || candidate.includes(path.sep)
    ? await ensureExecutableFfmpegPath(candidate)
    : candidate;
  const { stdout, stderr } = await execFileAsync(executable, ['-hide_banner', '-h', 'filter=scale'], {
    timeout: 10_000,
    maxBuffer: 1024 * 1024,
  });
  if (!/\bforce_divisible_by\b/.test(`${stdout}\n${stderr}`)) {
    throw new Error('The scale filter does not support force_divisible_by');
  }
  return executable;
}

export async function resolvePublicVideoFfmpegPath({
  bundledPath,
  overridePath,
  verify = verifyScaleSupport,
}: {
  bundledPath: string;
  overridePath?: string;
  verify?: (candidate: string) => Promise<string>;
}): Promise<string> {
  const explicit = overridePath?.trim();
  const candidates = explicit ? [explicit] : [...new Set([bundledPath, 'ffmpeg'])];
  const failures: string[] = [];
  for (const candidate of candidates) {
    try {
      return await verify(candidate);
    } catch (error) {
      failures.push(`${candidate}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  throw new Error(
    `No compatible public-video FFmpeg found. Install a current FFmpeg with libx264 and ` +
    `scale force_divisible_by support, or set PUBLIC_VIDEO_FFMPEG_PATH. ${failures.join('; ')}`
  );
}
