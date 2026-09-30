import { useEffect, useState } from 'react';

type CurrencyState = {
  token: string | null;
  status: 'idle' | 'loading' | 'ready';
  currency: string;
};

type QuoteState = {
  key: string;
  status: 'idle' | 'loading' | 'ready' | 'error';
  amountMinor: number | null;
};

export function useWorkspaceTopupPaymentQuote({
  accessToken,
  amountCents,
  enabled,
}: {
  accessToken: string | null;
  amountCents: number;
  enabled: boolean;
}) {
  const [currencyState, setCurrencyState] = useState<CurrencyState>({
    token: null,
    status: 'idle',
    currency: 'USD',
  });
  const [quoteState, setQuoteState] = useState<QuoteState>({
    key: '',
    status: 'idle',
    amountMinor: null,
  });

  useEffect(() => {
    if (!enabled || !accessToken) return;
    const controller = new AbortController();
    setCurrencyState({ token: accessToken, status: 'loading', currency: 'USD' });
    async function loadCurrency() {
      let currency = 'USD';
      try {
        const response = await fetch('/api/me/currency', {
          headers: { Authorization: `Bearer ${accessToken}` },
          signal: controller.signal,
        });
        const data = response.ok ? await response.json() : null;
        const preferred = String(data?.currency ?? '').toUpperCase();
        const enabledCurrencies = Array.isArray(data?.enabled) ? data.enabled.map((value: unknown) => String(value).toUpperCase()) : [];
        if (data?.ok && enabledCurrencies.includes(preferred)) currency = preferred;
      } catch {
        // USD is the original workspace checkout currency if preference lookup fails.
      }
      if (!controller.signal.aborted) {
        setCurrencyState({ token: accessToken, status: 'ready', currency });
      }
    }
    void loadCurrency();
    return () => controller.abort();
  }, [accessToken, enabled]);

  const currencyReady = !accessToken || (currencyState.token === accessToken && currencyState.status === 'ready');
  const chargeCurrency = currencyReady && accessToken ? currencyState.currency : 'USD';
  const quoteKey = `${accessToken ?? 'guest'}:${chargeCurrency}:${amountCents}`;

  useEffect(() => {
    if (!enabled || !currencyReady) return;
    const controller = new AbortController();
    setQuoteState({ key: quoteKey, status: 'loading', amountMinor: null });
    async function loadQuote() {
      try {
        const response = await fetch('/api/topup/quote', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          },
          body: JSON.stringify({ currency: chargeCurrency, amounts: [amountCents] }),
          signal: controller.signal,
        });
        const data = response.ok ? await response.json() : null;
        const match = Array.isArray(data?.quotes)
          ? data.quotes.find((entry: Record<string, unknown>) =>
              Number(entry.usdAmountCents) === amountCents && String(entry.currency).toUpperCase() === chargeCurrency)
          : null;
        const amountMinor = Number(match?.localAmountMinor);
        if (!data?.ok || !match || !Number.isFinite(amountMinor) || amountMinor <= 0) {
          throw new Error('topup_quote_unavailable');
        }
        if (!controller.signal.aborted) {
          setQuoteState({ key: quoteKey, status: 'ready', amountMinor });
        }
      } catch {
        if (!controller.signal.aborted) {
          setQuoteState({ key: quoteKey, status: 'error', amountMinor: null });
        }
      }
    }
    void loadQuote();
    return () => controller.abort();
  }, [accessToken, amountCents, chargeCurrency, currencyReady, enabled, quoteKey]);

  const currentQuote = quoteState.key === quoteKey;
  return {
    chargeCurrency,
    paymentAmountMinor: enabled && currentQuote && quoteState.status === 'ready' ? quoteState.amountMinor : null,
    quoteLoading: enabled && (!currencyReady || !currentQuote || quoteState.status === 'idle' || quoteState.status === 'loading'),
    quoteError: enabled && currencyReady && currentQuote && quoteState.status === 'error',
  };
}
