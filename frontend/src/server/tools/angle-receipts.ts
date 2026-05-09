import { query } from '@/lib/db';
import type { PricingSnapshot } from '@/types/engines';
import { ANGLE_SURFACE } from './angle-request-utils';

export type PendingAngleReceipt = {
  userId: string;
  amountCents: number;
  currency: string;
  description: string;
  jobId: string;
  surface: typeof ANGLE_SURFACE;
  billingProductKey: string;
  snapshot: PricingSnapshot;
  applicationFeeCents: number | null;
  vendorAccountId: string | null;
};

export async function recordAngleRefundReceipt(receipt: PendingAngleReceipt, label: string, priceOnly: boolean) {
  try {
    await query(
      `INSERT INTO app_receipts (
         user_id,
         type,
         amount_cents,
         currency,
         description,
         job_id,
         surface,
         billing_product_key,
         pricing_snapshot,
         application_fee_cents,
         vendor_account_id,
         platform_revenue_cents,
         destination_acct
       )
       VALUES ($1,'refund',$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11,$12)
       ON CONFLICT DO NOTHING`,
      [
        receipt.userId,
        receipt.amountCents,
        receipt.currency,
        label,
        receipt.jobId,
        receipt.surface,
        receipt.billingProductKey,
        JSON.stringify(receipt.snapshot),
        priceOnly ? null : 0,
        priceOnly ? null : receipt.vendorAccountId,
        priceOnly ? null : 0,
        priceOnly ? null : receipt.vendorAccountId,
      ]
    );
  } catch (error) {
    console.warn('[tools/angle] failed to record refund receipt', error);
  }
}
