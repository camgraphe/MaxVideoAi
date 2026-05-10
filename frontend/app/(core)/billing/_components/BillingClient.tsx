'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { loadStripe, type Stripe } from '@stripe/stripe-js';
import deepmerge from 'deepmerge';
import { usePathname } from 'next/navigation';
import { HeaderBar } from '@/components/HeaderBar';
import { AppSidebar } from '@/components/AppSidebar';
import { CURRENCY_LOCALE } from '@/lib/intl';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { BillingAuthGateModal } from './BillingAuthGateModal';
import { BillingHero } from './BillingHero';
import { BillingInfoAside } from './BillingInfoAside';
import { ReceiptsPanel } from './ReceiptsPanel';
import { WalletTopupPanel } from './WalletTopupPanel';
import { useBillingCurrencyState } from '../_hooks/useBillingCurrencyState';
import { useBillingReceipts } from '../_hooks/useBillingReceipts';
import { useBillingSessionState } from '../_hooks/useBillingSessionState';
import { useBillingTopupAnalytics } from '../_hooks/useBillingTopupAnalytics';
import { useBillingTopupQuotes } from '../_hooks/useBillingTopupQuotes';
import { useBillingTopupSelection } from '../_hooks/useBillingTopupSelection';
import { DEFAULT_BILLING_COPY, type BillingCopy } from '../_lib/billing-copy';
import { recordCheckoutInteractionEvent } from '../_lib/checkout-interaction-events';
import { formatRateLimitMessage } from '../_lib/rate-limit-message';

const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '';
type LegacyCheckoutStripe = Stripe & {
  redirectToCheckout?: (params: { sessionId: string }) => Promise<{ error?: { message?: string } }>;
};

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '';

export function BillingClient() {
  const { locale, t } = useI18n();
  const rawCopy = t('workspace.billing', DEFAULT_BILLING_COPY);
  const copy = useMemo<BillingCopy>(() => {
    if (!rawCopy || typeof rawCopy !== 'object') return DEFAULT_BILLING_COPY;
    return deepmerge(DEFAULT_BILLING_COPY, rawCopy as Partial<BillingCopy>, {
      arrayMerge: (_destination, source) => source,
    });
  }, [rawCopy]);
  const stripePromise = useMemo(() => {
    if (!PUBLISHABLE_KEY) return null;
    return loadStripe(PUBLISHABLE_KEY, { locale });
  }, [locale]);
  const pathname = usePathname();
  const walletQuoteLoading = copy.wallet.quoteLoading ?? DEFAULT_BILLING_COPY.wallet.quoteLoading;
  const walletQuoteError = copy.wallet.quoteError ?? DEFAULT_BILLING_COPY.wallet.quoteError;
  const { session, loading: authLoading } = useRequireAuth({ redirectIfLoggedOut: false });
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [isTopupStarting, setIsTopupStarting] = useState(false);
  const [expressRequested, setExpressRequested] = useState(false);
  const [checkoutCaptchaRequired, setCheckoutCaptchaRequired] = useState(false);
  const [checkoutCaptchaToken, setCheckoutCaptchaToken] = useState<string | null>(null);
  const [checkoutCaptchaError, setCheckoutCaptchaError] = useState<string | null>(null);

  const [toast, setToast] = useState<string | null>(null);
  const loginRedirectTarget = pathname || '/billing';
  const billingIntlLocale = locale === 'fr' ? 'fr-FR' : locale === 'es' ? 'es-ES' : CURRENCY_LOCALE;

  const formatMoney = (amountCents: number, currency: string) => {
    const amount = amountCents / 100;
    try {
      return new Intl.NumberFormat(billingIntlLocale, { style: 'currency', currency }).format(amount);
    } catch {
      return `${currency} ${amount.toFixed(2)}`;
    }
  };

  const formatLocalAmount = useCallback((amountMinor: number, currency: string) => {
    const upper = (currency ?? 'USD').toUpperCase();
    const zeroDecimal = upper === 'JPY';
    const divisor = zeroDecimal ? 1 : 100;
    const value = amountMinor / divisor;
    try {
      return new Intl.NumberFormat(billingIntlLocale, { style: 'currency', currency: upper }).format(value);
    } catch {
      return `${upper} ${value.toFixed(zeroDecimal ? 0 : 2)}`;
    }
  }, [billingIntlLocale]);

  const formatUsdAmount = (amountCents: number) => {
    const amount = amountCents / 100;
    try {
      return new Intl.NumberFormat(billingIntlLocale, {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: amountCents % 100 === 0 ? 0 : 2,
      }).format(amount);
    } catch {
      return `$${amount.toFixed(amountCents % 100 === 0 ? 0 : 2)}`;
    }
  };
  const {
    applyDetectedCurrency,
    chargeCurrency,
    currencyLoading,
    currencyOptions,
    currencyStatus,
    currencyStatusClass,
    handleCurrencyChange,
    normalizedChargeCurrency,
  } = useBillingCurrencyState({
    authLoading,
    copy,
    session,
  });
  const { wallet, member, stripeMode } = useBillingSessionState({
    authLoading,
    session,
    onDetectedCurrency: applyDetectedCurrency,
  });
  const {
    applyCustomAmount,
    customAmountCents,
    customAmountError,
    customAmountInput,
    customAmountInputRef,
    customAmountValid,
    customCardActive,
    handlePresetSelected,
    onCustomAmountInputChange,
    openCustomAmountEditor,
    selectedTopupAmountLabel,
    selectedTopupCents,
  } = useBillingTopupSelection({
    copy,
    formatUsdAmount,
  });
  const { topupQuotes, quoteLoading, quoteError } = useBillingTopupQuotes({
    authLoading,
    session,
    normalizedChargeCurrency,
    customAmountCents,
    customAmountValid,
    quoteErrorMessage: walletQuoteError,
  });
  const {
    replayPendingTopupCancelled,
    triggerGoogleAdsConversion,
    triggerTopupCancelled,
    triggerTopupFailed,
    triggerTopupStarted,
  } = useBillingTopupAnalytics(topupQuotes);
  const {
    receipts,
    receiptsCollapsed,
    visibleReceipts,
    toggleReceipts,
    loadMoreReceipts,
    exportCSV,
  } = useBillingReceipts({
    authLoading,
    session,
    loadReceiptsError: copy.errors.loadReceipts,
    loadMoreError: copy.errors.loadMore,
  });

  useEffect(() => {
    setExpressRequested(false);
    setCheckoutCaptchaRequired(false);
    setCheckoutCaptchaToken(null);
    setCheckoutCaptchaError(null);
  }, [normalizedChargeCurrency, selectedTopupCents]);

  useEffect(() => {
    replayPendingTopupCancelled();
  }, [replayPendingTopupCancelled]);

  // no FX preview when using Checkout redirection

  // Show toast on return from Checkout
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const url = new URL(window.location.href);
    const status = url.searchParams.get('status');
    const amountParam = url.searchParams.get('amount');
    const amountCentsParam = url.searchParams.get('amountCents');
    const currencyParam = url.searchParams.get('currency');
    const checkoutSessionIdParam = url.searchParams.get('checkoutSessionId');
    const parsedAmountCents = amountCentsParam
      ? Math.max(0, Math.round(Number(amountCentsParam)))
      : amountParam
        ? Math.max(0, Math.round(Number(amountParam) * 100))
        : null;
    const parsedCurrency = String(currencyParam ?? 'USD').toUpperCase();
    if (!status) return undefined;
    const message =
      status === 'success'
        ? copy.toasts.success
        : status === 'cancelled'
          ? copy.toasts.cancelled
          : null;
    if (message) {
      setToast(message);
      const timeout = window.setTimeout(() => setToast(null), 4000);
      if (status === 'success') {
        const value = amountParam ? Number(amountParam) : undefined;
        triggerGoogleAdsConversion(value, currencyParam ?? undefined);
        if (checkoutSessionIdParam) {
          recordCheckoutInteractionEvent({
            amountCents: parsedAmountCents,
            eventName: 'hosted_checkout_success_return',
            mode: 'hosted',
            stripeCheckoutSessionId: checkoutSessionIdParam,
          });
        }
      }
      if (status === 'cancelled') {
        triggerTopupCancelled(parsedAmountCents, parsedCurrency);
        if (checkoutSessionIdParam) {
          recordCheckoutInteractionEvent({
            amountCents: parsedAmountCents,
            eventName: 'hosted_checkout_cancelled_return',
            mode: 'hosted',
            stripeCheckoutSessionId: checkoutSessionIdParam,
          });
        }
      }
      if (status) {
        url.searchParams.delete('status');
        if (amountParam) url.searchParams.delete('amount');
        if (amountCentsParam) url.searchParams.delete('amountCents');
        if (currencyParam) url.searchParams.delete('currency');
        url.searchParams.delete('settlementCurrency');
        url.searchParams.delete('topupTier');
        url.searchParams.delete('checkoutSessionId');
        window.history.replaceState({}, '', url.toString());
      }
      return () => window.clearTimeout(timeout);
    }
    return undefined;
  }, [copy.toasts.success, copy.toasts.cancelled, triggerGoogleAdsConversion, triggerTopupCancelled]);

  async function handleTopUp(amountCents: number) {
    if (!session) {
      setAuthModalOpen(true);
      return;
    }
    if (isTopupStarting) return;
    setIsTopupStarting(true);
    setCheckoutCaptchaError(null);
    recordCheckoutInteractionEvent({
      amountCents,
      eventName: 'hosted_checkout_requested',
      mode: 'hosted',
      metadata: {
        currency: normalizedChargeCurrency,
        locale,
      },
    });
    const token = session?.access_token ?? null;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    try {
      const response = await fetch('/api/wallet', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          amountCents,
          currency: (chargeCurrency || 'USD').toLowerCase(),
          locale,
          captchaToken: checkoutCaptchaToken ?? undefined,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        if (payload?.captchaRequired) {
          setCheckoutCaptchaRequired(true);
          setCheckoutCaptchaToken(null);
          return;
        }
        if (response.status === 429) {
          const seconds = Number(payload?.retryAfterSeconds ?? 900);
          setToast(formatRateLimitMessage(copy.wallet.rateLimited, seconds));
          return;
        }
        throw new Error(payload?.error ?? 'checkout_session_failed');
      }
      const checkoutUrl = typeof payload?.url === 'string' ? payload.url : null;
      const checkoutAttemptId = Number(payload?.checkoutAttemptId);
      const normalizedCheckoutAttemptId =
        Number.isFinite(checkoutAttemptId) && checkoutAttemptId > 0 ? checkoutAttemptId : null;
      const stripeCheckoutSessionId = typeof payload?.id === 'string' ? payload.id : null;
      const hasCheckoutTarget = Boolean(checkoutUrl || payload?.id);
      if (!hasCheckoutTarget) {
        throw new Error('missing_checkout_target');
      }
      setCheckoutCaptchaRequired(false);
      setCheckoutCaptchaToken(null);
      triggerTopupStarted(amountCents, normalizedChargeCurrency);
      recordCheckoutInteractionEvent({
        amountCents,
        checkoutAttemptId: normalizedCheckoutAttemptId,
        eventName: 'hosted_checkout_redirecting',
        mode: 'hosted',
        stripeCheckoutSessionId,
        metadata: {
          currency: normalizedChargeCurrency,
          redirectMethod: checkoutUrl ? 'url' : 'stripe_js',
        },
      });
      if (checkoutUrl) {
        window.location.href = checkoutUrl;
        return;
      }
      if (payload?.id && stripePromise) {
        const stripe = (await stripePromise) as LegacyCheckoutStripe | null;
        const redirectResult = await stripe?.redirectToCheckout?.({ sessionId: String(payload.id) });
        if (!redirectResult?.error) {
          return;
        }
        console.error('[billing] redirectToCheckout error', redirectResult.error);
      }
      throw new Error('missing_checkout_target');
    } catch (error) {
      console.error('[billing] top-up failed', error);
      const reason = error instanceof Error ? error.message : 'topup_failed';
      triggerTopupFailed(amountCents, normalizedChargeCurrency, reason);
      setToast(copy.errors.topupStart);
    } finally {
      setIsTopupStarting(false);
    }
  }

  const handleExpressTopupStarted = useCallback(
    (amountCents: number) => {
      triggerTopupStarted(amountCents, normalizedChargeCurrency);
    },
    [normalizedChargeCurrency, triggerTopupStarted]
  );

  const handleExpressTopupFailed = useCallback(
    (amountCents: number, reason?: string) => {
      triggerTopupFailed(amountCents, normalizedChargeCurrency, reason);
      setToast(copy.errors.topupStart);
    },
    [copy.errors.topupStart, normalizedChargeCurrency, triggerTopupFailed]
  );

  const handleCheckoutCaptchaRequired = useCallback(() => {
    setCheckoutCaptchaRequired(true);
    setCheckoutCaptchaToken(null);
    setCheckoutCaptchaError(null);
  }, []);

  const handleCheckoutCaptchaToken = useCallback((token: string | null) => {
    setCheckoutCaptchaToken(token);
    if (token) {
      setCheckoutCaptchaError(null);
    }
  }, []);

  const handleCheckoutCaptchaError = useCallback(() => {
    setCheckoutCaptchaToken(null);
    setCheckoutCaptchaError(copy.wallet.captchaError);
  }, [copy.wallet.captchaError]);

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(billingIntlLocale, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZone: 'UTC',
      }),
    [billingIntlLocale]
  );

  const selectedTopupQuote = topupQuotes[selectedTopupCents];
  const selectedTopupLocalLabel =
    selectedTopupQuote && normalizedChargeCurrency !== 'USD'
      ? `≈ ${formatLocalAmount(selectedTopupQuote.amountMinor, selectedTopupQuote.currency)}`
      : null;

  if (authLoading) {
    return null;
  }

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <HeaderBar />
      <div className="flex flex-1 min-w-0">
        <AppSidebar />
        <main className="relative flex-1 min-w-0 overflow-y-auto p-3 pb-36 sm:p-4 lg:p-7 lg:pb-10">
          {toast && (
            <div className="pointer-events-none absolute left-1/2 top-3 z-50 -translate-x-1/2 transform rounded-input border border-border bg-surface px-4 py-2 text-sm text-text-primary shadow-card">
              {toast}
            </div>
          )}
          <div className="mx-auto max-w-7xl">
            <BillingHero copy={copy} stripeMode={stripeMode} wallet={wallet} />

            <section className="grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
              <WalletTopupPanel
                applyCustomAmount={applyCustomAmount}
                checkoutCaptchaError={checkoutCaptchaError}
                checkoutCaptchaRequired={checkoutCaptchaRequired}
                checkoutCaptchaToken={checkoutCaptchaToken}
                copy={copy}
                currencyLoading={currencyLoading}
                currencyOptions={currencyOptions}
                currencyStatus={currencyStatus}
                currencyStatusClass={currencyStatusClass}
                customAmountCents={customAmountCents}
                customAmountError={customAmountError}
                customAmountInput={customAmountInput}
                customAmountInputRef={customAmountInputRef}
                customAmountValid={customAmountValid}
                customCardActive={customCardActive}
                expressRequested={expressRequested}
                formatLocalAmount={formatLocalAmount}
                formatUsdAmount={formatUsdAmount}
                handleCheckoutCaptchaError={handleCheckoutCaptchaError}
                handleCheckoutCaptchaRequired={handleCheckoutCaptchaRequired}
                handleCheckoutCaptchaToken={handleCheckoutCaptchaToken}
                handleCurrencyChange={handleCurrencyChange}
                handleExpressTopupFailed={handleExpressTopupFailed}
                handleExpressTopupStarted={handleExpressTopupStarted}
                handleTopUp={handleTopUp}
                isTopupStarting={isTopupStarting}
                locale={locale}
                normalizedChargeCurrency={normalizedChargeCurrency}
                onCustomAmountInputChange={onCustomAmountInputChange}
                onExpressReveal={() => {
                  recordCheckoutInteractionEvent({
                    amountCents: selectedTopupCents,
                    eventName: 'express_checkout_revealed',
                    mode: 'express_checkout',
                    metadata: {
                      currency: normalizedChargeCurrency,
                      locale,
                    },
                  });
                  setExpressRequested(true);
                }}
                onOpenCustomAmountEditor={openCustomAmountEditor}
                onPresetSelected={handlePresetSelected}
                quoteError={quoteError}
                quoteLoading={quoteLoading}
                selectedTopupAmountLabel={selectedTopupAmountLabel}
                selectedTopupCents={selectedTopupCents}
                selectedTopupLocalLabel={selectedTopupLocalLabel}
                session={session}
                stripePromise={stripePromise}
                topupQuotes={topupQuotes}
                turnstileSiteKey={TURNSTILE_SITE_KEY}
                wallet={wallet}
                walletQuoteLoading={walletQuoteLoading}
              />

              <BillingInfoAside copy={copy} member={member} />
            </section>

            <ReceiptsPanel
              copy={copy}
              dateFormatter={dateFormatter}
              formatMoney={formatMoney}
              onExportCsv={exportCSV}
              onLoadMoreReceipts={loadMoreReceipts}
              onToggleReceipts={toggleReceipts}
              receipts={receipts}
              receiptsCollapsed={receiptsCollapsed}
              visibleReceipts={visibleReceipts}
            />

          </div>
        </main>
      </div>
      {authModalOpen && (
        <BillingAuthGateModal
          copy={copy}
          loginRedirectTarget={loginRedirectTarget}
          onClose={() => setAuthModalOpen(false)}
        />
      )}
    </div>
  );
}
