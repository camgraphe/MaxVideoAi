import assert from 'node:assert/strict';
import test from 'node:test';
import { runBillingCheckoutReconciliation } from '../frontend/app/(core)/billing/_lib/billing-checkout-reconciliation';

test('checkout reconciliation refreshes wallet and receipts twice in order', async () => {
  const events: string[] = [];

  const result = await runBillingCheckoutReconciliation({
    refreshWallet: async () => { events.push('wallet'); return true; },
    refreshReceipts: async () => { events.push('receipts'); return true; },
    wait: async (milliseconds) => { events.push(`wait:${milliseconds}`); },
    isActive: () => true,
  });

  assert.deepEqual(events, ['wallet', 'receipts', 'wait:1800', 'wallet', 'receipts']);
  assert.equal(result, 'refreshed');
});

test('checkout reconciliation stops before a late follow-up after account invalidation', async () => {
  const events: string[] = [];
  let active = true;

  const result = await runBillingCheckoutReconciliation({
    refreshWallet: async () => { events.push('wallet'); return true; },
    refreshReceipts: async () => { events.push('receipts'); return true; },
    wait: async () => { active = false; },
    isActive: () => active,
  });

  assert.deepEqual(events, ['wallet', 'receipts']);
  assert.equal(result, 'cancelled');
});

test('checkout reconciliation reports delayed account data when the final refresh fails', async () => {
  let round = 0;

  const result = await runBillingCheckoutReconciliation({
    refreshWallet: async () => { round += 1; return round === 1; },
    refreshReceipts: async () => round === 1,
    wait: async () => {},
    isActive: () => true,
  });

  assert.equal(result, 'delayed');
});
