import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildReferenceMediaItems,
  evaluateReferenceBudget,
  resolveEngineReferenceBudget,
  resolveEngineReferenceBudgetForValues,
} from '../frontend/lib/reference-budget';
import type { EngineInputSchema } from '../frontend/types/engines';

const schema: EngineInputSchema = {
  optional: [
    { id: 'image_urls', type: 'image', label: 'Images', modes: ['ref2v'], maxCount: 50 },
    { id: 'video_urls', type: 'video', label: 'Videos', modes: ['ref2v'], maxCount: 10 },
    { id: 'audio_urls', type: 'audio', label: 'Audio', modes: ['ref2v'], maxCount: 10 },
    { id: 'edit_images', type: 'image', label: 'Edit images', modes: ['v2v'], maxCount: 5 },
  ],
  referenceBudget: {
    fieldIds: ['image_urls', 'video_urls', 'audio_urls', 'edit_images'],
    modes: ['ref2v', 'v2v'],
    maxTotal: 3,
    countUniqueUrls: true,
  },
};

test('resolveEngineReferenceBudget keeps only fields active in the requested mode', () => {
  assert.deepEqual(resolveEngineReferenceBudget(schema, 'ref2v'), {
    fieldIds: ['image_urls', 'video_urls', 'audio_urls'],
    maxTotal: 3,
    countUniqueUrls: true,
  });
  assert.deepEqual(resolveEngineReferenceBudget(schema, 'v2v'), {
    fieldIds: ['edit_images'],
    maxTotal: 3,
    countUniqueUrls: true,
  });
  assert.equal(resolveEngineReferenceBudget(schema, 't2v'), null);
});

test('prospective values activate a ref2v-only budget before form mode catches up', () => {
  assert.deepEqual(
    resolveEngineReferenceBudgetForValues(
      schema,
      't2v',
      { image_urls: ['a', 'b'], video_urls: ['c'] },
      (value) => value,
      'video_urls'
    ),
    {
      fieldIds: ['image_urls', 'video_urls', 'audio_urls'],
      maxTotal: 3,
      countUniqueUrls: true,
    }
  );
});

test('prospective resolution derives field modes when budget modes are omitted', () => {
  const unscopedBudgetSchema: EngineInputSchema = {
    optional: [
      { id: 'image_urls', type: 'image', label: 'Images', modes: ['ref2v'] },
    ],
    referenceBudget: {
      fieldIds: ['image_urls'],
      maxTotal: 1,
      countUniqueUrls: true,
    },
  };
  assert.deepEqual(
    resolveEngineReferenceBudgetForValues(
      unscopedBudgetSchema,
      't2v',
      { image_urls: ['a'] },
      (value) => value,
      'image_urls'
    ),
    {
      fieldIds: ['image_urls'],
      maxTotal: 1,
      countUniqueUrls: true,
    }
  );
});

test('prospective resolution selects the mode covering the complete candidate state', () => {
  const mixedSchema: EngineInputSchema = {
    optional: [
      {
        id: 'image_urls',
        type: 'image',
        label: 'Images',
        modes: ['ref2v', 'v2v'],
      },
      { id: 'video_url', type: 'video', label: 'Source', modes: ['v2v'] },
    ],
    referenceBudget: {
      fieldIds: ['image_urls', 'video_url'],
      modes: ['ref2v', 'v2v'],
      maxTotal: 2,
      countUniqueUrls: true,
    },
  };
  assert.deepEqual(
    resolveEngineReferenceBudgetForValues(
      mixedSchema,
      't2v',
      { image_urls: ['image'], video_url: ['video'] },
      (value) => value,
      'video_url'
    ),
    {
      fieldIds: ['image_urls', 'video_url'],
      maxTotal: 2,
      countUniqueUrls: true,
    }
  );
});

test('evaluateReferenceBudget normalizes and deduplicates identities when configured', () => {
  assert.deepEqual(
    evaluateReferenceBudget({
      budget: resolveEngineReferenceBudget(schema, 'ref2v')!,
      valuesByField: {
        image_urls: [' https://cdn.example.com/a.jpg ', 'https://cdn.example.com/a.jpg'],
        video_urls: ['https://cdn.example.com/b.mp4'],
        audio_urls: ['', 'https://cdn.example.com/c.mp3'],
      },
      getIdentity: (value) => value,
    }),
    { ok: true, count: 3, maxTotal: 3 }
  );
});

test('evaluateReferenceBudget reports overflow and can count duplicate entries', () => {
  assert.deepEqual(
    evaluateReferenceBudget({
      budget: { fieldIds: ['images'], maxTotal: 1, countUniqueUrls: false },
      valuesByField: { images: ['same', 'same'] },
      getIdentity: (value) => value,
    }),
    { ok: false, count: 2, maxTotal: 1 }
  );
});

test('buildReferenceMediaItems preserves active field id, kind, order, and duplicates', () => {
  assert.deepEqual(
    buildReferenceMediaItems(schema, 'ref2v', {
      image_urls: [' a ', 'a'],
      video_urls: ['v'],
      audio_urls: [''],
      edit_images: ['not-active'],
    }),
    [
      { fieldId: 'image_urls', kind: 'image', url: 'a' },
      { fieldId: 'image_urls', kind: 'image', url: 'a' },
      { fieldId: 'video_urls', kind: 'video', url: 'v' },
    ]
  );
});
