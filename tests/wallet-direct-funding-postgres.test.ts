import assert from 'node:assert/strict';
import test from 'node:test';
import { getDb, withDbTransaction } from '../frontend/src/lib/db';
import { getWalletBalanceCents, getWalletBalancesByCurrency, reserveWalletChargeInExecutor } from '../frontend/src/lib/wallet';
import { getWalletSummary } from '../frontend/src/server/wallet-summary';
import { persistRefundReceipt } from '../frontend/app/api/generate/_lib/payment-rollback';
import { startDisposablePostgres, createPaidGenerationTestSchema } from './helpers/disposable-postgres';

test('card charges and refunds cannot debit, credit or fund the wallet; wallet receipts still do', async () => {
  const db = await startDisposablePostgres('wallet-direct-funding');
  const previous = process.env.DATABASE_URL; process.env.DATABASE_URL = db.databaseUrl;
  try {
    await createPaidGenerationTestSchema(db.pool);
    await db.pool.query("INSERT INTO app_receipts (user_id,type,amount_cents,currency) VALUES ('user_1','topup',1000,'USD')");
    await db.pool.query("INSERT INTO app_receipts (user_id,type,amount_cents,currency,job_id,stripe_payment_intent_id) VALUES ('user_1','charge',200,'USD','card_job','pi_card')");
    assert.equal((await getWalletBalanceCents('user_1')).balanceCents, 1000);
    await persistRefundReceipt({ receipt: { userId: 'user_1', jobId: 'card_job', amountCents: 200, currency: 'USD', description: 'Card', snapshot: {},
      applicationFeeCents: null, vendorAccountId: null, stripePaymentIntentId: 'pi_card' }, description: 'Card refund', stripeRefundId: 're_card', priceOnly: true,
      queryFn: async (sql, params) => (await db.pool.query(sql, params)).rows });
    assert.equal((await getWalletBalanceCents('user_1')).balanceCents, 1000);
    assert.equal((await getWalletBalancesByCurrency('user_1'))[0]?.balanceCents, 1000);
    assert.equal((await getWalletSummary('user_1')).balanceCents, 1000);
    await db.pool.query("INSERT INTO app_receipts (user_id,type,amount_cents,currency,job_id) VALUES ('user_1','charge',100,'USD','wallet_job')");
    assert.equal((await getWalletBalanceCents('user_1')).balanceCents, 900);
    await db.pool.query("INSERT INTO app_receipts (user_id,type,amount_cents,currency,job_id) VALUES ('user_1','refund',100,'USD','wallet_job')");
    assert.equal((await getWalletBalanceCents('user_1')).balanceCents, 1000);
    await persistRefundReceipt({ receipt: { userId: 'user_2', jobId: 'failed_card', amountCents: 100, currency: 'USD', description: 'Failed card', snapshot: {},
      applicationFeeCents: null, vendorAccountId: null, stripePaymentIntentId: 'pi_failed' }, description: 'Card-only refund', stripeRefundId: 're_failed', priceOnly: true,
      queryFn: async (sql, params) => (await db.pool.query(sql, params)).rows });
    assert.equal((await getWalletBalanceCents('user_2')).balanceCents, 0);
    const charge = await withDbTransaction(executor => reserveWalletChargeInExecutor(executor, {
      userId: 'user_2', amountCents: 10, currency: 'USD', description: 'Must not be funded', jobId: 'unfunded_wallet',
      pricingSnapshotJson: '{}', applicationFeeCents: null, vendorAccountId: null }, { preferredCurrency: 'usd' }));
    assert.equal(charge.ok, false);
    assert.equal(charge.balanceCents, 0);
  } finally {
    await getDb().end().catch(() => undefined); await db.cleanup();
    if (previous === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = previous;
  }
});
