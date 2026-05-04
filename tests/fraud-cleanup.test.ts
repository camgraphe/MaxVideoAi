import assert from 'node:assert/strict';
import test from 'node:test';

import {
  RESTRICTED_ACCOUNT_MESSAGE,
  planFraudTopupActions,
} from '../frontend/src/server/fraud-cleanup.ts';

test('planFraudTopupActions ignores top-ups that Stripe has not refunded or fraud-marked', () => {
  const plan = planFraudTopupActions({
    candidates: [
      {
        receiptId: 1,
        userId: 'user_normal',
        email: 'normal@example.com',
        amountCents: 1000,
        currency: 'USD',
        createdAt: '2026-05-04T10:00:00.000Z',
        stripePaymentIntentId: 'pi_normal',
        stripeChargeId: 'ch_normal',
        stripeCheckoutSessionId: 'cs_normal',
        currentBalanceCents: 1000,
        alreadyReversedCents: 0,
        completedGenerations: 1,
        topupsInWindow: 1,
        failedOrBlockedAttemptsInWindow: 0,
        stripeStatus: {
          refunded: false,
          fraudMarked: false,
          refundedAmountCents: 0,
          reasons: [],
        },
      },
    ],
  });

  assert.equal(plan.items.length, 0);
  assert.equal(plan.summary.matchedPayments, 0);
  assert.equal(plan.summary.totalReversalCents, 0);
});

test('planFraudTopupActions caps credit reversal at the available wallet balance', () => {
  const plan = planFraudTopupActions({
    candidates: [
      {
        receiptId: 2,
        userId: 'user_refunded',
        email: 'refunded@example.com',
        amountCents: 1000,
        currency: 'USD',
        createdAt: '2026-05-04T10:00:00.000Z',
        stripePaymentIntentId: 'pi_refunded',
        stripeChargeId: 'ch_refunded',
        stripeCheckoutSessionId: 'cs_refunded',
        currentBalanceCents: 375,
        alreadyReversedCents: 0,
        completedGenerations: 2,
        topupsInWindow: 1,
        failedOrBlockedAttemptsInWindow: 0,
        stripeStatus: {
          refunded: true,
          fraudMarked: false,
          refundedAmountCents: 1000,
          reasons: ['charge_refunded'],
        },
      },
    ],
  });

  assert.equal(plan.items.length, 1);
  assert.equal(plan.items[0]?.reversalAmountCents, 375);
  assert.equal(plan.items[0]?.previousBalanceCents, 375);
  assert.equal(plan.items[0]?.newBalanceCents, 0);
  assert.equal(plan.items[0]?.unreversedRemainderCents, 625);
  assert.equal(plan.summary.totalReversalCents, 375);
});

test('planFraudTopupActions reverses the full top-up when Stripe fraud-marks a partial refund', () => {
  const plan = planFraudTopupActions({
    candidates: [
      {
        receiptId: 22,
        userId: 'user_partial_fraud',
        email: 'partial-fraud@example.com',
        amountCents: 1000,
        currency: 'USD',
        createdAt: '2026-05-04T10:00:00.000Z',
        stripePaymentIntentId: 'pi_partial_fraud',
        stripeChargeId: 'ch_partial_fraud',
        stripeCheckoutSessionId: 'cs_partial_fraud',
        currentBalanceCents: 1000,
        alreadyReversedCents: 0,
        completedGenerations: 0,
        topupsInWindow: 1,
        failedOrBlockedAttemptsInWindow: 0,
        stripeStatus: {
          refunded: true,
          fraudMarked: true,
          refundedAmountCents: 876,
          reasons: ['radar_fraud_details', 'refund_reason_fraudulent'],
        },
      },
    ],
  });

  assert.equal(plan.items.length, 1);
  assert.equal(plan.items[0]?.reversalAmountCents, 1000);
  assert.equal(plan.items[0]?.newBalanceCents, 0);
  assert.equal(plan.items[0]?.unreversedRemainderCents, 0);
});

test('planFraudTopupActions restricts clearly fraudulent repeated small top-ups with no generations', () => {
  const plan = planFraudTopupActions({
    candidates: [
      {
        receiptId: 3,
        userId: 'user_fraud',
        email: 'fraud@example.com',
        amountCents: 1000,
        currency: 'USD',
        createdAt: '2026-05-04T10:00:00.000Z',
        stripePaymentIntentId: 'pi_fraud',
        stripeChargeId: 'ch_fraud',
        stripeCheckoutSessionId: 'cs_fraud',
        currentBalanceCents: 1000,
        alreadyReversedCents: 0,
        completedGenerations: 0,
        topupsInWindow: 4,
        failedOrBlockedAttemptsInWindow: 2,
        stripeStatus: {
          refunded: true,
          fraudMarked: true,
          refundedAmountCents: 1000,
          reasons: ['radar_fraud_details'],
        },
      },
    ],
  });

  assert.equal(plan.items.length, 1);
  assert.equal(plan.items[0]?.restrictAccount, true);
  assert.equal(plan.items[0]?.restrictionReason, 'fraud_marked_payment');
  assert.equal(plan.summary.accountsToRestrict, 1);
  assert.equal(RESTRICTED_ACCOUNT_MESSAGE, 'Your account is temporarily restricted for security reasons. Please contact support.');
});
