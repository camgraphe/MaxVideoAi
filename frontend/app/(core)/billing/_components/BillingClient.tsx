'use client';

import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { loadStripe, type Stripe } from '@stripe/stripe-js';
import deepmerge from 'deepmerge';
import { usePathname } from 'next/navigation';
import { HeaderBar } from '@/components/HeaderBar';
import { AppSidebar } from '@/components/AppSidebar';
import { CURRENCY_LOCALE } from '@/lib/intl';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { USD_TOPUP_TIERS } from '@/config/topupTiers';
import {
  writeLastKnownMember,
  readLastKnownUserId,
  writeLastKnownWallet,
} from '@/lib/last-known';
import { BillingAuthGateModal } from './BillingAuthGateModal';
import { BillingHero } from './BillingHero';
import { BillingInfoAside } from './BillingInfoAside';
import { ReceiptsPanel } from './ReceiptsPanel';
import { WalletTopupPanel } from './WalletTopupPanel';
import { useBillingTopupAnalytics } from '../_hooks/useBillingTopupAnalytics';
import { DEFAULT_BILLING_COPY, type BillingCopy } from '../_lib/billing-copy';
import type { MemberStatus, ReceiptItem, TopupQuote } from '../_lib/billing-types';
import { parseAmountToCents } from '../_lib/billing-utils';

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
  const walletCurrencyDetected = copy.wallet.currencyDetected ?? DEFAULT_BILLING_COPY.wallet.currencyDetected;
  const walletCurrencyOverride = copy.wallet.currencyOverride ?? DEFAULT_BILLING_COPY.wallet.currencyOverride;
  const walletCurrencyLoading = copy.wallet.currencyLoading ?? DEFAULT_BILLING_COPY.wallet.currencyLoading;
  const walletCurrencyLoadError = copy.wallet.currencyLoadError ?? DEFAULT_BILLING_COPY.wallet.currencyLoadError;
  const walletQuoteLoading = copy.wallet.quoteLoading ?? DEFAULT_BILLING_COPY.wallet.quoteLoading;
  const walletQuoteError = copy.wallet.quoteError ?? DEFAULT_BILLING_COPY.wallet.quoteError;
  const { session, loading: authLoading } = useRequireAuth({ redirectIfLoggedOut: false });
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [isTopupStarting, setIsTopupStarting] = useState(false);
  const [expressRequested, setExpressRequested] = useState(false);
  const [checkoutCaptchaRequired, setCheckoutCaptchaRequired] = useState(false);
  const [checkoutCaptchaToken, setCheckoutCaptchaToken] = useState<string | null>(null);
  const [checkoutCaptchaError, setCheckoutCaptchaError] = useState<string | null>(null);

  const [currencyOptions, setCurrencyOptions] = useState<string[]>(['USD']);
  const [wallet, setWallet] = useState<{ balance: number; currency: string } | null>(null);
  const [member, setMember] = useState<MemberStatus | null>(null);
  const [stripeMode, setStripeMode] = useState<'test' | 'live' | 'disabled'>('disabled');
  const [toast, setToast] = useState<string | null>(null);
  const [receipts, setReceipts] = useState<{
    items: ReceiptItem[];
    nextCursor: string | null;
    loading: boolean;
    error?: string | null;
  }>({ items: [], nextCursor: null, loading: false });
  const [receiptsCollapsed, setReceiptsCollapsed] = useState(true);
  const [chargeCurrency, setChargeCurrency] = useState<string>('USD');
  const [autoCurrency, setAutoCurrency] = useState<string>('USD');
  const [currencyLoading, setCurrencyLoading] = useState(false);
  const [currencyError, setCurrencyError] = useState<string | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [customAmountInput, setCustomAmountInput] = useState('');
  const [customEditorOpen, setCustomEditorOpen] = useState(false);
  const [selectedTopupCents, setSelectedTopupCents] = useState(USD_TOPUP_TIERS[0]?.amountCents ?? 1000);
  const customAmountCents = parseAmountToCents(customAmountInput);
  const customAmountError = !customAmountInput.trim()
    ? null
    : customAmountCents == null
      ? copy.wallet.customInvalid
      : customAmountCents < 1000
        ? copy.wallet.customMin
        : null;
  const customAmountValid = customAmountCents != null && customAmountCents >= 1000;
  const toggleReceipts = useCallback(() => setReceiptsCollapsed((prev) => !prev), []);
  const [topupQuotes, setTopupQuotes] = useState<Record<number, TopupQuote>>({});
  const userCurrencyOverrideRef = useRef(false);
  const autoCurrencyRef = useRef('USD');
  const customAmountInputRef = useRef<HTMLInputElement | null>(null);
  const normalizedChargeCurrency = (chargeCurrency || 'USD').toUpperCase();
  const loginRedirectTarget = pathname || '/billing';
  const billingIntlLocale = locale === 'fr' ? 'fr-FR' : locale === 'es' ? 'es-ES' : CURRENCY_LOCALE;
  const {
    replayPendingTopupCancelled,
    triggerGoogleAdsConversion,
    triggerTopupCancelled,
    triggerTopupFailed,
    triggerTopupStarted,
  } = useBillingTopupAnalytics(topupQuotes);

  useEffect(() => {
    setExpressRequested(false);
    setCheckoutCaptchaRequired(false);
    setCheckoutCaptchaToken(null);
    setCheckoutCaptchaError(null);
  }, [normalizedChargeCurrency, selectedTopupCents]);

  useEffect(() => {
    autoCurrencyRef.current = autoCurrency;
  }, [autoCurrency]);

  useEffect(() => {
    replayPendingTopupCancelled();
  }, [replayPendingTopupCancelled]);

  useEffect(() => {
    if (authLoading) return;

    let mounted = true;
    async function load() {
      if (!session) {
        if (mounted) {
          setWallet(null);
          setReceipts({ items: [], nextCursor: null, loading: false, error: null });
        }
      }
      const token = session?.access_token ?? null;
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
      if (session) {
        fetch('/api/wallet', { headers, cache: 'no-store' })
          .then(async (r) => {
            const payload = await r.json().catch(() => null);
            if (!r.ok) {
              throw new Error(payload?.error ?? 'wallet_load_failed');
            }
            return payload;
          })
          .then((d) => {
            if (!mounted || !d) return;
            const balance = typeof d.balance === 'number' ? d.balance : null;
            if (balance === null) return;
            const currency = typeof d.currency === 'string' ? d.currency : 'USD';
            const nextWallet = { balance, currency };
            setWallet(nextWallet);
            if (session.user?.id) {
              writeLastKnownWallet(nextWallet, session.user.id ?? readLastKnownUserId());
            }
            const resolvedCurrency = String(d.settlementCurrency ?? currency ?? 'USD').toUpperCase();
            setAutoCurrency(resolvedCurrency);
            if (!userCurrencyOverrideRef.current) {
              setChargeCurrency(resolvedCurrency);
            }
          })
          .catch(() => undefined);
      }
      fetch('/api/member-status?includeTiers=1', { headers, cache: 'no-store' })
        .then(async (r) => {
          const payload = await r.json().catch(() => null);
          if (!r.ok) {
            throw new Error(payload?.error ?? 'member_status_load_failed');
          }
          return payload;
        })
        .then((d) => {
          if (!mounted || !d) return;
          if (typeof d.tier === 'string') {
            const nextMember = d as MemberStatus;
            setMember(nextMember);
            if (session?.user?.id) {
              writeLastKnownMember(
                {
                  tier: nextMember.tier,
                  spent30: nextMember.spent30,
                  spentToday: nextMember.spentToday,
                  savingsPct: nextMember.savingsPct,
                },
                session.user.id ?? readLastKnownUserId()
              );
            }
          }
        })
        .catch(() => undefined);

      // Load receipts first page
      if (!session) {
        return;
      }
      setReceipts((s) => ({ ...s, loading: true, error: null }));
      fetch('/api/receipts?limit=25', { headers })
        .then((r) => r.json())
        .then((d) => mounted && setReceipts({ items: (d.receipts ?? []) as ReceiptItem[], nextCursor: d.nextCursor ?? null, loading: false }))
        .catch(() => mounted && setReceipts({ items: [], nextCursor: null, loading: false, error: copy.errors.loadReceipts }));
    }
    load();
    return () => {
      mounted = false;
    };
  }, [authLoading, session, copy.membership.defaultTier, copy.errors.loadReceipts]);

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
        const res = await fetch('/api/topup/quote', {
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
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.ok) {
          throw new Error(data?.error ?? 'quote_failed');
        }
        if (canceled) return;
        const mapped: Record<number, { amountMinor: number; currency: string }> = {};
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
          setQuoteError(walletQuoteError);
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
  }, [authLoading, customAmountCents, customAmountValid, session, normalizedChargeCurrency, walletQuoteError]);

  // no FX preview when using Checkout redirection

  // Detect Stripe mode for badge
  useEffect(() => {
    if (authLoading) return;
    let mounted = true;
    fetch('/api/stripe-mode')
      .then((r) => r.json())
      .then((d) => mounted && setStripeMode(d.mode ?? 'disabled'))
      .catch(() => mounted && setStripeMode('disabled'));
    return () => {
      mounted = false;
    };
  }, [authLoading]);

  // Show toast on return from Checkout
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const url = new URL(window.location.href);
    const status = url.searchParams.get('status');
    const amountParam = url.searchParams.get('amount');
    const amountCentsParam = url.searchParams.get('amountCents');
    const currencyParam = url.searchParams.get('currency');
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
      }
      if (status === 'cancelled') {
        triggerTopupCancelled(parsedAmountCents, parsedCurrency);
      }
      if (status) {
        url.searchParams.delete('status');
        if (amountParam) url.searchParams.delete('amount');
        if (amountCentsParam) url.searchParams.delete('amountCents');
        if (currencyParam) url.searchParams.delete('currency');
        url.searchParams.delete('settlementCurrency');
        url.searchParams.delete('topupTier');
        window.history.replaceState({}, '', url.toString());
      }
      return () => window.clearTimeout(timeout);
    }
    return undefined;
  }, [copy.toasts.success, copy.toasts.cancelled, triggerGoogleAdsConversion, triggerTopupCancelled]);

  const handleCurrencyChange = useCallback((event: ChangeEvent<HTMLSelectElement>) => {
    const next = String(event.target.value || 'USD').toUpperCase();
    userCurrencyOverrideRef.current = true;
    setChargeCurrency(next);
  }, []);

  async function handleTopUp(amountCents: number) {
    if (!session) {
      setAuthModalOpen(true);
      return;
    }
    if (isTopupStarting) return;
    setIsTopupStarting(true);
    setCheckoutCaptchaError(null);
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
          setToast(copy.wallet.rateLimited.replace('{seconds}', String(seconds)));
          return;
        }
        throw new Error(payload?.error ?? 'checkout_session_failed');
      }
      const checkoutUrl = typeof payload?.url === 'string' ? payload.url : null;
      const hasCheckoutTarget = Boolean(checkoutUrl || payload?.id);
      if (!hasCheckoutTarget) {
        throw new Error('missing_checkout_target');
      }
      setCheckoutCaptchaRequired(false);
      setCheckoutCaptchaToken(null);
      triggerTopupStarted(amountCents, normalizedChargeCurrency);
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

  async function loadMoreReceipts() {
    if (receipts.loading || receipts.nextCursor === null) return;
    setReceipts((s) => ({ ...s, loading: true }));
    const token = session?.access_token;
    const headers: Record<string, string> | undefined = token ? { Authorization: `Bearer ${token}` } : undefined;
    const url = receipts.nextCursor ? `/api/receipts?limit=25&cursor=${encodeURIComponent(receipts.nextCursor)}` : '/api/receipts?limit=25';
    try {
      const r = await fetch(url, { headers });
      const d = await r.json();
      setReceipts((s) => ({
        ...s,
        items: [...s.items, ...((d.receipts ?? []) as ReceiptItem[])],
        nextCursor: d.nextCursor ?? null,
        loading: false,
        error: null,
      }));
    } catch {
      setReceipts((s) => ({ ...s, loading: false, error: copy.errors.loadMore }));
    }
  }

  async function exportCSV() {
    const rows: string[] = [
      'id,type,amount,currency,description,created_at,job_id,tax_amount_cents,discount_amount_cents,document_type,document_url',
    ];
    const toSign = (type: string, cents: number) => (type === 'charge' ? -cents : cents);
    receipts.items.forEach((r) => {
      const amt = (toSign(r.type, r.amount_cents) / 100).toFixed(2);
      rows.push(
        `${r.id},${r.type},${amt},${r.currency},"${(r.description ?? '').replaceAll('"', '""')}",${r.created_at},${r.job_id ?? ''},${r.tax_amount_cents ?? ''},${r.discount_amount_cents ?? ''},${r.document_type ?? ''},${r.document_url ?? ''}`
      );
    });
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'receipts.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

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
  const normalizedAutoCurrency = (autoCurrency || 'USD').toUpperCase();
  const currencyStatus = currencyError
    ? currencyError
    : currencyLoading && !userCurrencyOverrideRef.current
      ? walletCurrencyLoading
      : normalizedChargeCurrency === normalizedAutoCurrency
        ? walletCurrencyDetected.replace('{currency}', normalizedChargeCurrency)
        : walletCurrencyOverride
            .replace('{selected}', normalizedChargeCurrency)
            .replace('{detected}', normalizedAutoCurrency);
  const currencyStatusClass = currencyError ? 'text-state-warning' : 'text-text-secondary';
  const selectedPresetTier = USD_TOPUP_TIERS.find((entry) => entry.amountCents === selectedTopupCents) ?? null;
  const customAmountSelected =
    customAmountValid && selectedPresetTier == null && selectedTopupCents === customAmountCents;
  const customCardActive = customEditorOpen || customAmountSelected;
  const visibleReceipts = receiptsCollapsed ? receipts.items.slice(0, 2) : receipts.items;
  const selectedTopupAmountLabel = formatUsdAmount(selectedTopupCents);
  const selectedTopupQuote = topupQuotes[selectedTopupCents];
  const selectedTopupLocalLabel =
    selectedTopupQuote && normalizedChargeCurrency !== 'USD'
      ? `≈ ${formatLocalAmount(selectedTopupQuote.amountMinor, selectedTopupQuote.currency)}`
      : null;

  const focusCustomAmountInput = useCallback(() => {
    window.setTimeout(() => {
      customAmountInputRef.current?.focus();
      customAmountInputRef.current?.select();
    }, 0);
  }, []);

  const openCustomAmountEditor = useCallback(() => {
    setCustomEditorOpen(true);
    focusCustomAmountInput();
  }, [focusCustomAmountInput]);

  const applyCustomAmount = useCallback(() => {
    if (!customAmountValid || customAmountCents == null) return;
    setSelectedTopupCents(customAmountCents);
    setCustomEditorOpen(false);
  }, [customAmountCents, customAmountValid]);

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
                onCustomAmountInputChange={setCustomAmountInput}
                onExpressReveal={() => setExpressRequested(true)}
                onOpenCustomAmountEditor={openCustomAmountEditor}
                onPresetSelected={(amountCents) => {
                  setSelectedTopupCents(amountCents);
                  setCustomEditorOpen(false);
                }}
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
