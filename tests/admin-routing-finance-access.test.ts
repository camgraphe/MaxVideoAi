import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from 'next/server';
import { GET } from '../frontend/app/api/admin/routing/finance/route';
import { exportRoutingFinance } from '../frontend/server/admin-routing-finance/http';
import { previousMonth, routingPeriod } from '../frontend/server/admin-routing-finance/period';
import { routingFinanceSummary } from '../frontend/server/admin-routing-finance/summary';
import { AdminAuthError } from '../frontend/src/server/admin';

test('exports authorize before interpreting input and keep accounting downloads private', async () => {
  const req = (query: string) =>
    new NextRequest('https://example.test/api/admin/routing/finance?' + query, {
      headers: { 'x-maxvideoai-auth-mode': 'bearer' },
    });
  const services = {
    authorize: async () => 'admin',
    purchases: async () => [],
    ledger: async () => [],
    attempts: async () => [],
    summary: async () => routingFinanceSummary([], []),
  };
  assert.equal((await GET(req('file=purchases'))).status, 401);
  const reject = () => {
    throw Error('Unexpected database access');
  };
  const denied = await exportRoutingFinance(req('file=bad'), {
    authorize: async () => {
      throw new AdminAuthError('Forbidden', 403);
    },
    purchases: reject,
    ledger: reject,
    attempts: reject,
    summary: reject,
  });
  assert.equal(denied.status, 403);
  assert.equal(denied.headers.get('cache-control'), 'private, no-store');
  for (const file of ['summary', 'purchases', 'receipts', 'attempts']) {
    const res = await exportRoutingFinance(req('from=2025-01-01&to=2025-01-31&file=' + file), services);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-disposition')!, /2025-01-01-2025-01-31-customer-utc\.csv/);
    assert.equal(res.headers.get('cache-control'), 'private, no-store');
    assert.match(await res.text(), /(_utc)"/);
  }
  assert.equal((await exportRoutingFinance(req('file=receipts&file=purchases'), services)).status, 400);
  assert.equal((await exportRoutingFinance(req('file=receipts'), { ...services, ledger: reject })).status, 503);
});
test('report periods include both UTC endpoints and validate full calendar dates', () => {
  const now = new Date('2024-03-02T00:00:00Z');
  const parse = (p: string) => routingPeriod(new URLSearchParams(p), now);
  assert.deepEqual(previousMonth(now), { from: '2024-02-01', to: '2024-02-29' });
  assert.deepEqual(parse(''), { from: '2024-02-02', to: '2024-03-02', includeAdmin: false });
  for (const s of [
    'from=2024-01-01',
    'from=2024-02-30&to=2024-03-01',
    'from=2024-01-01&to=2024-02-01',
    'from=2024-03-02&to=2024-03-03',
    'internal=2',
    'internal=0&internal=1',
  ])
    assert.equal(parse(s), null);
});
