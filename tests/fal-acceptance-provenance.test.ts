import assert from 'node:assert/strict';
import test from 'node:test';
import { createFalClient } from '@fal-ai/client';
import { ENV } from '../frontend/src/lib/env';
import { generateVideo } from '../frontend/src/lib/fal';
import { getFalClient } from '../frontend/src/lib/fal-client';
import { FalGenerationError } from '../frontend/src/lib/fal-error';
import { getRuntimeModelById } from '../frontend/config/model-runtime';

const payload = { engineId: 'minimax-h3', prompt: 'Offline provenance test', mode: 't2v' };
const rejection = { detail: [{ type: 'content_policy_violation', loc: ['body', 'prompt'], msg: 'Content blocked' }] };
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

test('Fal acceptance provenance follows validated acknowledgments and the installed SDK stages', async t => {
  const previousKey = ENV.FAL_API_KEY;
  ENV.FAL_API_KEY = 'offline-only';
  t.after(() => { ENV.FAL_API_KEY = previousKey; });
  t.mock.method(console, 'warn', () => {});

  for (const status of [401, 403]) {
    await t.test(`real SDK status HTTP ${status} after onEnqueue retains accepted provenance`, async t => {
      const calls: string[] = [];
      const sdk = createFalClient({ credentials: 'offline-only', fetch: async (_url, init) => {
        calls.push(String(init?.method).toUpperCase());
        return calls.length === 1 ? response({ request_id: 'accepted-one' }) : response({ detail: 'Read authorization unavailable' }, status);
      } });
      t.mock.method(getFalClient(), 'subscribe', sdk.subscribe);
      await assert.rejects(generateVideo(payload), (error: unknown) => {
        assert.ok(error instanceof FalGenerationError);
        assert.equal(error.phase, 'accepted');
        assert.equal(error.providerJobId, 'accepted-one');
        assert.equal(error.status, status);
        return true;
      });
      assert.deepEqual(calls, ['POST', 'GET']);
    });
  }

  await t.test('structured result 422 is terminal only after the accepted identity completed', async t => {
    const calls: string[] = [];
    const sdk = createFalClient({ credentials: 'offline-only', fetch: async (url, init) => {
      calls.push(String(init?.method).toUpperCase());
      if (calls.length === 1) return response({ request_id: 'accepted-result' });
      if (String(url).includes('/status')) return response({ request_id: 'accepted-result', status: 'COMPLETED' });
      return response(rejection, 422);
    } });
    t.mock.method(getFalClient(), 'subscribe', sdk.subscribe);
    await assert.rejects(generateVideo(payload), (error: unknown) => {
      assert.ok(error instanceof FalGenerationError);
      assert.equal(error.phase, 'provider_terminal');
      assert.equal(error.providerJobId, 'accepted-result');
      return true;
    });
    assert.deepEqual(calls, ['POST', 'GET', 'GET']);
  });

  for (const hook of ['onRequestId', 'onQueueUpdate'] as const) {
    await t.test(`a synchronous ${hook} 422 is local after acceptance, never terminal provider evidence`, async t => {
      let calls = 0;
      const sdk = createFalClient({ credentials: 'offline-only', fetch: async () => {
        calls++;
        return calls === 1 ? response({ request_id: 'accepted-hook' }) : response({ request_id: 'accepted-hook', status: 'COMPLETED' });
      } });
      t.mock.method(getFalClient(), 'subscribe', sdk.subscribe);
      const hooks = { [hook]: () => { throw Object.assign(new Error('Local tracking failed'), { status: 422, body: rejection }); } };
      await assert.rejects(generateVideo(payload, hooks), (error: unknown) => {
        assert.ok(error instanceof FalGenerationError);
        assert.equal(error.phase, 'accepted');
        assert.equal(error.providerJobId, 'accepted-hook');
        return true;
      });
      assert.equal(calls, hook === 'onRequestId' ? 1 : 2, 'the result GET must not run after a local hook throws');
    });
  }

  for (const scenario of ['mismatched-completion', 'malformed-completion-result']) {
    await t.test(`${scenario} does not authorize a terminal refund`, async t => {
      let calls = 0;
      const sdk = createFalClient({ credentials: 'offline-only', fetch: async url => {
        calls++;
        if (calls === 1) return response({ request_id: 'accepted-identity' });
        if (String(url).includes('/status')) return response({ request_id: scenario === 'mismatched-completion' ? 'another-request' : 'accepted-identity', status: 'COMPLETED' });
        return response(scenario === 'malformed-completion-result' ? { detail: [] } : rejection, 422);
      } });
      t.mock.method(getFalClient(), 'subscribe', sdk.subscribe);
      await assert.rejects(generateVideo(payload), (error: unknown) => {
        assert.ok(error instanceof FalGenerationError);
        assert.equal(error.phase, 'accepted');
        return true;
      });
    });
  }

  await t.test('an arbitrary error ID or phase cannot manufacture acceptance', async t => {
    t.mock.method(getFalClient(), 'subscribe', async () => {
      throw Object.assign(new Error('SDK failure'), { status: 403, providerJobId: 'untrusted-id', phase: 'accepted' });
    });
    let tracked = 0;
    await assert.rejects(generateVideo(payload, { onRequestId: () => { tracked++; } }), (error: unknown) => {
      assert.ok(error instanceof FalGenerationError);
      assert.equal(error.phase, 'submission_unknown');
      assert.equal(error.providerJobId, undefined);
      return true;
    });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(tracked, 0, 'an error ID must never become an enqueue receipt');
  });

  await t.test('a local hook failure after immediate result cannot be retagged as pretransport', async t => {
    let calls = 0;
    let tracked = 0;
    const sdk = createFalClient({ credentials: 'offline-only', fetch: async url => {
      calls++;
      if (calls === 1) return response({ request_id: 'accepted-immediate' });
      if (String(url).includes('/status')) return response({ request_id: 'accepted-immediate', status: 'COMPLETED' });
      return response({ video_url: 'https://example.test/ready.mp4' });
    } });
    t.mock.method(getFalClient(), 'subscribe', sdk.subscribe);
    await assert.rejects(generateVideo(payload, { onRequestId: () => {
      tracked++;
      if (tracked > 1) throw Object.assign(new Error('Local final tracking failed'), { status: 422, body: rejection });
    } }), (error: unknown) => {
      assert.ok(error instanceof FalGenerationError);
      assert.equal(error.phase, 'accepted');
      assert.equal(error.providerJobId, 'accepted-immediate');
      return true;
    });
    assert.equal(calls, 3);
  });

  for (const status of [401, 403, 429, 422]) {
    await t.test(`single POST enqueue HTTP ${status} rejection stays definitive without acceptance`, async t => {
      let calls = 0;
      t.mock.method(globalThis, 'fetch', async () => { calls++; return response({ ...rejection, request_id: 'untrusted-body-id' }, status); });
      await assert.rejects(generateVideo({ ...payload, submissionMode: 'enqueue' }), (error: unknown) => {
        assert.ok(error instanceof FalGenerationError);
        assert.equal(error.phase, 'submission_rejected');
        assert.equal(error.providerJobId, undefined);
        return true;
      });
      assert.equal(calls, 1);
    });
  }

  await t.test('a network exception carrying an HTTP-looking status is not a definitive POST rejection', async t => {
    let calls = 0;
    t.mock.method(globalThis, 'fetch', async () => {
      calls++;
      throw Object.assign(new Error('Ambiguous transport failure'), { status: 403 });
    });
    await assert.rejects(generateVideo({ ...payload, submissionMode: 'enqueue' }), (error: unknown) => {
      assert.ok(error instanceof FalGenerationError);
      assert.equal(error.phase, 'submission_unknown');
      return true;
    });
    assert.equal(calls, 1);
  });

  await t.test('validated enqueue acceptance precedes a failing persistence hook', async t => {
    let calls = 0;
    t.mock.method(globalThis, 'fetch', async () => { calls++; return response({ request_id: 'accepted-enqueue' }); });
    await assert.rejects(generateVideo({ ...payload, submissionMode: 'enqueue' }, { onRequestId: () => {
      throw Object.assign(new Error('Local persistence forbidden'), { status: 422, body: rejection });
    } }), (error: unknown) => {
      assert.ok(error instanceof FalGenerationError);
      assert.equal(error.phase, 'accepted');
      assert.equal(error.providerJobId, 'accepted-enqueue');
      return true;
    });
    assert.equal(calls, 1);
  });

  await t.test('forced Kling enqueue keeps a malformed 2xx acknowledgment uncertain', async t => {
    const model = getRuntimeModelById('kling-v4')!;
    const published = model.publication.app.published;
    model.publication.app.published = true;
    t.after(() => { model.publication.app.published = published; });
    let calls = 0;
    t.mock.method(globalThis, 'fetch', async () => { calls++; return response({}); });
    await assert.rejects(generateVideo({ ...payload, engineId: 'kling-v4' }), (error: unknown) => {
      assert.ok(error instanceof FalGenerationError);
      assert.equal(error.phase, 'submission_unknown');
      return true;
    });
    assert.equal(calls, 1);
  });

  await t.test('known pretransport configuration failure cannot become uncertain acceptance', async t => {
    ENV.FAL_API_KEY = '';
    t.after(() => { ENV.FAL_API_KEY = 'offline-only'; });
    t.mock.method(globalThis, 'fetch', async () => { assert.fail('No provider call is allowed'); });
    await assert.rejects(generateVideo({ ...payload, submissionMode: 'enqueue' }), (error: unknown) => {
      assert.ok(error instanceof FalGenerationError);
      assert.equal(error.phase, 'pre_submission');
      return true;
    });
  });
});
