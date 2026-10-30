import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { getDb, withDbTransaction } from '../frontend/src/lib/db';
import { getWalletBalanceCents } from '../frontend/src/lib/wallet';
import { chooseStudioAssistance, readStudioAssistanceStatus } from '../frontend/src/server/studio/assistance-ledger';
import { studioAssistancePolicy } from '../frontend/src/server/studio/assistance-policy';
import {
  issueManualWalletRefund,
  issueManualWalletRefundByReceipt,
  type AdminRefundDependencies,
} from '../frontend/server/admin-transactions/refunds';
import { createPaidGenerationTestSchema, startDisposablePostgres } from './helpers/disposable-postgres';

const reconciliationRequired = /Studio assistance charges require Studio assistance reconciliation/;

test('generic refunds protect Milo packs and preserve ordinary wallet refunds', async t => {
  const pg = await startDisposablePostgres('admin-pack-refund');
  const previous = process.env.DATABASE_URL;
  process.env.DATABASE_URL = pg.databaseUrl;
  t.after(async () => {
    await getDb().end();
    if (previous === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previous;
    await pg.cleanup();
  });
  await createPaidGenerationTestSchema(pg.pool);
  for (const file of [
    '54_studio_assistance_ledger.sql', '62_studio_assistance_resolutions.sql',
    '63_studio_assistance_credits.sql', '86_milo_three_levels.sql', '87_milo_runtime_bounds.sql',
  ]) {
    await pg.pool.query(readFileSync(`neon/migrations/${file}`, 'utf8'));
  }
  const dependencies: AdminRefundDependencies = {
    databaseConfigured: () => true,
    ensureSchema: async () => {},
    withTransaction: callback => withDbTransaction(callback),
    now: () => new Date().toISOString(),
  };
  const policy = studioAssistancePolicy({ STUDIO_ASSISTANCE_ENABLED: 'true' });
  const fund = (owner: string) => pg.pool.query(
    "INSERT INTO app_receipts(user_id,type,amount_cents,currency) VALUES($1,'topup',1000,'USD')", [owner],
  );

  for (const identity of ['actual-pack', 'product-only', 'prefix-only']) {
    await t.test(`a purchased pack identified by ${identity} cannot receive a wallet-only refund`, async () => {
      const owner = `pack-${identity}`;
      await fund(owner);
      const initial = await readStudioAssistanceStatus(owner, policy);
      await chooseStudioAssistance(owner, {
        action: 'purchase_pack', amountCents: 200, expectedRevision: 0,
        tariffVersion: initial.tariff.version, purchaseKey: randomUUID(),
      }, policy);
      const charge = (await pg.pool.query(
        "SELECT id, job_id, billing_product_key FROM app_receipts WHERE type='charge' AND user_id=$1", [owner],
      )).rows[0];
      assert.equal(charge.billing_product_key, 'studio_assistance_pack');
      assert.match(charge.job_id, /^studio-sol-pack:/);
      assert.equal((await getWalletBalanceCents(owner)).balanceCents, 800);
      assert.equal((await readStudioAssistanceStatus(owner, policy)).credits?.purchased.remaining, 2000);
      if (identity === 'product-only') {
        await pg.pool.query('UPDATE app_receipts SET job_id=NULL WHERE id=$1', [charge.id]);
      } else if (identity === 'prefix-only') {
        await pg.pool.query('UPDATE app_receipts SET billing_product_key=NULL WHERE id=$1', [charge.id]);
      }
      await assert.rejects(
        issueManualWalletRefundByReceipt({ receiptId: Number(charge.id), adminUserId: 'admin' }, dependencies),
        reconciliationRequired,
      );
      assert.deepEqual({
        walletCents: (await getWalletBalanceCents(owner)).balanceCents,
        purchasedCredits: (await readStudioAssistanceStatus(owner, policy)).credits?.purchased.remaining,
        refunds: (await pg.pool.query("SELECT count(*)::int n FROM app_receipts WHERE type='refund' AND user_id=$1", [owner])).rows[0].n,
      }, { walletCents: 800, purchasedCredits: 2000, refunds: 0 });
    });
  }

  for (const selector of ['job', 'orphan-receipt']) {
    await t.test(`a legitimate ${selector} wallet charge can still be refunded exactly once`, async () => {
      const owner = `ordinary-${selector}`;
      const jobId = selector === 'job' ? 'ordinary-job' : null;
      await fund(owner);
      if (jobId) {
        await pg.pool.query(
          "INSERT INTO app_jobs(job_id,user_id,status,payment_status,currency) VALUES($1,$2,'completed','paid_wallet','USD')",
          [jobId, owner],
        );
      }
      const charge = (await pg.pool.query(
        "INSERT INTO app_receipts(user_id,type,amount_cents,currency,job_id) VALUES($1,'charge',200,'USD',$2) RETURNING id",
        [owner, jobId],
      )).rows[0];
      assert.equal((await getWalletBalanceCents(owner)).balanceCents, 800);
      const refund = jobId
        ? await issueManualWalletRefund({ jobId, adminUserId: 'admin' }, dependencies)
        : await issueManualWalletRefundByReceipt({ receiptId: Number(charge.id), adminUserId: 'admin' }, dependencies);
      assert.ok(refund.refundReceiptId > 0);
      await assert.rejects(
        issueManualWalletRefundByReceipt({ receiptId: Number(charge.id), adminUserId: 'admin' }, dependencies),
        /already has a refund/,
      );
      assert.equal((await getWalletBalanceCents(owner)).balanceCents, 1000);
      assert.equal((await pg.pool.query(
        "SELECT count(*)::int n FROM app_receipts WHERE type='refund' AND user_id=$1", [owner],
      )).rows[0].n, 1);
      if (jobId) {
        assert.deepEqual((await pg.pool.query(
          'SELECT status,payment_status FROM app_jobs WHERE job_id=$1', [jobId],
        )).rows, [{ status: 'completed', payment_status: 'refunded_wallet' }]);
      }
    });
  }
});
