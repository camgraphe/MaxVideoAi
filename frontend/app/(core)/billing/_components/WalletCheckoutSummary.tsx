'use client';

import { ArrowRight, LockKeyhole } from 'lucide-react';
import type { ReactNode } from 'react';
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
  children?: ReactNode;
};

export function WalletCheckoutSummary({
  copy,
  creditsLabel,
  paymentAmountLabel,
  quoteLoading,
  quoteError,
  isTopupStarting,
  onCheckout,
  children,
}: WalletCheckoutSummaryProps) {
  const paymentValue = quoteLoading
    ? copy.wallet.quoteLoading
    : quoteError
      ? copy.wallet.quoteUnavailable
      : paymentAmountLabel ?? copy.wallet.quoteUnavailable;

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

      {children}

      <div className={styles.hostedCheckout}>
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
      <p className={styles.checkoutTrust}>
        <LockKeyhole size={14} aria-hidden="true" />
        <span>{copy.wallet.checkoutSecure}</span>
        <span className={styles.stripeWordmark} role="img" aria-label="Stripe" />
      </p>
      <p className={styles.checkoutNote}>{copy.wallet.checkoutNote}</p>
    </div>
  );
}
