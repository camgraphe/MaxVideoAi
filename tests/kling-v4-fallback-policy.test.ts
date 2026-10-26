import assert from 'node:assert/strict';
import test from 'node:test';
import { KlingDirectError, shouldFallbackFromKlingDirectSubmit } from '../frontend/src/server/video-providers/kling-direct/errors';

test('V4 fallback requires definite non-acceptance and enabled fallback', () => {
  const input = { acceptedProviderJobId: null, fallbackToFalEnabled: true, requireDefiniteRejection: true };
  for (const error of [new Error('fetch failed'), new Error('network timeout'), new KlingDirectError('missing id', { code: 'KLING_TASK_ID_MISSING' }), new KlingDirectError('server unavailable', { status: 503 })]) {
    assert.equal(shouldFallbackFromKlingDirectSubmit({ ...input, error }), false);
  }
  const rejected = new KlingDirectError('rate limited', { status: 429, code: '1302' });
  assert.equal(shouldFallbackFromKlingDirectSubmit({ ...input, error: rejected }), true);
  assert.equal(shouldFallbackFromKlingDirectSubmit({ ...input, acceptedProviderJobId: 'accepted-task', error: rejected }), false);
  assert.equal(shouldFallbackFromKlingDirectSubmit({ ...input, fallbackToFalEnabled: false, error: rejected }), false);
  assert.equal(shouldFallbackFromKlingDirectSubmit({ ...input, error: new KlingDirectError('access denied', { status: 403, code: '1103' }) }), false);
});
