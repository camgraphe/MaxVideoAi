import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import {
  deriveGenerationAttachmentReferences,
  resolveSourceVideoDurationSec,
} from '../frontend/app/api/generate/_lib/attachment-references';
import type { NormalizedAttachment } from '../frontend/app/api/generate/_lib/attachments';

const root = process.cwd();
const routePath = join(root, 'frontend/app/api/generate/route.ts');
const helperPath = join(root, 'frontend/app/api/generate/_lib/attachment-references.ts');

const routeSource = readFileSync(routePath, 'utf8');
const helperSource = readFileSync(helperPath, 'utf8');

const attachment = (overrides: Partial<NormalizedAttachment>): NormalizedAttachment => ({
  name: 'asset',
  type: 'application/octet-stream',
  size: 0,
  ...overrides,
});

test('generate route delegates attachment reference derivation', () => {
  assert.ok(existsSync(helperPath), 'attachment reference derivation should live in the generate route _lib folder');
  assert.match(routeSource, /from '\.\/_lib\/attachment-references'/);
  assert.doesNotMatch(routeSource, /attachmentPrimaryImageUrl/, 'primary image derivation belongs in attachment-references.ts');
  assert.doesNotMatch(routeSource, /requestedPrimaryImageUrl/, 'requested primary image fallback belongs in attachment-references.ts');
  assert.doesNotMatch(routeSource, /referenceImagesInput/, 'reference image input selection belongs in attachment-references.ts');
  assert.doesNotMatch(routeSource, /attachmentReferenceImageUrls/, 'attachment reference image selection belongs in attachment-references.ts');
  assert.doesNotMatch(routeSource, /const firstFrameUrl\s*=/, 'first frame selection belongs in attachment-references.ts');
  assert.doesNotMatch(routeSource, /const sourceInputVideoUrl\s*=/, 'source video selection belongs in attachment-references.ts');

  const lineCount = routeSource.split('\n').length;
  assert.ok(lineCount <= 2200, `/api/generate route should stay below 2200 lines after attachment reference extraction, got ${lineCount}`);
});

test('attachment reference helper exposes the route contract', () => {
  assert.match(helperSource, /export function deriveGenerationAttachmentReferences/, 'deriveGenerationAttachmentReferences should be exported');
  assert.match(helperSource, /export function resolveSourceVideoDurationSec/, 'resolveSourceVideoDurationSec should be exported');
  assert.match(helperSource, /function normalizeStringList/, 'reference list normalization should stay private');
  assert.match(helperSource, /function uniqueNonEmpty/, 'URL dedupe should stay private');
});

test('attachment reference helper derives primary image, media lists, and frame fallbacks', () => {
  const result = deriveGenerationAttachmentReferences({
    engineId: 'generic-engine',
    mode: 'fl2v',
    imageUrl: ' https://cdn.maxvideoai.com/body-image.png ',
    referenceImages: [' https://cdn.maxvideoai.com/ref-a.png ', '', 'https://cdn.maxvideoai.com/ref-a.png'],
    rawAudioUrl: null,
    attachments: [
      attachment({ kind: 'image', slotId: 'image_url', url: 'https://cdn.maxvideoai.com/primary.png', size: 20 }),
      attachment({ kind: 'image', slotId: 'last_frame_url', url: 'https://cdn.maxvideoai.com/last.png', size: 40 }),
      attachment({ kind: 'image', slotId: 'reference_images', url: 'https://cdn.maxvideoai.com/ref-b.png' }),
      attachment({ kind: 'video', slotId: 'video_url', url: 'https://cdn.maxvideoai.com/source.mp4' }),
      attachment({ kind: 'audio', slotId: 'audio_url', url: 'https://cdn.maxvideoai.com/audio.mp3' }),
    ],
  });

  assert.deepEqual(result, {
    maxUploadedBytes: 40,
    firstFrameUrl: undefined,
    lastFrameUrl: 'https://cdn.maxvideoai.com/last.png',
    requestedPrimaryImageUrl: 'https://cdn.maxvideoai.com/body-image.png',
    normalizedReferenceImages: ['https://cdn.maxvideoai.com/ref-a.png', 'https://cdn.maxvideoai.com/ref-b.png'],
    videoUrls: ['https://cdn.maxvideoai.com/source.mp4'],
    audioUrls: ['https://cdn.maxvideoai.com/audio.mp3'],
    resolvedAudioUrl: 'https://cdn.maxvideoai.com/audio.mp3',
    initialImageUrl: undefined,
    resolvedFirstFrameUrl: 'https://cdn.maxvideoai.com/body-image.png',
    startImageUrl: undefined,
    sourceInputVideoUrl: 'https://cdn.maxvideoai.com/source.mp4',
  });
});

test('attachment reference helper preserves Happy Horse slot routing', () => {
  const attachments: NormalizedAttachment[] = [
    attachment({ kind: 'image', slotId: 'image_urls', url: 'https://cdn.maxvideoai.com/ref2v-only.png' }),
    attachment({ kind: 'image', slotId: 'reference_image_urls', url: 'https://cdn.maxvideoai.com/v2v-only.png' }),
  ];

  assert.deepEqual(
    deriveGenerationAttachmentReferences({
      engineId: 'happy-horse-1-0',
      mode: 'ref2v',
      attachments,
      rawAudioUrl: null,
    }).normalizedReferenceImages,
    ['https://cdn.maxvideoai.com/ref2v-only.png']
  );

  assert.deepEqual(
    deriveGenerationAttachmentReferences({
      engineId: 'happy-horse-1-0',
      mode: 'v2v',
      attachments,
      rawAudioUrl: null,
    }).normalizedReferenceImages,
    ['https://cdn.maxvideoai.com/v2v-only.png']
  );

  assert.deepEqual(
    deriveGenerationAttachmentReferences({
      engineId: 'happy-horse-1-1',
      mode: 'ref2v',
      attachments,
      rawAudioUrl: null,
    }).normalizedReferenceImages,
    ['https://cdn.maxvideoai.com/ref2v-only.png']
  );

  assert.deepEqual(
    deriveGenerationAttachmentReferences({
      engineId: 'happy-horse-1-1',
      mode: 'v2v',
      attachments,
      rawAudioUrl: null,
    }).normalizedReferenceImages,
    []
  );
});

test('source video duration helper uses source duration for reframe only', () => {
  const attachments: NormalizedAttachment[] = [
    attachment({
      kind: 'video',
      slotId: 'video_url',
      url: 'https://cdn.maxvideoai.com/source.mp4',
      durationSec: 8.2,
    }),
  ];

  assert.deepEqual(
    resolveSourceVideoDurationSec({
      mode: 'reframe',
      attachments,
      sourceInputVideoUrl: 'https://cdn.maxvideoai.com/source.mp4',
      fallbackDurationSec: 5,
      maxDurationSec: 30,
    }),
    {
      durationSec: 9,
      durationLabel: '9s',
      sourceDurationSec: 8.2,
      maxDurationSec: 30,
      exceedsMax: false,
    }
  );

  assert.equal(
    resolveSourceVideoDurationSec({
      mode: 'v2v',
      attachments,
      sourceInputVideoUrl: 'https://cdn.maxvideoai.com/source.mp4',
      fallbackDurationSec: 5,
      maxDurationSec: 30,
    }).durationSec,
    5
  );
  assert.equal(
    resolveSourceVideoDurationSec({
      mode: 'reframe',
      attachments: [attachment({ kind: 'video', slotId: 'video_url', url: 'https://cdn.maxvideoai.com/source.mp4', durationSec: 31 })],
      sourceInputVideoUrl: 'https://cdn.maxvideoai.com/source.mp4',
      fallbackDurationSec: 5,
      maxDurationSec: 30,
    }).exceedsMax,
    true
  );
});
