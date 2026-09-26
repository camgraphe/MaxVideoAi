import { isRefundedPaymentStatus } from '@/lib/gallery-retention';
import { SEEDANCE_OUTPUT_COPYRIGHT_RESTRICTED } from '@/lib/video-failure-codes';
import { appendConfirmedWalletRefund, getSeedanceFailureMessage, getSeedanceReferenceValidationMessage } from '@/lib/seedance-failure-messages';

export type WorkspaceFailureCopy = {
  messages: {
    seedanceCopyrightBlocked: string;
    seedanceCopyrightBlockedRefunded: string;
  };
};

export function getWorkspaceGenerationFailureMessage(
  status: {
    failureCode?: string | null;
    message?: string | null;
    paymentStatus?: string | null;
    finalPriceCents?: number | null;
    currency?: string | null;
  },
  copy: WorkspaceFailureCopy,
  options: { locale?: string } = {}
): string | null {
  if (status.failureCode !== SEEDANCE_OUTPUT_COPYRIGHT_RESTRICTED) {
    const message = getSeedanceFailureMessage({ ...status, locale: options.locale });
    return message ? appendConfirmedWalletRefund(message, {
      paymentStatus: status.paymentStatus,
      amountCents: status.finalPriceCents,
      currency: status.currency,
      locale: options.locale,
    }) : status.message ?? null;
  }
  return isRefundedPaymentStatus(status.paymentStatus)
    ? copy.messages.seedanceCopyrightBlockedRefunded
    : copy.messages.seedanceCopyrightBlocked;
}

export function getWorkspaceGenerationRequestFailureMessage(
  error: Record<string, unknown> | null,
  fallback: string,
  copy: WorkspaceFailureCopy,
  options: { locale: string; engineId: string }
): string {
  const validationMessage = getSeedanceReferenceValidationMessage({ ...error, ...options });
  if (validationMessage) return validationMessage;
  return getWorkspaceGenerationFailureMessage({
    message: fallback,
    failureCode: typeof error?.failureCode === 'string' ? error.failureCode : typeof error?.error === 'string' ? error.error : undefined,
    paymentStatus: typeof error?.paymentStatus === 'string' ? error.paymentStatus : undefined,
    finalPriceCents: typeof error?.refundedAmountCents === 'number' ? error.refundedAmountCents : undefined,
    currency: typeof error?.currency === 'string' ? error.currency : undefined,
  }, copy, options) ?? fallback;
}
