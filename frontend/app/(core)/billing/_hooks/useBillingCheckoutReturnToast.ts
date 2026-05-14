import { useEffect } from 'react';
import { recordCheckoutInteractionEvent } from '../_lib/checkout-interaction-events';

type CheckoutReturnToastOptions = {
  cancelledMessage: string;
  onCancelled: (amountCents: number | null, currency: string) => void;
  onGoogleAdsConversion: (value?: number, currency?: string) => void;
  onToast: (message: string | null) => void;
  successMessage: string;
};

export function useBillingCheckoutReturnToast({
  cancelledMessage,
  onCancelled,
  onGoogleAdsConversion,
  onToast,
  successMessage,
}: CheckoutReturnToastOptions) {
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const url = new URL(window.location.href);
    const status = url.searchParams.get('status');
    const amountParam = url.searchParams.get('amount');
    const amountCentsParam = url.searchParams.get('amountCents');
    const currencyParam = url.searchParams.get('currency');
    const checkoutSessionIdParam = url.searchParams.get('checkoutSessionId');
    const parsedAmountCents = amountCentsParam
      ? Math.max(0, Math.round(Number(amountCentsParam)))
      : amountParam
        ? Math.max(0, Math.round(Number(amountParam) * 100))
        : null;
    const parsedCurrency = String(currencyParam ?? 'USD').toUpperCase();
    if (!status) return undefined;
    const message = status === 'success' ? successMessage : status === 'cancelled' ? cancelledMessage : null;
    if (!message) return undefined;

    onToast(message);
    const timeout = window.setTimeout(() => onToast(null), 4000);
    if (status === 'success') {
      onGoogleAdsConversion(amountParam ? Number(amountParam) : undefined, currencyParam ?? undefined);
      if (checkoutSessionIdParam) {
        recordCheckoutInteractionEvent({
          amountCents: parsedAmountCents,
          eventName: 'hosted_checkout_success_return',
          mode: 'hosted',
          stripeCheckoutSessionId: checkoutSessionIdParam,
        });
      }
    }
    if (status === 'cancelled') {
      onCancelled(parsedAmountCents, parsedCurrency);
      if (checkoutSessionIdParam) {
        recordCheckoutInteractionEvent({
          amountCents: parsedAmountCents,
          eventName: 'hosted_checkout_cancelled_return',
          mode: 'hosted',
          stripeCheckoutSessionId: checkoutSessionIdParam,
        });
      }
    }
    ['status', 'amount', 'amountCents', 'currency', 'settlementCurrency', 'topupTier', 'checkoutSessionId'].forEach(
      (param) => url.searchParams.delete(param)
    );
    window.history.replaceState({}, '', url.toString());
    return () => window.clearTimeout(timeout);
  }, [cancelledMessage, onCancelled, onGoogleAdsConversion, onToast, successMessage]);
}
