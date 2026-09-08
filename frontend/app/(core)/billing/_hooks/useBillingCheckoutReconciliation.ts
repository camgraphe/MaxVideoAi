'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  runBillingCheckoutReconciliation,
  type BillingCheckoutReconciliationResult,
} from '../_lib/billing-checkout-reconciliation';

export type BillingCheckoutReconciliationStatus = 'idle' | 'refreshing' | Exclude<BillingCheckoutReconciliationResult, 'cancelled'>;

export function useBillingCheckoutReconciliation({
  accountId,
  refreshWallet,
  refreshReceipts,
}: {
  accountId: string | null;
  refreshWallet: () => Promise<boolean>;
  refreshReceipts: () => Promise<boolean>;
}) {
  const [status, setStatus] = useState<BillingCheckoutReconciliationStatus>('idle');
  const generationRef = useRef(0);

  useEffect(() => {
    generationRef.current += 1;
    setStatus('idle');
  }, [accountId]);

  useEffect(() => () => {
    generationRef.current += 1;
  }, []);

  const reconcile = useCallback(async () => {
    if (!accountId) return;
    const generation = ++generationRef.current;
    setStatus('refreshing');
    const result = await runBillingCheckoutReconciliation({
      refreshWallet,
      refreshReceipts,
      isActive: () => generationRef.current === generation,
    });
    if (generationRef.current !== generation || result === 'cancelled') return;
    setStatus(result);
  }, [accountId, refreshReceipts, refreshWallet]);

  return { reconcile, status };
}
