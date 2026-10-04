import assert from 'node:assert/strict';
import test from 'node:test';
import { getDb } from '../frontend/src/lib/db';
import { ensureBillingSchema } from '../frontend/src/lib/schema';
import { startDisposablePostgres } from './helpers/disposable-postgres';
import { summarizeWalletFlow } from '../frontend/app/(core)/admin/insights/_lib/insights-series-helpers';

test('admin render spending excludes payment-credit reversals while wallet balance retains every debit', async () => {
  const db = await startDisposablePostgres('admin-credit-reversal');
  const previousDatabase = process.env.DATABASE_URL;
  const previousServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.DATABASE_URL = db.databaseUrl;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  try {
    // Comparison series use UTC day keys; initdb otherwise inherits the host timezone.
    // Pin both new application connections and the existing fixture connection.
    await db.pool.query("ALTER DATABASE postgres SET timezone TO 'UTC'");
    await db.pool.query("SET TIME ZONE 'UTC'");
    await ensureBillingSchema();
    await db.pool.query(`CREATE TABLE profiles (
      id text PRIMARY KEY, email text, created_at timestamptz DEFAULT NOW(),
      synced_from_supabase boolean DEFAULT true
    ); INSERT INTO profiles (id, email) VALUES ('customer-1', 'customer@example.test')`);
    await db.pool.query(`INSERT INTO app_receipts (user_id, type, amount_cents, currency, metadata)
      VALUES ('customer-1', 'topup', 10000, 'USD', NULL),
             ('customer-1', 'charge', 200, 'USD', NULL),
             ('customer-1', 'charge', 100, 'USD', '{}'),
             ('customer-1', 'charge', 300, 'USD', '{"reason":"customer_payment_refund_credit_reversal"}'),
             ('customer-1', 'charge', 500, 'USD', '{"reason":"fraud_credit_reversal"}'),
             ('customer-1', 'refund', 50, 'USD', NULL)`);
    const { fetchAdminUserOverview } = await import('../frontend/server/admin-users');
    const { fetchAdminMetrics } = await import('../frontend/server/admin-metrics/admin-metrics-main');
    const { fetchAdminMetricsComparison } = await import('../frontend/server/admin-metrics/admin-metrics-comparison');
    const overview = await fetchAdminUserOverview('customer-1');
    assert.equal(overview.wallet?.balanceCents, 8950);
    assert.equal(overview.wallet?.stats.charge, 300);
    assert.equal(overview.wallet?.stats.credit_reversal, 800);
    assert.equal(overview.wallet?.stats.refund, 50);
    const metrics = await fetchAdminMetrics('24h');
    assert.equal(metrics.totals.allTimeRenderChargesUsd, 3);
    assert.equal(metrics.totals.allTimeNetRenderSpendUsd, 2.5);
    assert.equal(metrics.timeseries.chargesDaily.reduce((sum, row) => sum + row.amountCents, 0), 300);
    assert.equal(metrics.monthly.chargesMonthly.reduce((sum, row) => sum + row.amountCents, 0), 300);
    const comparison = await fetchAdminMetricsComparison('24h');
    assert.equal(comparison.current.chargesDaily.reduce((sum, row) => sum + row.amountCents, 0), 300);
    assert.equal(comparison.current.creditReversalsDaily.reduce((sum, row) => sum + row.amountCents, 0), 800);
    assert.equal(summarizeWalletFlow({
      topups: comparison.current.topupsDaily,
      grossCharges: comparison.current.chargesDaily,
      refunds: comparison.current.refundsDaily,
      creditReversals: comparison.current.creditReversalsDaily,
    }).walletBalanceDeltaUsd, 89.5);
    assert.equal((await db.pool.query('SELECT count(*) FROM app_receipts')).rows[0].count, '6');
    await db.pool.query(`INSERT INTO app_receipts (user_id, type, amount_cents, currency, metadata, created_at)
      VALUES ('customer-1', 'topup', 1000, 'USD', NULL, date_trunc('day', NOW()) - INTERVAL '12 hours'),
             ('customer-1', 'charge', 400, 'USD', '{"reason":"fraud_credit_reversal"}', date_trunc('day', NOW()) - INTERVAL '12 hours')`);
    const windows = await fetchAdminMetricsComparison('24h');
    assert.equal(windows.previous.creditReversalsDaily.reduce((sum, row) => sum + row.amountCents, 0), 400);
    assert.equal(summarizeWalletFlow({
      topups: windows.previous.topupsDaily,
      grossCharges: windows.previous.chargesDaily,
      refunds: windows.previous.refundsDaily,
      creditReversals: windows.previous.creditReversalsDaily,
    }).walletBalanceDeltaUsd, 6);
    const excluded = await fetchAdminMetricsComparison('24h', { excludeUserIds: ['customer-1'] });
    assert.equal(excluded.current.creditReversalsDaily.reduce((sum, row) => sum + row.amountCents, 0), 0);
    assert.equal(excluded.previous.creditReversalsDaily.reduce((sum, row) => sum + row.amountCents, 0), 0);
  } finally {
    await getDb().end().catch(() => undefined);
    await db.cleanup();
    if (previousDatabase === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousDatabase;
    if (previousServiceRole === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = previousServiceRole;
  }
});
