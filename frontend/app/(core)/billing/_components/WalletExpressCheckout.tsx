'use client';

import { useEffect, useRef, useState } from 'react';
import type {
  Stripe,
  StripeCheckout,
  StripeCheckoutExpressCheckoutElement,
  StripeCheckoutLoadActionsResult,
  StripeExpressCheckoutElementReadyEvent,
} from '@stripe/stripe-js';
import type { BillingCopy } from '../_lib/billing-copy';
import type { BillingSession } from '../_lib/billing-types';
import { buildWalletExpressCheckoutRequestKey } from '../_lib/express-checkout-session-cache';
import { formatRateLimitMessage } from '../_lib/rate-limit-message';

type StripeWithCheckoutElements = Stripe & {
  initCheckoutElementsSdk?: (options: { clientSecret: Promise<string> | string }) => StripeCheckout;
};

type CheckoutSessionResult =
  | { type: 'success'; clientSecret: string; sessionId: string | null }
  | { type: 'captcha_required'; payload: unknown }
  | { type: 'rate_limited'; payload: unknown; retryAfterSeconds: number }
  | { type: 'error'; error: string };

const EXPRESS_CHECKOUT_READY_TIMEOUT_MS = 10_000;

type WalletExpressCheckoutProps = {
  amountCents: number;
  chargeCurrency: string;
  localAmountLabel?: string | null;
  locale: string;
  captchaToken?: string | null;
  session: BillingSession;
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
    | 'rateLimited'
  >;
  onCaptchaRequired: () => void;
  onPaymentStarted: (amountCents: number) => void;
  onPaymentFailed: (amountCents: number, reason?: string) => void;
};

export function WalletExpressCheckout({
  amountCents,
  chargeCurrency,
  localAmountLabel = null,
  locale,
  captchaToken = null,
  session,
  stripePromise,
  labels,
  onCaptchaRequired,
  onPaymentStarted,
  onPaymentFailed,
}: WalletExpressCheckoutProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const confirmStartedRef = useRef(false);
  const sessionRef = useRef(session);
  const checkoutSessionCacheRef = useRef<{ clientSecret: string; key: string; sessionId: string | null } | null>(null);
  const pendingCheckoutSessionRef = useRef<{ key: string; promise: Promise<CheckoutSessionResult> } | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'unavailable' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const amountLabel = `$${(amountCents / 100).toFixed(amountCents % 100 === 0 ? 0 : 2)}`;
  const normalizedChargeCurrency = (chargeCurrency || 'USD').toUpperCase();
  const sessionUserId = session?.user?.id ?? null;

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    let cancelled = false;
    let readyTimedOut = false;
    let readyTimeoutId: number | null = null;
    let expressElement: StripeCheckoutExpressCheckoutElement | null = null;

    function clearExpressCheckoutReadyTimeout() {
      if (readyTimeoutId === null) return;
      window.clearTimeout(readyTimeoutId);
      readyTimeoutId = null;
    }

    async function mountExpressCheckout() {
      if (!sessionUserId || !stripePromise || !mountRef.current) {
        setStatus('idle');
        setMessage(null);
        return;
      }

      setStatus('loading');
      setMessage(null);
      confirmStartedRef.current = false;
      readyTimedOut = false;
      clearExpressCheckoutReadyTimeout();
      readyTimeoutId = window.setTimeout(() => {
        if (cancelled) return;
        readyTimedOut = true;
        expressElement?.destroy();
        expressElement = null;
        setStatus('unavailable');
        setMessage(labels.expressUnavailable);
      }, EXPRESS_CHECKOUT_READY_TIMEOUT_MS);
      const requestKey = buildWalletExpressCheckoutRequestKey({
        userId: sessionUserId,
        amountCents,
        currency: normalizedChargeCurrency,
        locale,
        captchaToken,
      });

      try {
        const cachedCheckoutSession = checkoutSessionCacheRef.current;
        const checkoutSessionResult =
          cachedCheckoutSession?.key === requestKey
            ? { type: 'success' as const, clientSecret: cachedCheckoutSession.clientSecret, sessionId: cachedCheckoutSession.sessionId }
            : await getCheckoutSessionResult(requestKey);

        if (readyTimedOut) return;
        if (checkoutSessionResult.type !== 'success') {
          clearExpressCheckoutReadyTimeout();
          if (checkoutSessionResult.type === 'captcha_required') {
            setStatus('unavailable');
            setMessage(null);
            onCaptchaRequired();
            return;
          }
          if (checkoutSessionResult.type === 'rate_limited') {
            setStatus('error');
            setMessage(formatRateLimitMessage(labels.rateLimited, checkoutSessionResult.retryAfterSeconds));
            return;
          }
          throw new Error(checkoutSessionResult.error);
        }

        const stripe = (await stripePromise) as StripeWithCheckoutElements | null;
        const initCheckout = stripe?.initCheckout ?? stripe?.initCheckoutElementsSdk;
        if (!stripe || !initCheckout || !mountRef.current || cancelled || readyTimedOut) {
          throw new Error('stripe_checkout_elements_unavailable');
        }

        const checkout = initCheckout.call(stripe, { clientSecret: checkoutSessionResult.clientSecret });
        const loadActionsPromise: Promise<StripeCheckoutLoadActionsResult> = checkout.loadActions();
        expressElement = checkout.createExpressCheckoutElement({
          buttonHeight: 44,
          layout: { maxColumns: 2, maxRows: 2, overflow: 'auto' },
          paymentMethodOrder: ['apple_pay', 'google_pay', 'paypal', 'link'],
          paymentMethods: {
            applePay: 'always',
            googlePay: 'auto',
            paypal: 'auto',
            link: 'auto',
            amazonPay: 'never',
            klarna: 'never',
          },
        } as Parameters<StripeCheckout['createExpressCheckoutElement']>[0]);

        expressElement.on('ready', (event: StripeExpressCheckoutElementReadyEvent) => {
          if (cancelled || readyTimedOut) return;
          clearExpressCheckoutReadyTimeout();
          const methods = event.availablePaymentMethods;
          const hasAnyMethod = Boolean(methods && Object.values(methods).some(Boolean));
          setStatus(hasAnyMethod ? 'ready' : 'unavailable');
          setMessage(hasAnyMethod ? null : labels.expressUnavailable);
        });
        expressElement.on('loaderror', (event) => {
          if (cancelled || readyTimedOut) return;
          clearExpressCheckoutReadyTimeout();
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
        if (cancelled || readyTimedOut) return;
        if (loadActionsResult.type !== 'success') {
          throw new Error(loadActionsResult.error.message);
        }
      } catch (error) {
        clearExpressCheckoutReadyTimeout();
        if (cancelled || readyTimedOut) return;
        const reason = error instanceof Error ? error.message : 'express_checkout_failed';
        console.warn('[billing] express checkout unavailable', reason);
        setStatus('error');
        setMessage(labels.expressError);
      }
    }

    async function getCheckoutSessionResult(requestKey: string): Promise<CheckoutSessionResult> {
      const pendingCheckoutSession = pendingCheckoutSessionRef.current;
      if (pendingCheckoutSession?.key === requestKey) {
        return pendingCheckoutSession.promise;
      }

      const promise = createCheckoutSessionResult();
      pendingCheckoutSessionRef.current = { key: requestKey, promise };
      const result = await promise;
      if (pendingCheckoutSessionRef.current?.key === requestKey) {
        pendingCheckoutSessionRef.current = null;
      }
      if (result.type === 'success') {
        checkoutSessionCacheRef.current = {
          key: requestKey,
          clientSecret: result.clientSecret,
          sessionId: result.sessionId,
        };
      }
      return result;
    }

    async function createCheckoutSessionResult(): Promise<CheckoutSessionResult> {
      const currentSession = sessionRef.current;
      const token = currentSession?.access_token ?? null;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;

      const response = await fetch('/api/wallet', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          amountCents,
          currency: normalizedChargeCurrency.toLowerCase(),
          mode: 'express_checkout',
          locale,
          captchaToken: captchaToken ?? undefined,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        if (payload?.captchaRequired) {
          return { type: 'captcha_required', payload };
        }
        if (response.status === 429) {
          return {
            type: 'rate_limited',
            payload,
            retryAfterSeconds: Number(payload?.retryAfterSeconds ?? 900),
          };
        }
        return { type: 'error', error: payload?.error ?? 'express_checkout_session_failed' };
      }

      const clientSecret =
        typeof payload?.clientSecret === 'string'
          ? payload.clientSecret
          : typeof payload?.client_secret === 'string'
            ? payload.client_secret
            : null;
      if (!clientSecret) {
        return { type: 'error', error: 'missing_checkout_client_secret' };
      }
      return {
        type: 'success',
        clientSecret,
        sessionId: typeof payload?.id === 'string' ? payload.id : null,
      };
    }

    void mountExpressCheckout();
    return () => {
      cancelled = true;
      clearExpressCheckoutReadyTimeout();
      expressElement?.destroy();
    };
  }, [
    amountCents,
    labels.expressError,
    labels.expressClosed,
    labels.expressUnavailable,
    labels.rateLimited,
    locale,
    captchaToken,
    normalizedChargeCurrency,
    onCaptchaRequired,
    onPaymentFailed,
    onPaymentStarted,
    sessionUserId,
    stripePromise,
  ]);

  if (!session) {
    return null;
  }

  const hideExpressElement = status === 'unavailable' || status === 'error';

  return (
    <div className="mt-4 rounded-input border border-border bg-bg p-3">
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
        className={`min-h-[44px] ${hideExpressElement ? 'hidden' : ''}`}
        aria-label={labels.expressAriaLabel}
      />
      {status === 'loading' && <p className="mt-2 text-xs text-text-secondary">{labels.expressLoading}</p>}
      {message && <p className="mt-2 text-xs text-state-warning">{message}</p>}
    </div>
  );
}
