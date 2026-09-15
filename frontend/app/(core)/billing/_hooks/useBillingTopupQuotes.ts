'use client';

import { useEffect, useRef, useState } from 'react';
import { USD_TOPUP_TIERS } from '@/config/topupTiers';
import type { BillingSession, TopupQuote } from '../_lib/billing-types';
import { useBillingRequestOwner } from './useBillingRequestOwner';

export function useBillingTopupQuotes({
  authLoading,
  session,
  normalizedChargeCurrency,
  selectedTopupCents,
  quoteErrorMessage,
}: {
  authLoading: boolean;
  session: BillingSession;
  normalizedChargeCurrency: string;
  selectedTopupCents: number;
  quoteErrorMessage: string;
}) {
  const accountId = authLoading ? null : session?.user?.id ?? null;
  const accessTokenRef = useRef(session?.access_token);
  accessTokenRef.current = session?.access_token;
  const amounts = JSON.stringify([...new Set([
    ...USD_TOPUP_TIERS.map((tier) => tier.amountCents),
    selectedTopupCents,
  ])]);
  const identity = accountId ? JSON.stringify([
    accountId, normalizedChargeCurrency, amounts,
  ]) : null;
  const { owner, requestScope, isActive } = useBillingRequestOwner(identity);
  const [state, setState] = useState<{
    owner: typeof owner;
    quotes: Record<number, TopupQuote>;
    loading: boolean;
    error: string | null;
  }>({ owner, quotes: {}, loading: Boolean(accountId), error: null });

  useEffect(() => {
    if (!accountId || !isActive()) return;
    const requestToken = requestScope.begin(accountId);

    async function loadQuotes() {
      setState({ owner, quotes: {}, loading: true, error: null });
      const token = accessTokenRef.current;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;
      try {
        const response = await fetch('/api/topup/quote', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            currency: normalizedChargeCurrency,
            amounts: JSON.parse(amounts),
          }),
        });
        const data = await response.json().catch(() => null);
        if (!response.ok || !data?.ok) {
          throw new Error(data?.error ?? 'quote_failed');
        }
        if (!isActive() || !requestScope.isCurrent(requestToken)) return;
        const mapped: Record<number, TopupQuote> = {};
        (data.quotes ?? []).forEach((entry: Record<string, unknown>) => {
          const usdAmount = Number(entry?.usdAmountCents);
          const localAmount = Number(entry?.localAmountMinor);
          const quoteCurrency = String(entry?.currency ?? normalizedChargeCurrency).toUpperCase();
          if (Number.isFinite(usdAmount) && usdAmount > 0 && Number.isFinite(localAmount)) {
            mapped[usdAmount] = { amountMinor: localAmount, currency: quoteCurrency };
          }
        });
        setState({ owner, quotes: mapped, loading: false, error: null });
      } catch (error) {
        if (isActive() && requestScope.isCurrent(requestToken)) {
          console.warn('[billing] topup quote fetch failed', error);
          setState({ owner, quotes: {}, loading: false, error: quoteErrorMessage });
        }
      }
    }

    loadQuotes();
    return () => {
      requestScope.invalidate();
    };
  }, [accountId, amounts, isActive, normalizedChargeCurrency, owner, quoteErrorMessage, requestScope]);

  return {
    topupQuotes: accountId && state.owner === owner ? state.quotes : {},
    quoteLoading: Boolean(accountId) && (state.owner !== owner || state.loading),
    quoteError: accountId && state.owner === owner ? state.error : null,
  };
}
