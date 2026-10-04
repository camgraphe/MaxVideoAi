import { useEffect, useRef } from 'react';
import { recordCheckoutInteractionEvent } from '@/lib/analytics/checkout-interaction-events';

/** Measures a committed review in a visible tab, not whether the person read it. */
export function useWorkspaceTopupReviewAnalytics({
  amountCents,
  chargeCurrency,
  paymentAmountLabel,
  quoteLoading,
  quoteError,
}: {
  amountCents: number;
  chargeCurrency: string;
  paymentAmountLabel: string | null;
  quoteLoading: boolean;
  quoteError: boolean;
}) {
  const opened = useRef(false);
  const displayed = useRef(new Set<string>());
  useEffect(() => {
    function measureVisibleReview() {
      if (document.visibilityState !== 'visible') return;
      const metadata = { measurement_version: 1, currency: chargeCurrency, tax_included: false };
      if (!opened.current) {
        opened.current = true;
        recordCheckoutInteractionEvent({ eventName: 'topup_review_opened', source: 'workspace', mode: 'hosted', amountCents, metadata });
      }
      if (quoteLoading || (!quoteError && !paymentAmountLabel)) return;
      const key = `${amountCents}:${chargeCurrency}:${quoteError ? 'fallback' : paymentAmountLabel}`;
      if (displayed.current.has(key)) return;
      displayed.current.add(key);
      recordCheckoutInteractionEvent({
        eventName: quoteError ? 'topup_quote_fallback_displayed' : 'topup_quote_displayed',
        source: 'workspace', mode: 'hosted', amountCents, metadata,
      });
    }
    measureVisibleReview();
    document.addEventListener('visibilitychange', measureVisibleReview);
    return () => document.removeEventListener('visibilitychange', measureVisibleReview);
  }, [amountCents, chargeCurrency, paymentAmountLabel, quoteError, quoteLoading]);
}
