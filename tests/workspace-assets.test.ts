import assert from 'node:assert/strict';
import test from 'node:test';

import type { KlingElementState } from '../frontend/components/KlingElementsBuilder';
import type { EngineInputField } from '../frontend/types/engines';
import {
  buildKlingLibraryAsset,
  buildReferenceAssetFromLibraryAsset,
  getAssetLibrarySourceForField,
  getLibraryAssetFieldMismatchMessage,
  insertKlingLibraryAsset,
  insertReferenceAsset,
  removeReferenceAsset,
  shouldMirrorCharacterImageAsset,
  shouldMirrorVideoLibraryAsset,
  type ReferenceAsset,
  type UserAsset,
} from '../frontend/app/(core)/(workspace)/app/_lib/workspace-assets';

const imageField: EngineInputField = { id: 'image_url', type: 'image', label: 'Image', maxCount: 2 };
const videoField: EngineInputField = { id: 'video_url', type: 'video', label: 'Video', maxCount: 1 };

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
