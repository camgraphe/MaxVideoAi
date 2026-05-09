import type Stripe from 'stripe';

export type StripeFraudStatus = {
  refunded: boolean;
  fraudMarked: boolean;
  refundedAmountCents: number;
  reasons: string[];
};

export type FraudTopupCandidate = {
  receiptId: number;
  userId: string;
  email: string | null;
  amountCents: number;
  currency: string;
  createdAt: string;
  stripePaymentIntentId: string | null;
  stripeChargeId: string | null;
  stripeCheckoutSessionId: string | null;
  currentBalanceCents: number;
  alreadyReversedCents: number;
  completedGenerations: number;
  topupsInWindow: number;
  failedOrBlockedAttemptsInWindow: number;
  accountAlreadyRestricted?: boolean;
  stripeStatus: StripeFraudStatus;
};

export type FraudCleanupPlanItem = {
  receiptId: number;
  userId: string;
  email: string | null;
  stripePaymentIntentId: string | null;
  stripeChargeId: string | null;
  stripeCheckoutSessionId: string | null;
  amountCents: number;
  currency: string;
  previousBalanceCents: number;
  newBalanceCents: number;
  reversalAmountCents: number;
  unreversedRemainderCents: number;
  restrictAccount: boolean;
  restrictionReason: string | null;
  stripeStatus: StripeFraudStatus;
};

export type FraudCleanupPlan = {
  dryRun: boolean;
  items: FraudCleanupPlanItem[];
  summary: {
    scannedPayments: number;
    matchedPayments: number;
    creditsToReverse: number;
    accountsToRestrict: number;
    totalReversalCents: number;
  };
};

export type RawTopupRow = {
  receipt_id: number | string;
  user_id: string;
  amount_cents: number | string | null;
  currency: string | null;
  created_at: string;
  stripe_payment_intent_id: string | null;
  stripe_charge_id: string | null;
  stripe_checkout_session_id: string | null;
  stripe_customer_id: string | null;
};

export type RunFraudCleanupParams = {
  stripe: Stripe;
  adminUserId: string;
  adminEmail?: string | null;
  dryRun?: boolean;
  since?: Date;
  until?: Date;
  limit?: number;
  maxTopupAmountCents?: number | null;
  paymentIntentIds?: string[];
  chargeIds?: string[];
  checkoutSessionIds?: string[];
  includeStripeAttemptCounts?: boolean;
};
