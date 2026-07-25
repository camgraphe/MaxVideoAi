import assert from 'node:assert/strict';
import test from 'node:test';

import type { KlingElementState } from '../frontend/components/KlingElementsBuilder';
import type { ResolvedEngineReferenceBudget } from '../frontend/lib/reference-budget';
import type { EngineInputField, EngineInputSchema } from '../frontend/types/engines';
import {
  buildKlingLibraryAsset,
  buildReferenceAssetFromLibraryAsset,
  getAssetLibrarySourceForField,
  getLibraryAssetFieldMismatchMessage,
  insertKlingLibraryAsset,
  insertReferenceAsset,
  normalizeAssetLibraryPayload,
  reconcileReferenceAssets,
  removeReferenceAsset,
  shouldMirrorCharacterImageAsset,
  shouldMirrorVideoLibraryAsset,
  tryInsertReferenceAsset,
  type ReferenceAsset,
  type UserAsset,
} from '../frontend/app/(core)/(workspace)/app/_lib/workspace-assets';

const imageField: EngineInputField = { id: 'image_url', type: 'image', label: 'Image', maxCount: 2 };
const videoField: EngineInputField = { id: 'video_url', type: 'video', label: 'Video', maxCount: 1 };

const sharedBudget: ResolvedEngineReferenceBudget = {
  fieldIds: ['image_urls', 'video_urls'],
  maxTotal: 2,
  countUniqueUrls: true,
};

function userAsset(patch: Partial<UserAsset> = {}): UserAsset {
  return {
    id: 'asset_1',
    url: 'https://cdn.example.com/source.jpg',
    kind: 'image',
    width: 1280,
    height: 720,
    size: 1234,
    mime: 'image/jpeg',
    source: 'upload',
    canDelete: true,
    ...patch,
  };
}

test('asset library helpers choose source and validate field kind', () => {
  assert.equal(getAssetLibrarySourceForField(imageField), 'all');
  assert.equal(getAssetLibrarySourceForField(videoField), 'recent');
  assert.equal(getLibraryAssetFieldMismatchMessage(imageField, userAsset({ kind: 'video' })), 'This slot requires an image source. Pick an image from the library or import one.');
  assert.equal(getLibraryAssetFieldMismatchMessage(videoField, userAsset({ kind: 'image' })), 'This slot requires a video source. Pick a video from the video library or import an MP4/MOV clip.');
  assert.equal(getLibraryAssetFieldMismatchMessage(imageField, userAsset()), null);
});

test('asset library mirroring policy detects generated Fal media', () => {
  assert.equal(shouldMirrorVideoLibraryAsset(userAsset({ kind: 'video', source: 'recent', url: 'https://example.com/a.mp4' })), true);
  assert.equal(shouldMirrorVideoLibraryAsset(userAsset({ kind: 'video', source: 'upload', url: 'https://fal.media/a.mp4' })), true);
  assert.equal(shouldMirrorVideoLibraryAsset(userAsset({ kind: 'video', source: 'upload', url: 'https://cdn.example.com/a.mp4' })), false);
  assert.equal(shouldMirrorCharacterImageAsset(userAsset({ source: 'character', url: 'https://foo.fal.media/a.jpg' })), true);
  assert.equal(shouldMirrorCharacterImageAsset(userAsset({ source: 'upload', url: 'https://foo.fal.media/a.jpg' })), false);
});

test('recent video asset payload keeps thumbnails and hover previews for the picker', () => {
  const [asset] = normalizeAssetLibraryPayload(
    {
      ok: true,
      outputs: [
        {
          id: 'job_1:video:0',
          jobId: 'job_1',
          url: 'https://media.maxvideoai.com/renders/video.mp4',
          thumbUrl: 'https://media.maxvideoai.com/renders/thumb.jpg',
          previewUrl: 'https://media.maxvideoai.com/renders/preview.mp4',
          durationSec: 12.4,
          mime: 'video/mp4',
          kind: 'video',
        },
      ],
    },
    'recent',
    'video'
  );

  assert.equal(asset?.kind, 'video');
  assert.equal(asset?.thumbUrl, 'https://media.maxvideoai.com/renders/thumb.jpg');
  assert.equal(asset?.previewUrl, 'https://media.maxvideoai.com/renders/preview.mp4');
  assert.equal(asset?.durationSec, 12.4);
  assert.equal(asset?.source, 'recent');
});

test('library video assets preserve duration when selected as references', () => {
  const selected = buildReferenceAssetFromLibraryAsset(videoField, userAsset({
    id: 'video_asset',
    kind: 'video',
    mime: 'video/mp4',
    url: 'https://cdn.example.com/source.mp4',
    durationSec: 8.2,
  }));

  assert.equal(selected.durationSec, 8.2);
});

test('reference asset insertion fills slots, replaces assets, and preserves max count', () => {
  const first = buildReferenceAssetFromLibraryAsset(imageField, userAsset({ id: 'asset_first' }));
  const second = buildReferenceAssetFromLibraryAsset(imageField, userAsset({ id: 'asset_second', url: 'https://cdn.example.com/second.jpg' }));
  const replacement = buildReferenceAssetFromLibraryAsset(imageField, userAsset({ id: 'asset_replacement', url: 'https://cdn.example.com/replacement.jpg' }));
  const released: string[] = [];

  let state: Record<string, (ReferenceAsset | null)[]> = {};
  state = insertReferenceAsset(state, imageField, first, undefined, { release: (asset) => released.push(asset.id) });
  state = insertReferenceAsset(state, imageField, second, undefined, { release: (asset) => released.push(asset.id) });
  state = insertReferenceAsset(state, imageField, replacement, 0, { release: (asset) => released.push(asset.id) });

  assert.deepEqual(state.image_url.map((entry) => entry?.id), ['asset_replacement', 'asset_second']);
  assert.deepEqual(released, ['asset_first']);

  let maxReached = false;
  const unchanged = insertReferenceAsset(state, imageField, first, undefined, { onMaxReached: () => { maxReached = true; } });
  assert.equal(unchanged, state);
  assert.equal(maxReached, true);

  state = removeReferenceAsset(state, imageField, 1, (asset) => released.push(asset.id));
  assert.deepEqual(state.image_url.map((entry) => entry?.id ?? null), ['asset_replacement', null]);
  assert.deepEqual(released, ['asset_first', 'asset_second']);
});

test('candidate insertion enforces one shared budget across fields', () => {
  const images: EngineInputField = { id: 'image_urls', type: 'image', label: 'Images', maxCount: 5 };
  const videos: EngineInputField = { id: 'video_urls', type: 'video', label: 'Videos', maxCount: 5 };
  const inputSchema: EngineInputSchema = {
    optional: [
      { ...images, modes: ['ref2v' as const] },
      { ...videos, modes: ['ref2v' as const] },
    ],
    referenceBudget: {
      fieldIds: ['image_urls', 'video_urls'],
      modes: ['ref2v' as const],
      maxTotal: 2,
      countUniqueUrls: true,
    },
  };
  const first = buildReferenceAssetFromLibraryAsset(images, userAsset({ id: 'one', url: 'one' }));
  const second = buildReferenceAssetFromLibraryAsset(videos, userAsset({
    id: 'two',
    kind: 'video',
    mime: 'video/mp4',
    url: 'two',
  }));
  const rejected = buildReferenceAssetFromLibraryAsset(images, userAsset({ id: 'three', url: 'three' }));

  const one = tryInsertReferenceAsset({}, images, first, undefined, {
    inputSchema,
    preferredMode: 't2v',
  });
  assert.equal(one.accepted, true);
  const two = tryInsertReferenceAsset(one.state, videos, second, undefined, {
    inputSchema,
    preferredMode: 't2v',
  });
  assert.equal(two.accepted, true);
  const three = tryInsertReferenceAsset(two.state, images, rejected, undefined, {
    inputSchema,
    preferredMode: 't2v',
  });
  assert.deepEqual(three, {
    accepted: false,
    state: two.state,
    reason: 'reference_budget',
    maxTotal: 2,
  });
});

test('rejected replacement neither mutates state nor releases the current asset', () => {
  const field: EngineInputField = { id: 'image_urls', type: 'image', label: 'Images', maxCount: 2 };
  const current = buildReferenceAssetFromLibraryAsset(field, userAsset({ id: 'current', url: 'current' }));
  const other = buildReferenceAssetFromLibraryAsset(field, userAsset({ id: 'other', url: 'other' }));
  const replacement = buildReferenceAssetFromLibraryAsset(field, userAsset({ id: 'replacement', url: 'replacement' }));
  const state = { image_urls: [current, other] };
  const result = tryInsertReferenceAsset(state, field, replacement, 0, {
    inputSchema: {
      optional: [{ ...field, modes: ['ref2v'] }],
      referenceBudget: {
        fieldIds: ['image_urls'],
        modes: ['ref2v'],
        maxTotal: 2,
        countUniqueUrls: false,
      },
    },
    preferredMode: 'ref2v',
  });
  assert.equal(result.accepted, true);
  assert.equal(result.replacedAsset?.id, 'current');

  const overflowResult = tryInsertReferenceAsset(
    { image_urls: [current, other], video_urls: [replacement] },
    field,
    replacement,
    0,
    {
      inputSchema: {
        optional: [
          { ...field, modes: ['ref2v'] },
          { id: 'video_urls', type: 'video', label: 'Videos', modes: ['ref2v'] },
        ],
        referenceBudget: {
          fieldIds: ['image_urls', 'video_urls'],
          modes: ['ref2v'],
          maxTotal: 2,
          countUniqueUrls: false,
        },
      },
      preferredMode: 'ref2v',
    }
  );
  assert.equal(overflowResult.accepted, false);
  assert.equal(overflowResult.replacedAsset, undefined);
  assert.equal(overflowResult.state.image_urls[0], current);
});

test('reconciliation preserves retained arrays exactly when no aggregate budget exists', () => {
  const field: EngineInputField = { id: 'image_urls', type: 'image', label: 'Images', maxCount: 1 };
  const first = buildReferenceAssetFromLibraryAsset(field, userAsset({ id: 'first', url: 'first' }));
  const second = buildReferenceAssetFromLibraryAsset(field, userAsset({ id: 'second', url: 'second' }));
  const previous = { image_urls: [first, second] };
  assert.equal(reconcileReferenceAssets(previous, [field], null), previous);
});

test('budget reconciliation keeps destination field order and releases overflow', () => {
  const images: EngineInputField = { id: 'image_urls', type: 'image', label: 'Images', maxCount: 3 };
  const videos: EngineInputField = { id: 'video_urls', type: 'video', label: 'Videos', maxCount: 1 };
  const released: string[] = [];
  const previous = {
    video_urls: [buildReferenceAssetFromLibraryAsset(videos, userAsset({ id: 'video', kind: 'video', mime: 'video/mp4', url: 'video' }))],
    image_urls: [
      buildReferenceAssetFromLibraryAsset(images, userAsset({ id: 'image-1', url: 'image-1' })),
      buildReferenceAssetFromLibraryAsset(images, userAsset({ id: 'image-2', url: 'image-2' })),
      buildReferenceAssetFromLibraryAsset(images, userAsset({ id: 'image-3', url: 'image-3' })),
    ],
  };
  const reconciled = reconcileReferenceAssets(
    previous,
    [images, videos],
    sharedBudget,
    (asset) => released.push(asset.id)
  );
  assert.deepEqual(reconciled.image_urls.map((entry) => entry?.id ?? null), ['image-1', 'image-2', null]);
  assert.equal(reconciled.video_urls, undefined);
  assert.deepEqual(released.sort(), ['image-3', 'video']);
});

test('reconciliation does not count or release an active source field outside the budget', () => {
  const images: EngineInputField = {
    id: 'image_urls',
    type: 'image',
    label: 'Images',
    maxCount: 2,
  };
  const source: EngineInputField = {
    id: 'video_url',
    type: 'video',
    label: 'Source',
    maxCount: 1,
  };
  const released: string[] = [];
  const image = buildReferenceAssetFromLibraryAsset(
    images,
    userAsset({ id: 'image', url: 'image' })
  );
  const video = buildReferenceAssetFromLibraryAsset(
    source,
    userAsset({
      id: 'source',
      kind: 'video',
      mime: 'video/mp4',
      url: 'source',
    })
  );
  const result = reconcileReferenceAssets(
    { image_urls: [image], video_url: [video] },
    [images, source],
    {
      fieldIds: ['image_urls'],
      maxTotal: 1,
      countUniqueUrls: true,
    },
    (asset) => released.push(asset.id)
  );
  assert.equal(result.video_url[0], video);
  assert.deepEqual(released, []);
});

test('kling library insertion targets frontal and reference slots', () => {
  const element: KlingElementState = {
    id: 'element_1',
    frontal: null,
    references: [null, null, null],
    video: null,
  };
  const first = buildKlingLibraryAsset(userAsset({ id: 'kling_first' }));
  const second = buildKlingLibraryAsset(userAsset({ id: 'kling_second', url: 'https://cdn.example.com/second.jpg' }));
  const released: string[] = [];

  let elements = insertKlingLibraryAsset(
    [element],
    { kind: 'kling', elementId: 'element_1', slot: 'frontal' },
    first,
    (asset) => {
      if (asset) released.push(asset.id);
    }
  );
  elements = insertKlingLibraryAsset(
    elements,
    { kind: 'kling', elementId: 'element_1', slot: 'reference', slotIndex: 0 },
    second,
    (asset) => {
      if (asset) released.push(asset.id);
    }
  );

  assert.equal(elements[0].frontal?.id, 'kling_first');
  assert.equal(elements[0].references[0]?.id, 'kling_second');
  assert.deepEqual(released, []);
});

test('kling library insertion targets video reference slots', () => {
  const element: KlingElementState = {
    id: 'element_1',
    frontal: null,
    references: [null, null, null],
    video: null,
  };
  const video = buildKlingLibraryAsset(userAsset({
    id: 'kling_video',
    kind: 'video',
    mime: 'video/mp4',
    url: 'https://cdn.example.com/reference.mp4',
  }));
  const released: string[] = [];

  const elements = insertKlingLibraryAsset(
    [element],
    { kind: 'kling', elementId: 'element_1', slot: 'video' },
    video,
    (asset) => {
      if (asset) released.push(asset.id);
    }
  );

  assert.equal(elements[0].video?.id, 'kling_video');
  assert.equal(elements[0].video?.kind, 'video');
  assert.deepEqual(released, []);
});
