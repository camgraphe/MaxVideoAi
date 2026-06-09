import assert from 'node:assert/strict';
import test from 'node:test';

import {
  classifyLumaAgentsError,
  LumaAgentsError,
  shouldFallbackFromLumaAgentsSubmit,
} from '../frontend/src/server/video-providers/luma-agents/errors';
import { normalizeLumaAgentsGeneration } from '../frontend/src/server/video-providers/luma-agents/response';

test('Luma Agents response normalizes queued and running states', () => {
  assert.deepEqual(
    normalizeLumaAgentsGeneration({
      id: 'gen_queued',
      state: 'queued',
      model: 'ray-3.2',
      type: 'video',
    }),
    {
      providerJobId: 'gen_queued',
      status: 'queued',
      rawStatus: 'queued',
      videoUrl: null,
      message: null,
      usage: null,
      raw: {
        id: 'gen_queued',
        state: 'queued',
        model: 'ray-3.2',
        type: 'video',
      },
    }
  );

  assert.equal(
    normalizeLumaAgentsGeneration({
      id: 'gen_running',
      state: 'dreaming',
      model: 'ray-3.2',
      type: 'video',
    }).status,
    'running'
  );
});

test('Luma Agents response extracts video output URLs and failure messages', () => {
  const completed = normalizeLumaAgentsGeneration({
    id: 'gen_done',
    state: 'completed',
    model: 'ray-3.2',
    type: 'video',
    output: [
      { type: 'thumbnail', url: 'https://assets.luma.ai/thumb.jpg' },
      { type: 'video', url: 'https://assets.luma.ai/video.mp4' },
    ],
  });

  assert.equal(completed.status, 'completed');
  assert.equal(completed.videoUrl, 'https://assets.luma.ai/video.mp4');

  const failed = normalizeLumaAgentsGeneration({
    id: 'gen_failed',
    state: 'failed',
    failure_reason: 'Safety policy blocked this generation',
    failure_code: 'content_policy',
  });

  assert.equal(failed.status, 'failed');
  assert.equal(failed.message, 'Safety policy blocked this generation');
});

test('Luma Agents error classification distinguishes fallback-safe submit errors', () => {
  const rpm = classifyLumaAgentsError(
    new LumaAgentsError('Luma submit failed.', {
      status: 429,
      body: { detail: 'Rate limit exceeded' },
    })
  );
  assert.equal(rpm.errorClass, 'rate_limit');
  assert.equal(rpm.fallbackEligible, true);

  const concurrent = classifyLumaAgentsError(
    new LumaAgentsError('Luma submit failed.', {
      status: 429,
      body: { detail: 'Too many concurrent jobs' },
    })
  );
  assert.equal(concurrent.errorClass, 'concurrent_limit');

  const invalid = classifyLumaAgentsError(
    new LumaAgentsError('Luma submit failed.', {
      status: 422,
      body: { detail: 'Invalid aspect_ratio' },
    })
  );
  assert.equal(invalid.errorClass, 'invalid_request');
  assert.equal(invalid.fallbackEligible, false);

  assert.equal(
    shouldFallbackFromLumaAgentsSubmit({
      acceptedProviderJobId: null,
      error: new LumaAgentsError('Gateway timeout', { status: 504 }),
      fallbackToFalEnabled: true,
    }),
    true
  );
  assert.equal(
    shouldFallbackFromLumaAgentsSubmit({
      acceptedProviderJobId: 'gen_accepted',
      error: new LumaAgentsError('Gateway timeout', { status: 504 }),
      fallbackToFalEnabled: true,
    }),
    false
  );
});
