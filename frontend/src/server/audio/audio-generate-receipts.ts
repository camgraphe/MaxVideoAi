import { AUDIO_SURFACE } from '@/lib/audio-generation';
import { query } from '@/lib/db';

export async function refundAudioCharge(params: {
  userId: string;
  jobId: string;
  amountCents: number;
  currency: string;
  description: string;
  billingProductKey: string;
  pricingSnapshotJson: string;
}): Promise<void> {
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
         vendor_account_id
       )
       VALUES ($1, 'refund', $2, $3, $4, $5, $6, $7, $8::jsonb, 0, NULL)`,
      [
        params.userId,
        params.amountCents,
        params.currency,
        params.description,
        params.jobId,
        AUDIO_SURFACE,
        params.billingProductKey,
        params.pricingSnapshotJson,
      ]
    );
  } catch (error) {
    console.warn('[audio] failed to record wallet refund', error);
  }
}
