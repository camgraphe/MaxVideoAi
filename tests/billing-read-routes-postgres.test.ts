import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { build } from 'esbuild';
import { missingDisposablePostgresCommand, startDisposablePostgres } from './helpers/disposable-postgres';

const fixtureUser = '00000000-0000-4000-8000-000000000091';
const otherUser = '00000000-0000-4000-8000-000000000092';
const requireFrontend = createRequire(resolve('frontend/package.json'));

test('Billing GETs read only the authenticated ledger and expose database failures', { timeout: 60_000 }, async (t) => {
  const missing = missingDisposablePostgresCommand();
  if (missing) return t.skip(`${missing} is unavailable`);
  const pg = await startDisposablePostgres('billing-read-routes');
  const folder = mkdtempSync(join(tmpdir(), 'billing-get-bundle-'));
  const previousUrl = process.env.DATABASE_URL;
  const fixture = { userId: fixtureUser as string | null, statements: [] as string[] };
  const globals = globalThis as typeof globalThis & { __billingReadFixture?: typeof fixture };
  globals.__billingReadFixture = fixture;
  let closeDb: (() => Promise<void>) | undefined;
  t.after(async () => {
    await closeDb?.();
    if (previousUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousUrl;
    delete globals.__billingReadFixture;
    rmSync(folder, { recursive: true, force: true });
    await pg.cleanup();
  });
  await pg.pool.query('CREATE TABLE profiles (id uuid PRIMARY KEY, preferred_currency text)');
  const boot = spawnSync('frontend/node_modules/.bin/tsx', [
    '--tsconfig', 'frontend/tsconfig.json', 'scripts/bootstrap-application-schema.ts', '--allow-local-postgres-test',
  ], { env: { PATH: process.env.PATH, NODE_ENV: 'test', APPLICATION_DATABASE_URL: pg.databaseUrl }, encoding: 'utf8' });
  assert.equal(boot.status, 0, boot.stderr);
  await pg.pool.query('INSERT INTO profiles (id, preferred_currency) VALUES ($1, $2), ($3, $4)', [fixtureUser, 'eur', otherUser, 'gbp']);
  await pg.pool.query(`INSERT INTO app_receipts (user_id,type,amount_cents,currency,description,stripe_hosted_invoice_url,stripe_receipt_url) VALUES
    ($1,'topup',2500,'USD','Own top-up','https://example.com/invoice','https://example.com/receipt'),
    ($1,'charge',125,'USD','Own render',NULL,NULL),
    ($1,'refund',25,'USD','Own refund',NULL,NULL),
    ($2,'topup',99999,'GBP','Other private receipt',NULL,NULL)`, [fixtureUser, otherUser]);
  const dbPath = resolve('frontend/src/lib/db.ts');
  const output = join(folder, 'routes.cjs');
  await build({
    stdin: { resolveDir: process.cwd(), loader: 'ts', contents: `
      export { GET as getCurrency } from './frontend/app/api/me/currency/route';
      export { GET as getReceipts } from './frontend/app/api/receipts/route';
      export { getDb } from '@/lib/db';
      export { getUserPreferredCurrency } from '@/lib/currency';
      export { getWalletBalancesByCurrency } from '@/lib/wallet';` },
    outfile: output, bundle: true, platform: 'node', format: 'cjs', packages: 'external', tsconfig: 'frontend/tsconfig.json',
    plugins: [{ name: 'billing-route-local-fixture', setup(builder) {
      const mocks: Record<string, string> = {
        '@/lib/supabase-ssr': `export async function getRouteAuthContext(){return {userId:globalThis.__billingReadFixture.userId};}`,
        '@/lib/db': `export * from ${JSON.stringify(dbPath)}; import * as real from ${JSON.stringify(dbPath)};
          export async function query(text, params){globalThis.__billingReadFixture.statements.push(text);return real.query(text,params);}`,
      };
      builder.onResolve({ filter: /.*/ }, args => args.path in mocks ? { path: args.path, namespace: 'fixture' }
        : /^(next\/server|stripe|pg)$/.test(args.path) ? { path: requireFrontend.resolve(args.path), external: true } : undefined);
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: mocks[args.path], loader: 'ts', resolveDir: process.cwd() }));
    } }],
  });
  const routes = requireFrontend(output) as {
    getCurrency(req: Request): Promise<Response>; getReceipts(req: Request): Promise<Response>;
    getDb(): { end(): Promise<void>; query(text: string): Promise<{ rows: Array<Record<string, string>> }> };
    getUserPreferredCurrency(userId: string): Promise<string | null>;
    getWalletBalancesByCurrency(userId: string): Promise<unknown[]>;
  };
  const readonlyUrl = new URL(pg.databaseUrl);
  readonlyUrl.searchParams.set('options', '-c default_transaction_read_only=on');
  process.env.DATABASE_URL = readonlyUrl.toString();
  closeDb = () => routes.getDb().end();
  assert.equal((await routes.getDb().query('SHOW default_transaction_read_only')).rows[0].default_transaction_read_only, 'on');

  await t.test('unauthenticated requests do not touch the database', async () => {
    fixture.userId = null;
    for (const read of [routes.getCurrency, routes.getReceipts]) {
      fixture.statements.length = 0;
      assert.equal((await read(new Request('http://localhost/api/read'))).status, 401);
      assert.deepEqual(fixture.statements, []);
    }
    fixture.userId = fixtureUser;
  });
  await t.test('currency and balances preserve exact account values with only SELECTs', async () => {
    fixture.userId = fixtureUser;
    fixture.statements.length = 0;
    const response = await routes.getCurrency(new Request('http://localhost/api/me/currency'));
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data.currency, 'EUR');
    assert.deepEqual(data.balances, [{ currency: 'USD', balanceCents: 2400 }]);
    assert.equal(data.locked, true);
    assert.equal(fixture.statements.length, 2);
    assert.ok(fixture.statements.every(sql => /^\s*SELECT\b/i.test(sql)));
  });
  await t.test('receipts keep pagination, original cents and stored invoice precedence', async () => {
    fixture.statements.length = 0;
    const first = await routes.getReceipts(new Request('http://localhost/api/receipts?limit=2'));
    assert.equal(first.status, 200);
    const data = await first.json();
    assert.deepEqual(data.receipts.map((row: { amount_cents: number }) => row.amount_cents), [25, 125]);
    assert.ok(data.nextCursor);
    const second = await routes.getReceipts(new Request(`http://localhost/api/receipts?limit=2&cursor=${data.nextCursor}`));
    const next = await second.json();
    assert.equal(next.receipts.length, 1);
    assert.equal(next.receipts[0].description, 'Own top-up');
    assert.equal(next.receipts[0].document_type, 'invoice');
    assert.equal(next.receipts[0].document_url, 'https://example.com/invoice');
    assert.equal(next.nextCursor, null);
    assert.equal(fixture.statements.length, 2);
    assert.ok(fixture.statements.every(sql => /^\s*SELECT\b/i.test(sql)));
  });
  await t.test('a configured database failure is never a successful empty ledger or currency fallback', async () => {
    for (const table of ['profiles', 'app_receipts']) {
      await pg.pool.query(`ALTER TABLE ${table} RENAME TO temporarily_unavailable`);
      try {
        const readers = table === 'profiles' ? [routes.getCurrency] : [routes.getCurrency, routes.getReceipts];
        for (const read of readers) {
          const response = await read(new Request('http://localhost/api/read'));
          assert.equal(response.status, 503, table);
          const data = await response.json();
          assert.equal(data.ok, false);
          assert.equal(typeof data.error, 'string');
          assert.equal(data.mock, undefined);
        }
        if (table === 'profiles') assert.equal(await routes.getUserPreferredCurrency(fixtureUser), null);
        else assert.deepEqual(await routes.getWalletBalancesByCurrency(fixtureUser), []);
      } finally { await pg.pool.query(`ALTER TABLE temporarily_unavailable RENAME TO ${table}`); }
    }
  });
  await t.test('intentional unconfigured local responses stay distinct', async () => {
    delete process.env.DATABASE_URL;
    assert.equal((await routes.getCurrency(new Request('http://localhost/api/read'))).status, 503);
    const response = await routes.getReceipts(new Request('http://localhost/api/read'));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true, receipts: [], nextCursor: null, mock: true });
    process.env.DATABASE_URL = readonlyUrl.toString();
  });
});
