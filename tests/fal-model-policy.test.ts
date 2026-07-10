import assert from 'node:assert/strict';
import test from 'node:test';

import {
  FAL_PROXY_ALLOWED_ENDPOINTS,
  assertFalModelAllowed,
  isFalProxyTargetAllowed,
} from '../frontend/src/lib/fal-model-policy';

test('fal proxy policy allows configured Fal targets', () => {
  assert.ok(FAL_PROXY_ALLOWED_ENDPOINTS.includes('fal-ai/sora-2/text-to-video'));
  assert.equal(isFalProxyTargetAllowed('https://queue.fal.run/fal-ai/sora-2/text-to-video'), true);
  assert.equal(
    isFalProxyTargetAllowed('https://queue.fal.run/fal-ai/sora-2/text-to-video/requests/req_123/status?logs=0'),
    true
  );
  assert.equal(
    isFalProxyTargetAllowed('https://rest.fal.ai/storage/upload/initiate?storage_type=fal-cdn-v3'),
    true
  );
  assert.equal(isFalProxyTargetAllowed(null), true);
});

test('fal proxy policy allows native Kling 3 4K endpoints', () => {
  assert.ok(FAL_PROXY_ALLOWED_ENDPOINTS.includes('fal-ai/kling-video/v3/4k/text-to-video'));
  assert.ok(FAL_PROXY_ALLOWED_ENDPOINTS.includes('fal-ai/kling-video/v3/4k/image-to-video'));
  assert.equal(isFalProxyTargetAllowed('https://queue.fal.run/fal-ai/kling-video/v3/4k/text-to-video'), true);
  assert.equal(isFalProxyTargetAllowed('https://queue.fal.run/fal-ai/kling-video/v3/4k/image-to-video'), true);
});

test('fal proxy policy allows Happy Horse 1.1 endpoints', () => {
  [
    'alibaba/happy-horse/v1.1/text-to-video',
    'alibaba/happy-horse/v1.1/image-to-video',
    'alibaba/happy-horse/v1.1/reference-to-video',
  ].forEach((endpoint) => {
    assert.ok(FAL_PROXY_ALLOWED_ENDPOINTS.includes(endpoint));
    assert.equal(isFalProxyTargetAllowed(`https://queue.fal.run/${endpoint}`), true);
  });
  assert.equal(FAL_PROXY_ALLOWED_ENDPOINTS.includes('alibaba/happy-horse/v1.1/video-edit'), false);
  assert.equal(isFalProxyTargetAllowed('https://queue.fal.run/alibaba/happy-horse/v1.1/video-edit'), false);
});

test('fal proxy policy blocks non-Fal targets', () => {
  assert.equal(isFalProxyTargetAllowed('https://example.com/fal-ai/sora-2/text-to-video'), false);
  assert.equal(isFalProxyTargetAllowed('http://queue.fal.run/fal-ai/sora-2/text-to-video'), false);
  assert.equal(isFalProxyTargetAllowed('https://fal.ai/models?category=video'), false);
  assert.equal(isFalProxyTargetAllowed('fal-ai/sora-2/text-to-video'), false);
});

test('fal proxy policy blocks unconfigured Fal endpoints', () => {
  assert.equal(isFalProxyTargetAllowed('https://queue.fal.run/fal-ai/flux/dev'), false);
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

test('fal proxy policy allows audio generation endpoints', () => {
  [
    'bytedance/seed-audio-1.0',
    'fal-ai/elevenlabs/music',
    'fal-ai/gemini-3.1-flash-tts',
    'fal-ai/lyria2',
    'fal-ai/minimax-music/v2.6',
    'fal-ai/mmaudio-v2/text-to-audio',
    'fal-ai/stable-audio-25/text-to-audio',
    'fal-ai/ace-step',
  ].forEach((endpoint) => {
    assert.ok(FAL_PROXY_ALLOWED_ENDPOINTS.includes(endpoint));
    assert.equal(isFalProxyTargetAllowed(`https://queue.fal.run/${endpoint}`), true);
  });
});
