import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import test from 'node:test';
import { build } from 'esbuild';

type Fixture = {
  configured: boolean;
  userId: string | null;
  rows: Array<{ marked_for_deletion_at: Date }>;
  calls: Array<{ sql: string; values: unknown[] }>;
  fail?: boolean;
};
const globals = globalThis as typeof globalThis & { __accountDeletionFixture?: Fixture };

async function loadHandler() {
  const mocks: Record<string, string> = {
    '@/lib/db': `export const isDatabaseConfigured = () => globalThis.__accountDeletionFixture.configured;
      export async function query(sql,values) {
        const f=globalThis.__accountDeletionFixture; f.calls.push({sql,values});
        if(f.fail) throw Error('private database detail'); return f.rows;
      }`,
    '@/lib/supabase-ssr': `export const getRouteAuthContext = async () => ({userId:globalThis.__accountDeletionFixture.userId});`,
  };
  const result = await build({
    entryPoints: ['frontend/app/api/account/delete/route.ts'], bundle: true, write: false,
    platform: 'node', format: 'cjs', packages: 'external', tsconfig: 'frontend/tsconfig.json',
    plugins: [{ name: 'account-deletion-boundaries', setup(builder) {
      builder.onResolve({ filter: /.*/ }, args => Object.hasOwn(mocks, args.path) ? { path: args.path, namespace: 'fixture' } : undefined);
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: mocks[args.path], loader: 'js' }));
    } }],
  });
  const module = { exports: {} as { POST(request: Request): Promise<Response> } };
  new Function('module', 'exports', 'require', result.outputFiles[0].text)(module, module.exports, createRequire(resolve('frontend/package.json')));
  return module.exports.POST;
}

test('account deletion records a request without claiming a scheduled or completed purge', async (t) => {
  const handler = await loadHandler();
  const storedDate = new Date('2026-10-01T10:00:00.000Z');
  const fixture: Fixture = { configured: true, userId: 'owner-a', rows: [{ marked_for_deletion_at: storedDate }], calls: [] };
  globals.__accountDeletionFixture = fixture;
  t.after(() => { delete globals.__accountDeletionFixture; });
  const request = () => new Request('https://maxvideoai.test/api/account/delete', { method: 'POST' });

  await t.test('success uses the persisted date, including repeated requests', async () => {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const response = await handler(request());
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { ok: true, status: 'requested', markedAt: '2026-10-01T10:00:00.000Z', deletionCompleted: false });
    }
    for (const call of fixture.calls) {
      assert.deepEqual(call.values, ['owner-a']);
      assert.match(call.sql, /COALESCE\(marked_for_deletion_at, NOW\(\)\)/i);
      assert.match(call.sql, /marketing_opt_in = FALSE/);
      assert.match(call.sql, /WHERE id = \$1/);
    }
  });
  await t.test('missing profile is not reported as a recorded request', async () => {
    fixture.rows = [];
    const response = await handler(request());
    assert.equal(response.status, 404);
    assert.equal((await response.json()).ok, false);
  });
  await t.test('unauthenticated callers cannot write', async () => {
    fixture.userId = null; fixture.calls = [];
    assert.equal((await handler(request())).status, 401);
    assert.equal(fixture.calls.length, 0);
  });
  await t.test('unavailable database cannot acknowledge a request', async () => {
    fixture.configured = false;
    assert.equal((await handler(request())).status, 503);
    assert.equal(fixture.calls.length, 0);
  });
  await t.test('database failures return no deletion claim or private detail', async () => {
    fixture.configured = true; fixture.userId = 'owner-a'; fixture.fail = true;
    const response = await handler(request());
    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), { ok: false, error: 'Failed to record deletion request' });
  });
});
