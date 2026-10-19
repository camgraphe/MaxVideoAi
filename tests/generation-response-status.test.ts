import assert from 'node:assert/strict';
import test from 'node:test';
import { runGenerate } from '../frontend/lib/api-generation';

test('accepted provider responses expose canonical status before rendering or analytics', async () => {
  const savedFetch = globalThis.fetch;
  try {
    for (const { body, expected } of [
      { body: { ok: true, jobId: 'job_queued', providerJobId: 'provider-1', status: 'queued' }, expected: 'pending' },
      { body: { ok: true, jobId: 'job_running', status: 'running', progress: 10, deferred: true, message: 'Processing' }, expected: 'pending' },
      { body: { ok: true, jobId: 'job_processing', status: 'processing' }, expected: 'pending' },
      { body: { ok: true, jobId: 'job_accepted' }, expected: 'pending' },
      { body: { ok: true, jobId: 'job_finalizing', status: 'completed', videoUrl: null }, expected: 'pending' },
      { body: { ok: true, jobId: 'job_ready', status: 'completed', videoUrl: 'https://media.example/video.mp4' }, expected: 'completed' },
      { body: { ok: true, jobId: 'job_failed', status: 'failed', paymentStatus: 'refunded' }, expected: 'failed' },
    ]) {
      globalThis.fetch = async (url, init) => {
        assert.equal(url, '/api/generate');
        assert.equal(init?.method, 'POST');
        return new Response(JSON.stringify(body), { status: 202 });
      };
      const result = await runGenerate({ engineId: 'seedance-2-5', prompt: 'Local fixture', mode: 't2v' }, { token: 'fixture-only' });
      assert.equal(result.status, expected, body.jobId);
      assert.equal(result.jobId, body.jobId);
      assert.deepEqual({ ...result, status: body.status }, { ...body, status: body.status });
    }
  } finally { globalThis.fetch = savedFetch; }
});
