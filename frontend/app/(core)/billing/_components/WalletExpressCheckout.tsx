'use client';

import { useEffect, useRef, useState } from 'react';
import type {
  Stripe,
  StripeCheckout,
  StripeCheckoutExpressCheckoutElement,
  StripeCheckoutLoadActionsResult,
  StripeExpressCheckoutElementReadyEvent,
} from '@stripe/stripe-js';
import {
  ANALYTICS_CONSENT_STORAGE_KEY,
  analyticsConsentFromUpdateEvent,
  hasAnalyticsConsentCookieInBrowser,
} from '@/lib/analytics/consent-client';
import { readGa4CheckoutContext } from '@/lib/analytics/ga-session-browser';
import { readWalletAnalyticsJourney } from '@/lib/analytics/journey-browser';
import {
  walletAnalyticsJourneyCacheKey,
  type WalletAnalyticsJourney,
} from '@/lib/analytics/journey-contract';
import type { BillingCopy } from '../_lib/billing-copy';
import type { BillingSession } from '../_lib/billing-types';
import { recordCheckoutInteractionEvent } from '../_lib/checkout-interaction-events';
import { buildWalletExpressCheckoutRequestKey, createWalletExpressSessionCache } from '../_lib/express-checkout-session-cache';
import { formatRateLimitMessage } from '../_lib/rate-limit-message';

type StripeWithCheckoutElements = Stripe & {
  initCheckoutElementsSdk?: (options: { clientSecret: Promise<string> | string }) => StripeCheckout;
};

type CheckoutSessionResult =
  | { type: 'success'; checkoutAttemptId: number | null; clientSecret: string; sessionId: string | null; expiresAt?: number }
  | { type: 'captcha_required'; payload: unknown }
  | { type: 'rate_limited'; payload: unknown; retryAfterSeconds: number }
  | { type: 'error'; error: string };

const EXPRESS_CHECKOUT_READY_TIMEOUT_MS = 10_000;

type WalletExpressCheckoutProps = {
  enabled: boolean;
  amountCents: number;
  chargeCurrency: string;
  locale: string;
  captchaToken?: string | null;
  session: BillingSession;
  stripePromise: Promise<Stripe | null> | null;
  labels: Pick<
    BillingCopy['wallet'],
    | 'expressTitle'
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
  enabled,
  amountCents,
  chargeCurrency,
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
  const captchaTokenRef = useRef(captchaToken);
  const awaitingCaptchaRef = useRef(false);
  const [captchaRetry, setCaptchaRetry] = useState(0);
  useEffect(() => {
    captchaTokenRef.current = captchaToken;
    if (captchaToken && awaitingCaptchaRef.current) {
      awaitingCaptchaRef.current = false;
      setCaptchaRetry((value) => value + 1);
    }
  }, [captchaToken]);
  const labelsRef = useRef(labels);
  const handlersRef = useRef({
    onCaptchaRequired,
    onPaymentFailed,
    onPaymentStarted,
  });
  const checkoutSessionCacheRef = useRef(createWalletExpressSessionCache());
  const pendingCheckoutSessionRef = useRef(new Map<string, Promise<CheckoutSessionResult>>());
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'unavailable' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [analyticsConsentGranted, setAnalyticsConsentGranted] = useState(hasAnalyticsConsentCookieInBrowser);
  const normalizedChargeCurrency = (chargeCurrency || 'USD').toUpperCase();
  const sessionUserId = session?.user?.id ?? null;

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    labelsRef.current = labels;
    handlersRef.current = {
      onCaptchaRequired,
      onPaymentFailed,
      onPaymentStarted,
    };
  }, [labels, onCaptchaRequired, onPaymentFailed, onPaymentStarted]);

  useEffect(() => {
    const updateAnalyticsConsent = (nextConsent: boolean) => {
      setAnalyticsConsentGranted((current) => current === nextConsent ? current : nextConsent);
    };
    const handleConsentUpdated = (event: Event) => {
      updateAnalyticsConsent(analyticsConsentFromUpdateEvent(event, hasAnalyticsConsentCookieInBrowser));
    };
    const handleStorage = (event: StorageEvent) => {
      if (event.key && event.key !== ANALYTICS_CONSENT_STORAGE_KEY) return;
      updateAnalyticsConsent(hasAnalyticsConsentCookieInBrowser());
    };

    window.addEventListener('consent:updated', handleConsentUpdated as EventListener);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('consent:updated', handleConsentUpdated as EventListener);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

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
      if (!enabled || !sessionUserId || !stripePromise || !mountRef.current) {
        setStatus('idle');
        setMessage(null);
        return;
      }

      awaitingCaptchaRef.current = false;
      setStatus('loading');
      setMessage(null);
      confirmStartedRef.current = false;
      readyTimedOut = false;
      clearExpressCheckoutReadyTimeout();
      let activeCheckoutAttemptId: number | null = null;
      let activeSessionId: string | null = null;
      readyTimeoutId = window.setTimeout(() => {
        if (cancelled) return;
        readyTimedOut = true;
        expressElement?.destroy();
        expressElement = null;
        setStatus('unavailable');
        setMessage(labelsRef.current.expressUnavailable);
        recordCheckoutInteractionEvent({
          amountCents,
          checkoutAttemptId: activeCheckoutAttemptId,
          eventName: 'express_checkout_unavailable',
          mode: 'express_checkout',
          stripeCheckoutSessionId: activeSessionId,
          metadata: {
            currency: normalizedChargeCurrency,
            reason: 'ready_timeout',
          },
        });
      }, EXPRESS_CHECKOUT_READY_TIMEOUT_MS);
      const analyticsJourney = readWalletAnalyticsJourney();
      const ga4Context = analyticsConsentGranted
        ? await readGa4CheckoutContext()
        : { clientId: null, sessionId: null };
      if (cancelled || readyTimedOut) return;
      const attributionKey = `${analyticsConsentGranted ? 'analytics-granted' : 'analytics-denied'}:${walletAnalyticsJourneyCacheKey(analyticsJourney)}:${ga4Context.clientId ?? 'no-client'}:${ga4Context.sessionId ?? 'no-session'}`;
      const requestKey = buildWalletExpressCheckoutRequestKey({
        userId: sessionUserId,
        amountCents,
        currency: normalizedChargeCurrency,
        locale,
        attributionKey,
      });

      try {
        const cachedCheckoutSession = checkoutSessionCacheRef.current.get(requestKey);
        const checkoutSessionResult =
          cachedCheckoutSession
            ? {
                type: 'success' as const,
                checkoutAttemptId: cachedCheckoutSession.checkoutAttemptId,
                clientSecret: cachedCheckoutSession.clientSecret,
                sessionId: cachedCheckoutSession.sessionId,
              }
            : await getCheckoutSessionResult(requestKey, analyticsJourney, ga4Context);

        if (cancelled || readyTimedOut) return;
        if (checkoutSessionResult.type !== 'success') {
          clearExpressCheckoutReadyTimeout();
          if (checkoutSessionResult.type === 'captcha_required') {
            setStatus('unavailable');
            setMessage(null);
            awaitingCaptchaRef.current = true;
            handlersRef.current.onCaptchaRequired();
            return;
          }
          if (checkoutSessionResult.type === 'rate_limited') {
            setStatus('error');
            setMessage(formatRateLimitMessage(labelsRef.current.rateLimited, checkoutSessionResult.retryAfterSeconds));
            return;
          }
          throw new Error(checkoutSessionResult.error);
        }
        activeCheckoutAttemptId = checkoutSessionResult.checkoutAttemptId;
        activeSessionId = checkoutSessionResult.sessionId;
        recordCheckoutInteractionEvent({
          amountCents,
          checkoutAttemptId: checkoutSessionResult.checkoutAttemptId,
          eventName: 'express_checkout_session_ready',
          mode: 'express_checkout',
          stripeCheckoutSessionId: checkoutSessionResult.sessionId,
          metadata: {
            currency: normalizedChargeCurrency,
          },
        });

        const stripe = (await stripePromise) as StripeWithCheckoutElements | null;
        const initCheckout = stripe?.initCheckout ?? stripe?.initCheckoutElementsSdk;
        if (!stripe || !initCheckout || !mountRef.current || cancelled || readyTimedOut) {
          throw new Error('stripe_checkout_elements_unavailable');
        }

        const checkout = initCheckout.call(stripe, { clientSecret: checkoutSessionResult.clientSecret });
        const loadActionsPromise: Promise<StripeCheckoutLoadActionsResult> = checkout.loadActions();
        expressElement = checkout.createExpressCheckoutElement({
          buttonHeight: 50,
          buttonType: { applePay: 'buy', googlePay: 'pay', paypal: 'buynow' },
          layout: { maxColumns: 2, maxRows: 2, overflow: 'auto' },
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
          setMessage(null);
          recordCheckoutInteractionEvent({
            amountCents,
            checkoutAttemptId: checkoutSessionResult.checkoutAttemptId,
            eventName: hasAnyMethod ? 'express_checkout_ready' : 'express_checkout_unavailable',
            mode: 'express_checkout',
            stripeCheckoutSessionId: checkoutSessionResult.sessionId,
            metadata: {
              availablePaymentMethods: methods ? Object.keys(methods).filter((key) => Boolean(methods[key as keyof typeof methods])) : [],
              currency: normalizedChargeCurrency,
              reason: hasAnyMethod ? 'ready' : 'no_available_methods',
            },
          });
        });
        expressElement.on('loaderror', (event) => {
          if (cancelled || readyTimedOut) return;
          clearExpressCheckoutReadyTimeout();
          setStatus('error');
          setMessage(event.error?.message ?? labelsRef.current.expressError);
          recordCheckoutInteractionEvent({
            amountCents,
            checkoutAttemptId: checkoutSessionResult.checkoutAttemptId,
            eventName: 'express_checkout_loaderror',
            mode: 'express_checkout',
            stripeCheckoutSessionId: checkoutSessionResult.sessionId,
            metadata: {
              errorMessage: event.error?.message ?? null,
            },
          });
        });
        expressElement.on('cancel', () => {
          if (cancelled || readyTimedOut || confirmStartedRef.current) return;
          setMessage(labelsRef.current.expressClosed);
          recordCheckoutInteractionEvent({
            amountCents,
            checkoutAttemptId: checkoutSessionResult.checkoutAttemptId,
            eventName: 'express_checkout_cancelled',
            mode: 'express_checkout',
            stripeCheckoutSessionId: checkoutSessionResult.sessionId,
          });
        });
        expressElement.on('confirm', async (event) => {
          if (cancelled || readyTimedOut || confirmStartedRef.current) return;
          confirmStartedRef.current = true;
          setMessage(null);
          handlersRef.current.onPaymentStarted(amountCents);
          recordCheckoutInteractionEvent({
            amountCents,
            checkoutAttemptId: checkoutSessionResult.checkoutAttemptId,
            eventName: 'express_checkout_confirm_started',
            mode: 'express_checkout',
            stripeCheckoutSessionId: checkoutSessionResult.sessionId,
          });
          try {
            const loadActionsResult = await loadActionsPromise;
            if (cancelled || readyTimedOut) return;
            if (loadActionsResult.type !== 'success') {
              throw new Error(loadActionsResult.error.message);
            }
            const result = await loadActionsResult.actions.confirm({
              expressCheckoutConfirmEvent: event,
            });
            if (cancelled || readyTimedOut) return;
            if (result.type === 'error') {
              confirmStartedRef.current = false;
              event.paymentFailed({ reason: 'fail', message: result.error.message });
              handlersRef.current.onPaymentFailed(amountCents, result.error.message);
              setMessage(result.error.message);
              recordCheckoutInteractionEvent({
                amountCents,
                checkoutAttemptId: checkoutSessionResult.checkoutAttemptId,
                eventName: 'express_checkout_confirm_failed',
                mode: 'express_checkout',
                stripeCheckoutSessionId: checkoutSessionResult.sessionId,
                metadata: {
                  errorMessage: result.error.message,
                },
              });
              return;
            }
            const params = new URLSearchParams({
              status: 'success',
              amount: (amountCents / 100).toFixed(2),
              amountCents: String(amountCents),
              currency: 'USD',
              settlementCurrency: normalizedChargeCurrency,
            });
            if (checkoutSessionResult.sessionId) {
              params.set('checkoutSessionId', checkoutSessionResult.sessionId);
            }
            recordCheckoutInteractionEvent({
              amountCents,
              checkoutAttemptId: checkoutSessionResult.checkoutAttemptId,
              eventName: 'express_checkout_confirm_succeeded',
              mode: 'express_checkout',
              stripeCheckoutSessionId: checkoutSessionResult.sessionId,
            });
            window.location.href = `/billing?${params.toString()}`;
          } catch (error) {
            if (cancelled || readyTimedOut) return;
            confirmStartedRef.current = false;
            const reason = error instanceof Error ? error.message : 'express_checkout_failed';
            event.paymentFailed({ reason: 'fail', message: labelsRef.current.expressError });
            handlersRef.current.onPaymentFailed(amountCents, reason);
            // Keep the same session and buttons available for a deliberate retry.
            // Recreating sessions here would bypass Stripe's per-session failure limit.
            setMessage(labelsRef.current.expressError);
            recordCheckoutInteractionEvent({
              amountCents,
              checkoutAttemptId: checkoutSessionResult.checkoutAttemptId,
              eventName: 'express_checkout_confirm_failed',
              mode: 'express_checkout',
              stripeCheckoutSessionId: checkoutSessionResult.sessionId,
              metadata: {
                errorMessage: reason,
              },
            });
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
        setMessage(labelsRef.current.expressError);
        recordCheckoutInteractionEvent({
          amountCents,
          checkoutAttemptId: activeCheckoutAttemptId,
          eventName: 'express_checkout_unavailable',
          mode: 'express_checkout',
          stripeCheckoutSessionId: activeSessionId,
          metadata: {
            errorMessage: reason,
          },
        });
      }
    }

    async function getCheckoutSessionResult(
      requestKey: string,
      analyticsJourney: WalletAnalyticsJourney | null,
      ga4Context: { clientId: string | null; sessionId: string | null },
    ): Promise<CheckoutSessionResult> {
      const pendingCheckoutSession = pendingCheckoutSessionRef.current.get(requestKey);
      if (pendingCheckoutSession) {
        return pendingCheckoutSession;
      }

      const promise = createCheckoutSessionResult(analyticsJourney, ga4Context);
      pendingCheckoutSessionRef.current.set(requestKey, promise);
      try {
        const result = await promise;
        if (result.type === 'success' && result.expiresAt) {
          checkoutSessionCacheRef.current.set(requestKey, result, result.expiresAt * 1000 - 30_000);
        }
        return result;
      } finally {
        pendingCheckoutSessionRef.current.delete(requestKey);
      }
    }

    async function createCheckoutSessionResult(
      analyticsJourney: WalletAnalyticsJourney | null,
      ga4Context: { clientId: string | null; sessionId: string | null },
    ): Promise<CheckoutSessionResult> {
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
          captchaToken: captchaTokenRef.current ?? undefined,
          ...(ga4Context.clientId ? { gaClientId: ga4Context.clientId } : {}),
          ...(ga4Context.sessionId ? { gaSessionId: ga4Context.sessionId } : {}),
          ...(analyticsJourney ? { analyticsJourney } : {}),
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
        checkoutAttemptId:
          typeof payload?.checkoutAttemptId === 'number' && Number.isFinite(payload.checkoutAttemptId)
            ? payload.checkoutAttemptId
            : null,
        clientSecret,
        sessionId: typeof payload?.id === 'string' ? payload.id : null,
        expiresAt: typeof payload?.expiresAt === 'number' ? payload.expiresAt : undefined,
      };
    }

    // Wait for a settled selection. A quick tap through several amounts must not
    // create payable sessions or consume the anti-card-testing session limits.
    const mountTimeoutId = window.setTimeout(() => { void mountExpressCheckout(); }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(mountTimeoutId);
      clearExpressCheckoutReadyTimeout();
      expressElement?.destroy();
    };
  }, [
    enabled,
    amountCents,
    analyticsConsentGranted,
    locale,
    captchaRetry,
    normalizedChargeCurrency,
    sessionUserId,
    stripePromise,
  ]);

  if (!session || !enabled) {
    return null;
  }

  const hideExpressElement = status === 'unavailable' || status === 'error';

  return (
    <div className="mt-4" hidden={status === 'unavailable' && !message}>
      <div className="mb-2">
        <div>
          <p className="text-sm font-semibold text-text-primary">{labels.expressTitle}</p>
        </div>
      </div>
      <div
        ref={mountRef}
        className={`min-h-[50px] ${hideExpressElement ? 'hidden' : ''}`}
        aria-label={labels.expressAriaLabel}
      />
      {status === 'loading' && <p role="status" className="mt-2 text-xs text-text-secondary">{labels.expressLoading}</p>}
      {message && <p role="status" className="mt-2 text-xs text-text-secondary">{message}</p>}
    </div>
  );
}
