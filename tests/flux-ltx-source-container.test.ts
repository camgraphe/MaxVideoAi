import assert from 'node:assert/strict';
import test from 'node:test';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ffmpeg from '../frontend/node_modules/@ffmpeg-installer/ffmpeg';
import { ensureExecutableFfmpegPath } from '../frontend/server/ffmpeg-runtime';
import { inspectVideoExcerptBytes } from '../frontend/server/video-excerpts/media';
import { inspectOwnedFluxLtxSource } from '../frontend/server/video-excerpts/flux-ltx-source';

const exec = promisify(execFile);
test('FAST checks actual MOV/MP4 bytes independently of canonical MIME, filename and declared type', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'flux-container-'));
  try {
    const binary = await ensureExecutableFfmpegPath(ffmpeg.path);
    const mp4 = join(directory, 'source.mp4'), mov = join(directory, 'source.mov');
    await exec(binary, ['-v','error','-f','lavfi','-i','testsrc2=s=160x120:r=24:d=2','-c:v','libx264','-threads','1','-an','-y',mp4], {timeout:15_000});
    await exec(binary, ['-v','error','-i',mp4,'-c','copy','-f','mov','-y',mov], {timeout:15_000});
    for (const path of [mp4,mov]) {
      const bytes = await readFile(path);
      const declaredMime = path === mov ? 'video/mp4' : 'video/quicktime';
      const facts = await inspectVideoExcerptBytes(bytes, declaredMime);
      assert.equal(facts.mimeType, 'video/mp4', 'legacy canonical MIME remains unchanged');
      const dependencies = {createReadUrl:async()=> 'local-only',download:async()=>({bytes,mimeType:declaredMime,fileName:'misleading.mp4'}),inspect:inspectVideoExcerptBytes};
      if (path === mov) await assert.rejects(inspectOwnedFluxLtxSource('owned', 'flux-fast-edit', 'local-test', dependencies), {code:'REFERENCE_INVALID'});
      else {
        const admitted = await inspectOwnedFluxLtxSource('owned', 'flux-fast-edit', 'local-test', dependencies);
        assert.equal(admitted.durationSec, 2); assert.equal(admitted.sizeBytes, bytes.length);
      }
      assert.deepEqual(await readFile(path), bytes, 'inspection never converts or rewrites the original');
    }
  } finally { await rm(directory, {recursive:true,force:true}); }
});
