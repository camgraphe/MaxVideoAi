import assert from 'node:assert/strict';
import test from 'node:test';

const now = Date.parse('2026-11-12T10:00:00.000Z');
const observation = async (snapshot: unknown, status = 'pending') => {
  const module = await import('../frontend/src/lib/audio-dispatch-observation').catch(() => null);
  assert.equal(typeof module?.audioDispatchObservation, 'function', 'Audio dispatch recovery observation is implemented');
  return module!.audioDispatchObservation(snapshot, status, now);
};

test('Audio recovery only requests attention for a stale or invalid active dispatch', async () => {
  assert.deepEqual(await observation({}), { needsAttention: false, message: null });
  assert.equal((await observation({ audioDispatch: { version: 1, state: 'queued', observedAt: '2026-11-12T09:51:00.000Z' } })).needsAttention, false);
  assert.equal((await observation({ audioDispatch: { version: 1, state: 'queued', observedAt: '2026-11-12T09:49:00.000Z' } })).needsAttention, true);
  assert.equal((await observation({ audioDispatch: { version: 1, state: 'processing', observedAt: '2026-11-12T09:16:00.000Z' } })).needsAttention, false);
  assert.equal((await observation({ audioDispatch: { version: 1, state: 'processing', observedAt: '2026-11-12T09:14:00.000Z' } })).needsAttention, true);
  for (const metadata of [null, {}, { version: 2, state: 'queued' }, { version: 1, state: 'ambiguous', observedAt: '2026-11-12T09:59:00.000Z' },
    { version: 1, state: 'queued', observedAt: 'invalid' }, { version: 1, state: 'queued', observedAt: '2026-11-31T10:00:00.000Z' }, { version: 1, state: 'queued', observedAt: '2026-11-13T10:00:00.000Z' }]) {
    const result = await observation({ audioDispatch: metadata });
    assert.equal(result.needsAttention, true);
    assert.match(result.message!, /review|resubmit|retry/i);
    assert.doesNotMatch(result.message!, /completed|refunded|https?:/i);
  }
});

test('Audio recovery never overrides a terminal job', async () => {
  for (const status of ['completed', 'failed', 'cancelled', 'canceled']) {
    assert.deepEqual(await observation({ audioDispatch: { version: 1, state: 'processing', observedAt: 'invalid' } }, status),
      { needsAttention: false, message: null });
  }
});
