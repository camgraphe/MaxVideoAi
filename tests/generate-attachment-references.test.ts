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
const processingPath = join(root, 'frontend/app/api/generate/_lib/generation-attachment-processing.ts');

const routeSource = readFileSync(routePath, 'utf8');
const serviceSource = readFileSync(join(root, 'frontend/src/server/video-generation/execute-video-generation.ts'), 'utf8');
const helperSource = readFileSync(helperPath, 'utf8');

const attachment = (overrides: Partial<NormalizedAttachment>): NormalizedAttachment => ({
  name: 'asset',
  type: 'application/octet-stream',
  size: 0,
  ...overrides,
});

test('generate route delegates attachment reference derivation', () => {
  assert.ok(existsSync(helperPath), 'attachment reference derivation should live in the generate route _lib folder');
  assert.ok(existsSync(processingPath), 'attachment reference orchestration should live in the generate route _lib folder');
  assert.match(serviceSource, /generate\/_lib\/generation-attachment-processing/);
  assert.match(serviceSource, /processAndValidateGenerationAttachments\(\{/);
  assert.match(readFileSync(processingPath, 'utf8'), /from '\.\/attachment-references'/);
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
    referenceValuesByField: {
      image_url: ['https://cdn.maxvideoai.com/primary.png'],
      last_frame_url: ['https://cdn.maxvideoai.com/last.png'],
      reference_images: ['https://cdn.maxvideoai.com/ref-b.png'],
      video_url: ['https://cdn.maxvideoai.com/source.mp4'],
      audio_url: ['https://cdn.maxvideoai.com/audio.mp3'],
      image_urls: [
        'https://cdn.maxvideoai.com/ref-a.png',
        'https://cdn.maxvideoai.com/ref-a.png',
      ],
    },
    referenceMediaItems: [
      { fieldId: 'image_url', kind: 'image', url: 'https://cdn.maxvideoai.com/primary.png' },
      { fieldId: 'last_frame_url', kind: 'image', url: 'https://cdn.maxvideoai.com/last.png' },
      { fieldId: 'reference_images', kind: 'image', url: 'https://cdn.maxvideoai.com/ref-b.png' },
      { fieldId: 'video_url', kind: 'video', url: 'https://cdn.maxvideoai.com/source.mp4' },
      { fieldId: 'audio_url', kind: 'audio', url: 'https://cdn.maxvideoai.com/audio.mp3' },
      { fieldId: 'image_urls', kind: 'image', url: 'https://cdn.maxvideoai.com/ref-a.png' },
      { fieldId: 'image_urls', kind: 'image', url: 'https://cdn.maxvideoai.com/ref-a.png' },
    ],
    referenceProvenanceIssues: [],
  });
});

test('attachment reference derivation preserves V2V field ids before projection', () => {
  const result = deriveGenerationAttachmentReferences({
    engineId: 'contract-test-engine',
    mode: 'v2v',
    inputSchema: {
      optional: [
        {
          id: 'reference_image_urls',
          type: 'image',
          label: 'References',
          modes: ['v2v'],
        },
      ],
    },
    referenceImages: ['legacy-image'],
    rawAudioUrl: null,
    attachments: [
      attachment({ kind: 'image', slotId: 'image_urls', url: 'ref2v-image' }),
      attachment({ kind: 'image', slotId: 'reference_image_urls', url: 'v2v-image' }),
      attachment({ kind: 'video', slotId: 'video_url', url: 'source-video' }),
    ],
  });
  assert.deepEqual(result.referenceValuesByField, {
    image_urls: ['ref2v-image'],
    reference_image_urls: ['v2v-image', 'legacy-image'],
    video_url: ['source-video'],
  });
});

test('attachment reference derivation preserves actual media kind independently of schema', () => {
  const result = deriveGenerationAttachmentReferences({
    engineId: 'contract-test-engine',
    mode: 'v2v',
    inputSchema: {
      optional: [
        { id: 'image_urls', type: 'image', label: 'Images', modes: ['v2v'] },
        { id: 'video_url', type: 'video', label: 'Source video', modes: ['v2v'] },
      ],
    },
    referenceImages: ['valid-image'],
    rawAudioUrl: null,
    attachments: [
      attachment({
        kind: 'image',
        slotId: 'image_urls',
        url: 'valid-image',
      }),
      attachment({
        kind: 'audio',
        slotId: 'video_url',
        url: 'forged-audio',
      }),
    ],
  });
  assert.deepEqual(result.referenceValuesByField, {
    image_urls: ['valid-image'],
    video_url: ['forged-audio'],
  });
  assert.deepEqual(result.referenceMediaItems, [
    { fieldId: 'image_urls', kind: 'image', url: 'valid-image' },
    { fieldId: 'video_url', kind: 'audio', url: 'forged-audio' },
  ]);
});

test('attachment reference derivation preserves incomplete provenance order and multiplicity without inference', () => {
  const result = deriveGenerationAttachmentReferences({
    engineId: 'contract-test-engine',
    mode: 'ref2v',
    inputSchema: {
      optional: [
        { id: 'image_urls', type: 'image', label: 'Images', modes: ['ref2v'] },
        { id: 'video_urls', type: 'video', label: 'Videos', modes: ['ref2v'] },
        { id: 'audio_urls', type: 'audio', label: 'Audio', modes: ['ref2v'] },
      ],
    },
    referenceImages: [],
    rawAudioUrl: null,
    attachments: [
      attachment({ kind: 'video', url: 'slotless-video' }),
      attachment({ kind: 'audio', url: 'slotless-audio' }),
      attachment({ kind: 'audio', url: 'slotless-audio' }),
      attachment({ slotId: 'audio_urls', url: 'kindless-audio' }),
    ],
  });

  assert.deepEqual(result.videoUrls, ['slotless-video']);
  assert.deepEqual(result.audioUrls, ['slotless-audio']);
  assert.deepEqual(result.referenceValuesByField, {
    audio_urls: ['kindless-audio'],
  });
  assert.deepEqual(result.referenceMediaItems, []);
  assert.deepEqual(result.referenceProvenanceIssues, [
    {
      reason: 'missing-field-id',
      kind: 'video',
      url: 'slotless-video',
    },
    {
      reason: 'missing-field-id',
      kind: 'audio',
      url: 'slotless-audio',
    },
    {
      reason: 'missing-field-id',
      kind: 'audio',
      url: 'slotless-audio',
    },
    {
      reason: 'missing-kind',
      fieldId: 'audio_urls',
      url: 'kindless-audio',
    },
  ]);
});

test('browser compatibility projections do not duplicate attachment multiplicity', () => {
  const result = deriveGenerationAttachmentReferences({
    engineId: 'contract-test-engine',
    mode: 'ref2v',
    inputSchema: {
      optional: [
        { id: 'image_urls', type: 'image', label: 'Images', modes: ['ref2v'] },
      ],
    },
    referenceImages: ['same-image'],
    rawAudioUrl: null,
    attachments: [
      attachment({
        kind: 'image',
        slotId: 'image_urls',
        url: 'same-image',
      }),
    ],
  });
  assert.deepEqual(result.referenceValuesByField, {
    image_urls: ['same-image'],
  });
});

test('direct-only Seedance V2V references use the schema-authored image_urls field', () => {
  const result = deriveGenerationAttachmentReferences({
    engineId: 'seedance-contract-engine',
    mode: 'v2v',
    inputSchema: {
      optional: [
        {
          id: 'image_urls',
          type: 'image',
          label: 'References',
          modes: ['ref2v', 'v2v'],
        },
      ],
    },
    referenceImages: ['direct-image'],
    rawAudioUrl: null,
    attachments: [],
  });
  assert.deepEqual(result.referenceValuesByField, {
    image_urls: ['direct-image'],
  });
  assert.deepEqual(result.referenceMediaItems, [
    { fieldId: 'image_urls', kind: 'image', url: 'direct-image' },
  ]);
});

for (const mode of ['v2v', 'extend'] as const) {
  test(`direct-only Seedance ${mode} audio uses the active schema-authored field`, () => {
    const result = deriveGenerationAttachmentReferences({
      engineId: 'seedance-contract-engine',
      mode,
      inputSchema: {
        optional: [
          {
            id: 'audio_urls',
            type: 'audio',
            label: 'Reference audio',
            modes: [mode],
          },
        ],
      },
      referenceImages: [],
      rawAudioUrl: 'direct-audio',
      attachments: [],
    });
    assert.deepEqual(result.referenceValuesByField, {
      audio_urls: ['direct-audio'],
    });
    assert.deepEqual(result.referenceMediaItems, [
      { fieldId: 'audio_urls', kind: 'audio', url: 'direct-audio' },
    ]);
  });
}

test('direct scalar media use their active schema-authored fields', () => {
  const derivationParams = {
    engineId: 'contract-test-engine',
    mode: 'i2v' as const,
    inputSchema: {
      optional: [
        {
          id: 'image_url',
          type: 'image' as const,
          label: 'Start image',
          modes: ['i2v' as const],
        },
        {
          id: 'end_image_url',
          type: 'image' as const,
          label: 'End image',
          modes: ['i2v' as const],
        },
        {
          id: 'audio_url',
          type: 'audio' as const,
          label: 'Audio',
          modes: ['i2v' as const],
        },
      ],
    },
    imageUrl: 'direct-start',
    endImageUrl: 'direct-end',
    referenceImages: [],
    rawAudioUrl: 'direct-audio',
    attachments: [],
  };
  const result = deriveGenerationAttachmentReferences(derivationParams);

  assert.deepEqual(result.referenceValuesByField, {
    audio_url: ['direct-audio'],
    image_url: ['direct-start'],
    end_image_url: ['direct-end'],
  });
  assert.deepEqual(result.referenceMediaItems, [
    { fieldId: 'audio_url', kind: 'audio', url: 'direct-audio' },
    { fieldId: 'image_url', kind: 'image', url: 'direct-start' },
    { fieldId: 'end_image_url', kind: 'image', url: 'direct-end' },
  ]);
});

test('reference accumulation safely preserves inherited-key slot ids', () => {
  const result = deriveGenerationAttachmentReferences({
    engineId: 'contract-test-engine',
    mode: 'ref2v',
    inputSchema: {
      optional: [
        { id: 'image_urls', type: 'image', label: 'Images', modes: ['ref2v'] },
      ],
    },
    referenceImages: [],
    rawAudioUrl: null,
    attachments: [
      attachment({ kind: 'audio', slotId: '__proto__', url: 'proto-audio' }),
      attachment({ kind: 'audio', slotId: 'constructor', url: 'constructor-audio' }),
      attachment({ kind: 'audio', slotId: 'toString', url: 'to-string-audio' }),
    ],
  });

  assert.equal(Object.hasOwn(result.referenceValuesByField, '__proto__'), true);
  assert.equal(Object.hasOwn(result.referenceValuesByField, 'constructor'), true);
  assert.equal(Object.hasOwn(result.referenceValuesByField, 'toString'), true);
  assert.deepEqual(result.referenceValuesByField['__proto__'], ['proto-audio']);
  assert.deepEqual(result.referenceValuesByField['constructor'], ['constructor-audio']);
  assert.deepEqual(result.referenceValuesByField['toString'], ['to-string-audio']);
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

test('source video duration helper uses source duration for reframe and enforces edit limits', () => {
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
      mode: 'v2v',
      attachments: [
        attachment({
          kind: 'video',
          slotId: 'video_url',
          url: 'https://cdn.maxvideoai.com/source.mp4',
          durationSec: 11,
        }),
      ],
      sourceInputVideoUrl: 'https://cdn.maxvideoai.com/source.mp4',
      fallbackDurationSec: 5,
      maxDurationSec: 10,
    }).exceedsMax,
    true
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
