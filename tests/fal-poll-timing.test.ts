import assert from 'node:assert/strict';
import test from 'node:test';
import { getFalPollTiming } from '../frontend/server/fal-poll-timing';

test('H3 has a 90-minute attention threshold, not a render cancellation deadline', () => {
  const createdAt = '2026-09-07T00:00:00Z';
  const timing = (minutes: number, engine = 'minimax-h3') =>
    getFalPollTiming(engine, createdAt, Date.parse(createdAt) + minutes * 60_000);
  assert.equal(timing(65).beyondTimeoutGrace, false);
  assert.equal(timing(90).beyondTimeoutGrace, false);
  assert.equal(timing(90.01).beyondTimeoutGrace, true);
  for (const engine of ['minimax-h3-max', 'luma-ray-2', 'other']) {
    assert.equal(timing(55, engine).beyondTimeoutGrace, false);
    assert.equal(timing(55.01, engine).beyondTimeoutGrace, true);
  }
  assert.equal(timing(34).timedOut, false);
  assert.equal(timing(36).timedOut, true);
});
