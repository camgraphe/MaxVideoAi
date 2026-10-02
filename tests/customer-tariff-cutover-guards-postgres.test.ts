import assert from 'node:assert/strict';
import test from 'node:test';
import { startDisposablePostgres } from './helpers/disposable-postgres';
import { withPricingCutoverTransaction } from '../frontend/server/pricing/customer-tariff-cutover';

test('the committed inactive flag prevents production writes before creating any connection', async () => {
  const before = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  try {
    let called = false;
    await assert.rejects(withPricingCutoverTransaction({
      DATABASE_URL_UNPOOLED: 'postgresql://operator:explicit@ep-fixture.eu-central-1.aws.neon.tech/fixture?sslmode=require',
    },'production',async () => { called = true; }), /production.*disabled/i);
    assert.equal(called,false);
  } finally { if (before === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = before; }
});

test('loss of the explicitly selected maintenance connection rejects completion without an uncaught client error', async () => {
  const db = await startDisposablePostgres('cutover-lost');
  const before = { DATABASE_URL: process.env.DATABASE_URL,NODE_ENV: process.env.NODE_ENV,PRICING_SANDBOX: process.env.PRICING_SANDBOX };
  Object.assign(process.env,{ DATABASE_URL: db.databaseUrl,NODE_ENV: 'development',PRICING_SANDBOX: '1' });
  try {
    await assert.rejects(withPricingCutoverTransaction({ DATABASE_URL: db.databaseUrl },'rehearsal',async executor => {
      const [row] = await executor.query<{ pid: number }>('SELECT pg_backend_pid() AS pid');
      await db.pool.query('SELECT pg_terminate_backend($1)',[row.pid]);
      await new Promise(resolve => setTimeout(resolve,30));
      return { mustNotReportCompletion: true };
    }), /connection.*lost/i);
  } finally {
    await db.cleanup();
    for (const [name,value] of Object.entries(before)) { if (value === undefined) delete process.env[name]; else process.env[name] = value; }
  }
});
