import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import {
  formatKeyframeSlots,
  parseKeyframeSlots,
} from '../frontend/app/(core)/(workspace)/app/_lib/luma-ray32-keyframes';

const root = process.cwd();
const timelinePath = join(
  root,
  'frontend/app/(core)/(workspace)/app/_components/LumaRay32KeyframeTimeline.tsx'
);
const assetLibraryModalPath = join(root, 'frontend/components/library/AssetLibraryModal.tsx');

test('Luma Ray 3.2 keyframe editor keeps user-deleted keyframe slots deleted', () => {
  assert.equal(parseKeyframeSlots('', [], 64, 119).length, 4);

  const clearedValue = formatKeyframeSlots([]);
  assert.deepEqual(parseKeyframeSlots(clearedValue, [], 64, 119), []);

  assert.deepEqual(parseKeyframeSlots('0:0, 1:119', [], 64, 119), [
    { assetSlot: 0, frameIndex: 0 },
    { assetSlot: 1, frameIndex: 119 },
  ]);
});

test('Luma Ray 3.2 keyframe placeholders route through the library import flow', () => {
  const timelineSource = readFileSync(timelinePath, 'utf8');
  const assetLibraryModalSource = readFileSync(assetLibraryModalPath, 'utf8');

  assert.doesNotMatch(
    timelineSource,
    /keyframeInputRefs\.current\[slot\.assetSlot\]\?\.click\(\);/,
    'placeholder clicks should open the asset library instead of a hidden file picker'
  );
  assert.match(
    timelineSource,
    /Open library or upload keyframe at/,
    'placeholder tooltip should explain that upload is available inside the library'
  );
  assert.match(
    assetLibraryModalSource,
    /const importAccept = assetType === 'video' \? 'video\/\*' : 'image\/\*';/,
    'asset library import must keep image uploads available for keyframe slots'
  );
  assert.match(
    assetLibraryModalSource,
    /onClick=\{\(\) => importInputRef\.current\?\.click\(\)\}/,
    'asset library should expose the upload/import action'
  );
});
