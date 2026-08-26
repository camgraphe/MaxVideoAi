import assert from 'node:assert/strict';
import test from 'node:test';

import {
  isCompletedFalStatus,
  normalizeStatus,
} from '../frontend/server/fal-webhook-status';

test('Fal OK status enters completed media finalization before persistence', () => {
  assert.deepEqual(normalizeStatus('OK', 'running', 25), {
    status: 'completed',
    progress: 100,
  });
  assert.equal(isCompletedFalStatus('OK'), true);
});
