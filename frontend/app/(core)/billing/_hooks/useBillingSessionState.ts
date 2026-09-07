'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  readLastKnownUserId,
  writeLastKnownWallet,
} from '@/lib/last-known';
import type { BillingSession } from '../_lib/billing-types';
import { createBillingRequestScope } from '../_lib/billing-request-scope';

type BillingWallet = {
  balance: number;
  currency: string;
  hasCompletedTopUp: boolean;
};

export type BillingWalletStatus = 'idle' | 'loading' | 'ready' | 'refreshing' | 'error';

export function useBillingSessionState({
  authLoading,
  session,
  onDetectedCurrency,
}: {
  authLoading: boolean;
  session: BillingSession;
  onDetectedCurrency: (currency: string) => void;
}) {
  const [wallet, setWallet] = useState<BillingWallet | null>(null);
  const [walletStatus, setWalletStatus] = useState<BillingWalletStatus>('idle');
  const [walletError, setWalletError] = useState<string | null>(null);
  const [stripeMode, setStripeMode] = useState<'test' | 'live' | 'disabled'>('disabled');
  const walletRequestScopeRef = useRef(createBillingRequestScope());
  const activeAccountIdRef = useRef<string | null>(null);

  const accountId = session?.user?.id ?? null;
  const accessToken = session?.access_token ?? null;

  const refreshWallet = useCallback(async (): Promise<boolean> => {
    if (!accountId) {
      walletRequestScopeRef.current.invalidate();
      setWallet(null);
      setWalletStatus('idle');
      setWalletError(null);
      return false;
    }

    const requestToken = walletRequestScopeRef.current.begin(accountId);
    setWalletStatus((current) => current === 'ready' || current === 'refreshing' ? 'refreshing' : 'loading');
    setWalletError(null);
    const headers = accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined;

    try {
      const response = await fetch('/api/wallet', { headers, cache: 'no-store' });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error ?? 'wallet_load_failed');
      }
      if (!walletRequestScopeRef.current.isCurrent(requestToken)) return false;
      const balance = typeof data?.balance === 'number' ? data.balance : null;
      if (balance === null) throw new Error('wallet_balance_missing');
      const currency = typeof data.currency === 'string' ? data.currency : 'USD';
      const nextWallet = {
        balance,
        currency,
        hasCompletedTopUp: data.hasCompletedTopUp === true,
      };
      setWallet(nextWallet);
      setWalletStatus('ready');
      if (accountId) {
        writeLastKnownWallet(nextWallet, accountId ?? readLastKnownUserId());
      }
      onDetectedCurrency(String(data.settlementCurrency ?? currency).toUpperCase());
      return true;
    } catch (error) {
      if (!walletRequestScopeRef.current.isCurrent(requestToken)) return false;
      setWalletError(error instanceof Error ? error.message : 'wallet_load_failed');
      setWalletStatus('error');
      return false;
    }
  }, [accessToken, accountId, onDetectedCurrency]);

  useEffect(() => {
    if (authLoading) return;
    if (activeAccountIdRef.current !== accountId) {
      walletRequestScopeRef.current.invalidate();
      activeAccountIdRef.current = accountId;
      setWallet(null);
      setWalletError(null);
      setWalletStatus(accountId ? 'loading' : 'idle');
    }
    if (accountId) {
      void refreshWallet();
    }
  }, [accountId, authLoading, refreshWallet]);

  useEffect(() => () => walletRequestScopeRef.current.invalidate(), []);

  useEffect(() => {
    if (authLoading) return;
    let mounted = true;
    fetch('/api/stripe-mode')
      .then((response) => response.json())
      .then((data) => mounted && setStripeMode(data.mode ?? 'disabled'))
      .catch(() => mounted && setStripeMode('disabled'));
    return () => {
      mounted = false;
    };
  }, [authLoading]);

  return {
    wallet,
    walletError,
    walletStatus,
    refreshWallet,
    stripeMode,
  };
}
