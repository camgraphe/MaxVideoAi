'use client';

import { ArrowRight, LockKeyhole } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import type { BillingCopy } from '../_lib/billing-copy';
import styles from './billing-topup.module.css';

type WalletCheckoutSummaryProps = {
  copy: BillingCopy;
  creditsLabel: string;
  paymentAmountLabel: string | null;
  quoteLoading: boolean;
  quoteError: string | null;
  isTopupStarting: boolean;
  onCheckout: () => void;
};

export function WalletCheckoutSummary({
  copy,
  creditsLabel,
  paymentAmountLabel,
  quoteLoading,
  quoteError,
  isTopupStarting,
  onCheckout,
}: WalletCheckoutSummaryProps) {
  const paymentValue = quoteLoading
    ? copy.wallet.quoteLoading
    : quoteError
      ? copy.wallet.quoteUnavailable
      : paymentAmountLabel ?? copy.wallet.quoteLoading;

  return (
    <div className={styles.checkoutSummary}>
      <dl className={styles.quoteRows} aria-live="polite">
        <div>
          <dt>{copy.wallet.paymentAmount}</dt>
          <dd data-state={quoteError ? 'error' : quoteLoading ? 'loading' : 'ready'}>{paymentValue}</dd>
        </div>
        <div>
          <dt>{copy.wallet.creditsReceived}</dt>
          <dd>{creditsLabel}</dd>
        </div>
      </dl>
      <p className={styles.quoteCaption}>{quoteError ?? copy.wallet.quoteCurrent}</p>

      <div className={styles.hostedCheckout}>
        <div>
          <span className={styles.paymentIcon} aria-hidden="true"><LockKeyhole size={17} /></span>
          <span>
            <strong>{copy.wallet.hostedPaymentTitle}</strong>
            <small>{copy.wallet.hostedPaymentDescription}</small>
          </span>
        </div>
        <Button
          type="button"
          size="lg"
          disabled={quoteLoading || isTopupStarting}
          onClick={onCheckout}
          className={styles.checkoutButton}
        >
          {copy.wallet.checkoutCta}
          <ArrowRight size={17} aria-hidden="true" />
        </Button>
      </div>
      <p className={styles.checkoutNote}>{copy.wallet.checkoutNote}</p>
    </div>
  );
}
