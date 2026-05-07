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

type StripeWithCheckoutElements = Stripe & {
  initCheckoutElementsSdk?: (options: { clientSecret: Promise<string> | string }) => StripeCheckout;
};

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
            captchaToken: captchaToken ?? undefined,
          }),
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          if (payload?.captchaRequired) {
            setStatus('unavailable');
            setMessage(null);
            onCaptchaRequired();
            return;
          }
          if (response.status === 429) {
            const seconds = Number(payload?.retryAfterSeconds ?? 900);
            setStatus('error');
            setMessage(labels.rateLimited.replace('{seconds}', String(seconds)));
            return;
          }
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
    labels.rateLimited,
    locale,
    captchaToken,
    normalizedChargeCurrency,
    onCaptchaRequired,
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
