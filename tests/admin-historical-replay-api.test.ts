import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { NextRequest } from 'next/server';
import { GET } from '../frontend/app/api/admin/routing/replay/route';
import { readHistoricalReplay, replayFilters, replayPeriod } from '../frontend/app/(core)/admin/routing/_lib/historical-replay-data';

test('replay checks admin access before processing filters or reading historical data', async () => {
  const response = await GET(new NextRequest('https://example.test/api/admin/routing/replay?limit=-1', {
    headers: { 'x-maxvideoai-auth-mode': 'bearer' },
  }));
  assert.equal(response.status, 401);
  assert.match(response.headers.get('cache-control') ?? '', /private, no-store/);
  assert.equal('report' in await response.json(), false);
});

test('source, valid calendar days and bounded pages are validated before loading a replay', () => {
  const parse = (input: string) => replayFilters(new URLSearchParams(input));
  for (const input of ['limit=0', 'offset=3&limit=2', 'limit=101', 'offset=1e6', 'date=2026-02-30',
    'date=2026A11-01', 'tariff=customer-price', 'engine=../data', 'source=file:///tmp/a']) {
    assert.equal(parse(input), null, input);
  }
  assert.equal(parse('offset=10&limit=5')?.page, 3);
  assert.equal(parse('tariff=alibaba-discount')?.alibabaStandardDiscount, true);
  assert.equal(parse('source=database')?.useDatabase, true);
  assert.deepEqual(replayPeriod(new Date('2026-03-29T22:10:00Z')), { startDay: '2026-02-28', endDay: '2026-03-30' });
  assert.deepEqual(replayPeriod(new Date('2026-10-25T22:30:00Z')), { startDay: '2026-09-25', endDay: '2026-10-25' });
});

test('a local read-only archive filters by Madrid day and actual status before paging and coverage', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'routing-replay-archive-'));
  const path = join(dir, 'archive.json');
  const keys = ['NODE_ENV', 'VERCEL', 'VIDEO_ROUTING_REPLAY_ARCHIVE'];
  const saved = keys.map(key => process.env[key]);
  t.after(async () => {
    keys.forEach((key, index) => {
      if (saved[index] === undefined) delete process.env[key];
      else process.env[key] = saved[index];
    });
    await rm(dir, { recursive: true, force: true });
  });
  Object.assign(process.env, { NODE_ENV: 'development', VIDEO_ROUTING_REPLAY_ARCHIVE: path });
  delete process.env.VERCEL;
  const base = { engineId: 'unpriced-engine', historicalProvider: null, ceilingMicros: null, request: null, paidWallet: false };
  await writeFile(path, JSON.stringify({ version: 1, startDay: '2026-10-28', endDay: '2026-11-27',
    capturedAt: '2026-11-27T14:00:00Z', groups: [
      { ...base, jobs: 9, status: 'completed', bucketAt: '2026-11-03T22:00:00Z' },
      { ...base, jobs: 2, status: 'failed', bucketAt: '2026-11-03T23:00:00Z' },
      { ...base, jobs: 3, status: 'completed', bucketAt: '2026-11-04T00:00:00Z' },
    ] }));
  const result = await readHistoricalReplay(replayFilters(new URLSearchParams('date=2026-11-04&status=failed&limit=1'))!);
  assert.equal(result.source, 'archive');
  assert.deepEqual(result.statusOptions, ['completed', 'failed']);
  assert.equal(result.report.totals.jobs, 2);
  assert.equal(result.report.totals.comparableJobs, 0);
  assert.equal(result.report.traces.length, 1);
  assert.equal(result.report.traces[0].status, 'failed');
  assert.equal('groups' in result, false);
});
