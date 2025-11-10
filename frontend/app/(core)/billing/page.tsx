'use client';

import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { loadStripe, type Stripe } from '@stripe/stripe-js';
import { HeaderBar } from '@/components/HeaderBar';
import { AppSidebar } from '@/components/AppSidebar';
import { FlagPill } from '@/components/FlagPill';
import { FEATURES } from '@/content/feature-flags';
import { CURRENCY_LOCALE } from '@/lib/intl';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { USD_TOPUP_TIERS } from '@/config/topupTiers';

type ReceiptItem = {
  id: number;
  type: string;
  amount_cents: number;
  currency: string;
  description: string | null;
  created_at: string;
  job_id: string | null;
  tax_amount_cents: number | null;
  discount_amount_cents: number | null;
};

type MembershipTierInfo = {
  tier: string;
  spendThresholdCents: number;
  discountPercent: number;
};

type MemberStatus = {
  tier: string;
  savingsPct: number;
  spent30?: number;
  spentToday?: number;
  mock?: boolean;
  tiers?: MembershipTierInfo[];
};

const FALLBACK_MEMBERSHIP_TIERS: MembershipTierInfo[] = [
  { tier: 'member', spendThresholdCents: 0, discountPercent: 0 },
  { tier: 'plus', spendThresholdCents: 5_000, discountPercent: 0.05 },
  { tier: 'pro', spendThresholdCents: 20_000, discountPercent: 0.1 },
];

export const dynamic = 'force-dynamic';

const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '';
const stripePromise = PUBLISHABLE_KEY ? loadStripe(PUBLISHABLE_KEY) : null;

const GOOGLE_ADS_CONVERSION_TARGET = process.env.NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_ID ?? 'AW-992154028/7oDUCMuC9rQbEKyjjNkD';
const GOOGLE_ADS_CONVERSION_CURRENCY = process.env.NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_CURRENCY ?? 'EUR';
const GOOGLE_ADS_CONVERSION_VALUE_ENV = Number(process.env.NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_VALUE ?? 1);
const GOOGLE_ADS_CONVERSION_VALUE_FALLBACK = Number.isFinite(GOOGLE_ADS_CONVERSION_VALUE_ENV) ? GOOGLE_ADS_CONVERSION_VALUE_ENV : 1;

const DEFAULT_BILLING_COPY = {
  title: 'Billing',
  hero: {
    title: 'Price before you generate.',
    subtitle: 'Pay only for what you run. Start with Starter Credits ($10). No subscription. No lock-in.',
    liveMode: 'Live Mode',
    testMode: 'Test Mode',
  },
  wallet: {
    title: 'Wallet',
    description: 'Starter Credits ($10). Top up once, then pay per render to the cent. Any unused balance stays yours.',
    addFunds: 'Add {amount}',
    quickAmount: '{amount}',
    autoTopUp: 'Enable auto top-up (optional)',
    lowBalance: 'Your balance is low. Top up to keep creating.',
    currencyLabel: 'Charge currency',
    currencyLoading: 'Detecting currencies…',
    currencyLoadError: 'Unable to load currencies. Defaulting to USD.',
    currencyDetected: 'Auto-detected {currency}',
    currencyOverride: 'Charging in {selected} (auto: {detected})',
    quoteLoading: 'Fetching live totals…',
    quoteError: 'Unable to fetch FX quotes. Amount finalized at checkout.',
  },
  membership: {
    title: 'Member Status',
    description:
      'Status is automatic — no subscription. Calculated on a rolling 30 days of spend. Status updates daily based on your last 30 days of spend.',
    defaultTier: 'Member',
    savingsChip: 'You save {percent}%',
    defaultLine: '{tier} — standard rate on every render.',
    thresholdLine: '{tier} — spend {amount} / 30 days to save {percent}% on every eligible render.',
    labels: {
      member: 'Member',
      plus: 'Plus',
      pro: 'Pro',
    },
  },
  teams: {
    title: 'For Teams',
    description: 'Shared wallet & roles. Let your team create with one balance. Set soft/hard project budgets. Daily summary by email.',
    actions: {
      invite: 'Invite teammates',
      budgets: 'Set project budgets',
    },
    note: 'Team note: On shared wallets, status applies to all members.',
    comingSoon:
      'Coming soon — unified wallets, role-based approvals, and budgeting controls. Join the beta at {email}.',
    contactEmail: 'support@maxvideoai.com',
    statusLive: 'Live',
    statusSoon: 'Coming soon',
  },
  receipts: {
    title: 'Receipts',
    subtitle: 'Itemized by engine, duration, and resolution. VAT included where applicable.',
    empty: 'No receipts yet.',
    loading: 'Loading…',
    loadMore: 'Load more',
    exportCsv: 'Export CSV',
    collapsedLabel: 'Show',
    expandedLabel: 'Hide',
    typeLabels: {
      charge: 'Charge',
      refund: 'Refund',
      topup: 'Top-up',
    },
    fields: {
      total: 'Total',
      tax: 'Tax',
      discount: 'Discount',
    },
  },
  refunds: {
    title: 'Refunds & Protections',
    points: [
      'Failed render: automatic refund.',
      'Budget control: set soft/hard limits per project.',
      'No vendor lock-in: Works with leading engines; trademarks belong to their owners.',
    ],
  },
  faq: {
    title: 'Micro-FAQ',
    entries: [
      { question: 'Do I need a subscription?', answer: 'No. Pay as you go.' },
      { question: 'Can I buy just one small render?', answer: 'Yes — funds are debited per run from your $10 Starter balance.' },
      { question: 'Will my credits expire?', answer: 'Credits don’t expire while your account remains active.' },
      { question: 'How do discounts work?', answer: 'Member status applies automatically based on your last 30 days of spend.' },
    ],
    footnote:
      'VAT included where applicable. Refunds on failed renders. “Works with” indicates compatibility; trademarks belong to their respective owners.',
  },
  toasts: {
    success: 'Payment successful. Funds added to your wallet.',
    cancelled: 'Payment cancelled. No charges applied.',
  },
  errors: {
    loadReceipts: 'Failed to load receipts',
    loadMore: 'Failed to load more receipts',
    lowBalance: 'Your balance is low. Top up to keep creating.',
    topupStart: 'Unable to start payment.',
  },
};

 type BillingCopy = Omit<typeof DEFAULT_BILLING_COPY, 'estimator'>;

export default function BillingPage() {
  const { t } = useI18n();
  const copy = t('workspace.billing', DEFAULT_BILLING_COPY) as BillingCopy;
  const walletCurrencyDetected = copy.wallet.currencyDetected ?? DEFAULT_BILLING_COPY.wallet.currencyDetected;
  const walletCurrencyOverride = copy.wallet.currencyOverride ?? DEFAULT_BILLING_COPY.wallet.currencyOverride;
  const walletCurrencyLoading = copy.wallet.currencyLoading ?? DEFAULT_BILLING_COPY.wallet.currencyLoading;
  const walletCurrencyLoadError = copy.wallet.currencyLoadError ?? DEFAULT_BILLING_COPY.wallet.currencyLoadError;
  const walletQuoteLoading = copy.wallet.quoteLoading ?? DEFAULT_BILLING_COPY.wallet.quoteLoading;
  const walletQuoteError = copy.wallet.quoteError ?? DEFAULT_BILLING_COPY.wallet.quoteError;
  const { session, loading: authLoading } = useRequireAuth();

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
  const toggleReceipts = useCallback(() => setReceiptsCollapsed((prev) => !prev), []);
  const [topupQuotes, setTopupQuotes] = useState<Record<number, { amountMinor: number; currency: string }>>({});
  const userCurrencyOverrideRef = useRef(false);
  const autoCurrencyRef = useRef('USD');
  const conversionSentRef = useRef(false);
  const normalizedChargeCurrency = (chargeCurrency || 'USD').toUpperCase();

  useEffect(() => {
    autoCurrencyRef.current = autoCurrency;
  }, [autoCurrency]);

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

  useEffect(() => {
    if (authLoading || !session) return;

    let mounted = true;
    async function load() {
      const token = session?.access_token ?? null;
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
      fetch('/api/wallet', { headers })
        .then((r) => r.json())
        .then((d) => {
          if (!mounted) return;
          setWallet(d);
          const resolvedCurrency = String(d.settlementCurrency ?? d.currency ?? 'USD').toUpperCase();
          setAutoCurrency(resolvedCurrency);
          if (!userCurrencyOverrideRef.current) {
            setChargeCurrency(resolvedCurrency);
          }
        })
        .catch(() => mounted && setWallet({ balance: 0, currency: 'USD' }));
      fetch('/api/member-status?includeTiers=1', { headers })
        .then((r) => r.json())
        .then((d) => mounted && setMember(d))
        .catch(() =>
          mounted &&
          setMember({ tier: copy.membership.defaultTier, savingsPct: 0, tiers: FALLBACK_MEMBERSHIP_TIERS })
        );

      // Load receipts first page
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
    if (authLoading || !session) return;
    let canceled = false;
    async function loadCurrencySummary() {
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
    if (!session) return;
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
            amounts: USD_TOPUP_TIERS.map((tier) => tier.amountCents),
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
  }, [session, normalizedChargeCurrency, walletQuoteError]);

  // no FX preview when using Checkout redirection

  // Detect Stripe mode for badge
  useEffect(() => {
    let mounted = true;
    fetch('/api/stripe-mode')
      .then((r) => r.json())
      .then((d) => mounted && setStripeMode(d.mode ?? 'disabled'))
      .catch(() => mounted && setStripeMode('disabled'));
    return () => {
      mounted = false;
    };
  }, [copy.toasts.cancelled, copy.toasts.success]);

  // Show toast on return from Checkout
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const url = new URL(window.location.href);
    const status = url.searchParams.get('status');
    const amountParam = url.searchParams.get('amount');
    const currencyParam = url.searchParams.get('currency');
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
      if (status) {
        url.searchParams.delete('status');
        if (amountParam) url.searchParams.delete('amount');
        if (currencyParam) url.searchParams.delete('currency');
        window.history.replaceState({}, '', url.toString());
      }
      return () => window.clearTimeout(timeout);
    }
    return undefined;
  }, [copy.toasts.success, copy.toasts.cancelled, triggerGoogleAdsConversion]);

  const handleCurrencyChange = useCallback((event: ChangeEvent<HTMLSelectElement>) => {
    const next = String(event.target.value || 'USD').toUpperCase();
    userCurrencyOverrideRef.current = true;
    setChargeCurrency(next);
  }, []);

  async function handleTopUp(amountCents: number) {
    const token = session?.access_token ?? null;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    try {
      const response = await fetch('/api/wallet', {
        method: 'POST',
        headers,
        body: JSON.stringify({ amountCents, currency: (chargeCurrency || 'USD').toLowerCase() }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error ?? 'checkout_session_failed');
      }
      const checkoutUrl = typeof payload?.url === 'string' ? payload.url : null;
      if (checkoutUrl) {
        window.location.href = checkoutUrl;
        return;
      }
      if (payload?.id && stripePromise) {
        const stripe = (await stripePromise) as Stripe | null;
        const redirectResult = await stripe?.redirectToCheckout({ sessionId: payload.id as string });
        if (!redirectResult?.error) {
          return;
        }
        console.error('[billing] redirectToCheckout error', redirectResult.error);
      }
      throw new Error('missing_checkout_target');
    } catch (error) {
      console.error('[billing] top-up failed', error);
      setToast(copy.errors.topupStart);
    }
  }

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
    const rows: string[] = ['id,type,amount,currency,description,created_at,job_id,tax_amount_cents,discount_amount_cents'];
    const toSign = (type: string, cents: number) => (type === 'charge' ? -cents : cents);
    receipts.items.forEach((r) => {
      const amt = (toSign(r.type, r.amount_cents) / 100).toFixed(2);
      rows.push(
        `${r.id},${r.type},${amt},${r.currency},"${(r.description ?? '').replaceAll('"', '""')}",${r.created_at},${r.job_id ?? ''},${r.tax_amount_cents ?? ''},${r.discount_amount_cents ?? ''}`
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
      new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZone: 'UTC',
      }),
    []
  );

  const formatMoney = (amountCents: number, currency: string) => {
    const amount = amountCents / 100;
    try {
      return new Intl.NumberFormat(CURRENCY_LOCALE, { style: 'currency', currency }).format(amount);
    } catch {
      return `${currency} ${amount.toFixed(2)}`;
    }
  };

  const formatThreshold = (amountCents: number, currency: string) => {
    const amount = amountCents / 100;
    try {
      return new Intl.NumberFormat(CURRENCY_LOCALE, {
        style: 'currency',
        currency,
        maximumFractionDigits: 0,
      }).format(amount);
    } catch {
      return `${currency} ${Math.round(amount)}`;
    }
  };

  const formatLocalAmount = useCallback((amountMinor: number, currency: string) => {
    const upper = (currency ?? 'USD').toUpperCase();
    const zeroDecimal = upper === 'JPY';
    const divisor = zeroDecimal ? 1 : 100;
    const value = amountMinor / divisor;
    try {
      return new Intl.NumberFormat(CURRENCY_LOCALE, { style: 'currency', currency: upper }).format(value);
    } catch {
      return `${upper} ${value.toFixed(zeroDecimal ? 0 : 2)}`;
    }
  }, []);


  const formatUsdAmount = (amountCents: number) => `$${(amountCents / 100).toFixed(0)}`;
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

  if (authLoading || !session) {
    return null;
  }

  const teamsLive = FEATURES.pricing.teams;

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <HeaderBar />
      <div className="flex flex-1">
        <AppSidebar />
        <main className="relative flex-1 overflow-y-auto p-5 lg:p-7">
          {toast && (
            <div className="pointer-events-none absolute left-1/2 top-3 z-50 -translate-x-1/2 transform rounded-input border border-border bg-white px-4 py-2 text-sm text-text-primary shadow-card">
              {toast}
            </div>
          )}
          <h1 className="mb-4 text-xl font-semibold text-text-primary">{copy.title}</h1>
          {/* Pricing Hero */}
          <section className="mb-6 rounded-card border border-border bg-white p-4 shadow-card">
            <h2 className="text-xl font-semibold text-text-primary">{copy.hero.title}</h2>
            <p className="mt-1 text-sm text-text-secondary">{copy.hero.subtitle}</p>
            {stripeMode !== 'disabled' && (
              <div className="mt-2">
                <span className={`rounded-full px-2 py-1 text-xs ${stripeMode==='test' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                  {stripeMode === 'test' ? copy.hero.testMode : copy.hero.liveMode}
                </span>
              </div>
            )}
          </section>

          <section className="mb-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-card border border-border bg-white p-4 shadow-card">
              <h2 className="mb-2 text-lg font-semibold text-text-primary">{copy.wallet.title}</h2>
              <p className="text-sm text-text-secondary">{copy.wallet.description}</p>
              <p className="mt-1 text-2xl font-semibold text-text-primary">${(wallet?.balance ?? 0).toFixed(2)}</p>
              <div className="mt-3 flex flex-col gap-3 text-sm text-text-secondary sm:flex-row sm:items-start sm:gap-4">
                <div className="flex flex-col gap-1 text-left">
                  <label className="text-xs font-medium text-text-secondary" htmlFor="billing-currency-select">
                    {copy.wallet.currencyLabel}
                  </label>
                  <select
                    id="billing-currency-select"
                    className="w-full rounded-input border border-border bg-bg px-3 py-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-w-[140px]"
                    value={normalizedChargeCurrency}
                    onChange={handleCurrencyChange}
                    disabled={currencyLoading}
                  >
                    {currencyOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                  <p className={`text-xs ${currencyStatusClass}`}>{currencyStatus}</p>
                </div>
                <Link href="/settings" className="rounded-input border border-border px-3 py-2 text-center text-sm hover:bg-bg">
                  {copy.wallet.autoTopUp}
                </Link>
              </div>
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                {USD_TOPUP_TIERS.map((tier) => (
                  <button
                    key={tier.id}
                    type="button"
                    onClick={() => handleTopUp(tier.amountCents)}
                    className="rounded-input border border-border px-3 py-2 text-left transition hover:bg-bg"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <span>{copy.wallet.addFunds.replace('{amount}', formatUsdAmount(tier.amountCents))}</span>
                        {topupQuotes[tier.amountCents] && normalizedChargeCurrency !== 'USD' && (
                          <span className="text-xs text-text-secondary">
                            ≈ {formatLocalAmount(topupQuotes[tier.amountCents].amountMinor, topupQuotes[tier.amountCents].currency)}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-text-secondary">Stripe</span>
                    </div>
                  </button>
                ))}
              </div>
              {quoteLoading && (
                <p className="mt-2 text-xs text-text-secondary">{walletQuoteLoading}</p>
              )}
              {quoteError && (
                <p className="mt-2 text-xs text-state-warning">{quoteError}</p>
              )}
              {(wallet?.balance ?? 0) < 2 && (
                <p className="mt-2 text-sm text-state-warning">{copy.wallet.lowBalance}</p>
              )}
            </div>
            <div className="rounded-card border border-border bg-white p-4 shadow-card">
              <h2 className="mb-2 text-lg font-semibold text-text-primary">{copy.membership.title}</h2>
              <p className="text-sm text-text-secondary">{copy.membership.description}</p>
              <div className="mt-2 flex items-center gap-2">
                <span className="rounded-full bg-bg px-2 py-1 text-xs text-text-secondary">
                  {member?.tier ?? copy.membership.defaultTier}
                </span>
                <span className="rounded-full bg-accent/10 px-2 py-1 text-xs text-accent">
                  {copy.membership.savingsChip.replace('{percent}', String(member?.savingsPct ?? 0))}
                </span>
              </div>
              <ul className="mt-3 list-disc pl-5 text-sm text-text-secondary">
                {(member?.tiers ?? FALLBACK_MEMBERSHIP_TIERS).map((tier) => {
                  const tierKey = tier.tier || 'member';
                  const labelKey = tier.tier?.toLowerCase() ?? 'member';
                  const tierLabel = copy.membership.labels[labelKey as keyof typeof copy.membership.labels] ?? copy.membership.defaultTier;
                  if (tier.spendThresholdCents <= 0) {
                    return (
                      <li key={tierKey}>{copy.membership.defaultLine.replace('{tier}', tierLabel)}</li>
                    );
                  }
                  const threshold = formatThreshold(
                    tier.spendThresholdCents,
                    (wallet?.currency ?? 'USD').toUpperCase()
                  );
                  const discountPct = Math.round(tier.discountPercent * 100);
                  return (
                    <li key={tierKey}>
                      {copy.membership.thresholdLine
                        .replace('{tier}', tierLabel)
                        .replace('{amount}', threshold)
                        .replace('{percent}', String(discountPct))}
                    </li>
                  );
                })}
              </ul>
            </div>
          </section>

          {/* For Teams (optional module) */}
          <section className="mb-6 rounded-card border border-border bg-white p-4 shadow-card">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-text-primary">{copy.teams.title}</h2>
              <FlagPill live={teamsLive} />
              <span className="sr-only">{teamsLive ? copy.teams.statusLive : copy.teams.statusSoon}</span>
            </div>
            {teamsLive ? (
              <>
                <p className="mt-1 text-sm text-text-secondary">{copy.teams.description}</p>
                <div className="mt-3 flex gap-2">
                  <button className="rounded-input border border-border bg-white px-3 py-2 text-sm hover:bg-bg">{copy.teams.actions.invite}</button>
                  <button className="rounded-input border border-border bg-white px-3 py-2 text-sm hover:bg-bg">{copy.teams.actions.budgets}</button>
                </div>
                <p className="mt-2 text-xs text-text-muted">{copy.teams.note}</p>
              </>
            ) : (
              <div className="mt-2 rounded-input border border-border bg-bg px-4 py-3 text-sm text-text-secondary">
                {copy.teams.comingSoon.replace('{email}', copy.teams.contactEmail)}{' '}
                <a className="underline underline-offset-2" href={`mailto:${copy.teams.contactEmail}`}>
                  {copy.teams.contactEmail}
                </a>
                .
              </div>
            )}
          </section>

          <section className="mb-6 rounded-card border border-border bg-white p-4 shadow-card">
              <button
                type="button"
                onClick={toggleReceipts}
                className="flex w-full items-center justify-between rounded-input border border-transparent px-2 py-2 text-left transition hover:bg-[rgba(69,112,255,0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-expanded={!receiptsCollapsed}
              >
                <div>
                  <h2 className="text-lg font-semibold text-text-primary">{copy.receipts.title}</h2>
                  <p className="text-sm text-text-secondary">{copy.receipts.subtitle}</p>
                </div>
                <div className="flex items-center gap-2 text-text-secondary">
                  <span className="text-xs uppercase tracking-wide">{receiptsCollapsed ? copy.receipts.collapsedLabel : copy.receipts.expandedLabel}</span>
                  <span
                    className={`text-3xl font-semibold leading-none transition-transform ${receiptsCollapsed ? 'rotate-0' : 'rotate-180'} text-text-primary`}
                    aria-hidden="true"
                  >
                    ▾
                  </span>
                </div>
              </button>
            {receipts.error && <p className="text-sm text-state-warning">{receipts.error}</p>}
            {!receiptsCollapsed && (
              <div className="mt-3 space-y-3">
                {receipts.items.length === 0 && !receipts.loading && (
                  <p className="text-sm text-text-secondary">{copy.receipts.empty}</p>
                )}
                {receipts.items.map((r) => {
                  const signedCents = r.type === 'charge' ? -r.amount_cents : r.amount_cents;
                  const amountDisplay = formatMoney(signedCents, r.currency);
                  const typeKey = r.type === 'charge' ? 'charge' : r.type === 'refund' ? 'refund' : 'topup';
                  const typeLabel = copy.receipts.typeLabels[typeKey as keyof typeof copy.receipts.typeLabels] ?? r.type;
                  const typeClass =
                    r.type === 'charge'
                      ? 'bg-rose-100 text-rose-700'
                      : r.type === 'refund'
                        ? 'bg-sky-100 text-sky-700'
                        : 'bg-emerald-100 text-emerald-700';
                  const amountClass = signedCents < 0 ? 'text-text-primary' : 'text-emerald-600';
                  const taxCents = Number(r.tax_amount_cents ?? 0);
                  const discountCents = Number(r.discount_amount_cents ?? 0);
                  return (
                    <article key={r.id} className="space-y-3 rounded-card border border-border bg-bg p-4 text-sm text-text-secondary">
                      <header className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-col">
                          <span className="text-xs text-text-muted" suppressHydrationWarning>
                            {dateFormatter.format(new Date(r.created_at))}
                          </span>
                          {r.job_id && <span className="text-[11px] text-text-muted">Job {r.job_id}</span>}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded-full px-2 py-1 text-[11px] font-semibold uppercase tracking-micro ${typeClass}`}>
                            {typeLabel}
                          </span>
                          <span className={`text-base font-semibold ${amountClass}`}>{amountDisplay}</span>
                        </div>
                      </header>
                      {r.description && <p className="text-xs text-text-muted">{r.description}</p>}
                      <dl className="grid gap-1 text-xs sm:text-sm">
                        <div className="flex justify-between font-semibold text-text-primary">
                          <dt>{copy.receipts.fields.total}</dt>
                          <dd>{formatMoney(r.amount_cents, r.currency)}</dd>
                        </div>
                        {taxCents > 0 && (
                          <div className="flex justify-between text-text-muted">
                            <dt>{copy.receipts.fields.tax}</dt>
                            <dd>{formatMoney(taxCents, r.currency)}</dd>
                          </div>
                        )}
                        {discountCents > 0 && (
                          <div className="flex justify-between text-text-muted">
                            <dt>{copy.receipts.fields.discount}</dt>
                            <dd>{formatMoney(-discountCents, r.currency)}</dd>
                          </div>
                        )}
                      </dl>
                    </article>
                  );
                })}
                {receipts.loading && (
                  <p className="text-sm text-text-secondary">{copy.receipts.loading}</p>
                )}
                <div className="flex items-center gap-2">
                  {receipts.nextCursor && (
                    <button onClick={loadMoreReceipts} disabled={receipts.loading} className="rounded-input border border-border bg-white px-3 py-2 text-sm hover:bg-bg disabled:opacity-60">
                      {receipts.loading ? copy.receipts.loading : copy.receipts.loadMore}
                    </button>
                  )}
                  <button onClick={exportCSV} className="ml-auto rounded-input border border-border bg-white px-3 py-2 text-sm hover:bg-bg">
                    {copy.receipts.exportCsv}
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* Refunds & Protections */}
          <section className="mb-6 rounded-card border border-border bg-white p-4 shadow-card">
            <h2 className="mb-2 text-lg font-semibold text-text-primary">{copy.refunds.title}</h2>
            <ul className="list-disc pl-5 text-sm text-text-secondary">
              {copy.refunds.points.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          </section>

          {/* Micro‑FAQ */}
          <section className="mb-6 rounded-card border border-border bg-white p-4 shadow-card">
            <h2 className="mb-2 text-lg font-semibold text-text-primary">{copy.faq.title}</h2>
            <div className="grid gap-2 text-sm text-text-secondary">
              {copy.faq.entries.map((entry, index) => (
                <p key={index}>
                  <span className="font-medium text-text-primary">{entry.question}</span> {entry.answer}
                </p>
              ))}
            </div>
            <p className="mt-3 text-xs text-text-muted">{copy.faq.footnote}</p>
          </section>

        </main>
      </div>
    </div>
  );
}
