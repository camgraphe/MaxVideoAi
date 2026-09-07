'use client';

import { useEffect, useState } from 'react';
import {
  readLastKnownUserId,
  writeLastKnownWallet,
} from '@/lib/last-known';
import type { BillingSession } from '../_lib/billing-types';

type BillingWallet = {
  balance: number;
  currency: string;
  hasCompletedTopUp: boolean;
};

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
  const [stripeMode, setStripeMode] = useState<'test' | 'live' | 'disabled'>('disabled');

  useEffect(() => {
    if (authLoading) return;

    let mounted = true;
    async function load() {
      if (!session && mounted) {
        setWallet(null);
      }

      const token = session?.access_token ?? null;
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
      if (session) {
        fetch('/api/wallet', { headers, cache: 'no-store' })
          .then(async (response) => {
            const payload = await response.json().catch(() => null);
            if (!response.ok) {
              throw new Error(payload?.error ?? 'wallet_load_failed');
            }
            return payload;
          })
          .then((data) => {
            if (!mounted || !data) return;
            const balance = typeof data.balance === 'number' ? data.balance : null;
            if (balance === null) return;
            const currency = typeof data.currency === 'string' ? data.currency : 'USD';
            const hasCompletedTopUp = data.hasCompletedTopUp === true;
            const nextWallet = { balance, currency, hasCompletedTopUp };
            setWallet(nextWallet);
            if (session.user?.id) {
              writeLastKnownWallet(nextWallet, session.user.id ?? readLastKnownUserId());
            }
            const resolvedCurrency = String(data.settlementCurrency ?? currency ?? 'USD').toUpperCase();
            onDetectedCurrency(resolvedCurrency);
          })
          .catch(() => undefined);
      }


    }

    load();
    return () => {
      mounted = false;
    };
  }, [authLoading, onDetectedCurrency, session]);

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
    stripeMode,
  };
}
