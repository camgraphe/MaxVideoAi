import assert from 'node:assert/strict';
import test from 'node:test';
import { createModelEstimateQueue, modelEstimateKey } from '../frontend/lib/model-picker-estimates';

const quote = { amount: 91, currency: 'USD' };
const tick = () => new Promise<void>(resolve => setImmediate(resolve));
function deferred() {
  let resolve!: (value: typeof quote) => void;
  const promise = new Promise<typeof quote>(done => { resolve = done; });
  return { promise, resolve };
}

test('estimate keys are canonical and distinguish every billed setting and account', () => {
  assert.equal(modelEstimateKey({ a: 1, b: { z: 2, y: 3 } }), modelEstimateKey({ b: { y: 3, z: 2 }, a: 1 }));
  assert.notEqual(modelEstimateKey({ account: 'a', audio: false }), modelEstimateKey({ account: 'b', audio: false }));
  assert.notEqual(modelEstimateKey({ references: [{ duration: 5 }] }), modelEstimateKey({ references: [{ duration: 5.1 }] }));
});

test('six quotes run at most three at once and duplicate consumers share the same work', async () => {
  const queue = createModelEstimateQueue();
  const pending = Array.from({ length: 6 }, deferred);
  let started = 0;
  const leases = pending.map((item, index) => queue.acquire(String(index), async () => { started++; return item.promise; }));
  const duplicate = queue.acquire('0', async () => { throw new Error('duplicate must not run'); });
  await tick();
  assert.equal(started, 3);
  pending[0].resolve(quote);
  assert.deepEqual(await duplicate.promise, quote);
  await tick();
  assert.equal(started, 4);
  pending.slice(1).forEach(item => item.resolve(quote));
  await Promise.all(leases.map(lease => lease.promise));
  assert.equal(started, 6);
  assert.equal(queue.stats().peakActive, 3);
});

test('closing drops queued work but reopening running work shares its eventual result', async () => {
  const queue = createModelEstimateQueue({ concurrency: 1 });
  const first = deferred();
  const running = queue.acquire('a', () => first.promise);
  const queued = queue.acquire('b', async () => { throw new Error('closed queued request started'); });
  const canceled = assert.rejects(queued.promise, { name: 'AbortError' });
  running.release();
  queued.release();
  const reopened = queue.acquire('a', async () => { throw new Error('running request duplicated'); });
  first.resolve(quote);
  assert.deepEqual(await reopened.promise, quote);
  await canceled;
  assert.equal(queue.stats().started, 1);
});

test('success cache expires after 60 seconds and failures can retry immediately', async () => {
  let now = 0;
  const queue = createModelEstimateQueue({ now: () => now });
  let calls = 0;
  const load = async () => { calls++; return quote; };
  await queue.acquire('a', load).promise;
  now = 59_999;
  await queue.acquire('a', load).promise;
  assert.equal(calls, 1);
  now = 60_000;
  await queue.acquire('a', load).promise;
  assert.equal(calls, 2);
  await assert.rejects(queue.acquire('error', async () => { throw new Error('offline'); }).promise, /offline/);
  assert.deepEqual(await queue.acquire('error', load).promise, quote);
});

test('invalidating a tariff/account cannot let a late quote populate the new cache', async () => {
  const queue = createModelEstimateQueue();
  const old = deferred();
  const first = queue.acquire('a', () => old.promise);
  queue.clear();
  old.resolve(quote);
  await first.promise;
  const fresh = { amount: 120, currency: 'USD' };
  assert.deepEqual(await queue.acquire('a', async () => fresh).promise, fresh);
});

test('cache is bounded and invalid amounts are never retained', async () => {
  const queue = createModelEstimateQueue({ maxEntries: 2 });
  for (const key of ['a', 'b', 'c']) await queue.acquire(key, async () => quote).promise;
  assert.equal(queue.stats().cached, 2);
  await assert.rejects(queue.acquire('bad', async () => ({ amount: NaN, currency: 'USD' })).promise, /estimate/i);
  assert.deepEqual(await queue.acquire('bad', async () => quote).promise, quote);
});
