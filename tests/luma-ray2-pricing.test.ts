import assert from 'node:assert/strict';
import test from 'node:test';

import { calculateLumaRay2Price } from '../frontend/src/lib/luma-ray2-pricing';

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
