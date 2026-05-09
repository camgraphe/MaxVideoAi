import { withDbTransaction, type QueryExecutor } from '@/lib/db';
import { CREDIT_REVERSAL_DESCRIPTION, FRAUD_REVERSAL_REASON, RESTRICTED_ACCOUNT_MESSAGE } from './constants';
import type { FraudCleanupPlan, FraudCleanupPlanItem, RunFraudCleanupParams } from './types';

async function insertFraudAudit(
  executor: QueryExecutor,
  item: FraudCleanupPlanItem,
  actionTaken: 'credits_reversed' | 'account_restricted',
  adminUserId: string,
  metadata: Record<string, unknown>
): Promise<void> {
  await executor.query(
    `
      INSERT INTO wallet_fraud_cleanup_audit (
        user_id,
        email,
        stripe_payment_intent_id,
        stripe_checkout_session_id,
        stripe_charge_id,
        amount_cents,
        currency,
        previous_balance_cents,
        new_balance_cents,
        action_taken,
        admin_user_id,
        metadata
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb)
    `,
    [
      item.userId,
      item.email,
      item.stripePaymentIntentId,
      item.stripeCheckoutSessionId,
      item.stripeChargeId,
      item.amountCents,
      item.currency,
      item.previousBalanceCents,
      item.newBalanceCents,
      actionTaken,
      adminUserId,
      JSON.stringify(metadata),
    ]
  );
}

export async function applyFraudCleanupPlan(
  plan: FraudCleanupPlan,
  params: Pick<RunFraudCleanupParams, 'adminUserId' | 'adminEmail'>
): Promise<void> {
  await withDbTransaction(async (executor) => {
    for (const item of plan.items) {
      const metadata = {
        reason: FRAUD_REVERSAL_REASON,
        original_topup_receipt_id: String(item.receiptId),
        stripe_payment_intent_id: item.stripePaymentIntentId,
        stripe_charge_id: item.stripeChargeId,
        stripe_checkout_session_id: item.stripeCheckoutSessionId,
        admin_user_id: params.adminUserId,
        admin_email: params.adminEmail ?? null,
        previous_balance_cents: item.previousBalanceCents,
        new_balance_cents: item.newBalanceCents,
        stripe_status: item.stripeStatus,
      };

      if (item.reversalAmountCents > 0) {
        const insertedReversal = await executor.query<{ id: number }>(
          `
            WITH updated AS (
              UPDATE app_receipts
              SET amount_cents = amount_cents + $2,
                  metadata = COALESCE(metadata, '{}'::jsonb) || $5::jsonb
              WHERE type = 'charge'
                AND metadata ->> 'reason' = $6
                AND metadata ->> 'original_topup_receipt_id' = $7
              RETURNING id
            ),
            inserted AS (
              INSERT INTO app_receipts (
                user_id,
                type,
                amount_cents,
                currency,
                description,
                metadata
              )
              SELECT $1, 'charge', $2, $3, $4, $5::jsonb
              WHERE NOT EXISTS (SELECT 1 FROM updated)
              ON CONFLICT DO NOTHING
              RETURNING id
            )
            SELECT id FROM updated
            UNION ALL
            SELECT id FROM inserted
          `,
          [
            item.userId,
            item.reversalAmountCents,
            item.currency,
            CREDIT_REVERSAL_DESCRIPTION,
            JSON.stringify(metadata),
            FRAUD_REVERSAL_REASON,
            String(item.receiptId),
          ]
        );

        if (insertedReversal.length) {
          await insertFraudAudit(executor, item, 'credits_reversed', params.adminUserId, {
            ...metadata,
            reversal_amount_cents: item.reversalAmountCents,
            unreversed_remainder_cents: item.unreversedRemainderCents,
          });
        }
      }

      if (item.restrictAccount) {
        const restrictionMetadata = {
          source: 'stripe_fraud_wallet_cleanup',
          restriction_reason: item.restrictionReason,
          original_topup_receipt_id: String(item.receiptId),
          stripe_payment_intent_id: item.stripePaymentIntentId,
          stripe_charge_id: item.stripeChargeId,
          stripe_checkout_session_id: item.stripeCheckoutSessionId,
          stripe_status: item.stripeStatus,
        };

        await executor.query(
          `
            INSERT INTO user_account_restrictions (
              user_id,
              active,
              reason,
              message,
              restricted_by,
              metadata
            )
            VALUES ($1, TRUE, $2, $3, $4, $5::jsonb)
            ON CONFLICT (user_id)
            DO UPDATE SET
              active = TRUE,
              reason = EXCLUDED.reason,
              message = EXCLUDED.message,
              restricted_by = EXCLUDED.restricted_by,
              restricted_at = NOW(),
              lifted_at = NULL,
              lifted_by = NULL,
              metadata = COALESCE(user_account_restrictions.metadata, '{}'::jsonb) || EXCLUDED.metadata
          `,
          [
            item.userId,
            item.restrictionReason ?? 'suspected_fraud',
            RESTRICTED_ACCOUNT_MESSAGE,
            params.adminUserId,
            JSON.stringify(restrictionMetadata),
          ]
        );

        await insertFraudAudit(executor, item, 'account_restricted', params.adminUserId, restrictionMetadata);
      }
    }
  });
}
