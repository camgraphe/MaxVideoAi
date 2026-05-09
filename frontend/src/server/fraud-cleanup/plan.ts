import { DEFAULT_REPEATED_SMALL_TOPUP_THRESHOLD } from './constants';
import type { FraudCleanupPlan, FraudCleanupPlanItem, FraudTopupCandidate, StripeFraudStatus } from './types';

function isFraudMatched(status: StripeFraudStatus): boolean {
  return status.refunded || status.fraudMarked;
}

function resolveRestrictionReason(
  candidate: FraudTopupCandidate,
  matchedPaymentsForUser: number,
  repeatedSmallTopupThreshold: number
): string | null {
  if (candidate.accountAlreadyRestricted) return null;
  if (candidate.stripeStatus.fraudMarked) return 'fraud_marked_payment';
  if (candidate.completedGenerations > 0) return null;
  if (candidate.failedOrBlockedAttemptsInWindow >= 2) return 'multiple_failed_blocked_attempts';
  if (candidate.topupsInWindow >= repeatedSmallTopupThreshold) return 'repeated_refunded_small_topups';
  if (matchedPaymentsForUser >= 2) return 'repeated_refunded_payments';
  return null;
}

export function planFraudTopupActions({
  candidates,
  dryRun = true,
  repeatedSmallTopupThreshold = DEFAULT_REPEATED_SMALL_TOPUP_THRESHOLD,
}: {
  candidates: FraudTopupCandidate[];
  dryRun?: boolean;
  repeatedSmallTopupThreshold?: number;
}): FraudCleanupPlan {
  const matched = candidates.filter((candidate) => isFraudMatched(candidate.stripeStatus));
  const matchedCountByUser = new Map<string, number>();
  for (const candidate of matched) {
    matchedCountByUser.set(candidate.userId, (matchedCountByUser.get(candidate.userId) ?? 0) + 1);
  }

  const availableBalanceByUserCurrency = new Map<string, number>();
  const restrictedUsers = new Set<string>();
  const items: FraudCleanupPlanItem[] = [];

  for (const candidate of matched) {
    const balanceKey = `${candidate.userId}:${candidate.currency}`;
    if (!availableBalanceByUserCurrency.has(balanceKey)) {
      availableBalanceByUserCurrency.set(balanceKey, Math.max(0, candidate.currentBalanceCents));
    }
    const previousBalanceCents = availableBalanceByUserCurrency.get(balanceKey) ?? 0;
    const refundedBasisCents = candidate.stripeStatus.fraudMarked
      ? candidate.amountCents
      : candidate.stripeStatus.refundedAmountCents > 0
      ? Math.min(candidate.amountCents, candidate.stripeStatus.refundedAmountCents)
      : candidate.amountCents;
    const outstandingPaymentCredits = Math.max(0, refundedBasisCents - candidate.alreadyReversedCents);
    const reversalAmountCents = Math.min(previousBalanceCents, outstandingPaymentCredits);
    const newBalanceCents = Math.max(0, previousBalanceCents - reversalAmountCents);
    availableBalanceByUserCurrency.set(balanceKey, newBalanceCents);

    const restrictionReason = restrictedUsers.has(candidate.userId)
      ? null
      : resolveRestrictionReason(
          candidate,
          matchedCountByUser.get(candidate.userId) ?? 0,
          repeatedSmallTopupThreshold
        );
    const restrictAccount = Boolean(restrictionReason);
    if (restrictAccount) {
      restrictedUsers.add(candidate.userId);
    }

    items.push({
      receiptId: candidate.receiptId,
      userId: candidate.userId,
      email: candidate.email,
      stripePaymentIntentId: candidate.stripePaymentIntentId,
      stripeChargeId: candidate.stripeChargeId,
      stripeCheckoutSessionId: candidate.stripeCheckoutSessionId,
      amountCents: candidate.amountCents,
      currency: candidate.currency,
      previousBalanceCents,
      newBalanceCents,
      reversalAmountCents,
      unreversedRemainderCents: Math.max(0, outstandingPaymentCredits - reversalAmountCents),
      restrictAccount,
      restrictionReason,
      stripeStatus: candidate.stripeStatus,
    });
  }

  return {
    dryRun,
    items,
    summary: {
      scannedPayments: candidates.length,
      matchedPayments: items.length,
      creditsToReverse: items.filter((item) => item.reversalAmountCents > 0).length,
      accountsToRestrict: items.filter((item) => item.restrictAccount).length,
      totalReversalCents: items.reduce((sum, item) => sum + item.reversalAmountCents, 0),
    },
  };
}
