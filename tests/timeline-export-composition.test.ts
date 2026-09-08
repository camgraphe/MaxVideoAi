import assert from 'node:assert/strict';
import test from 'node:test';
import { timelineExportIdFromIdempotencyKey } from '../frontend/src/server/timeline-exports/repository';
import { parseTimelineExportRequest } from '../frontend/src/server/timeline-exports/render-request';

test('export transport preserves exact valid keys and rejects surrounding whitespace', () => {
  const request = {
    version: 1, source: 'maxvideoai-editor', projectId: 'project-a', idempotencyKey: 'request:a',
    createdAt: '2026-09-08T00:00:00.000Z', status: 'ready',
    manifest: { version: 1, source: 'maxvideoai-editor', projectName: 'Test', sequenceId: 'main', sequenceName: 'Main',
      createdAt: '2026-09-08T00:00:00.000Z', status: 'ready', durationSec: 5, issues: [],
      exportRange: { mode: 'sequence', startSec: 0, endSec: 5, durationSec: 5 },
      tracks: [{ id: 'video', durationSec: 5, clips: [{ id: 'clip', outputNodeId: 'output', assetId: 'asset',
        title: 'Clip', track: 'video', mediaKind: 'video', mediaUrl: 'https://example.invalid/exact.mp4',
        startSec: 0, endSec: 5, durationSec: 5, sourceStartSec: 0, sourceEndSec: 5 }] }],
    },
    exportSettings: { format: 'mp4-h264', qualityPreset: 'standard', includeAudio: true, serverRenderMode: 'server' },
  };
  assert.equal(parseTimelineExportRequest(request).idempotencyKey, 'request:a');
  for (const key of [' request:a', 'request:a ', 'x'.repeat(201), 'short']) {
    assert.throws(() => parseTimelineExportRequest({ ...request, idempotencyKey: key }), /INVALID_EXPORT_REQUEST/);
  }
});

test('export identity distinguishes exact keys, suffixes and accounts', () => {
  const identify = timelineExportIdFromIdempotencyKey as (key: string, userId: string) => string;
  const ids = [identify('request:a', 'account-a'), identify('requesta', 'account-a'),
    identify('request:a', 'account-b'), identify(`${'a'.repeat(80)}:first`, 'account-a'),
    identify(`${'a'.repeat(80)}:second`, 'account-a')];
  assert.equal(new Set(ids).size, 5);
  assert.equal(identify('request:a', 'account-a'), ids[0]);
});

test('export identity rejects invalid exact keys without normalization', () => {
  for (const key of ['', 'short', ' request:a', 'request:a ', 'request/a', 'x'.repeat(201)]) {
    assert.throws(() => timelineExportIdFromIdempotencyKey(key, 'account-a'), /idempotency/i);
  }
});

test('renderer uses 1440p dimensions and retains supported heights and aspect ratios', async () => {
  const renderer = await import('../frontend/src/server/timeline-exports/renderer');
  const dimensions = Reflect.get(renderer, 'renderDimensions');
  assert.equal(typeof dimensions, 'function');
  for (const [resolution, aspectRatio, width, height] of [
    ['1440p', '16:9', 2560, 1440], ['1440p', '1:1', 1440, 1440], ['1440p', '9:16', 810, 1440],
    ['720p', '16:9', 1280, 720], ['1080p', '16:9', 1920, 1080],
    ['2160p', '16:9', 3840, 2160], ['4k', '16:9', 3840, 2160], [null, '16:9', 1920, 1080],
  ]) assert.deepEqual(dimensions({ projectSettings: { aspectRatio } }, resolution), { width, height });
});
