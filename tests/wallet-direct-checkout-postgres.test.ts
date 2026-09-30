import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createWalletDirectPaymentIntent } from '../frontend/server/wallet-direct-checkout';
import { getFalEngineById } from '../frontend/src/config/falEngines';
import { getDb } from '../frontend/src/lib/db';
import { startDisposablePostgres, createPaidGenerationTestSchema } from './helpers/disposable-postgres';

test('a lost Stripe creation response retries the same quote and intent with the original settlement', async () => {
  const db = await startDisposablePostgres('direct-checkout-retry');
  const old = { DATABASE_URL: process.env.DATABASE_URL, NODE_ENV: process.env.NODE_ENV, PRICING_SANDBOX: process.env.PRICING_SANDBOX };
  Object.assign(process.env, { DATABASE_URL: db.databaseUrl, NODE_ENV: 'development', PRICING_SANDBOX: '1' });
  try {
    await createPaidGenerationTestSchema(db.pool);
    await db.pool.query(readFileSync('neon/migrations/56_direct_payment_quotes.sql', 'utf8'));
    await db.pool.query('CREATE TABLE app_customer_tariff_state (singleton BOOLEAN PRIMARY KEY, revision BIGINT, active BOOLEAN); INSERT INTO app_customer_tariff_state VALUES (TRUE, 7, TRUE)');
    const calls: Array<{ params: unknown; options: unknown }> = [];
    const input = { req: { headers: { get: () => '7' } }, userId: 'user_123',
      body: { engineId: 'pika-text-to-video', jobId: 'job_retry', durationSec: 5, resolution: '720p', aspectRatio: '16:9' },
      stripe: { paymentIntents: { create: async (params: unknown, options: unknown) => {
        calls.push({ params, options });
        if (calls.length === 1) throw new Error('Lost Stripe response');
        return { id: 'pi_once', client_secret: 'local-fixture-secret' };
      } } },
      resolvedCurrencyLower: 'usd', resolvedCurrencyUpper: 'USD', currencyResolution: { currency: 'usd', source: 'default' },
      deps: { getConfiguredEngineFn: async () => getFalEngineById('pika-text-to-video')!.engine,
        computePricingSnapshotFn: async () => ({ totalCents: 300, currency: 'USD', meta: { pricingMode: 'manual_tariff', customerTariffRevision: 7 } }),
        convertCentsFn: async () => ({ cents: calls.length ? 990 : 330, rate: calls.length ? 3.3 : 1.1, source: 'fixture' }) },
    } as never;
    assert.equal((await createWalletDirectPaymentIntent(input)).status, 500);
    const retry = await createWalletDirectPaymentIntent(input);
    assert.equal(retry.status, 200);
    const body = await retry.json();
    assert.equal(body.paymentIntentId, 'pi_once');
    assert.equal(body.amountCents, 300);
    assert.equal(body.settlementAmountCents, 330);
    assert.deepEqual(calls[1], calls[0], 'Stripe retry must use the same idempotency key and payment parameters');
    assert.equal((await db.pool.query('SELECT count(*) FROM app_direct_payment_quotes')).rows[0].count, '1');
  } finally {
    await getDb().end().catch(() => undefined); await db.cleanup();
    for (const [key, value] of Object.entries(old)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
});
