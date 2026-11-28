import assert from 'node:assert/strict';
import test from 'node:test';
import { exportCustomerReceipt } from '../frontend/server/dsar-receipt';

test('account exports keep customer amounts, payment references and consent without disclosing supplier economics', () => {
  const result = exportCustomerReceipt({
    id:'receipt', type:'charge', amount_cents:85, currency:'USD', description:'Video', job_id:'job',
    stripe_payment_intent_id:'pi_customer', stripe_charge_id:'ch_customer', stripe_refund_id:null,
    metadata:{sessionId:'session',original_receipt_id:'receipt1',analytics_consent:'denied',fx_rate:1.02,
      pricing_audit_snapshot:{margin:'PRIVATE_MARGIN'},purchaseRouting:{candidates:['PRIVATE_ROUTE']},
      nested:[{provider_cost_usd:'PRIVATE_COST',original_stripe_charge_id:'ch_kept'}]},
    pricing_snapshot:{totalCents:85,currency:'USD',meta:{provider_cost_source:'PRIVATE_RATE'},margin:{amountCents:29}},
  });
  assert.deepEqual(result.metadata, {sessionId:'session',original_receipt_id:'receipt1',analytics_consent:'denied',
    fx_rate:1.02,nested:[{original_stripe_charge_id:'ch_kept'}]});
  assert.deepEqual(result.pricing_snapshot, {totalCents:85,currency:'USD'});
  assert.doesNotMatch(JSON.stringify(result),/PRIVATE_|pricing_audit_snapshot|purchaseRouting|amountCents":29/);
  assert.equal(result.stripe_charge_id,'ch_customer');
  assert.equal(result.stripe_payment_intent_id,'pi_customer');
  assert.equal(result.job_id,'job');
  assert.deepEqual(exportCustomerReceipt({metadata:null,pricing_snapshot:null}),{metadata:null,pricing_snapshot:null});
});


test('legacy Studio refunds keep their charged amount and tariff version without exporting cost inputs', () => {
  const receipt = exportCustomerReceipt({ amount_cents:22, currency:'USD', metadata:null,
    pricing_snapshot:{tariffVersion:'v1',chargedCents:80,settledMessageQuote:{supplier:'internal'}} });
  assert.equal(receipt.amount_cents,22);
  assert.deepEqual(receipt.pricing_snapshot,{tariffVersion:'v1',chargedCents:80});
});
