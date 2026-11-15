import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import { persistFinishingOutput } from '../frontend/src/server/tools/finishing-output';
import type { PreparedFinishingTool } from '../frontend/src/server/tools/finishing-prepare';
import { readToolVideoBufferMetadata } from '../frontend/src/server/tools/toolbox-video-metadata';
import { finishingOutputFailureCode } from '../frontend/src/server/tools/finishing-errors';

test('an unreadable provider video is classified as invalid output', async () => {
  await assert.rejects(readToolVideoBufferMetadata(Buffer.from('This is not a video')),
    error => finishingOutputFailureCode(error) === 'TOOL_OUTPUT_INVALID');
});

test('the production FFprobe measures a rotated phone file in display orientation', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'finishing-rotation-test-'));
  try {
    const coded = join(directory, 'coded.mp4'), rotated = join(directory, 'rotated.mp4');
    execFileSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'color=black:s=48x32:r=24', '-t', '1', '-pix_fmt', 'yuv420p', coded]);
    execFileSync('ffmpeg', ['-v', 'error', '-display_rotation', '90', '-i', coded, '-c', 'copy', rotated]);
    const facts = await readToolVideoBufferMetadata(await readFile(rotated));
    assert.deepEqual([facts.width, facts.height, facts.fps], [32, 48, 24]);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('a finishing output over the import limit is probed from its existing bytes and delivered once', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'finishing-output-test-'));
  try {
    const path = join(directory, 'output.mp4');
    execFileSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'color=black:s=32x48:r=24', '-t', '1', '-pix_fmt', 'yuv420p', path]);
    const bytes = Buffer.concat([await readFile(path), Buffer.alloc(51 * 1024 * 1024)]);
    const calls: string[] = [];
    const prepared = { block: { toolId: 'denoise', version: 1, inputs: [] }, profile: { id: 'denoise-test' },
      settings: { quality: 'standard', strength: 'auto' }, facts: { width: 32, height: 48, durationSec: 1, fps: 24, hasAudio: false } } as unknown as PreparedFinishingTool;
    const result = await persistFinishingOutput('owner', 'job', prepared, { video: { url: 'https://provider.example/output.mp4' } }, {
      download: async () => { calls.push('download'); return { bytes, mimeType: 'video/mp4' } as never; },
      upload: async ({ data }) => { assert.equal(data.length, bytes.length); calls.push('upload'); return { url: 'https://owned.example/output.mp4' } as never; },
      thumbnail: async () => 'https://owned.example/thumb.jpg',
      upsert: async outputs => { assert.equal(outputs[0].width, 32); assert.equal(outputs[0].height, 48); calls.push('publish'); },
    });
    assert.deepEqual(calls, ['download', 'upload', 'publish']);
    assert.equal(result.outputs[0].originalUrl, 'https://owned.example/output.mp4');
  } finally { await rm(directory, { recursive: true, force: true }); }
});
