import { getKnownGenerationFailureMessage, getMinimaxReferenceValidationMessage, getGenerationFailureFallbackMessage } from '@/lib/generation-failure-messages';
import { SEEDANCE_OUTPUT_COPYRIGHT_RESTRICTED } from '@/lib/video-failure-codes';
import { appendConfirmedWalletRefund, getSeedanceReferenceValidationMessage } from '@/lib/seedance-failure-messages';

export type WorkspaceFailureCopy = {
  messages: {
    seedanceCopyrightBlocked: string;
    seedanceCopyrightBlockedRefunded: string;
  };
};

export function getWorkspaceGenerationFailureMessage(
  status: {
    status?: string;
    failureCode?: string | null;
    message?: string | null;
    paymentStatus?: string | null;
    finalPriceCents?: number | null;
    currency?: string | null;
  },
  copy: WorkspaceFailureCopy,
  options: { locale?: string } = {}
): string | null {
  if (status.status && status.status !== 'failed') return status.message ?? null;
  if (!status.status && !status.message && !status.failureCode) return null;
  if (status.failureCode !== SEEDANCE_OUTPUT_COPYRIGHT_RESTRICTED) {
    const message = getKnownGenerationFailureMessage({ ...status, locale: options.locale })
      ?? (status.status === 'failed' ? getGenerationFailureFallbackMessage(options.locale) : status.message ?? null);
    if (!message) return null;
    return appendConfirmedWalletRefund(message, {
      paymentStatus: status.paymentStatus,
      amountCents: status.finalPriceCents,
      currency: status.currency,
      locale: options.locale,
    });
  }
  return status.paymentStatus === 'refunded_wallet'
    ? copy.messages.seedanceCopyrightBlockedRefunded
    : copy.messages.seedanceCopyrightBlocked;
}

export function getWorkspaceGenerationRequestFailureMessage(
  error: Record<string, unknown> | null,
  fallback: string,
  copy: WorkspaceFailureCopy,
  options: { locale: string; engineId: string }
): string {
  const validationMessage = getSeedanceReferenceValidationMessage({ ...error, ...options })
    ?? getMinimaxReferenceValidationMessage({ ...error, ...options });
  if (validationMessage) return validationMessage;
  return getWorkspaceGenerationFailureMessage({
    message: fallback,
    failureCode: typeof error?.failureCode === 'string' ? error.failureCode : typeof error?.error === 'string' ? error.error : undefined,
    paymentStatus: typeof error?.paymentStatus === 'string' ? error.paymentStatus : undefined,
    finalPriceCents: typeof error?.refundedAmountCents === 'number' ? error.refundedAmountCents : undefined,
    currency: typeof error?.currency === 'string' ? error.currency : undefined,
  }, copy, options) ?? fallback;
}
