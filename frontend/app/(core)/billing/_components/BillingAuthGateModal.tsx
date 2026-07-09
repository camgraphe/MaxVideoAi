'use client';

import { Button, ButtonLink } from '@/components/ui/Button';
import { useAccessibleModal } from '@/components/ui/useAccessibleModal';
import type { BillingCopy } from '../_lib/billing-copy';

type BillingAuthGateModalProps = {
  copy: BillingCopy;
  loginRedirectTarget: string;
  onClose: () => void;
};

export function BillingAuthGateModal({ copy, loginRedirectTarget, onClose }: BillingAuthGateModalProps) {
  const { dialogRef, onDialogKeyDown } = useAccessibleModal<HTMLDivElement>({ onClose });

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-surface-on-media-dark-40 px-4">
      <div className="absolute inset-0" aria-hidden="true" onClick={onClose} />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="billing-auth-gate-title"
        aria-describedby="billing-auth-gate-description"
        tabIndex={-1}
        onKeyDown={onDialogKeyDown}
        className="relative z-10 w-full max-w-md rounded-modal border border-border bg-surface p-6 shadow-float"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h2 id="billing-auth-gate-title" className="text-base font-semibold text-text-primary">
              {copy.authGate.title}
            </h2>
            <p id="billing-auth-gate-description" className="mt-2 text-sm text-text-secondary">
              {copy.authGate.body}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            className="rounded-full border-hairline bg-surface-glass-80 px-3 py-1.5 text-sm text-text-muted hover:bg-surface-2"
            aria-label={copy.authGate.close}
          >
            {copy.authGate.close}
          </Button>
        </div>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
          <ButtonLink
            href={`/login?next=${encodeURIComponent(loginRedirectTarget)}`}
            size="sm"
            className="px-4"
            data-modal-initial-focus="true"
          >
            {copy.authGate.primary}
          </ButtonLink>
          <ButtonLink
            href={`/login?mode=signin&next=${encodeURIComponent(loginRedirectTarget)}`}
            variant="outline"
            size="sm"
            className="px-4"
          >
            {copy.authGate.secondary}
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}
