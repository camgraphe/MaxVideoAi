import assert from 'node:assert/strict';
import test from 'node:test';
import { upscaleRequestIdentity, readAcceptedUpscale } from '../frontend/src/server/tools/upscale-acceptance';
import { submitFalQueueOnce } from '../frontend/src/lib/fal-queue-submit';
import { waitForUpscale } from '../frontend/lib/upscale-client-lifecycle';
import { upscaleDurationIsComplete } from '../frontend/server/upscale-duration-integrity';
import type { UpscaleToolResponse } from '../frontend/types/tools-upscale';
import type { JobStatusResult } from '../frontend/lib/api-job-status';

test('upscale intent identity is stable, owner-scoped, and binds all media settings', () => {
  const input = { userId: 'alice', requestId: 'request-1234567890', mediaType: 'video' as const, mediaUrl: 'https://example.test/v.mp4' };
  const a = upscaleRequestIdentity(input);
  assert.deepEqual(upscaleRequestIdentity({ ...input }), a);
  assert.notEqual(upscaleRequestIdentity({ ...input, userId: 'bob' }).jobId, a.jobId);
  assert.equal(upscaleRequestIdentity({ ...input, targetResolution: '2160p' }).jobId, a.jobId);
  assert.notEqual(upscaleRequestIdentity({ ...input, targetResolution: '2160p' }).fingerprint, a.fingerprint);
  assert.throws(() => upscaleRequestIdentity({ ...input, requestId: undefined }));
});

test('lost queue acknowledgment and server errors never repeat a paid POST', async () => {
  for (const failure of ['network', '500', 'invalid-json']) {
    let calls = 0;
    const fetchFn = (async () => {
      calls++;
      if (failure === 'network') throw new Error('connection lost after acceptance');
      return new Response(failure === 'invalid-json' ? 'oops' : '{}', { status: failure === 'invalid-json' ? 200 : 500 });
    }) as typeof fetch;
    await assert.rejects(submitFalQueueOnce('fal-ai/seedvr/upscale/video', {}, 'job', fetchFn));
    assert.equal(calls, 1);
  }
});

test('a long accepted upscale survives status outages and completes from the same job', async () => {
  const accepted: UpscaleToolResponse = { ok: true, status: 'pending', jobId: 'one-job', mediaType: 'video', engineId: 'seedvr-video', engineLabel: 'SeedVR', latencyMs: 0, pricing: { estimatedCostUsd: 1, estimatedCredits: 100 } };
  let polls = 0, waits = 0, terminals = 0;
  const result = await waitForUpscale(accepted, {
    isCurrent: () => true, onTerminal: () => { terminals++; }, sleep: async () => { waits++; },
    getStatus: async jobId => {
      assert.equal(jobId, 'one-job'); polls++;
      if (polls % 10 === 0) throw new Error('429 / network unavailable');
      return { status: polls > 1000 ? 'completed' : 'pending', videoUrl: polls > 1000 ? 'https://example.test/full.mp4' : null } as JobStatusResult;
    },
  });
  assert.equal(waits, 1001); // More than 80 minutes at the real polling interval.
  assert.equal(terminals, 1);
  assert.equal(result.output?.url, 'https://example.test/full.mp4');
});

test('upscale duration tolerance never grows with clip length or silence', () => {
  for (const duration of [6.041667, 30, 300, 1800]) {
    assert.equal(upscaleDurationIsComplete(duration, duration, 24), true);
    assert.equal(upscaleDurationIsComplete(duration, duration - 1 / 24, 24), true);
    for (const missing of [0.375, 0.5, 5, 30]) {
      if (duration > missing) assert.equal(upscaleDurationIsComplete(duration, duration - missing, 24), false);
    }
  }
});

test('replayed accepted jobs preserve terminal failure and reject a different payload', async () => {
  const executor = { query: async <T>() => [{ job_id: 'job', status: 'failed', settings_snapshot: { requestFingerprint: 'same' }, final_price_cents: 100 }] as T[] };
  assert.equal((await readAcceptedUpscale('job', 'same', executor))?.status, 'failed');
  await assert.rejects(readAcceptedUpscale('job', 'changed', executor), /different settings/);
});
