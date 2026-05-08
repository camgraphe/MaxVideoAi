'use client';

import { useEffect, useState } from 'react';
import { USD_TOPUP_TIERS } from '@/config/topupTiers';
import type { BillingSession, TopupQuote } from '../_lib/billing-types';

export function useBillingTopupQuotes({
  authLoading,
  session,
  normalizedChargeCurrency,
  customAmountCents,
  customAmountValid,
  quoteErrorMessage,
}: {
  authLoading: boolean;
  session: BillingSession;
  normalizedChargeCurrency: string;
  customAmountCents: number | null;
  customAmountValid: boolean;
  quoteErrorMessage: string;
}) {
  const [topupQuotes, setTopupQuotes] = useState<Record<number, TopupQuote>>({});
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    let canceled = false;

    async function loadQuotes() {
      setQuoteLoading(true);
      setQuoteError(null);
      const token = session?.access_token ?? null;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;
      try {
        const response = await fetch('/api/topup/quote', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            currency: normalizedChargeCurrency,
            amounts: [
              ...USD_TOPUP_TIERS.map((tier) => tier.amountCents),
              ...(customAmountValid && customAmountCents != null ? [customAmountCents] : []),
            ],
          }),
        });
        const data = await response.json().catch(() => null);
        if (!response.ok || !data?.ok) {
          throw new Error(data?.error ?? 'quote_failed');
        }
        if (canceled) return;
        const mapped: Record<number, TopupQuote> = {};
        (data.quotes ?? []).forEach((entry: Record<string, unknown>) => {
          const usdAmount = Number(entry?.usdAmountCents);
          const localAmount = Number(entry?.localAmountMinor);
          const quoteCurrency = String(entry?.currency ?? normalizedChargeCurrency).toUpperCase();
          if (Number.isFinite(usdAmount) && usdAmount > 0 && Number.isFinite(localAmount)) {
            mapped[usdAmount] = { amountMinor: localAmount, currency: quoteCurrency };
          }
        });
        setTopupQuotes(mapped);
      } catch (error) {
        if (!canceled) {
          console.warn('[billing] topup quote fetch failed', error);
          setTopupQuotes({});
          setQuoteError(quoteErrorMessage);
        }
      } finally {
        if (!canceled) {
          setQuoteLoading(false);
        }
      }
    }

    loadQuotes();
    return () => {
      canceled = true;
    };
  }, [authLoading, customAmountCents, customAmountValid, normalizedChargeCurrency, quoteErrorMessage, session]);

  return {
    topupQuotes,
    quoteLoading,
    quoteError,
  };
}
