import assert from 'node:assert/strict';
import test from 'node:test';

import type { KlingElementState } from '../frontend/components/KlingElementsBuilder';
import type { EngineCaps } from '../frontend/types/engines';
import type { ReferenceAsset } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-assets';
import {
  getKlingO3DisabledEngineReasons,
  getKlingO3UnsupportedVideoReason,
  resolveKlingO3UnifiedMode,
} from '../frontend/app/(core)/(workspace)/app/_lib/kling-o3-unified-workflow';
import { listFalEngines } from '../frontend/src/config/falEngines.ts';

function engine(id: string): EngineCaps {
  const entry = listFalEngines().find((candidate) => candidate.id === id)?.engine;
  assert.ok(entry, `Missing test engine ${id}`);
  return entry;
}

function asset(fieldId: string, kind: ReferenceAsset['kind'] = 'image'): ReferenceAsset {
  return {
    id: `${fieldId}-${kind}`,
    fieldId,
    name: `${fieldId}.${kind === 'video' ? 'mp4' : 'jpg'}`,
    kind,
    type: kind === 'video' ? 'video/mp4' : 'image/jpeg',
    size: 123,
    previewUrl: `https://cdn.example.com/${fieldId}.${kind === 'video' ? 'mp4' : 'jpg'}`,
    url: `https://cdn.example.com/${fieldId}.${kind === 'video' ? 'mp4' : 'jpg'}`,
    status: 'ready',
  };
}

function element(overrides: Partial<KlingElementState> = {}): KlingElementState {
  return {
    id: 'element-1',
    frontal: null,
    references: [],
    video: null,
    ...overrides,
  };
}

test('resolveKlingO3UnifiedMode infers t2v, i2v, ref2v, and v2v from loaded assets', () => {
  const pro = engine('kling-o3-pro');

  assert.equal(resolveKlingO3UnifiedMode({ engine: pro, inputAssets: {}, klingElements: [] }), 't2v');
  assert.equal(
    resolveKlingO3UnifiedMode({
      engine: pro,
      inputAssets: { image_url: [asset('image_url')] },
      klingElements: [],
    }),
    'i2v'
  );
  assert.equal(
    resolveKlingO3UnifiedMode({
      engine: pro,
      inputAssets: { image_urls: [asset('image_urls')] },
      klingElements: [],
    }),
    'ref2v'
  );
  assert.equal(
    resolveKlingO3UnifiedMode({
      engine: pro,
      inputAssets: {
        video_url: [asset('video_url', 'video')],
        image_urls: [asset('image_urls')],
      },
      klingElements: [],
    }),
    'v2v'
  );
});

test('resolveKlingO3UnifiedMode treats subject image elements as ref2v and subject video elements as v2v', () => {
  const pro = engine('kling-o3-pro');
  const frontal = asset('frontal');
  const reference = asset('reference');
  const subjectVideo = asset('subject_video', 'video');

  assert.equal(
    resolveKlingO3UnifiedMode({
      engine: pro,
      inputAssets: {},
      klingElements: [
        element({
          frontal: frontal,
          references: [reference],
        }),
      ],
    }),
    'ref2v'
  );
  assert.equal(
    resolveKlingO3UnifiedMode({
      engine: pro,
      inputAssets: {},
      klingElements: [element({ video: subjectVideo })],
    }),
    'v2v'
  );
});

test('Kling 3.0 Omni 4K reports source-video conflicts while Standard and Pro stay selectable', () => {
  const standard = engine('kling-o3-standard');
  const pro = engine('kling-o3-pro');
  const fourK = engine('kling-o3-4k');
  const inputAssets = { video_url: [asset('video_url', 'video')] };

  assert.equal(getKlingO3UnsupportedVideoReason({ engine: pro, inputAssets, klingElements: [] }), null);
  assert.match(
    getKlingO3UnsupportedVideoReason({ engine: fourK, inputAssets, klingElements: [] }) ?? '',
    /does not support source video/i
  );
  assert.deepEqual(
    getKlingO3DisabledEngineReasons({
      engines: [standard, pro, fourK],
      inputAssets,
      klingElements: [],
    }),
    {
      'kling-o3-4k':
        'Kling 3.0 Omni 4K does not support source video yet. Remove the source video or switch back to Standard/Pro.',
    }
  );
});
