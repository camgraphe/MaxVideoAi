import assert from 'node:assert/strict';
import test from 'node:test';

import { KLING_3_TURBO_PRO_FAL_ENGINE_REGISTRY } from '../frontend/src/config/fal-engines/kling-3-turbo-pro';
import { KLING_3_TURBO_STANDARD_FAL_ENGINE_REGISTRY } from '../frontend/src/config/fal-engines/kling-3-turbo-standard';
import {
  RAW_FAL_ENGINE_REGISTRY,
  UNPUBLISHED_FAL_ENGINE_REGISTRY,
} from '../frontend/src/config/fal-engines/registry';

const turboEngines = [
  ...KLING_3_TURBO_STANDARD_FAL_ENGINE_REGISTRY,
  ...KLING_3_TURBO_PRO_FAL_ENGINE_REGISTRY,
];

test('Kling 3 Turbo contracts preserve the documented product names, endpoints, and capabilities', () => {
  assert.deepEqual(turboEngines.map(({ id, marketingName }) => ({ id, marketingName })), [
    { id: 'kling-3-turbo-standard', marketingName: 'Kling 3.0 Turbo Standard' },
    { id: 'kling-3-turbo-pro', marketingName: 'Kling 3.0 Turbo Pro' },
  ]);
  assert.deepEqual(
    turboEngines.map(({ engine }) => ({
      id: engine.id,
      resolutions: engine.resolutions,
      modes: engine.modes,
      aspectRatios: engine.aspectRatios,
      audio: engine.audio,
    })),
    [
      {
        id: 'kling-3-turbo-standard',
        resolutions: ['720p'],
        modes: ['t2v', 'i2v'],
        aspectRatios: ['16:9', '9:16', '1:1'],
        audio: true,
      },
      {
        id: 'kling-3-turbo-pro',
        resolutions: ['1080p'],
        modes: ['t2v', 'i2v'],
        aspectRatios: ['16:9', '9:16', '1:1'],
        audio: true,
      },
    ],
  );
  assert.deepEqual(
    turboEngines.map((engine) => Object.fromEntries(engine.modes.map(({ mode, falModelId }) => [mode, falModelId]))),
    [
      {
        t2v: 'fal-ai/kling-video/v3/turbo/standard/text-to-video',
        i2v: 'fal-ai/kling-video/v3/turbo/standard/image-to-video',
      },
      {
        t2v: 'fal-ai/kling-video/v3/turbo/pro/text-to-video',
        i2v: 'fal-ai/kling-video/v3/turbo/pro/image-to-video',
      },
    ],
  );
});

test('Kling 3 Turbo stays registered privately until its publication gates are satisfied', () => {
  const unpublishedIds = new Set(UNPUBLISHED_FAL_ENGINE_REGISTRY.map(({ id }) => id));
  assert.equal(unpublishedIds.has('kling-3-turbo-standard'), true);
  assert.equal(unpublishedIds.has('kling-3-turbo-pro'), true);
  assert.equal(unpublishedIds.has('runway-gen-4-turbo'), false);
  assert.equal(unpublishedIds.has('minimax-h3-max-turbo'), false);

  const publicIds = new Set(RAW_FAL_ENGINE_REGISTRY.map(({ id }) => id));
  assert.equal(publicIds.has('kling-3-turbo-standard'), false);
  assert.equal(publicIds.has('kling-3-turbo-pro'), false);
});
