import assert from 'node:assert/strict';
import test from 'node:test';

import { calculateLumaRay2EditPrice, calculateLumaRay2Price } from '../frontend/src/lib/luma-ray2-pricing';

const BASE_USD = 0.5;

function extractTotal(duration: number | string, resolution: string) {
  const { totalUsd } = calculateLumaRay2Price({ baseUsd: BASE_USD, duration, resolution });
  return totalUsd;
}

test('Luma Ray 2 pricing scales with duration and resolution factors', () => {
  assert.equal(extractTotal('5s', '540p'), 0.5);
  assert.equal(extractTotal('9s', '540p'), 1.0);
  assert.equal(extractTotal('5s', '720p'), 1.0);
  assert.equal(extractTotal('9s', '1080p'), 4.0);
});

test('Luma Ray 2 pricing preserves four decimal precision internally', () => {
  const { totalUsd, breakdown } = calculateLumaRay2Price({ baseUsd: 0.3333, duration: '9s', resolution: '1080p' });
  assert.equal(totalUsd, Number((0.3333 * 2 * 4).toFixed(4)));
  assert.equal(breakdown.computed_total_usd, totalUsd);
});

test('Luma Ray 2 pricing helper can label Flash breakdowns', () => {
  const { breakdown } = calculateLumaRay2Price({
    engineId: 'luma-ray2-flash',
    baseUsd: BASE_USD,
    duration: '5s',
    resolution: '540p',
  });
  assert.equal(breakdown.engineId, 'luma-ray2-flash');
});

test('Luma Ray 2 edit pricing uses per-second rates for modify', () => {
  const { totalUsd, breakdown } = calculateLumaRay2EditPrice({
    engineId: 'luma-ray2',
    workflow: 'modify',
    durationSec: 9,
    rateUsd: 0.12,
  });
  assert.equal(totalUsd, 1.08);
  assert.equal(breakdown.workflow, 'modify');
  assert.equal(breakdown.rate_per_second_usd, 0.12);
});

test('Luma Ray 2 edit pricing rounds source duration to a whole second', () => {
  const { totalUsd, breakdown } = calculateLumaRay2EditPrice({
    engineId: 'luma-ray2-flash',
    workflow: 'reframe',
    durationSec: 5.4,
    rateUsd: 0.06,
  });
  assert.equal(totalUsd, 0.3);
  assert.equal(breakdown.seconds, 5);
  assert.equal(breakdown.workflow, 'reframe');
});
