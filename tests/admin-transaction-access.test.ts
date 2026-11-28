import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from 'next/server';
import { GET } from '../frontend/app/api/admin/transactions/route';
import { AdminAuthError } from '../frontend/src/server/admin';
import { readAdminTransactions } from '../frontend/server/admin-transactions/http';

const req = (search: string) => new NextRequest('https://example.test/api/admin/transactions?' + search, {
  headers: { 'x-maxvideoai-auth-mode': 'bearer' },
});

test('an unauthenticated receipt detail request is denied by the real Transactions route', async () => {
  const response = await GET(req('receipt=1'));
  assert.equal(response.status, 401);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.deepEqual(await response.json(), { ok: false, error: 'Unauthorized' });
});

test('non-admin access never reads a receipt or its supplier economics, even for malformed queries', async () => {
  for (const query of ['receipt=1', 'receipt=invalid', 'limit=-1', 'type=all']) {
    const response = await readAdminTransactions(req(query), {
      authorize: async () => { throw new AdminAuthError('Forbidden', 403); },
      receipt: async () => assert.fail('Unprivileged receipt read'),
      history: async () => assert.fail('Unprivileged history read'),
    });
    assert.equal(response.status, 403);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    assert.deepEqual(await response.json(), { ok: false, error: 'Forbidden' });
  }
});

test('authenticated financial responses never enter shared caches', async t => {
  const saved = process.env.DATABASE_URL;
  process.env.DATABASE_URL = 'offline-test';
  t.after(() => { if (saved === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = saved; });
  const deps = { authorize: async () => 'admin', receipt: async () => null, history: async () => ({ transactions: [], nextCursor: null }) };
  for (const query of ['receipt=1', 'type=all']) {
    const response = await readAdminTransactions(req(query), deps);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
  }
});
