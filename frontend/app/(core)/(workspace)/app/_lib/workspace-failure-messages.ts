import { isRefundedPaymentStatus } from '@/lib/gallery-retention';
import { SEEDANCE_OUTPUT_COPYRIGHT_RESTRICTED } from '@/lib/video-failure-codes';

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
  },
  copy: WorkspaceFailureCopy
): string | null {
  if (status.failureCode !== SEEDANCE_OUTPUT_COPYRIGHT_RESTRICTED) {
    return status.message ?? null;
  }
  return isRefundedPaymentStatus(status.paymentStatus)
    ? copy.messages.seedanceCopyrightBlockedRefunded
    : copy.messages.seedanceCopyrightBlocked;
}
