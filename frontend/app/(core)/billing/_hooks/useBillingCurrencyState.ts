'use client';

import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import type { BillingSession } from '../_lib/billing-types';
import { DEFAULT_BILLING_COPY, type BillingCopy } from '../_lib/billing-copy';

type UseBillingCurrencyStateOptions = {
  authLoading: boolean;
  copy: BillingCopy;
  session: BillingSession;
};

export function useBillingCurrencyState({ authLoading, copy, session }: UseBillingCurrencyStateOptions) {
  const walletCurrencyDetected = copy.wallet.currencyDetected ?? DEFAULT_BILLING_COPY.wallet.currencyDetected;
  const walletCurrencyOverride = copy.wallet.currencyOverride ?? DEFAULT_BILLING_COPY.wallet.currencyOverride;
  const walletCurrencyLoading = copy.wallet.currencyLoading ?? DEFAULT_BILLING_COPY.wallet.currencyLoading;
  const walletCurrencyLoadError = copy.wallet.currencyLoadError ?? DEFAULT_BILLING_COPY.wallet.currencyLoadError;
  const [currencyOptions, setCurrencyOptions] = useState<string[]>(['USD']);
  const [chargeCurrency, setChargeCurrency] = useState<string>('USD');
  const [autoCurrency, setAutoCurrency] = useState<string>('USD');
  const [currencyLoading, setCurrencyLoading] = useState(false);
  const [currencyError, setCurrencyError] = useState<string | null>(null);
  const userCurrencyOverrideRef = useRef(false);
  const autoCurrencyRef = useRef('USD');
  const normalizedChargeCurrency = (chargeCurrency || 'USD').toUpperCase();
  const normalizedAutoCurrency = (autoCurrency || 'USD').toUpperCase();

  const applyDetectedCurrency = useCallback((currency: string) => {
    const resolvedCurrency = String(currency || 'USD').toUpperCase();
    setAutoCurrency(resolvedCurrency);
    if (!userCurrencyOverrideRef.current) {
      setChargeCurrency(resolvedCurrency);
    }
  }, []);

  useEffect(() => {
    autoCurrencyRef.current = autoCurrency;
  }, [autoCurrency]);

  useEffect(() => {
    if (authLoading) return;
    let canceled = false;
    async function loadCurrencySummary() {
      if (!session) {
        setCurrencyOptions(['USD']);
        if (!userCurrencyOverrideRef.current) {
          setChargeCurrency((autoCurrencyRef.current || 'USD').toUpperCase());
        }
        return;
      }
      setCurrencyLoading(true);
      setCurrencyError(null);
      const token = session?.access_token ?? null;
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
      try {
        const res = await fetch('/api/me/currency', { headers });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.ok) {
          throw new Error(data?.error ?? 'currency_summary_failed');
        }
        if (canceled) return;
        const enabled = Array.isArray(data.enabled) && data.enabled.length ? data.enabled : ['USD'];
        const normalized = enabled.map((code: string) => String(code ?? 'USD').toUpperCase());
        setCurrencyOptions(normalized);
        if (!userCurrencyOverrideRef.current) {
          const preferred = String(data.currency ?? data.defaultCurrency ?? autoCurrencyRef.current ?? 'USD').toUpperCase();
          setChargeCurrency(preferred);
        }
      } catch (error) {
        console.warn('[billing] currency summary load failed', error);
        if (!canceled) {
          setCurrencyError(walletCurrencyLoadError);
        }
      } finally {
        if (!canceled) {
          setCurrencyLoading(false);
        }
      }
    }
    loadCurrencySummary();
    return () => {
      canceled = true;
    };
  }, [authLoading, session, walletCurrencyLoadError]);

  const handleCurrencyChange = useCallback((event: ChangeEvent<HTMLSelectElement>) => {
    const next = String(event.target.value || 'USD').toUpperCase();
    userCurrencyOverrideRef.current = true;
    setChargeCurrency(next);
  }, []);

  const currencyStatus = currencyError
    ? currencyError
    : currencyLoading && !userCurrencyOverrideRef.current
      ? walletCurrencyLoading
      : normalizedChargeCurrency === normalizedAutoCurrency
        ? walletCurrencyDetected.replace('{currency}', normalizedChargeCurrency)
        : walletCurrencyOverride
            .replace('{selected}', normalizedChargeCurrency)
            .replace('{detected}', normalizedAutoCurrency);

  return {
    applyDetectedCurrency,
    chargeCurrency,
    currencyLoading,
    currencyOptions,
    currencyStatus,
    currencyStatusClass: currencyError ? 'text-state-warning' : 'text-text-secondary',
    handleCurrencyChange,
    normalizedChargeCurrency,
  };
}
