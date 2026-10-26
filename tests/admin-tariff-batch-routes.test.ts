import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { build } from 'esbuild';
const requireFrontend = createRequire(resolve('frontend/package.json'));

test('batch HTTP routes authorize first, enforce same origin/size/strict commands and never accept a client actor', async t => {
  const directory = mkdtempSync(join(tmpdir(), 'batch-routes-'));
  const fixture = { authorized: true, calls: [] as unknown[][] };
  (globalThis as any).__batchRouteFixture = fixture;
  t.after(() => { delete (globalThis as any).__batchRouteFixture; rmSync(directory, { recursive: true, force: true }); });
  const output = join(directory, 'routes.cjs');
  await build({ stdin: { resolveDir: process.cwd(), loader: 'ts', contents: `
    export { POST as preview } from './frontend/app/api/admin/pricing/tariffs/batches/preview/route';
    export { POST as confirm } from './frontend/app/api/admin/pricing/tariffs/batches/confirm/route';
    export { POST as reconcile } from './frontend/app/api/admin/pricing/tariffs/batches/reconcile/route';
    export { POST as refresh } from './frontend/app/api/admin/pricing/tariffs/batches/refresh/route';
    export { GET as status } from './frontend/app/api/admin/pricing/tariffs/batches/status/route';` },
    outfile: output, bundle: true, platform: 'node', format: 'cjs', packages: 'external', tsconfig: 'frontend/tsconfig.json',
    plugins: [{ name: 'http-boundaries', setup(b) {
      const mocks: Record<string, string> = {
        '@/server/admin': `export async function requireAdmin() { if(!globalThis.__batchRouteFixture.authorized) throw Error('unauthorized'); return '11111111-1111-4111-8111-111111111111'; }
          export function adminErrorToResponse(){return new Response('{}',{status:401});}`,
        '@/server/pricing-admin/tariff-batches/service': `
          function record(...args){globalThis.__batchRouteFixture.calls.push(args);return {status:'previewed'};}
          export const previewTariffBatch=record, confirmTariffBatch=record, reconcileTariffBatch=record, readTariffBatch=record, refreshTariffBatchPages=record;`,
      };
      b.onResolve({ filter: /.*/ }, a => a.path in mocks ? { path: a.path, namespace: 'fixture' }
        : a.path === 'next/server' ? { path: requireFrontend.resolve(a.path), external: true } : undefined);
      b.onLoad({ filter: /.*/, namespace: 'fixture' }, a => ({ contents: mocks[a.path], loader: 'ts' }));
    } }],
  });
  const routes = requireFrontend(output);
  const id = '22222222-2222-4222-8222-222222222222', fingerprint = 'a'.repeat(64);
  const request = (body: unknown, headers: Record<string, string> = {}) => new Request('http://localhost/api/admin/pricing/tariffs/batches', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'http://localhost', ...headers }, body: JSON.stringify(body),
  });
  const body = { operationId: id, fingerprint };
  assert.equal((await routes.confirm(request(body))).status, 200);
  assert.deepEqual(fixture.calls.pop(), [id, fingerprint, '11111111-1111-4111-8111-111111111111']);
  for (const bad of [{ ...body, actorId: 'forged' }, { ...body, expiresAt: '2099' }, { ...body, proposal: {} }, { operationId: 'bad', fingerprint }]) {
    assert.equal((await routes.confirm(request(bad))).status, 400);
  }
  assert.equal((await routes.confirm(request(body, { Origin: 'https://evil.example' }))).status, 403);
  assert.equal((await routes.preview(request({ large: 'x'.repeat(2 * 1024 * 1024) }))).status, 413);
  assert.equal((await routes.confirm(request(body, { 'Content-Length': '2097153' }))).status, 413);
  assert.equal(fixture.calls.length, 0);
  fixture.authorized = false;
  for (const route of [routes.preview, routes.confirm, routes.reconcile, routes.refresh]) {
    const response = await route(request(body));
    assert.equal(response.status, 401); assert.equal(response.headers.get('Cache-Control'), 'no-store');
  }
  assert.equal((await routes.status(new Request(`http://localhost/api/admin/pricing/tariffs/batches/status?operationId=${id}`))).status, 401);
  assert.equal(fixture.calls.length, 0);
});

test('batch boundaries keep one transactional price owner and no runtime coefficient', () => {
  const base = 'frontend/server/pricing-admin/tariff-batches/';
  const service = readFileSync(base + 'service.ts', 'utf8');
  assert.match(service, /upsertCustomerTariffCell\(executor/);
  assert.match(service, /insertPricingChangeEvent\(executor/);
  assert.doesNotMatch(service, /fetch\(|ensure.*Schema/);
  const planner = readFileSync(base + 'planner.ts', 'utf8');
  assert.match(planner, /computeCanonicalBillingSnapshot/); assert.match(planner, /validateCurrentContinuousTariffDomain/);
  assert.doesNotMatch(planner, /withDbTransaction|\.query\(/);
  const migration = readFileSync('neon/migrations/81_customer_tariff_batches.sql', 'utf8');
  assert.match(migration, /DEFAULT FALSE/); assert.doesNotMatch(migration, /INSERT INTO app_customer_tariff_cells/);
});


test('local admission rejects ambiguous or remote database URLs', async () => {
  const { tariffBatchIdentity } = await import('../frontend/server/pricing-admin/tariff-batches/environment');
  const old = { ...process.env };
  Object.assign(process.env, { NODE_ENV: 'test', PRICING_ADMIN_BATCHES_ENABLED: '1', PRICING_ADMIN_BATCHES_SOURCE_ID: 'a'.repeat(40), PRICING_ADMIN_BATCHES_TARGET_ID: '11111111-1111-4111-8111-111111111111' });
  delete process.env.VERCEL;
  try {
    process.env.DATABASE_URL = 'postgresql://postgres@localhost/postgres?host=%2Ftmp%2Fsynthetic';
    assert.ok(tariffBatchIdentity());
    for (const url of ['postgresql://postgres@remote.example/postgres', 'postgresql://postgres@localhost/postgres?host=%2Ftmp&host=remote.example', 'postgresql://postgres@localhost/postgres?host=%2Ftmp&options=unsafe']) {
      process.env.DATABASE_URL = url; assert.equal(tariffBatchIdentity(), null);
    }
  } finally { for (const key of Object.keys(process.env)) if (!(key in old)) delete process.env[key]; Object.assign(process.env, old); }
});
