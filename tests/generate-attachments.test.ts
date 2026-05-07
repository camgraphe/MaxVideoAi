import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { processGenerationAttachments } from '../frontend/app/api/generate/_lib/attachments';

const root = process.cwd();
const routePath = join(root, 'frontend/app/api/generate/route.ts');
const helperPath = join(root, 'frontend/app/api/generate/_lib/attachments.ts');

const routeSource = readFileSync(routePath, 'utf8');
const helperSource = readFileSync(helperPath, 'utf8');

test('generate route delegates attachment normalization and inline uploads', () => {
  assert.ok(existsSync(helperPath), 'attachment processing should live in the generate route _lib folder');
  assert.match(routeSource, /from '\.\/_lib\/attachments'/);
  assert.doesNotMatch(routeSource, /type NormalizedAttachment =/, 'attachment type belongs in attachments.ts');
  assert.doesNotMatch(routeSource, /function decodeDataUrl\(/, 'data URL decoding belongs in attachments.ts');
  assert.doesNotMatch(routeSource, /uploadImageToStorage/, 'inline upload belongs in attachments.ts');
  assert.doesNotMatch(routeSource, /recordUserAsset/, 'inline asset recording belongs in attachments.ts');
  assert.doesNotMatch(routeSource, /probeImageUrl/, 'image URL probing belongs in attachments.ts');
  assert.doesNotMatch(routeSource, /isAllowedAssetHost/, 'asset host allow-list checks belong in attachments.ts');

  const lineCount = routeSource.split('\n').length;
  assert.ok(lineCount <= 2250, `/api/generate route should stay below 2250 lines after attachment extraction, got ${lineCount}`);
});

test('attachment helper exposes the route contract', () => {
  assert.match(helperSource, /export type NormalizedAttachment =/, 'NormalizedAttachment should be exported');
  assert.match(helperSource, /export async function processGenerationAttachments/, 'processGenerationAttachments should be exported');
  assert.match(helperSource, /function decodeDataUrl/, 'data URL decoding should stay private');
  assert.match(helperSource, /uploadImageToStorage/, 'inline upload should stay with attachment processing');
  assert.match(helperSource, /recordUserAsset/, 'inline asset recording should stay with attachment processing');
});

test('attachment helper accepts existing allowed-host video URLs', async () => {
  const result = await processGenerationAttachments({
    userId: 'user_123',
    rawInputs: [
      {
        name: 'clip.mp4',
        kind: 'video',
        type: 'video/mp4',
        size: 1234,
        slotId: 'video_url',
        label: undefined,
        url: 'https://cdn.maxvideoai.com/uploads/clip.mp4',
        width: 1280,
        height: 720,
        assetId: 'asset_123',
      },
    ],
  });

  assert.deepEqual(result, {
    ok: true,
    attachments: [
      {
        name: 'clip.mp4',
        kind: 'video',
        type: 'video/mp4',
        size: 1234,
        slotId: 'video_url',
        label: undefined,
        url: 'https://cdn.maxvideoai.com/uploads/clip.mp4',
        width: 1280,
        height: 720,
        assetId: 'asset_123',
      },
    ],
  });
});

test('attachment helper preserves route validation failures', async () => {
  assert.deepEqual(
    await processGenerationAttachments({
      userId: 'user_123',
      rawInputs: [{ kind: 'video', type: 'image/png', name: 'not-video.png' }],
    }),
    {
      ok: false,
      status: 422,
      body: {
        ok: false,
        error: 'INVALID_VIDEO_ASSET',
        message: 'The selected source is not a video. Choose an MP4/MOV clip and try again.',
      },
    }
  );

  assert.deepEqual(
    await processGenerationAttachments({
      userId: 'user_123',
      rawInputs: [{ kind: 'audio', type: 'audio/mpeg', dataUrl: 'data:audio/mpeg;base64,AAAA' }],
    }),
    {
      ok: false,
      status: 400,
      body: {
        ok: false,
        error: 'INLINE_ASSET_UNSUPPORTED',
        message: 'Inline audio/video uploads are not supported.',
      },
    }
  );

  assert.deepEqual(
    await processGenerationAttachments({
      userId: 'user_123',
      rawInputs: [{ kind: 'video', type: 'video/mp4', url: 'https://example.com/clip.mp4' }],
    }),
    {
      ok: false,
      status: 422,
      body: {
        ok: false,
        error: 'IMAGE_HOST_NOT_ALLOWED',
        url: 'https://example.com/clip.mp4',
      },
    }
  );
});
