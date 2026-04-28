'use client';

import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  loadStripe,
  type Stripe,
  type StripeCheckout,
  type StripeCheckoutExpressCheckoutElement,
  type StripeCheckoutLoadActionsResult,
  type StripeExpressCheckoutElementReadyEvent,
} from '@stripe/stripe-js';
import deepmerge from 'deepmerge';
import { usePathname } from 'next/navigation';
import { HeaderBar } from '@/components/HeaderBar';
import { AppSidebar } from '@/components/AppSidebar';
import { CURRENCY_LOCALE } from '@/lib/intl';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { USD_TOPUP_TIERS } from '@/config/topupTiers';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  writeLastKnownMember,
  readLastKnownUserId,
  writeLastKnownWallet,
} from '@/lib/last-known';

type ReceiptItem = {
  id: number;
  type: string;
  amount_cents: number;
  currency: string;
  description: string | null;
  created_at: string;
  job_id: string | null;
  surface?: string | null;
  billing_product_key?: string | null;
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
  savingsPct?: number;
  spent30?: number;
  spentToday?: number;
  mock?: boolean;
  tiers?: MembershipTierInfo[];
};

export const dynamic = 'force-dynamic';

const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '';
type LegacyCheckoutStripe = Stripe & {
  redirectToCheckout?: (params: { sessionId: string }) => Promise<{ error?: { message?: string } }>;
};

const GOOGLE_ADS_CONVERSION_TARGET = process.env.NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_ID ?? 'AW-992154028/7oDUCMuC9rQbEKyjjNkD';
const GOOGLE_ADS_CONVERSION_CURRENCY = process.env.NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_CURRENCY ?? 'EUR';
const GOOGLE_ADS_CONVERSION_VALUE_ENV = Number(process.env.NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_VALUE ?? 1);
const GOOGLE_ADS_CONVERSION_VALUE_FALLBACK = Number.isFinite(GOOGLE_ADS_CONVERSION_VALUE_ENV) ? GOOGLE_ADS_CONVERSION_VALUE_ENV : 1;
const PENDING_TOPUP_CANCELLED_STORAGE_KEY = 'mv-pending-topup-cancelled-event';

const DEFAULT_BILLING_COPY = {
  title: 'Billing',
  hero: {
    title: 'Add credits',
    subtitle: 'Choose an amount, then complete payment in secure Stripe Checkout.',
    liveMode: 'Live Mode',
    testMode: 'Test Mode',
  },
  wallet: {
    title: 'Add credits',
    description: 'Your balance pays for successful renders only. Unused credits stay in your wallet.',
    balanceLabel: 'Current balance',
    addFunds: '{amount}',
    quickAmount: '{amount}',
    selectedAmount: 'Selected amount',
    checkoutCta: 'Continue to secure Stripe Checkout · {amount}',
    checkoutNote: 'Taxes and receipt are finalized by Stripe before payment.',
    customLabel: 'Custom amount',
    customPresetLabel: 'Custom',
    customPresetHint: 'Enter amount',
    customPlaceholder: 'Minimum $10',
    customHint: 'Enter any amount from $10.',
    customCta: 'Set amount',
    customSelectCta: 'Set amount',
    customInvalid: 'Enter a valid amount.',
    customMin: 'Minimum is $10.',
    chooseAmount: 'Select',
    expressTitle: 'Fast pay options',
    expressSubtitle: 'Apple Pay, Google Pay, PayPal, and Link appear when available on this device.',
    expressLoading: 'Checking fast pay options…',
    expressUnavailable: 'Fast pay is not available in this browser.',
    expressError: 'Express checkout unavailable.',
    expressClosed: 'Fast pay window closed. No charge made.',
    expressAriaLabel: 'Express checkout',
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
    title: 'Protections',
    points: [
      'Failed renders are refunded automatically.',
      'Receipts include itemized tax and payment details.',
      'No subscription. Add credits only when you need them.',
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
    cancelled: 'Checkout closed. No charge made.',
  },
  errors: {
    loadReceipts: 'Failed to load receipts',
    loadMore: 'Failed to load more receipts',
    lowBalance: 'Your balance is low. Top up to keep creating.',
    topupStart: 'Unable to start payment.',
  },
  authGate: {
    title: 'Create an account to fund your wallet',
    body: 'You can browse Billing and inspect live pricing, but adding funds requires an account.',
    primary: 'Create account',
    secondary: 'Sign in',
    close: 'Maybe later',
  },
};

function formatReceiptSurfaceLabel(surface?: string | null): string | null {
  switch ((surface ?? '').toLowerCase()) {
    case 'video':
      return 'Video';
    case 'image':
      return 'Image';
    case 'character':
      return 'Character';
    case 'angle':
      return 'Angle';
    case 'upscale':
      return 'Upscale';
    case 'audio':
      return 'Audio';
    default:
      return null;
  }
}

function parseAmountToCents(value: string): number | null {
  if (!value) return null;
  const normalized = value.replace(',', '.').trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.round(parsed * 100);
}

type BillingCopy = Omit<typeof DEFAULT_BILLING_COPY, 'estimator'>;

type DispatchGaEventOptions = {
  maxAttempts?: number;
  retryDelayMs?: number;
};

type StripeWithCheckoutElements = Stripe & {
  initCheckoutElementsSdk?: (options: { clientSecret: Promise<string> | string }) => StripeCheckout;
};

type WalletExpressCheckoutProps = {
  amountCents: number;
  chargeCurrency: string;
  localAmountLabel?: string | null;
  locale: string;
  session: { access_token?: string | null } | null;
  stripePromise: Promise<Stripe | null> | null;
  labels: Pick<
    BillingCopy['wallet'],
    | 'selectedAmount'
    | 'expressTitle'
    | 'expressSubtitle'
    | 'expressLoading'
    | 'expressUnavailable'
    | 'expressError'
    | 'expressClosed'
    | 'expressAriaLabel'
  >;
  onPaymentStarted: (amountCents: number) => void;
  onPaymentFailed: (amountCents: number, reason?: string) => void;
};

function WalletExpressCheckout({
  amountCents,
  chargeCurrency,
  localAmountLabel = null,
  locale,
  session,
  stripePromise,
  labels,
  onPaymentStarted,
  onPaymentFailed,
}: WalletExpressCheckoutProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const confirmStartedRef = useRef(false);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'unavailable' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const amountLabel = `$${(amountCents / 100).toFixed(amountCents % 100 === 0 ? 0 : 2)}`;
  const normalizedChargeCurrency = (chargeCurrency || 'USD').toUpperCase();

  useEffect(() => {
    let cancelled = false;
    let expressElement: StripeCheckoutExpressCheckoutElement | null = null;

    async function mountExpressCheckout() {
      if (!session || !stripePromise || !mountRef.current) {
        setStatus('idle');
        setMessage(null);
        return;
      }

      setStatus('loading');
      setMessage(null);
      confirmStartedRef.current = false;
      const token = session.access_token ?? null;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;

      try {
        const response = await fetch('/api/wallet', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            amountCents,
            currency: normalizedChargeCurrency.toLowerCase(),
            mode: 'express_checkout',
            locale,
          }),
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(payload?.error ?? 'express_checkout_session_failed');
        }
        const clientSecret =
          typeof payload?.clientSecret === 'string'
            ? payload.clientSecret
            : typeof payload?.client_secret === 'string'
              ? payload.client_secret
              : null;
        if (!clientSecret) {
          throw new Error('missing_checkout_client_secret');
        }

        const stripe = (await stripePromise) as StripeWithCheckoutElements | null;
        const initCheckout = stripe?.initCheckout ?? stripe?.initCheckoutElementsSdk;
        if (!stripe || !initCheckout || !mountRef.current || cancelled) {
          throw new Error('stripe_checkout_elements_unavailable');
        }

        const checkout = initCheckout.call(stripe, { clientSecret });
        const loadActionsPromise: Promise<StripeCheckoutLoadActionsResult> = checkout.loadActions();
        expressElement = checkout.createExpressCheckoutElement({
          buttonHeight: 44,
          layout: { maxColumns: 2, maxRows: 2, overflow: 'auto' },
          paymentMethodOrder: ['apple_pay', 'google_pay', 'paypal', 'link'],
          paymentMethods: {
            applePay: 'always',
            googlePay: 'always',
            paypal: 'auto',
            link: 'auto',
            amazonPay: 'never',
            klarna: 'never',
          },
        } as Parameters<StripeCheckout['createExpressCheckoutElement']>[0]);

        expressElement.on('ready', (event: StripeExpressCheckoutElementReadyEvent) => {
          if (cancelled) return;
          const methods = event.availablePaymentMethods;
          const hasAnyMethod = Boolean(methods && Object.values(methods).some(Boolean));
          setStatus(hasAnyMethod ? 'ready' : 'unavailable');
          setMessage(hasAnyMethod ? null : labels.expressUnavailable);
        });
        expressElement.on('loaderror', (event) => {
          if (cancelled) return;
          setStatus('error');
          setMessage(event.error?.message ?? labels.expressError);
        });
        expressElement.on('cancel', () => {
          if (confirmStartedRef.current) return;
          setMessage(labels.expressClosed);
        });
        expressElement.on('confirm', async (event) => {
          confirmStartedRef.current = true;
          onPaymentStarted(amountCents);
          try {
            const loadActionsResult = await loadActionsPromise;
            if (loadActionsResult.type !== 'success') {
              throw new Error(loadActionsResult.error.message);
            }
            const result = await loadActionsResult.actions.confirm({
              expressCheckoutConfirmEvent: event,
            });
            if (result.type === 'error') {
              event.paymentFailed({ reason: 'fail', message: result.error.message });
              onPaymentFailed(amountCents, result.error.message);
              return;
            }
            const params = new URLSearchParams({
              status: 'success',
              amount: (amountCents / 100).toFixed(2),
              amountCents: String(amountCents),
              currency: 'USD',
              settlementCurrency: normalizedChargeCurrency,
            });
            window.location.href = `/billing?${params.toString()}`;
          } catch (error) {
            const reason = error instanceof Error ? error.message : 'express_checkout_failed';
            event.paymentFailed({ reason: 'fail', message: labels.expressError });
            onPaymentFailed(amountCents, reason);
            setStatus('error');
            setMessage(labels.expressError);
          }
        });

        expressElement.mount(mountRef.current);
        const loadActionsResult = await loadActionsPromise;
        if (cancelled) return;
        if (loadActionsResult.type !== 'success') {
          throw new Error(loadActionsResult.error.message);
        }
      } catch (error) {
        if (cancelled) return;
        const reason = error instanceof Error ? error.message : 'express_checkout_failed';
        console.warn('[billing] express checkout unavailable', reason);
        setStatus('error');
        setMessage(labels.expressError);
      }
    }

    void mountExpressCheckout();
    return () => {
      cancelled = true;
      expressElement?.destroy();
    };
  }, [
    amountCents,
    labels.expressError,
    labels.expressClosed,
    labels.expressUnavailable,
    locale,
    normalizedChargeCurrency,
    onPaymentFailed,
    onPaymentStarted,
    session,
    stripePromise,
  ]);

  if (!session) {
    return null;
  }

  return (
    <div className={`mt-4 rounded-input border border-border bg-bg p-3 ${status === 'unavailable' || status === 'error' ? 'hidden' : ''}`}>
      <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-text-primary">{labels.expressTitle}</p>
          <p className="mt-0.5 text-xs text-text-secondary">{labels.expressSubtitle}</p>
        </div>
        <p className="text-xs text-text-secondary">
          {labels.selectedAmount}: <span className="font-semibold text-text-primary">{amountLabel}</span>
          {localAmountLabel ? <span className="ml-1 text-text-muted">{localAmountLabel}</span> : null}
        </p>
      </div>
      <div
        ref={mountRef}
        className={`min-h-[44px] ${status === 'unavailable' || status === 'error' ? 'hidden' : ''}`}
        aria-label={labels.expressAriaLabel}
      />
      {status === 'loading' && <p className="mt-2 text-xs text-text-secondary">{labels.expressLoading}</p>}
      {message && <p className="mt-2 text-xs text-state-warning">{message}</p>}
    </div>
  );
}

export default function BillingPage() {
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
  const [topupQuotes, setTopupQuotes] = useState<Record<number, { amountMinor: number; currency: string }>>({});
  const userCurrencyOverrideRef = useRef(false);
  const autoCurrencyRef = useRef('USD');
  const conversionSentRef = useRef(false);
  const customAmountInputRef = useRef<HTMLInputElement | null>(null);
  const normalizedChargeCurrency = (chargeCurrency || 'USD').toUpperCase();
  const loginRedirectTarget = pathname || '/billing';
  const billingIntlLocale = locale === 'fr' ? 'fr-FR' : locale === 'es' ? 'es-ES' : CURRENCY_LOCALE;

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

  const dispatchGaEvent = useCallback(
    (eventName: string, payload: Record<string, unknown>, options?: DispatchGaEventOptions): Promise<boolean> => {
      if (typeof window === 'undefined') return Promise.resolve(false);
      const maxAttempts = Math.max(1, options?.maxAttempts ?? 120);
      const retryDelayMs = Math.max(100, options?.retryDelayMs ?? 500);

      return new Promise<boolean>((resolve) => {
        const send = (attempt: number) => {
          const gtag = (window as typeof window & { gtag?: (...args: unknown[]) => void }).gtag;
          if (typeof gtag === 'function') {
            gtag('event', eventName, payload);
            resolve(true);
            return;
          }
          if (attempt >= maxAttempts) {
            resolve(false);
            return;
          }
          window.setTimeout(() => send(attempt + 1), retryDelayMs);
        };
        send(0);
      });
    },
    []
  );

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

  useEffect(() => {
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
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error ?? 'checkout_session_failed');
      }
      const checkoutUrl = typeof payload?.url === 'string' ? payload.url : null;
      const hasCheckoutTarget = Boolean(checkoutUrl || payload?.id);
      if (!hasCheckoutTarget) {
        throw new Error('missing_checkout_target');
      }
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
            <div className="mb-3 flex flex-col gap-3 sm:mb-5 sm:gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">{copy.title}</p>
                <h1 className="mt-1 text-xl font-semibold text-text-primary sm:text-3xl">{copy.wallet.title}</h1>
                <p className="mt-1 max-w-2xl text-xs text-text-secondary sm:mt-2 sm:text-sm">{copy.hero.subtitle}</p>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
                <div className="rounded-input border border-border bg-surface px-3 py-2">
                  <p className="text-[11px] font-semibold uppercase tracking-micro text-text-muted">{copy.wallet.balanceLabel}</p>
                  <p className="text-base font-semibold text-text-primary">
                    {wallet ? `$${wallet.balance.toFixed(2)}` : '--'}
                  </p>
                </div>
                {stripeMode !== 'disabled' && (
                  <div className="rounded-input border border-border bg-surface px-3 py-2">
                    <p className="text-[11px] font-semibold uppercase tracking-micro text-text-muted">Stripe</p>
                    <p className={stripeMode === 'test' ? 'text-sm font-semibold text-state-warning' : 'text-sm font-semibold text-success'}>
                      {stripeMode === 'test' ? copy.hero.testMode : copy.hero.liveMode}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <section className="grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
              <div className="rounded-card border border-border bg-surface p-3 shadow-card sm:p-5">
                <div className="flex flex-col gap-2 border-b border-border pb-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4 sm:pb-4">
                  <div>
                    <h2 className="text-base font-semibold text-text-primary sm:text-lg">{copy.wallet.selectedAmount}</h2>
                    <p className="mt-1 text-xs text-text-secondary sm:text-sm">{copy.wallet.description}</p>
                  </div>
                  <div className="hidden flex-col gap-1 text-left sm:flex sm:min-w-[160px]">
                    <label className="text-xs font-medium text-text-secondary" htmlFor="billing-currency-select">
                      {copy.wallet.currencyLabel}
                    </label>
                    <select
                      id="billing-currency-select"
                      className="w-full rounded-input border border-border bg-bg px-3 py-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 sm:mt-4 sm:grid-cols-5">
                  {USD_TOPUP_TIERS.map((tier) => {
                    const isSelected = selectedTopupCents === tier.amountCents;
                    const quote = topupQuotes[tier.amountCents];
                    return (
                      <Button
                        key={tier.id}
                        type="button"
                        size="md"
                        variant="ghost"
                        aria-pressed={isSelected}
                        onClick={() => {
                          setSelectedTopupCents(tier.amountCents);
                          setCustomEditorOpen(false);
                        }}
                        className={`min-h-[58px] w-full flex-col items-start justify-between rounded-input border px-3 py-2 text-left sm:min-h-[74px] sm:py-3 ${
                          isSelected
                            ? 'border-brand bg-surface-2 text-text-primary shadow-card'
                            : 'border-border bg-bg text-text-secondary hover:border-border-hover hover:bg-surface-hover'
                        }`}
                      >
                        <span className="text-base font-semibold sm:text-lg">{copy.wallet.addFunds.replace('{amount}', formatUsdAmount(tier.amountCents))}</span>
                        {quote && normalizedChargeCurrency !== 'USD' ? (
                          <span className="text-xs font-medium text-text-muted">
                            ≈ {formatLocalAmount(quote.amountMinor, quote.currency)}
                          </span>
                        ) : (
                          <span className="text-xs font-medium text-text-muted">{isSelected ? copy.wallet.selectedAmount : copy.wallet.chooseAmount}</span>
                        )}
                      </Button>
                    );
                  })}
                  <Button
                    type="button"
                    size="md"
                    variant="ghost"
                    aria-pressed={customCardActive}
                    onClick={openCustomAmountEditor}
                    className={`col-span-2 min-h-[58px] w-full flex-col items-start justify-between rounded-input border px-3 py-2 text-left sm:col-span-1 sm:min-h-[74px] sm:py-3 ${
                      customCardActive
                        ? 'border-brand bg-surface-2 text-text-primary shadow-card'
                        : 'border-border bg-bg text-text-secondary hover:border-border-hover hover:bg-surface-hover'
                    }`}
                  >
                    <span className="text-sm font-semibold sm:text-base">{copy.wallet.customPresetLabel}</span>
                    <span className="text-xs font-medium text-text-muted">
                      {customAmountValid && customAmountCents != null
                        ? formatUsdAmount(customAmountCents)
                        : copy.wallet.customPresetHint}
                    </span>
                  </Button>
                </div>

                {customCardActive ? (
                  <div className="mt-3 rounded-input border border-border bg-bg p-3">
                    <label className="text-xs font-semibold uppercase tracking-micro text-text-muted" htmlFor="billing-custom-amount">
                      {copy.wallet.customLabel}
                    </label>
                    <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                      <div className="relative flex-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-text-muted">$</span>
                        <Input
                          ref={customAmountInputRef}
                          id="billing-custom-amount"
                          type="number"
                          min={10}
                          step={1}
                          inputMode="decimal"
                          value={customAmountInput}
                          onChange={(event) => setCustomAmountInput(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key !== 'Enter') return;
                            event.preventDefault();
                            applyCustomAmount();
                          }}
                          placeholder={copy.wallet.customPlaceholder}
                          className="bg-surface px-7"
                        />
                      </div>
                      <Button
                        type="button"
                        disabled={!customAmountValid}
                        onClick={applyCustomAmount}
                        size="md"
                        className={`px-4 ${
                          customAmountValid ? '' : 'bg-surface-disabled text-text-muted hover:bg-surface-disabled disabled:opacity-100'
                        }`}
                      >
                        {copy.wallet.customCta}
                      </Button>
                    </div>
                    <p className={`mt-2 text-xs ${customAmountError ? 'text-state-warning' : 'text-text-muted'}`}>
                      {customAmountError ?? copy.wallet.customHint}
                    </p>
                  </div>
                ) : null}

                <div className="mt-3 rounded-input border border-brand bg-surface-2 p-3 sm:mt-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">{copy.wallet.selectedAmount}</p>
                      <p className="text-xl font-semibold text-text-primary sm:text-2xl">{selectedTopupAmountLabel}</p>
                      {selectedTopupLocalLabel ? <p className="text-xs text-text-secondary">{selectedTopupLocalLabel}</p> : null}
                    </div>
                    <Button
                      type="button"
                      size="lg"
                      onClick={() => handleTopUp(selectedTopupCents)}
                      className="w-full whitespace-normal px-4 text-center leading-snug sm:w-auto sm:px-5"
                    >
                      {copy.wallet.checkoutCta.replace('{amount}', selectedTopupAmountLabel)}
                    </Button>
                  </div>
                  <p className="mt-2 text-xs text-text-secondary">{copy.wallet.checkoutNote}</p>
                </div>

                <WalletExpressCheckout
                  amountCents={selectedTopupCents}
                  chargeCurrency={normalizedChargeCurrency}
                  localAmountLabel={selectedTopupLocalLabel}
                  locale={locale}
                  session={session}
                  stripePromise={stripePromise}
                  labels={{
                    selectedAmount: copy.wallet.selectedAmount,
                    expressTitle: copy.wallet.expressTitle,
                    expressSubtitle: copy.wallet.expressSubtitle,
                    expressLoading: copy.wallet.expressLoading,
                    expressUnavailable: copy.wallet.expressUnavailable,
                    expressError: copy.wallet.expressError,
                    expressClosed: copy.wallet.expressClosed,
                    expressAriaLabel: copy.wallet.expressAriaLabel,
                  }}
                  onPaymentStarted={handleExpressTopupStarted}
                  onPaymentFailed={handleExpressTopupFailed}
                />
                <div className="mt-3 flex flex-col gap-1 text-left sm:hidden">
                  <label className="text-xs font-medium text-text-secondary" htmlFor="billing-currency-select-mobile">
                    {copy.wallet.currencyLabel}
                  </label>
                  <select
                    id="billing-currency-select-mobile"
                    className="w-full rounded-input border border-border bg-bg px-3 py-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                {quoteLoading && <p className="mt-2 text-xs text-text-secondary">{walletQuoteLoading}</p>}
                {quoteError && <p className="mt-2 text-xs text-state-warning">{quoteError}</p>}
                {wallet && wallet.balance < 2 && <p className="mt-2 text-sm text-state-warning">{copy.wallet.lowBalance}</p>}
              </div>

              <aside className="space-y-4">
                <section className="rounded-card border border-border bg-surface p-4 shadow-card">
                  <h2 className="text-lg font-semibold text-text-primary">{copy.refunds.title}</h2>
                  <ul className="mt-3 grid gap-2 text-sm text-text-secondary">
                    {copy.refunds.points.map((point) => (
                      <li key={point} className="flex gap-2">
                        <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" aria-hidden="true" />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-4 border-t border-border pt-4">
                    <h3 className="text-sm font-semibold text-text-primary">{copy.faq.title}</h3>
                    <div className="mt-2 grid gap-2 text-sm text-text-secondary">
                      {copy.faq.entries.map((entry, index) => (
                        <p key={index}>
                          <span className="font-medium text-text-primary">{entry.question}</span> {entry.answer}
                        </p>
                      ))}
                    </div>
                  </div>
                </section>

                <section className="rounded-card border border-border bg-surface p-4 shadow-card">
                  <h2 className="text-lg font-semibold text-text-primary">{copy.membership.title}</h2>
                  <p className="mt-1 text-sm text-text-secondary">{copy.membership.description}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-bg px-2 py-1 text-xs text-text-secondary">
                      {member?.tier ?? '--'}
                    </span>
                    <span className="rounded-full bg-surface-2 px-2 py-1 text-xs text-brand">
                      {typeof member?.savingsPct === 'number'
                        ? copy.membership.savingsChip.replace('{percent}', String(member.savingsPct))
                        : '--'}
                    </span>
                  </div>
                </section>
              </aside>
            </section>

            <section className="mt-5 rounded-card border border-border bg-surface p-4 shadow-card">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={toggleReceipts}
                className="w-full items-start justify-between border border-transparent px-2 py-2 text-left hover:bg-[rgba(69,112,255,0.08)]"
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
              </Button>
            {receipts.error && <p className="text-sm text-state-warning">{receipts.error}</p>}
            <div className="mt-3 stack-gap-sm">
              {visibleReceipts.length === 0 && !receipts.loading && (
                <p className="text-sm text-text-secondary">{copy.receipts.empty}</p>
              )}
              {visibleReceipts.map((r) => {
                  const signedCents = r.type === 'charge' ? -r.amount_cents : r.amount_cents;
                  const amountDisplay = formatMoney(signedCents, r.currency);
                  const typeKey = r.type === 'charge' ? 'charge' : r.type === 'refund' ? 'refund' : 'topup';
                  const typeLabel = copy.receipts.typeLabels[typeKey as keyof typeof copy.receipts.typeLabels] ?? r.type;
                  const surfaceLabel = formatReceiptSurfaceLabel(r.surface);
                  const typeClass =
                    r.type === 'charge'
                      ? 'bg-error-bg text-error'
                      : r.type === 'refund'
                        ? 'bg-sky-100 text-sky-700'
                        : 'bg-success-bg text-success';
                  const amountClass = signedCents < 0 ? 'text-text-primary' : 'text-success';
                  const taxCents = Number(r.tax_amount_cents ?? 0);
                  const discountCents = Number(r.discount_amount_cents ?? 0);
                  return (
                    <article key={r.id} className="stack-gap-sm rounded-card border border-border bg-bg p-4 text-sm text-text-secondary">
                      <header className="flex flex-wrap items-center justify-between gap-4">
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
                          {surfaceLabel ? (
                            <span className="rounded-full bg-surface-2 px-2 py-1 text-[11px] font-semibold uppercase tracking-micro text-text-secondary">
                              {surfaceLabel}
                            </span>
                          ) : null}
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
              {!receiptsCollapsed && (
                <div className="flex items-center gap-2">
                  {receipts.nextCursor && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={loadMoreReceipts}
                      disabled={receipts.loading}
                      className="border-border bg-surface px-3 text-sm hover:bg-bg"
                    >
                      {receipts.loading ? copy.receipts.loading : copy.receipts.loadMore}
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={exportCSV}
                    className="ml-auto border-border bg-surface px-3 text-sm hover:bg-bg"
                  >
                    {copy.receipts.exportCsv}
                  </Button>
                </div>
              )}
            </div>
            </section>

          </div>
        </main>
      </div>
      {authModalOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-surface-on-media-dark-40 px-4">
          <div className="absolute inset-0" role="presentation" onClick={() => setAuthModalOpen(false)} />
          <div className="relative z-10 w-full max-w-md rounded-modal border border-border bg-surface p-6 shadow-float">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <h2 className="text-base font-semibold text-text-primary">{copy.authGate.title}</h2>
                <p className="mt-2 text-sm text-text-secondary">{copy.authGate.body}</p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setAuthModalOpen(false)}
                className="rounded-full border-hairline bg-surface-glass-80 px-3 py-1.5 text-sm text-text-muted hover:bg-surface-2"
                aria-label={copy.authGate.close}
              >
                {copy.authGate.close}
              </Button>
            </div>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <ButtonLink href={`/login?next=${encodeURIComponent(loginRedirectTarget)}`} size="sm" className="px-4">
                {copy.authGate.primary}
              </ButtonLink>
              <ButtonLink
                href={`/login?mode=signin&next=${encodeURIComponent(loginRedirectTarget)}`}
                variant="outline"
                size="sm"
                className="px-4"
              >
                {copy.authGate.secondary}
              </ButtonLink>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
