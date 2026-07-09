'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import deepmerge from 'deepmerge';
import { useSearchParams } from 'next/navigation';
import { HeaderBar } from '@/components/HeaderBar';
import { AppSidebar } from '@/components/AppSidebar';
import { useHostedWalletCheckout } from '@/hooks/useHostedWalletCheckout';
import { CURRENCY_LOCALE } from '@/lib/intl';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useI18n } from '@/lib/i18n/I18nProvider';
import type { WalletCheckoutReturnTarget } from '@/lib/wallet/checkout-return';
import { BillingAuthGateModal } from './BillingAuthGateModal';
import { BillingCheckoutReturnNotice } from './BillingCheckoutReturnNotice';
import { BillingHero } from './BillingHero';
import { BillingInfoAside } from './BillingInfoAside';
import { ReceiptsPanel } from './ReceiptsPanel';
import { WalletTopupPanel } from './WalletTopupPanel';
import { useBillingCurrencyState } from '../_hooks/useBillingCurrencyState';
import { useBillingReceipts } from '../_hooks/useBillingReceipts';
import { useBillingCheckoutReturnToast } from '../_hooks/useBillingCheckoutReturnToast';
import { useBillingSessionState } from '../_hooks/useBillingSessionState';
import { useBillingTopupAnalytics } from '../_hooks/useBillingTopupAnalytics';
import { useBillingTopupQuotes } from '../_hooks/useBillingTopupQuotes';
import { useBillingTopupSelection } from '../_hooks/useBillingTopupSelection';
import { DEFAULT_BILLING_COPY, type BillingCopy } from '../_lib/billing-copy';
import { buildBillingIntentTarget, parseBillingIntent } from '../_lib/billing-intent';
import { recordCheckoutInteractionEvent } from '../_lib/checkout-interaction-events';
import { formatRateLimitMessage } from '../_lib/rate-limit-message';

const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '';
const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '';
const EMPTY_SEARCH_PARAMS = new URLSearchParams();

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
  const searchParams = useSearchParams() ?? EMPTY_SEARCH_PARAMS;
  const billingIntent = useMemo(() => parseBillingIntent(searchParams), [searchParams]);
  const walletQuoteLoading = copy.wallet.quoteLoading ?? DEFAULT_BILLING_COPY.wallet.quoteLoading;
  const walletQuoteError = copy.wallet.quoteError ?? DEFAULT_BILLING_COPY.wallet.quoteError;
  const { session, loading: authLoading } = useRequireAuth({ redirectIfLoggedOut: false });
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [expressRequested, setExpressRequested] = useState(false);
  const [checkoutReturnTarget, setCheckoutReturnTarget] = useState<WalletCheckoutReturnTarget | null>(null);
  const [toast, setToast] = useState<string | null>(null);
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
    initialTopupCents: billingIntent.amountCents,
  });
  const loginRedirectTarget = useMemo(
    () =>
      buildBillingIntentTarget({
        amountCents: selectedTopupCents,
        currency: 'USD',
      }),
    [selectedTopupCents]
  );
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
  }, [normalizedChargeCurrency, selectedTopupCents]);

  useEffect(() => {
    replayPendingTopupCancelled();
  }, [replayPendingTopupCancelled]);

  // no FX preview when using Checkout redirection

  useBillingCheckoutReturnToast({
    cancelledMessage: copy.toasts.cancelled,
    onCancelled: triggerTopupCancelled,
    onGoogleAdsConversion: triggerGoogleAdsConversion,
    onReturnTarget: setCheckoutReturnTarget,
    onToast: setToast,
    successMessage: copy.toasts.success,
  });

  const handleHostedTopupStarted = useCallback(({ amountCents, currency }: { amountCents: number; currency: string }) => {
    triggerTopupStarted(amountCents, currency);
  }, [triggerTopupStarted]);

  const handleHostedTopupFailed = useCallback(({
    amountCents,
    currency,
    reason,
  }: {
    amountCents: number;
    currency: string;
    reason: string;
  }) => {
    triggerTopupFailed(amountCents, currency, reason);
    setToast(copy.errors.topupStart);
  }, [copy.errors.topupStart, triggerTopupFailed]);

  const handleHostedRateLimited = useCallback((seconds: number | null) => {
    setToast(formatRateLimitMessage(copy.wallet.rateLimited, seconds ?? 900));
  }, [copy.wallet.rateLimited]);

  const hostedCheckout = useHostedWalletCheckout({
    accessToken: session?.access_token ?? null,
    amountCents: selectedTopupCents,
    currency: normalizedChargeCurrency,
    locale,
    source: 'billing',
    stripePromise,
    onStarted: handleHostedTopupStarted,
    onFailed: handleHostedTopupFailed,
    onRateLimited: handleHostedRateLimited,
  });

  function handleTopUp() {
    if (!session) {
      setAuthModalOpen(true);
      return;
    }
    void hostedCheckout.startCheckout();
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
            {checkoutReturnTarget ? (
              <BillingCheckoutReturnNotice
                href={checkoutReturnTarget}
                label={copy.toasts.returnToWorkspace}
              />
            ) : null}

            <section className="grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
              <WalletTopupPanel
                applyCustomAmount={applyCustomAmount}
                checkoutCaptchaError={hostedCheckout.captchaError ? copy.wallet.captchaError : null}
                checkoutCaptchaRequired={hostedCheckout.captchaRequired}
                checkoutCaptchaToken={hostedCheckout.captchaToken}
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
                handleCheckoutCaptchaError={hostedCheckout.handleCaptchaError}
                handleCheckoutCaptchaRequired={hostedCheckout.requireCaptcha}
                handleCheckoutCaptchaToken={hostedCheckout.handleCaptchaToken}
                handleCurrencyChange={handleCurrencyChange}
                handleExpressTopupFailed={handleExpressTopupFailed}
                handleExpressTopupStarted={handleExpressTopupStarted}
                handleTopUp={handleTopUp}
                isTopupStarting={hostedCheckout.isSubmitting}
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
