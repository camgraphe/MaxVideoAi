import assert from 'node:assert/strict';
import test from 'node:test';
import { withPublicPageTiming, type PublicPageTimingRecord } from '../frontend/server/public-page-timing';

test('records overlapping phases once without serializing work or changing the result', async () => {
  const records: PublicPageTimingRecord[] = [];
  let time = 10;
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const result = withPublicPageTiming({ route: 'comparison', locale: 'fr' }, async measure => {
    const first = measure('benchmark', async () => { await gate; return 'left'; });
    time = 15;
    const second = measure('scores', async () => 'right');
    await second;
    time = 30;
    release();
    return Promise.all([first, second]);
  }, { enabled: true, now: () => time, emit: record => records.push(record), deployment: 'test-deployment' });
  assert.deepEqual(await result, ['left', 'right']);
  assert.equal(records.length, 1);
  assert.equal(records[0].dataDurationMs, 20);
  assert.deepEqual(records[0].phases, [
    { phase: 'benchmark', startMs: 0, durationMs: 20, status: 'ok' },
    { phase: 'scores', startMs: 5, durationMs: 0, status: 'ok' },
  ]);
  assert.equal(records[0].deployment, 'test-deployment');
});

test('preserves the original rejection and records no error text or user data', async () => {
  const records: PublicPageTimingRecord[] = [];
  const error = new Error('private user input must never be logged');
  await assert.rejects(withPublicPageTiming({ route: 'comparison', locale: 'en' }, measure =>
    measure('left-gallery', async () => { throw error; }),
  { enabled: true, emit: record => records.push(record) }), value => value === error);
  assert.equal(records[0].status, 'error');
  assert.equal(records[0].phases[0].status, 'error');
  assert.ok(!JSON.stringify(records).includes(error.message));
});

test('diagnostic delivery failure cannot break a public page', async () => {
  assert.equal(await withPublicPageTiming({ route: 'comparison', locale: 'es' }, async measure =>
    measure('key-specs', async () => 42),
  { enabled: true, emit: () => { throw new Error('logger failed'); } }), 42);
});

test('disabled measurement does not read a clock or emit and still executes operations', async () => {
  const forbidden = () => { throw new Error('disabled instrumentation called'); };
  assert.equal(await withPublicPageTiming({ route: 'comparison', locale: 'en' }, measure =>
    measure('benchmark', async () => 9),
  { enabled: false, now: forbidden, emit: forbidden }), 9);
});
