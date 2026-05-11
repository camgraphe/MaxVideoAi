import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getBrowseEngineResolutionValues,
  getBrowseResolutionOptions,
  engineMatchesBrowseResolution,
} from '../frontend/src/components/ui/engine-select/engine-select-helpers.ts';
import type { EngineCaps } from '../frontend/types/engines.ts';

const baseEngine: EngineCaps = {
  id: 'base',
  label: 'Base',
  provider: 'Test',
  version: '1',
  category: 'image',
  modes: ['t2i'],
  resolutions: ['720p'],
  aspectRatios: ['1:1'],
  inputLimits: {},
  maxDurationSec: 1,
};

test('Seedream contributes only base 2K/3K/4K filters to browse engines', () => {
  const seedream: EngineCaps = {
    ...baseEngine,
    id: 'seedream',
    label: 'Seedream',
    resolutions: ['2K', '3K', '4K', '2048x2048', '2304x1728', '6240x2656'],
  };

  assert.deepEqual(getBrowseEngineResolutionValues(seedream), ['2K', '3K', '4K']);
  assert.deepEqual(getBrowseResolutionOptions([seedream]), ['4K', '3K', '2K']);
  assert.equal(engineMatchesBrowseResolution(seedream, '2K'), true);
  assert.equal(engineMatchesBrowseResolution(seedream, '2048x2048'), false);
});

test('Browse engine resolution filters dedupe casing and hide shape presets', () => {
  const nanoBanana2: EngineCaps = {
    ...baseEngine,
    id: 'nano-banana-2',
    label: 'Nano Banana 2',
    resolutions: ['0.5k', '1k', '2k', '4k'],
  };
  const gptImage2: EngineCaps = {
    ...baseEngine,
    id: 'gpt-image-2',
    label: 'GPT Image 2',
    resolutions: ['landscape_4_3', 'square_hd', 'square', 'portrait_4_3', 'custom', 'auto'],
  };
  const seedream: EngineCaps = {
    ...baseEngine,
    id: 'seedream',
    label: 'Seedream',
    resolutions: ['2K', '3K', '4K', '2048x2048'],
  };

  assert.deepEqual(getBrowseEngineResolutionValues(nanoBanana2), ['0.5K', '1K', '2K', '4K']);
  assert.deepEqual(getBrowseEngineResolutionValues(gptImage2), []);
  assert.deepEqual(getBrowseResolutionOptions([nanoBanana2, gptImage2, seedream]), ['4K', '3K', '2K', '1K', '0.5K']);
  assert.equal(engineMatchesBrowseResolution(nanoBanana2, '1K'), true);
  assert.equal(engineMatchesBrowseResolution(gptImage2, 'square_hd'), false);
});
