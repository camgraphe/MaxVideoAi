import type { PricingSnapshot } from '@maxvideoai/pricing';

export type PaymentSplitMode =
  | 'platform_fee'
  | 'destination_charge'
  | 'on_behalf_of';

export interface PaymentAttemptContract {
  operationId: string; // Idempotency key supplied by client for each render/payment attempt
  engineId: string;
  resolution: string;
  durationSec: number;
  memberTier?: string;
  pricing: PricingSnapshot;
  splitMode?: PaymentSplitMode;
  platformFeePct?: number;
  applicationFeeAmountCents?: number;
  vendorDestinationId?: string | null;
}

export type RefundStatus = 'refund_initiated' | 'refund_partial' | 'refund_pending';

export interface RefundStateDescriptor {
  status: RefundStatus;
  amountCents?: number;
  remainingCents?: number;
  receiptUrl?: string;
  message?: string;
}
