import assert from 'node:assert/strict';
import test from 'node:test';

import type { PricingPolicyOverrideLoadResult } from '../frontend/src/lib/pricing-rule-store';
import { createScopedPublicModelQuoter, quotePublicModelScenario, quoteWithVerifiedPolicy } from '../frontend/server/pricing/quote-public-model-scenario';

const input = { modelId: 'pika-text-to-video', mode: 't2v', durationSec: 5, resolution: '720p' };
const policy = (marginPercent = 1): PricingPolicyOverrideLoadResult => ({ status: 'loaded', rules: [{
  id: 'effective-pika', engineId: input.modelId, marginPercent, marginFlatCents: 7, currency: 'USD',
}] });
const unavailable: PricingPolicyOverrideLoadResult = { status: 'unavailable', rules: [], errorCode: 'pricing_rules_query_failed' };
const flush = () => new Promise<void>(resolve => setImmediate(resolve));
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

test('concurrent admitted quotes share a lazy successful policy read and preserve complete canonical quote output', async () => {
  const pending = deferred<PricingPolicyOverrideLoadResult>();
  let reads = 0;
  const quote = createScopedPublicModelQuoter(() => { reads++; return pending.promise; });
  assert.equal(reads, 0, 'constructing a quoter must not start policy I/O');
  const quotes = Array.from({ length: 8 }, () => quote(input));
  await flush();
  assert.equal(reads, 1);
  pending.resolve(policy());
  const expected = await quotePublicModelScenario(input, scenario => quoteWithVerifiedPolicy(scenario, async () => policy()));
  assert.equal(expected.status, 'exact');
  if (expected.status === 'exact') assert.equal(expected.amountCents, 47);
  assert.deepEqual(await Promise.all(quotes), Array(8).fill(expected));
  assert.deepEqual(await quote(input), expected);
  assert.equal(reads, 1, 'a completed successful read is retained only in this scope');
});

test('unsupported scenarios never load policy, including after an unavailable quote', async () => {
  let reads = 0;
  const quote = createScopedPublicModelQuoter(async () => { reads++; return unavailable; });
  for (const invalid of [{ ...input, modelId: 'not-published' }, { ...input, quantity: 2 },
    { ...input, durationSec: -1 }, { ...input, resolution: 'not-supported' }]) {
    assert.deepEqual(await quote(invalid), { status: 'unavailable' });
  }
  assert.equal(reads, 0);
  assert.deepEqual(await quote(input), { status: 'unavailable' });
  assert.equal(reads, 1);
  assert.deepEqual(await quote({ ...input, quantity: 2 }), { status: 'unavailable' });
  assert.equal(reads, 1);
});

for (const failure of ['unavailable', 'rejected', 'synchronous throw'] as const) {
  test(`${failure} policy loads remain truthful and later work in the same scope retries`, async () => {
    const first = deferred<PricingPolicyOverrideLoadResult>();
    let reads = 0;
    const load = () => {
      if (++reads > 1) return Promise.resolve(policy());
      if (failure === 'synchronous throw') throw new Error('Policy query threw synchronously');
      return first.promise;
    };
    const quote = createScopedPublicModelQuoter(load);
    const affected = Array.from({ length: 8 }, () => quote(input));
    await flush();
    assert.equal(reads, 1);
    if (failure === 'unavailable') first.resolve(unavailable);
    else if (failure === 'rejected') first.reject(new Error('Policy query rejected'));
    assert.deepEqual(await Promise.all(affected), Array(8).fill({ status: 'unavailable' }));
    const recovered = await quote(input);
    assert.equal(recovered.status, 'exact');
    if (recovered.status === 'exact') assert.equal(recovered.amountCents, 47);
    assert.equal(reads, 2);
    assert.deepEqual(await quote(input), recovered);
    assert.equal(reads, 2);
    assert.deepEqual(await createScopedPublicModelQuoter(load)(input), recovered);
    assert.equal(reads, 3, 'the next scope must make its own successful read');
  });
}

test('overlapping scopes capture independent policies and a later scope reads an updated policy', async () => {
  const a = deferred<PricingPolicyOverrideLoadResult>();
  const b = deferred<PricingPolicyOverrideLoadResult>();
  let reads = 0;
  let updated = policy(2);
  const load = () => ++reads === 1 ? a.promise : reads === 2 ? b.promise : Promise.resolve(updated);
  const quoteA = createScopedPublicModelQuoter(load);
  const quoteB = createScopedPublicModelQuoter(load);
  const pendingA = quoteA(input);
  const pendingB = quoteB(input);
  await flush();
  assert.equal(reads, 2);
  a.resolve(policy());
  b.resolve(policy(2));
  const resultA = await pendingA;
  const resultB = await pendingB;
  assert.equal(resultA.status, 'exact');
  assert.equal(resultB.status, 'exact');
  if (resultA.status === 'exact' && resultB.status === 'exact') {
    assert.equal(resultA.amountCents, 47);
    assert.equal(resultB.amountCents, 67);
    assert.notEqual(resultA.revision, resultB.revision);
  }
  updated = policy(3);
  assert.deepEqual(await quoteA(input), resultA, 'a successful policy is held for the remainder of one scope');
  const fresh = await createScopedPublicModelQuoter(load)(input);
  assert.equal(fresh.status, 'exact');
  if (fresh.status === 'exact') assert.equal(fresh.amountCents, 87);
  assert.equal(reads, 3);
});

test('a successfully loaded empty policy preserves versioned precedence and is retained as a successful read', async () => {
  let reads = 0;
  const quote = createScopedPublicModelQuoter(async () => { reads++; return { status: 'loaded', rules: [], routingRules: [] }; });
  const first = await quote(input);
  assert.equal(first.status, 'exact');
  if (first.status === 'exact') assert.equal(first.amountCents, 26);
  assert.deepEqual(await quote(input), first);
  assert.equal(reads, 1);
});
