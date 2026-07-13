import assert from 'node:assert/strict';
import test from 'node:test';

import { ENV } from '../frontend/src/lib/env';
import {
  getLumaRay2BasePriceUsd,
  getLumaRay2EditRateUsd,
} from '../frontend/src/lib/luma-ray2-pricing-config';

test('Luma Ray 2 pricing config preserves explicit invalid values for caller validation', () => {
  const originalBase = ENV.LUMARAY2_BASE_5S_540P_USD;
  const originalModify = ENV.LUMARAY2_MODIFY_PER_SECOND_USD;
  try {
    ENV.LUMARAY2_BASE_5S_540P_USD = 'invalid';
    ENV.LUMARAY2_MODIFY_PER_SECOND_USD = '-1';
    assert.equal(Number.isNaN(getLumaRay2BasePriceUsd('lumaRay2')), true);
    assert.equal(getLumaRay2EditRateUsd('lumaRay2', 'modify'), -1);
  } finally {
    ENV.LUMARAY2_BASE_5S_540P_USD = originalBase;
    ENV.LUMARAY2_MODIFY_PER_SECOND_USD = originalModify;
  }
});
