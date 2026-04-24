import assert from 'node:assert/strict';
import test from 'node:test';

import { assertFalModelAllowed, isFalProxyTargetAllowed } from '../frontend/src/lib/fal-model-policy';

test('fal proxy policy allows regular Fal targets', () => {
  assert.equal(isFalProxyTargetAllowed('https://queue.fal.run/fal-ai/lyria2'), true);
  assert.equal(isFalProxyTargetAllowed('https://fal.ai/models?category=video'), true);
  assert.equal(isFalProxyTargetAllowed(null), true);
});

test('fal proxy policy blocks non-Fal targets', () => {
  assert.equal(isFalProxyTargetAllowed('https://example.com/fal-ai/sora-2/text-to-video'), false);
  assert.equal(isFalProxyTargetAllowed('http://queue.fal.run/fal-ai/sora-2/text-to-video'), false);
});

test('fal proxy policy blocks beatoven targets in path and query', () => {
  assert.equal(isFalProxyTargetAllowed('https://queue.fal.run/beatoven/music-generation'), false);
  assert.equal(
    isFalProxyTargetAllowed('https://fal.ai/api/queue/openapi.json?endpoint_id=beatoven/music-generation'),
    false
  );
});

test('fal model policy rejects blocked models directly', () => {
  assert.throws(() => assertFalModelAllowed('beatoven/music-generation'), /blocked by policy/i);
  assert.doesNotThrow(() => assertFalModelAllowed('fal-ai/lyria2'));
});
