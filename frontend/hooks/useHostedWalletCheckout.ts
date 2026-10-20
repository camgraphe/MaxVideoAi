'use client';

import type { Stripe } from '@stripe/stripe-js';
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import type { AppLocale } from '@/i18n/locales';
import { recordCheckoutInteractionEvent, type CheckoutInteractionSource } from '@/lib/analytics/checkout-interaction-events';
import { readGa4CheckoutContext } from '@/lib/analytics/ga-session-browser';
import { readWalletAnalyticsJourney } from '@/lib/analytics/journey-browser';
import {
  beginHostedWalletCheckoutAttempt,
  clearPendingWalletCheckoutReturn,
  persistPendingWalletCheckoutReturn,
  type WalletCheckoutReturnTarget,
} from '@/lib/wallet/checkout-return';
import {
  createHostedCheckoutChallengeState,
  createHostedCheckoutSubmissionGuard,
  hostedCheckoutChallengeReducer,
  requestHostedWalletCheckout,
  type HostedWalletCheckoutFailureReason,
} from '@/lib/wallet/hosted-checkout';

const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '';
const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '';

type LegacyCheckoutStripe = Stripe & {
  redirectToCheckout?: (params: { sessionId: string }) => Promise<{ error?: { message?: string } }>;
};

type CheckoutEventContext = {
  amountCents: number;
  currency: string;
};

type CheckoutFailureContext = CheckoutEventContext & {
  reason: HostedWalletCheckoutFailureReason;
};

type UseHostedWalletCheckoutOptions = {
  accessToken: string | null;
  amountCents: number;
  currency: string;
  locale: AppLocale;
  source: CheckoutInteractionSource;
  returnTarget?: WalletCheckoutReturnTarget;
  stripePromise?: Promise<Stripe | null> | null;
  onStarted: (context: CheckoutEventContext) => void;
  onFailed: (context: CheckoutFailureContext) => void;
  onRateLimited: (retryAfterSeconds: number | null) => void;
};

export function useHostedWalletCheckout({
  accessToken,
  amountCents,
  currency,
  locale,
  source,
  returnTarget,
  stripePromise: suppliedStripePromise,
  onStarted,
  onFailed,
  onRateLimited,
}: UseHostedWalletCheckoutOptions) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [challengeState, dispatchChallenge] = useReducer(
    hostedCheckoutChallengeReducer,
    undefined,
    createHostedCheckoutChallengeState
  );
  const [failureReason, setFailureReason] = useState<HostedWalletCheckoutFailureReason | null>(null);
  const [retryAfterSeconds, setRetryAfterSeconds] = useState<number | null>(null);
  const captchaTokenRef = useRef<string | null>(null);
  const submissionGuardRef = useRef(createHostedCheckoutSubmissionGuard());
  const stripePromiseRef = useRef<{ locale: AppLocale; promise: Promise<Stripe | null> } | null>(null);
  const getStripePromise = useCallback(
    () => {
      if (suppliedStripePromise !== undefined) return suppliedStripePromise;
      if (!PUBLISHABLE_KEY) return null;
      if (stripePromiseRef.current?.locale === locale) return stripePromiseRef.current.promise;

      const promise = import('@stripe/stripe-js').then(({ loadStripe }) =>
        loadStripe(PUBLISHABLE_KEY, { locale })
      );
      stripePromiseRef.current = { locale, promise };
      return promise;
    },
    [locale, suppliedStripePromise]
  );

  const resetCheckout = useCallback(() => {
    captchaTokenRef.current = null;
    dispatchChallenge({ type: 'reset' });
    setFailureReason(null);
    setRetryAfterSeconds(null);
  }, []);

  useEffect(() => {
    resetCheckout();
  }, [amountCents, currency, resetCheckout]);

  const requireCaptcha = useCallback(() => {
    captchaTokenRef.current = null;
    dispatchChallenge({ type: 'captcha_required' });
  }, []);

  const handleCaptchaToken = useCallback((token: string | null) => {
    captchaTokenRef.current = token;
    dispatchChallenge({ type: 'captcha_token_changed', token });
  }, []);

  const handleCaptchaError = useCallback(() => {
    captchaTokenRef.current = null;
    dispatchChallenge({ type: 'captcha_error' });
  }, []);

  const takeCaptchaToken = useCallback(() => {
    const token = captchaTokenRef.current;
    // Both payment paths claim the same single-use proof synchronously, before
    // awaiting a request. Refresh the widget without discarding a Stripe session.
    if (token) requireCaptcha();
    return token;
  }, [requireCaptcha]);

  const reportFailure = useCallback((reason: HostedWalletCheckoutFailureReason, checkoutAttemptId: number | null) => {
    clearPendingWalletCheckoutReturn();
    setFailureReason(reason);
    recordCheckoutInteractionEvent({
      amountCents,
      checkoutAttemptId,
      eventName: 'hosted_checkout_failed',
      mode: 'hosted',
      source,
      metadata: { currency, failureCategory: reason },
    });
    onFailed({ amountCents, currency, reason });
  }, [amountCents, currency, onFailed, source]);

  const startCheckout = useCallback(async () => {
    if (!submissionGuardRef.current.tryStart()) return;
    beginHostedWalletCheckoutAttempt();
    setIsSubmitting(true);
    setFailureReason(null);
    setRetryAfterSeconds(null);
    recordCheckoutInteractionEvent({
      amountCents,
      eventName: 'hosted_checkout_requested',
      mode: 'hosted',
      source,
      metadata: { currency, locale },
    });
    try {
      const analyticsJourney = readWalletAnalyticsJourney();
      let ga4LookupStatus = 'unobserved';
      const ga4Context = await readGa4CheckoutContext({ onDiagnostic: status => { ga4LookupStatus = status; } });
      const submittedCaptchaToken = takeCaptchaToken();
      const result = await requestHostedWalletCheckout({
        amountCents,
        currency,
        locale,
        accessToken,
        captchaToken: submittedCaptchaToken ?? undefined,
        captchaSiteKey: TURNSTILE_SITE_KEY,
        gaClientId: ga4Context.clientId,
        gaSessionId: ga4Context.sessionId,
        analyticsJourney,
      });

      if (result.kind === 'captcha_required') {
        requireCaptcha();
        recordCheckoutInteractionEvent({
          amountCents,
          eventName: 'hosted_checkout_captcha_required',
          mode: 'hosted',
          source,
          metadata: { currency },
        });
        return;
      }

      if (result.kind === 'rate_limited') {
        setRetryAfterSeconds(result.retryAfterSeconds);
        recordCheckoutInteractionEvent({
          amountCents,
          eventName: 'hosted_checkout_rate_limited',
          mode: 'hosted',
          source,
          metadata: { currency, retryAfterSeconds: result.retryAfterSeconds },
        });
        onRateLimited(result.retryAfterSeconds);
        return;
      }

      if (result.kind === 'failed') {
        reportFailure(result.reason, result.checkoutAttemptId);
        return;
      }

      onStarted({ amountCents, currency });
      recordCheckoutInteractionEvent({
        amountCents,
        checkoutAttemptId: result.checkoutAttemptId,
        eventName: 'hosted_checkout_redirecting',
        mode: 'hosted',
        source,
        stripeCheckoutSessionId: result.sessionId,
        metadata: {
          currency,
          redirectMethod: result.url ? 'url' : 'stripe_js',
          ga4LookupStatus,
        },
      });

      if (result.url) {
        if (returnTarget) persistPendingWalletCheckoutReturn(returnTarget);
        dispatchChallenge({ type: 'reset' });
        window.location.href = result.url;
        return;
      }

      if (result.sessionId) {
        const stripePromise = getStripePromise();
        if (stripePromise) {
          const stripe = (await stripePromise) as LegacyCheckoutStripe | null;
          if (stripe?.redirectToCheckout) {
            if (returnTarget) persistPendingWalletCheckoutReturn(returnTarget);
            const redirectResult = await stripe.redirectToCheckout({ sessionId: result.sessionId });
            if (redirectResult && !redirectResult.error) return;
          }
        }
      }
      reportFailure('stripe', result.checkoutAttemptId);
    } catch {
      reportFailure('stripe', null);
    } finally {
      submissionGuardRef.current.finish();
      setIsSubmitting(false);
    }
  }, [
    accessToken,
    amountCents,
    currency,
    getStripePromise,
    locale,
    onRateLimited,
    onStarted,
    reportFailure,
    requireCaptcha,
    returnTarget,
    source,
    takeCaptchaToken,
  ]);

  return {
    captchaError: challengeState.captchaError,
    captchaRequired: challengeState.captchaRequired,
    captchaResetGeneration: challengeState.resetGeneration,
    captchaToken: challengeState.captchaToken,
    failureReason,
    handleCaptchaError,
    handleCaptchaToken,
    isSubmitting,
    requireCaptcha,
    resetCheckout,
    retryAfterSeconds,
    startCheckout,
    takeCaptchaToken,
  };
}
