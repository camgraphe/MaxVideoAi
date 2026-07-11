'use client';

import type { Stripe } from '@stripe/stripe-js';
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import type { AppLocale } from '@/i18n/locales';
import { recordCheckoutInteractionEvent, type CheckoutInteractionSource } from '@/lib/analytics/checkout-interaction-events';
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
    dispatchChallenge({ type: 'reset' });
    setFailureReason(null);
    setRetryAfterSeconds(null);
  }, []);

  useEffect(() => {
    resetCheckout();
  }, [amountCents, currency, resetCheckout]);

  const requireCaptcha = useCallback(() => {
    dispatchChallenge({ type: 'captcha_required' });
  }, []);

  const handleCaptchaToken = useCallback((token: string | null) => {
    dispatchChallenge({ type: 'captcha_token_changed', token });
  }, []);

  const handleCaptchaError = useCallback(() => {
    dispatchChallenge({ type: 'captcha_error' });
  }, []);

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
    const submittedCaptchaToken = challengeState.captchaToken;

    try {
      const analyticsJourney = readWalletAnalyticsJourney();
      const result = await requestHostedWalletCheckout({
        amountCents,
        currency,
        locale,
        accessToken,
        captchaToken: submittedCaptchaToken ?? undefined,
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
        dispatchChallenge({ type: 'checkout_not_redirected', submittedCaptchaToken });
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
        dispatchChallenge({ type: 'checkout_not_redirected', submittedCaptchaToken });
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
      dispatchChallenge({ type: 'checkout_not_redirected', submittedCaptchaToken });
      reportFailure('stripe', result.checkoutAttemptId);
    } catch {
      dispatchChallenge({
        type: 'checkout_not_redirected',
        submittedCaptchaToken,
      });
      reportFailure('stripe', null);
    } finally {
      submissionGuardRef.current.finish();
      setIsSubmitting(false);
    }
  }, [
    accessToken,
    amountCents,
    challengeState.captchaToken,
    currency,
    getStripePromise,
    locale,
    onRateLimited,
    onStarted,
    reportFailure,
    requireCaptcha,
    returnTarget,
    source,
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
  };
}
