import assert from 'node:assert/strict';
import test from 'node:test';

import { mapSelectedPreviewToGroup, mapSharedVideoToGroup } from '../frontend/lib/video-preview-group';

test('selected preview fallback maps thumb-only previews into a renderable group', () => {
  const group = mapSelectedPreviewToGroup(
    {
      id: 'job_preview_1',
      batchId: 'batch_preview_1',
      thumbUrl: 'https://cdn.example.com/preview.jpg',
      aspectRatio: '9:16',
      status: 'pending',
      prompt: 'A cinematic portrait shot',
    },
    'fal'
  );

  assert.ok(group);
  assert.equal(group?.layout, 'x1');
  assert.equal(group?.status, 'loading');
  assert.equal(group?.items[0]?.url, 'https://cdn.example.com/preview.jpg');
  assert.equal(group?.items[0]?.thumb, 'https://cdn.example.com/preview.jpg');
  assert.equal(group?.items[0]?.aspect, '9:16');
  assert.equal(group?.items[0]?.meta?.mediaType, 'image');
});

test('selected preview fallback returns null when there is no media to display', () => {
  const group = mapSelectedPreviewToGroup(
    {
      id: 'job_preview_2',
      batchId: 'batch_preview_2',
      prompt: 'Missing media',
    },
    'fal'
  );

  assert.equal(group, null);
});

test('shared video mapping keeps completed video previews ready', () => {
  const group = mapSharedVideoToGroup(
    {
      id: 'job_shared_1',
      engineId: 'veo-3',
      engineLabel: 'Veo 3',
      durationSec: 8,
      prompt: 'Tracking shot',
      videoUrl: 'https://cdn.example.com/clip.mp4',
      thumbUrl: 'https://cdn.example.com/clip.jpg',
      aspectRatio: '16:9',
      createdAt: '2026-03-27T09:00:00.000Z',
    },
    'fal'
  );

  assert.equal(group.status, 'ready');
  assert.equal(group.items[0]?.url, 'https://cdn.example.com/clip.mp4');
  assert.equal(group.items[0]?.thumb, 'https://cdn.example.com/clip.jpg');
  assert.equal(group.items[0]?.meta?.mediaType, 'video');
});
