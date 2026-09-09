import { useEffect } from 'react';
import {
  clearPendingWalletCheckoutReturn,
  consumePendingWalletCheckoutReturn,
  type WalletCheckoutReturnTarget,
} from '@/lib/wallet/checkout-return';
import { recordCheckoutInteractionEvent } from '../_lib/checkout-interaction-events';

type CheckoutReturnToastOptions = {
  accountId: string | null;
  authLoading: boolean;
  cancelledMessage: string;
  onAmountReturned: (amountCents: number | null) => void;
  onCancelled: (amountCents: number | null, currency: string) => void;
  onGoogleAdsConversion: (value?: number, currency?: string) => void;
  onReturnTarget: (target: WalletCheckoutReturnTarget | null) => void;
  onStatus: (status: 'success' | 'cancelled') => void;
  onSuccess: () => void;
  onToast: (message: string | null) => void;
  successMessage: string;
};

export function useBillingCheckoutReturnToast({
  accountId,
  authLoading,
  cancelledMessage,
  onAmountReturned,
  onCancelled,
  onGoogleAdsConversion,
  onReturnTarget,
  onStatus,
  onSuccess,
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
    const returnStatus = status === 'success' ? 'success' : status === 'cancelled' ? 'cancelled' : null;
    if (!returnStatus) return undefined;
    if (returnStatus === 'success' && (authLoading || !accountId)) return undefined;
    const message = returnStatus === 'success' ? successMessage : cancelledMessage;

    onStatus(returnStatus);
    onToast(message);
    onAmountReturned(parsedAmountCents);
    const timeout = window.setTimeout(() => onToast(null), 4000);
    if (returnStatus === 'success') {
      onSuccess();
      onReturnTarget(consumePendingWalletCheckoutReturn());
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
    if (returnStatus === 'cancelled') {
      clearPendingWalletCheckoutReturn();
      onReturnTarget(null);
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
  }, [accountId, authLoading, cancelledMessage, onAmountReturned, onCancelled, onGoogleAdsConversion, onReturnTarget, onStatus, onSuccess, onToast, successMessage]);
}
