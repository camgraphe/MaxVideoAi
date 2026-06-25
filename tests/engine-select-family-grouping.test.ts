import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildEngineFamilyGroups,
  formatEngineSelectScore,
  formatEngineSelectScorePercent,
} from '../frontend/src/components/ui/engine-select/engine-select-helpers.ts';
import type { EngineCaps } from '../frontend/types/engines.ts';

const baseEngine: EngineCaps = {
  id: 'base',
  label: 'Base',
  provider: 'Test',
  status: 'live',
  latencyTier: 'standard',
  modes: ['t2v'],
  maxDurationSec: 5,
  resolutions: ['720p'],
  aspectRatios: ['16:9'],
  fps: [24],
  audio: false,
  upscale4k: false,
  extend: false,
  motionControls: false,
  keyframes: false,
  params: {},
  inputLimits: {},
  availability: 'available',
  updatedAt: '2026-01-01',
  ttlSec: 60,
};

function engine(id: string, label: string): EngineCaps {
  return {
    ...baseEngine,
    id,
    label,
  };
}

function registryMeta(entries: Array<{ id: string; family?: string; brandId?: string; rank?: number; isLegacy?: boolean }>) {
  return {
    order: new Map(entries.map((entry, index) => [entry.id, index])),
    meta: new Map(
      entries.map((entry) => [
        entry.id,
        {
          id: entry.id,
          modelSlug: entry.id,
          provider: 'test',
          marketingName: entry.id,
          cardTitle: entry.id,
          brandId: entry.brandId,
          family: entry.family,
          category: 'video',
          availability: 'available',
          surfaces: {
            app: {
              discoveryRank: entry.rank,
            },
          },
          isLegacy: entry.isLegacy,
        },
      ])
    ),
  };
}

test('buildEngineFamilyGroups keeps strategic families first and models ordered by discovery rank', () => {
  const groups = buildEngineFamilyGroups({
    engines: [
      engine('seedance-2-0', 'Seedance 2.0'),
      engine('kling-3-pro', 'Kling 3 Pro'),
      engine('veo-3-1-fast', 'Veo 3.1 Fast'),
      engine('happy-horse-runway', 'Happy Horse'),
      engine('sora-2-pro', 'Sora 2 Pro'),
      engine('ltx-2', 'LTX 2'),
      engine('wan-2-5', 'Wan 2.5'),
      engine('pika-2-2', 'Pika 2.2'),
      engine('hailuo-2-3', 'Hailuo 2.3'),
      engine('luma-ray-2', 'Luma Ray 2'),
      engine('veo-3-1', 'Veo 3.1'),
    ],
    registryMeta: registryMeta([
      { id: 'seedance-2-0', family: 'seedance', brandId: 'bytedance', rank: 8 },
      { id: 'kling-3-pro', family: 'kling', brandId: 'kling', rank: 30 },
      { id: 'veo-3-1-fast', family: 'veo', brandId: 'google-veo', rank: 12 },
      { id: 'happy-horse-runway', family: 'happy-horse', brandId: 'minimax', rank: 18 },
      { id: 'sora-2-pro', family: 'sora', brandId: 'openai', rank: 5 },
      { id: 'ltx-2', family: 'ltx', brandId: 'ltx', rank: 20 },
      { id: 'wan-2-5', family: 'wan', brandId: 'wan', rank: 22 },
      { id: 'pika-2-2', family: 'pika', brandId: 'pika', rank: 24 },
      { id: 'hailuo-2-3', family: 'hailuo', brandId: 'minimax', rank: 26 },
      { id: 'luma-ray-2', family: 'luma', brandId: 'luma', rank: 4 },
      { id: 'veo-3-1', family: 'veo', brandId: 'google-veo', rank: 10 },
    ]),
  });

  assert.deepEqual(groups.map((group) => group.id), [
    'seedance',
    'kling',
    'veo',
    'happy-horse',
    'luma',
    'sora',
    'ltx',
    'wan',
    'pika',
    'hailuo',
  ]);
  assert.deepEqual(groups.find((group) => group.id === 'veo')?.engines.map((entry) => entry.id), [
    'veo-3-1',
    'veo-3-1-fast',
  ]);
  assert.equal(groups[0].label, 'Seedance');
  assert.equal(groups[0].brandId, 'bytedance');
});

test('buildEngineFamilyGroups orders models by score when score data is available', () => {
  const groups = buildEngineFamilyGroups({
    engines: [
      engine('seedance-2-0-fast', 'Seedance 2.0 Fast'),
      engine('seedance-2-0', 'Seedance 2.0'),
      engine('dreamina-seedance-2-0-mini', 'Dreamina Seedance 2.0 Mini'),
    ],
    engineScores: {
      'dreamina-seedance-2-0-mini': 8.2,
      'seedance-2-0': 9.4,
      'seedance-2-0-fast': 8.8,
    },
    registryMeta: registryMeta([
      { id: 'seedance-2-0-fast', family: 'seedance', rank: 1 },
      { id: 'seedance-2-0', family: 'seedance', rank: 2 },
      { id: 'dreamina-seedance-2-0-mini', family: 'seedance', rank: 3 },
    ]),
  });

  assert.deepEqual(groups[0].engines.map((entry) => entry.id), [
    'seedance-2-0',
    'seedance-2-0-fast',
    'dreamina-seedance-2-0-mini',
  ]);
});

test('buildEngineFamilyGroups hides legacy variants unless selected or explicitly enabled', () => {
  const meta = registryMeta([
    { id: 'seedance-2-0', family: 'seedance', rank: 1 },
    { id: 'seedance-1-5-pro', family: 'seedance', rank: 2, isLegacy: true },
  ]);

  const hiddenLegacy = buildEngineFamilyGroups({
    engines: [engine('seedance-2-0', 'Seedance 2.0'), engine('seedance-1-5-pro', 'Seedance 1.5 Pro')],
    registryMeta: meta,
  });
  assert.deepEqual(hiddenLegacy[0].engines.map((entry) => entry.id), ['seedance-2-0']);

  const selectedLegacy = buildEngineFamilyGroups({
    engines: [engine('seedance-2-0', 'Seedance 2.0'), engine('seedance-1-5-pro', 'Seedance 1.5 Pro')],
    registryMeta: meta,
    selectedEngineId: 'seedance-1-5-pro',
  });
  assert.deepEqual(selectedLegacy[0].engines.map((entry) => entry.id), ['seedance-2-0', 'seedance-1-5-pro']);
});

test('buildEngineFamilyGroups creates readable fallback families and formats compact scores', () => {
  const groups = buildEngineFamilyGroups({
    engines: [engine('nano-banana-2', 'Nano Banana 2'), engine('experimental-ai', 'Experimental AI')],
    registryMeta: registryMeta([
      { id: 'nano-banana-2', family: 'nano-banana', brandId: 'google-gemini', rank: 10 },
      { id: 'experimental-ai', brandId: 'experimental', rank: 20 },
    ]),
  });

  assert.deepEqual(groups.map((group) => [group.id, group.label]), [
    ['nano-banana', 'Nano Banana'],
    ['experimental', 'Experimental'],
  ]);
  assert.equal(formatEngineSelectScore(9.37), '9.4');
  assert.equal(formatEngineSelectScorePercent(9.37), '94');
  assert.equal(formatEngineSelectScore(null), null);
  assert.equal(formatEngineSelectScore(Number.NaN), null);
});
