import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveGenerateSourceVideoContext } from '../frontend/app/api/generate/_lib/source-video-context';
import type { NormalizedAttachment } from '../frontend/app/api/generate/_lib/attachments';

const sourceVideoAttachment = (durationSec: number): NormalizedAttachment => ({
  name: 'source.mp4',
  type: 'video/mp4',
  size: 100,
  kind: 'video',
  slotId: 'video_url',
  url: 'https://cdn.maxvideoai.com/source.mp4',
  durationSec,
});

test('source-video context derives duration labels and video presence', () => {
  assert.deepEqual(
    resolveGenerateSourceVideoContext({
      mode: 'reframe',
      attachments: [sourceVideoAttachment(8.2)],
      sourceInputVideoUrl: 'https://cdn.maxvideoai.com/source.mp4',
      videoUrls: ['https://cdn.maxvideoai.com/source.mp4'],
      fallbackDurationSec: 5,
      fallbackDurationLabel: '5s',
      maxDurationSec: 30,
      engineLabel: 'Test Engine',
    }),
    {
      ok: true,
      durationSec: 9,
      durationLabel: '9s',
      hasVideoInput: true,
    }
  );

  assert.deepEqual(
    resolveGenerateSourceVideoContext({
      mode: 't2v',
      attachments: [],
      videoUrls: [],
      fallbackDurationSec: 5,
      fallbackDurationLabel: '5s',
      maxDurationSec: 30,
      engineLabel: 'Test Engine',
    }),
    {
      ok: true,
      durationSec: 5,
      durationLabel: '5s',
      hasVideoInput: false,
    }
  );
});

test('source-video context returns the route rejection contract when the input is too long', () => {
  assert.deepEqual(
    resolveGenerateSourceVideoContext({
      mode: 'v2v',
      attachments: [sourceVideoAttachment(31)],
      sourceInputVideoUrl: 'https://cdn.maxvideoai.com/source.mp4',
      videoUrls: ['https://cdn.maxvideoai.com/source.mp4'],
      fallbackDurationSec: 5,
      fallbackDurationLabel: '5s',
      maxDurationSec: 30,
      engineLabel: 'Test Engine',
    }),
    {
      ok: false,
      status: 422,
      body: {
        ok: false,
        error: 'SOURCE_VIDEO_DURATION_UNSUPPORTED',
        message: 'Source video must be 30s or shorter for Test Engine.',
      },
      metric: {
        errorCode: 'SOURCE_VIDEO_DURATION_UNSUPPORTED',
        meta: {
          sourceDurationSec: 31,
          maxDurationSec: 30,
          mode: 'v2v',
        },
      },
    }
  );
});
