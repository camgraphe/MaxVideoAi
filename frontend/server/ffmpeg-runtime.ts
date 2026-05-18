import { constants as fsConstants } from 'node:fs';
import { access, chmod, copyFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const executableFfmpegCopies = new Map<string, string>();

export async function ensureExecutableFfmpegPath(ffmpegPath: string): Promise<string> {
  await access(ffmpegPath, fsConstants.R_OK);
  try {
    await access(ffmpegPath, fsConstants.X_OK);
    return ffmpegPath;
  } catch {
    const cached = executableFfmpegCopies.get(ffmpegPath);
    if (cached) {
      try {
        await access(cached, fsConstants.X_OK);
        return cached;
      } catch {
        executableFfmpegCopies.delete(ffmpegPath);
      }
    }
  }

  const tempDir = await mkdtemp(path.join(tmpdir(), 'mv-ffmpeg-'));
  const tempBinary = path.join(tempDir, path.basename(ffmpegPath) || 'ffmpeg');
  await copyFile(ffmpegPath, tempBinary);
  await chmod(tempBinary, 0o755);
  await access(tempBinary, fsConstants.X_OK);
  executableFfmpegCopies.set(ffmpegPath, tempBinary);
  return tempBinary;
}
