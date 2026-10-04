import assert from 'node:assert/strict';
import test from 'node:test';

import {
  isCompletedFalStatus,
  normalizeFalQueueLogStatus,
  normalizeStatus,
} from '../frontend/server/fal-webhook-status';

test('Fal OK status enters completed media finalization before persistence', () => {
  assert.deepEqual(normalizeStatus('OK', 'running', 25), {
    status: 'completed',
    progress: 100,
  });
  assert.equal(isCompletedFalStatus('OK'), true);
});

test('Fal queue logs retain their terminal, in-flight, and unknown status mapping', () => {
  assert.equal(normalizeFalQueueLogStatus('COMPLETED'), 'completed');
  for (const status of ['FAILED', 'ERROR', 'ERRORED', 'CANCELED', 'CANCELLED', 'ABORTED']) {
    assert.equal(normalizeFalQueueLogStatus(status), 'failed', status);
  }
  for (const status of ['QUEUED', 'RUNNING', 'IN_PROGRESS', 'PROCESSING', 'PENDING', null, undefined]) {
    assert.equal(normalizeFalQueueLogStatus(status), 'running', String(status));
  }
  assert.equal(normalizeFalQueueLogStatus('UNRECOGNIZED'), 'unrecognized');
  assert.equal(normalizeFalQueueLogStatus(''), '');
});
