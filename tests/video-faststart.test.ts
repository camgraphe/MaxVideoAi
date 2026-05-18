import assert from 'node:assert/strict';
import { constants as fsConstants } from 'node:fs';
import { access, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { ensureExecutableFfmpegPath } from '../frontend/server/ffmpeg-runtime.ts';

test('copies a non-executable ffmpeg binary to an executable temp path', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'mv-ffmpeg-test-'));
  try {
    const source = path.join(dir, 'ffmpeg');
    await writeFile(source, '#!/bin/sh\nexit 0\n', { mode: 0o644 });

    const executable = await ensureExecutableFfmpegPath(source);

    assert.notEqual(executable, source);
    await access(executable, fsConstants.X_OK);
    assert.equal((await stat(executable)).isFile(), true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('server ffmpeg callers normalize the packaged binary before execFile', async () => {
  const ffmpegCallers = [
    'frontend/server/thumbnails.ts',
    'frontend/server/video-keyframes.ts',
    'frontend/server/video-preview.ts',
    'frontend/server/upload-thumbnails.ts',
    'frontend/src/server/audio/media.ts',
    'frontend/server/video-faststart.ts',
  ];

  for (const relativePath of ffmpegCallers) {
    const source = await readFile(path.join(process.cwd(), relativePath), 'utf8');
    assert.match(source, /ensureExecutableFfmpegPath/, `${relativePath} should normalize ffmpeg permissions`);
  }
});
