'use client';

import { RefreshCw, WalletCards } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import type { BillingWalletStatus } from '../_hooks/useBillingSessionState';
import type { BillingCopy } from '../_lib/billing-copy';
import styles from './billing-layout.module.css';

type BillingWalletOverviewProps = {
  copy: BillingCopy;
  stripeMode: 'test' | 'live' | 'disabled';
  wallet: { balance: number; currency: string } | null;
  walletStatus: BillingWalletStatus;
  canRefresh?: boolean;
  onRefresh: () => void;
};

export function BillingWalletOverview({
  copy,
  stripeMode,
  wallet,
  walletStatus,
  canRefresh = true,
  onRefresh,
}: BillingWalletOverviewProps) {
  const isRefreshing = walletStatus === 'loading' || walletStatus === 'refreshing';
  const balanceStatus = walletStatus === 'loading'
    ? copy.wallet.balanceLoading
    : walletStatus === 'refreshing'
      ? copy.wallet.balanceRefreshing
      : walletStatus === 'error'
        ? copy.wallet.balanceUnavailable
        : wallet
          ? copy.wallet.balanceReady
          : copy.wallet.guestBalance;

  return (
    <section className={styles.walletOverview} aria-labelledby="billing-wallet-title">
      <div className={styles.walletIntro}>
        <p className={styles.eyebrow}>{copy.title}</p>
        <h1 id="billing-wallet-title">{copy.wallet.title}</h1>
        <p>{copy.hero.subtitle}</p>
      </div>

      <div className={styles.balanceCluster}>
        <div className={styles.balanceIcon} aria-hidden="true">
          <WalletCards size={22} strokeWidth={1.8} />
        </div>
        <div className={styles.balanceValue}>
          <span>{copy.wallet.balanceLabel}</span>
          <strong data-wallet-balance>{wallet ? `$${wallet.balance.toFixed(2)}` : '—'}</strong>
          <small role="status" aria-live="polite">{balanceStatus}</small>
        </div>
        <Button
          type="button"
          size="md"
          variant="ghost"
          onClick={onRefresh}
          disabled={!canRefresh || isRefreshing}
          className={styles.refreshButton}
        >
          <RefreshCw size={16} className={isRefreshing ? styles.spinning : undefined} aria-hidden="true" />
          {copy.wallet.refreshBalance}
        </Button>
      </div>

      {stripeMode === 'test' ? <p className={styles.testMode} role="status">{copy.hero.testMode}</p> : null}
    </section>
  );
}
