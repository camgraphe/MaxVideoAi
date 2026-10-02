import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import * as quoteModule from '../frontend/server/pricing/direct-payment-quotes';
import { getDb, withDbTransaction } from '../frontend/src/lib/db';
import { startDisposablePostgres, createPaidGenerationTestSchema } from './helpers/disposable-postgres';

const quote = { id: 'quote_123', userId: 'user_123', jobId: 'job_123',
  scenario: { engineId: 'pika-text-to-video', mode: 't2v' as const, durationSec: 5, resolution: '720p', aspectRatio: '16:9', loop: false, audioEnabled: false, voiceControl: false },
  pricing: { totalCents: 26, currency: 'USD', meta: { pricingMode: 'manual_tariff', customerTariffRevision: 7 } } as never,
  settlement: { currency: 'EUR', amountCents: 24, fxRate: 0.92, fxSource: 'original' } };

test('direct quotes persist unchanged, reject stale creation and cannot be rewritten or deleted', async () => {
  const persist = quoteModule.persistDirectPaymentQuote;
  const db = await startDisposablePostgres('direct-quote');
  const old = { DATABASE_URL: process.env.DATABASE_URL, NODE_ENV: process.env.NODE_ENV, PRICING_SANDBOX: process.env.PRICING_SANDBOX };
  Object.assign(process.env, { DATABASE_URL: db.databaseUrl, NODE_ENV: 'development', PRICING_SANDBOX: '1' });
  try {
    await createPaidGenerationTestSchema(db.pool);
    await db.pool.query(readFileSync('neon/migrations/56_direct_payment_quotes.sql', 'utf8'));
    await db.pool.query('CREATE TABLE app_customer_tariff_state (singleton BOOLEAN PRIMARY KEY, revision BIGINT, active BOOLEAN); INSERT INTO app_customer_tariff_state VALUES (TRUE, 7, TRUE)');
    await withDbTransaction(executor => persist(executor, quote));
    await assert.rejects(withDbTransaction(executor => persist(executor, { ...quote, id: 'quote_second' })), /DIRECT_PAYMENT_JOB_CONFLICT/);
    const retried = await quoteModule.saveDirectPaymentQuote({ ...quote, id: 'quote_retry' });
    assert.equal(retried.id, 'quote_123');
    assert.equal(retried.pricing.totalCents, 26);
    assert.equal((await db.pool.query('SELECT count(*) FROM app_direct_payment_quotes')).rows[0].count, '1');
    await db.pool.query('UPDATE app_customer_tariff_state SET revision = 8');
    const stored = await quoteModule.loadDirectPaymentQuote('quote_123');
    assert.equal(stored?.pricing.totalCents, 26);
    assert.equal(stored?.pricing.meta?.customerTariffRevision, 7);
    assert.equal(stored?.settlement.amountCents, 24);
    const intent = { id: 'pi_123', status: 'succeeded', amount: 24, amount_received: 24, currency: 'eur',
      metadata: { kind: 'run', user_id: 'user_123', job_id: 'job_123', direct_quote_id: 'quote_123' } };
    const captured = await quoteModule.resolveCapturedDirectPaymentQuote({ intent, userId: 'user_123', jobId: 'job_123', scenario: quote.scenario });
    assert.equal(captured.pricing.totalCents, 26);
    assert.equal(captured.pricing.meta?.customerTariffRevision, 7);
    await assert.rejects(quoteModule.resolveCapturedDirectPaymentQuote({ intent: { ...intent, latest_charge: { id: 'ch_refunded', refunded: true, amount_refunded: 24 } },
      userId: 'user_123', jobId: 'job_123', scenario: quote.scenario }), /PAYMENT_ALREADY_REFUNDED/);
    for (const change of [
      { userId: 'another_user' }, { jobId: 'another_job' },
      { scenario: { ...quote.scenario, audioEnabled: true } }, { scenario: { ...quote.scenario, durationSec: 10 } },
      { scenario: { ...quote.scenario, resolution: '1080p' } }, { scenario: { ...quote.scenario, engineId: 'other_model' } },
      { intent: { ...intent, amount_received: 23 } }, { intent: { ...intent, currency: 'usd' } },
      { intent: { ...intent, metadata: { ...intent.metadata, direct_quote_id: 'missing_quote' } } },
      { intent: { ...intent, metadata: { ...intent.metadata, kind: 'topup' } } },
    ]) {
      await assert.rejects(quoteModule.resolveCapturedDirectPaymentQuote({ intent, userId: 'user_123', jobId: 'job_123', scenario: quote.scenario, ...change }), quoteModule.DirectPaymentQuoteError);
    }
    await assert.rejects(withDbTransaction(executor => persist(executor, { ...quote, id: 'quote_stale', jobId: 'job_stale' })), /review the current price/i);
    assert.equal(await quoteModule.loadDirectPaymentQuote('quote_stale'), null);
    await assert.rejects(db.pool.query("UPDATE app_direct_payment_quotes SET quote_json = '{}'"), /immutable/i);
    await assert.rejects(db.pool.query('DELETE FROM app_direct_payment_quotes'), /immutable/i);
  } finally {
    await getDb().end().catch(() => undefined); await db.cleanup();
    for (const [key, value] of Object.entries(old)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
});
