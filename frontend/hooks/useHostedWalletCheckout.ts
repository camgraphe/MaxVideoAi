'use client';

import { loadStripe, type Stripe } from '@stripe/stripe-js';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AppLocale } from '@/i18n/locales';
import { recordCheckoutInteractionEvent, type CheckoutInteractionSource } from '@/lib/analytics/checkout-interaction-events';
import {
  clearPendingWalletCheckoutReturn,
  persistPendingWalletCheckoutReturn,
  type WalletCheckoutReturnTarget,
} from '@/lib/wallet/checkout-return';
import {
  createHostedCheckoutSubmissionGuard,
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
  const [captchaRequired, setCaptchaRequired] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaError, setCaptchaError] = useState(false);
  const [failureReason, setFailureReason] = useState<HostedWalletCheckoutFailureReason | null>(null);
  const [retryAfterSeconds, setRetryAfterSeconds] = useState<number | null>(null);
  const submissionGuardRef = useRef(createHostedCheckoutSubmissionGuard());
  const internalStripePromise = useMemo(
    () => (
      suppliedStripePromise === undefined && PUBLISHABLE_KEY
        ? loadStripe(PUBLISHABLE_KEY, { locale })
        : null
    ),
    [locale, suppliedStripePromise]
  );
  const stripePromise = suppliedStripePromise === undefined ? internalStripePromise : suppliedStripePromise;

  const resetCheckout = useCallback(() => {
    setCaptchaRequired(false);
    setCaptchaToken(null);
    setCaptchaError(false);
    setFailureReason(null);
    setRetryAfterSeconds(null);
  }, []);

  useEffect(() => {
    resetCheckout();
  }, [amountCents, currency, resetCheckout]);

  const requireCaptcha = useCallback(() => {
    setCaptchaRequired(true);
    setCaptchaToken(null);
    setCaptchaError(false);
  }, []);

  const handleCaptchaToken = useCallback((token: string | null) => {
    setCaptchaToken(token);
    if (token) setCaptchaError(false);
  }, []);

  const handleCaptchaError = useCallback(() => {
    setCaptchaToken(null);
    setCaptchaError(true);
  }, []);

  const reportFailure = useCallback((reason: HostedWalletCheckoutFailureReason, checkoutAttemptId: number | null) => {
    if (returnTarget) clearPendingWalletCheckoutReturn();
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
  }, [amountCents, currency, onFailed, returnTarget, source]);

  const startCheckout = useCallback(async () => {
    if (!submissionGuardRef.current.tryStart()) return;
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
      const result = await requestHostedWalletCheckout({
        amountCents,
        currency,
        locale,
        accessToken,
        captchaToken: captchaToken ?? undefined,
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

      setCaptchaRequired(false);
      setCaptchaToken(null);
      setCaptchaError(false);
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
        window.location.href = result.url;
        return;
      }

      if (result.sessionId && stripePromise) {
        if (returnTarget) persistPendingWalletCheckoutReturn(returnTarget);
        const stripe = (await stripePromise) as LegacyCheckoutStripe | null;
        const redirectResult = await stripe?.redirectToCheckout?.({ sessionId: result.sessionId });
        if (redirectResult && !redirectResult.error) return;
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
    captchaToken,
    currency,
    locale,
    onRateLimited,
    onStarted,
    reportFailure,
    requireCaptcha,
    returnTarget,
    source,
    stripePromise,
  ]);

  return {
    captchaError,
    captchaRequired,
    captchaToken,
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
