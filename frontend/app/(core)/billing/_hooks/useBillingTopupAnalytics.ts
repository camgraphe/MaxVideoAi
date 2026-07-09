'use client';

import { useCallback, useRef } from 'react';
import { USD_TOPUP_TIERS } from '@/config/topupTiers';
import { dispatchGaEvent } from '@/lib/analytics/ga-events';
import type { TopupQuote } from '../_lib/billing-types';

const GOOGLE_ADS_CONVERSION_TARGET = process.env.NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_ID ?? 'AW-992154028/7oDUCMuC9rQbEKyjjNkD';
const GOOGLE_ADS_CONVERSION_CURRENCY = process.env.NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_CURRENCY ?? 'EUR';
const GOOGLE_ADS_CONVERSION_VALUE_ENV = Number(process.env.NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_VALUE ?? 1);
const GOOGLE_ADS_CONVERSION_VALUE_FALLBACK = Number.isFinite(GOOGLE_ADS_CONVERSION_VALUE_ENV) ? GOOGLE_ADS_CONVERSION_VALUE_ENV : 1;
const PENDING_TOPUP_CANCELLED_STORAGE_KEY = 'mv-pending-topup-cancelled-event';

export function useBillingTopupAnalytics(topupQuotes: Record<number, TopupQuote>) {
  const conversionSentRef = useRef(false);

  const triggerGoogleAdsConversion = useCallback((value?: number, currency?: string) => {
    if (typeof window === 'undefined') return;
    if (!GOOGLE_ADS_CONVERSION_TARGET) return;
    if (conversionSentRef.current) return;
    conversionSentRef.current = true;

    const normalizedValue = typeof value === 'number' && Number.isFinite(value) ? value : GOOGLE_ADS_CONVERSION_VALUE_FALLBACK;
    const payload = {
      send_to: GOOGLE_ADS_CONVERSION_TARGET,
      value: normalizedValue,
      currency: currency ?? GOOGLE_ADS_CONVERSION_CURRENCY,
    };

    const dispatch = (attempt: number) => {
      const gtag = (window as typeof window & { gtag?: (...args: unknown[]) => void }).gtag;
      if (typeof gtag === 'function') {
        gtag('event', 'conversion', payload);
        return;
      }
      if (attempt >= 20) return;
      window.setTimeout(() => dispatch(attempt + 1), 200);
    };

    dispatch(0);
  }, []);

  const persistPendingTopupCancelled = useCallback((payload: Record<string, unknown>) => {
    if (typeof window === 'undefined') return;
    try {
      window.sessionStorage.setItem(PENDING_TOPUP_CANCELLED_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // ignore storage failures
    }
  }, []);

  const clearPendingTopupCancelled = useCallback(() => {
    if (typeof window === 'undefined') return;
    try {
      window.sessionStorage.removeItem(PENDING_TOPUP_CANCELLED_STORAGE_KEY);
    } catch {
      // ignore storage failures
    }
  }, []);

  const buildTopupAnalyticsPayload = useCallback(
    (amountCents: number | null | undefined, chargeCurrency: string): Record<string, unknown> => {
      const normalizedChargeCurrency = (chargeCurrency || 'USD').toUpperCase();
      const normalizedAmount = Number.isFinite(amountCents) ? Math.max(0, Math.round(Number(amountCents))) : 0;
      const payload: Record<string, unknown> = {
        route_family: 'billing',
        payment_provider: 'stripe',
        payment_flow: 'checkout',
        charge_currency: normalizedChargeCurrency,
        wallet_amount_usd: normalizedAmount > 0 ? normalizedAmount / 100 : undefined,
        wallet_amount_cents: normalizedAmount > 0 ? normalizedAmount : undefined,
        credits_amount: normalizedAmount > 0 ? normalizedAmount / 100 : undefined,
      };
      if (normalizedAmount <= 0) {
        return payload;
      }
      const tier = USD_TOPUP_TIERS.find((entry) => entry.amountCents === normalizedAmount);
      const quote = topupQuotes[normalizedAmount];
      payload.topup_amount_usd = normalizedAmount / 100;
      payload.topup_amount_cents = normalizedAmount;
      payload.topup_tier_id = tier?.id ?? 'custom';
      payload.topup_tier_label = tier?.label ?? 'Custom';
      payload.settlement_currency = quote?.currency ?? normalizedChargeCurrency;
      payload.settlement_amount_minor = quote?.amountMinor ?? undefined;
      if (quote?.currency && typeof quote.amountMinor === 'number' && Number.isFinite(quote.amountMinor)) {
        payload.value = quote.amountMinor / 100;
        payload.currency = quote.currency;
      }
      return payload;
    },
    [topupQuotes]
  );

  const triggerTopupStarted = useCallback(
    (amountCents: number, chargeCurrency: string) => {
      const payload = buildTopupAnalyticsPayload(amountCents, chargeCurrency);
      void dispatchGaEvent('topup_started', payload);
      void dispatchGaEvent('topup_checkout_opened', payload);
    },
    [buildTopupAnalyticsPayload, dispatchGaEvent]
  );

  const triggerTopupFailed = useCallback(
    (amountCents: number | null | undefined, chargeCurrency: string, reason?: string) => {
      const payload = buildTopupAnalyticsPayload(amountCents, chargeCurrency);
      if (reason) {
        payload.error_message = String(reason).slice(0, 120);
      }
      void dispatchGaEvent('topup_failed', payload);
    },
    [buildTopupAnalyticsPayload, dispatchGaEvent]
  );

  const triggerTopupCancelled = useCallback(
    (amountCents: number | null | undefined, chargeCurrency: string) => {
      const payload = buildTopupAnalyticsPayload(amountCents, chargeCurrency);
      persistPendingTopupCancelled(payload);
      void dispatchGaEvent('topup_cancelled', payload, { maxAttempts: 180, retryDelayMs: 500 }).then((sent) => {
        if (sent) {
          clearPendingTopupCancelled();
        }
      });
    },
    [buildTopupAnalyticsPayload, clearPendingTopupCancelled, dispatchGaEvent, persistPendingTopupCancelled]
  );

  const replayPendingTopupCancelled = useCallback(() => {
    if (typeof window === 'undefined') return;
    let parsedPayload: Record<string, unknown> | null = null;
    try {
      const raw = window.sessionStorage.getItem(PENDING_TOPUP_CANCELLED_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as unknown;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return;
      parsedPayload = parsed as Record<string, unknown>;
    } catch {
      return;
    }
    if (!parsedPayload) return;
    void dispatchGaEvent('topup_cancelled', parsedPayload, { maxAttempts: 180, retryDelayMs: 500 }).then((sent) => {
      if (sent) {
        clearPendingTopupCancelled();
      }
    });
  }, [clearPendingTopupCancelled, dispatchGaEvent]);

  return {
    replayPendingTopupCancelled,
    triggerGoogleAdsConversion,
    triggerTopupCancelled,
    triggerTopupFailed,
    triggerTopupStarted,
  };
}
