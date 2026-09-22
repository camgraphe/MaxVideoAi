import assert from 'node:assert/strict';
import test from 'node:test';
import { readOverviewSources, scanRegistrations } from '../frontend/server/admin-overview-read';

test('slow Auth does not prevent finance from loading and its scan stops after the deadline', async () => {
  let resolvePage!: (users: Array<{ id: string; created_at: string }>) => void;
  let calls = 0;
  let financeStarted = false;
  const result = await readOverviewSources(
    {
      users: (signal) =>
        scanRegistrations('2026-09-22T00:00:00Z', '2026-09-23T00:00:00Z', signal, async () => {
          calls++;
          return new Promise((resolve) => {
            resolvePage = resolve;
          });
        }),
      finance: async () => {
        financeStarted = true;
        return { receipts: 8 };
      },
    },
    20
  );
  assert.equal(financeStarted, true);
  assert.equal(result.users, null, 'a timed-out total must not become a partial count');
  assert.deepEqual(result.finance, { receipts: 8 });
  resolvePage(Array.from({ length: 1000 }, (_, i) => ({ id: String(i), created_at: '2026-09-22T01:00:00Z' })));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(calls, 1, 'late Auth response must not trigger another page');
});

test('source errors and synchronous throws preserve the independently available metric', async () => {
  const result = await readOverviewSources({
    users: async () => ({ count: 0 }),
    finance: () => {
      throw new Error('offline');
    },
  });
  assert.deepEqual(result, { users: { count: 0 }, finance: null });
});

test('registration scan covers later pages and sorts recent users within the half-open interval', async () => {
  const pages: number[] = [];
  const result = await scanRegistrations(
    '2026-09-22T00:00:00.000Z',
    '2026-09-23T00:00:00.000Z',
    new AbortController().signal,
    async (page) => {
      pages.push(page);
      if (page === 1)
        return Array.from({ length: 1000 }, (_, i) => ({ id: `old-${i}`, created_at: '2025-01-01T00:00:00Z' }));
      return [
        { id: 'start', created_at: '2026-09-22T00:00:00Z' },
        { id: 'recent', created_at: '2026-09-22T16:00:00Z', email: 'fixture@example.invalid' },
        { id: 'end', created_at: '2026-09-23T00:00:00Z' },
      ];
    }
  );
  assert.deepEqual(pages, [1, 2]);
  assert.equal(result.count, 2);
  assert.deepEqual(
    result.recent.map((user) => user.id),
    ['recent', 'start']
  );
});
