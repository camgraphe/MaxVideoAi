import assert from 'node:assert/strict';
import test from 'node:test';

import {
  isAlibabaDirectEngine,
  resolveAlibabaModelRoute,
} from '../frontend/src/server/video-providers/alibaba-model-studio/model-map';
import { estimateAlibabaProviderCost } from '../frontend/src/server/video-providers/alibaba-model-studio/cost';

test('Alibaba model routing maps only the approved canonical engines and modes', () => {
  assert.deepEqual(resolveAlibabaModelRoute('wan-3', 't2v'), {
    model: 'wan3.0-video',
    family: 'wan3',
    mode: 't2v',
    fallbackCompatible: true,
  });
  assert.deepEqual(resolveAlibabaModelRoute('wan-3-prime', 'extend'), {
    model: 'wan3.0-video-prime',
    family: 'wan3',
    mode: 'extend',
    fallbackCompatible: false,
  });
  assert.deepEqual(resolveAlibabaModelRoute('happy-horse-1-1', 'ref2v'), {
    model: 'happyhorse-1.1-r2v',
    family: 'happyhorse11',
    mode: 'ref2v',
    fallbackCompatible: true,
  });
  assert.equal(resolveAlibabaModelRoute('wan-2-6', 't2v'), null);
  assert.equal(resolveAlibabaModelRoute('happy-horse-1-0', 'v2v'), null);
  assert.equal(isAlibabaDirectEngine('wan-3'), true);
  assert.equal(isAlibabaDirectEngine('wan-3-prime'), true);
  assert.equal(isAlibabaDirectEngine('happy-horse-1-1'), true);
  assert.equal(isAlibabaDirectEngine('wan-2-6'), false);
});

test('Wan 3 factual cost includes input and output video duration', () => {
  assert.deepEqual(estimateAlibabaProviderCost({
    engineId: 'wan-3',
    mode: 'ref2v',
    durationSec: 10,
    inputVideoDurationSec: 5,
    resolution: '720p',
  }), {
    providerCostUnits: 15,
    providerCostUsd: 1.5,
    source: 'alibaba_singapore_2026-09-12',
  });

  assert.equal(estimateAlibabaProviderCost({
    engineId: 'wan-3-prime',
    mode: 't2v',
    durationSec: 10,
    inputVideoDurationSec: 0,
    resolution: '1080p',
  }).providerCostUsd, 2.8);
});

test('HappyHorse 1.1 factual cost bills output duration only', () => {
  assert.deepEqual(estimateAlibabaProviderCost({
    engineId: 'happy-horse-1-1',
    mode: 'i2v',
    durationSec: 5,
    inputVideoDurationSec: 9,
    resolution: '1080p',
  }), {
    providerCostUnits: 5,
    providerCostUsd: 0.9,
    source: 'alibaba_singapore_2026-09-12',
  });
});

test('Alibaba factual cost rejects unmapped models and resolutions', () => {
  assert.throws(() => estimateAlibabaProviderCost({
    engineId: 'wan-2-6',
    mode: 't2v',
    durationSec: 5,
    resolution: '720p',
  }), /not mapped to Alibaba Model Studio/);

  assert.throws(() => estimateAlibabaProviderCost({
    engineId: 'wan-3',
    mode: 't2v',
    durationSec: 5,
    resolution: '4k',
  }), /Unsupported Alibaba resolution/);
});
