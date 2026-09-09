'use client';

import { useCallback, useEffect, useState } from 'react';
import { writeLastKnownWallet } from '@/lib/last-known';
import type { BillingSession } from '../_lib/billing-types';
import { useBillingRequestOwner } from './useBillingRequestOwner';

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
  const accountId = authLoading ? null : session?.user?.id ?? null;
  const accessToken = session?.access_token ?? null;
  const { owner, requestScope, isActive } = useBillingRequestOwner(accountId);
  const [state, setState] = useState<{
    owner: typeof owner;
    wallet: BillingWallet | null;
    status: BillingWalletStatus;
    error: string | null;
  }>({ owner, wallet: null, status: 'idle', error: null });
  const [stripeMode, setStripeMode] = useState<'test' | 'live' | 'disabled'>('disabled');
  const wallet = accountId && state.owner === owner ? state.wallet : null;

  const refreshWallet = useCallback(async (): Promise<boolean> => {
    if (!isActive() || !accountId) return false;
    const requestToken = requestScope.begin(accountId);
    setState((current) => ({
      owner,
      wallet: current.owner === owner ? current.wallet : null,
      status: current.owner === owner && current.wallet ? 'refreshing' : 'loading',
      error: null,
    }));
    const headers = accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined;

    try {
      const response = await fetch('/api/wallet', { headers, cache: 'no-store' });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error ?? 'wallet_load_failed');
      }
      if (!isActive() || !requestScope.isCurrent(requestToken)) return false;
      const balance = typeof data?.balance === 'number' ? data.balance : null;
      if (balance === null) throw new Error('wallet_balance_missing');
      const currency = typeof data.currency === 'string' ? data.currency : 'USD';
      const nextWallet = {
        balance,
        currency,
        hasCompletedTopUp: data.hasCompletedTopUp === true,
      };
      setState({ owner, wallet: nextWallet, status: 'ready', error: null });
      writeLastKnownWallet(nextWallet, accountId);
      onDetectedCurrency(String(data.settlementCurrency ?? currency).toUpperCase());
      return true;
    } catch (error) {
      if (!isActive() || !requestScope.isCurrent(requestToken)) return false;
      setState((current) => ({ ...current, status: 'error', error: error instanceof Error ? error.message : 'wallet_load_failed' }));
      return false;
    }
  }, [accessToken, accountId, isActive, onDetectedCurrency, owner, requestScope]);

  useEffect(() => {
    if (accountId) void refreshWallet();
  }, [accountId, refreshWallet]);

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

  const walletStatus: BillingWalletStatus = accountId
    ? state.owner === owner ? state.status : 'loading'
    : 'idle';

  return {
    wallet,
    walletError: accountId && state.owner === owner ? state.error : null,
    walletStatus,
    refreshWallet,
    stripeMode,
  };
}
