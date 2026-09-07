import assert from 'node:assert/strict';
import test from 'node:test';
import { ENV } from '../frontend/src/lib/env';
import { getFalClient } from '../frontend/src/lib/fal-client';
import { generateVideo } from '../frontend/src/lib/fal';
import { FalGenerationError } from '../frontend/src/lib/fal-error';

test('MCP enqueue returns the accepted request without subscribing to a long render and awaits persistence', async (t) => {
  const previousKey = ENV.FAL_API_KEY;
  ENV.FAL_API_KEY = 'test-only';
  t.after(() => { ENV.FAL_API_KEY = previousKey; });
  const client = getFalClient();
  let submits = 0;
  t.mock.method(client.queue, 'submit', async (model: string, options: { input: Record<string, unknown> }) => {
    submits += 1;
    assert.equal(model, 'minimax/h3/reference-to-video');
    assert.equal(options.input.submissionMode, undefined);
    return { request_id: 'accepted-request' };
  });
  t.mock.method(client, 'subscribe', async () => {
    throw new Error('Must not wait for rendering inside MCP confirmation');
  });
  let release!: () => void;
  const persisted = new Promise<void>((resolve) => { release = resolve; });
  let enteredPersistence!: () => void;
  const started = new Promise<void>((resolve) => { enteredPersistence = resolve; });
  let settled = false;
  const generation = generateVideo({
    engineId: 'minimax-h3', prompt: 'Test', mode: 'ref2v',
    submissionMode: 'enqueue', durationSec: 5, resolution: '2K', aspectRatio: '16:9',
  }, {
    onRequestId: async (id) => {
      assert.equal(id, 'accepted-request');
      enteredPersistence();
      await persisted;
    },
  });
  generation.then(() => { settled = true; }, () => { settled = true; enteredPersistence(); });
  await started;
  assert.equal(settled, false, 'acceptance must wait for durable request tracking');
  release();
  const result = await generation;
  assert.equal(submits, 1);
  assert.equal(result.providerJobId, 'accepted-request');
  assert.equal(result.status, 'queued');
  assert.equal(result.videoUrl, undefined);
});

test('an enqueue rejection preserves the provider error and never submits a replacement', async (t) => {
  const previousKey = ENV.FAL_API_KEY;
  ENV.FAL_API_KEY = 'test-only';
  t.after(() => { ENV.FAL_API_KEY = previousKey; });
  const client = getFalClient();
  let submits = 0;
  t.mock.method(client.queue, 'submit', async () => {
    submits += 1;
    throw Object.assign(new Error('Rejected input'), { status: 422, body: { detail: 'Invalid reference' } });
  });
  t.mock.method(client, 'subscribe', async () => { throw new Error('Unexpected subscription'); });
  await assert.rejects(generateVideo({
    engineId: 'minimax-h3', prompt: 'Test', mode: 't2v', submissionMode: 'enqueue',
  }), (error: unknown) => {
    assert.ok(error instanceof FalGenerationError);
    assert.equal(error.status, 422);
    assert.equal(error.providerJobId, undefined);
    return true;
  });
  assert.equal(submits, 1);
});

test('ordinary video requests retain synchronous completion', async (t) => {
  const previousKey = ENV.FAL_API_KEY;
  ENV.FAL_API_KEY = 'test-only';
  t.after(() => { ENV.FAL_API_KEY = previousKey; });
  const client = getFalClient();
  t.mock.method(client.queue, 'submit', async () => { throw new Error('Unexpected enqueue-only path'); });
  t.mock.method(client, 'subscribe', async () => ({
    requestId: 'completed-request', data: { video_url: 'https://example.test/output.mp4' },
  }));
  const result = await generateVideo({ engineId: 'minimax-h3', prompt: 'Test', mode: 't2v' });
  assert.equal(result.status, 'completed');
  assert.equal(result.videoUrl, 'https://example.test/output.mp4');
});
