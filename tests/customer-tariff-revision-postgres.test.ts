import assert from 'node:assert/strict';
import test from 'node:test';
import { assertDisplayedCustomerTariffRevision, lockQuotedCustomerTariffRevision } from '../frontend/server/pricing/customer-tariff-revision.ts';
import { getDb, withDbTransaction } from '../frontend/src/lib/db.ts';
import { startDisposablePostgres } from './helpers/disposable-postgres.ts';

const snapshot = { meta: { pricingMode: 'manual_tariff', customerTariffRevision: 7 } };

test('manual web confirmation binds the displayed revision even when the amount has not changed', () => {
  assert.doesNotThrow(() => assertDisplayedCustomerTariffRevision('7', snapshot));
  for (const revision of [null, '6', '8', '07']) assert.throws(() => assertDisplayedCustomerTariffRevision(revision, snapshot), /review the current price/i);
  assert.doesNotThrow(() => assertDisplayedCustomerTariffRevision(null, { meta: {} }));
});

test('charge transaction checks the current revision and locks out a concurrent tariff edit', async () => {
  const db = await startDisposablePostgres('revision-tariff');
  const old = { DATABASE_URL: process.env.DATABASE_URL, NODE_ENV: process.env.NODE_ENV, PRICING_SANDBOX: process.env.PRICING_SANDBOX };
  Object.assign(process.env, { DATABASE_URL: db.databaseUrl, NODE_ENV: 'development', PRICING_SANDBOX: '1' });
  try {
    await db.pool.query('CREATE TABLE app_customer_tariff_state (singleton BOOLEAN PRIMARY KEY, revision BIGINT, active BOOLEAN); INSERT INTO app_customer_tariff_state VALUES (TRUE, 7, TRUE)');
    await assert.rejects(withDbTransaction((executor) => lockQuotedCustomerTariffRevision(executor, 'pika-text-to-video',
      { meta: { pricingMode: 'manual_tariff', customerTariffRevision: 6 } })), /review the current price/i);
    await assert.rejects(withDbTransaction((executor) => lockQuotedCustomerTariffRevision(executor, 'pika-text-to-video',
      { meta: {} })), /review the current price/i);
    await withDbTransaction(async (executor) => {
      await lockQuotedCustomerTariffRevision(executor, 'pika-text-to-video', snapshot);
      const editor = await db.pool.connect();
      try {
        await editor.query("SET lock_timeout = '50ms'");
        await assert.rejects(editor.query('UPDATE app_customer_tariff_state SET revision = 8'), /lock timeout/i);
      } finally { editor.release(); }
    });
    await db.pool.query('UPDATE app_customer_tariff_state SET revision = 8');
    await assert.rejects(withDbTransaction((executor) => lockQuotedCustomerTariffRevision(executor, 'pika-text-to-video', snapshot)), /review the current price/i);
  } finally {
    await getDb().end().catch(() => undefined); await db.cleanup();
    for (const [key, value] of Object.entries(old)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
});
